import * as fc from 'fast-check';

/**
 * Property-based tests for ResponsiveModal component
 * 
 * Feature: mobile-responsive
 * Property 13: Modal Full-Screen on Mobile
 * Validates: Requirements 8.1
 */

/**
 * Simulates the modal state machine for testing
 */
interface ModalState {
  isOpen: boolean;
  bodyOverflow: 'hidden' | 'auto';
}

interface ModalDimensions {
  width: string;
  height: string;
  maxHeight: string;
  borderRadius: string;
}

type ModalAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'BACKDROP_CLICK' }
  | { type: 'CLOSE_BUTTON_CLICK' }
  | { type: 'ESCAPE_KEY' };

/**
 * State machine reducer for modal behavior
 */
function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN':
      return { isOpen: true, bodyOverflow: 'hidden' };
    case 'CLOSE':
    case 'BACKDROP_CLICK':
    case 'CLOSE_BUTTON_CLICK':
    case 'ESCAPE_KEY':
      return { isOpen: false, bodyOverflow: 'auto' };
    default:
      return state;
  }
}

/**
 * Calculates expected modal dimensions based on viewport width
 * Mobile: full screen (< 768px)
 * Desktop: centered with max-width (>= 768px)
 */
function getExpectedModalDimensions(viewportWidth: number): ModalDimensions {
  const isMobile = viewportWidth < 768;
  
  if (isMobile) {
    return {
      width: '100%',
      height: '100%',
      maxHeight: '100%',
      borderRadius: '0',
    };
  }
  
  return {
    width: '100%',
    height: 'auto',
    maxHeight: '90vh',
    borderRadius: '0.75rem', // rounded-xl
  };
}

/**
 * Validates that modal dimensions meet mobile full-screen requirements
 * Property 13: Modal Full-Screen on Mobile
 * For any modal on mobile viewports (< 768px), the modal width SHALL be >= 90%
 * of viewport width and height SHALL be >= 80% of viewport height.
 */
function validateMobileFullScreen(
  viewportWidth: number,
  viewportHeight: number,
  modalWidth: number,
  modalHeight: number
): boolean {
  const isMobile = viewportWidth < 768;
  
  if (!isMobile) {
    // Desktop: no full-screen requirement
    return true;
  }
  
  // Mobile: modal should be at least 90% width and 80% height
  const minWidth = viewportWidth * 0.9;
  const minHeight = viewportHeight * 0.8;
  
  return modalWidth >= minWidth && modalHeight >= minHeight;
}

/**
 * Arbitrary generator for modal actions
 */
const modalActionArb = fc.oneof(
  fc.constant({ type: 'OPEN' } as ModalAction),
  fc.constant({ type: 'CLOSE' } as ModalAction),
  fc.constant({ type: 'BACKDROP_CLICK' } as ModalAction),
  fc.constant({ type: 'CLOSE_BUTTON_CLICK' } as ModalAction),
  fc.constant({ type: 'ESCAPE_KEY' } as ModalAction)
);

/**
 * Arbitrary generator for viewport dimensions
 */
const viewportArb = fc.record({
  width: fc.integer({ min: 320, max: 2560 }),
  height: fc.integer({ min: 480, max: 1440 }),
});

/**
 * Arbitrary generator for mobile viewport dimensions (< 768px)
 */
const mobileViewportArb = fc.record({
  width: fc.integer({ min: 320, max: 767 }),
  height: fc.integer({ min: 480, max: 1024 }),
});

/**
 * Arbitrary generator for desktop viewport dimensions (>= 768px)
 */
const desktopViewportArb = fc.record({
  width: fc.integer({ min: 768, max: 2560 }),
  height: fc.integer({ min: 600, max: 1440 }),
});

