import type { Paint, SlideTransition, ThemeId } from '../types';

/**
 * Design tokens for one project theme. Themes style the experience being
 * authored (never the editor itself). Element-specific values are derived
 * from these tokens in `mappers.ts`, so adding a component never requires a
 * copy of every theme.
 */
export interface ThemeTokens {
  id: ThemeId;
  label: string;
  tagline: string;
  colors: {
    /** Letterbox around slides. */
    backdropSlides: string;
    /** Page edge colour behind webpages. */
    backdropPage: string;
    bg: string;
    bgAlt: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    muted: string;
    subtle: string;
    accent: string;
    /** Accent that reads well as text on `bg`. */
    accentText: string;
    accent2: string;
    accentSoft: string;
    onAccent: string;
    border: string;
    success: string;
    danger: string;
    /** Strong surface (count-down cards, table headers in some themes). */
    ink: string;
    onInk: string;
    heroText: string;
    heroMuted: string;
    /** Button colour on hero / dark backgrounds. */
    heroButton: string;
    labelText: string;
    labelBg: string;
    arrow: string;
    mediaBg: string;
    progressTrack: string;
    tableHeaderBg: string;
    tableHeaderText: string;
  };
  backgrounds: Record<BackgroundRole, Paint>;
  /** Decorative fills for shapes (from → to). */
  tones: Array<[string, string]>;
  /** Series colours for charts. */
  chart: string[];
  progressFill: Paint;
  /** Shapes use gradients (true) or the solid tone (false). */
  gradients: boolean;
  fonts: { heading: string; body: string; label: string };
  weights: { heading: number; body: number; label: number };
  tracking: { heading: number; label: number };
  radius: { card: number; media: number; shape: number; label: number };
  shadows: { card: string; media: string; shape: string; gallery: string };
  button: { variant: 'solid' | 'soft' | 'outline' | 'ghost'; shape: 'pill' | 'rounded' | 'square'; shadow: boolean; font: string };
  outlineWidth: number;
  transition: SlideTransition;
}

export type BackgroundRole = 'base' | 'alt' | 'hero' | 'dark' | 'accent';
export const BACKGROUND_ROLES: BackgroundRole[] = ['base', 'alt', 'hero', 'dark', 'accent'];

const solid = (color: string): Paint => ({ kind: 'solid', color });
const linear = (from: string, to: string, angle = 135): Paint => ({ kind: 'linear', from, to, angle });

/**
 * Playful — the original OneFile Studio look. Its values equal the element
 * defaults of v0.1, so older projects (migrated to this theme) and new
 * playful projects look the same.
 */
const playful: ThemeTokens = {
  id: 'playful',
  label: 'Playful',
  tagline: 'Cheerful colours, round shapes and friendly type',
  colors: {
    backdropSlides: '#1b1834',
    backdropPage: '#ffffff',
    bg: '#ffffff',
    bgAlt: '#fbfaff',
    surface: '#ffffff',
    surfaceAlt: '#f3f0ff',
    text: '#1d1b2c',
    muted: '#4b4766',
    subtle: '#8a86a3',
    accent: '#6d4aff',
    accentText: '#6d4aff',
    accent2: '#ff7eb3',
    accentSoft: '#efeaff',
    onAccent: '#ffffff',
    border: '#e4e0f5',
    success: '#00b894',
    danger: '#ff5d73',
    ink: '#6d4aff',
    onInk: '#ffffff',
    heroText: '#ffffff',
    heroMuted: '#e9e2ff',
    heroButton: '#ffd23f',
    labelText: '#d63384',
    labelBg: '#ffe3f1',
    arrow: '#ff5d73',
    mediaBg: '#1d1b2c',
    progressTrack: 'rgba(109, 74, 255, 0.14)',
    tableHeaderBg: '#6d4aff',
    tableHeaderText: '#ffffff',
  },
  backgrounds: {
    base: solid('#ffffff'),
    alt: solid('#fbfaff'),
    hero: linear('#6d4aff', '#b06bff', 135),
    dark: linear('#1b1834', '#3a2a7a', 160),
    accent: linear('#6d4aff', '#ff7eb3', 135),
  },
  tones: [
    ['#8b6cff', '#5b3df5'],
    ['#ffb86c', '#ff6b6b'],
    ['#ffe66d', '#ffb100'],
    ['#ff9ac1', '#ff4d8d'],
    ['#7ef0c1', '#14b8a6'],
    ['#9be7ff', '#3d8bff'],
  ],
  chart: ['#6d4aff', '#ff7eb3', '#ffb100', '#00b894', '#3d8bff', '#ff6b6b'],
  progressFill: linear('#ff7eb3', '#6d4aff', 90),
  gradients: true,
  fonts: { heading: 'rounded', body: 'rounded', label: 'rounded' },
  weights: { heading: 800, body: 500, label: 800 },
  tracking: { heading: -0.02, label: 0.08 },
  radius: { card: 24, media: 16, shape: 28, label: 999 },
  shadows: { card: 'soft', media: 'soft', shape: 'soft', gallery: 'lifted' },
  button: { variant: 'solid', shape: 'pill', shadow: true, font: 'rounded' },
  outlineWidth: 0,
  transition: 'fade',
};

