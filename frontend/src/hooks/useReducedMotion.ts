import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to detect if the user prefers reduced motion.
 * Uses the prefers-reduced-motion media query.
 * 
 * @returns boolean indicating if reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [hasMounted, setHasMounted] = useState<boolean>(false);

  const getReducedMotionPreference = useCallback((): boolean => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    setHasMounted(true);
    setPrefersReducedMotion(getReducedMotionPreference());

    const mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleChange);
    } else {
      mediaQueryList.addListener(handleChange);
    }

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleChange);
      } else {
        mediaQueryList.removeListener(handleChange);
      }
    };
  }, [getReducedMotionPreference]);

  if (!hasMounted) {
    return false;
  }

  return prefersReducedMotion;
}

/**
 * Animation configuration based on user preferences and device type.
 * Returns optimized animation settings for mobile and reduced motion.
 */
export interface AnimationConfig {
  /** Whether animations should be disabled entirely */
  disableAnimations: boolean;
  /** Duration multiplier (1 = normal, 0.5 = half speed, 0 = instant) */
  durationMultiplier: number;
  /** Transition duration in seconds */
  transitionDuration: number;
  /** Spring animation config for framer-motion */
  springConfig: {
    damping: number;
    stiffness: number;
  };
  /** Fade animation config */
  fadeConfig: {
    duration: number;
  };
  /** Slide animation config */
  slideConfig: {
    duration: number;
    ease: string;
  };
}

/**
 * Hook that returns animation configuration based on user preferences
 * and device capabilities.
 * 
 * @param isMobile - Whether the device is mobile
 * @returns AnimationConfig object with optimized settings
 */
export function useAnimationConfig(isMobile: boolean = false): AnimationConfig {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return {
      disableAnimations: true,
      durationMultiplier: 0,
      transitionDuration: 0.01,
      springConfig: {
        damping: 100,
        stiffness: 1000,
      },
      fadeConfig: {
        duration: 0.01,
      },
      slideConfig: {
        duration: 0.01,
        ease: 'linear',
      },
    };
  }

  if (isMobile) {
    return {
      disableAnimations: false,
      durationMultiplier: 0.7,
      transitionDuration: 0.15,
      springConfig: {
        damping: 30,
        stiffness: 400,
      },
      fadeConfig: {
        duration: 0.15,
      },
      slideConfig: {
        duration: 0.2,
        ease: 'easeOut',
      },
    };
  }

  // Desktop defaults
  return {
    disableAnimations: false,
    durationMultiplier: 1,
    transitionDuration: 0.3,
    springConfig: {
      damping: 25,
      stiffness: 300,
    },
    fadeConfig: {
      duration: 0.2,
    },
    slideConfig: {
      duration: 0.3,
      ease: 'easeOut',
    },
  };
}

export default useReducedMotion;
