import type { Asset, AssetKind, Project } from './types';
import { assetKind } from './types';

/**
 * Nondestructive media edits (schema v3).
 *
 * An edit never touches the embedded bytes: it is a small description of how
 * to show them — a crop rectangle, a quarter-turn rotation and flips for
 * images, a crop for videos, and a trim range for videos and sounds. The
 * original file stays in the project, so every edit can be changed or undone
 * later, also after exporting and re-importing.
 *
 * Edits live in two places:
 * - `asset.edit` — the media library's version of a file. Every use of the
 *   file follows it (image and video elements, sounds, galleries, before/after
 *   sliders, backgrounds).
 * - `element.props.edit` — an image, video or sound element's own
 *   adjustments. `null` follows the library version; an object (even `{}`,
 *   meaning "the original") overrides it for that one element, so one file can
 *   appear several times with different crops or trims without its bytes
 *   being stored twice.
 *
 * This module is framework-free and is bundled into exported files.
 */

/** A rectangle in normalised (0..1) coordinates of the picture as displayed (after rotation/flips). */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Seconds into the original media. */
export interface TrimRange {
  start: number;
  end: number;
}

export type QuarterTurn = 0 | 90 | 180 | 270;

export interface MediaEdit {
  /** Images and videos. Absent = the whole picture. */
  crop?: CropRect;
  /** Images: clockwise rotation, applied before the flips. */
  rotate?: QuarterTurn;
  /** Images: mirror the rotated picture left↔right. */
  flipH?: boolean;
  /** Images: mirror the rotated picture top↔bottom. */
  flipV?: boolean;
  /** Videos and sounds. Absent = the whole file. */
  trim?: TrimRange;
}

/** Smallest crop, as a fraction of the picture's side. */
export const MIN_CROP = 0.02;
/** Shortest trimmed segment in seconds. */
export const MIN_TRIM = 0.1;
/** Crops and trims closer than this to the full range are treated as "none". */
const EPS = 1e-4;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number, digits = 6) => Math.round(v * 10 ** digits) / 10 ** digits;

/** What each kind of media can be edited with. */
export const EDIT_CAPS: Record<AssetKind, { crop: boolean; orient: boolean; trim: boolean }> = {
  image: { crop: true, orient: true, trim: false },
  video: { crop: true, orient: false, trim: true },
  audio: { crop: false, orient: false, trim: true },
};

/** A crop clamped inside the picture with at least MIN_CROP per side; undefined for the full picture or invalid input. */
export function sanitizeCrop(v: unknown): CropRect | undefined {
  if (!isObj(v)) return undefined;
  let x = num(v.x);
  let y = num(v.y);
  let w = num(v.w);
  let h = num(v.h);
  if ([x, y, w, h].some(Number.isNaN)) return undefined;
  w = clamp(w, MIN_CROP, 1);
  h = clamp(h, MIN_CROP, 1);
  x = clamp(x, 0, 1 - w);
  y = clamp(y, 0, 1 - h);
  if (x < EPS && y < EPS && w > 1 - EPS && h > 1 - EPS) return undefined;
  return { x: round(x), y: round(y), w: round(w), h: round(h) };
}

