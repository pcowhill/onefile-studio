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
  return buildStandaloneHtml(pruneUnusedAssets(project), runtime);
}
