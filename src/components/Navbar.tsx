import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8 }}
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-black/40 backdrop-blur-xl border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        
        <div className="text-lg font-semibold tracking-wide">
          ANTARA
        </div>

        <div className="flex gap-8 text-sm text-gray-300">
          <a className="hover:text-white transition">Mission</a>
          <a className="hover:text-white transition">Payload</a>
          <a className="hover:text-white transition">Systems</a>
          <a className="hover:text-white transition">Team</a>
        </div>

      </div>
    </motion.nav>
  );
}