import { motion, useScroll, useTransform } from "framer-motion";
import Starfield from "./Starfield";

export default function Hero() {
  const { scrollYProgress } = useScroll();

  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.4]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section className="h-screen relative flex items-center justify-center overflow-hidden">

      <Starfield />

      <motion.div
        style={{ scale, opacity }}
        className="text-center z-10"
      >
        <h1 className="text-8xl font-bold tracking-tight">
          PROJECT ANTARA
        </h1>

        <p className="mt-6 text-xl text-gray-300">
          CubeSat radiation mission in Low Earth Orbit
        </p>
      </motion.div>

    </section>
  );
}