/** Professional — restrained, clean and meeting-ready. */
const professional: ThemeTokens = {
  id: 'professional',
  label: 'Professional',
  tagline: 'Clean, restrained and ready for the meeting room',
  colors: {
    backdropSlides: '#0f172a',
    backdropPage: '#f1f5f9',
    bg: '#ffffff',
    bgAlt: '#f6f8fb',
    surface: '#ffffff',
    surfaceAlt: '#f1f5f9',
    text: '#0f172a',
    muted: '#475569',
    subtle: '#94a3b8',
    accent: '#2563eb',
    accentText: '#1d4ed8',
    accent2: '#0ea5e9',
    accentSoft: '#e8effd',
    onAccent: '#ffffff',
    border: '#e2e8f0',
    success: '#16a34a',
    danger: '#dc2626',
    ink: '#0f172a',
    onInk: '#ffffff',
    heroText: '#ffffff',
    heroMuted: '#cbd5e1',
    heroButton: '#ffffff',
    labelText: '#1d4ed8',
    labelBg: '#e8effd',
    arrow: '#2563eb',
    mediaBg: '#0f172a',
    progressTrack: '#e2e8f0',
    tableHeaderBg: '#f1f5f9',
    tableHeaderText: '#0f172a',
  },
  backgrounds: {
    base: solid('#ffffff'),
    alt: solid('#f6f8fb'),
    hero: linear('#0b1f44', '#1e3a8a', 135),
    dark: solid('#0f172a'),
    accent: linear('#1d4ed8', '#0ea5e9', 135),
  },
  tones: [
    ['#3b82f6', '#2563eb'],
    ['#64748b', '#475569'],
    ['#38bdf8', '#0284c7'],
    ['#cbd5e1', '#94a3b8'],
    ['#2dd4bf', '#0d9488'],
    ['#818cf8', '#4f46e5'],
  ],
  chart: ['#2563eb', '#0ea5e9', '#14b8a6', '#f59e0b', '#6366f1', '#94a3b8'],
  progressFill: solid('#2563eb'),
  gradients: false,
  fonts: { heading: 'modern', body: 'modern', label: 'modern' },
  weights: { heading: 700, body: 400, label: 600 },
  tracking: { heading: -0.02, label: 0.06 },
  radius: { card: 12, media: 8, shape: 12, label: 6 },
  shadows: { card: 'subtle', media: 'subtle', shape: 'none', gallery: 'subtle' },
  button: { variant: 'solid', shape: 'rounded', shadow: false, font: 'modern' },
  outlineWidth: 1,
  transition: 'fade',
};

