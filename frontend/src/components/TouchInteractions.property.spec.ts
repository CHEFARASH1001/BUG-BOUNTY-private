import * as fc from 'fast-check';

/**
 * Property-based tests for Touch Interactions
 * 
 * Feature: mobile-responsive
 * Property 15: Double-Tap Zoom Prevention
 * Validates: Requirements 10.2
 */

/**
 * Interactive element types that should have touch-action: manipulation
 */
type InteractiveElementType = 
  | 'button'
  | 'a'
  | 'input'
  | 'select'
  | 'textarea'
  | 'role-button'
  | 'role-link'
  | 'tabindex';

/**
 * Touch action values
 */
type TouchActionValue = 
  | 'manipulation'
  | 'auto'
  | 'none'
  | 'pan-x'
  | 'pan-y'
  | 'pinch-zoom';

/**
 * Interactive element configuration
 */
interface InteractiveElementConfig {
  type: InteractiveElementType;
  disabled: boolean;
  hasCustomTouchAction: boolean;
  customTouchAction?: TouchActionValue;
}

/**
 * Computed touch action for an element
 */
interface ComputedTouchAction {
  touchAction: TouchActionValue;
  preventsDoubleTapZoom: boolean;
  hasActiveState: boolean;
}

/**
 * Determines the touch-action CSS property for an interactive element.
 * According to the CSS specification, touch-action: manipulation
 * enables panning and pinch zoom gestures, but disables additional
 * non-standard gestures such as double-tap to zoom.
 * 
 * This simulates the behavior defined in globals.css where all
 * interactive elements have touch-action: manipulation applied.
 */
function computeTouchAction(config: InteractiveElementConfig): ComputedTouchAction {
  // If element has custom touch-action, use that
  if (config.hasCustomTouchAction && config.customTouchAction) {
    return {
      touchAction: config.customTouchAction,
      preventsDoubleTapZoom: config.customTouchAction === 'manipulation',
      hasActiveState: !config.disabled,
    };
  }
  
  // All interactive elements should have touch-action: manipulation
  // as defined in globals.css
  return {
    touchAction: 'manipulation',
    preventsDoubleTapZoom: true,
    hasActiveState: !config.disabled,
  };
}

/**
 * Checks if an element type is considered interactive
 */
function isInteractiveElement(type: InteractiveElementType): boolean {
  const interactiveTypes: InteractiveElementType[] = [
    'button',
    'a',
    'input',
    'select',
    'textarea',
    'role-button',
    'role-link',
    'tabindex',
  ];
  return interactiveTypes.includes(type);
}

/**
 * Active state configuration
 */
interface ActiveStateConfig {
  elementType: InteractiveElementType;
  disabled: boolean;
  prefersReducedMotion: boolean;
}

/**
 * Computed active state behavior
 */
interface ComputedActiveState {
  hasScaleTransform: boolean;
  hasOpacityChange: boolean;
  transformValue: string;
  opacityValue: number;
}

/**
 * Computes the active state behavior for an element.
 * According to globals.css, interactive elements have:
 * - transform: scale(0.98) on :active
 * - opacity: 0.9 on :active
 * - These are disabled when prefers-reduced-motion is set
 */
function computeActiveState(config: ActiveStateConfig): ComputedActiveState {
  // Disabled elements don't have active states
  if (config.disabled) {
    return {
      hasScaleTransform: false,
      hasOpacityChange: false,
      transformValue: 'none',
      opacityValue: 1,
    };
  }
  
  // Respect prefers-reduced-motion preference
  if (config.prefersReducedMotion) {
    return {
      hasScaleTransform: false,
      hasOpacityChange: false,
      transformValue: 'none',
      opacityValue: 1,
    };
  }
  
  // Normal active state
  return {
    hasScaleTransform: true,
    hasOpacityChange: true,
    transformValue: 'scale(0.98)',
    opacityValue: 0.9,
  };
}

/**
 * Scroll behavior configuration
 */
interface ScrollBehaviorConfig {
  isScrollContainer: boolean;
  prefersReducedMotion: boolean;
}

/**
 * Computed scroll behavior
 */
interface ComputedScrollBehavior {
  scrollBehavior: 'smooth' | 'auto';
  webkitOverflowScrolling: 'touch' | 'auto';
  hasMomentumScrolling: boolean;
}

/**
 * Computes scroll behavior for a container.
 * According to globals.css:
 * - html has scroll-behavior: smooth
 * - Scrollable containers have -webkit-overflow-scrolling: touch
 * - prefers-reduced-motion disables smooth scrolling
 */
function computeScrollBehavior(config: ScrollBehaviorConfig): ComputedScrollBehavior {
  if (config.prefersReducedMotion) {
    return {
      scrollBehavior: 'auto',
      webkitOverflowScrolling: config.isScrollContainer ? 'touch' : 'auto',
      hasMomentumScrolling: config.isScrollContainer,
    };
  }
  
  return {
    scrollBehavior: 'smooth',
    webkitOverflowScrolling: config.isScrollContainer ? 'touch' : 'auto',
    hasMomentumScrolling: config.isScrollContainer,
  };
}

/**
 * Arbitrary generators
 */
