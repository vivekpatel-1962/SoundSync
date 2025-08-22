// Shared Framer Motion presets for consistent animations across the app
// Usage:
// import { motion } from 'framer-motion';
// import { container, fadeUp, fadeIn, list } from '../lib/motionPresets.js';

export const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

export const list = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } },
};
