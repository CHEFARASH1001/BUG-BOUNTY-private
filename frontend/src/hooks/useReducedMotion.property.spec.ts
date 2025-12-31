import * as fc from 'fast-check';

/**
 * Property-based tests for Reduced Motion Preference
 * 
 * Feature: mobile-responsive
 * Property 14: Reduced Motion Preference
 * Validates: Requirements 12.2
 * 
 * For any user with prefers-reduced-motion: reduce preference, 
 * non-essential animations SHALL be disabled (animation-duration: 0 or animation: none).
 */

/**
 * Animation types that can be affected by reduced motion preference
 */
type AnimationType = 
  | 'slideIn'
  | 'fadeIn'
  | 'pulse'
  | 'glow'
  | 'scan'
  | 'blink'
  | 'hover-lift'
  | 'scale-active'
  | 'opacity-active';

/**
 * Animation configuration
 */
interface AnimationConfig {
  type: AnimationType;
  isEssential: boolean;
  defaultDuration: number; // in milliseconds
  defaultIterationCount: number | 'infinite';
}

/**
 * Computed animation state based on user preferences
 */
interface ComputedAnimationState {
  duration: number;
  iterationCount: number | 'infinite';
  isDisabled: boolean;
  transform: string;
}

/**
 * Device context for animation configuration
 */
interface DeviceContext {
  isMobile: boolean;
  prefersReducedMotion: boolean;
}

/**
 * Animation configuration result from useAnimationConfig hook
 */
interface AnimationConfigResult {
  disableAnimations: boolean;
  durationMultiplier: number;
  transitionDuration: number;
  springConfig: {
    damping: number;
    stiffness: number;
  };
  fadeConfig: {
    duration: number;
  };
  slideConfig: {
    duration: number;
    ease: string;
  };
}


/**
 * Computes the animation state based on user preferences and animation type.
 * This simulates the behavior defined in globals.css where:
 * - prefers-reduced-motion: reduce disables all non-essential animations
 * - animation-duration is set to 0.01ms
 * - animation-iteration-count is set to 1
 * - transforms are disabled
 */
function computeAnimationState(
  config: AnimationConfig,
  context: DeviceContext
): ComputedAnimationState {
  // When user prefers reduced motion, disable non-essential animations
  if (context.prefersReducedMotion && !config.isEssential) {
    return {
      duration: 0.01, // Near-zero duration as per CSS spec
      iterationCount: 1,
      isDisabled: true,
      transform: 'none',
    };
  }

  // Mobile optimization: reduce animation durations
  if (context.isMobile && !context.prefersReducedMotion) {
    return {
      duration: config.defaultDuration * 0.7, // 70% of default duration
      iterationCount: config.defaultIterationCount,
      isDisabled: false,
      transform: getDefaultTransform(config.type),
    };
  }

  // Default desktop behavior
  return {
    duration: config.defaultDuration,
    iterationCount: config.defaultIterationCount,
    isDisabled: false,
    transform: getDefaultTransform(config.type),
  };
}

/**
 * Gets the default transform for an animation type
 */
function getDefaultTransform(type: AnimationType): string {
  switch (type) {
    case 'slideIn':
      return 'translateY(0)';
    case 'hover-lift':
      return 'translateY(-2px)';
    case 'scale-active':
      return 'scale(0.98)';
    default:
      return 'none';
  }
}

/**
 * Computes the animation configuration based on device context.
 * This simulates the useAnimationConfig hook behavior.
 */
