/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom color palette
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
        // Telegram-inspired colors
        telegram: {
          blue: '#0088cc',
          'blue-dark': '#006ba6',
          'blue-light': '#40a7e3',
          green: '#00c851',
          red: '#ff3547',
          orange: '#ff8800',
          purple: '#8e44ad',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
        mono: [
          '"SF Mono"',
          'Monaco',
          'Inconsolata',
          '"Roboto Mono"',
          '"Source Code Pro"',
          'Consolas',
          '"Liberation Mono"',
          'Menlo',
          'Courier',
          'monospace',
        ],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'bounce-subtle': 'bounceSubtle 2s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceSubtle: {
          '0%, 100%': {
            transform: 'translateY(-5%)',
            animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)',
          },
          '50%': {
            transform: 'translateY(0)',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
          },
        },
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      screens: {
        'xs': '475px',
        '3xl': '1600px',
      },
    },
  },
  plugins: [
    // Custom plugin for RTL support
    function({ addUtilities, theme }) {
      const newUtilities = {
        '.rtl': {
          direction: 'rtl',
        },
        '.ltr': {
          direction: 'ltr',
        },
        '.text-start': {
          'text-align': 'start',
        },
        '.text-end': {
          'text-align': 'end',
        },
      };

      // Add margin and padding utilities for RTL
      const spacing = theme('spacing');
      Object.keys(spacing).forEach(key => {
        newUtilities[`.ms-${key}`] = {
          'margin-inline-start': spacing[key],
        };
        newUtilities[`.me-${key}`] = {
          'margin-inline-end': spacing[key],
        };
        newUtilities[`.ps-${key}`] = {
          'padding-inline-start': spacing[key],
        };
        newUtilities[`.pe-${key}`] = {
          'padding-inline-end': spacing[key],
        };
      });

      addUtilities(newUtilities);
    },
    
    // Custom plugin for message bubble styles and container components
    function({ addComponents, theme }) {
      addComponents({
        '.message-bubble': {
          maxWidth: theme('maxWidth.xs'),
          padding: `${theme('spacing.2')} ${theme('spacing.4')}`,
          borderRadius: theme('borderRadius.lg'),
          '@screen lg': {
            maxWidth: theme('maxWidth.md'),
          },
        },
        '.message-sent': {
          backgroundColor: theme('colors.blue.600'),
          color: theme('colors.white'),
        },
        '.message-received': {
          backgroundColor: theme('colors.gray.200'),
          color: theme('colors.gray.900'),
          '.dark &': {
            backgroundColor: theme('colors.gray.700'),
            color: theme('colors.white'),
          },
        },
        // Container components - more natural feeling containers
        '.container-main': {
          backgroundColor: theme('colors.white'),
          borderWidth: theme('borderWidth.DEFAULT'),
          borderColor: theme('colors.gray.200'),
          '.dark &': {
            backgroundColor: theme('colors.gray.800'),
            borderColor: theme('colors.gray.700'),
          },
        },
        '.container-section': {
          backgroundColor: theme('colors.white'),
          borderWidth: theme('borderWidth.DEFAULT'),
          borderColor: theme('colors.gray.200'),
          borderRadius: theme('borderRadius.md'),
          '.dark &': {
            backgroundColor: theme('colors.gray.800'),
            borderColor: theme('colors.gray.700'),
          },
        },
        '.container-panel': {
          backgroundColor: theme('colors.gray.50'),
          borderWidth: theme('borderWidth.DEFAULT'),
          borderColor: theme('colors.gray.200'),
          borderRadius: theme('borderRadius.lg'),
          '.dark &': {
            backgroundColor: theme('colors.gray.900'),
            borderColor: theme('colors.gray.700'),
          },
        },
        '.container-elevated': {
          backgroundColor: theme('colors.white'),
          boxShadow: theme('boxShadow.sm'),
          borderWidth: theme('borderWidth.DEFAULT'),
          borderColor: theme('colors.gray.200'),
          borderRadius: theme('borderRadius.lg'),
          '.dark &': {
            backgroundColor: theme('colors.gray.800'),
            borderColor: theme('colors.gray.700'),
          },
        },
        // Layout utilities
        '.layout-constrained': {
          maxWidth: theme('maxWidth.7xl'),
          marginLeft: 'auto',
          marginRight: 'auto',
          paddingLeft: theme('spacing.4'),
          paddingRight: theme('spacing.4'),
          '@screen sm': {
            paddingLeft: theme('spacing.6'),
            paddingRight: theme('spacing.6'),
          },
          '@screen lg': {
            paddingLeft: theme('spacing.8'),
            paddingRight: theme('spacing.8'),
          },
        },
        '.layout-full': {
          width: '100%',
        },
        '.layout-centered': {
          maxWidth: theme('maxWidth.md'),
          marginLeft: 'auto',
          marginRight: 'auto',
        },
        // Resizable sidebar styles
        '.sidebar-resizer': {
          width: theme('spacing.1'),
          backgroundColor: theme('colors.gray.300'),
          cursor: 'col-resize',
          transitionProperty: 'colors',
          transitionTimingFunction: theme('transitionTimingFunction.DEFAULT'),
          transitionDuration: theme('transitionDuration.DEFAULT'),
          flexShrink: '0',
          position: 'relative',
          '&:hover': {
            backgroundColor: theme('colors.blue.500'),
          },
          '&:hover::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '3px',
            height: '20px',
            backgroundColor: 'currentColor',
            borderRadius: '2px',
          },
          '&:active': {
            backgroundColor: theme('colors.blue.500'),
          },
          '.dark &': {
            backgroundColor: theme('colors.gray.600'),
            '&:hover': {
              backgroundColor: theme('colors.blue.400'),
            },
            '&:active': {
              backgroundColor: theme('colors.blue.400'),
            },
          },
        },
      });
    },
  ],
};
