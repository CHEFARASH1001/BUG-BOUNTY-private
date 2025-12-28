'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks';

/**
 * Responsive action button that meets touch target requirements on mobile.
 * Minimum 44x44px touch target on mobile devices.
 * Supports icon-only buttons with accessible labels.
 */
export interface ResponsiveActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon to display */
  icon: React.ReactNode;
  /** Accessible label for the button (required for icon-only buttons) */
  label: string;
  /** Whether to show the label text on mobile */
  showLabelOnMobile?: boolean;
  /** Button variant */
  variant?: 'default' | 'primary' | 'danger' | 'success' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Loading state */
  loading?: boolean;
  /** Tooltip text (defaults to label) */
  tooltip?: string;
}

export function ResponsiveActionButton({
  icon,
  label,
  showLabelOnMobile = false,
  variant = 'default',
  size = 'md',
  loading = false,
  tooltip,
  className,
  disabled,
  ...props
}: ResponsiveActionButtonProps) {
  const isMobile = useIsMobile();

  const variantStyles = {
    default: 'text-slate-400 hover:text-white hover:bg-dark-700',
    primary: 'text-primary-400 hover:text-primary-300 hover:bg-primary-500/20',
    danger: 'text-red-400 hover:text-red-300 hover:bg-red-500/20',
    success: 'text-green-400 hover:text-green-300 hover:bg-green-500/20',
    ghost: 'text-slate-400 hover:text-white',
  };

  const sizeStyles = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-label={label}
      title={tooltip || label}
      className={cn(
        // Base styles
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors',
        // Touch target: minimum 44x44px
        'min-h-[44px] min-w-[44px]',
        // Touch manipulation to prevent double-tap zoom
        'touch-manipulation',
        // Variant styles
        variantStyles[variant],
        // Size styles
        sizeStyles[size],
        // Disabled state
        (disabled || loading) && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      ) : (
        icon
      )}
      {/* Show label on mobile if enabled */}
      {showLabelOnMobile && isMobile && (
        <span className="text-sm">{label}</span>
      )}
    </button>
  );
}

/**
 * Responsive action button group that stacks vertically on small screens.
 * On mobile (< 480px), buttons stack vertically.
 * On larger screens, buttons display inline.
 */
export interface ResponsiveActionGroupProps {
  children: React.ReactNode;
  className?: string;
  /** Whether to stack on mobile (< 480px) */
  stackOnMobile?: boolean;
  /** Gap between buttons */
  gap?: 'sm' | 'md' | 'lg';
  /** Alignment */
  align?: 'left' | 'center' | 'right';
}

export function ResponsiveActionGroup({
  children,
  className,
  stackOnMobile = true,
  gap = 'sm',
  align = 'right',
}: ResponsiveActionGroupProps) {
  const gapStyles = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-3',
  };

  const alignStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  return (
    <div
      className={cn(
        'flex items-center',
        gapStyles[gap],
        alignStyles[align],
        // Mobile (< 480px): stack vertically if enabled
        stackOnMobile && 'flex-col xs:flex-row',
        className
      )}
      data-testid="responsive-action-group"
    >
      {children}
    </div>
  );
}

export default ResponsiveActionButton;
