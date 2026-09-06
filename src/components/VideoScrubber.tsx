import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface VideoScrubberProps {
  src: string;
  /** CSS selector for the section this video should be scroll-linked to (e.g. "#journey"). */
  containerSelector: string;
  scrub?: number;
  poster?: string;
}

export function VideoScrubber({
  src,
  containerSelector,
  scrub = 1.5,
  poster,
}: VideoScrubberProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollTriggerRef = useRef<ReturnType<typeof ScrollTrigger.create> | null>(null);
  const mountedRef = useRef(false);
  const initializedRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const posterRef = useRef<HTMLImageElement | null>(null);
  const posterLoadedRef = useRef(false);

  // Smooth-scrub refs: ScrollTrigger only ever writes a *target* progress.
  // A separate rAF loop eases the video's currentTime toward that target
  // every frame, which is what makes the scrubbing feel buttery instead of
  // snapping to a new frame on every scroll tick.
  const targetProgressRef = useRef(0);
  const currentTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (initializedRef.current) {
      mountedRef.current = true;
      return;
    }
    initializedRef.current = true;
    mountedRef.current = true;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotionRef.current = mediaQuery.matches;

    const handleMotionChange = (e: MediaQueryListEvent): void => {
      prefersReducedMotionRef.current = e.matches;
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.refresh();
      }
    };
    mediaQuery.addEventListener("change", handleMotionChange);

    let cancelled = false;
    const abortController = new AbortController();

    const handleCanPlay = (): void => {
      if (cancelled) return;
      setLoading(false);
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.refresh();
      }
    };

    const handleError = (e: Event): void => {
      if (cancelled) return;
      console.error("[VideoScrubber] Video load error:", e);
      setError("Failed to load video");
      setLoading(false);
    };

    const handleLoadedMetadata = (): void => {
      if (cancelled) return;
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.currentTime = 0;
        if (scrollTriggerRef.current) {
          scrollTriggerRef.current.refresh();
        }
      }
    };

    videoElement.addEventListener("canplay", handleCanPlay);
    videoElement.addEventListener("error", handleError);
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);

    // Load poster image as an immediate fallback frame.
    if (poster) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = poster;
      img.onload = () => {
        posterLoadedRef.current = true;
        posterRef.current = img;
      };
      img.onerror = () => {
        posterLoadedRef.current = false;
      };
    }

    // Fully buffer the clip into memory (blob URL) before wiring up
    // scrubbing, so seeking during scroll never stalls waiting on the
    // network — this is the single biggest factor in how smooth a
    // scroll-scrubbed video feels.
    fetch(src, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Video fetch failed: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.src = blobUrl;
          videoEl.load();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // Fall back to direct network streaming if the prefetch fails
        // (e.g. very large file, flaky connection).
        console.warn("[VideoScrubber] Falling back to direct src streaming:", err);
        const videoEl = videoRef.current;
        if (videoEl && videoEl.src !== src) {
          videoEl.src = src;
          videoEl.load();
        }
      });

    const containerEl = document.querySelector<HTMLElement>(containerSelector);
    if (!containerEl) return;

    const st = ScrollTrigger.create({
      trigger: containerEl,
      start: "top top",
      end: "bottom bottom",
      scrub: prefersReducedMotionRef.current ? 0 : scrub,
      onUpdate: (self): void => {
        if (!mountedRef.current) return;
        if (prefersReducedMotionRef.current) return;
        targetProgressRef.current = Math.min(1, Math.max(0, self.progress));
      },
      onEnter: () => setActive(true),
      onEnterBack: () => setActive(true),
      onLeave: () => setActive(false),
      onLeaveBack: () => setActive(false),
      onRefresh: (): void => {
        if (!mountedRef.current) return;
      },
    });

    scrollTriggerRef.current = st;

    // The smoothing loop itself: eases currentTime toward the scroll
    // target every animation frame instead of jumping straight to it.
    const tick = (): void => {
      const videoEl = videoRef.current;
      if (
        videoEl &&
        Number.isFinite(videoEl.duration) &&
        videoEl.duration > 0 &&
        !prefersReducedMotionRef.current
      ) {
        const targetTime = targetProgressRef.current * videoEl.duration;
        const smoothing = 0.18; // lower = smoother/laggier, higher = snappier/less smooth
        currentTimeRef.current += (targetTime - currentTimeRef.current) * smoothing;

        if (Math.abs(videoEl.currentTime - currentTimeRef.current) > 0.02) {
          const fastSeek = (videoEl as HTMLVideoElement & { fastSeek?: (time: number) => void })
            .fastSeek;
          if (typeof fastSeek === "function") {
            fastSeek.call(videoEl, currentTimeRef.current);
          } else {
            videoEl.currentTime = currentTimeRef.current;
          }
        }
      } // <-- this closing brace was missing
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);

    const handleWindowLoad = (): void => {
      if (mountedRef.current && scrollTriggerRef.current) {
        scrollTriggerRef.current.refresh();
      }
    };
    window.addEventListener("load", handleWindowLoad);

    const initialRefreshTimeout = setTimeout(() => {
      if (mountedRef.current && scrollTriggerRef.current) {
        scrollTriggerRef.current.refresh();
      }
    }, 100);

    const drawPosterFrame = (): void => {
      const videoEl = videoRef.current;
      if (!videoEl || !posterLoadedRef.current || !posterRef.current) return;

      const canvas = document.createElement("canvas");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = posterRef.current;
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (canvas.width - drawWidth) * 0.5;
      const offsetY = (canvas.height - drawHeight) * 0.5;

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      const videoContainer = document.querySelector(".video-scrubber") as HTMLElement | null;
      if (videoContainer) {
        videoContainer.style.backgroundImage = `url(${canvas.toDataURL("image/webp")})`;
        videoContainer.style.backgroundSize = "cover";
        videoContainer.style.backgroundPosition = "center";
      }
    };

    if (posterLoadedRef.current) {
      drawPosterFrame();
    }

    return (): void => {
      mountedRef.current = false;
      cancelled = true;
      abortController.abort();
      clearTimeout(initialRefreshTimeout);
      window.removeEventListener("load", handleWindowLoad);
      mediaQuery.removeEventListener("change", handleMotionChange);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (videoElement) {
        videoElement.removeEventListener("canplay", handleCanPlay);
        videoElement.removeEventListener("error", handleError);
        videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      }
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
        scrollTriggerRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [containerSelector, scrub, poster, src]);

  // Separate effect: keep ScrollTrigger's start/end in sync if the journey
  // container's height changes (e.g. content loads in, fonts swap).
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(containerSelector);
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.refresh();
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerSelector]);

  const posterStyle = poster
    ? {
      backgroundImage: `url(${poster})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }
    : {};

  return (
    <div
      className="video-scrubber"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: active ? 1 : 0,
        visibility: active ? "visible" : "hidden",
        transition: "opacity 300ms ease",
        ...posterStyle,
      }}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        poster={poster}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: loading ? 0 : 1,
          transition: "opacity 300ms ease",
        }}
        aria-hidden="true"
      />
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-background-primary)",
            zIndex: 10,
            pointerEvents: "none",
            transition: "opacity 300ms ease",
          }}
          aria-live="polite"
        >
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "clamp(1rem, 3vw, 2rem)",
              color: "var(--color-text-tertiary)",
              letterSpacing: "0.1em",
            }}
          >
            Loading video...
          </span>
        </div>
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.8)",
            color: "white",
            zIndex: 20,
            padding: "2rem",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}