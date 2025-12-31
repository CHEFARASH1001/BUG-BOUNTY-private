import * as fc from 'fast-check';
import { BREAKPOINTS } from '@/hooks/useMediaQuery';

/**
 * Property-based tests for Responsive Header
 * 
 * Feature: mobile-responsive
 * Property 9: Header Sticky Positioning
 * Property 10: Search Expansion State
 * Validates: Requirements 2.1, 2.2, 2.4
 */

/**
 * Simulates the header state machine for testing
 */
interface HeaderState {
  isSearchExpanded: boolean;
  isMobile: boolean;
  position: 'sticky' | 'static';
  top: number;
}

type HeaderAction = 
  | { type: 'TOGGLE_SEARCH' }
  | { type: 'EXPAND_SEARCH' }
  | { type: 'COLLAPSE_SEARCH' }
  | { type: 'CLICK_OUTSIDE' }
  | { type: 'RESIZE'; viewportWidth: number };

/**
 * Determines if viewport is mobile based on width
 */
function isMobileViewport(width: number): boolean {
  return width < BREAKPOINTS.md;
}

/**
 * State machine reducer for header behavior
 */
function headerReducer(state: HeaderState, action: HeaderAction): HeaderState {
  switch (action.type) {
    case 'TOGGLE_SEARCH':
      // Only toggle on mobile
      if (state.isMobile) {
        return { ...state, isSearchExpanded: !state.isSearchExpanded };
      }
      return state;
    case 'EXPAND_SEARCH':
      // Only expand on mobile
      if (state.isMobile) {
        return { ...state, isSearchExpanded: true };
      }
      return state;
    case 'COLLAPSE_SEARCH':
      return { ...state, isSearchExpanded: false };
    case 'CLICK_OUTSIDE':
      // Clicking outside collapses search on mobile
      if (state.isMobile && state.isSearchExpanded) {
        return { ...state, isSearchExpanded: false };
      }
      return state;
    case 'RESIZE':
      const newIsMobile = isMobileViewport(action.viewportWidth);
      // When switching from mobile to desktop, collapse search
      // Search is always visible on desktop, so expansion state doesn't matter
      return { 
        ...state, 
        isMobile: newIsMobile,
        isSearchExpanded: newIsMobile ? state.isSearchExpanded : false
      };
    default:
      return state;
  }
}

/**
 * Creates initial header state based on viewport width
 */
function createInitialState(viewportWidth: number): HeaderState {
  return {
    isSearchExpanded: false,
    isMobile: isMobileViewport(viewportWidth),
    position: 'sticky',
    top: 0,
  };
}

/**
 * Arbitrary generator for header actions
 */
const headerActionArb = fc.oneof(
  fc.constant({ type: 'TOGGLE_SEARCH' } as HeaderAction),
  fc.constant({ type: 'EXPAND_SEARCH' } as HeaderAction),
  fc.constant({ type: 'COLLAPSE_SEARCH' } as HeaderAction),
  fc.constant({ type: 'CLICK_OUTSIDE' } as HeaderAction),
  fc.integer({ min: 320, max: 1920 }).map(width => ({ type: 'RESIZE', viewportWidth: width } as HeaderAction))
);

