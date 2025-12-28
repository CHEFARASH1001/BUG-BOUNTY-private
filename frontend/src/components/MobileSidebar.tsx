'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  X,
  ChevronDown,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useReducedMotion, useAnimationConfig } from '@/hooks';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DocumentsSection {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavigationItem[];
}

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  navigation: NavigationItem[];
  documentsSection: DocumentsSection;
}

/**
 * Mobile sidebar overlay component with slide-in animation.
 * Closes on backdrop tap and navigation item selection.
 * Respects prefers-reduced-motion preference.
 */
export function MobileSidebar({
  isOpen,
  onClose,
  navigation,
  documentsSection,
}: MobileSidebarProps): JSX.Element {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [documentsExpanded, setDocumentsExpanded] = React.useState(true);
  const prefersReducedMotion = useReducedMotion();
  const animationConfig = useAnimationConfig(true); // Always mobile for this component

  // Check if any document item is active
  const isDocumentsActive = documentsSection.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href)
  );

  // Handle navigation item click - close sidebar after navigation
  const handleNavClick = (): void => {
    onClose();
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Animation variants based on reduced motion preference
  const backdropVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const sidebarVariants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { x: '-100%' },
        animate: { x: 0 },
        exit: { x: '-100%' },
      };

  const sidebarTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: 'spring', damping: animationConfig.springConfig.damping, stiffness: animationConfig.springConfig.stiffness };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={backdropVariants.initial}
            animate={backdropVariants.animate}
            exit={backdropVariants.exit}
            transition={{ duration: animationConfig.fadeConfig.duration }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
            onClick={handleBackdropClick}
            aria-hidden="true"
            data-testid="mobile-sidebar-backdrop"
          />

          {/* Sidebar */}
          <motion.aside
            ref={sidebarRef}
            initial={sidebarVariants.initial}
            animate={sidebarVariants.animate}
            exit={sidebarVariants.exit}
            transition={sidebarTransition}
            className="fixed left-0 top-0 h-full w-[280px] max-w-[85vw] bg-dark-900 border-r border-dark-800 z-50 flex flex-col md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            data-testid="mobile-sidebar"
          >
            {/* Header with logo and close button */}
            <div className="p-4 border-b border-dark-800 flex items-center justify-between">
              <Link 
                href="/dashboard" 
                className="flex items-center gap-3"
                onClick={handleNavClick}
              >
                <div className="p-2 bg-primary-500/20 rounded-lg border border-primary-500/30 shrink-0">
                  <Terminal className="w-5 h-5 text-primary-400" />
                </div>
                <span className="font-display text-lg font-bold text-primary-400 tracking-wide">
                  BB<span className="text-accent-cyan">.</span>AUTO
                </span>
              </Link>
              <button
                onClick={onClose}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors touch-manipulation"
                aria-label="Close navigation menu"
                data-testid="mobile-sidebar-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                {navigation.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={handleNavClick}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg transition-all group touch-manipulation',
                        isActive
                          ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                          : 'text-slate-400 hover:bg-dark-800 hover:text-white active:bg-dark-700'
                      )}
                    >
                      <item.icon className={clsx(
                        'w-5 h-5 shrink-0',
                        isActive ? 'text-primary-400' : 'text-slate-500 group-hover:text-white'
                      )} />
                      <span className="text-sm font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              
              {/* Documents Section */}
              <div className="p-3 border-t border-dark-800 shrink-0">
                <button
                  onClick={() => setDocumentsExpanded(!documentsExpanded)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg transition-all group touch-manipulation',
                    isDocumentsActive
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                      : 'text-slate-400 hover:bg-dark-800 hover:text-white active:bg-dark-700'
                  )}
                >
                  <documentsSection.icon className={clsx(
                    'w-5 h-5 shrink-0',
                    isDocumentsActive ? 'text-primary-400' : 'text-slate-500 group-hover:text-white'
                  )} />
                  <span className="text-sm font-medium flex-1 text-left">{documentsSection.name}</span>
                  <motion.div
                    animate={{ rotate: documentsExpanded ? 180 : 0 }}
                    transition={{ duration: prefersReducedMotion ? 0.01 : animationConfig.fadeConfig.duration }}
                  >
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  </motion.div>
                </button>
                
                <motion.div
                  initial={false}
                  animate={{ 
                    height: documentsExpanded ? 'auto' : 0,
                    opacity: documentsExpanded ? 1 : 0
                  }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : animationConfig.fadeConfig.duration }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 ml-4 space-y-1 pl-4 border-l border-dark-700">
                    {documentsSection.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href);
                      
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={handleNavClick}
                          className={clsx(
                            'flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-lg transition-all group touch-manipulation',
                            isActive
                              ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                              : 'text-slate-400 hover:bg-dark-800 hover:text-white active:bg-dark-700'
                          )}
                        >
                          <item.icon className={clsx(
                            'w-4 h-4 shrink-0',
                            isActive ? 'text-primary-400' : 'text-slate-500 group-hover:text-white'
                          )} />
                          <span className="text-sm font-medium">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// Need to import React for useState
import React from 'react';
