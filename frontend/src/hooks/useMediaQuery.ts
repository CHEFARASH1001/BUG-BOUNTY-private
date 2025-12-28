import { useState, useEffect, useCallback } from 'react';

export interface UseMediaQueryOptions {
  defaultValue?: boolean;
}

/**
 * SSR-safe media query hook that handles hydration mismatches gracefully.
 * Returns whether the media query matches the current viewport.
 * 
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @param options - Optional configuration including default value for SSR
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(
  query: string,
  options: UseMediaQueryOptions = {}
): boolean {
  const { defaultValue = false } = options;

  // Initialize with defaultValue for SSR - prevents hydration mismatch
  const [matches, setMatches] = useState<boolean>(defaultValue);
  const [hasMounted, setHasMounted] = useState<boolean>(false);

  const getMatches = useCallback((mediaQuery: string): boolean => {
    // Check if window is available (client-side)
    if (typeof window === 'undefined') {
      return defaultValue;
    }
    return window.matchMedia(mediaQuery).matches;
  }, [defaultValue]);

  useEffect(() => {
    // Mark as mounted to handle hydration
    setHasMounted(true);

    // Set initial value on client
    setMatches(getMatches(query));

    // Create media query list
    const mediaQueryList = window.matchMedia(query);

    // Handler for media query changes
    const handleChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    // Modern browsers support addEventListener
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQueryList.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleChange);
      } else {
        mediaQueryList.removeListener(handleChange);
      }
    };
  }, [query, getMatches]);

  // Return defaultValue during SSR and initial render to prevent hydration mismatch
  if (!hasMounted) {
    return defaultValue;
  }

  return matches;
}

// Breakpoint constants matching Tailwind CSS defaults
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;