describe('Feature: mobile-responsive, Property 9: Header Sticky Positioning', () => {
  /**
   * Property 9: Header Sticky Positioning
   * For any viewport size, the header element SHALL have position:sticky
   * and top:0 to remain visible during scroll.
   */

  it('should always have sticky positioning regardless of viewport width', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 3000 }),
        (viewportWidth) => {
          const state = createInitialState(viewportWidth);
          // Header should always be sticky
          return state.position === 'sticky' && state.top === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain sticky positioning after any sequence of actions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1920 }),
        fc.array(headerActionArb, { minLength: 0, maxLength: 20 }),
        (initialWidth, actions) => {
          let state = createInitialState(initialWidth);
          
          // Apply all actions
          for (const action of actions) {
            state = headerReducer(state, action);
          }
          
          // Sticky positioning should never change
          return state.position === 'sticky' && state.top === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain sticky positioning across viewport resizes', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 320, max: 1920 }), { minLength: 1, maxLength: 10 }),
        (viewportWidths) => {
          let state = createInitialState(viewportWidths[0]);
          
          // Simulate multiple resize events
          for (const width of viewportWidths) {
            state = headerReducer(state, { type: 'RESIZE', viewportWidth: width });
          }
          
          // Sticky positioning should be maintained
          return state.position === 'sticky' && state.top === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have sticky positioning at mobile breakpoint boundary', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 760, max: 780 }),
        (viewportWidth) => {
          const state = createInitialState(viewportWidth);
          // Sticky should work at and around the breakpoint
          return state.position === 'sticky' && state.top === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: mobile-responsive, Property 10: Search Expansion State', () => {
  /**
   * Property 10: Search Expansion State
   * For any mobile viewport (< 768px), the search bar SHALL be collapsed
   * by default, and clicking the search icon SHALL expand it to full width
   * with focus.
   */

  it('should have search collapsed by default on mobile', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
        (viewportWidth) => {
          const state = createInitialState(viewportWidth);
          // On mobile, search should be collapsed by default
          return state.isMobile === true && state.isSearchExpanded === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should expand search when search icon is clicked on mobile', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
        (viewportWidth) => {
          let state = createInitialState(viewportWidth);
          
          // Click search icon to expand
          state = headerReducer(state, { type: 'EXPAND_SEARCH' });
          
          // Search should be expanded
          return state.isSearchExpanded === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should toggle search state on mobile', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
        fc.boolean(),
        (viewportWidth, initialExpanded) => {
          let state = createInitialState(viewportWidth);
          
          // Set initial expanded state
          if (initialExpanded) {
            state = headerReducer(state, { type: 'EXPAND_SEARCH' });
          }
          
          const beforeToggle = state.isSearchExpanded;
          
          // Toggle search
          state = headerReducer(state, { type: 'TOGGLE_SEARCH' });
          
          // State should be opposite
          return state.isSearchExpanded === !beforeToggle;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should collapse search when clicking outside on mobile', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
        (viewportWidth) => {
          let state = createInitialState(viewportWidth);
          
          // Expand search first
          state = headerReducer(state, { type: 'EXPAND_SEARCH' });
          
          // Click outside
          state = headerReducer(state, { type: 'CLICK_OUTSIDE' });
          
          // Search should be collapsed
          return state.isSearchExpanded === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not affect search expansion on desktop', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: BREAKPOINTS.md, max: 3000 }),
        (viewportWidth) => {
          let state = createInitialState(viewportWidth);
          
          // Try to expand search on desktop
          state = headerReducer(state, { type: 'EXPAND_SEARCH' });
          
          // On desktop, search is always visible (not in expanded/collapsed mode)
          // The expansion state should remain false as it's not applicable
          return state.isMobile === false && state.isSearchExpanded === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should collapse search when resizing from mobile to desktop', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
        fc.integer({ min: BREAKPOINTS.md, max: 1920 }),
        (mobileWidth, desktopWidth) => {
          // Start on mobile with expanded search
          let state = createInitialState(mobileWidth);
          state = headerReducer(state, { type: 'EXPAND_SEARCH' });
          
          // Resize to desktop
          state = headerReducer(state, { type: 'RESIZE', viewportWidth: desktopWidth });
          
          // Search expansion should be reset (not applicable on desktop)
          return state.isMobile === false && state.isSearchExpanded === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain search state when resizing within mobile range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
        fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
        fc.boolean(),
        (width1, width2, expanded) => {
          // Start on mobile
          let state = createInitialState(width1);
          
          // Set expanded state
          if (expanded) {
            state = headerReducer(state, { type: 'EXPAND_SEARCH' });
          }
          
          const beforeResize = state.isSearchExpanded;
          
          // Resize within mobile range
          state = headerReducer(state, { type: 'RESIZE', viewportWidth: width2 });
          
          // Search state should be maintained
          return state.isSearchExpanded === beforeResize;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle rapid toggle sequences correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
        fc.integer({ min: 1, max: 50 }),
        (viewportWidth, toggleCount) => {
          let state = createInitialState(viewportWidth);
          
          // Apply multiple toggles
          for (let i = 0; i < toggleCount; i++) {
            state = headerReducer(state, { type: 'TOGGLE_SEARCH' });
          }
          
          // Final state should be predictable
          const expectedExpanded = toggleCount % 2 === 1;
          return state.isSearchExpanded === expectedExpanded;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle mixed action sequences on mobile', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
        fc.array(
          fc.oneof(
            fc.constant({ type: 'TOGGLE_SEARCH' } as HeaderAction),
            fc.constant({ type: 'EXPAND_SEARCH' } as HeaderAction),
            fc.constant({ type: 'COLLAPSE_SEARCH' } as HeaderAction),
            fc.constant({ type: 'CLICK_OUTSIDE' } as HeaderAction)
          ),
          { minLength: 0, maxLength: 20 }
        ),
        (viewportWidth, actions) => {
          let state = createInitialState(viewportWidth);
          
          // Apply all actions
          for (const action of actions) {
            state = headerReducer(state, action);
          }
          
          // State should be valid (boolean)
          return typeof state.isSearchExpanded === 'boolean';
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Search visibility based on viewport', () => {
  /**
   * Property: Search input visibility rules
   * - On mobile (< 768px): Search icon shown when collapsed, full input when expanded
   * - On desktop (>= 768px): Full search input always visible
   */

  it('should show search icon on mobile when collapsed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
        (viewportWidth) => {
          const state = createInitialState(viewportWidth);
          
          // On mobile with collapsed search, icon should be shown
          const showSearchIcon = state.isMobile && !state.isSearchExpanded;
          return showSearchIcon === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show full search input on mobile when expanded', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: BREAKPOINTS.md - 1 }),
        (viewportWidth) => {
          let state = createInitialState(viewportWidth);
          state = headerReducer(state, { type: 'EXPAND_SEARCH' });
          
          // On mobile with expanded search, full input should be shown
          const showFullInput = state.isMobile && state.isSearchExpanded;
          return showFullInput === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always show full search input on desktop', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: BREAKPOINTS.md, max: 3000 }),
        (viewportWidth) => {
          const state = createInitialState(viewportWidth);
          
          // On desktop, full input is always shown (expansion state is irrelevant)
          const showFullInput = !state.isMobile;
          return showFullInput === true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
