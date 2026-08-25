import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

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
  const scrollTriggerRef = useRef<ReturnType<typeof ScrollTrigger.create> | null>(null);
  const mountedRef = useRef(false);
  const initializedRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const posterRef = useRef<HTMLImageElement | null>(null);
  const posterLoadedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      mountedRef.current = true;
      return;
    }
    initializedRef.current = true;
    mountedRef.current = true;

    // Capture video element for cleanup
    const videoElement = videoRef.current;

    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mediaQuery.matches;
    
    const handleMotionChange = (e: MediaQueryListEvent): void => {
      prefersReducedMotionRef.current = e.matches;
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.refresh();
      }
    };
    
    mediaQuery.addEventListener('change', handleMotionChange);

    let cancelled = false;

    // Track buffered range for smooth seeking
    const handleProgress = (): void => {
      if (cancelled) return;
      const videoEl = videoRef.current;
      if (!videoEl) return;
      const buffered = videoEl.buffered;
      if (buffered.length > 0) {
        // Track buffered end for debugging if needed
      }
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
      if (videoEl) {
        videoEl.currentTime = 0;
        // Draw first frame as fallback
        if (scrollTriggerRef.current) {
          scrollTriggerRef.current.refresh();
        }
      }
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
    if (!videoElement) return;

    videoElement.addEventListener('progress', handleProgress);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Load poster image as fallback
    if (poster) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = poster;
      img.onload = () => {
        posterLoadedRef.current = true;
        posterRef.current = img;
      };
img.onerror = () => {
        posterLoadedRef.current = false;
      };
    }

    const getEndPosition = (): number => {
      const el = document.getElementById(endTrigger.replace("#", ""));
      if (el) return el.offsetTop;
      return 3000;
    };

    const st = ScrollTrigger.create({
      start: 0,
      end: getEndPosition,
      scrub: prefersReducedMotionRef.current ? 0 : scrub,
      onUpdate: (self): void => {
        if (!mountedRef.current) return;
        if (prefersReducedMotionRef.current) return;
        const videoEl = videoRef.current;
        if (!videoEl) return;
        const progress = Math.min(1, Math.max(0, self.progress));
        const targetTime = progress * videoEl.duration;
        
        // Use fastSeek if available for instant seeking
        if ('fastSeek' in videoEl) {
          videoEl.fastSeek(self.progress * videoEl.duration);
        } else {
          // Smooth seek - only update if difference is significant
          if (Math.abs((videoEl as HTMLVideoElement).currentTime - targetTime) > 0.05) {
            (videoEl as HTMLVideoElement).currentTime = targetTime;
          }
        }
        
        // Hint browser to buffer around new position
        preloadAroundTime(targetTime, 3);
      },
      onRefresh: (): void => {
        if (!mountedRef.current) return;
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

    // Draw poster as fallback frame immediately on mount
    const drawPosterFrame = (): void => {
      const videoEl = videoRef.current;
      if (!videoEl || !posterLoadedRef.current || !posterRef.current) return;
      
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const img = posterRef.current;
      const scale = Math.max(
        canvas.width / img.width,
        canvas.height / img.height
      );
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (canvas.width - drawWidth) * 0.5;
      const offsetY = (canvas.height - drawHeight) * 0.5;
      
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      // Use canvas as fallback background
      const videoContainer = document.querySelector('.video-scrubber') as HTMLElement | null;
      if (videoContainer) {
        videoContainer.style.backgroundImage = `url(${canvas.toDataURL('image/webp')})`;
        videoContainer.style.backgroundSize = 'cover';
        videoContainer.style.backgroundPosition = 'center';
      }
    };

    // Draw poster frame after it loads
    if (posterLoadedRef.current) {
      drawPosterFrame();
    }

    return (): void => {
      mountedRef.current = false;
      cancelled = true;
      clearTimeout(initialRefreshTimeout);
      window.removeEventListener("load", handleWindowLoad);
      mediaQuery.removeEventListener('change', handleMotionChange);
      if (videoElement) {
        videoElement.removeEventListener('progress', handleProgress);
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
        scrollTriggerRef.current = null;
      }
    };
  }, [endTrigger, scrub, poster]);

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

  // Use poster as background while loading
  const posterStyle = poster ? {
    backgroundImage: `url(${poster})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } : {};

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
        ...posterStyle,
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
        crossOrigin="anonymous"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: loading ? 0 : 1,
          transition: 'opacity 300ms ease',
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