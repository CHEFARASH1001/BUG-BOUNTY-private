import * as fc from 'fast-check';
import {
  ThemeName,
  ThemeColors,
  THEME_NAMES,
  THEME_STORAGE_KEY,
  THEMES,
  isValidThemeName,
  DEFAULT_THEME,
} from './themes';
import {
  getStoredTheme,
  persistTheme,
  applyCSSVariables,
} from './theme-context';

/**
 * Property-Based Tests for Theme Context
 * 
 * **Feature: theme-system, Property 1: Theme Persistence Round-Trip**
 * 
 * *For any* valid theme name, when the theme is selected and persisted to localStorage,
 * then reloading the application should restore that same theme.
 * 
 * **Validates: Requirements 1.1, 1.2**
 * 
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// ============================================================================
// MOCK LOCALSTORAGE
// ============================================================================

class MockLocalStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

// ============================================================================
// ARBITRARIES (Generators)
// ============================================================================

/**
 * Arbitrary for generating valid theme names
 */
const themeNameArb: fc.Arbitrary<ThemeName> = fc.constantFrom(...THEME_NAMES);

/**
 * Arbitrary for generating invalid theme strings
 */
const invalidThemeArb = fc.oneof(
  fc.string().filter(s => !isValidThemeName(s)),
  fc.constant(''),
  fc.constant('invalid-theme'),
  fc.constant('dark'),
  fc.constant('light'),
  fc.constant('null'),
  fc.constant('undefined')
);

// ============================================================================
// PROPERTY-BASED TESTS
// ============================================================================

