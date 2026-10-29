export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = () => matchMedia('(hover: none), (pointer: coarse)').matches;
export const isMobile = () => matchMedia('(max-width: 767px)').matches;

// Shared easing vocabulary ("slide on the rule and lock"): hard deceleration, no overshoot.
export const ease = {
  out: 'expo.out', // entrances, locks
  inOut: 'expo.inOut', // sheet slides, page transitions
  soft: 'power3.out', // small UI
} as const;
