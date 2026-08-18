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
  const loadingQueueRef = useRef<number[]>([]);
  const loadingActiveRef = useRef(0);
  
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    const images: HTMLImageElement[] = new Array(frameCount);
    const loaded: boolean[] = new Array(frameCount).fill(false);
    let loadedCount = 0;

    const drawFrame = (frameIndex: number): void => {
      const clampedIndex = Math.min(Math.max(frameIndex, 0), frameCount - 1);
      
      let targetIndex = clampedIndex;
      if (!loaded[targetIndex]) {
        for (let delta = 1; delta < frameCount; delta += 1) {
          const lower = clampedIndex - delta;
          const upper = clampedIndex + delta;
          const foundLower = lower >= 0 && loaded[lower];
          const foundUpper = upper < frameCount && loaded[upper];
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

    const handleImageLoad = (index: number): void => {
      if (loaded[index]) return;
      loaded[index] = true;
      loadedCount += 1;
      const progress = loadedCount / frameCount;
      setLoadingProgress(progress);

      if (index === 0 && !firstFrameReadyRef.current) {
        firstFrameReadyRef.current = true;
        setFirstFrameReady(true);
        drawFrame(0);
      }

      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.refresh();
      }

      processLoadingQueue();
    };

    const processLoadingQueue = (): void => {
      if (cancelled) return;
      while (loadingQueueRef.current.length > 0 && loadingActiveRef.current < 3) {
        const nextIndex = loadingQueueRef.current.shift();
        if (nextIndex === undefined) break;
        if (loaded[nextIndex]) continue;
        
        loadingActiveRef.current += 1;
        const img = new Image();
        img.src = getFrameUrl(framePattern, nextIndex);
        img.onload = () => {
          loadingActiveRef.current -= 1;
          handleImageLoad(nextIndex);
        };
        img.onerror = () => {
          loadingActiveRef.current -= 1;
          handleImageLoad(nextIndex);
        };
        images[nextIndex] = img;
      }
    };

    for (let i = 0; i < frameCount; i += 1) {
      if (cancelled) break;

      const img = new Image();
      img.src = getFrameUrl(framePattern, i);
      
      if (i < 15) {
        img.onload = () => handleImageLoad(i);
        img.onerror = () => handleImageLoad(i);
        loadingActiveRef.current += 1;
      } else {
        loadingQueueRef.current.push(i);
      }
      images[i] = img;
    }

    imagesRef.current = images;
    loadedRef.current = loaded;

    const resize = (): void => {
      if (!canvas) return;

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
    const endElement = document.getElementById(endTrigger.replace("#", ""));
    if (endElement) {
      endScroll = endElement.offsetTop;
    }

    const st = ScrollTrigger.create({
      start: 0,
      end: endScroll,
      scrub,
      onUpdate: (self: ScrollTriggerInstance): void => {
        const progress = clamp(self.progress);
        const frameIndex = Math.floor(progress * (frameCount - 1));
        drawFrame(frameIndex);
      },
      onRefresh: (): void => {
        const el = document.getElementById(endTrigger.replace("#", ""));
        if (el) {
          st.vars.end = () => el.offsetTop;
        }
        resize();
      },
    });

    scrollTriggerRef.current = st;
    processLoadingQueue();

    return (): void => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
        scrollTriggerRef.current = null;
      }
    };
  }, [frameCount, framePattern, endTrigger, scrub]);

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