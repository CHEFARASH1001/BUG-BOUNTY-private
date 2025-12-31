'use client';

import React, { useState, useCallback } from 'react';
import { Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useIsMobile } from '@/hooks';
import { cn } from '@/lib/utils';

export interface ResponsiveFiltersProps {
  children: React.ReactNode;
  className?: string;
  /** Number of active filters to show in collapsed state */
  activeFilterCount?: number;
  /** Label for the filter button on mobile */
  filterLabel?: string;
  /** Whether to show the filter icon */
  showIcon?: boolean;
  /** Callback when clear filters is clicked */
  onClearFilters?: () => void;
  /** Whether to show clear filters button */
  showClearButton?: boolean;
  /** Default expanded state on mobile */
  defaultExpanded?: boolean;
}

/**
 * ResponsiveFilters component that stacks filter controls vertically on mobile.
 * On mobile (< 768px), filters are collapsed behind a "Filters" button.
 * On desktop, filters are displayed inline.
 */
export function ResponsiveFilters({
  children,
  className,
  activeFilterCount = 0,
  filterLabel = 'Filters',
  showIcon = true,
  onClearFilters,
  showClearButton = false,
  defaultExpanded = false,
}: ResponsiveFiltersProps) {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleClearFilters = useCallback(() => {
    onClearFilters?.();
  }, [onClearFilters]);

  // Desktop: Show filters inline
  if (!isMobile) {
    return (
      <div
        className={cn('flex items-center gap-4 flex-wrap', className)}
        data-testid="responsive-filters-desktop"
      >
        {showIcon && <Filter className="w-4 h-4 text-slate-400" />}
        {children}
        {showClearButton && activeFilterCount > 0 && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    );
  }

  // Mobile: Collapsible filter panel
  return (
    <div className={cn('space-y-3', className)} data-testid="responsive-filters-mobile">
      {/* Filter toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3',
          'bg-dark-800 border border-dark-700 rounded-lg',
          'text-sm text-slate-300 font-medium',
          'transition-colors hover:bg-dark-700',
          'min-h-[44px]', // Touch target
          isExpanded && 'border-primary-500/30 bg-dark-700'
        )}
        aria-expanded={isExpanded}
        aria-controls="filter-panel"
      >
        <div className="flex items-center gap-2">
          {showIcon && <Filter className="w-4 h-4 text-slate-400" />}
          <span>{filterLabel}</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Expandable filter panel with animation */}
      <div
        id="filter-panel"
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div
          className={cn(
            'p-4 bg-dark-800/50 border border-dark-700 rounded-lg',
            'space-y-3'
          )}
        >
          {/* Wrap children to make inputs full-width */}
          <div className="flex flex-col gap-3">
            {React.Children.map(children, (child) => {
              if (!React.isValidElement(child)) return child;
              
              // Add full-width class to select and input elements
              if (
                child.type === 'select' ||
                child.type === 'input' ||
                (typeof child.type === 'string' && 
                  (child.type === 'select' || child.type === 'input'))
              ) {
                return React.cloneElement(child as React.ReactElement<any>, {
                  className: cn(
                    (child.props as any).className,
                    'w-full'
                  ),
                });
              }
              
              return child;
            })}
          </div>
          
          {/* Clear filters button on mobile */}
          {showClearButton && activeFilterCount > 0 && (
            <button
              onClick={handleClearFilters}
              className={cn(
                'w-full px-4 py-3 mt-2',
                'bg-dark-700 border border-dark-600 rounded-lg',
                'text-sm text-slate-400 hover:text-white',
                'transition-colors hover:bg-dark-600',
                'min-h-[44px]', // Touch target
                'flex items-center justify-center gap-2'
              )}
            >
              <X className="w-4 h-4" />
              Clear All Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Individual filter item wrapper for consistent styling on mobile
 */
export interface FilterItemProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export function FilterItem({ children, label, className }: FilterItemProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-xs text-slate-500 md:hidden">{label}</label>
      )}
      <div className="w-full md:w-auto">{children}</div>
    </div>
  );
}

export default ResponsiveFilters;
