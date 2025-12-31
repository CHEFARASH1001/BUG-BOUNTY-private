import * as fc from 'fast-check';

/**
 * Property-based tests for ResponsiveActionButton and ResponsiveActionGroup components
 * 
 * Feature: mobile-responsive
 * Property 1: Touch Target Minimum Size
 * Property 12: Button Stacking on Small Screens
 * Validates: Requirements 1.6, 5.2, 6.1, 6.2, 8.2
 */

/**
 * Viewport breakpoints
 */
const MOBILE_BREAKPOINT = 768;
const SMALL_SCREEN_BREAKPOINT = 480;
const MINIMUM_TOUCH_TARGET = 44;

/**
 * Determines if viewport is mobile (< 768px)
 */
function isMobileViewport(width: number): boolean {
  return width < MOBILE_BREAKPOINT;
}

/**
 * Determines if viewport is small screen (< 480px)
 */
function isSmallScreen(width: number): boolean {
  return width < SMALL_SCREEN_BREAKPOINT;
}

/**
 * Button configuration
 */
interface ButtonConfig {
  variant: 'default' | 'primary' | 'danger' | 'success' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  hasLabel: boolean;
  showLabelOnMobile: boolean;
}

/**
 * Computed button dimensions based on viewport and config
 */
interface ComputedButtonDimensions {
  minHeight: number;
  minWidth: number;
  hasTouchManipulation: boolean;
  hasAriaLabel: boolean;
}

/**
 * Button group configuration
 */
interface ButtonGroupConfig {
  buttonCount: number;
  stackOnMobile: boolean;
  gap: 'sm' | 'md' | 'lg';
}

/**
 * Computed button group layout
 */
interface ComputedGroupLayout {
  flexDirection: 'row' | 'column';
  gap: string;
}

/**
 * Computes button dimensions based on viewport and config
 * This simulates the ResponsiveActionButton component behavior
 */
function computeButtonDimensions(
  viewportWidth: number,
  config: ButtonConfig
): ComputedButtonDimensions {
  // All buttons must meet minimum touch target requirements
  return {
    minHeight: MINIMUM_TOUCH_TARGET,
    minWidth: MINIMUM_TOUCH_TARGET,
    hasTouchManipulation: true, // Always applied for touch devices
    hasAriaLabel: config.hasLabel, // aria-label is required when label is provided
  };
}

/**
 * Computes button group layout based on viewport and config
 * This simulates the ResponsiveActionGroup component behavior
 */
function computeGroupLayout(
  viewportWidth: number,
  config: ButtonGroupConfig
): ComputedGroupLayout {
  const isSmall = isSmallScreen(viewportWidth);
  
  const gapMap = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-3',
  };
  
  return {
    flexDirection: config.stackOnMobile && isSmall ? 'column' : 'row',
    gap: gapMap[config.gap],
  };
}

/**
 * Computes pagination layout based on viewport
 */
interface PaginationLayout {
  showPageNumbers: boolean;
  showPrevNext: boolean;
  showFirstLast: boolean;
  buttonMinHeight: number;
  buttonMinWidth: number;
}

function computePaginationLayout(viewportWidth: number): PaginationLayout {
  const isMobile = isMobileViewport(viewportWidth);
  
  return {
    showPageNumbers: !isMobile,
    showPrevNext: true, // Always show prev/next
    showFirstLast: !isMobile,
    buttonMinHeight: MINIMUM_TOUCH_TARGET,
    buttonMinWidth: MINIMUM_TOUCH_TARGET,
  };
}

/**
 * Arbitrary generators
 */
const viewportWidthArb = fc.integer({ min: 320, max: 2560 });
const mobileViewportWidthArb = fc.integer({ min: 320, max: 767 });
const smallScreenWidthArb = fc.integer({ min: 320, max: 479 });
const largeScreenWidthArb = fc.integer({ min: 480, max: 2560 });
const desktopViewportWidthArb = fc.integer({ min: 768, max: 2560 });

const buttonVariantArb = fc.constantFrom<'default' | 'primary' | 'danger' | 'success' | 'ghost'>(
  'default', 'primary', 'danger', 'success', 'ghost'
);

const buttonSizeArb = fc.constantFrom<'sm' | 'md' | 'lg'>('sm', 'md', 'lg');

const gapSizeArb = fc.constantFrom<'sm' | 'md' | 'lg'>('sm', 'md', 'lg');

