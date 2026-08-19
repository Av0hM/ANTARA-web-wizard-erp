import React from "react";
import ReactDOM from "react-dom/client";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import App from "./App";
import "./index.css";

declare global {
  interface Window {
    __antaraLenis?: Lenis;
  }
}

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis({
  lerp: 0.06,
  smoothWheel: true,
  wheelMultiplier: 0.72,
  touchMultiplier: 0.85,
  syncTouch: true,
  syncTouchLerp: 0.12,
  autoResize: true,
});

window.__antaraLenis = lenis;
lenis.on("scroll", ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

// Lenis scrollerProxy for ScrollTrigger
ScrollTrigger.scrollerProxy("body", {
  scrollTop(value?: number) {
    if (arguments.length) {
      lenis.scrollTo(value as number, { immediate: true });
      return value as number;
    }
    return lenis.scroll;
  },
  getBoundingClientRect() {
    return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
  },
});

// Refresh ScrollTrigger when Lenis scroll changes
lenis.on("scroll", ScrollTrigger.update);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
