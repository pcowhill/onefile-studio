import type { Project } from '../model/types';
import { escapeHtml, jsonForScript } from './escape';
import { fontCssForProject } from './fonts';
import { isSafeColor } from '../model/paint';

export const GENERATOR = 'OneFile Studio';
export const APP_VERSION = '0.7.0';

/**
 * Restrictive Content-Security-Policy for exported files: scripts and styles
 * may only be inline, images/fonts only embedded data: URLs, and no network
 * connections at all. This guarantees the document works (and stays) offline.
 */
export const EXPORT_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; base-uri 'none'; form-action 'none'";

/** The playback code embedded in exports: the core runtime, plus add-ons included only when needed. */
export interface ExportRuntime {
  core: string;
  /** The 3D viewer add-on (three.js); embedded only when the project shows a 3D model. */
  model3d?: string;
}

/** True when the project shows at least one 3D model (so the export needs the 3D add-on). */
export function usesModels(project: Project): boolean {
  return project.pages.some((pg) =>
    pg.elements.some((el) => {
      const id = (el.props as { assetId?: unknown }).assetId;
      return el.type === 'model' && typeof id === 'string' && Object.prototype.hasOwnProperty.call(project.assets, id);
    }),
  );
}

/** Removes assets that nothing references. Returns a new project. */
export function pruneUnusedAssets(project: Project): Project {
  const json = JSON.stringify(project.pages);
  const assets: Project['assets'] = {};
  for (const [id, a] of Object.entries(project.assets)) if (json.includes(`"${id}"`)) assets[id] = a;
  return { ...project, assets };
}

/**
 * Builds a complete standalone HTML document: markup, CSS, the playback
 * runtime, the full editable project JSON and every embedded asset.
 * `runtime` is the minified IIFE produced from src/runtime/standalone.ts (and,
 * for projects with 3D models, the 3D add-on, which must run first).
 */
export function buildStandaloneHtml(project: Project, runtime: string | ExportRuntime, opts: { updatedAt?: string } = {}): string {
  const code = typeof runtime === 'string' ? { core: runtime } : runtime;
  const addon = code.model3d && usesModels(project) ? `<script>${code.model3d}</script>\n` : '';
  const data: Project = { ...project, meta: { ...project.meta, updatedAt: opts.updatedAt ?? new Date().toISOString() } };
  const title = escapeHtml(project.meta.title || 'Untitled');
  const backdrop = isSafeColor(project.settings.backdrop) ? project.settings.backdrop : '#ffffff';
  const fontCss = fontCssForProject(project);
  return `<!DOCTYPE html>
<!--
  Made with ${GENERATOR}. This single file contains everything it needs and works offline.
  To keep editing, open ${GENERATOR} and import this file: the full project is embedded below.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${EXPORT_CSP}">
<meta name="generator" content="${GENERATOR} ${APP_VERSION}">
<meta name="ofs-schema" content="${escapeHtml(project.schema)}@${project.version}">
<title>${title}</title>
<style>html,body{margin:0;padding:0;height:100%;overflow:hidden;background:${backdrop}}#ofs-root{position:fixed;inset:0}${fontCss}</style>
</head>
<body>
<div id="ofs-root"></div>
<noscript><p style="font:16px system-ui;padding:24px">This interactive document needs JavaScript to be enabled.</p></noscript>
<script type="application/json" id="ofs-project">${jsonForScript(data)}</script>
${addon}<script>${code.core}</script>
</body>
</html>
`;
}

export function byteSize(s: string): number {
  return new Blob([s]).size;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}
