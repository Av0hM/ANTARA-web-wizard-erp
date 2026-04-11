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
  lerp: 0.07,
  smoothWheel: true,
  wheelMultiplier: 0.86,
  touchMultiplier: 0.92,
  syncTouch: true,
  syncTouchLerp: 0.08,
  autoResize: true,
});

window.__antaraLenis = lenis;
lenis.on("scroll", ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
