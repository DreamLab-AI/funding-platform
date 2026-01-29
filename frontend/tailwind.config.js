/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // GOV.UK Design System inspired colours
        primary: {
          50: '#e6f0f7',
          100: '#cce1ef',
          200: '#99c3df',
          300: '#66a5cf',
          400: '#3387bf',
          500: '#1d70b8', // GOV.UK blue
          600: '#175b94',
          700: '#114470',
          800: '#0b2d4c',
          900: '#051628',
          950: '#020b14',
        },
        secondary: {
          50: '#f0f4f5',
          100: '#dee4e6',
          200: '#bdc9cd',
          300: '#9caeb4',
          400: '#7b939b',
          500: '#505a5f', // GOV.UK grey
          600: '#40484c',
          700: '#303639',
          800: '#202426',
          900: '#101213',
          950: '#080909',
        },
        success: {
          50: '#e6f3ec',
          100: '#cce7d9',
          200: '#99cfb3',
          300: '#66b78d',
          400: '#339f67',
          500: '#00703c', // GOV.UK green
          600: '#005a30',
          700: '#004324',
          800: '#002d18',
          900: '#00160c',
        },
        error: {
          50: '#fbeae7',
          100: '#f7d5cf',
          200: '#efab9f',
          300: '#e7816f',
          400: '#df573f',
          500: '#d4351c', // GOV.UK red
          600: '#aa2b16',
          700: '#7f2011',
          800: '#55150b',
          900: '#2a0b06',
        },
        warning: {
          50: '#fffbe6',
          100: '#fff7cc',
          200: '#ffef99',
          300: '#ffe766',
          400: '#ffdf33',
          500: '#ffdd00', // GOV.UK yellow
          600: '#ccb100',
          700: '#998500',
          800: '#665800',
          900: '#332c00',
        },
        info: {
          50: '#e6f2fa',
          100: '#cce5f5',
          200: '#99cbeb',
          300: '#66b1e1',
          400: '#3397d7',
          500: '#003078', // GOV.UK dark blue
          600: '#002660',
          700: '#001c48',
          800: '#001330',
          900: '#000918',
        },
        focus: '#ffdd00', // GOV.UK focus colour
        link: '#1d70b8',
        'link-hover': '#003078',
        'link-visited': '#4c2c92',
        'link-active': '#0b0c0c',
        border: '#b1b4b6',
        'border-input': '#0b0c0c',
        text: '#0b0c0c',
        'text-secondary': '#505a5f',
      },
      fontFamily: {
        sans: [
          'GDS Transport',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'SF Mono',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
        '34': '8.5rem',
        '38': '9.5rem',
      },
      minHeight: {
        '11': '2.75rem', // 44px - minimum touch target
        '12': '3rem',
        'screen-nav': 'calc(100vh - 4rem)',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      borderWidth: {
        '3': '3px',
        '5': '5px',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'focus': '0 0 0 3px #ffdd00',
        'focus-inset': 'inset 0 0 0 2px #ffdd00',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'elevated': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'modal': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'dropdown': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'inner-sm': 'inset 0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'slide-in-left': 'slideInLeft 0.2s ease-out',
        'slide-in-up': 'slideInUp 0.2s ease-out',
        'slide-in-down': 'slideInDown 0.2s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'scale-out': 'scaleOut 0.15s ease-out',
        'spin-slow': 'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-subtle': 'bounceSubtle 0.5s ease-in-out',
        'shake': 'shake 0.5s ease-in-out',
        'progress': 'progress 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        progress: {
          '0%': { width: '0%' },
          '50%': { width: '70%' },
          '100%': { width: '100%' },
        },
      },
      transitionDuration: {
        '0': '0ms',
        '50': '50ms',
        '250': '250ms',
        '350': '350ms',
        '400': '400ms',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
        'toast': '1080',
        'max': '9999',
      },
      gridTemplateColumns: {
        'auto-fill-sm': 'repeat(auto-fill, minmax(200px, 1fr))',
        'auto-fill-md': 'repeat(auto-fill, minmax(280px, 1fr))',
        'auto-fill-lg': 'repeat(auto-fill, minmax(360px, 1fr))',
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#0b0c0c',
            a: {
              color: '#1d70b8',
              '&:hover': {
                color: '#003078',
              },
            },
            h1: {
              color: '#0b0c0c',
            },
            h2: {
              color: '#0b0c0c',
            },
            h3: {
              color: '#0b0c0c',
            },
            h4: {
              color: '#0b0c0c',
            },
            strong: {
              color: '#0b0c0c',
            },
          },
        },
      },
    },
  },
  plugins: [
    // Custom plugin for focus-visible styling
    function({ addUtilities, addComponents, theme }) {
      addUtilities({
        '.focus-ring': {
          outline: 'none',
          '&:focus-visible': {
            outline: `3px solid ${theme('colors.focus')}`,
            outlineOffset: '0',
            boxShadow: `0 0 0 3px ${theme('colors.focus')}`,
          },
        },
        '.focus-ring-inset': {
          outline: 'none',
          '&:focus-visible': {
            outline: `3px solid ${theme('colors.focus')}`,
            outlineOffset: '-3px',
          },
        },
        '.touch-target': {
          minHeight: '44px',
          minWidth: '44px',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: theme('colors.gray.100'),
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: theme('colors.gray.300'),
            borderRadius: '3px',
            '&:hover': {
              backgroundColor: theme('colors.gray.400'),
            },
          },
        },
      });

      addComponents({
        '.btn-base': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme('spacing.2'),
          padding: `${theme('spacing.2')} ${theme('spacing.4')}`,
          fontWeight: theme('fontWeight.medium'),
          fontSize: theme('fontSize.sm'),
          lineHeight: theme('lineHeight.5'),
          borderRadius: theme('borderRadius.md'),
          minHeight: '44px',
          transition: 'all 150ms ease',
          '&:focus-visible': {
            outline: `3px solid ${theme('colors.focus')}`,
            outlineOffset: '0',
          },
          '&:disabled': {
            opacity: '0.5',
            cursor: 'not-allowed',
          },
        },
        '.card-base': {
          backgroundColor: theme('colors.white'),
          borderRadius: theme('borderRadius.lg'),
          border: `1px solid ${theme('colors.gray.200')}`,
          boxShadow: theme('boxShadow.card'),
        },
        '.input-base': {
          display: 'block',
          width: '100%',
          padding: `${theme('spacing.2')} ${theme('spacing.3')}`,
          fontSize: theme('fontSize.base'),
          lineHeight: theme('lineHeight.normal'),
          color: theme('colors.gray.900'),
          backgroundColor: theme('colors.white'),
          border: `2px solid ${theme('colors.gray.300')}`,
          borderRadius: theme('borderRadius.md'),
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
          '&:focus': {
            outline: 'none',
            borderColor: theme('colors.primary.500'),
            boxShadow: `0 0 0 3px ${theme('colors.focus')}`,
          },
          '&:disabled': {
            backgroundColor: theme('colors.gray.100'),
            cursor: 'not-allowed',
          },
        },
      });
    },
  ],
}
