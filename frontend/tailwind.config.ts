import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      'xs': '480px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Theme-aware primary colors using CSS variables
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: 'var(--accent-primary)',
          500: 'var(--accent-primary)',
          600: 'var(--accent-primary-hover)',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Theme-aware accent colors using CSS variables
        accent: {
          cyan: 'var(--accent-secondary)',
          purple: 'var(--accent-tertiary)',
          pink: 'var(--accent-quaternary)',
          orange: '#f97316',
        },
        // Theme-aware dark colors using CSS variables
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: 'var(--border-primary)',
          800: 'var(--bg-hover)',
          900: 'var(--bg-card)',
          950: 'var(--bg-primary)',
        },
      },
      fontFamily: {
        // iOS-style system font stack
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Helvetica Neue', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        // iOS-style subtle gradients
        'ios-card': 'linear-gradient(180deg, var(--bg-card) 0%, color-mix(in srgb, var(--bg-card) 95%, var(--bg-primary)) 100%)',
        'ios-button': 'linear-gradient(180deg, color-mix(in srgb, var(--accent-primary) 100%, white 10%) 0%, var(--accent-primary) 100%)',
      },
      borderRadius: {
        // iOS-style rounded corners
        'ios': '12px',
        'ios-lg': '16px',
        'ios-xl': '20px',
        'ios-2xl': '24px',
        'ios-full': '9999px',
      },
      boxShadow: {
        // iOS-style shadows
        'ios-sm': '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)',
        'ios': '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)',
        'ios-md': '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
        'ios-lg': '0 8px 24px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.1)',
        'ios-xl': '0 12px 40px rgba(0, 0, 0, 0.25), 0 6px 12px rgba(0, 0, 0, 0.1)',
        'ios-inner': 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
        'ios-glow': '0 0 20px color-mix(in srgb, var(--accent-primary) 30%, transparent)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scan 2s ease-in-out infinite',
        // Mobile-optimized animations with shorter durations
        'pulse-slow-mobile': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in-fast': 'fadeIn 0.15s ease-out forwards',
        'slide-in-fast': 'slideIn 0.2s ease-out forwards',
        // iOS-style spring animations
        'ios-bounce': 'iosBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'ios-scale': 'iosScale 0.2s ease-out',
        'ios-slide-up': 'iosSlideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        'ios-slide-down': 'iosSlideDown 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px var(--glow-color), 0 0 10px var(--glow-color), 0 0 15px var(--glow-color)' },
          '100%': { boxShadow: '0 0 10px var(--glow-color), 0 0 20px var(--glow-color), 0 0 30px var(--glow-color)' },
        },
        scan: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // iOS-style keyframes
        iosBounce: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '50%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        iosScale: {
          '0%': { transform: 'scale(0.97)' },
          '100%': { transform: 'scale(1)' },
        },
        iosSlideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        iosSlideDown: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
      },
      // Transition duration utilities for mobile optimization
      transitionDuration: {
        'fast': '150ms',
        'mobile': '150ms',
        'ios': '350ms',
      },
      // iOS-style transition timing
      transitionTimingFunction: {
        'ios': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'ios-spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
      // iOS-style backdrop blur
      backdropBlur: {
        'ios': '20px',
        'ios-heavy': '40px',
      },
    },
  },
  plugins: [],
};

export default config;

