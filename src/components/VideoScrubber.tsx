import { useEffect, useRef } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import gsap from "gsap";

gsap.registerPlugin(ScrollTrigger);

interface VideoScrubberProps {
  src: string;
  containerSelector: string;
  poster?: string;
}

/** Lenis owns scroll smoothing. Only one precise media seek runs at a time. */
export function VideoScrubber({ src, containerSelector, poster }: VideoScrubberProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const background = backgroundRef.current;
    const container = document.querySelector<HTMLElement>(containerSelector);
    if (!video || !background || !container) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const copies = Array.from(container.querySelectorAll<HTMLElement>(".mission-copy__inner"));
    let progress = 0;
    let visible = false;
    let disposed = false;
    let frame = 0;
    let failed = false;
    // Keep the target inside the last displayed frame, not the media end marker.
    const lastFrame = () => Math.max(0, video.duration - 1 / 24);

    const seek = () => {
      frame = 0;
      if (disposed || failed || !visible || document.hidden || motion.matches ||
          video.seeking || video.readyState < 2 || !Number.isFinite(video.duration)) return;
      const target = progress * lastFrame();
      if (Math.abs(video.currentTime - target) < 1 / 48) return;
      // fastSeek is deliberately avoided: it may snap to distant keyframes.
      video.currentTime = target;
    };
    const schedule = () => {
      if (!frame && !disposed) frame = requestAnimationFrame(seek);
    };
    const update = (value: number) => {
      progress = Math.min(1, Math.max(0, value));
      const rect = container.getBoundingClientRect();
      const viewport = window.innerHeight;
      visible = rect.bottom > 0 && rect.top < viewport;
      // Retain the final frame while the last panel leaves the viewport.
      background.style.opacity = String(visible ? Math.min(1, rect.bottom / (viewport * 0.45)) : 0);
      background.style.visibility = visible ? "visible" : "hidden";
      copies.forEach((copy, index) => {
        const local = Math.min(1, Math.max(0, progress * copies.length - index));
        const intensity = motion.matches ? 1 : 0.92 + (1 - Math.abs(local * 2 - 1)) * 0.08;
        copy.style.opacity = String(intensity);
      });
      schedule();
    };
    const ready = () => {
      if (disposed) return;
      failed = false;
      background.dataset.ready = motion.matches ? "false" : "true";
      schedule();
    };
    const error = () => {
      failed = true;
      background.dataset.ready = "false";
    };
    const motionChanged = () => {
      background.dataset.ready = !motion.matches && !failed && video.readyState >= 2 ? "true" : "false";
      update(trigger.progress);
    };
    video.addEventListener("loadeddata", ready);
    video.addEventListener("canplay", ready);
    video.addEventListener("seeked", schedule);
    video.addEventListener("error", error);
    document.addEventListener("visibilitychange", schedule);
    motion.addEventListener("change", motionChanged);

    const trigger = ScrollTrigger.create({
      trigger: container,
      start: "top top",
      end: "bottom bottom",
      onUpdate: self => update(self.progress),
      onRefresh: self => update(self.progress),
    });
    // Progress stops at 1 before the final panel leaves, so track its exit too.
    const exitTrigger = ScrollTrigger.create({
      trigger: container,
      start: "bottom bottom",
      end: "bottom top",
      onUpdate: () => update(trigger.progress),
      onToggle: () => update(trigger.progress),
    });
    const refresh = () => {
      trigger.refresh();
      exitTrigger.refresh();
      update(trigger.progress);
    };
    const observer = new ResizeObserver(refresh);
    observer.observe(container);
    window.addEventListener("load", refresh);
    void document.fonts.ready.then(() => { if (!disposed) refresh(); });
    video.load();
    if (video.readyState >= 2) ready();
    refresh();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      trigger.kill();
      exitTrigger.kill();
      window.removeEventListener("load", refresh);
      motion.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", schedule);
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("canplay", ready);
      video.removeEventListener("seeked", schedule);
      video.removeEventListener("error", error);
      video.pause();
      copies.forEach(copy => copy.style.removeProperty("opacity"));
    };
  }, [src, containerSelector]);

  return (
    <div ref={backgroundRef} className="video-scrubber" aria-hidden="true"
      style={{ backgroundImage: poster ? `url(${poster})` : undefined }}>
      <video ref={videoRef} src={src} muted playsInline preload="auto" poster={poster} />
    </div>
  );
}
