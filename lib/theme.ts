import type { ColorMode, ThemeKey } from './types';

export interface ThemeDefinition {
  key: ThemeKey;
  label: string;
  description: string;
  light: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
  };
  dark: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
  };
}

export const STATUS_COLORS = {
  success: '#15803D',
  warning: '#B45309',
  danger: '#B91C1C',
  info: '#1D4ED8',
} as const;

export const THEMES: Record<ThemeKey, ThemeDefinition> = {
  'clinical-calm': {
    key: 'clinical-calm',
    label: 'Clinical Calm',
    description: 'Deep teal and cool off-white designed for clear readability across long shifts.',
    light: {
      primary: '#0F766E',
      secondary: '#0EA5E9',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      muted: '#475569',
    },
    dark: {
      primary: '#2DD4BF',
      secondary: '#38BDF8',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F1F5F9',
      muted: '#94A3B8',
    },
  },
  'warm-care': {
    key: 'warm-care',
    label: 'Warm Care',
    description: 'Warm burnt orange and soft cream suited to bedside tablets and resident rooms.',
    light: {
      primary: '#C2410C',
      secondary: '#475569',
      background: '#FFF7ED',
      surface: '#FFFFFF',
      text: '#0F172A',
      muted: '#475569',
    },
    dark: {
      primary: '#FB923C',
      secondary: '#94A3B8',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F1F5F9',
      muted: '#94A3B8',
    },
  },
  'modern-indigo': {
    key: 'modern-indigo',
    label: 'Modern Indigo',
    description: 'Crisp indigo with teal accents for high-density clinical oversight and charts.',
    light: {
      primary: '#4338CA',
      secondary: '#14B8A6',
      background: '#EEF2FF',
      surface: '#FFFFFF',
      text: '#0F172A',
      muted: '#475569',
    },
    dark: {
      primary: '#818CF8',
      secondary: '#2DD4BF',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F1F5F9',
      muted: '#94A3B8',
    },
  },
};

export const THEME_KEYS: ThemeKey[] = ['clinical-calm', 'warm-care', 'modern-indigo'];
export const COLOR_MODES: ColorMode[] = ['light', 'dark', 'system'];

export const THEME_OPTIONS = THEME_KEYS.map((key) => ({
  key,
  label: THEMES[key].label,
  description: THEMES[key].description,
  swatch: THEMES[key].light.primary,
}));

export const COLOR_MODE_OPTIONS: { key: ColorMode; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];

export function isValidThemeKey(value: string): value is ThemeKey {
  return THEME_KEYS.includes(value as ThemeKey);
}

export function isValidColorMode(value: string): value is ColorMode {
  return COLOR_MODES.includes(value as ColorMode);
}
