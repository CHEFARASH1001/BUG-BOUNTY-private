'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  ThemeName,
  ThemeColors,
  THEMES,
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  isValidThemeName,
} from './themes';

/**
 * Theme Context Value Interface
 * Provides theme state and setter function to consuming components
 * 
 * Requirements: 1.4, 3.1
 */
export interface ThemeContextValue {
  /** Current active theme name */
  theme: ThemeName;
  /** Function to change the current theme */
  setTheme: (theme: ThemeName) => void;
  /** Current theme's color configuration */
  colors: ThemeColors;
}

/**
 * Theme Context
 * Provides theme state to the component tree
 * 
 * Requirements: 1.4, 3.1
 */
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Props for ThemeProvider component
 */
export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Optional default theme override (defaults to 'cyberpunk') */
  defaultTheme?: ThemeName;
}

/**
 * Apply CSS variables to document root
 * Updates all theme-related CSS custom properties
 * 
 * Requirements: 1.4, 3.2
 */
function applyCSSVariables(colors: ThemeColors): void {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  // Primary accent
  root.style.setProperty('--accent-primary', colors.accentPrimary);
  root.style.setProperty('--accent-primary-hover', colors.accentPrimaryHover);
  
  // Secondary accents
  root.style.setProperty('--accent-secondary', colors.accentSecondary);
  root.style.setProperty('--accent-tertiary', colors.accentTertiary);
  root.style.setProperty('--accent-quaternary', colors.accentQuaternary);
  
  // Backgrounds
  root.style.setProperty('--bg-primary', colors.bgPrimary);
  root.style.setProperty('--bg-card', colors.bgCard);
  root.style.setProperty('--bg-hover', colors.bgHover);
  
  // Borders and effects
  root.style.setProperty('--border-primary', colors.borderPrimary);
  root.style.setProperty('--glow-color', colors.glowColor);
  
  // Scrollbar
  root.style.setProperty('--scrollbar-thumb', colors.scrollbarThumb);
  root.style.setProperty('--scrollbar-thumb-hover', colors.scrollbarThumbHover);
  
  // Grid pattern
  root.style.setProperty('--grid-pattern-color', colors.gridPatternColor);
}

/**
 * Get theme from localStorage with validation
 * Returns default theme if stored value is invalid
 * 
 * Requirements: 1.2, 1.3
 */
export function getStoredTheme(): ThemeName {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isValidThemeName(stored)) {
      return stored;
    }
  } catch {
    // localStorage may be unavailable
  }
  
  return DEFAULT_THEME;
}

/**
 * Persist theme to localStorage
 * 
 * Requirements: 1.1
 */
export function persistTheme(theme: ThemeName): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * ThemeProvider Component
 * Wraps the application and provides theme context to all children
 * 
 * Features:
 * - Initializes theme from localStorage or default
 * - Persists theme changes to localStorage
 * - Updates CSS variables on document root when theme changes
 * 
 * Requirements: 1.1, 1.2, 1.3, 3.2
 */
export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    // Initialize from localStorage or use provided default
    if (typeof window !== 'undefined') {
      return getStoredTheme();
    }
    return defaultTheme ?? DEFAULT_THEME;
  });

  const colors = THEMES[theme];

  // Apply CSS variables immediately on mount and when theme changes
  useEffect(() => {
    // Apply immediately
    applyCSSVariables(colors);
    
    // Also apply on next tick to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      applyCSSVariables(colors);
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [colors]);
  
  // Apply CSS variables on initial mount
  useEffect(() => {
    const storedTheme = getStoredTheme();
    const initialColors = THEMES[storedTheme];
    applyCSSVariables(initialColors);
  }, []);

  // Theme setter that also persists to localStorage
  const setTheme = useCallback((newTheme: ThemeName) => {
    console.log('Setting theme to:', newTheme);
    setThemeState(newTheme);
    persistTheme(newTheme);
    // Apply CSS variables immediately
    applyCSSVariables(THEMES[newTheme]);
  }, []);

  const value: ThemeContextValue = {
    theme,
    setTheme,
    colors,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 * Must be used within a ThemeProvider
 * 
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}

/**
 * Export for testing purposes
 */
export { applyCSSVariables, ThemeContext };