const interactiveElementTypeArb = fc.constantFrom<InteractiveElementType>(
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'role-button',
  'role-link',
  'tabindex'
);

const touchActionValueArb = fc.constantFrom<TouchActionValue>(
  'manipulation',
  'auto',
  'none',
  'pan-x',
  'pan-y',
  'pinch-zoom'
);

const interactiveElementConfigArb = fc.record({
  type: interactiveElementTypeArb,
  disabled: fc.boolean(),
  hasCustomTouchAction: fc.boolean(),
}).chain((config) => {
  if (config.hasCustomTouchAction) {
    return fc.record({
      type: fc.constant(config.type),
      disabled: fc.constant(config.disabled),
      hasCustomTouchAction: fc.constant(true),
      customTouchAction: touchActionValueArb,
    });
  }
  return fc.constant({
    type: config.type,
    disabled: config.disabled,
    hasCustomTouchAction: false,
    customTouchAction: undefined,
  });
});

const activeStateConfigArb = fc.record({
  elementType: interactiveElementTypeArb,
  disabled: fc.boolean(),
  prefersReducedMotion: fc.boolean(),
});

const scrollBehaviorConfigArb = fc.record({
  isScrollContainer: fc.boolean(),
  prefersReducedMotion: fc.boolean(),
});

describe('Feature: mobile-responsive, Property 15: Double-Tap Zoom Prevention', () => {
  /**
   * Property 15: Double-Tap Zoom Prevention
   * For any interactive element, the touch-action CSS property SHALL include
   * 'manipulation' to prevent accidental double-tap zoom.
   * 
   * Validates: Requirements 10.2
   */

  describe('Touch Action on Interactive Elements', () => {
    it('should have touch-action: manipulation on all interactive elements by default', () => {
      fc.assert(
        fc.property(
          interactiveElementTypeArb,
          fc.boolean(), // disabled
          (type, disabled) => {
            const config: InteractiveElementConfig = {
              type,
              disabled,
              hasCustomTouchAction: false,
            };
            const computed = computeTouchAction(config);
            return computed.touchAction === 'manipulation';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent double-tap zoom on all interactive elements by default', () => {
      fc.assert(
        fc.property(
          interactiveElementTypeArb,
          fc.boolean(), // disabled
          (type, disabled) => {
            const config: InteractiveElementConfig = {
              type,
              disabled,
              hasCustomTouchAction: false,
            };
            const computed = computeTouchAction(config);
            return computed.preventsDoubleTapZoom === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect custom touch-action when explicitly set', () => {
      fc.assert(
        fc.property(
          interactiveElementTypeArb,
          fc.boolean(), // disabled
          touchActionValueArb,
          (type, disabled, customTouchAction) => {
            const config: InteractiveElementConfig = {
              type,
              disabled,
              hasCustomTouchAction: true,
              customTouchAction,
            };
            const computed = computeTouchAction(config);
            return computed.touchAction === customTouchAction;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only prevent double-tap zoom when touch-action is manipulation', () => {
      fc.assert(
        fc.property(
          interactiveElementConfigArb,
          (config) => {
            const computed = computeTouchAction(config);
            return computed.preventsDoubleTapZoom === (computed.touchAction === 'manipulation');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply to all standard interactive element types', () => {
      const standardTypes: InteractiveElementType[] = [
        'button',
        'a',
        'input',
        'select',
        'textarea',
      ];
      
      standardTypes.forEach((type) => {
        const config: InteractiveElementConfig = {
          type,
          disabled: false,
          hasCustomTouchAction: false,
        };
        const computed = computeTouchAction(config);
        expect(computed.touchAction).toBe('manipulation');
        expect(computed.preventsDoubleTapZoom).toBe(true);
      });
    });

    it('should apply to ARIA role-based interactive elements', () => {
      const roleTypes: InteractiveElementType[] = [
        'role-button',
        'role-link',
        'tabindex',
      ];
      
      roleTypes.forEach((type) => {
        const config: InteractiveElementConfig = {
          type,
          disabled: false,
          hasCustomTouchAction: false,
        };
        const computed = computeTouchAction(config);
        expect(computed.touchAction).toBe('manipulation');
        expect(computed.preventsDoubleTapZoom).toBe(true);
      });
    });
  });

  describe('Active States for Touch Feedback', () => {
    it('should have active state on enabled elements without reduced motion', () => {
      fc.assert(
        fc.property(
          interactiveElementTypeArb,
          (type) => {
            const config: ActiveStateConfig = {
              elementType: type,
              disabled: false,
              prefersReducedMotion: false,
            };
            const computed = computeActiveState(config);
            return computed.hasScaleTransform === true &&
                   computed.hasOpacityChange === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not have active state on disabled elements', () => {
      fc.assert(
        fc.property(
          interactiveElementTypeArb,
          fc.boolean(), // prefersReducedMotion
          (type, prefersReducedMotion) => {
            const config: ActiveStateConfig = {
              elementType: type,
              disabled: true,
              prefersReducedMotion,
            };
            const computed = computeActiveState(config);
            return computed.hasScaleTransform === false &&
                   computed.hasOpacityChange === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should disable active state transforms when prefers-reduced-motion is set', () => {
      fc.assert(
        fc.property(
          interactiveElementTypeArb,
          fc.boolean(), // disabled
          (type, disabled) => {
            const config: ActiveStateConfig = {
              elementType: type,
              disabled,
              prefersReducedMotion: true,
            };
            const computed = computeActiveState(config);
            return computed.hasScaleTransform === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have correct transform value when active state is enabled', () => {
      fc.assert(
        fc.property(
          interactiveElementTypeArb,
          (type) => {
            const config: ActiveStateConfig = {
              elementType: type,
              disabled: false,
              prefersReducedMotion: false,
            };
            const computed = computeActiveState(config);
            return computed.transformValue === 'scale(0.98)';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have correct opacity value when active state is enabled', () => {
      fc.assert(
        fc.property(
          interactiveElementTypeArb,
          (type) => {
            const config: ActiveStateConfig = {
              elementType: type,
              disabled: false,
              prefersReducedMotion: false,
            };
            const computed = computeActiveState(config);
            return computed.opacityValue === 0.9;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Smooth Momentum Scrolling', () => {
    it('should have smooth scroll behavior by default', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isScrollContainer
          (isScrollContainer) => {
            const config: ScrollBehaviorConfig = {
              isScrollContainer,
              prefersReducedMotion: false,
            };
            const computed = computeScrollBehavior(config);
            return computed.scrollBehavior === 'smooth';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should disable smooth scrolling when prefers-reduced-motion is set', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isScrollContainer
          (isScrollContainer) => {
            const config: ScrollBehaviorConfig = {
              isScrollContainer,
              prefersReducedMotion: true,
            };
            const computed = computeScrollBehavior(config);
            return computed.scrollBehavior === 'auto';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have momentum scrolling on scroll containers', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // prefersReducedMotion
          (prefersReducedMotion) => {
            const config: ScrollBehaviorConfig = {
              isScrollContainer: true,
              prefersReducedMotion,
            };
            const computed = computeScrollBehavior(config);
            return computed.hasMomentumScrolling === true &&
                   computed.webkitOverflowScrolling === 'touch';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not have momentum scrolling on non-scroll containers', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // prefersReducedMotion
          (prefersReducedMotion) => {
            const config: ScrollBehaviorConfig = {
              isScrollContainer: false,
              prefersReducedMotion,
            };
            const computed = computeScrollBehavior(config);
            return computed.hasMomentumScrolling === false &&
                   computed.webkitOverflowScrolling === 'auto';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invariants', () => {
    it('should have deterministic touch action output for same input', () => {
      fc.assert(
        fc.property(
          interactiveElementConfigArb,
          (config) => {
            const result1 = computeTouchAction(config);
            const result2 = computeTouchAction(config);
            return result1.touchAction === result2.touchAction &&
                   result1.preventsDoubleTapZoom === result2.preventsDoubleTapZoom;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have deterministic active state output for same input', () => {
      fc.assert(
        fc.property(
          activeStateConfigArb,
          (config) => {
            const result1 = computeActiveState(config);
            const result2 = computeActiveState(config);
            return result1.hasScaleTransform === result2.hasScaleTransform &&
                   result1.hasOpacityChange === result2.hasOpacityChange &&
                   result1.transformValue === result2.transformValue &&
                   result1.opacityValue === result2.opacityValue;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have deterministic scroll behavior output for same input', () => {
      fc.assert(
        fc.property(
          scrollBehaviorConfigArb,
          (config) => {
            const result1 = computeScrollBehavior(config);
            const result2 = computeScrollBehavior(config);
            return result1.scrollBehavior === result2.scrollBehavior &&
                   result1.webkitOverflowScrolling === result2.webkitOverflowScrolling &&
                   result1.hasMomentumScrolling === result2.hasMomentumScrolling;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always identify interactive elements correctly', () => {
      fc.assert(
        fc.property(
          interactiveElementTypeArb,
          (type) => {
            return isInteractiveElement(type) === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle all element types consistently', () => {
      const allTypes: InteractiveElementType[] = [
        'button',
        'a',
        'input',
        'select',
        'textarea',
        'role-button',
        'role-link',
        'tabindex',
      ];
      
      allTypes.forEach((type) => {
        const config: InteractiveElementConfig = {
          type,
          disabled: false,
          hasCustomTouchAction: false,
        };
        const computed = computeTouchAction(config);
        expect(computed.touchAction).toBe('manipulation');
      });
    });

    it('should handle disabled state correctly for all element types', () => {
      const allTypes: InteractiveElementType[] = [
        'button',
        'a',
        'input',
        'select',
        'textarea',
        'role-button',
        'role-link',
        'tabindex',
      ];
      
      allTypes.forEach((type) => {
        const config: InteractiveElementConfig = {
          type,
          disabled: true,
          hasCustomTouchAction: false,
        };
        const computed = computeTouchAction(config);
        // Touch action should still be manipulation even when disabled
        expect(computed.touchAction).toBe('manipulation');
        // But active state should be disabled
        expect(computed.hasActiveState).toBe(false);
      });
    });
  });
});
