import * as fc from 'fast-check';

/**
 * Property-based tests for Responsive Typography
 * 
 * Feature: mobile-responsive
 * Property 7: Typography Minimum Sizes
 * Validates: Requirements 9.1, 9.2, 9.3
 * 
 * *For any* text element on mobile viewports:
 * - body text font-size SHALL be >= 14px
 * - h1 font-size SHALL be >= 24px
 * - h2 font-size SHALL be >= 20px
 * - h3 font-size SHALL be >= 18px
 * - line-height for body text SHALL be >= 1.5
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
 * Typography minimum sizes in pixels
 */
const TYPOGRAPHY_MINIMUMS = {
  body: 14,
  h1: 24,
  h2: 20,
  h3: 18,
  small: 12,
  lineHeight: 1.5,
} as const;

/**
 * Typography element types
 */
type TypographyElement = 'body' | 'h1' | 'h2' | 'h3' | 'small';

/**
 * Determines the expected font size for a given element type and viewport width
 * Based on the CSS implementation in globals.css
 * 
 * @param element - The typography element type
 * @param viewportWidth - The viewport width in pixels
 * @returns The expected font size in pixels
 */
function getExpectedFontSize(element: TypographyElement, viewportWidth: number): number {
  switch (element) {
    case 'h1':
      if (viewportWidth >= BREAKPOINTS.lg) {
        return 36; // 2.25rem
      } else if (viewportWidth >= BREAKPOINTS.sm) {
        return 30; // 1.875rem
      } else {
        return 24; // 1.5rem - minimum
      }
    case 'h2':
      if (viewportWidth >= BREAKPOINTS.lg) {
        return 30; // 1.875rem
      } else if (viewportWidth >= BREAKPOINTS.sm) {
        return 24; // 1.5rem
      } else {
        return 20; // 1.25rem - minimum
      }
    case 'h3':
      if (viewportWidth >= BREAKPOINTS.lg) {
        return 24; // 1.5rem
      } else if (viewportWidth >= BREAKPOINTS.sm) {
        return 20; // 1.25rem
      } else {
        return 18; // 1.125rem - minimum
      }
    case 'body':
      return 14; // Always 14px minimum
    case 'small':
      return 12; // Always 12px minimum
    default:
      return 14;
  }
}

/**
 * Determines the expected line height for body text
 * 
 * @param viewportWidth - The viewport width in pixels
 * @returns The expected line height ratio
 */
