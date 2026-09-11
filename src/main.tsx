import React from "react";
import ReactDOM from "react-dom/client";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import App from "./App";
import "lenis/dist/lenis.css";
import "./index.css";

declare global {
  interface Window { __antaraLenis?: Lenis; }
}

gsap.registerPlugin(ScrollTrigger);
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
let lenis: Lenis | undefined;
const tick = (time: number) => lenis?.raf(time * 1000);
const configureScroll = () => {
  gsap.ticker.remove(tick);
  lenis?.destroy();
  lenis = undefined;
  delete window.__antaraLenis;
  if (!motion.matches) {
    lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 1,
      // Keep native touch scrolling and momentum on mobile.
      syncTouch: false,
      autoResize: true,
    });
    window.__antaraLenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
  }
  ScrollTrigger.refresh();
};
configureScroll();
motion.addEventListener("change", configureScroll);

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<React.StrictMode><App /></React.StrictMode>);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    motion.removeEventListener("change", configureScroll);
    gsap.ticker.remove(tick);
    lenis?.destroy();
    delete window.__antaraLenis;
    root.unmount();
  });
}
