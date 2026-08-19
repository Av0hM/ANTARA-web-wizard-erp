import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type ScrollTriggerInstance = ReturnType<typeof ScrollTrigger.create>;

interface ScrollSequenceProps {
  frameCount: number;
  framePattern: string;
  endTrigger: string;
  scrub?: number;
}

const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

function getFrameUrl(pattern: string, index: number): string {
  const padded = index.toString().padStart(3, "0");
  return `/${pattern.replace("%03d", padded)}`;
}

export function ScrollSequence({
  frameCount,
  framePattern,
  endTrigger,
  scrub = 1.5,
}: ScrollSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const loadedRef = useRef<boolean[]>([]);
  const currentFrameRef = useRef(0);
  const scrollTriggerRef = useRef<ScrollTriggerInstance | null>(null);
  const firstFrameReadyRef = useRef(false);
  const initializedRef = useRef(false);
  const mountedRef = useRef(false);
  const loadingQueueRef = useRef<number[]>([]);
  const loadingActiveRef = useRef(0);
  const progressUpdateScheduledRef = useRef(false);
  const latestProgressRef = useRef(0);
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  // Refs for props so second effect doesn't need them in deps
  const frameCountRef = useRef(frameCount);
  const framePatternRef = useRef(framePattern);
  const endTriggerRef = useRef(endTrigger);
  const scrubRef = useRef(scrub);

  // Preload effect - runs ONCE on mount with empty deps
  useEffect(() => {
    // Guard against StrictMode double-invocation
    if (initializedRef.current) {
      mountedRef.current = true; // Re-arm for second run
      return;
    }
    initializedRef.current = true;
    mountedRef.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const _frameCount = frameCountRef.current;
    const _framePattern = framePatternRef.current;
    const _endTrigger = endTriggerRef.current;
    const _scrub = scrubRef.current;

    const images: HTMLImageElement[] = new Array(_frameCount);
    const loaded: boolean[] = new Array(_frameCount).fill(false);
    let loadedCount = 0;

    // Store refs for cleanup access
    imagesRef.current = images;
    loadedRef.current = loaded;

    const drawFrame = (frameIndex: number): void => {
      if (!mountedRef.current) return;
      const clampedIndex = Math.min(Math.max(frameIndex, 0), _frameCount - 1);
      console.log(`[ScrollSequence] drawFrame called: frameIndex=${frameIndex}, clamped=${clampedIndex}`);
      
      let targetIndex = clampedIndex;
      if (!loaded[targetIndex]) {
        for (let delta = 1; delta < _frameCount; delta += 1) {
          const lower = clampedIndex - delta;
          const upper = clampedIndex + delta;
          const foundLower = lower >= 0 && loaded[lower];
          const foundUpper = upper < _frameCount && loaded[upper];
          if (foundLower && foundUpper) {
            targetIndex = (clampedIndex - lower) <= (upper - clampedIndex) ? lower : upper;
            break;
          }
          if (foundLower) {
            targetIndex = lower;
            break;
          }
          if (foundUpper) {
            targetIndex = upper;
            break;
          }
        }
      }

      const img = images[targetIndex];
      if (!img || !img.complete) return;

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      const scale = Math.max(
        canvasWidth / img.width,
        canvasHeight / img.height
      );

      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (canvasWidth - drawWidth) * 0.5;
      const offsetY = (canvasHeight - drawHeight) * 0.5;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      currentFrameRef.current = targetIndex;
    };

    const flushProgressUpdate = (): void => {
      if (progressUpdateScheduledRef.current && mountedRef.current) {
        progressUpdateScheduledRef.current = false;
        const pct = Math.round(latestProgressRef.current * 100);
        console.log(`[ScrollSequence] Flushing progress update: ${pct}%`);
        setLoadingProgress(latestProgressRef.current);
      }
    };

    const scheduleProgressUpdate = (newProgress: number): void => {
      console.log(`[ScrollSequence] scheduleProgressUpdate called with ${Math.round(newProgress * 100)}%, scheduled=${progressUpdateScheduledRef.current}`);
      latestProgressRef.current = newProgress;
      if (!progressUpdateScheduledRef.current) {
        progressUpdateScheduledRef.current = true;
        console.log(`[ScrollSequence] Scheduling RAF flush`);
        requestAnimationFrame(flushProgressUpdate);
      } else {
        console.log(`[ScrollSequence] RAF already scheduled, skipping`);
      }
    };

    const handleImageLoad = (index: number): void => {
      console.log(`[ScrollSequence] >>> handleImageLoad CALLED for index ${index}, mounted=${mountedRef.current}, loaded[index]=${loaded[index]}`);
      if (!mountedRef.current || loaded[index]) {
        console.log(`[ScrollSequence] >>> handleImageLoad EARLY RETURN for ${index}`);
        return;
      }
      loaded[index] = true;
      loadedCount += 1;
      const progress = loadedCount / _frameCount;
      console.log(`[ScrollSequence] Frame ${index} loaded, count: ${loadedCount}/${_frameCount}, progress: ${Math.round(progress * 100)}%`);
      scheduleProgressUpdate(progress);

      if (index === 0 && !firstFrameReadyRef.current) {
        firstFrameReadyRef.current = true;
        console.log('[ScrollSequence] First frame ready, drawing frame 0');
        setFirstFrameReady(true);
        drawFrame(0);
      }

      processLoadingQueue();
    };

    const createImageLoader = (index: number): HTMLImageElement => {
      const url = getFrameUrl(_framePattern, index);
      console.log(`[ScrollSequence] Creating Image for ${url}`);
      const img = new Image();
      const handleLoad = (): void => {
        console.log(`[ScrollSequence] Frame ${index} onload fired`);
        handleImageLoad(index);
      };
      const handleError = (e: string | Event): void => {
        console.error(`[ScrollSequence] Frame ${index} onerror fired`, e);
        handleImageLoad(index);
      };
      
      img.onload = handleLoad;
      img.onerror = handleError;
      img.src = url;
      
      // Handle synchronous load (from cache/memory)
      if (img.complete) {
        console.log(`[ScrollSequence] Frame ${index} loaded synchronously (from cache)`);
        // Use setTimeout to ensure handlers are attached
        setTimeout(handleLoad, 0);
      }
      
      return img;
    };

    const processLoadingQueue = (): void => {
      if (!mountedRef.current) return;
      while (loadingQueueRef.current.length > 0 && loadingActiveRef.current < 6) {
        const nextIndex = loadingQueueRef.current.shift();
        if (nextIndex === undefined) break;
        if (loaded[nextIndex]) continue;
        
        loadingActiveRef.current += 1;
        const img = createImageLoader(nextIndex);
        images[nextIndex] = img;
      }
    };

    // Initialize all Image objects and start first 15
    for (let i = 0; i < _frameCount; i += 1) {
      if (!mountedRef.current) break;

      const img = createImageLoader(i);
      images[i] = img;
      
      if (i < 15) {
        loadingActiveRef.current += 1;
      } else {
        loadingQueueRef.current.push(i);
      }
    }
    console.log(`[ScrollSequence] Initialized ${_frameCount} images, ${Math.min(15, _frameCount)} eager, ${Math.max(0, _frameCount - 15)} queued`);
    console.log(`[ScrollSequence] First frame URL: ${getFrameUrl(_framePattern, 0)}`);
    console.log(`[ScrollSequence] Last frame URL: ${getFrameUrl(_framePattern, _frameCount - 1)}`);

    const resize = (): void => {
      if (!canvas || !mountedRef.current) return;

      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame(currentFrameRef.current);
    };

    const handleResize = (): void => {
      resize();
    };

    window.addEventListener("resize", handleResize, { passive: true });
    resize();

    let endScroll = 0;
    const endElement = document.getElementById(_endTrigger.replace("#", ""));
    console.log(`[ScrollSequence] endTrigger: ${_endTrigger}, endElement:`, endElement, `offsetTop: ${endElement?.offsetTop}`);
    if (endElement) {
      endScroll = endElement.offsetTop;
    }
    console.log(`[ScrollSequence] ScrollTrigger created with start: 0, end: ${endScroll}`);

    const st = ScrollTrigger.create({
      start: 0,
      end: endScroll,
      scrub: _scrub,
      onUpdate: (self: ScrollTriggerInstance): void => {
        if (!mountedRef.current) return;
        const progress = clamp(self.progress);
        const frameIndex = Math.floor(progress * (_frameCount - 1));
        console.log(`[ScrollSequence] onUpdate: progress=${progress.toFixed(3)}, frameIndex=${frameIndex}, scrollY=${window.scrollY}`);
        drawFrame(frameIndex);
      },
      onRefresh: (self: ScrollTriggerInstance): void => {
        if (!mountedRef.current) return;
        const el = document.getElementById(_endTrigger.replace("#", ""));
        if (el) {
          self.vars.end = () => el.offsetTop;
        }
        resize();
      },
    });

    scrollTriggerRef.current = st;
    processLoadingQueue();

    // Fallback: force first frame ready if loading stalls
    const firstFrameTimeout = setTimeout(() => {
      if (!firstFrameReadyRef.current && mountedRef.current) {
        firstFrameReadyRef.current = true;
        setFirstFrameReady(true);
        drawFrame(0);
      }
    }, 5000);

    return (): void => {
      console.log('[ScrollSequence] Effect cleanup running, setting mounted=false');
      mountedRef.current = false;
      clearTimeout(firstFrameTimeout);
      window.removeEventListener("resize", handleResize);
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
        scrollTriggerRef.current = null;
      }
      loadingQueueRef.current = [];
      loadingActiveRef.current = 0;
    };
  }, []); // Empty deps - runs ONCE

  // Separate effect for ScrollTrigger refresh when endTrigger element layout changes
  useEffect(() => {
    const endElement = document.getElementById(endTriggerRef.current.replace("#", ""));
    if (!endElement) return;

    const observer = new ResizeObserver(() => {
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.refresh();
      }
    });

    observer.observe(endElement);

    return () => observer.disconnect();
  }, []); // Empty deps - endTriggerRef is stable

  return (
    <div
      className="scroll-sequence"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      {loadingProgress < 1 && (
        <div
          className="scroll-sequence__loading"
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
            opacity: firstFrameReady ? 0 : 1,
          }}
          aria-live="polite"
        >
          <span
            className="scroll-sequence__progress"
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "clamp(1rem, 3vw, 2rem)",
              color: "var(--color-text-tertiary)",
              letterSpacing: "0.1em",
            }}
          >
            {Math.round(loadingProgress * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}