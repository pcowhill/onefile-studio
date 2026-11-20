import type { Asset, AssetKind, Project } from '../model/types';
import { assetKind } from '../model/types';
import { ASSET_REFS } from '../model/propSchemas';
import { buildStandaloneHtml } from './exportHtml';
import type { ExportRuntime } from './exportHtml';
import type { MediaEdit } from '../model/mediaEdit';
import { isIdentity, resolveEdit } from '../model/mediaEdit';

/**
 * Export planning without building the (possibly huge) HTML: exact size
 * estimates, the largest assets, and checks that every referenced file exists.
 */

/**
 * Browsers cap string length at roughly 512–1024 M characters (V8: ~536 M).
 * Building the document needs a few copies, so refuse well below that.
 */
export const MAX_EXPORT_CHARS = 450_000_000;
export const WARN_EMAIL_BYTES = 25 * 1024 * 1024;
export const WARN_LARGE_BYTES = 100 * 1024 * 1024;

export interface ExportEstimate {
  /** UTF-8 bytes of the final file. */
  bytes: number;
  /** JavaScript string length of the final document. */
  chars: number;
}

/**
 * Size of `buildStandaloneHtml(project, runtime)` computed by building the
 * document once with empty asset data and adding the base64 lengths (base64
 * is ASCII and never escaped, so the result is exact).
 */
export function estimateExport(project: Project, runtime: string | ExportRuntime): ExportEstimate {
  let dataChars = 0;
  const assets: Project['assets'] = {};
  for (const [id, a] of Object.entries(project.assets)) {
    dataChars += a.data.length;
    assets[id] = { ...a, data: '' };
  }
  const shell = buildStandaloneHtml({ ...project, assets }, runtime);
  const shellBytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(shell).length : shell.length;
  return { bytes: shellBytes + dataChars, chars: shell.length + dataChars };
}

export interface AssetShare {
  asset: Asset;
  kind: AssetKind;
  /** Bytes this asset adds to the file (base64). */
  bytes: number;
  share: number;
}

/** Assets by the space they take in the export, largest first. */
export function assetBreakdown(project: Project, totalBytes: number): AssetShare[] {
  return Object.values(project.assets)
    .map((asset) => {
      const bytes = asset.data.length;
      return { asset, kind: assetKind(asset.mime), bytes, share: totalBytes > 0 ? bytes / totalBytes : 0 };
    })
    .sort((a, b) => b.bytes - a.bytes);
}

export interface AssetIssue {
  pageId: string;
  pageIndex: number;
  /** Empty for a page background. */
  elementId: string;
  /** Element name, or "Background of slide 2". */
  label: string;
  message: string;
}

const KIND_WORD: Record<AssetKind, string> = { image: 'an image', video: 'a video', audio: 'a sound', model: 'a 3D model' };

function checkRef(project: Project, id: unknown, want: AssetKind): string | null {
  if (typeof id !== 'string' || !id) return null;
  const a = Object.prototype.hasOwnProperty.call(project.assets, id) ? project.assets[id] : undefined;
  if (!a) return 'uses a file that is no longer in the project';
  const kind = assetKind(a.mime);
  if (kind !== want) return `needs ${KIND_WORD[want]} but points to ${KIND_WORD[kind]}`;
  if (typeof a.data !== 'string' || !a.data.startsWith(`data:${a.mime};base64,`)) return `uses “${a.name}”, whose data is damaged`;
  return null;
}

/**
 * Elements (and backgrounds) that point at a missing, damaged or wrong-kind
 * asset. Exporting would silently drop those files, so the dialog blocks it.
 * `empty` lists media elements that simply have no file chosen yet.
 */
/** Elements whose empty state is worth a gentle "nothing chosen yet" note in the export dialog. */
const EMPTY_NOUN: Record<string, string> = { image: 'picture', video: 'video', audio: 'sound', model: '3D model' };

export function findAssetIssues(project: Project): { problems: AssetIssue[]; empty: AssetIssue[] } {
  const problems: AssetIssue[] = [];
  const empty: AssetIssue[] = [];
  const noun = project.kind === 'slides' ? 'slide' : 'section';
  project.pages.forEach((page, pageIndex) => {
    const bgIssue = checkRef(project, page.background.imageId, 'image');
    if (bgIssue) problems.push({ pageId: page.id, pageIndex, elementId: '', label: `Background of ${noun} ${pageIndex + 1}`, message: bgIssue });
    for (const el of page.elements) {
      const props = el.props as Record<string, unknown>;
      const push = (message: string) => problems.push({ pageId: page.id, pageIndex, elementId: el.id, label: el.name || el.type, message });
      for (const [prop, kind] of Object.entries(ASSET_REFS[el.type] ?? {})) {
        const issue = checkRef(project, props[prop], kind);
        if (issue) push(issue);
        else if (prop === 'assetId' && EMPTY_NOUN[el.type] && !props[prop])
          empty.push({
            pageId: page.id,
            pageIndex,
            elementId: el.id,
            label: el.name || el.type,
            message: `has no ${EMPTY_NOUN[el.type]} yet`,
          });
      }
      if (Array.isArray(props.images)) {
        const bad = (props.images as unknown[]).map((id) => checkRef(project, id, 'image')).find(Boolean);
        if (bad) push(bad);
      }
    }
  });
  return { problems, empty };
}

/**
 * Nondestructive edits keep the whole original file in the export. This
 * reports how many embedded files are shown edited, and roughly how many of
 * their bytes lie outside every trim (an honest "your trims don't shrink the
 * file" figure for the export dialog).
 */
export function editRetention(project: Project): { edited: number; outsideTrimBytes: number } {
  const uses = new Map<string, MediaEdit[]>();
  const add = (id: unknown, override?: unknown) => {
    if (typeof id !== 'string' || !id || !Object.prototype.hasOwnProperty.call(project.assets, id)) return;
    const list = uses.get(id) ?? [];
    list.push(resolveEdit(project, id, override));
    uses.set(id, list);
  };
  for (const pg of project.pages) {
    add(pg.background.imageId);
    for (const el of pg.elements) {
      const p = el.props as Record<string, unknown>;
      for (const prop of Object.keys(ASSET_REFS[el.type] ?? {})) add(p[prop], prop === 'assetId' ? p.edit : undefined);
      if (Array.isArray(p.images)) for (const id of p.images) add(id);
    }
  }
  let edited = 0;
  let outside = 0;
  for (const [id, list] of uses) {
    if (list.some((e) => !isIdentity(e))) edited++;
    const a = project.assets[id];
    const d = a.duration ?? 0;
    if (!(d > 0) || list.some((e) => !e.trim)) continue;
    // Bytes of the file outside the union of the used segments (approximated by its span).
    const start = Math.min(...list.map((e) => e.trim!.start));
    const end = Math.max(...list.map((e) => Math.min(d, e.trim!.end)));
    outside += a.data.length * Math.max(0, 1 - (end - start) / d);
  }
  return { edited, outsideTrimBytes: Math.round(outside) };
}