function computeAnimationConfig(context: DeviceContext): AnimationConfigResult {
  if (context.prefersReducedMotion) {
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

  if (context.isMobile) {
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


/**
 * CSS property values that should be affected by reduced motion
 */
interface CSSAnimationProperties {
  scrollBehavior: 'smooth' | 'auto';
  animationDuration: number;
  transitionDuration: number;
  transform: string;
  backdropFilter: string | 'none';
  textShadow: string | 'none';
  boxShadow: string | 'none';
}

/**
 * Computes CSS properties based on reduced motion preference.
 * This simulates the CSS rules in globals.css for @media (prefers-reduced-motion: reduce)
 */
function computeCSSProperties(prefersReducedMotion: boolean): CSSAnimationProperties {
  if (prefersReducedMotion) {
    return {
      scrollBehavior: 'auto',
      animationDuration: 0.01,
      transitionDuration: 0.01,
      transform: 'none',
      backdropFilter: 'none',
      textShadow: 'none',
      boxShadow: 'none',
    };
  }

  return {
    scrollBehavior: 'smooth',
    animationDuration: 300, // Default 300ms
    transitionDuration: 200, // Default 200ms
    transform: 'translateY(-2px)', // Example hover-lift transform
    backdropFilter: 'blur(10px)',
    textShadow: '0 0 10px currentColor',
    boxShadow: '0 0 5px var(--accent-green)',
  };
}

/**
 * Arbitrary generators
 */
const animationTypeArb = fc.constantFrom<AnimationType>(
  'slideIn',
  'fadeIn',
  'pulse',
  'glow',
  'scan',
  'blink',
  'hover-lift',
  'scale-active',
  'opacity-active'
);

const animationConfigArb = fc.record({
  type: animationTypeArb,
  isEssential: fc.boolean(),
  defaultDuration: fc.integer({ min: 100, max: 1000 }),
  defaultIterationCount: fc.oneof(
    fc.integer({ min: 1, max: 10 }),
    fc.constant('infinite' as const)
  ),
});

const deviceContextArb = fc.record({
  isMobile: fc.boolean(),
  prefersReducedMotion: fc.boolean(),
});


describe('Feature: mobile-responsive, Property 14: Reduced Motion Preference', () => {
  /**
   * Property 14: Reduced Motion Preference
   * For any user with prefers-reduced-motion: reduce preference, 
   * non-essential animations SHALL be disabled (animation-duration: 0 or animation: none).
   * 
   * Validates: Requirements 12.2
   */

  describe('Animation State with Reduced Motion', () => {
    it('should disable non-essential animations when prefers-reduced-motion is set', () => {
      fc.assert(
        fc.property(
          animationConfigArb,
          (config) => {
            // Only test non-essential animations
            if (config.isEssential) return true;
            
            const context: DeviceContext = {
              isMobile: false,
              prefersReducedMotion: true,
            };
            const computed = computeAnimationState(config, context);
            
            return computed.isDisabled === true &&
                   computed.duration <= 0.01 &&
                   computed.iterationCount === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set transform to none when prefers-reduced-motion is set', () => {
      fc.assert(
        fc.property(
          animationConfigArb,
          (config) => {
            // Only test non-essential animations
            if (config.isEssential) return true;
            
            const context: DeviceContext = {
              isMobile: false,
              prefersReducedMotion: true,
            };
            const computed = computeAnimationState(config, context);
            
            return computed.transform === 'none';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not disable essential animations even with reduced motion preference', () => {
      fc.assert(
        fc.property(
          animationTypeArb,
          fc.integer({ min: 100, max: 1000 }),
          (type, duration) => {
            const config: AnimationConfig = {
              type,
              isEssential: true,
              defaultDuration: duration,
              defaultIterationCount: 1,
            };
            const context: DeviceContext = {
              isMobile: false,
              prefersReducedMotion: true,
            };
            const computed = computeAnimationState(config, context);
            
            // Essential animations should maintain their duration
            return computed.duration === duration;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enable animations when prefers-reduced-motion is not set', () => {
      fc.assert(
        fc.property(
          animationConfigArb,
          fc.boolean(), // isMobile
          (config, isMobile) => {
            const context: DeviceContext = {
              isMobile,
              prefersReducedMotion: false,
            };
            const computed = computeAnimationState(config, context);
            
            return computed.isDisabled === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Animation Configuration Hook Behavior', () => {
    it('should return disableAnimations: true when prefers-reduced-motion is set', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isMobile
          (isMobile) => {
            const context: DeviceContext = {
              isMobile,
              prefersReducedMotion: true,
            };
            const config = computeAnimationConfig(context);
            
            return config.disableAnimations === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return durationMultiplier: 0 when prefers-reduced-motion is set', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isMobile
          (isMobile) => {
            const context: DeviceContext = {
              isMobile,
              prefersReducedMotion: true,
            };
            const config = computeAnimationConfig(context);
            
            return config.durationMultiplier === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return near-zero transition duration when prefers-reduced-motion is set', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isMobile
          (isMobile) => {
            const context: DeviceContext = {
              isMobile,
              prefersReducedMotion: true,
            };
            const config = computeAnimationConfig(context);
            
            return config.transitionDuration <= 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return near-zero fade duration when prefers-reduced-motion is set', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isMobile
          (isMobile) => {
            const context: DeviceContext = {
              isMobile,
              prefersReducedMotion: true,
            };
            const config = computeAnimationConfig(context);
            
            return config.fadeConfig.duration <= 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return near-zero slide duration when prefers-reduced-motion is set', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isMobile
          (isMobile) => {
            const context: DeviceContext = {
              isMobile,
              prefersReducedMotion: true,
            };
            const config = computeAnimationConfig(context);
            
            return config.slideConfig.duration <= 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return high damping spring config when prefers-reduced-motion is set', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isMobile
          (isMobile) => {
            const context: DeviceContext = {
              isMobile,
              prefersReducedMotion: true,
            };
            const config = computeAnimationConfig(context);
            
            // High damping = less bouncy = more instant
            return config.springConfig.damping >= 100;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('CSS Properties with Reduced Motion', () => {
    it('should set scroll-behavior to auto when prefers-reduced-motion is set', () => {
      const cssProps = computeCSSProperties(true);
      expect(cssProps.scrollBehavior).toBe('auto');
    });

    it('should set animation-duration to near-zero when prefers-reduced-motion is set', () => {
      const cssProps = computeCSSProperties(true);
      expect(cssProps.animationDuration).toBeLessThanOrEqual(0.01);
    });

    it('should set transition-duration to near-zero when prefers-reduced-motion is set', () => {
      const cssProps = computeCSSProperties(true);
      expect(cssProps.transitionDuration).toBeLessThanOrEqual(0.01);
    });

    it('should set transform to none when prefers-reduced-motion is set', () => {
      const cssProps = computeCSSProperties(true);
      expect(cssProps.transform).toBe('none');
    });

    it('should disable backdrop-filter when prefers-reduced-motion is set', () => {
      const cssProps = computeCSSProperties(true);
      expect(cssProps.backdropFilter).toBe('none');
    });

    it('should disable text-shadow when prefers-reduced-motion is set', () => {
      const cssProps = computeCSSProperties(true);
      expect(cssProps.textShadow).toBe('none');
    });

    it('should disable box-shadow when prefers-reduced-motion is set', () => {
      const cssProps = computeCSSProperties(true);
      expect(cssProps.boxShadow).toBe('none');
    });

    it('should enable smooth scroll when prefers-reduced-motion is not set', () => {
      const cssProps = computeCSSProperties(false);
      expect(cssProps.scrollBehavior).toBe('smooth');
    });

    it('should have normal animation duration when prefers-reduced-motion is not set', () => {
      const cssProps = computeCSSProperties(false);
      expect(cssProps.animationDuration).toBeGreaterThan(0.01);
    });
  });


  describe('Mobile Animation Optimization', () => {
    it('should reduce animation duration on mobile when reduced motion is not preferred', () => {
      fc.assert(
        fc.property(
          animationConfigArb,
          (config) => {
            const context: DeviceContext = {
              isMobile: true,
              prefersReducedMotion: false,
            };
            const computed = computeAnimationState(config, context);
            
            // Mobile should have 70% of default duration
            const expectedDuration = config.defaultDuration * 0.7;
            return Math.abs(computed.duration - expectedDuration) < 0.001;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return durationMultiplier: 0.7 on mobile without reduced motion', () => {
      const context: DeviceContext = {
        isMobile: true,
        prefersReducedMotion: false,
      };
      const config = computeAnimationConfig(context);
      
      expect(config.durationMultiplier).toBe(0.7);
    });

    it('should return shorter transition duration on mobile without reduced motion', () => {
      const context: DeviceContext = {
        isMobile: true,
        prefersReducedMotion: false,
      };
      const config = computeAnimationConfig(context);
      
      expect(config.transitionDuration).toBe(0.15);
    });

    it('should prioritize reduced motion over mobile optimization', () => {
      fc.assert(
        fc.property(
          animationConfigArb,
          (config) => {
            // Skip essential animations
            if (config.isEssential) return true;
            
            const context: DeviceContext = {
              isMobile: true,
              prefersReducedMotion: true,
            };
            const computed = computeAnimationState(config, context);
            
            // Reduced motion should take precedence
            return computed.isDisabled === true &&
                   computed.duration <= 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Invariants', () => {
    it('should have deterministic animation state output for same input', () => {
      fc.assert(
        fc.property(
          animationConfigArb,
          deviceContextArb,
          (config, context) => {
            const result1 = computeAnimationState(config, context);
            const result2 = computeAnimationState(config, context);
            
            return result1.duration === result2.duration &&
                   result1.iterationCount === result2.iterationCount &&
                   result1.isDisabled === result2.isDisabled &&
                   result1.transform === result2.transform;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have deterministic animation config output for same input', () => {
      fc.assert(
        fc.property(
          deviceContextArb,
          (context) => {
            const result1 = computeAnimationConfig(context);
            const result2 = computeAnimationConfig(context);
            
            return result1.disableAnimations === result2.disableAnimations &&
                   result1.durationMultiplier === result2.durationMultiplier &&
                   result1.transitionDuration === result2.transitionDuration;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always disable animations when reduced motion is preferred (non-essential)', () => {
      fc.assert(
        fc.property(
          animationTypeArb,
          fc.integer({ min: 100, max: 1000 }),
          fc.boolean(), // isMobile
          (type, duration, isMobile) => {
            const config: AnimationConfig = {
              type,
              isEssential: false,
              defaultDuration: duration,
              defaultIterationCount: 1,
            };
            const context: DeviceContext = {
              isMobile,
              prefersReducedMotion: true,
            };
            const computed = computeAnimationState(config, context);
            
            return computed.isDisabled === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never disable animations when reduced motion is not preferred', () => {
      fc.assert(
        fc.property(
          animationConfigArb,
          fc.boolean(), // isMobile
          (config, isMobile) => {
            const context: DeviceContext = {
              isMobile,
              prefersReducedMotion: false,
            };
            const computed = computeAnimationState(config, context);
            
            return computed.isDisabled === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle all animation types consistently with reduced motion', () => {
      const allTypes: AnimationType[] = [
        'slideIn',
        'fadeIn',
        'pulse',
        'glow',
        'scan',
        'blink',
        'hover-lift',
        'scale-active',
        'opacity-active',
      ];
      
      allTypes.forEach((type) => {
        const config: AnimationConfig = {
          type,
          isEssential: false,
          defaultDuration: 300,
          defaultIterationCount: 1,
        };
        const context: DeviceContext = {
          isMobile: false,
          prefersReducedMotion: true,
        };
        const computed = computeAnimationState(config, context);
        
        expect(computed.isDisabled).toBe(true);
        expect(computed.duration).toBeLessThanOrEqual(0.01);
        expect(computed.transform).toBe('none');
      });
    });

    it('should handle infinite iteration count correctly', () => {
      const config: AnimationConfig = {
        type: 'pulse',
        isEssential: false,
        defaultDuration: 2000,
        defaultIterationCount: 'infinite',
      };
      
      // With reduced motion, infinite should become 1
      const reducedContext: DeviceContext = {
        isMobile: false,
        prefersReducedMotion: true,
      };
      const reducedComputed = computeAnimationState(config, reducedContext);
      expect(reducedComputed.iterationCount).toBe(1);
      
      // Without reduced motion, infinite should remain infinite
      const normalContext: DeviceContext = {
        isMobile: false,
        prefersReducedMotion: false,
      };
      const normalComputed = computeAnimationState(config, normalContext);
      expect(normalComputed.iterationCount).toBe('infinite');
    });

    it('should handle zero duration animations', () => {
      const config: AnimationConfig = {
        type: 'fadeIn',
        isEssential: false,
        defaultDuration: 0,
        defaultIterationCount: 1,
      };
      const context: DeviceContext = {
        isMobile: false,
        prefersReducedMotion: false,
      };
      const computed = computeAnimationState(config, context);
      
      expect(computed.duration).toBe(0);
      expect(computed.isDisabled).toBe(false);
    });
  });
});
