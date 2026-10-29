"use client";
import { motion, useReducedMotion } from "motion/react";
import { reveal, group, VIEWPORT } from "@/lib/motion";

const still = { hidden: { opacity: 1 }, show: { opacity: 1 } };

export function Reveal({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" | "header" }) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M className={className} variants={reduce ? still : reveal} initial="hidden" whileInView="show" viewport={VIEWPORT}>
      {children}
    </M>
  );
}

export function RevealGroup({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "ol" | "ul" }) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M className={className} variants={reduce ? still : group} initial="hidden" whileInView="show" viewport={VIEWPORT}>
      {children}
    </M>
  );
}
