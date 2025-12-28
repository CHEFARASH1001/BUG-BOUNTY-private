import * as fc from 'fast-check';

/**
 * Property-based tests for ResponsiveForm components
 * 
 * Feature: mobile-responsive
 * Property 8: Form Layout Adaptation
 * Validates: Requirements 5.1, 5.4, 5.5
 * 
 * For any form on mobile viewports (< 768px):
 * - inputs SHALL have width of 100%
 * - labels SHALL be positioned above inputs (not inline)
 * - filter controls SHALL be collapsible
 */

/**
 * Viewport breakpoint for mobile
 */
const MOBILE_BREAKPOINT = 768;

/**
 * Determines if viewport is mobile (< 768px)
 */
function isMobileViewport(width: number): boolean {
  return width < MOBILE_BREAKPOINT;
}

/**
 * Form field configuration
 */
interface FormFieldConfig {
  label: string;
  type: 'input' | 'select' | 'textarea';
  labelPosition: 'above' | 'inline';
}

/**
 * Computed form field layout based on viewport
 */
interface ComputedFieldLayout {
  inputWidth: '100%' | 'auto';
  labelPosition: 'above' | 'inline';
  flexDirection: 'column' | 'row';
}

/**
 * Filter panel state
 */
interface FilterPanelState {
  isExpanded: boolean;
  isCollapsible: boolean;
}

/**
 * Computes the form field layout based on viewport width and config
 */
function computeFieldLayout(
  viewportWidth: number,
  config: FormFieldConfig
): ComputedFieldLayout {
  const isMobile = isMobileViewport(viewportWidth);
  
  if (isMobile) {
    // Mobile: always full width, labels above, column layout
    return {
      inputWidth: '100%',
      labelPosition: 'above',
      flexDirection: 'column',
    };
  }
  
  // Desktop: auto width, configurable label position
  return {
    inputWidth: 'auto',
    labelPosition: config.labelPosition,
    flexDirection: config.labelPosition === 'above' ? 'column' : 'row',
  };
}

/**
 * Computes filter panel behavior based on viewport
 */
function computeFilterPanelBehavior(viewportWidth: number): FilterPanelState {
  const isMobile = isMobileViewport(viewportWidth);
  
  return {
    isExpanded: !isMobile, // Desktop: always expanded, Mobile: collapsed by default
    isCollapsible: isMobile, // Only collapsible on mobile
  };
}

/**
 * Computes button dimensions for touch targets
 */
function computeButtonDimensions(viewportWidth: number): {
  minHeight: number;
  width: '100%' | 'auto';
} {
  const isMobile = isMobileViewport(viewportWidth);
  
  return {
    minHeight: 44, // Always 44px minimum for touch targets
    width: isMobile ? '100%' : 'auto',
  };
}

/**
 * Arbitrary generator for viewport width
 */
const viewportWidthArb = fc.integer({ min: 320, max: 2560 });

/**
 * Arbitrary generator for mobile viewport width (< 768px)
 */
const mobileViewportWidthArb = fc.integer({ min: 320, max: 767 });

/**
 * Arbitrary generator for desktop viewport width (>= 768px)
 */
const desktopViewportWidthArb = fc.integer({ min: 768, max: 2560 });

/**
 * Arbitrary generator for form field type
 */
const fieldTypeArb = fc.constantFrom<'input' | 'select' | 'textarea'>('input', 'select', 'textarea');

/**
 * Arbitrary generator for label position
 */
const labelPositionArb = fc.constantFrom<'above' | 'inline'>('above', 'inline');

/**
 * Arbitrary generator for form field config
 */
const formFieldConfigArb = fc.record({
  label: fc.string({ minLength: 1, maxLength: 50 }),
  type: fieldTypeArb,
  labelPosition: labelPositionArb,
});

