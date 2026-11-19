import nunitoUrl from '@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2?inline';
import type { Project } from '../model/types';

/** @font-face for the embedded "Friendly" font (Nunito, SIL Open Font License 1.1). */
export const NUNITO_FONT_CSS = `@font-face{font-family:'OFS Nunito';font-style:normal;font-display:block;font-weight:200 1000;src:url(${nunitoUrl}) format('woff2')}`;

/** True when any element in the project renders with the embedded font. */
export function projectUsesEmbeddedFont(project: Project): boolean {
  for (const page of project.pages) {
    for (const el of page.elements) {
      const p = el.props as Record<string, unknown>;
      if (p.font === 'rounded') return true;
      if (el.type === 'progress' && p.label !== 'none') return true;
    }
  }
  return false;
}

/** Injects the embedded font into the editor document so the canvas matches exports. */
export function ensureEditorFonts(doc: Document) {
  if (doc.getElementById('ofs-embedded-fonts')) return;
  const style = doc.createElement('style');
  style.id = 'ofs-embedded-fonts';
  style.textContent = NUNITO_FONT_CSS;
  doc.head.appendChild(style);
}
