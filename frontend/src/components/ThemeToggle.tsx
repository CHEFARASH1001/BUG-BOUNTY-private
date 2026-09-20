'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Monitor, Snowflake, Check, CloudSnow } from 'lucide-react';
import { clsx } from 'clsx';
import { useTheme } from '@/lib/theme-context';
import { ThemeName, THEME_NAMES } from '@/lib/themes';

/**
 * Theme metadata for display in the toggle dropdown
 */
interface ThemeOption {
  name: ThemeName;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

/**
 * Available theme options with display metadata
 */
const THEME_OPTIONS: ThemeOption[] = [
  {
    name: 'cyberpunk',
    label: 'Cyberpunk',
    icon: Monitor,
    description: 'Default green neon aesthetic',
  },
  {
    name: 'christmas',
    label: 'Christmas',
    icon: Snowflake,
    description: 'Festive red and green theme',
  },
  {
    name: 'snowy',
    label: 'Snowy',
    icon: CloudSnow,
    description: 'Winter wonderland with Santa',
  },
];

/**
 * Props for ThemeToggle component
 */
export interface ThemeToggleProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * ThemeToggle Component
 *
 * Renders a button that opens a dropdown menu for selecting themes.
 * Shows the current theme icon and indicates the active theme in the dropdown.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current theme option for display
  const currentThemeOption = THEME_OPTIONS.find((opt) => opt.name === theme) ?? THEME_OPTIONS[0];
  const CurrentIcon = currentThemeOption.icon;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  /**
   * Handle theme selection
   * Requirements: 2.3
   */
  const handleThemeSelect = (themeName: ThemeName) => {
    setTheme(themeName);
    setIsOpen(false);
  };

  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      {/* Toggle Button - Requirements: 2.1, 2.2 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'p-2 rounded-lg transition-all',
          'text-slate-400 hover:text-white hover:bg-dark-800',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/50',
          isOpen && 'bg-dark-800 text-white'
        )}
        aria-label="Toggle theme"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Palette className="w-5 h-5" />
      </button>

      {/* Dropdown Menu - Requirements: 2.2, 2.4 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={clsx(
              'absolute right-0 top-full mt-2 w-56',
              'bg-dark-900 border border-dark-700 rounded-xl',
              'shadow-xl shadow-black/20 z-50 overflow-hidden'
            )}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-dark-700">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Select Theme
              </p>
            </div>

            {/* Theme Options */}
            <div className="p-1">
              {THEME_OPTIONS.map((option) => {
                const isActive = theme === option.name;
                const Icon = option.icon;

                return (
                  <button
                    key={option.name}
                    onClick={() => handleThemeSelect(option.name)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                      'text-left group',
                      isActive
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'text-slate-400 hover:bg-dark-800 hover:text-white'
                    )}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    {/* Theme Icon */}
                    <div
                      className={clsx(
                        'p-1.5 rounded-md transition-colors',
                        isActive
                          ? 'bg-primary-500/30'
                          : 'bg-dark-700 group-hover:bg-dark-600'
                      )}
                    >
                      <Icon
                        className={clsx(
                          'w-4 h-4',
                          isActive ? 'text-primary-400' : 'text-slate-500 group-hover:text-white'
                        )}
                      />
                    </div>

                    {/* Theme Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={clsx(
                          'text-sm font-medium',
                          isActive ? 'text-primary-400' : 'text-white'
                        )}
                      >
                        {option.label}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {option.description}
                      </p>
                    </div>

                    {/* Active Indicator - Requirements: 2.4 */}
                    {isActive && (
                      <Check className="w-4 h-4 text-primary-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ThemeToggle;
