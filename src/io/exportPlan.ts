import type { Asset, AssetKind, Project } from '../model/types';
import { assetKind } from '../model/types';
import { ASSET_REFS } from '../model/propSchemas';
import { buildStandaloneHtml } from './exportHtml';

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
export function estimateExport(project: Project, runtime: string): ExportEstimate {
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

const KIND_WORD: Record<AssetKind, string> = { image: 'an image', video: 'a video', audio: 'a sound' };

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
        else if (prop === 'assetId' && (el.type === 'video' || el.type === 'audio') && !props[prop])
          empty.push({
            pageId: page.id,
            pageIndex,
            elementId: el.id,
            label: el.name || el.type,
            message: `has no ${el.type === 'video' ? 'video' : 'sound'} yet`,
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