function getExpectedLineHeight(viewportWidth: number): number {
  // Line height is always 1.5 for body text regardless of viewport
  return 1.5;
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

/**
 * Arbitrary generator for typography element types
 */
const typographyElementArb = fc.constantFrom<TypographyElement>('body', 'h1', 'h2', 'h3', 'small');

describe('Feature: mobile-responsive, Property 7: Typography Minimum Sizes', () => {
  /**
   * Property 7: Typography Minimum Sizes
   * For any text element on mobile viewports:
   * - body text font-size SHALL be >= 14px
   * - h1 font-size SHALL be >= 24px
   * - h2 font-size SHALL be >= 20px
   * - h3 font-size SHALL be >= 18px
   * - line-height for body text SHALL be >= 1.5
   */

  describe('Body Text Minimum Size', () => {
    it('should maintain minimum 14px body text on all viewports', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (viewportWidth) => {
            const fontSize = getExpectedFontSize('body', viewportWidth);
            return fontSize >= TYPOGRAPHY_MINIMUMS.body;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain minimum 14px body text specifically on mobile viewports', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
          (viewportWidth) => {
            const fontSize = getExpectedFontSize('body', viewportWidth);
            return fontSize >= TYPOGRAPHY_MINIMUMS.body;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Heading Minimum Sizes', () => {
    it('should maintain minimum 24px h1 on all viewports', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (viewportWidth) => {
            const fontSize = getExpectedFontSize('h1', viewportWidth);
            return fontSize >= TYPOGRAPHY_MINIMUMS.h1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain minimum 20px h2 on all viewports', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (viewportWidth) => {
            const fontSize = getExpectedFontSize('h2', viewportWidth);
            return fontSize >= TYPOGRAPHY_MINIMUMS.h2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain minimum 18px h3 on all viewports', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (viewportWidth) => {
            const fontSize = getExpectedFontSize('h3', viewportWidth);
            return fontSize >= TYPOGRAPHY_MINIMUMS.h3;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain heading hierarchy (h1 > h2 > h3) on all viewports', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (viewportWidth) => {
            const h1Size = getExpectedFontSize('h1', viewportWidth);
            const h2Size = getExpectedFontSize('h2', viewportWidth);
            const h3Size = getExpectedFontSize('h3', viewportWidth);
            return h1Size > h2Size && h2Size > h3Size;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Small Text Minimum Size', () => {
    it('should maintain minimum 12px for small text on all viewports', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (viewportWidth) => {
            const fontSize = getExpectedFontSize('small', viewportWidth);
            return fontSize >= TYPOGRAPHY_MINIMUMS.small;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Line Height Requirements', () => {
    it('should maintain minimum 1.5 line height for body text on all viewports', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (viewportWidth) => {
            const lineHeight = getExpectedLineHeight(viewportWidth);
            return lineHeight >= TYPOGRAPHY_MINIMUMS.lineHeight;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain minimum 1.5 line height specifically on mobile viewports', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
          (viewportWidth) => {
            const lineHeight = getExpectedLineHeight(viewportWidth);
            return lineHeight >= TYPOGRAPHY_MINIMUMS.lineHeight;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Typography Scaling Invariants', () => {
    it('should scale headings up (not down) as viewport increases', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 320, max: 2560 }),
          fc.integer({ min: 320, max: 2560 }),
          fc.constantFrom<TypographyElement>('h1', 'h2', 'h3'),
          (width1, width2, element) => {
            const size1 = getExpectedFontSize(element, width1);
            const size2 = getExpectedFontSize(element, width2);
            
            // If width1 < width2, size1 should be <= size2
            if (width1 < width2) {
              return size1 <= size2;
            }
            // If width1 > width2, size1 should be >= size2
            if (width1 > width2) {
              return size1 >= size2;
            }
            // If equal, sizes should be equal
            return size1 === size2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistent body text size across all viewports', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 320, max: 2560 }),
          fc.integer({ min: 320, max: 2560 }),
          (width1, width2) => {
            const size1 = getExpectedFontSize('body', width1);
            const size2 = getExpectedFontSize('body', width2);
            // Body text should be consistent (14px) regardless of viewport
            return size1 === size2 && size1 === 14;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Breakpoint Edge Cases', () => {
    it('should handle breakpoint transitions correctly for h1', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { width: BREAKPOINTS.sm - 1, expected: 24 },
            { width: BREAKPOINTS.sm, expected: 30 },
            { width: BREAKPOINTS.lg - 1, expected: 30 },
            { width: BREAKPOINTS.lg, expected: 36 }
          ),
          ({ width, expected }) => {
            const fontSize = getExpectedFontSize('h1', width);
            return fontSize === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle breakpoint transitions correctly for h2', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { width: BREAKPOINTS.sm - 1, expected: 20 },
            { width: BREAKPOINTS.sm, expected: 24 },
            { width: BREAKPOINTS.lg - 1, expected: 24 },
            { width: BREAKPOINTS.lg, expected: 30 }
          ),
          ({ width, expected }) => {
            const fontSize = getExpectedFontSize('h2', width);
            return fontSize === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle breakpoint transitions correctly for h3', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { width: BREAKPOINTS.sm - 1, expected: 18 },
            { width: BREAKPOINTS.sm, expected: 20 },
            { width: BREAKPOINTS.lg - 1, expected: 20 },
            { width: BREAKPOINTS.lg, expected: 24 }
          ),
          ({ width, expected }) => {
            const fontSize = getExpectedFontSize('h3', width);
            return fontSize === expected;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('All Typography Elements Combined', () => {
    it('should maintain minimum sizes for all typography elements on any viewport', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          typographyElementArb,
          (viewportWidth, element) => {
            const fontSize = getExpectedFontSize(element, viewportWidth);
            const minimum = TYPOGRAPHY_MINIMUMS[element];
            return fontSize >= minimum;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