/** A trim with start < end (at least MIN_TRIM apart), within `duration` when known; undefined for "the whole file". */
export function sanitizeTrim(v: unknown, duration = 0): TrimRange | undefined {
  if (!isObj(v)) return undefined;
  let start = num(v.start);
  let end = num(v.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
  const max = duration > 0 ? duration : 1e7;
  start = clamp(start, 0, max);
  end = clamp(end, 0, max);
  if (end - start < MIN_TRIM) {
    if (start + MIN_TRIM <= max) end = start + MIN_TRIM;
    else start = Math.max(0, end - MIN_TRIM);
  }
  if (start < 0.0005 && duration > 0 && end > duration - 0.0005) return undefined;
  return { start: round(start, 3), end: round(end, 3) };
}

const TURNS: QuarterTurn[] = [0, 90, 180, 270];
const toTurn = (v: unknown): QuarterTurn => {
  const n = (((Math.round(num(v) / 90) * 90) % 360) + 360) % 360;
  return TURNS.includes(n as QuarterTurn) ? (n as QuarterTurn) : 0;
};

/**
 * Normalises untrusted edit data for a kind of media: drops what that kind
 * cannot use and identity values. Returns `{}` when nothing is left (callers
 * decide whether that means "original" or "no edit").
 */
export function sanitizeEdit(v: unknown, kind: AssetKind, duration = 0): MediaEdit {
  if (!isObj(v)) return {};
  const caps = EDIT_CAPS[kind];
  const out: MediaEdit = {};
  if (caps.orient) {
    const r = toTurn(v.rotate);
    if (r) out.rotate = r;
    if (v.flipH === true) out.flipH = true;
    if (v.flipV === true) out.flipV = true;
  }
  if (caps.crop) {
    const c = sanitizeCrop(v.crop);
    if (c) out.crop = c;
  }
  if (caps.trim) {
    const t = sanitizeTrim(v.trim, duration);
    if (t) out.trim = t;
  }
  return out;
}

/** True when the edit changes nothing. */
export function isIdentity(edit: MediaEdit | null | undefined): boolean {
  return !edit || (!edit.crop && !edit.rotate && !edit.flipH && !edit.flipV && !edit.trim);
}

function getAsset(project: Project, id: unknown): Asset | undefined {
  if (typeof id !== 'string' || !id) return undefined;
  return Object.prototype.hasOwnProperty.call(project.assets, id) ? project.assets[id] : undefined;
}

/**
 * The edit to show for a use of an asset: the element's own override when it
 * has one (`{}` = the original), otherwise the library version.
 */
export function resolveEdit(project: Project, assetId: unknown, override?: unknown): MediaEdit {
  const a = getAsset(project, assetId);
  if (!a) return {};
  const kind = assetKind(a.mime);
  if (isObj(override)) return sanitizeEdit(override, kind, a.duration);
  return a.edit ? sanitizeEdit(a.edit, kind, a.duration) : {};
}

// ---------------- geometry ----------------

/** Size of a picture after a rotation. */
export function orientedSize(width: number, height: number, rotate: QuarterTurn | undefined): { width: number; height: number } {
  return rotate === 90 || rotate === 270 ? { width: height, height: width } : { width, height };
}

/**
 * The affine matrix [a, b, c, d, e, f] (SVG `matrix()` order) that maps a
 * point of the original W×H picture to the displayed (rotated, then flipped)
 * picture.
 */
export function orientationMatrix(width: number, height: number, edit: MediaEdit): [number, number, number, number, number, number] {
  const r = edit.rotate ?? 0;
  // x' = a x + c y + e ; y' = b x + d y + f
  let m: [number, number, number, number, number, number] =
    r === 90 ? [0, 1, -1, 0, height, 0] : r === 180 ? [-1, 0, 0, -1, width, height] : r === 270 ? [0, -1, 1, 0, 0, width] : [1, 0, 0, 1, 0, 0];
  const o = orientedSize(width, height, r);
  if (edit.flipH) m = [-m[0], m[1], -m[2], m[3], o.width - m[4], m[5]];
  if (edit.flipV) m = [m[0], -m[1], m[2], -m[3], m[4], o.height - m[5]];
  return m.map((n) => (Object.is(n, -0) ? 0 : n)) as typeof m;
}

/** Rotates the displayed picture a quarter turn (1 = clockwise), carrying the crop and flips along. */
export function rotateEdit(edit: MediaEdit, dir: 1 | -1): MediaEdit {
  // Rotating a mirrored picture clockwise equals rotating the original anticlockwise.
  const mirrored = !!edit.flipH !== !!edit.flipV;
  const step = mirrored ? -dir : dir;
  const out: MediaEdit = { ...edit, rotate: toTurn((edit.rotate ?? 0) + step * 90) };
  if (!out.rotate) delete out.rotate;
  if (edit.crop) {
    const c = edit.crop;
    out.crop = dir === 1 ? { x: round(1 - c.y - c.h), y: c.x, w: c.h, h: c.w } : { x: c.y, y: round(1 - c.x - c.w), w: c.h, h: c.w };
  }
  return out;
}

/** Mirrors the displayed picture (h = left↔right), carrying the crop along. */
export function flipEdit(edit: MediaEdit, axis: 'h' | 'v'): MediaEdit {
  const out: MediaEdit = { ...edit };
  if (axis === 'h') out.flipH = !edit.flipH;
  else out.flipV = !edit.flipV;
  if (!out.flipH) delete out.flipH;
  if (!out.flipV) delete out.flipV;
  if (edit.crop) {
    const c = edit.crop;
    out.crop = axis === 'h' ? { ...c, x: round(1 - c.x - c.w) } : { ...c, y: round(1 - c.y - c.h) };
  }
  return out;
}

/** The displayed pixel size of an edited picture (crop applied). */
export function editedSize(width: number, height: number, edit: MediaEdit): { width: number; height: number } {
  const o = orientedSize(width, height, edit.rotate);
  const c = edit.crop;
  return c ? { width: o.width * c.w, height: o.height * c.h } : o;
}

/** Aspect ratio (w/h) of an edited picture; 0 when unknown. */
export function editedAspect(width: number, height: number, edit: MediaEdit): number {
  const s = editedSize(width, height, edit);
  return s.width > 0 && s.height > 0 ? s.width / s.height : 0;
}

/** The played segment of a media file: [start, end] in seconds (end = duration when untrimmed). */
export function trimBounds(edit: MediaEdit, duration: number): { start: number; end: number } {
  const d = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (!edit.trim) return { start: 0, end: d };
  const start = d > 0 ? Math.min(edit.trim.start, Math.max(0, d - MIN_TRIM)) : edit.trim.start;
  const end = d > 0 ? Math.min(edit.trim.end, d) : edit.trim.end;
  return { start, end: Math.max(start, end) };
}

/** Short human description ("Cropped · rotated", "Trimmed to 0:04"). */
export function describeEdit(edit: MediaEdit, fmt: (s: number) => string = (s) => `${Math.round(s * 10) / 10}s`): string {
  const parts: string[] = [];
  if (edit.trim) parts.push(`trimmed to ${fmt(edit.trim.end - edit.trim.start)}`);
  if (edit.crop) parts.push('cropped');
  if (edit.rotate) parts.push('rotated');
  if (edit.flipH || edit.flipV) parts.push('flipped');
  const s = parts.join(' · ');
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}
