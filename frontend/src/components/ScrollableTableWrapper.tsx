'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface ScrollableTableWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ScrollableTableWrapper provides horizontal scroll indicators for wide tables.
 * Shows gradient fades on scrollable edges to indicate more content is available.
 */
export function ScrollableTableWrapper({
  children,
  className,
}: ScrollableTableWrapperProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    // Add small threshold to account for rounding
    const threshold = 2;
    
    setCanScrollLeft(scrollLeft > threshold);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - threshold);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Initial check
    checkScroll();

    // Check on scroll
    el.addEventListener('scroll', checkScroll, { passive: true });

    // Check on resize
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll]);

  return (
    <div className={cn('relative', className)}>
      {/* Left scroll indicator */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-10',
          'bg-gradient-to-r from-dark-900 to-transparent',
          'transition-opacity duration-200',
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden="true"
      />

      {/* Right scroll indicator */}
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-10',
          'bg-gradient-to-l from-dark-900 to-transparent',
          'transition-opacity duration-200',
          canScrollRight ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden="true"
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-transparent"
        data-testid="scrollable-table-wrapper"
      >
        {children}
      </div>
    </div>
  );
}

export default ScrollableTableWrapper;
