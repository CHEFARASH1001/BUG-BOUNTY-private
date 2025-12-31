'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { useMediaQuery, BREAKPOINTS, useReducedMotion, useAnimationConfig } from '@/hooks';

export interface ResponsiveModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Icon to display in header */
  icon?: React.ReactNode;
  /** Modal content */
  children: React.ReactNode;
  /** Optional footer content */
  footer?: React.ReactNode;
  /** Maximum width on desktop (default: max-w-lg) */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  /** Whether clicking backdrop closes modal (default: true) */
  closeOnBackdrop?: boolean;
  /** Whether to show close button (default: true) */
  showCloseButton?: boolean;
  /** Additional class names for modal container */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

const maxWidthClasses: Record<string, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-lg',
  xl: 'md:max-w-xl',
  '2xl': 'md:max-w-2xl',
  '3xl': 'md:max-w-3xl',
  '4xl': 'md:max-w-4xl',
  '5xl': 'md:max-w-5xl',
  full: 'md:max-w-full',
};

/**
 * Responsive modal component that displays full-screen on mobile
 * and centered with configurable max-width on desktop.
 * 
 * Features:
 * - Full-screen on mobile (< 768px)
 * - Centered modal on desktop with configurable max-width
 * - Accessible close button with 44x44px touch target
 * - Internal scrolling for content
 * - Body scroll lock when open
 * - Backdrop click to close (configurable)
 * - Escape key to close
 */
export function ResponsiveModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = 'lg',
  closeOnBackdrop = true,
  showCloseButton = true,
  className,
  testId = 'responsive-modal',
}: ResponsiveModalProps): JSX.Element {
  const modalRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
  const prefersReducedMotion = useReducedMotion();
  const animationConfig = useAnimationConfig(isMobile);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent): void => {
      if (closeOnBackdrop && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdrop, onClose]
  );

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Body scroll lock when modal is open
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isOpen) {
      const scrollY = window.scrollY;
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Focus trap - focus modal when opened
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  // Animation variants based on reduced motion preference
  const getModalVariants = () => {
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };
    }
    
    if (isMobile) {
      return {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
      };
    }
    
    return {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
    };
  };

  const getModalTransition = () => {
    if (prefersReducedMotion) {
      return { duration: 0.01 };
    }
    
    if (isMobile) {
      return { 
        type: 'spring', 
        damping: animationConfig.springConfig.damping, 
        stiffness: animationConfig.springConfig.stiffness 
      };
    }
    
    return { duration: animationConfig.fadeConfig.duration };
  };

  const modalVariants = getModalVariants();
  const modalTransition = getModalTransition();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : animationConfig.fadeConfig.duration }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleBackdropClick}
            aria-hidden="true"
            data-testid={`${testId}-backdrop`}
          />

          {/* Modal Container */}
          <div
            className={clsx(
              'fixed inset-0 z-50 flex',
              // Mobile: full screen with small padding
              'p-0 md:p-4',
              // Desktop: center the modal
              'md:items-center md:justify-center'
            )}
            onClick={handleBackdropClick}
            data-testid={`${testId}-container`}
          >
            {/* Modal */}
            <motion.div
              ref={modalRef}
              initial={modalVariants.initial}
              animate={modalVariants.animate}
              exit={modalVariants.exit}
              transition={modalTransition}
              className={clsx(
                'bg-dark-900 border border-dark-700 overflow-hidden flex flex-col',
                // Mobile: full screen
                'w-full h-full',
                // Desktop: centered with max dimensions
                'md:w-full md:h-auto md:max-h-[90vh] md:rounded-xl',
                maxWidthClasses[maxWidth],
                className
              )}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? `${testId}-title` : undefined}
              tabIndex={-1}
              data-testid={testId}
            >
              {/* Header */}
              {(title || showCloseButton) && (
                <div className="flex items-center justify-between p-4 border-b border-dark-800 shrink-0">
                  <div className="flex items-center gap-3">
                    {icon && (
                      <div className="p-2 bg-primary-500/20 rounded-lg shrink-0">
                        {icon}
                      </div>
                    )}
                    {title && (
                      <div>
                        <h2
                          id={`${testId}-title`}
                          className="text-lg font-semibold text-white"
                        >
                          {title}
                        </h2>
                        {subtitle && (
                          <p className="text-sm text-slate-400">{subtitle}</p>
                        )}
                      </div>
                    )}
                  </div>
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className={clsx(
                        'p-2 text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors',
                        // Ensure 44x44px minimum touch target
                        'min-w-[44px] min-h-[44px] flex items-center justify-center',
                        'touch-manipulation'
                      )}
                      aria-label="Close modal"
                      data-testid={`${testId}-close`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}

              {/* Content - scrollable */}
              <div
                className="flex-1 overflow-y-auto p-4"
                style={{ WebkitOverflowScrolling: 'touch' }}
                data-testid={`${testId}-content`}
              >
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div
                  className="p-4 border-t border-dark-800 shrink-0"
                  data-testid={`${testId}-footer`}
                >
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ResponsiveModal;
