import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type ScrollTriggerInstance = ReturnType<typeof ScrollTrigger.create>;

interface VideoScrubberProps {
  src: string;
  endTrigger: string;
  scrub?: number;
  poster?: string;
}

export function VideoScrubber({
  src,
  endTrigger,
  scrub = 1.5,
  poster,
}: VideoScrubberProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollTriggerRef = useRef<ScrollTriggerInstance | null>(null);
  const mountedRef = useRef(false);
  const initializedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bufferedEndRef = useRef(0);

  useEffect(() => {
    if (initializedRef.current) {
      mountedRef.current = true;
      return;
    }
    initializedRef.current = true;
    mountedRef.current = true;

    let cancelled = false;

    // Track buffered range for smooth seeking
    const handleProgress = (): void => {
      if (cancelled) return;
      const videoEl = videoRef.current;
      if (!videoEl) return;
      const buffered = videoEl.buffered;
      if (buffered.length > 0) {
        bufferedEndRef.current = buffered.end(buffered.length - 1);
      }
      // Keep track of buffered start for debugging if needed
      const _bufferedStart = buffered.length > 0 ? buffered.start(0) : 0;
      void _bufferedStart;
    };

    const handleCanPlay = (): void => {
      if (cancelled) return;
      setLoading(false);
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.refresh();
      }
    };

    const handleError = (e: Event): void => {
      if (cancelled) return;
      console.error('[VideoScrubber] Video load error:', e);
      setError('Failed to load video');
      setLoading(false);
    };

    const handleLoadedMetadata = (): void => {
      if (cancelled) return;
      const videoEl = videoRef.current;
      if (videoEl) videoEl.currentTime = 0;
    };

    // Pre-buffer around current time when seeking
    const preloadAroundTime = (time: number, bufferSeconds = 5): void => {
      const videoEl = videoRef.current;
      if (!videoEl) return;
      const start = Math.max(0, time - bufferSeconds);
      const end = Math.min(videoEl.duration, time + bufferSeconds);
      void start;
      void end;
      // Browser will automatically buffer around currentTime when we set it
      // But we can hint by briefly playing/pausing
      if (videoEl.paused && videoEl.readyState >= 3) {
        videoEl.currentTime = time;
      }
    };

    const videoElement = videoRef.current;
    if (!videoElement) return;

    videoElement.addEventListener('progress', handleProgress);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);

    const getEnd = (): number => {
      const el = document.getElementById(endTrigger.replace("#", ""));
      return el ? el.offsetTop : 3000;
    };

    const st = ScrollTrigger.create({
      start: 0,
      end: getEnd(),
      scrub,
      onUpdate: (self: ScrollTriggerInstance): void => {
        if (!mountedRef.current) return;
        const videoEl = videoRef.current;
        if (!videoEl) return;
        const progress = Math.min(1, Math.max(0, self.progress));
        const targetTime = progress * videoEl.duration;
        
        // Use fastSeek if available for instant seeking
        if ('fastSeek' in videoEl) {
          videoEl.fastSeek(targetTime);
        } else {
          // Smooth seek - only update if difference is significant
          if (Math.abs((videoEl as HTMLVideoElement).currentTime - targetTime) > 0.05) {
            (videoEl as HTMLVideoElement).currentTime = targetTime;
          }
        }
        
        // Hint browser to buffer around new position
        preloadAroundTime(targetTime, 3);
      },
      onRefresh: (self: ScrollTriggerInstance): void => {
        if (!mountedRef.current) return;
        self.vars.end = getEnd();
      },
    });

    scrollTriggerRef.current = st;

    // Refresh after layout settles
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

    return (): void => {
      mountedRef.current = false;
      cancelled = true;
      clearTimeout(initialRefreshTimeout);
      window.removeEventListener("load", handleWindowLoad);
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.removeEventListener('progress', handleProgress);
        videoEl.removeEventListener('canplay', handleCanPlay);
        videoEl.removeEventListener('error', handleError);
        videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
        scrollTriggerRef.current = null;
      }
    };
  }, [endTrigger, scrub]);

  // Separate effect for endTrigger layout changes
  useEffect(() => {
    const endElement = document.getElementById(endTrigger.replace("#", ""));
    if (!endElement) return;

    const observer = new ResizeObserver(() => {
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.refresh();
      }
    });

    observer.observe(endElement);
    return () => observer.disconnect();
  }, [endTrigger]);

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
      }}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="auto"
        poster={poster}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
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
          }}
          aria-live="polite"
        >
          <span style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "clamp(1rem, 3vw, 2rem)",
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.1em",
          }}>
            Loading video...
          </span>
        </div>
      )}
      {error && (
        <div style={{
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
        }}>
          {error}
        </div>
      )}
    </div>
  );
}