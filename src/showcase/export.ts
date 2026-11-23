import type { ExportRuntime } from '../io/exportHtml';
import { buildStandaloneHtml, pruneUnusedAssets } from '../io/exportHtml';
import { buildShowcase } from './index';

/**
 * The standalone OneFile of a showcase, built exactly like the editor's
 * Export dialog does with "Original" quality (prune unused files, then
 * `buildStandaloneHtml` with the same runtime bundles). The site build writes
 * these to `showcase/<id>.html`; "Try it" on the landing page plays them.
 */
export function exportShowcase(id: string, runtime: ExportRuntime): string {
  const project = buildShowcase(id);
  if (!project) throw new Error(`Unknown showcase: ${id}`);
  // Fixed dates (v0.7): the committed site in dist-site/ must be byte-for-byte
  // reproducible, so CI can check it is up to date.
  project.meta.createdAt = SHOWCASE_DATE;
  project.meta.updatedAt = SHOWCASE_DATE;
  return buildStandaloneHtml(pruneUnusedAssets(project), runtime, { updatedAt: SHOWCASE_DATE });
}

/** The date stamped into every exported showcase (it only appears in the project data). */
export const SHOWCASE_DATE = '2026-01-01T00:00:00.000Z';