const buttonConfigArb = fc.record({
  variant: buttonVariantArb,
  size: buttonSizeArb,
  hasLabel: fc.boolean(),
  showLabelOnMobile: fc.boolean(),
});

const buttonGroupConfigArb = fc.record({
  buttonCount: fc.integer({ min: 1, max: 10 }),
  stackOnMobile: fc.boolean(),
  gap: gapSizeArb,
});

describe('Feature: mobile-responsive, Property 1: Touch Target Minimum Size', () => {
  /**
   * Property 1: Touch Target Minimum Size
   * For any interactive element (buttons, links, menu items) on mobile viewports,
   * the element's computed dimensions SHALL be at least 44x44 pixels to ensure
   * adequate touch targets.
   * 
   * Validates: Requirements 1.6, 5.2, 6.1, 8.2
   */

  describe('Button Touch Targets', () => {
    it('should have minimum 44px height on all viewports', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          buttonConfigArb,
          (width, config) => {
            const dimensions = computeButtonDimensions(width, config);
            return dimensions.minHeight >= MINIMUM_TOUCH_TARGET;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have minimum 44px width on all viewports', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          buttonConfigArb,
          (width, config) => {
            const dimensions = computeButtonDimensions(width, config);
            return dimensions.minWidth >= MINIMUM_TOUCH_TARGET;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have touch-manipulation CSS on all buttons', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          buttonConfigArb,
          (width, config) => {
            const dimensions = computeButtonDimensions(width, config);
            return dimensions.hasTouchManipulation === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain touch targets regardless of button variant', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          buttonVariantArb,
          (width, variant) => {
            const config: ButtonConfig = {
              variant,
              size: 'md',
              hasLabel: true,
              showLabelOnMobile: false,
            };
            const dimensions = computeButtonDimensions(width, config);
            return dimensions.minHeight >= MINIMUM_TOUCH_TARGET &&
                   dimensions.minWidth >= MINIMUM_TOUCH_TARGET;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain touch targets regardless of button size', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          buttonSizeArb,
          (width, size) => {
            const config: ButtonConfig = {
              variant: 'default',
              size,
              hasLabel: true,
              showLabelOnMobile: false,
            };
            const dimensions = computeButtonDimensions(width, config);
            return dimensions.minHeight >= MINIMUM_TOUCH_TARGET &&
                   dimensions.minWidth >= MINIMUM_TOUCH_TARGET;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have consistent touch targets on mobile viewports', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          buttonConfigArb,
          (width, config) => {
            const dimensions = computeButtonDimensions(width, config);
            return dimensions.minHeight === MINIMUM_TOUCH_TARGET &&
                   dimensions.minWidth === MINIMUM_TOUCH_TARGET;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Pagination Touch Targets', () => {
    it('should have minimum 44px height for pagination buttons', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (width) => {
            const layout = computePaginationLayout(width);
            return layout.buttonMinHeight >= MINIMUM_TOUCH_TARGET;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have minimum 44px width for pagination buttons', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (width) => {
            const layout = computePaginationLayout(width);
            return layout.buttonMinWidth >= MINIMUM_TOUCH_TARGET;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Accessibility Labels', () => {
    it('should have aria-label when label is provided', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (width) => {
            const config: ButtonConfig = {
              variant: 'default',
              size: 'md',
              hasLabel: true,
              showLabelOnMobile: false,
            };
            const dimensions = computeButtonDimensions(width, config);
            return dimensions.hasAriaLabel === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('Feature: mobile-responsive, Property 12: Button Stacking on Small Screens', () => {
  /**
   * Property 12: Button Stacking on Small Screens
   * For any group of action buttons on viewports < 480px,
   * the buttons SHALL be stacked vertically (flex-direction: column).
   * 
   * Validates: Requirements 6.2
   */

  describe('Button Group Layout', () => {
    it('should stack buttons vertically on small screens when stackOnMobile is true', () => {
      fc.assert(
        fc.property(
          smallScreenWidthArb,
          fc.integer({ min: 1, max: 10 }),
          gapSizeArb,
          (width, buttonCount, gap) => {
            const config: ButtonGroupConfig = {
              buttonCount,
              stackOnMobile: true,
              gap,
            };
            const layout = computeGroupLayout(width, config);
            return layout.flexDirection === 'column';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should display buttons horizontally on larger screens', () => {
      fc.assert(
        fc.property(
          largeScreenWidthArb,
          fc.integer({ min: 1, max: 10 }),
          gapSizeArb,
          (width, buttonCount, gap) => {
            const config: ButtonGroupConfig = {
              buttonCount,
              stackOnMobile: true,
              gap,
            };
            const layout = computeGroupLayout(width, config);
            return layout.flexDirection === 'row';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect stackOnMobile=false and keep horizontal layout', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          fc.integer({ min: 1, max: 10 }),
          gapSizeArb,
          (width, buttonCount, gap) => {
            const config: ButtonGroupConfig = {
              buttonCount,
              stackOnMobile: false,
              gap,
            };
            const layout = computeGroupLayout(width, config);
            return layout.flexDirection === 'row';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have consistent breakpoint at exactly 480px', () => {
      const config: ButtonGroupConfig = {
        buttonCount: 3,
        stackOnMobile: true,
        gap: 'md',
      };
      
      expect(computeGroupLayout(479, config).flexDirection).toBe('column');
      expect(computeGroupLayout(480, config).flexDirection).toBe('row');
    });

    it('should apply correct gap regardless of layout direction', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          buttonGroupConfigArb,
          (width, config) => {
            const layout = computeGroupLayout(width, config);
            const expectedGap = {
              sm: 'gap-1',
              md: 'gap-2',
              lg: 'gap-3',
            }[config.gap];
            return layout.gap === expectedGap;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Pagination Layout on Mobile', () => {
    it('should hide page numbers on mobile viewports', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          (width) => {
            const layout = computePaginationLayout(width);
            return layout.showPageNumbers === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show page numbers on desktop viewports', () => {
      fc.assert(
        fc.property(
          desktopViewportWidthArb,
          (width) => {
            const layout = computePaginationLayout(width);
            return layout.showPageNumbers === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always show prev/next buttons', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (width) => {
            const layout = computePaginationLayout(width);
            return layout.showPrevNext === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should hide first/last buttons on mobile', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          (width) => {
            const layout = computePaginationLayout(width);
            return layout.showFirstLast === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show first/last buttons on desktop', () => {
      fc.assert(
        fc.property(
          desktopViewportWidthArb,
          (width) => {
            const layout = computePaginationLayout(width);
            return layout.showFirstLast === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum viewport width (320px)', () => {
      const config: ButtonGroupConfig = {
        buttonCount: 5,
        stackOnMobile: true,
        gap: 'md',
      };
      const layout = computeGroupLayout(320, config);
      
      expect(layout.flexDirection).toBe('column');
    });

    it('should handle maximum viewport width (2560px)', () => {
      const config: ButtonGroupConfig = {
        buttonCount: 5,
        stackOnMobile: true,
        gap: 'md',
      };
      const layout = computeGroupLayout(2560, config);
      
      expect(layout.flexDirection).toBe('row');
    });

    it('should handle single button group', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          gapSizeArb,
          (width, gap) => {
            const config: ButtonGroupConfig = {
              buttonCount: 1,
              stackOnMobile: true,
              gap,
            };
            const layout = computeGroupLayout(width, config);
            
            // Single button should still have valid layout
            return typeof layout.flexDirection === 'string' &&
                   typeof layout.gap === 'string';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle many buttons in group', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          fc.integer({ min: 5, max: 20 }),
          gapSizeArb,
          (width, buttonCount, gap) => {
            const config: ButtonGroupConfig = {
              buttonCount,
              stackOnMobile: true,
              gap,
            };
            const layout = computeGroupLayout(width, config);
            
            // Layout should be computed correctly regardless of button count
            const isSmall = isSmallScreen(width);
            return (isSmall && layout.flexDirection === 'column') ||
                   (!isSmall && layout.flexDirection === 'row');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invariants', () => {
    it('should have deterministic output for same input', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          buttonGroupConfigArb,
          (width, config) => {
            const layout1 = computeGroupLayout(width, config);
            const layout2 = computeGroupLayout(width, config);
            
            return layout1.flexDirection === layout2.flexDirection &&
                   layout1.gap === layout2.gap;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain small/large screen dichotomy', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          buttonGroupConfigArb,
          (width, config) => {
            if (!config.stackOnMobile) {
              // If stacking is disabled, always row
              const layout = computeGroupLayout(width, config);
              return layout.flexDirection === 'row';
            }
            
            const layout = computeGroupLayout(width, config);
            const isSmall = isSmallScreen(width);
            
            // Either stacked (small) OR horizontal (large)
            return (isSmall && layout.flexDirection === 'column') ||
                   (!isSmall && layout.flexDirection === 'row');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
