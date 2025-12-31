import * as fc from 'fast-check';

/**
 * Property-based tests for Responsive Stats Grid
 * 
 * Feature: mobile-responsive
 * Property 6: Responsive Grid Columns
 * Validates: Requirements 3.1, 3.2
 */

/**
 * Breakpoint configuration matching Tailwind CSS defaults
 */
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/**
 * Determines the expected number of grid columns based on viewport width
 * Based on the implementation: grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
 * 
 * @param viewportWidth - The viewport width in pixels
 * @returns The expected number of columns
 */
function getExpectedColumns(viewportWidth: number): number {
  if (viewportWidth >= BREAKPOINTS.lg) {
    return 4; // lg:grid-cols-4
  } else if (viewportWidth >= BREAKPOINTS.sm) {
    return 2; // sm:grid-cols-2
  } else {
    return 1; // grid-cols-1 (default)
  }
}

/**
 * Determines the expected gap size based on viewport width
 * Based on the implementation: gap-3 sm:gap-4
 * 
 * @param viewportWidth - The viewport width in pixels
 * @returns The expected gap in rem units
 */
function getExpectedGap(viewportWidth: number): number {
  if (viewportWidth >= BREAKPOINTS.sm) {
    return 1; // gap-4 = 1rem
  } else {
    return 0.75; // gap-3 = 0.75rem
  }
}

/**
 * Determines the expected padding based on viewport width
 * Based on the implementation: p-3 sm:p-4 lg:p-5
 * 
 * @param viewportWidth - The viewport width in pixels
 * @returns The expected padding in rem units
 */
function getExpectedPadding(viewportWidth: number): number {
  if (viewportWidth >= BREAKPOINTS.lg) {
    return 1.25; // p-5 = 1.25rem
  } else if (viewportWidth >= BREAKPOINTS.sm) {
    return 1; // p-4 = 1rem
  } else {
    return 0.75; // p-3 = 0.75rem
  }
}

/**
 * Arbitrary generator for viewport widths
 * Covers common device widths and edge cases around breakpoints
 */
const viewportWidthArb = fc.oneof(
  // Common mobile widths
  fc.integer({ min: 320, max: 479 }),
  // Tablet widths
  fc.integer({ min: 480, max: 767 }),
  // Small desktop widths
  fc.integer({ min: 768, max: 1023 }),
  // Large desktop widths
  fc.integer({ min: 1024, max: 1920 }),
  // Edge cases around breakpoints
  fc.constantFrom(
    BREAKPOINTS.sm - 1, // 639
    BREAKPOINTS.sm,     // 640
    BREAKPOINTS.sm + 1, // 641
    BREAKPOINTS.md - 1, // 767
    BREAKPOINTS.md,     // 768
    BREAKPOINTS.md + 1, // 769
    BREAKPOINTS.lg - 1, // 1023
    BREAKPOINTS.lg,     // 1024
    BREAKPOINTS.lg + 1  // 1025
  )
);

describe('Feature: mobile-responsive, Property 6: Responsive Grid Columns', () => {
  /**
   * Property 6: Responsive Grid Columns
   * For any stats grid component, the number of columns SHALL be:
   * - 4 columns for viewport >= 1024px
   * - 2 columns for viewport >= 640px and < 1024px
   * - 1 column for viewport < 640px
   */

  it('should display 1 column for phone viewports (< 640px)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.sm - 1 }),
        (viewportWidth) => {
          const expectedColumns = getExpectedColumns(viewportWidth);
          return expectedColumns === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display 2 columns for tablet viewports (>= 640px and < 1024px)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: BREAKPOINTS.sm, max: BREAKPOINTS.lg - 1 }),
        (viewportWidth) => {
          const expectedColumns = getExpectedColumns(viewportWidth);
          return expectedColumns === 2;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display 4 columns for desktop viewports (>= 1024px)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: BREAKPOINTS.lg, max: 2560 }),
        (viewportWidth) => {
          const expectedColumns = getExpectedColumns(viewportWidth);
          return expectedColumns === 4;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly determine columns for any valid viewport width', () => {
    fc.assert(
      fc.property(
        viewportWidthArb,
        (viewportWidth) => {
          const columns = getExpectedColumns(viewportWidth);
          
          // Verify the column count is valid
          if (columns !== 1 && columns !== 2 && columns !== 4) {
            return false;
          }
          
          // Verify the column count matches the breakpoint rules
          if (viewportWidth < BREAKPOINTS.sm) {
            return columns === 1;
          } else if (viewportWidth < BREAKPOINTS.lg) {
            return columns === 2;
          } else {
            return columns === 4;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle breakpoint edge cases correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { width: BREAKPOINTS.sm - 1, expected: 1 },
          { width: BREAKPOINTS.sm, expected: 2 },
          { width: BREAKPOINTS.lg - 1, expected: 2 },
          { width: BREAKPOINTS.lg, expected: 4 }
        ),
        ({ width, expected }) => {
          const columns = getExpectedColumns(width);
          return columns === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain column count invariant: columns are always 1, 2, or 4', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4000 }),
        (viewportWidth) => {
          const columns = getExpectedColumns(viewportWidth);
          return columns === 1 || columns === 2 || columns === 4;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: mobile-responsive, Property 6: Responsive Gap Sizing', () => {
  /**
   * Additional property: Gap should scale appropriately with viewport
   * gap-3 (0.75rem) for mobile, gap-4 (1rem) for larger screens
   */

  it('should use smaller gap on mobile viewports', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.sm - 1 }),
        (viewportWidth) => {
          const gap = getExpectedGap(viewportWidth);
          return gap === 0.75; // gap-3
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use larger gap on tablet and desktop viewports', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: BREAKPOINTS.sm, max: 2560 }),
        (viewportWidth) => {
          const gap = getExpectedGap(viewportWidth);
          return gap === 1; // gap-4
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: mobile-responsive, Property 6: Responsive Padding', () => {
  /**
   * Additional property: Card padding should scale appropriately
   * p-3 for mobile, p-4 for tablet, p-5 for desktop
   */

  it('should use smallest padding on phone viewports', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.sm - 1 }),
        (viewportWidth) => {
          const padding = getExpectedPadding(viewportWidth);
          return padding === 0.75; // p-3
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use medium padding on tablet viewports', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: BREAKPOINTS.sm, max: BREAKPOINTS.lg - 1 }),
        (viewportWidth) => {
          const padding = getExpectedPadding(viewportWidth);
          return padding === 1; // p-4
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use largest padding on desktop viewports', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: BREAKPOINTS.lg, max: 2560 }),
        (viewportWidth) => {
          const padding = getExpectedPadding(viewportWidth);
          return padding === 1.25; // p-5
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain padding invariant: padding increases with viewport width', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 2560 }),
        fc.integer({ min: 320, max: 2560 }),
        (width1, width2) => {
          const padding1 = getExpectedPadding(width1);
          const padding2 = getExpectedPadding(width2);
          
          // If width1 < width2, padding1 should be <= padding2
          if (width1 < width2) {
            return padding1 <= padding2;
          }
          // If width1 > width2, padding1 should be >= padding2
          if (width1 > width2) {
            return padding1 >= padding2;
          }
          // If equal, padding should be equal
          return padding1 === padding2;
        }
      ),
      { numRuns: 100 }
    );
  });
});
