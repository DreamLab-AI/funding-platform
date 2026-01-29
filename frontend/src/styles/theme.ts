// =============================================================================
// Theme Configuration - Funding Application Platform
// =============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';

// -----------------------------------------------------------------------------
// Color Palette Types
// -----------------------------------------------------------------------------

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

export interface SemanticColors {
  primary: ColorScale;
  secondary: ColorScale;
  success: ColorScale;
  error: ColorScale;
  warning: ColorScale;
  info: ColorScale;
}

export interface TextColors {
  primary: string;
  secondary: string;
  tertiary: string;
  disabled: string;
  inverse: string;
  link: string;
  linkHover: string;
  linkVisited: string;
}

export interface BackgroundColors {
  primary: string;
  secondary: string;
  tertiary: string;
  elevated: string;
  overlay: string;
}

export interface BorderColors {
  primary: string;
  secondary: string;
  focus: string;
  error: string;
  success: string;
}

// -----------------------------------------------------------------------------
// Theme Definition
// -----------------------------------------------------------------------------

export interface Theme {
  name: ThemeMode;
  colors: SemanticColors;
  text: TextColors;
  background: BackgroundColors;
  border: BorderColors;
  focus: {
    color: string;
    textColor: string;
    ringWidth: string;
    ringOffset: string;
  };
}

// -----------------------------------------------------------------------------
// Light Theme
// -----------------------------------------------------------------------------

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    primary: {
      50: '#e8f1f8',
      100: '#c5ddef',
      200: '#9fc7e4',
      300: '#78b0d9',
      400: '#5a9fd1',
      500: '#1d70b8',
      600: '#1a65a6',
      700: '#155490',
      800: '#104478',
      900: '#0b2e52',
    },
    secondary: {
      50: '#f8f9fa',
      100: '#f1f3f5',
      200: '#e9ecef',
      300: '#dee2e6',
      400: '#ced4da',
      500: '#505a5f',
      600: '#40484c',
      700: '#303639',
      800: '#212529',
      900: '#0b0c0c',
    },
    success: {
      50: '#e6f4eb',
      100: '#c0e4cc',
      200: '#96d4ab',
      300: '#6bc48a',
      400: '#4bb871',
      500: '#00703c',
      600: '#006435',
      700: '#00552d',
      800: '#004624',
      900: '#002e17',
    },
    error: {
      50: '#fbe9e7',
      100: '#f5c8c2',
      200: '#eea39a',
      300: '#e77e71',
      400: '#e26252',
      500: '#d4351c',
      600: '#bf3019',
      700: '#a52915',
      800: '#8b2311',
      900: '#611809',
    },
    warning: {
      50: '#fff9e6',
      100: '#fff0bf',
      200: '#ffe794',
      300: '#ffdd69',
      400: '#ffd548',
      500: '#ffdd00',
      600: '#f0d100',
      700: '#dcc000',
      800: '#c4ab00',
      900: '#9e8a00',
    },
    info: {
      50: '#e6f3fa',
      100: '#c0e1f2',
      200: '#96cde9',
      300: '#6bb9e0',
      400: '#4ca9da',
      500: '#2e8aca',
      600: '#267bb8',
      700: '#1e68a0',
      800: '#175588',
      900: '#0d3a5c',
    },
  },
  text: {
    primary: '#0b0c0c',
    secondary: '#505a5f',
    tertiary: '#6f777b',
    disabled: '#b1b4b6',
    inverse: '#ffffff',
    link: '#1d70b8',
    linkHover: '#003078',
    linkVisited: '#4c2c92',
  },
  background: {
    primary: '#ffffff',
    secondary: '#f8f9fa',
    tertiary: '#f1f3f5',
    elevated: '#ffffff',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  border: {
    primary: '#b1b4b6',
    secondary: '#dee2e6',
    focus: '#0b0c0c',
    error: '#d4351c',
    success: '#00703c',
  },
  focus: {
    color: '#ffdd00',
    textColor: '#0b0c0c',
    ringWidth: '3px',
    ringOffset: '0px',
  },
};

// -----------------------------------------------------------------------------
// Dark Theme
// -----------------------------------------------------------------------------

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    ...lightTheme.colors,
    primary: {
      ...lightTheme.colors.primary,
      500: '#4d9de0',
      600: '#3a8ed4',
    },
  },
  text: {
    primary: '#f8f9fa',
    secondary: '#b1b4b6',
    tertiary: '#8e9196',
    disabled: '#505a5f',
    inverse: '#0b0c0c',
    link: '#73b8ff',
    linkHover: '#a3d0ff',
    linkVisited: '#b794f6',
  },
  background: {
    primary: '#1a1a2e',
    secondary: '#16213e',
    tertiary: '#0f0f23',
    elevated: '#1f1f3d',
    overlay: 'rgba(0, 0, 0, 0.75)',
  },
  border: {
    primary: '#3d3d5c',
    secondary: '#2d2d4a',
    focus: '#ffdd00',
    error: '#ff6b6b',
    success: '#51cf66',
  },
  focus: {
    color: '#ffdd00',
    textColor: '#0b0c0c',
    ringWidth: '3px',
    ringOffset: '0px',
  },
};

