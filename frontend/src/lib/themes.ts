/**
 * Theme System Type Definitions and Constants
 * 
 * Defines the available themes and their color configurations for the
 * Bug Bounty Automation Platform.
 */

/**
 * Available theme names
 */
export type ThemeName = 'cyberpunk' | 'christmas';

/**
 * Theme color configuration interface
 * Defines all CSS custom properties that themes must provide
 */
export interface ThemeColors {
  // Primary accent
  accentPrimary: string;
  accentPrimaryHover: string;
  
  // Secondary accents
  accentSecondary: string;
  accentTertiary: string;
  accentQuaternary: string;
  
  // Backgrounds
  bgPrimary: string;
  bgCard: string;
  bgHover: string;
  
  // Borders and effects
  borderPrimary: string;
  glowColor: string;
  
  // Scrollbar
  scrollbarThumb: string;
  scrollbarThumbHover: string;
  
  // Grid pattern color
  gridPatternColor: string;
}

/**
 * LocalStorage key for persisting theme preference
 */
export const THEME_STORAGE_KEY = 'bb-platform-theme';

/**
 * Default theme when no preference is stored
 */
export const DEFAULT_THEME: ThemeName = 'cyberpunk';

/**
 * Available theme names for iteration
 */
export const THEME_NAMES: ThemeName[] = ['cyberpunk', 'christmas'];

/**
 * Theme definitions with all color configurations
 * 
 * Requirements covered:
 * - 3.3: Support for background, accent, text, border, and glow color categories
 * - 4.1, 4.2, 4.3: Cyberpunk theme with green, cyan, purple, pink accents
 * - 5.1, 5.2, 5.3, 5.4, 5.5: Christmas theme with red, green, gold palette
 */
export const THEMES: Record<ThemeName, ThemeColors> = {
  /**
   * Cyberpunk Theme (Default)
   * Matches existing application styles with green primary accent
   * Requirements: 4.1, 4.2, 4.3
   */
  cyberpunk: {
    // Primary accent - Green (#22c55e)
    accentPrimary: '#22c55e',
    accentPrimaryHover: '#16a34a',
    
    // Secondary accents - Cyan, Purple, Pink
    accentSecondary: '#00f5ff',    // Cyan
    accentTertiary: '#a855f7',     // Purple
    accentQuaternary: '#ec4899',   // Pink
    
    // Dark backgrounds matching existing styles
    bgPrimary: '#0a0a0f',
    bgCard: '#111118',
    bgHover: '#1a1a24',
    
    // Borders and glow effects
    borderPrimary: '#1e293b',
    glowColor: '#22c55e',
    
    // Scrollbar colors
    scrollbarThumb: '#22c55e',
    scrollbarThumbHover: '#16a34a',
    
    // Grid pattern color
    gridPatternColor: '#22c55e',
  },

  /**
   * Christmas Theme
   * Festive red, green, and gold color palette
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   */
  christmas: {
    // Primary accent - Red (#dc2626)
    accentPrimary: '#dc2626',
    accentPrimaryHover: '#b91c1c',
    
    // Secondary accents - Green, Gold, Light Red
    accentSecondary: '#16a34a',    // Green
    accentTertiary: '#fbbf24',     // Gold
    accentQuaternary: '#f87171',   // Light red
    
    // Warm dark backgrounds with subtle red tints
    bgPrimary: '#0f0a0a',
    bgCard: '#181111',
    bgHover: '#241818',
    
    // Borders and glow effects with red theme
    borderPrimary: '#3b1e1e',
    glowColor: '#dc2626',
    
    // Scrollbar colors matching red theme
    scrollbarThumb: '#dc2626',
    scrollbarThumbHover: '#b91c1c',
    
    // Grid pattern with green for festive contrast
    gridPatternColor: '#16a34a',
  },
};

/**
 * Helper function to check if a string is a valid theme name
 */
export function isValidThemeName(name: string): name is ThemeName {
  return THEME_NAMES.includes(name as ThemeName);
}

/**
 * Get theme colors for a given theme name
 * Falls back to default theme if invalid name provided
 */
export function getThemeColors(themeName: ThemeName): ThemeColors {
  return THEMES[themeName] ?? THEMES[DEFAULT_THEME];
}
