import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface VideoScrubberProps {
  src: string;
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
  const prefersReducedMotionRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const posterRef = useRef<HTMLImageElement | null>(null);
  const posterLoadedRef = useRef(false);

  const targetProgressRef = useRef(0);
  const currentTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    let cancelled = false;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotionRef.current = mediaQuery.matches;

    const handleMotionChange = (e: MediaQueryListEvent): void => {
      prefersReducedMotionRef.current = e.matches;
      scrollTriggerRef.current?.refresh();
    };
    mediaQuery.addEventListener("change", handleMotionChange);

    const handleCanPlay = (): void => {
      if (cancelled) return;
      console.log("[VideoScrubber] canplay fired");
      setLoading(false);
      scrollTriggerRef.current?.refresh();
    };

    // Backup: some browsers fire loadeddata before/instead of canplay in edge cases.
    const handleLoadedData = (): void => {
      if (cancelled) return;
      console.log("[VideoScrubber] loadeddata fired, readyState:", videoElement.readyState);
      setLoading(false);
      scrollTriggerRef.current?.refresh();
    };

    const handleError = (e: Event): void => {
      if (cancelled) return;
      console.error("[VideoScrubber] Video load error:", e, videoElement.error);
      setError("Failed to load video");
      setLoading(false);
    };

    const handleLoadedMetadata = (): void => {
      if (cancelled) return;
      console.log("[VideoScrubber] loadedmetadata fired, duration:", videoElement.duration);
      videoElement.currentTime = 0;
      scrollTriggerRef.current?.refresh();
    };

    videoElement.addEventListener("canplay", handleCanPlay);
    videoElement.addEventListener("loadeddata", handleLoadedData);
    videoElement.addEventListener("error", handleError);
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);

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

    // Direct assignment — let the browser stream + range-request the video
    // natively. No fetch/blob buffering: it was adding failure modes without
    // real benefit, since browsers already handle random-access seeking on
    // servers that support Range requests (most do).
    console.log("[VideoScrubber] assigning src:", src);
    videoElement.src = src;
    videoElement.load();

    // Safety net: if nothing fires within a few seconds, log full state so
    // we're not stuck guessing.
    const stuckTimeout = setTimeout(() => {
      if (cancelled) return;
      console.warn("[VideoScrubber] Still not ready after 5s:", {
        src: videoElement.src,
        readyState: videoElement.readyState,
        networkState: videoElement.networkState,
        error: videoElement.error,
      });
    }, 5000);

    const containerEl = document.querySelector<HTMLElement>(containerSelector);
    if (!containerEl) {
      clearTimeout(stuckTimeout);
      return;
    }

    const st = ScrollTrigger.create({
      trigger: containerEl,
      start: "top top",
      end: "bottom bottom",
      scrub: prefersReducedMotionRef.current ? 0 : scrub,
      onUpdate: (self): void => {
        if (cancelled) return;
        if (prefersReducedMotionRef.current) return;
        targetProgressRef.current = Math.min(1, Math.max(0, self.progress));
      },
      onEnter: () => setActive(true),
      onEnterBack: () => setActive(true),
      onLeave: () => setActive(false),
      onLeaveBack: () => setActive(false),
    });

    scrollTriggerRef.current = st;

    const tick = (): void => {
      const videoEl = videoRef.current;
      if (
        videoEl &&
        Number.isFinite(videoEl.duration) &&
        videoEl.duration > 0 &&
        !prefersReducedMotionRef.current
      ) {
        const targetTime = targetProgressRef.current * videoEl.duration;
        const smoothing = 0.18;
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
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);

    const handleWindowLoad = (): void => {
      scrollTriggerRef.current?.refresh();
    };
    window.addEventListener("load", handleWindowLoad);

    const initialRefreshTimeout = setTimeout(() => {
      scrollTriggerRef.current?.refresh();
    }, 100);

    const drawPosterFrame = (): void => {
      if (!posterLoadedRef.current || !posterRef.current) return;

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
      cancelled = true;
      clearTimeout(stuckTimeout);
      clearTimeout(initialRefreshTimeout);
      window.removeEventListener("load", handleWindowLoad);
      mediaQuery.removeEventListener("change", handleMotionChange);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      videoElement.removeEventListener("canplay", handleCanPlay);
      videoElement.removeEventListener("loadeddata", handleLoadedData);
      videoElement.removeEventListener("error", handleError);
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
        scrollTriggerRef.current = null;
      }
    };
  }, [containerSelector, scrub, poster, src]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(containerSelector);
    if (!el) return;

    const observer = new ResizeObserver(() => {
      scrollTriggerRef.current?.refresh();
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