// -----------------------------------------------------------------------------
// Theme Utilities
// -----------------------------------------------------------------------------

export const getTheme = (mode: ThemeMode): Theme => {
  if (mode === 'dark') return darkTheme;
  if (mode === 'light') return lightTheme;

  // System preference
  if (typeof window !== 'undefined') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? darkTheme : lightTheme;
  }

  return lightTheme;
};

export const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

// -----------------------------------------------------------------------------
// CSS Custom Properties Generator
// -----------------------------------------------------------------------------

export const generateCSSVariables = (theme: Theme): Record<string, string> => {
  const variables: Record<string, string> = {};

  // Color scales
  Object.entries(theme.colors).forEach(([colorName, scale]) => {
    Object.entries(scale).forEach(([shade, value]) => {
      variables[`--color-${colorName}-${shade}`] = value;
    });
  });

  // Text colors
  Object.entries(theme.text).forEach(([key, value]) => {
    const kebabKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    variables[`--color-text-${kebabKey}`] = value;
  });

  // Background colors
  Object.entries(theme.background).forEach(([key, value]) => {
    variables[`--color-bg-${key}`] = value;
  });

  // Border colors
  Object.entries(theme.border).forEach(([key, value]) => {
    variables[`--color-border-${key}`] = value;
  });

  // Focus
  variables['--color-focus'] = theme.focus.color;
  variables['--color-focus-text'] = theme.focus.textColor;
  variables['--focus-ring-width'] = theme.focus.ringWidth;
  variables['--focus-ring-offset'] = theme.focus.ringOffset;

  return variables;
};

// -----------------------------------------------------------------------------
// Application Status Colors (for badges/indicators)
// -----------------------------------------------------------------------------

export const statusColors = {
  draft: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
    dot: 'bg-gray-400',
  },
  submitted: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
    dot: 'bg-blue-500',
  },
  under_review: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    dot: 'bg-yellow-500',
  },
  assessed: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
    dot: 'bg-green-500',
  },
  withdrawn: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
    dot: 'bg-red-500',
  },
  open: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
    dot: 'bg-green-500',
  },
  closed: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
    dot: 'bg-gray-500',
  },
  in_assessment: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-300',
    dot: 'bg-purple-500',
  },
  completed: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
    dot: 'bg-green-500',
  },
  archived: {
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    border: 'border-gray-200',
    dot: 'bg-gray-400',
  },
  pending: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-300',
    dot: 'bg-orange-500',
  },
  in_progress: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
    dot: 'bg-blue-500',
  },
  returned: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
  },
} as const;

export type StatusKey = keyof typeof statusColors;

// -----------------------------------------------------------------------------
// Breakpoints
// -----------------------------------------------------------------------------

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// -----------------------------------------------------------------------------
// Spacing Scale
// -----------------------------------------------------------------------------

export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  9: '2.25rem',
  10: '2.5rem',
  11: '2.75rem',
  12: '3rem',
  14: '3.5rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  28: '7rem',
  32: '8rem',
  36: '9rem',
  40: '10rem',
  44: '11rem',
  48: '12rem',
  52: '13rem',
  56: '14rem',
  60: '15rem',
  64: '16rem',
  72: '18rem',
  80: '20rem',
  96: '24rem',
} as const;

// -----------------------------------------------------------------------------
// Typography
// -----------------------------------------------------------------------------

export const typography = {
  fontFamily: {
    sans: "'GDS Transport', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    mono: "'Fira Code', 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace",
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    '5xl': ['3rem', { lineHeight: '1' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// -----------------------------------------------------------------------------
// Shadows
// -----------------------------------------------------------------------------

export const shadows = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  focus: '0 0 0 3px #ffdd00',
  card: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
  cardHover: '0 4px 12px 0 rgb(0 0 0 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.08)',
} as const;

// -----------------------------------------------------------------------------
// Z-Index Scale
// -----------------------------------------------------------------------------

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

// -----------------------------------------------------------------------------
// Animation Durations
// -----------------------------------------------------------------------------

export const durations = {
  instant: '0ms',
  fast: '100ms',
  normal: '150ms',
  moderate: '200ms',
  slow: '300ms',
  slower: '400ms',
  slowest: '500ms',
} as const;

// -----------------------------------------------------------------------------
// Easing Functions
// -----------------------------------------------------------------------------

export const easings = {
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

export default {
  lightTheme,
  darkTheme,
  getTheme,
  getSystemTheme,
  generateCSSVariables,
  statusColors,
  breakpoints,
  spacing,
  typography,
  shadows,
  zIndex,
  durations,
  easings,
};
