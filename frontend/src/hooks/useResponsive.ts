import { useMediaQuery, BREAKPOINTS } from './useMediaQuery';

/**
 * Hook to detect if the current viewport is mobile (< 768px).
 * SSR-safe - defaults to false (desktop) during server rendering.
 * 
 * @returns boolean indicating if viewport is mobile
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`, {
    defaultValue: false,
  });
}

/**
 * Hook to detect if the current viewport is tablet (768px - 1023px).
 * SSR-safe - defaults to false during server rendering.
 * 
 * @returns boolean indicating if viewport is tablet
 */
export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
    { defaultValue: false }
  );
}

/**
 * Hook to detect if the current viewport is desktop (>= 1024px).
 * SSR-safe - defaults to true during server rendering.
 * 
 * @returns boolean indicating if viewport is desktop
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`, {
    defaultValue: true,
  });
}

/**
 * Hook to detect if the current viewport is small mobile (< 480px).
 * SSR-safe - defaults to false during server rendering.
 * 
 * @returns boolean indicating if viewport is small mobile
 */
export function useIsSmallMobile(): boolean {
  return useMediaQuery('(max-width: 479px)', {
    defaultValue: false,
  });
}
