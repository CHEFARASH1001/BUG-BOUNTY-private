'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks';

export interface ResponsivePaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Total number of items */
  totalItems?: number;
  /** Items per page */
  itemsPerPage?: number;
  /** Whether to show page size selector */
  showPageSizeSelector?: boolean;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void;
  /** Additional class names */
  className?: string;
  /** Whether pagination is disabled */
  disabled?: boolean;
}

/**
 * Responsive pagination component that simplifies to prev/next on mobile.
 * On mobile (< 768px), shows only prev/next buttons with current page indicator.
 * On desktop, shows full pagination with page numbers.
 */
export function ResponsivePagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage = 10,
  showPageSizeSelector = false,
  pageSizeOptions = [10, 25, 50, 100],
  onPageSizeChange,
  className,
  disabled = false,
}: ResponsivePaginationProps) {
  const isMobile = useIsMobile();

  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handleFirst = () => {
    onPageChange(1);
  };

  const handleLast = () => {
    onPageChange(totalPages);
  };

  // Generate page numbers for desktop view
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const showPages = 5;

    if (totalPages <= showPages + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  // Calculate showing range
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems || currentPage * itemsPerPage);

  return (
    <div
      className={cn(
        'flex flex-col gap-4 p-4 bg-dark-900/80 rounded-xl border border-dark-800',
        className
      )}
      data-testid="responsive-pagination"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Info section */}
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm text-slate-400">
          {totalItems !== undefined && (
            <span className="text-center sm:text-left">
              Showing {startItem}-{endItem} of {totalItems}
            </span>
          )}
          {showPageSizeSelector && onPageSizeChange && (
            <div className="flex items-center gap-2">
              <span>Per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                disabled={disabled}
                className="px-2 py-1 bg-dark-800 border border-dark-700 rounded text-slate-300 focus:outline-none focus:border-primary-500/50 min-h-[36px]"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Mobile: Simple prev/next */}
        {isMobile ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrevious}
              disabled={disabled || currentPage === 1}
              aria-label="Previous page"
              className={cn(
                'flex-1 sm:flex-none flex items-center justify-center gap-1',
                'px-4 py-2 rounded-lg',
                'text-slate-400 hover:text-white hover:bg-dark-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors',
                'min-h-[44px]', // Touch target
                'touch-manipulation'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span className="px-3 py-2 text-sm text-slate-300 whitespace-nowrap">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={disabled || currentPage === totalPages}
              aria-label="Next page"
              className={cn(
                'flex-1 sm:flex-none flex items-center justify-center gap-1',
                'px-4 py-2 rounded-lg',
                'text-slate-400 hover:text-white hover:bg-dark-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors',
                'min-h-[44px]', // Touch target
                'touch-manipulation'
              )}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Desktop: Full pagination */
          <div className="flex items-center gap-1">
            <button
              onClick={handleFirst}
              disabled={disabled || currentPage === 1}
              aria-label="First page"
              title="First page"
              className={cn(
                'p-2 rounded-lg',
                'text-slate-400 hover:text-white hover:bg-dark-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors',
                'min-h-[44px] min-w-[44px]', // Touch target
                'touch-manipulation'
              )}
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrevious}
              disabled={disabled || currentPage === 1}
              aria-label="Previous page"
              title="Previous page"
              className={cn(
                'p-2 rounded-lg',
                'text-slate-400 hover:text-white hover:bg-dark-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors',
                'min-h-[44px] min-w-[44px]', // Touch target
                'touch-manipulation'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 mx-2">
              {getPageNumbers().map((pageNum, idx) =>
                pageNum === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-slate-500">
                    ...
                  </span>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum as number)}
                    disabled={disabled}
                    aria-label={`Page ${pageNum}`}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                    className={cn(
                      'min-w-[44px] min-h-[44px] px-3 rounded-lg text-sm font-medium transition-colors',
                      'touch-manipulation',
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-dark-700',
                      disabled && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    {pageNum}
                  </button>
                )
              )}
            </div>

            <button
              onClick={handleNext}
              disabled={disabled || currentPage === totalPages}
              aria-label="Next page"
              title="Next page"
              className={cn(
                'p-2 rounded-lg',
                'text-slate-400 hover:text-white hover:bg-dark-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors',
                'min-h-[44px] min-w-[44px]', // Touch target
                'touch-manipulation'
              )}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleLast}
              disabled={disabled || currentPage === totalPages}
              aria-label="Last page"
              title="Last page"
              className={cn(
                'p-2 rounded-lg',
                'text-slate-400 hover:text-white hover:bg-dark-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors',
                'min-h-[44px] min-w-[44px]', // Touch target
                'touch-manipulation'
              )}
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResponsivePagination;
