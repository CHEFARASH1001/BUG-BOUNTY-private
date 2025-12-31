'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Responsive form input wrapper that makes inputs full-width on mobile.
 * On mobile (< 768px), inputs expand to full width.
 * On desktop, inputs maintain their specified width or inline layout.
 */
export interface ResponsiveInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Additional class names */
  wrapperClassName?: string;
  /** Label text */
  label?: string;
  /** Whether to show label above input on all screen sizes */
  labelAbove?: boolean;
  /** Icon component to show on the left */
  leftIcon?: React.ReactNode;
  /** Icon component to show on the right */
  rightIcon?: React.ReactNode;
}

export function ResponsiveInput({
  className,
  wrapperClassName,
  label,
  labelAbove = false,
  leftIcon,
  rightIcon,
  ...props
}: ResponsiveInputProps) {
  const inputElement = (
    <div className="relative w-full md:w-auto">
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          {leftIcon}
        </div>
      )}
      <input
        {...props}
        className={cn(
          // Base styles
          'px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg',
          'text-white placeholder-slate-500',
          'focus:outline-none focus:border-primary-500/50 transition-colors',
          // Mobile: full width
          'w-full',
          // Desktop: auto width (can be overridden)
          'md:w-auto',
          // Adjust padding for icons
          leftIcon && 'pl-11',
          rightIcon && 'pr-11',
          className
        )}
      />
      {rightIcon && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          {rightIcon}
        </div>
      )}
    </div>
  );

  if (!label) {
    return (
      <div className={cn('w-full md:w-auto', wrapperClassName)}>
        {inputElement}
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Mobile: stack vertically (label above)
        'flex flex-col gap-2',
        // Desktop: inline layout if not labelAbove
        !labelAbove && 'md:flex-row md:items-center md:gap-4',
        'w-full md:w-auto',
        wrapperClassName
      )}
    >
      <label className="text-sm text-slate-400 whitespace-nowrap">{label}</label>
      {inputElement}
    </div>
  );
}

/**
 * Responsive select wrapper that makes selects full-width on mobile.
 */
export interface ResponsiveSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Additional class names */
  wrapperClassName?: string;
  /** Label text */
  label?: string;
  /** Whether to show label above select on all screen sizes */
  labelAbove?: boolean;
  /** Children (option elements) */
  children: React.ReactNode;
}

export function ResponsiveSelect({
  className,
  wrapperClassName,
  label,
  labelAbove = false,
  children,
  ...props
}: ResponsiveSelectProps) {
  const selectElement = (
    <select
      {...props}
      className={cn(
        // Base styles
        'px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg',
        'text-white',
        'focus:outline-none focus:border-primary-500/50 transition-colors',
        // Mobile: full width
        'w-full',
        // Desktop: auto width (can be overridden)
        'md:w-auto',
        className
      )}
    >
      {children}
    </select>
  );

  if (!label) {
    return (
      <div className={cn('w-full md:w-auto', wrapperClassName)}>
        {selectElement}
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Mobile: stack vertically (label above)
        'flex flex-col gap-2',
        // Desktop: inline layout if not labelAbove
        !labelAbove && 'md:flex-row md:items-center md:gap-4',
        'w-full md:w-auto',
        wrapperClassName
      )}
    >
      <label className="text-sm text-slate-400 whitespace-nowrap">{label}</label>
      {selectElement}
    </div>
  );
}

/**
 * Responsive textarea wrapper that makes textareas full-width on mobile.
 */
export interface ResponsiveTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Additional class names */
  wrapperClassName?: string;
  /** Label text */
  label?: string;
}

