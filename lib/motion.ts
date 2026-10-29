import { stagger } from "motion/react";

export const EASE = [0.16, 1, 0.3, 1] as const; // expo-out
export const EASE_SOFT = [0.4, 0, 0.2, 1] as const;

export const reveal = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

export const group = {
  hidden: {},
  show: { transition: { delayChildren: stagger(0.08) } },
};

export const VIEWPORT = { once: true, margin: "-12% 0px -12% 0px" } as const;