describe('Theme Context Property Tests', () => {
  let mockLocalStorage: MockLocalStorage;
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    originalWindow = global.window;
    
    // Mock window and localStorage for Node.js environment
    // @ts-expect-error - Mocking window for tests
    global.window = {
      localStorage: mockLocalStorage,
    };
    // @ts-expect-error - Mocking localStorage
    global.localStorage = mockLocalStorage;
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  /**
   * **Feature: theme-system, Property 1: Theme Persistence Round-Trip**
   * 
   * *For any* valid theme name, when the theme is selected and persisted to localStorage,
   * then retrieving the stored theme should return that same theme.
   * 
   * **Validates: Requirements 1.1, 1.2**
   */
  describe('Property 1: Theme Persistence Round-Trip', () => {
    it('should persist and retrieve any valid theme name', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          // Clear storage before each test
          mockLocalStorage.clear();
          
          // Persist the theme
          persistTheme(themeName);
          
          // Retrieve the theme
          const retrieved = getStoredTheme();
          
          // Should match the persisted theme
          expect(retrieved).toBe(themeName);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should store theme under the correct key', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          mockLocalStorage.clear();
          
          persistTheme(themeName);
          
          // Verify the value is stored under the correct key
          const storedValue = mockLocalStorage.getItem(THEME_STORAGE_KEY);
          expect(storedValue).toBe(themeName);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should overwrite previous theme when persisting new theme', () => {
      fc.assert(
        fc.property(themeNameArb, themeNameArb, (firstTheme, secondTheme) => {
          mockLocalStorage.clear();
          
          // Persist first theme
          persistTheme(firstTheme);
          expect(getStoredTheme()).toBe(firstTheme);
          
          // Persist second theme
          persistTheme(secondTheme);
          expect(getStoredTheme()).toBe(secondTheme);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Default Theme Fallback', () => {
    it('should return default theme when localStorage is empty', () => {
      mockLocalStorage.clear();
      
      const retrieved = getStoredTheme();
      
      expect(retrieved).toBe(DEFAULT_THEME);
    });

    it('should return default theme for invalid stored values', () => {
      fc.assert(
        fc.property(invalidThemeArb, (invalidTheme) => {
          mockLocalStorage.clear();
          mockLocalStorage.setItem(THEME_STORAGE_KEY, invalidTheme);
          
          const retrieved = getStoredTheme();
          
          // Should fall back to default theme
          expect(retrieved).toBe(DEFAULT_THEME);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Theme Validation', () => {
    it('should validate all defined theme names as valid', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          expect(isValidThemeName(themeName)).toBe(true);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid theme names', () => {
      fc.assert(
        fc.property(invalidThemeArb, (invalidTheme) => {
          expect(isValidThemeName(invalidTheme)).toBe(false);
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Theme Colors Consistency', () => {
    it('should have colors defined for all valid themes', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          const colors = THEMES[themeName];
          
          // Should have all required color properties
          expect(colors).toBeDefined();
          expect(colors.accentPrimary).toBeDefined();
          expect(colors.accentPrimaryHover).toBeDefined();
          expect(colors.accentSecondary).toBeDefined();
          expect(colors.accentTertiary).toBeDefined();
          expect(colors.accentQuaternary).toBeDefined();
          expect(colors.bgPrimary).toBeDefined();
          expect(colors.bgCard).toBeDefined();
          expect(colors.bgHover).toBeDefined();
          expect(colors.borderPrimary).toBeDefined();
          expect(colors.glowColor).toBeDefined();
          expect(colors.scrollbarThumb).toBeDefined();
          expect(colors.scrollbarThumbHover).toBeDefined();
          expect(colors.gridPatternColor).toBeDefined();
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should have valid hex color format for all theme colors', () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          const colors = THEMES[themeName];
          
          // All color values should be valid hex colors
          expect(colors.accentPrimary).toMatch(hexColorRegex);
          expect(colors.accentPrimaryHover).toMatch(hexColorRegex);
          expect(colors.accentSecondary).toMatch(hexColorRegex);
          expect(colors.accentTertiary).toMatch(hexColorRegex);
          expect(colors.accentQuaternary).toMatch(hexColorRegex);
          expect(colors.bgPrimary).toMatch(hexColorRegex);
          expect(colors.bgCard).toMatch(hexColorRegex);
          expect(colors.bgHover).toMatch(hexColorRegex);
          expect(colors.borderPrimary).toMatch(hexColorRegex);
          expect(colors.glowColor).toMatch(hexColorRegex);
          expect(colors.scrollbarThumb).toMatch(hexColorRegex);
          expect(colors.scrollbarThumbHover).toMatch(hexColorRegex);
          expect(colors.gridPatternColor).toMatch(hexColorRegex);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: theme-system, Property 2: Immediate CSS Variable Update**
   * 
   * *For any* theme change, the CSS custom properties on the document root element
   * should immediately reflect the new theme's color definitions without requiring
   * a page refresh.
   * 
   * **Validates: Requirements 1.4, 3.2**
   */
  describe('Property 2: Immediate CSS Variable Update', () => {
    let mockDocumentElement: {
      style: {
        setProperty: jest.Mock;
        properties: Record<string, string>;
      };
    };
    let originalDocument: typeof globalThis.document;

    beforeEach(() => {
      originalDocument = global.document;
      
      // Create mock document element with style.setProperty
      mockDocumentElement = {
        style: {
          properties: {},
          setProperty: jest.fn((name: string, value: string) => {
            mockDocumentElement.style.properties[name] = value;
          }),
        },
      };
      
      // @ts-expect-error - Mocking document for tests
      global.document = {
        documentElement: mockDocumentElement,
      };
    });

    afterEach(() => {
      global.document = originalDocument;
    });

    it('should update all CSS variables immediately when theme colors are applied', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          // Clear previous properties
          mockDocumentElement.style.properties = {};
          mockDocumentElement.style.setProperty.mockClear();
          
          const colors = THEMES[themeName];
          
          // Apply CSS variables
          applyCSSVariables(colors);
          
          // Verify all CSS variables were set
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--accent-primary', colors.accentPrimary);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--accent-primary-hover', colors.accentPrimaryHover);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--accent-secondary', colors.accentSecondary);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--accent-tertiary', colors.accentTertiary);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--accent-quaternary', colors.accentQuaternary);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--bg-primary', colors.bgPrimary);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--bg-card', colors.bgCard);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--bg-hover', colors.bgHover);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--border-primary', colors.borderPrimary);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--glow-color', colors.glowColor);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--scrollbar-thumb', colors.scrollbarThumb);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--scrollbar-thumb-hover', colors.scrollbarThumbHover);
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledWith('--grid-pattern-color', colors.gridPatternColor);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should set CSS variables with correct values from theme colors', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          // Clear previous properties
          mockDocumentElement.style.properties = {};
          mockDocumentElement.style.setProperty.mockClear();
          
          const colors = THEMES[themeName];
          
          // Apply CSS variables
          applyCSSVariables(colors);
          
          // Verify the stored values match the theme colors
          expect(mockDocumentElement.style.properties['--accent-primary']).toBe(colors.accentPrimary);
          expect(mockDocumentElement.style.properties['--accent-primary-hover']).toBe(colors.accentPrimaryHover);
          expect(mockDocumentElement.style.properties['--accent-secondary']).toBe(colors.accentSecondary);
          expect(mockDocumentElement.style.properties['--accent-tertiary']).toBe(colors.accentTertiary);
          expect(mockDocumentElement.style.properties['--accent-quaternary']).toBe(colors.accentQuaternary);
          expect(mockDocumentElement.style.properties['--bg-primary']).toBe(colors.bgPrimary);
          expect(mockDocumentElement.style.properties['--bg-card']).toBe(colors.bgCard);
          expect(mockDocumentElement.style.properties['--bg-hover']).toBe(colors.bgHover);
          expect(mockDocumentElement.style.properties['--border-primary']).toBe(colors.borderPrimary);
          expect(mockDocumentElement.style.properties['--glow-color']).toBe(colors.glowColor);
          expect(mockDocumentElement.style.properties['--scrollbar-thumb']).toBe(colors.scrollbarThumb);
          expect(mockDocumentElement.style.properties['--scrollbar-thumb-hover']).toBe(colors.scrollbarThumbHover);
          expect(mockDocumentElement.style.properties['--grid-pattern-color']).toBe(colors.gridPatternColor);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should update CSS variables when switching between themes', () => {
      fc.assert(
        fc.property(themeNameArb, themeNameArb, (firstTheme, secondTheme) => {
          // Clear previous properties
          mockDocumentElement.style.properties = {};
          mockDocumentElement.style.setProperty.mockClear();
          
          const firstColors = THEMES[firstTheme];
          const secondColors = THEMES[secondTheme];
          
          // Apply first theme
          applyCSSVariables(firstColors);
          
          // Verify first theme colors are set
          expect(mockDocumentElement.style.properties['--accent-primary']).toBe(firstColors.accentPrimary);
          
          // Apply second theme
          applyCSSVariables(secondColors);
          
          // Verify second theme colors are now set (overwriting first)
          expect(mockDocumentElement.style.properties['--accent-primary']).toBe(secondColors.accentPrimary);
          expect(mockDocumentElement.style.properties['--bg-primary']).toBe(secondColors.bgPrimary);
          expect(mockDocumentElement.style.properties['--glow-color']).toBe(secondColors.glowColor);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should set exactly 13 CSS variables for each theme', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          mockDocumentElement.style.setProperty.mockClear();
          
          const colors = THEMES[themeName];
          applyCSSVariables(colors);
          
          // Should have called setProperty exactly 13 times (one for each CSS variable)
          expect(mockDocumentElement.style.setProperty).toHaveBeenCalledTimes(13);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: theme-system, Property 3: Comprehensive Theme Application**
   * 
   * *For any* theme in the theme registry, applying that theme should update all CSS variables
   * (accent colors, backgrounds, borders, glow effects, scrollbar colors, grid pattern)
   * to match the theme's defined values.
   * 
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   */
  describe('Property 3: Comprehensive Theme Application', () => {
    let mockDocumentElement: {
      style: {
        setProperty: jest.Mock;
        properties: Record<string, string>;
      };
    };
    let originalDocument: typeof globalThis.document;

    beforeEach(() => {
      originalDocument = global.document;
      
      // Create mock document element with style.setProperty
      mockDocumentElement = {
        style: {
          properties: {},
          setProperty: jest.fn((name: string, value: string) => {
            mockDocumentElement.style.properties[name] = value;
          }),
        },
      };
      
      // @ts-expect-error - Mocking document for tests
      global.document = {
        documentElement: mockDocumentElement,
      };
    });

    afterEach(() => {
      global.document = originalDocument;
    });

    /**
     * Property 3.1: All accent-colored elements are updated
     * **Validates: Requirements 6.1**
     */
    it('should update all accent color CSS variables for any theme', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          mockDocumentElement.style.properties = {};
          mockDocumentElement.style.setProperty.mockClear();
          
          const colors = THEMES[themeName];
          applyCSSVariables(colors);
          
          // Verify all accent colors are set (Requirements 6.1)
          expect(mockDocumentElement.style.properties['--accent-primary']).toBe(colors.accentPrimary);
          expect(mockDocumentElement.style.properties['--accent-primary-hover']).toBe(colors.accentPrimaryHover);
          expect(mockDocumentElement.style.properties['--accent-secondary']).toBe(colors.accentSecondary);
          expect(mockDocumentElement.style.properties['--accent-tertiary']).toBe(colors.accentTertiary);
          expect(mockDocumentElement.style.properties['--accent-quaternary']).toBe(colors.accentQuaternary);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.2: All glow and shadow effects are updated
     * **Validates: Requirements 6.2**
     */
    it('should update glow effect CSS variable for any theme', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          mockDocumentElement.style.properties = {};
          mockDocumentElement.style.setProperty.mockClear();
          
          const colors = THEMES[themeName];
          applyCSSVariables(colors);
          
          // Verify glow color is set (Requirements 6.2)
          expect(mockDocumentElement.style.properties['--glow-color']).toBe(colors.glowColor);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.3: Scrollbar styling is updated
     * **Validates: Requirements 6.3**
     */
    it('should update scrollbar CSS variables for any theme', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          mockDocumentElement.style.properties = {};
          mockDocumentElement.style.setProperty.mockClear();
          
          const colors = THEMES[themeName];
          applyCSSVariables(colors);
          
          // Verify scrollbar colors are set (Requirements 6.3)
          expect(mockDocumentElement.style.properties['--scrollbar-thumb']).toBe(colors.scrollbarThumb);
          expect(mockDocumentElement.style.properties['--scrollbar-thumb-hover']).toBe(colors.scrollbarThumbHover);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.4: Grid background pattern colors are updated
     * **Validates: Requirements 6.4**
     */
    it('should update grid pattern CSS variable for any theme', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          mockDocumentElement.style.properties = {};
          mockDocumentElement.style.setProperty.mockClear();
          
          const colors = THEMES[themeName];
          applyCSSVariables(colors);
          
          // Verify grid pattern color is set (Requirements 6.4)
          expect(mockDocumentElement.style.properties['--grid-pattern-color']).toBe(colors.gridPatternColor);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.5: All background and border colors are updated
     * **Validates: Requirements 6.1 (comprehensive)**
     */
    it('should update all background and border CSS variables for any theme', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          mockDocumentElement.style.properties = {};
          mockDocumentElement.style.setProperty.mockClear();
          
          const colors = THEMES[themeName];
          applyCSSVariables(colors);
          
          // Verify background colors are set
          expect(mockDocumentElement.style.properties['--bg-primary']).toBe(colors.bgPrimary);
          expect(mockDocumentElement.style.properties['--bg-card']).toBe(colors.bgCard);
          expect(mockDocumentElement.style.properties['--bg-hover']).toBe(colors.bgHover);
          
          // Verify border color is set
          expect(mockDocumentElement.style.properties['--border-primary']).toBe(colors.borderPrimary);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.6: Complete theme application - all CSS variables match theme definition
     * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
     */
    it('should comprehensively apply all theme CSS variables matching theme definition', () => {
      fc.assert(
        fc.property(themeNameArb, (themeName) => {
          mockDocumentElement.style.properties = {};
          mockDocumentElement.style.setProperty.mockClear();
          
          const colors = THEMES[themeName];
          applyCSSVariables(colors);
          
          // Define expected CSS variable mappings
          const expectedMappings: Record<string, keyof ThemeColors> = {
            '--accent-primary': 'accentPrimary',
            '--accent-primary-hover': 'accentPrimaryHover',
            '--accent-secondary': 'accentSecondary',
            '--accent-tertiary': 'accentTertiary',
            '--accent-quaternary': 'accentQuaternary',
            '--bg-primary': 'bgPrimary',
            '--bg-card': 'bgCard',
            '--bg-hover': 'bgHover',
            '--border-primary': 'borderPrimary',
            '--glow-color': 'glowColor',
            '--scrollbar-thumb': 'scrollbarThumb',
            '--scrollbar-thumb-hover': 'scrollbarThumbHover',
            '--grid-pattern-color': 'gridPatternColor',
          };
          
          // Verify all CSS variables are set correctly
          for (const [cssVar, colorKey] of Object.entries(expectedMappings)) {
            expect(mockDocumentElement.style.properties[cssVar]).toBe(colors[colorKey]);
          }
          
          // Verify no extra CSS variables were set
          expect(Object.keys(mockDocumentElement.style.properties).length).toBe(13);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.7: Theme switching updates all variables consistently
     * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
     */
    it('should update all CSS variables consistently when switching between any two themes', () => {
      fc.assert(
        fc.property(themeNameArb, themeNameArb, (firstTheme, secondTheme) => {
          mockDocumentElement.style.properties = {};
          mockDocumentElement.style.setProperty.mockClear();
          
          const firstColors = THEMES[firstTheme];
          const secondColors = THEMES[secondTheme];
          
          // Apply first theme
          applyCSSVariables(firstColors);
          
          // Verify first theme is fully applied
          expect(mockDocumentElement.style.properties['--accent-primary']).toBe(firstColors.accentPrimary);
          expect(mockDocumentElement.style.properties['--glow-color']).toBe(firstColors.glowColor);
          expect(mockDocumentElement.style.properties['--scrollbar-thumb']).toBe(firstColors.scrollbarThumb);
          expect(mockDocumentElement.style.properties['--grid-pattern-color']).toBe(firstColors.gridPatternColor);
          
          // Apply second theme
          applyCSSVariables(secondColors);
          
          // Verify second theme completely replaces first theme
          expect(mockDocumentElement.style.properties['--accent-primary']).toBe(secondColors.accentPrimary);
          expect(mockDocumentElement.style.properties['--accent-primary-hover']).toBe(secondColors.accentPrimaryHover);
          expect(mockDocumentElement.style.properties['--accent-secondary']).toBe(secondColors.accentSecondary);
          expect(mockDocumentElement.style.properties['--accent-tertiary']).toBe(secondColors.accentTertiary);
          expect(mockDocumentElement.style.properties['--accent-quaternary']).toBe(secondColors.accentQuaternary);
          expect(mockDocumentElement.style.properties['--bg-primary']).toBe(secondColors.bgPrimary);
          expect(mockDocumentElement.style.properties['--bg-card']).toBe(secondColors.bgCard);
          expect(mockDocumentElement.style.properties['--bg-hover']).toBe(secondColors.bgHover);
          expect(mockDocumentElement.style.properties['--border-primary']).toBe(secondColors.borderPrimary);
          expect(mockDocumentElement.style.properties['--glow-color']).toBe(secondColors.glowColor);
          expect(mockDocumentElement.style.properties['--scrollbar-thumb']).toBe(secondColors.scrollbarThumb);
          expect(mockDocumentElement.style.properties['--scrollbar-thumb-hover']).toBe(secondColors.scrollbarThumbHover);
          expect(mockDocumentElement.style.properties['--grid-pattern-color']).toBe(secondColors.gridPatternColor);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