export function ResponsiveTextarea({
  className,
  wrapperClassName,
  label,
  ...props
}: ResponsiveTextareaProps) {
  const textareaElement = (
    <textarea
      {...props}
      className={cn(
        // Base styles
        'px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg',
        'text-white placeholder-slate-500',
        'focus:outline-none focus:border-primary-500/50 transition-colors',
        'resize-none',
        // Always full width for textareas
        'w-full',
        className
      )}
    />
  );

  if (!label) {
    return (
      <div className={cn('w-full', wrapperClassName)}>
        {textareaElement}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2 w-full', wrapperClassName)}>
      <label className="text-sm text-slate-400">{label}</label>
      {textareaElement}
    </div>
  );
}


/**
 * Responsive form row that stacks on mobile and displays inline on desktop.
 * Use this to wrap multiple form fields that should be in a row on desktop.
 */
export interface ResponsiveFormRowProps {
  children: React.ReactNode;
  className?: string;
  /** Number of columns on desktop (default: auto based on children count) */
  columns?: 1 | 2 | 3 | 4;
}

export function ResponsiveFormRow({
  children,
  className,
  columns,
}: ResponsiveFormRowProps) {
  const gridCols = columns
    ? {
        1: 'md:grid-cols-1',
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-3',
        4: 'md:grid-cols-4',
      }[columns]
    : 'md:grid-cols-2';

  return (
    <div
      className={cn(
        // Mobile: single column
        'grid grid-cols-1 gap-4',
        // Desktop: specified columns
        gridCols,
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Responsive form field wrapper that positions labels above inputs on mobile.
 * On desktop, labels can be inline or above based on the labelPosition prop.
 */
export interface ResponsiveFormFieldProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
  /** Label position on desktop (default: 'above') */
  labelPosition?: 'above' | 'inline';
  /** Whether the field is required */
  required?: boolean;
  /** Helper text to show below the input */
  helperText?: string;
  /** Error message to show */
  error?: string;
}

export function ResponsiveFormField({
  children,
  label,
  className,
  labelPosition = 'above',
  required = false,
  helperText,
  error,
}: ResponsiveFormFieldProps) {
  return (
    <div
      className={cn(
        // Mobile: always stack vertically
        'flex flex-col gap-2',
        // Desktop: inline if specified
        labelPosition === 'inline' && 'md:flex-row md:items-center md:gap-4',
        className
      )}
    >
      {label && (
        <label className="text-sm text-slate-400 whitespace-nowrap">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="w-full">
        {children}
        {helperText && !error && (
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        )}
        {error && (
          <p className="mt-1 text-xs text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Responsive form section with title and optional description.
 */
export interface ResponsiveFormSectionProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function ResponsiveFormSection({
  children,
  title,
  description,
  icon,
  className,
}: ResponsiveFormSectionProps) {
  return (
    <div
      className={cn(
        'bg-dark-900/80 backdrop-blur rounded-xl border border-dark-800',
        // Mobile: reduced padding
        'p-4',
        // Desktop: more padding
        'md:p-6',
        className
      )}
    >
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {icon}
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm text-slate-400 mt-1">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default {
  Input: ResponsiveInput,
  Select: ResponsiveSelect,
  Textarea: ResponsiveTextarea,
  Row: ResponsiveFormRow,
  Field: ResponsiveFormField,
  Section: ResponsiveFormSection,
};


/**
 * Responsive button that meets touch target requirements on mobile.
 * Minimum 44px height on mobile, full-width on small screens.
 */
export interface ResponsiveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button should be full width */
  fullWidth?: boolean;
  /** Whether the button should be full width only on mobile */
  fullWidthMobile?: boolean;
  /** Icon to show before the text */
  leftIcon?: React.ReactNode;
  /** Icon to show after the text */
  rightIcon?: React.ReactNode;
  /** Loading state */
  loading?: boolean;
}

export function ResponsiveButton({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  fullWidthMobile = true,
  leftIcon,
  rightIcon,
  loading = false,
  disabled,
  children,
  ...props
}: ResponsiveButtonProps) {
  const variantStyles = {
    primary: 'bg-primary-600 hover:bg-primary-500 text-white disabled:bg-primary-600/50',
    secondary: 'bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white disabled:bg-red-600/50',
    ghost: 'bg-transparent hover:bg-dark-800 text-slate-400 hover:text-white',
  };

  const sizeStyles = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-sm',
    lg: 'px-6 py-4 text-base',
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        // Base styles
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        // Touch target: minimum 44px height and width on mobile
        'min-h-[44px] min-w-[44px]',
        // Touch manipulation to prevent double-tap zoom
        'touch-manipulation',
        // Variant styles
        variantStyles[variant],
        // Size styles
        sizeStyles[size],
        // Full width options
        fullWidth && 'w-full',
        fullWidthMobile && !fullWidth && 'w-full md:w-auto',
        // Disabled state
        (disabled || loading) && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

/**
 * Responsive button group that stacks vertically on small screens.
 * On mobile (< 480px), buttons stack vertically.
 * On larger screens, buttons display inline.
 */
export interface ResponsiveButtonGroupProps {
  children: React.ReactNode;
  className?: string;
  /** Alignment of buttons */
  align?: 'left' | 'center' | 'right' | 'between';
  /** Whether to stack on mobile (< 480px) */
  stackOnMobile?: boolean;
}

export function ResponsiveButtonGroup({
  children,
  className,
  align = 'right',
  stackOnMobile = true,
}: ResponsiveButtonGroupProps) {
  const alignStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={cn(
        'flex gap-3',
        // Mobile (< 480px): stack vertically if enabled
        // Uses flex-col-reverse so primary action is at bottom (thumb-friendly)
        stackOnMobile && 'flex-col-reverse xs:flex-row',
        // Desktop: horizontal layout with alignment
        alignStyles[align],
        className
      )}
      data-testid="responsive-button-group"
    >
      {children}
    </div>
  );
}