/** Technical — dark, high-contrast, cool accents for diagrams and dashboards. */
const technical: ThemeTokens = {
  id: 'technical',
  label: 'Technical',
  tagline: 'Dark, crisp and precise for diagrams and dashboards',
  colors: {
    backdropSlides: '#03060c',
    backdropPage: '#060a12',
    bg: '#0b1220',
    bgAlt: '#0e1728',
    surface: '#111b2e',
    surfaceAlt: '#16233a',
    text: '#e6edf7',
    muted: '#9fb0c8',
    subtle: '#64779a',
    accent: '#22d3ee',
    accentText: '#22d3ee',
    accent2: '#818cf8',
    accentSoft: 'rgba(34, 211, 238, 0.12)',
    onAccent: '#04121a',
    border: '#22385a',
    success: '#34d399',
    danger: '#f87171',
    ink: '#0f1a2c',
    onInk: '#22d3ee',
    heroText: '#f1f7ff',
    heroMuted: '#9fb0c8',
    heroButton: '#22d3ee',
    labelText: '#22d3ee',
    labelBg: 'rgba(34, 211, 238, 0.12)',
    arrow: '#22d3ee',
    mediaBg: '#05080f',
    progressTrack: 'rgba(148, 163, 184, 0.18)',
    tableHeaderBg: '#16233a',
    tableHeaderText: '#22d3ee',
  },
  backgrounds: {
    base: solid('#0b1220'),
    alt: solid('#0e1728'),
    hero: linear('#0b1220', '#0d2a3f', 160),
    dark: solid('#060a12'),
    accent: linear('#0e7490', '#4338ca', 135),
  },
  tones: [
    ['#22d3ee', '#0891b2'],
    ['#818cf8', '#4f46e5'],
    ['#2dd4bf', '#0d9488'],
    ['#38bdf8', '#2563eb'],
    ['#34d399', '#059669'],
    ['#94a3b8', '#475569'],
  ],
  chart: ['#22d3ee', '#818cf8', '#34d399', '#fbbf24', '#f472b6', '#60a5fa'],
  progressFill: linear('#22d3ee', '#818cf8', 90),
  gradients: true,
  fonts: { heading: 'grotesk', body: 'modern', label: 'mono' },
  weights: { heading: 700, body: 400, label: 600 },
  tracking: { heading: -0.01, label: 0.12 },
  radius: { card: 8, media: 6, shape: 8, label: 4 },
  shadows: { card: 'glow', media: 'glow', shape: 'none', gallery: 'glow' },
  button: { variant: 'solid', shape: 'square', shadow: false, font: 'grotesk' },
  outlineWidth: 1,
  transition: 'fade',
};

/** Editorial — warm, elegant and expressive for stories and invitations. */
const editorial: ThemeTokens = {
  id: 'editorial',
  label: 'Editorial',
  tagline: 'Warm paper tones and elegant type for stories',
  colors: {
    backdropSlides: '#231c19',
    backdropPage: '#efe6da',
    bg: '#fbf7f1',
    bgAlt: '#f4ece1',
    surface: '#fffdf9',
    surfaceAlt: '#f3eadf',
    text: '#2b2320',
    muted: '#6b5d52',
    subtle: '#a3948a',
    accent: '#b5532c',
    accentText: '#a64a25',
    accent2: '#d99a3d',
    accentSoft: '#f6e3d6',
    onAccent: '#ffffff',
    border: '#e6dacb',
    success: '#4b7f52',
    danger: '#b23a2e',
    ink: '#2b2320',
    onInk: '#fff8f0',
    heroText: '#fff8f0',
    heroMuted: '#f0d9c6',
    heroButton: '#f2c38b',
    labelText: '#a64a25',
    labelBg: '#f6e3d6',
    arrow: '#b5532c',
    mediaBg: '#2b2320',
    progressTrack: '#eadfd1',
    tableHeaderBg: '#2b2320',
    tableHeaderText: '#fff8f0',
  },
  backgrounds: {
    base: linear('#fcf9f4', '#f6eee3', 180),
    alt: solid('#f4ece1'),
    hero: linear('#3b2a24', '#7a3e26', 155),
    dark: solid('#2b2320'),
    accent: linear('#d99a3d', '#b5532c', 135),
  },
  tones: [
    ['#e9a17a', '#b5532c'],
    ['#f2d39b', '#d99a3d'],
    ['#b7c9a8', '#6f8f5c'],
    ['#e7b7b0', '#c0645a'],
    ['#c8b6d6', '#7e6a96'],
    ['#d8c8b6', '#8c7462'],
  ],
  chart: ['#b5532c', '#d99a3d', '#6f8f5c', '#7e6a96', '#c0645a', '#8c7462'],
  progressFill: linear('#d99a3d', '#b5532c', 90),
  gradients: true,
  fonts: { heading: 'elegant', body: 'elegant', label: 'modern' },
  weights: { heading: 600, body: 400, label: 600 },
  tracking: { heading: -0.015, label: 0.16 },
  radius: { card: 18, media: 14, shape: 20, label: 999 },
  shadows: { card: 'soft', media: 'soft', shape: 'none', gallery: 'soft' },
  button: { variant: 'solid', shape: 'pill', shadow: false, font: 'modern' },
  outlineWidth: 0,
  transition: 'fade',
};

export const THEMES: Record<ThemeId, ThemeTokens> = { playful, professional, technical, editorial };
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = 'playful';

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && v in THEMES;
}

export function getTheme(id: unknown): ThemeTokens {
  return isThemeId(id) ? THEMES[id] : THEMES[DEFAULT_THEME];
}