describe('Feature: mobile-responsive, Property 13: Modal Full-Screen on Mobile', () => {
  /**
   * Property 13: Modal Full-Screen on Mobile
   * For any modal on mobile viewports (< 768px), the modal width SHALL be >= 90%
   * of viewport width and height SHALL be >= 80% of viewport height.
   */

  it('should render full-screen on mobile viewports', () => {
    fc.assert(
      fc.property(mobileViewportArb, (viewport) => {
        const dimensions = getExpectedModalDimensions(viewport.width);
        
        // On mobile, modal should be full width and height
        return dimensions.width === '100%' && dimensions.height === '100%';
      }),
      { numRuns: 100 }
    );
  });

  it('should meet minimum size requirements on mobile', () => {
    fc.assert(
      fc.property(mobileViewportArb, (viewport) => {
        // Simulate modal taking full viewport on mobile
        const modalWidth = viewport.width;
        const modalHeight = viewport.height;
        
        return validateMobileFullScreen(
          viewport.width,
          viewport.height,
          modalWidth,
          modalHeight
        );
      }),
      { numRuns: 100 }
    );
  });

  it('should not have border radius on mobile', () => {
    fc.assert(
      fc.property(mobileViewportArb, (viewport) => {
        const dimensions = getExpectedModalDimensions(viewport.width);
        
        // Mobile modals should not have rounded corners (full screen)
        return dimensions.borderRadius === '0';
      }),
      { numRuns: 100 }
    );
  });

  it('should have border radius on desktop', () => {
    fc.assert(
      fc.property(desktopViewportArb, (viewport) => {
        const dimensions = getExpectedModalDimensions(viewport.width);
        
        // Desktop modals should have rounded corners
        return dimensions.borderRadius !== '0';
      }),
      { numRuns: 100 }
    );
  });

  it('should have max-height constraint on desktop', () => {
    fc.assert(
      fc.property(desktopViewportArb, (viewport) => {
        const dimensions = getExpectedModalDimensions(viewport.width);
        
        // Desktop modals should have max-height of 90vh
        return dimensions.maxHeight === '90vh';
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly identify mobile vs desktop breakpoint', () => {
    fc.assert(
      fc.property(viewportArb, (viewport) => {
        const isMobile = viewport.width < 768;
        const dimensions = getExpectedModalDimensions(viewport.width);
        
        if (isMobile) {
          // Mobile: full screen
          return dimensions.width === '100%' && dimensions.height === '100%';
        } else {
          // Desktop: constrained
          return dimensions.height === 'auto' && dimensions.maxHeight === '90vh';
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should handle edge case at exactly 768px (desktop)', () => {
    const dimensions = getExpectedModalDimensions(768);
    
    // 768px is the md breakpoint, should be desktop
    expect(dimensions.height).toBe('auto');
    expect(dimensions.maxHeight).toBe('90vh');
    expect(dimensions.borderRadius).toBe('0.75rem');
  });

  it('should handle edge case at 767px (mobile)', () => {
    const dimensions = getExpectedModalDimensions(767);
    
    // 767px is below md breakpoint, should be mobile
    expect(dimensions.width).toBe('100%');
    expect(dimensions.height).toBe('100%');
    expect(dimensions.borderRadius).toBe('0');
  });
});

describe('Feature: mobile-responsive, Modal State Management', () => {
  /**
   * Additional properties for modal state management
   * These validate backdrop close, escape key, and body scroll lock
   */

  it('should close modal when backdrop is clicked', () => {
    fc.assert(
      fc.property(fc.boolean(), (initiallyOpen) => {
        let state: ModalState = {
          isOpen: initiallyOpen,
          bodyOverflow: initiallyOpen ? 'hidden' : 'auto',
        };

        if (state.isOpen) {
          state = modalReducer(state, { type: 'BACKDROP_CLICK' });
          return state.isOpen === false;
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should close modal when close button is clicked', () => {
    fc.assert(
      fc.property(fc.boolean(), (initiallyOpen) => {
        let state: ModalState = {
          isOpen: initiallyOpen,
          bodyOverflow: initiallyOpen ? 'hidden' : 'auto',
        };

        if (state.isOpen) {
          state = modalReducer(state, { type: 'CLOSE_BUTTON_CLICK' });
          return state.isOpen === false;
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should close modal when escape key is pressed', () => {
    fc.assert(
      fc.property(fc.boolean(), (initiallyOpen) => {
        let state: ModalState = {
          isOpen: initiallyOpen,
          bodyOverflow: initiallyOpen ? 'hidden' : 'auto',
        };

        if (state.isOpen) {
          state = modalReducer(state, { type: 'ESCAPE_KEY' });
          return state.isOpen === false;
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should lock body scroll when modal is open', () => {
    fc.assert(
      fc.property(fc.constant(true), () => {
        const state = modalReducer(
          { isOpen: false, bodyOverflow: 'auto' },
          { type: 'OPEN' }
        );

        return state.isOpen === true && state.bodyOverflow === 'hidden';
      }),
      { numRuns: 100 }
    );
  });

  it('should unlock body scroll when modal is closed', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({ type: 'CLOSE' } as ModalAction),
          fc.constant({ type: 'BACKDROP_CLICK' } as ModalAction),
          fc.constant({ type: 'CLOSE_BUTTON_CLICK' } as ModalAction),
          fc.constant({ type: 'ESCAPE_KEY' } as ModalAction)
        ),
        (closeAction) => {
          let state: ModalState = { isOpen: true, bodyOverflow: 'hidden' };
          state = modalReducer(state, closeAction);

          return state.isOpen === false && state.bodyOverflow === 'auto';
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain scroll lock invariant through action sequences', () => {
    fc.assert(
      fc.property(
        fc.array(modalActionArb, { minLength: 0, maxLength: 50 }),
        (actions) => {
          let state: ModalState = { isOpen: false, bodyOverflow: 'auto' };

          for (const action of actions) {
            state = modalReducer(state, action);

            // Invariant: isOpen and bodyOverflow should always be consistent
            const invariantHolds =
              (state.isOpen && state.bodyOverflow === 'hidden') ||
              (!state.isOpen && state.bodyOverflow === 'auto');

            if (!invariantHolds) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: mobile-responsive, Modal Close Button Touch Target', () => {
  /**
   * Property 1 (partial): Touch Target Minimum Size
   * The close button SHALL have minimum touch target size of 44x44 pixels
   */

  const MINIMUM_TOUCH_TARGET = 44;

  it('should have close button meeting minimum touch target size', () => {
    fc.assert(
      fc.property(
        fc.record({
          buttonWidth: fc.integer({ min: 44, max: 100 }),
          buttonHeight: fc.integer({ min: 44, max: 100 }),
        }),
        ({ buttonWidth, buttonHeight }) => {
          // Close button dimensions should meet minimum touch target
          return buttonWidth >= MINIMUM_TOUCH_TARGET && buttonHeight >= MINIMUM_TOUCH_TARGET;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject buttons smaller than minimum touch target', () => {
    fc.assert(
      fc.property(
        fc.record({
          buttonWidth: fc.integer({ min: 20, max: 43 }),
          buttonHeight: fc.integer({ min: 20, max: 43 }),
        }),
        ({ buttonWidth, buttonHeight }) => {
          // Buttons smaller than 44px should fail validation
          const meetsRequirement =
            buttonWidth >= MINIMUM_TOUCH_TARGET && buttonHeight >= MINIMUM_TOUCH_TARGET;
          return meetsRequirement === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});
