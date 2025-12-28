'use client';

import React from 'react';
import { useIsMobile } from '@/hooks';
import { cn } from '@/lib/utils';

/**
 * Column priority determines visibility on mobile:
 * - high: Always visible on mobile cards
 * - medium: Visible in expanded view
 * - low: Hidden on mobile, only shown in desktop table
 */
export type ColumnPriority = 'high' | 'medium' | 'low';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  priority: ColumnPriority;
  render?: (value: any, row: T) => React.ReactNode;
  className?: string;
}

export interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  mobileCardRender?: (row: T, columns: Column<T>[]) => React.ReactNode;
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  className?: string;
  loading?: boolean;
}

/**
 * Default mobile card renderer that shows high-priority columns
 */
function DefaultMobileCard<T>({
  row,
  columns,
  onClick,
}: {
  row: T;
  columns: Column<T>[];
  onClick?: () => void;
}) {
  const highPriorityColumns = columns.filter((col) => col.priority === 'high');
  const mediumPriorityColumns = columns.filter((col) => col.priority === 'medium');

  const getValue = (col: Column<T>) => {
    const key = col.key as keyof T;
    const value = row[key];
    return col.render ? col.render(value, row) : value;
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800',
        'hover:border-dark-700 transition-colors',
        onClick && 'cursor-pointer active:bg-dark-800'
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* High priority columns - always visible */}
      <div className="space-y-2">
        {highPriorityColumns.map((col, index) => (
          <div key={String(col.key)} className={cn(index === 0 && 'mb-3')}>
            {index === 0 ? (
              // First high-priority column is the title
              <div className="text-base font-semibold text-white">
                {getValue(col)}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{col.header}</span>
                <span className="text-sm text-slate-300">{getValue(col)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Medium priority columns - secondary info */}
      {mediumPriorityColumns.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dark-800 space-y-2">
          {mediumPriorityColumns.map((col) => (
            <div key={String(col.key)} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{col.header}</span>
              <span className="text-sm text-slate-300">{getValue(col)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ResponsiveTable component that switches between table and card layout
 * based on viewport size. On mobile (< 768px), displays data as cards
 * showing high-priority columns. On desktop, displays a traditional table.
 */
export function ResponsiveTable<T>({
  data,
  columns,
  onRowClick,
  mobileCardRender,
  keyExtractor,
  emptyMessage = 'No data available',
  className,
  loading,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  // Mobile: Card layout
  if (isMobile) {
    return (
      <div className={cn('space-y-3', className)} data-testid="responsive-table-cards">
        {data.map((row) => {
          const key = keyExtractor(row);
          if (mobileCardRender) {
            return (
              <div key={key} onClick={() => onRowClick?.(row)}>
                {mobileCardRender(row, columns)}
              </div>
            );
          }
          return (
            <DefaultMobileCard
              key={key}
              row={row}
              columns={columns}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            />
          );
        })}
      </div>
    );
  }

  // Desktop: Table layout
  return (
    <div className={cn('overflow-x-auto', className)} data-testid="responsive-table-desktop">
      <table className="w-full">
        <thead>
          <tr className="border-b border-dark-800">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-800">
          {data.map((row) => {
            const key = keyExtractor(row);
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'hover:bg-dark-800/50 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((col) => {
                  const colKey = col.key as keyof T;
                  const value = row[colKey];
                  return (
                    <td
                      key={String(col.key)}
                      className={cn('px-4 py-4 text-sm text-slate-300', col.className)}
                    >
                      {col.render ? col.render(value, row) : String(value ?? '')}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ResponsiveTable;
