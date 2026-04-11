import { motion } from "framer-motion";

export default function Mission() {
  return (
    <section className="min-h-screen flex items-center px-10 md:px-20">

      <motion.div
        initial={{ opacity: 0, y: 120 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="max-w-3xl"
      >
        <p className="text-sm text-gray-400 mb-3">
          MISSION OVERVIEW
        </p>

        <h2 className="text-5xl font-semibold mb-6 leading-tight">
          Measuring radiation in the South Atlantic Anomaly
        </h2>

        <p className="text-xl text-gray-400 leading-relaxed">
          Project Antara is a student-driven CubeSat initiative focused on
          measuring high-energy trapped protons in Low Earth Orbit. The mission
          aims to characterize proton flux, energy distribution, and spatial
          variation across the South Atlantic Anomaly.
        </p>
      </motion.div>

    </section>
  );
}