import type { Background, Page, Project, SceneElement, ThemeId } from '../types';
import { contrastText, parseHex } from '../paint';
import { backgroundPaint, defaultRole, themeValues } from './mappers';
import { getTheme } from './tokens';
import type { ThemeTokens } from './tokens';

/**
 * Theme provenance model
 * ----------------------
 * Elements store fully resolved props (so the runtime and every exported file
 * stay theme-agnostic and never change appearance on their own). Provenance is
 * recorded separately in `element.themed`: the list of prop keys that follow
 * the theme. When the theme changes, only those keys are rewritten. Editing a
 * prop in the inspector removes its key from the list (it becomes an explicit
 * author choice). "Reset to theme" puts keys back.
 *
 * Projects from schema v1 have no provenance, so after migration every value
 * is treated as explicit: they keep their exact appearance until the author
 * chooses to restyle them with a theme.
 */

const clone = <T>(v: T): T => (typeof v === 'object' && v !== null ? (JSON.parse(JSON.stringify(v)) as T) : v);

/** Writes the theme's values for every themed key of `el` (mutates). */
export function applyThemeToElement(el: SceneElement, t: ThemeTokens) {
  if (!el.themed?.length) return;
  const values = themeValues(t, el.type, el.role);
  const props = el.props as Record<string, unknown>;
  el.themed = el.themed.filter((k) => k in values);
  for (const k of el.themed) props[k] = clone(values[k]);
}

/** Marks every themeable prop of a freshly created element as themed and applies the theme (mutates). */
export function themeNewElement<T extends SceneElement>(el: T, theme: ThemeTokens | ThemeId, role?: string): T {
  const t = typeof theme === 'string' ? getTheme(theme) : theme;
  if (role) el.role = role;
  if (!el.role) el.role = defaultRole(el.type);
  el.themed = Object.keys(themeValues(t, el.type, el.role));
  applyThemeToElement(el, t);
  if (!el.themed.length) delete el.themed;
  return el;
}

/** Sets explicit props on an element, removing them from its themed keys (mutates). */
export function customize<T extends SceneElement>(el: T, patch: Record<string, unknown>): T {
  Object.assign(el.props as Record<string, unknown>, patch);
  markExplicit(el, Object.keys(patch));
  return el;
}

export function markExplicit(el: SceneElement, keys: string[]) {
  if (!el.themed) return;
  el.themed = el.themed.filter((k) => !keys.includes(k));
  if (!el.themed.length) delete el.themed;
}

/** Keys of `el` that could follow the theme but are currently customised. */
export function customizedKeys(el: SceneElement, t: ThemeTokens): string[] {
  const all = Object.keys(themeValues(t, el.type, el.role || defaultRole(el.type)));
  const themed = new Set(el.themed ?? []);
  return all.filter((k) => !themed.has(k));
}

/** Restores theme styling for an element (all keys, or just `keys`). Mutates. */
export function resetElementToTheme(el: SceneElement, t: ThemeTokens, keys?: string[]) {
  if (!el.role) el.role = inferRole(el);
  const all = Object.keys(themeValues(t, el.type, el.role));
  const next = new Set([...(el.themed ?? []), ...(keys ? keys.filter((k) => all.includes(k)) : all)]);
  el.themed = all.filter((k) => next.has(k));
  applyThemeToElement(el, t);
  if (!el.themed.length) delete el.themed;
}

/** Changes an element's style role and re-applies the theme to its themed keys. */
export function setElementRole(el: SceneElement, role: string, t: ThemeTokens) {
  el.role = role;
  const all = Object.keys(themeValues(t, el.type, role));
  // A role change is a request for that role's look: everything follows the theme again.
  el.themed = all;
  applyThemeToElement(el, t);
}

export function themeNewBackground(t: ThemeTokens, role: string = 'base', extra: Partial<Background> = {}): Background {
  return { ...extra, paint: clone(backgroundPaint(t, role)), role, themed: true };
}

export function applyThemeToPage(page: Page, t: ThemeTokens) {
  if (page.background.themed) page.background.paint = clone(backgroundPaint(t, page.background.role));
  for (const el of page.elements) applyThemeToElement(el, t);
}

export function themeBackdrop(t: ThemeTokens, kind: Project['kind']): string {
  return kind === 'slides' ? t.colors.backdropSlides : t.colors.backdropPage;
}

/** Switches the project theme, restyling everything that follows the theme (mutates). */
export function applyProjectTheme(project: Project, id: ThemeId, opts: { resetCustom?: boolean } = {}) {
  const t = getTheme(id);
  project.settings.theme = t.id;
  if (opts.resetCustom) {
    project.settings.backdropThemed = true;
    for (const page of project.pages) {
      if (!page.background.role) page.background.role = inferBackgroundRole(page.background);
      page.background.themed = true;
      for (const el of page.elements) {
        if (!el.role) el.role = inferRole(el, page);
        resetElementToTheme(el, t);
      }
    }
  }
  if (project.settings.backdropThemed) project.settings.backdrop = themeBackdrop(t, project.kind);
  for (const page of project.pages) applyThemeToPage(page, t);
}

/** Number of elements/backgrounds with customised (non-theme) styling. */
export function countCustomized(project: Project): number {
  const t = getTheme(project.settings.theme);
  let n = 0;
  for (const page of project.pages) {
    if (!page.background.themed) n++;
    for (const el of page.elements) if (customizedKeys(el, t).length) n++;
  }
  return n;
}

// ---------------------------------------------------------------- inference

function luminance(color: string): number {
  const rgb = parseHex(color);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isDarkBackground(bg: Background | undefined): boolean {
  if (!bg) return false;
  if (bg.imageId && (bg.imageDim ?? 0) >= 0.3) return true;
  const c = bg.paint.kind === 'solid' ? bg.paint.color : bg.paint.from;
  return contrastText(c) === '#ffffff' && luminance(c) < 0.35;
}

/** Best-guess background role for content made before themes existed. Used only when the author asks to restyle. */
export function inferBackgroundRole(bg: Background): string {
  if (!isDarkBackground(bg)) return 'base';
  return bg.paint.kind === 'linear' ? 'hero' : 'dark';
}

/** Best-guess style role for an element made before themes existed. Used only when the author asks to restyle. */
export function inferRole(el: SceneElement, page?: Page): string {
  const p = el.props as Record<string, unknown>;
  const dark = isDarkBackground(page?.background);
  if (el.type === 'text') {
    const size = Number(p.size) || 24;
    const hasBg = typeof p.background === 'string' && p.background !== 'transparent';
    if (hasBg && size <= 20) return 'label';
    if (hasBg) return 'score';
    if (dark) return size >= 44 ? 'display' : 'displaySub';
    if (size >= 44) return 'heading';
    if (size >= 26) return 'subheading';
    return 'body';
  }
  if (el.type === 'button' || el.type === 'navButton') {
    if (dark) return p.variant === 'ghost' ? 'heroGhost' : 'hero';
    return p.variant === 'solid' ? 'primary' : 'secondary';
  }
  if (el.type === 'shape') {
    const fill = p.fill as { kind?: string; color?: string } | undefined;
    if (fill?.kind === 'solid' && fill.color && luminance(fill.color) > 0.85) return 'card';
    return 'tone0';
  }
  if (el.type === 'progress' && dark) return 'onHero';
  return defaultRole(el.type);
}
