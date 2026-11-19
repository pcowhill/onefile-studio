import type { Paint } from './types';

export function paintToCss(p: Paint | undefined | null): string {
  if (!p) return 'transparent';
  if (p.kind === 'linear') return `linear-gradient(${Number(p.angle) || 0}deg, ${p.from}, ${p.to})`;
  return p.color;
}

export const solid = (color: string): Paint => ({ kind: 'solid', color });
export const linear = (from: string, to: string, angle = 135): Paint => ({ kind: 'linear', from, to, angle });

/** First colour of a paint (useful for strokes/handles). */
export function paintPrimary(p: Paint): string {
  return p.kind === 'solid' ? p.color : p.from;
}

/** Accepts the colour syntaxes we emit; rejects anything that could escape a CSS value. */
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg]+\)|transparent|currentColor|[a-zA-Z]{3,20})$/;
export function isSafeColor(v: unknown): v is string {
  return typeof v === 'string' && v.length < 64 && COLOR_RE.test(v.trim());
}

/** Returns black or white text colour for legible contrast on `bg`. */
export function contrastText(bg: string): string {
  const rgb = parseHex(bg);
  if (!rgb) return '#ffffff';
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? '#1d1b2c' : '#ffffff';
}

export function parseHex(c: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Mixes a hex colour with white (amount > 0) or black (amount < 0). */
export function shade(c: string, amount: number): string {
  const rgb = parseHex(c);
  if (!rgb) return c;
  const t = amount < 0 ? 0 : 255;
  const a = Math.abs(amount);
  const out = rgb.map((v) => Math.round(v + (t - v) * a));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function withAlpha(c: string, alpha: number): string {
  const rgb = parseHex(c);
  if (!rgb) return c;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
