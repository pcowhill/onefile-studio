import type { Paint } from '../types';
import type { BackgroundRole, ThemeTokens } from './tokens';

/**
 * Maps theme tokens to element props, per element type and style role.
 * The keys returned here are exactly the props that can "follow the theme";
 * everything else (text content, sizes, behaviour…) always belongs to the author.
 */
type Values = Record<string, unknown>;
type Mapper = (t: ThemeTokens, role: string) => Values;

const toneFill = (t: ThemeTokens, i: number): Paint => {
  const [from, to] = t.tones[((i % t.tones.length) + t.tones.length) % t.tones.length];
  return t.gradients ? { kind: 'linear', from, to, angle: 135 } : { kind: 'solid', color: to };
};

export const TEXT_ROLES = ['heading', 'subheading', 'body', 'caption', 'kicker', 'label', 'display', 'displaySub', 'score', 'quote'] as const;

const text: Mapper = (t, role) => {
  const c = t.colors;
  const base = { background: 'transparent', radius: 0 };
  switch (role) {
    case 'heading':
      return { ...base, color: c.text, font: t.fonts.heading, weight: t.weights.heading, letterSpacing: t.tracking.heading };
    case 'subheading':
      return { ...base, color: c.muted, font: t.fonts.heading, weight: Math.min(700, t.weights.heading), letterSpacing: 0 };
    case 'caption':
      return { ...base, color: c.subtle, font: t.fonts.body, weight: t.weights.body, letterSpacing: 0 };
    case 'kicker':
      return { ...base, color: c.accentText, font: t.fonts.label, weight: t.weights.label, letterSpacing: t.tracking.label };
    case 'label':
      return {
        background: c.labelBg,
        radius: t.radius.label,
        color: c.labelText,
        font: t.fonts.label,
        weight: t.weights.label,
        letterSpacing: t.tracking.label,
      };
    case 'display':
      return { ...base, color: c.heroText, font: t.fonts.heading, weight: t.weights.heading, letterSpacing: t.tracking.heading };
    case 'displaySub':
      return { ...base, color: c.heroMuted, font: t.fonts.body, weight: Math.max(t.weights.body, 500), letterSpacing: 0 };
    case 'score':
      return { background: c.accent, radius: Math.round(t.radius.card * 0.75), color: c.onAccent, font: t.fonts.heading, weight: 800, letterSpacing: 0 };
    case 'quote':
      return { ...base, color: c.heroText, font: t.fonts.heading, weight: t.weights.heading, letterSpacing: 0 };
    case 'body':
    default:
      return { ...base, color: c.muted, font: t.fonts.body, weight: t.weights.body, letterSpacing: 0 };
  }
};

const shape: Mapper = (t, role) => {
  const c = t.colors;
  if (role === 'card')
    return { fill: { kind: 'solid', color: c.surface }, stroke: c.border, strokeWidth: t.outlineWidth, radius: t.radius.card, shadow: t.shadows.card };
  if (role === 'soft') return { fill: { kind: 'solid', color: c.accentSoft }, stroke: c.border, strokeWidth: 0, radius: t.radius.card, shadow: 'none' };
  if (role === 'accent')
    return {
      fill: t.gradients ? { kind: 'linear', from: c.accent, to: c.accent2, angle: 135 } : { kind: 'solid', color: c.accent },
      stroke: c.border,
      strokeWidth: 0,
      radius: t.radius.shape,
      shadow: t.shadows.shape,
    };
  if (role === 'line') return { fill: t.progressFill, stroke: c.border, strokeWidth: 0, radius: 6, shadow: 'none' };
  const m = /^tone(\d)$/.exec(role);
  return { fill: toneFill(t, m ? Number(m[1]) : 0), stroke: '#ffffff', strokeWidth: 0, radius: t.radius.shape, shadow: t.shadows.shape };
};

const button: Mapper = (t, role) => {
  const b = t.button;
  if (role === 'secondary')
    return { color: t.colors.accent, variant: b.variant === 'solid' ? 'soft' : 'outline', radius: b.shape, font: b.font, shadow: false };
  if (role === 'hero') return { color: t.colors.heroButton, variant: 'solid', radius: b.shape, font: b.font, shadow: b.shadow };
  if (role === 'heroGhost') return { color: t.colors.heroText, variant: 'ghost', radius: b.shape, font: b.font, shadow: false };
  return { color: t.colors.accent, variant: b.variant, radius: b.shape, font: b.font, shadow: b.shadow };
};

