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
        sans: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scan 2s ease-in-out infinite',
        // Mobile-optimized animations with shorter durations
        'pulse-slow-mobile': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in-fast': 'fadeIn 0.15s ease-out forwards',
        'slide-in-fast': 'slideIn 0.2s ease-out forwards',
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
      },
      // Transition duration utilities for mobile optimization
      transitionDuration: {
        'fast': '150ms',
        'mobile': '150ms',
      },
    },
  },
  plugins: [],
};

export default config;

