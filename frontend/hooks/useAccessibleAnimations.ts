import { useReducedMotion } from '../hooks/useReducedMotion';

export function useAccessibleAnimations() {
  const reducedMotion = useReducedMotion();

  return {
    hover: reducedMotion ? {} : undefined,
    tap: reducedMotion ? {} : undefined,
    transition: reducedMotion ? { duration: 0 } : undefined,
    initial: reducedMotion ? false : undefined,
    animate: reducedMotion ? false : undefined,
  };
}