const MAPPERS: Record<string, Mapper> = {
  text,
  shape,
  button,
  navButton: button,
  arrow: (t, role) => ({ color: role === 'muted' ? t.colors.subtle : t.colors.arrow }),
  image: (t) => ({ radius: t.radius.media, shadow: t.shadows.media, borderColor: t.colors.surface }),
  beforeAfter: (t) => ({ radius: t.radius.media, shadow: t.shadows.gallery }),
  gallery: (t) => ({ radius: t.radius.media, shadow: t.shadows.gallery, background: t.colors.mediaBg }),
  scrollText: (t) => ({
    font: t.fonts.body,
    color: t.colors.text,
    background: t.colors.surface,
    accent: t.colors.accentText,
    radius: t.radius.card,
    borderWidth: t.outlineWidth,
    borderColor: t.colors.border,
    shadow: t.shadows.card,
  }),
  progress: (t, role) => ({
    fill: t.progressFill,
    track: role === 'onHero' ? 'rgba(255, 255, 255, 0.2)' : t.colors.progressTrack,
    labelColor: role === 'onHero' ? t.colors.heroText : t.colors.text,
    font: t.fonts.label,
  }),
  video: (t) => ({ radius: t.radius.media, shadow: t.shadows.media, accent: t.colors.accent, background: t.colors.mediaBg, borderColor: t.colors.border }),
  audio: (t) => ({
    font: t.fonts.body,
    accent: t.colors.accent,
    background: t.colors.surface,
    color: t.colors.text,
    borderColor: t.colors.border,
    radius: t.radius.card,
    shadow: t.shadows.card,
  }),
  chart: (t) => ({
    font: t.fonts.body,
    palette: [...t.chart],
    textColor: t.colors.text,
    mutedColor: t.colors.muted,
    gridColor: t.colors.border,
    background: t.colors.surface,
    radius: t.radius.card,
    shadow: t.shadows.card,
  }),
  table: (t) => ({
    font: t.fonts.body,
    textColor: t.colors.text,
    headerBg: t.colors.tableHeaderBg,
    headerText: t.colors.tableHeaderText,
    stripe: t.colors.surfaceAlt,
    borderColor: t.colors.border,
    background: t.colors.surface,
    accent: t.colors.accent,
    radius: t.radius.card,
    shadow: t.shadows.card,
  }),
  countdown: (t) => ({
    font: t.fonts.heading,
    labelFont: t.fonts.label,
    color: t.colors.text,
    accent: t.colors.accentText,
    cardBg: t.colors.ink,
    cardText: t.colors.onInk,
    labelColor: t.colors.muted,
    radius: t.radius.card,
    shadow: t.shadows.card,
  }),
  quiz: (t) => ({
    font: t.fonts.body,
    headingFont: t.fonts.heading,
    color: t.colors.text,
    background: t.colors.surface,
    accent: t.colors.accent,
    choiceBg: t.colors.surfaceAlt,
    borderColor: t.colors.border,
    success: t.colors.success,
    danger: t.colors.danger,
    radius: t.radius.card,
    shadow: t.shadows.card,
  }),
};

/** Default style role for an element type. */
export function defaultRole(type: string): string {
  if (type === 'text') return 'body';
  if (type === 'shape') return 'tone0';
  if (type === 'button' || type === 'navButton') return 'primary';
  return 'default';
}

/** Theme values for an element of `type` with `role` (empty when the type has no themeable props). */
export function themeValues(t: ThemeTokens, type: string, role?: string): Values {
  const m = MAPPERS[type];
  return m ? m(t, role || defaultRole(type)) : {};
}

export function themeableKeys(t: ThemeTokens, type: string, role?: string): string[] {
  return Object.keys(themeValues(t, type, role));
}

export function backgroundPaint(t: ThemeTokens, role: string | undefined): Paint {
  return t.backgrounds[(role as BackgroundRole) in t.backgrounds ? (role as BackgroundRole) : 'base'];
}

/** Roles the inspector offers for a type (with friendly labels). */
export const ROLE_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  text: [
    { value: 'heading', label: 'Heading' },
    { value: 'subheading', label: 'Subheading' },
    { value: 'body', label: 'Paragraph' },
    { value: 'caption', label: 'Caption' },
    { value: 'kicker', label: 'Kicker' },
    { value: 'label', label: 'Label tag' },
    { value: 'display', label: 'Hero title' },
    { value: 'displaySub', label: 'Hero text' },
    { value: 'score', label: 'Badge' },
  ],
  shape: [
    { value: 'tone0', label: 'Colour 1' },
    { value: 'tone1', label: 'Colour 2' },
    { value: 'tone2', label: 'Colour 3' },
    { value: 'tone3', label: 'Colour 4' },
    { value: 'tone4', label: 'Colour 5' },
    { value: 'tone5', label: 'Colour 6' },
    { value: 'accent', label: 'Accent' },
    { value: 'card', label: 'Card' },
    { value: 'soft', label: 'Soft panel' },
  ],
  button: [
    { value: 'primary', label: 'Primary' },
    { value: 'secondary', label: 'Secondary' },
    { value: 'hero', label: 'On dark' },
    { value: 'heroGhost', label: 'Quiet on dark' },
  ],
};
ROLE_OPTIONS.navButton = ROLE_OPTIONS.button;
