import nunitoUrl from '@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2?inline';
import interUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?inline';
import groteskUrl from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?inline';
import frauncesUrl from '@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?inline';
import type { Project } from '../model/types';
import { FONT_FILES } from '../runtime/fonts';

/**
 * Embedded fonts (all SIL Open Font License 1.1): Nunito ("Friendly"), Inter
 * ("Modern"), Space Grotesk ("Technical") and Fraunces ("Elegant"). They are
 * written into an export only when the project uses them.
 */
const face = (family: string, url: string, weights: string) =>
  `@font-face{font-family:'${family}';font-style:normal;font-display:block;font-weight:${weights};src:url(${url}) format('woff2')}`;

export const FONT_FACES: Record<string, string> = {
  nunito: face('OFS Nunito', nunitoUrl, '200 1000'),
  inter: face('OFS Inter', interUrl, '100 900'),
  spaceGrotesk: face('OFS Space Grotesk', groteskUrl, '300 700'),
  fraunces: face('OFS Fraunces', frauncesUrl, '100 900'),
};

/** Kept for compatibility with v0.1 callers. */
export const NUNITO_FONT_CSS = FONT_FACES.nunito;

/** Font preset ids used anywhere in the project (any prop whose name ends in "font"/"Font"). */
export function projectFontIds(project: Project): Set<string> {
  const ids = new Set<string>();
  for (const page of project.pages) {
    for (const el of page.elements) {
      const p = el.props as Record<string, unknown>;
      for (const [k, v] of Object.entries(p)) {
        if (!/font$/i.test(k) || typeof v !== 'string') continue;
        if (el.type === 'progress' && p.label === 'none') continue; // label hidden: no text drawn
        ids.add(v);
      }
      // v0.1 progress labels always used the friendly font (before the `font` prop existed).
      if (el.type === 'progress' && p.label !== 'none' && typeof p.font !== 'string') ids.add('rounded');
    }
  }
  return ids;
}

/** @font-face CSS for exactly the embedded fonts the project uses. */
export function fontCssForProject(project: Project): string {
  const files = new Set<string>();
  for (const id of projectFontIds(project)) for (const f of FONT_FILES[id] ?? []) files.add(f);
  return [...files].map((f) => FONT_FACES[f]).join('');
}

/** True when any element in the project renders with an embedded font. */
export function projectUsesEmbeddedFont(project: Project): boolean {
  return fontCssForProject(project).length > 0;
}

/** Injects every embedded font into the editor document so the canvas matches exports. */
export function ensureEditorFonts(doc: Document) {
  if (doc.getElementById('ofs-embedded-fonts')) return;
  const style = doc.createElement('style');
  style.id = 'ofs-embedded-fonts';
  style.textContent = Object.values(FONT_FACES).join('');
  doc.head.appendChild(style);
}
