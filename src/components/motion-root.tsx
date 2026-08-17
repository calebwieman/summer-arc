"use client";

import { MotionConfig } from "motion/react";

/**
 * Client boundary for motion's global config. With reducedMotion="user", motion
 * drops transform and layout animation on its own while still animating opacity
 * and colour; components additionally branch on useReducedMotion() to swap
 * choreography. The reduced path is a variant, not an off switch.
 */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
