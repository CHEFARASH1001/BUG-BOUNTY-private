import { useState, useCallback, useEffect } from 'react';

export interface UseMobileNavReturn {
  isOpen: boolean;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  toggleMobileMenu: () => void;
}

/**
 * Hook to manage mobile navigation state with body scroll lock.
 * Handles opening/closing the mobile menu and prevents body scrolling when open.
 * 
 * @returns Object with isOpen state and control functions
 */
export function useMobileNav(): UseMobileNavReturn {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const openMobileMenu = useCallback((): void => {
    setIsOpen(true);
  }, []);

  const closeMobileMenu = useCallback((): void => {
    setIsOpen(false);
  }, []);

  const toggleMobileMenu = useCallback((): void => {
    setIsOpen((prev) => !prev);
  }, []);

  // Handle body scroll lock when menu is open
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (isOpen) {
      // Store current scroll position and body styles
      const scrollY = window.scrollY;
      const originalStyle = window.getComputedStyle(document.body).overflow;
      const originalPosition = window.getComputedStyle(document.body).position;
      const originalTop = window.getComputedStyle(document.body).top;
      const originalWidth = window.getComputedStyle(document.body).width;

      // Lock body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      // Cleanup: restore body scroll
      return () => {
        document.body.style.overflow = originalStyle;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Close menu on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeMobileMenu();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeMobileMenu]);

  return {
    isOpen,
    openMobileMenu,
    closeMobileMenu,
    toggleMobileMenu,
  };
}