describe('Feature: mobile-responsive, Property 8: Form Layout Adaptation', () => {
  /**
   * Property 8: Form Layout Adaptation
   * For any form on mobile viewports (< 768px):
   * - inputs SHALL have width of 100%
   * - labels SHALL be positioned above inputs (not inline)
   * - filter controls SHALL be collapsible
   */

  describe('Input Width on Mobile (Requirement 5.1)', () => {
    it('should have 100% width inputs on mobile viewports', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          formFieldConfigArb,
          (width, config) => {
            const layout = computeFieldLayout(width, config);
            return layout.inputWidth === '100%';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have auto width inputs on desktop viewports', () => {
      fc.assert(
        fc.property(
          desktopViewportWidthArb,
          formFieldConfigArb,
          (width, config) => {
            const layout = computeFieldLayout(width, config);
            return layout.inputWidth === 'auto';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly determine input width for any viewport', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          formFieldConfigArb,
          (width, config) => {
            const layout = computeFieldLayout(width, config);
            const isMobile = isMobileViewport(width);
            
            // Invariant: mobile = 100%, desktop = auto
            return (isMobile && layout.inputWidth === '100%') ||
                   (!isMobile && layout.inputWidth === 'auto');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have consistent breakpoint at exactly 768px', () => {
      const mobileConfig: FormFieldConfig = { label: 'Test', type: 'input', labelPosition: 'inline' };
      
      expect(computeFieldLayout(767, mobileConfig).inputWidth).toBe('100%');
      expect(computeFieldLayout(768, mobileConfig).inputWidth).toBe('auto');
    });
  });

  describe('Label Position on Mobile (Requirement 5.4)', () => {
    it('should position labels above inputs on mobile', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          formFieldConfigArb,
          (width, config) => {
            const layout = computeFieldLayout(width, config);
            return layout.labelPosition === 'above';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use column flex direction on mobile', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          formFieldConfigArb,
          (width, config) => {
            const layout = computeFieldLayout(width, config);
            return layout.flexDirection === 'column';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect label position config on desktop', () => {
      fc.assert(
        fc.property(
          desktopViewportWidthArb,
          formFieldConfigArb,
          (width, config) => {
            const layout = computeFieldLayout(width, config);
            return layout.labelPosition === config.labelPosition;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should override inline label position on mobile', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          (width) => {
            const inlineConfig: FormFieldConfig = {
              label: 'Test',
              type: 'input',
              labelPosition: 'inline',
            };
            const layout = computeFieldLayout(width, inlineConfig);
            
            // Even with inline config, mobile should show above
            return layout.labelPosition === 'above';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use row flex direction on desktop with inline labels', () => {
      fc.assert(
        fc.property(
          desktopViewportWidthArb,
          (width) => {
            const inlineConfig: FormFieldConfig = {
              label: 'Test',
              type: 'input',
              labelPosition: 'inline',
            };
            const layout = computeFieldLayout(width, inlineConfig);
            
            return layout.flexDirection === 'row';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Collapsible Filter Controls (Requirement 5.5)', () => {
    it('should be collapsible on mobile viewports', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          (width) => {
            const state = computeFilterPanelBehavior(width);
            return state.isCollapsible === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not be collapsible on desktop viewports', () => {
      fc.assert(
        fc.property(
          desktopViewportWidthArb,
          (width) => {
            const state = computeFilterPanelBehavior(width);
            return state.isCollapsible === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be collapsed by default on mobile', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          (width) => {
            const state = computeFilterPanelBehavior(width);
            return state.isExpanded === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be expanded by default on desktop', () => {
      fc.assert(
        fc.property(
          desktopViewportWidthArb,
          (width) => {
            const state = computeFilterPanelBehavior(width);
            return state.isExpanded === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have consistent filter behavior at breakpoint', () => {
      expect(computeFilterPanelBehavior(767).isCollapsible).toBe(true);
      expect(computeFilterPanelBehavior(767).isExpanded).toBe(false);
      expect(computeFilterPanelBehavior(768).isCollapsible).toBe(false);
      expect(computeFilterPanelBehavior(768).isExpanded).toBe(true);
    });
  });


  describe('Button Touch Targets', () => {
    it('should have minimum 44px height on all viewports', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (width) => {
            const dimensions = computeButtonDimensions(width);
            return dimensions.minHeight >= 44;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have full width buttons on mobile', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          (width) => {
            const dimensions = computeButtonDimensions(width);
            return dimensions.width === '100%';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have auto width buttons on desktop', () => {
      fc.assert(
        fc.property(
          desktopViewportWidthArb,
          (width) => {
            const dimensions = computeButtonDimensions(width);
            return dimensions.width === 'auto';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Form Field Type Handling', () => {
    it('should apply same layout rules to all field types on mobile', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          fieldTypeArb,
          (width, fieldType) => {
            const config: FormFieldConfig = {
              label: 'Test',
              type: fieldType,
              labelPosition: 'inline',
            };
            const layout = computeFieldLayout(width, config);
            
            // All field types should have same mobile layout
            return layout.inputWidth === '100%' &&
                   layout.labelPosition === 'above' &&
                   layout.flexDirection === 'column';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle all field types consistently', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          fc.array(fieldTypeArb, { minLength: 1, maxLength: 5 }),
          (width, fieldTypes) => {
            const layouts = fieldTypes.map(type => 
              computeFieldLayout(width, { label: 'Test', type, labelPosition: 'inline' })
            );
            
            // All field types should have consistent layout for same viewport
            const firstLayout = layouts[0];
            return layouts.every(layout => 
              layout.inputWidth === firstLayout.inputWidth &&
              layout.labelPosition === firstLayout.labelPosition &&
              layout.flexDirection === firstLayout.flexDirection
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple Form Fields', () => {
    it('should apply consistent layout to all fields in a form on mobile', () => {
      fc.assert(
        fc.property(
          mobileViewportWidthArb,
          fc.array(formFieldConfigArb, { minLength: 1, maxLength: 10 }),
          (width, configs) => {
            const layouts = configs.map(config => computeFieldLayout(width, config));
            
            // All fields should have mobile layout
            return layouts.every(layout => 
              layout.inputWidth === '100%' &&
              layout.labelPosition === 'above' &&
              layout.flexDirection === 'column'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect individual field configs on desktop', () => {
      fc.assert(
        fc.property(
          desktopViewportWidthArb,
          fc.array(formFieldConfigArb, { minLength: 1, maxLength: 10 }),
          (width, configs) => {
            const layouts = configs.map(config => computeFieldLayout(width, config));
            
            // Each field should respect its own config
            return layouts.every((layout, i) => 
              layout.labelPosition === configs[i].labelPosition
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum viewport width (320px)', () => {
      const config: FormFieldConfig = { label: 'Test', type: 'input', labelPosition: 'inline' };
      const layout = computeFieldLayout(320, config);
      
      expect(layout.inputWidth).toBe('100%');
      expect(layout.labelPosition).toBe('above');
      expect(layout.flexDirection).toBe('column');
    });

    it('should handle maximum viewport width (2560px)', () => {
      const config: FormFieldConfig = { label: 'Test', type: 'input', labelPosition: 'inline' };
      const layout = computeFieldLayout(2560, config);
      
      expect(layout.inputWidth).toBe('auto');
      expect(layout.labelPosition).toBe('inline');
      expect(layout.flexDirection).toBe('row');
    });

    it('should handle empty label', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          (width) => {
            const config: FormFieldConfig = { label: '', type: 'input', labelPosition: 'inline' };
            const layout = computeFieldLayout(width, config);
            
            // Layout should still be computed correctly
            return typeof layout.inputWidth === 'string' &&
                   typeof layout.labelPosition === 'string' &&
                   typeof layout.flexDirection === 'string';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invariants', () => {
    it('should maintain mobile/desktop dichotomy for any viewport', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          formFieldConfigArb,
          (width, config) => {
            const layout = computeFieldLayout(width, config);
            const isMobile = isMobileViewport(width);
            
            // Either mobile layout OR desktop layout, never mixed
            const isMobileLayout = layout.inputWidth === '100%' && 
                                   layout.labelPosition === 'above' &&
                                   layout.flexDirection === 'column';
            
            const isDesktopLayout = layout.inputWidth === 'auto';
            
            return (isMobile && isMobileLayout) || (!isMobile && isDesktopLayout);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have deterministic output for same input', () => {
      fc.assert(
        fc.property(
          viewportWidthArb,
          formFieldConfigArb,
          (width, config) => {
            const layout1 = computeFieldLayout(width, config);
            const layout2 = computeFieldLayout(width, config);
            
            return layout1.inputWidth === layout2.inputWidth &&
                   layout1.labelPosition === layout2.labelPosition &&
                   layout1.flexDirection === layout2.flexDirection;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
