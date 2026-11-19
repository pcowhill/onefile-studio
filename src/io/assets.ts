import type { Asset, AssetKind, Project } from '../model/types';
import { assetKind } from '../model/types';
import { uid } from '../model/ids';

/**
 * Asset pipeline: turns local files (images, animated GIFs, videos, sounds)
 * into embeddable assets (base64 data URLs), measures them, de-duplicates them
 * by content hash and optionally optimises raster images for export.
 *
 * Video and audio are NEVER re-encoded, and animated images are never
 * flattened: they are embedded exactly as added.
 */

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif', 'image/bmp'];
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
export const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/flac'];

const MB = 1024 * 1024;
export const MAX_IMAGE_BYTES = 40 * MB;
/** Videos and sounds. Base64 grows this by a third; exports must stay below ~450 M characters. */
export const MAX_MEDIA_BYTES = 150 * MB;
/** Files above this size get a gentle export-size warning. */
export const LARGE_FILE_BYTES = 20 * MB;

const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'image/svg': 'image/svg+xml',
  'image/x-ms-bmp': 'image/bmp',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-pn-wav': 'audio/wav',
  'audio/mp3': 'audio/mpeg',
  'audio/x-mp3': 'audio/mpeg',
  'audio/mpeg3': 'audio/mpeg',
  'audio/x-mpeg': 'audio/mpeg',
  'audio/mpg': 'audio/mpeg',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/x-mp4': 'audio/mp4',
  'audio/x-aac': 'audio/aac',
  'audio/aacp': 'audio/aac',
  'audio/x-flac': 'audio/flac',
  'audio/opus': 'audio/ogg',
  'audio/vorbis': 'audio/ogg',
  'audio/x-ogg': 'audio/ogg',
  'video/x-m4v': 'video/mp4',
  'video/m4v': 'video/mp4',
  'video/x-webm': 'video/webm',
};

const EXTENSIONS: Record<string, string> = {
  png: 'image/png',
  apng: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  wave: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  weba: 'audio/webm',
};

const ACCEPTED = new Set([...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_AUDIO_TYPES]);

/**
 * The canonical MIME type for a file, from its reported type or (when that is
 * empty, generic or an alias) its extension. Returns null when unsupported.
 * Every value returned is accepted by `isEmbeddedDataUrl` in validate.ts.
 */
export function normalizeMime(type: string | undefined, name = ''): string | null {
  const t = String(type ?? '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  const aliased = MIME_ALIASES[t] ?? t;
  if (ACCEPTED.has(aliased)) return aliased;
  const ext = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase();
  const byExt = ext ? EXTENSIONS[ext] : undefined;
  if (!byExt) return null;
  // Trust the extension only when the reported type is missing, generic, or the same family.
  if (!t || t === 'application/octet-stream' || t === 'application/ogg' || t.split('/')[0] === byExt.split('/')[0]) return byExt;
  return null;
}

/** `accept` attribute for a file input offering these kinds. */
export function acceptAttribute(kinds: AssetKind[]): string {
  const parts: string[] = [];
  if (kinds.includes('image')) parts.push(...ACCEPTED_IMAGE_TYPES, '.gif');
  if (kinds.includes('video')) parts.push('video/mp4', 'video/webm', '.mp4', '.m4v', '.webm');
  if (kinds.includes('audio')) parts.push('audio/*', '.mp3', '.wav', '.ogg', '.oga', '.opus', '.m4a', '.aac', '.flac');
  return parts.join(',');
}

const UNSUPPORTED_HINTS: Record<string, string> = {
  mov: 'QuickTime (.mov) videos do not play in every browser. Please convert it to MP4 (H.264) or WebM first.',
  avi: 'AVI videos do not play in browsers. Please convert it to MP4 (H.264) or WebM first.',
  mkv: 'MKV videos do not play reliably in browsers. Please convert it to MP4 (H.264) or WebM first.',
  wmv: 'WMV videos do not play in browsers. Please convert it to MP4 (H.264) or WebM first.',
  heic: 'HEIC photos are not supported by most browsers. Please save it as JPEG or PNG first.',
  heif: 'HEIF photos are not supported by most browsers. Please save it as JPEG or PNG first.',
  tif: 'TIFF images are not supported by browsers. Please save it as PNG or JPEG first.',
  tiff: 'TIFF images are not supported by browsers. Please save it as PNG or JPEG first.',
  aiff: 'AIFF sounds do not play in every browser. Please convert it to MP3 or WAV first.',
  wma: 'WMA sounds do not play in browsers. Please convert it to MP3 first.',
};

function unsupportedMessage(name: string): string {
  const ext = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  return `“${name}” can't be added. ${UNSUPPORTED_HINTS[ext] ?? 'Supported files: images (PNG, JPEG, GIF, WebP, SVG), videos (MP4, WebM) and sounds (MP3, WAV, OGG, M4A).'}`;
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
}

export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('Could not read file'));
    r.readAsDataURL(blob);
  });
}

export async function readBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer));
    r.onerror = () => reject(r.error ?? new Error('Could not read file'));
    r.readAsArrayBuffer(blob);
  });
}

export function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 600 });
    img.onerror = () => resolve({ width: 800, height: 600 });
    img.src = src;
  });
}

export interface MediaInfo {
  width: number;
  height: number;
  duration: number;
  /** True when the browser could read the file's metadata. */
  loaded: boolean;
}

/**
 * Reads a video's size and duration (or a sound's duration) with a muted,
 * metadata-only media element. Resolves (never rejects) with zeros when the
 * browser cannot decode the file or does not answer within `timeoutMs`.
 */
export function measureMedia(src: string, kind: 'video' | 'audio', timeoutMs = 15000): Promise<MediaInfo> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve({ width: 0, height: 0, duration: 0, loaded: false });
    const el = document.createElement(kind) as HTMLMediaElement & Partial<HTMLVideoElement>;
    let done = false;
    let loaded = false;
    const read = (): MediaInfo => ({
      width: el.videoWidth || 0,
      height: el.videoHeight || 0,
      duration: Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0,
      loaded,
    });
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const info = read();
      el.onloadedmetadata = el.ondurationchange = el.onerror = null;
      el.removeAttribute('src');
      resolve(info);
    };
    const timer = setTimeout(finish, timeoutMs);
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => {
      loaded = true;
      if (Number.isFinite(el.duration) && el.duration > 0) return finish();
      // Some WebM files (e.g. screen recordings) report Infinity until the end is sought.
      el.ondurationchange = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) finish();
      };
      try {
        el.currentTime = 1e101;
      } catch {
        finish();
      }
    };
    el.onerror = finish;
    el.src = src;
  });
}

// ---------------- container probing (no decoder needed) ----------------

const fourcc = (b: Uint8Array, i: number) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

/** Iterates ISO-BMFF boxes inside `b[start, end)`. */
function* boxes(b: Uint8Array, start: number, end: number): Generator<{ type: string; body: number; end: number }> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = start;
  while (i + 8 <= end) {
    let size = dv.getUint32(i);
    let header = 8;
    if (size === 1 && i + 16 <= end) {
      size = Number(dv.getBigUint64(i + 8));
      header = 16;
    } else if (size === 0) size = end - i;
    if (size < header || i + size > end) return;
    yield { type: fourcc(b, i + 4), body: i + header, end: i + size };
    i += size;
  }
}

/** Duration and picture size from an MP4/M4A `moov` box. */
export function parseMoov(b: Uint8Array): { width: number; height: number; duration: number } {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let width = 0;
  let height = 0;
  let duration = 0;
  for (const box of boxes(b, 0, b.length)) {
    if (box.type === 'mvhd' && box.body + 32 <= box.end) {
      const v1 = b[box.body] === 1;
      const scale = dv.getUint32(box.body + (v1 ? 20 : 12));
      const dur = v1 ? Number(dv.getBigUint64(box.body + 24)) : dv.getUint32(box.body + 16);
      if (scale > 0 && dur > 0 && dur < 0xffffffff) duration = dur / scale;
    } else if (box.type === 'trak') {
      for (const t of boxes(b, box.body, box.end)) {
        if (t.type !== 'tkhd') continue;
        const off = t.body + (b[t.body] === 1 ? 88 : 76);
        if (off + 8 > t.end) continue;
        const w = dv.getUint32(off) / 65536;
        const hgt = dv.getUint32(off + 4) / 65536;
        if (w > 0 && hgt > 0 && !width) {
          width = Math.round(w);
          height = Math.round(hgt);
        }
      }
    }
  }
  return { width, height, duration };
}

async function probeMp4(file: Blob): Promise<Partial<MediaInfo>> {
  let off = 0;
  for (let guard = 0; guard < 64 && off + 8 <= file.size; guard++) {
    const head = await readBytes(file.slice(off, off + 16));
    const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let size = dv.getUint32(0);
    let header = 8;
    if (size === 1 && head.length >= 16) {
      size = Number(dv.getBigUint64(8));
      header = 16;
    } else if (size === 0) size = file.size - off;
    if (size < header) break;
    if (fourcc(head, 4) === 'moov') {
      if (size > 64 * MB) break;
      return parseMoov(await readBytes(file.slice(off + header, off + size)));
    }
    off += size;
  }
  return {};
}

/** Duration of a PCM WAV file from its header. */
export function parseWavDuration(b: Uint8Array): number {
  if (b.length < 12 || fourcc(b, 0) !== 'RIFF' || fourcc(b, 8) !== 'WAVE') return 0;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let byteRate = 0;
  let i = 12;
  while (i + 8 <= b.length) {
    const id = fourcc(b, i);
    const size = dv.getUint32(i + 4, true);
    if (id === 'fmt ' && i + 20 <= b.length) byteRate = dv.getUint32(i + 16, true);
    if (id === 'data') return byteRate > 0 ? size / byteRate : 0;
    i += 8 + size + (size & 1);
  }
  return 0;
}

async function probeContainer(file: Blob, mime: string): Promise<Partial<MediaInfo>> {
  try {
    if (mime === 'video/mp4' || mime === 'audio/mp4') return await probeMp4(file);
    if (mime === 'audio/wav') return { duration: parseWavDuration(await readBytes(file.slice(0, 64 * 1024))) };
  } catch {
    /* unreadable header: rely on the browser */
  }
  return {};
}

// ---------------- animation detection ----------------

/** Number of image frames in a GIF (stops counting at `stopAt`). */
export function countGifFrames(b: Uint8Array, stopAt = Infinity): number {
  if (b.length < 13 || fourcc(b, 0) !== 'GIF8') return 0;
  const skipBlocks = (i: number) => {
    while (i < b.length) {
      const n = b[i++];
      if (n === 0) break;
      i += n;
    }
    return i;
  };
  let i = 13;
  if (b[10] & 0x80) i += 3 * (1 << ((b[10] & 7) + 1));
  let frames = 0;
  while (i < b.length) {
    const t = b[i++];
    if (t === 0x3b) break;
    if (t === 0x21) {
      i = skipBlocks(i + 1);
    } else if (t === 0x2c) {
      if (i + 9 > b.length) break;
      const flags = b[i + 8];
      i += 9;
      if (flags & 0x80) i += 3 * (1 << ((flags & 7) + 1));
      i = skipBlocks(i + 1);
      if (++frames >= stopAt) break;
    } else break;
  }
  return frames;
}

/** True for animated GIF, APNG and animated WebP data (only the file head is needed for PNG/WebP). */
export function isAnimatedImage(mime: string, b: Uint8Array): boolean {
  if (mime === 'image/gif') return countGifFrames(b, 2) > 1;
  if (mime === 'image/png') {
    if (b.length < 16) return false;
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let i = 8;
    while (i + 8 <= b.length) {
      const type = fourcc(b, i + 4);
      if (type === 'acTL') return true;
      if (type === 'IDAT' || type === 'IEND') return false;
      i += 12 + dv.getUint32(i);
    }
    return false;
  }
  if (mime === 'image/webp') return b.length > 21 && fourcc(b, 0) === 'RIFF' && fourcc(b, 12) === 'VP8X' && (b[20] & 0x02) !== 0;
  return false;
}

/** Decodes the first `maxBytes` bytes of a base64 data URL. */
export function dataUrlHead(dataUrl: string, maxBytes = 64 * 1024): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const chars = Math.ceil(maxBytes / 3) * 4;
  try {
    const bin = atob(dataUrl.slice(comma + 1, comma + 1 + chars).replace(/=+$/, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

// ---------------- hashing ----------------

export async function hashString(s: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      /* fall through */
    }
  }
  // FNV-1a fallback.
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return `fnv${(h1 >>> 0).toString(16)}-${s.length}`;
}

/**
 * Hashes we computed ourselves, by asset id. `asset.hash` of imported files is
 * untrusted, so anything keyed by content (draft storage) uses `contentHash`,
 * which re-hashes once per session and then answers from this cache as long
 * as the asset's data is unchanged.
 */
const verifiedHashes = new Map<string, { data: string; hash: string }>();

export function rememberContentHash(asset: Pick<Asset, 'id' | 'data' | 'hash'>) {
  verifiedHashes.set(asset.id, { data: asset.data, hash: asset.hash });
}

export async function contentHash(asset: Pick<Asset, 'id' | 'data'>): Promise<string> {
  const known = verifiedHashes.get(asset.id);
  if (known && known.data === asset.data) return known.hash;
  const hash = await hashString(asset.data);
  verifiedHashes.set(asset.id, { data: asset.data, hash });
  return hash;
}

/** Forgets cached hashes of assets no longer in use (releases their data). */
export function pruneContentHashes(liveIds: Iterable<string>) {
  const keep = new Set(liveIds);
  for (const id of [...verifiedHashes.keys()]) if (!keep.has(id)) verifiedHashes.delete(id);
}

export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  const len = dataUrl.length - i - 1;
  const pad = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - pad;
}

// ---------------- files → assets ----------------

export interface FileToAssetOptions {
  /** Give up waiting for the browser to read media metadata after this long (ms). */
  measureTimeoutMs?: number;
}

/** Converts a local image, video or sound file into an embeddable asset (base64 data URL). */
export async function fileToAsset(file: File, opts: FileToAssetOptions = {}): Promise<Asset> {
  const name = (file.name || 'file').slice(0, 120);
  let mime = normalizeMime(file.type, name);
  if (!mime) throw new Error(unsupportedMessage(name));
  const kind = assetKind(mime);
  const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_MEDIA_BYTES;
  if (file.size === 0) throw new Error(`“${name}” is empty.`);
  if (file.size > limit) {
    const advice =
      kind === 'video'
        ? 'Try a shorter clip or a smaller resolution (720p is plenty for most screens).'
        : kind === 'audio'
          ? 'Try a shorter clip or saving it as MP3.'
          : 'Try saving it at a smaller size.';
    throw new Error(`“${name}” is ${formatMegabytes(file.size)}, more than the ${formatMegabytes(limit)} a single file can embed. ${advice}`);
  }

  const typed = file.type === mime ? file : new Blob([file], { type: mime });
  let data = await readAsDataUrl(typed);
  const head = `data:${mime};base64,`;
  if (!data.startsWith(head)) {
    const comma = data.indexOf(',');
    if (data.slice(0, comma).endsWith(';base64')) data = head + data.slice(comma + 1);
    else {
      const bytes = await readBytes(file);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      data = head + btoa(bin);
    }
  }

  const asset: Asset = { id: uid('as'), name, mime, data, width: 0, height: 0, bytes: dataUrlBytes(data), hash: '' };
  if (kind === 'image') {
    const size = await measureImage(data);
    asset.width = size.width;
    asset.height = size.height;
    if (mime === 'image/gif' || mime === 'image/png' || mime === 'image/webp') {
      const bytes = await readBytes(mime === 'image/gif' ? file : file.slice(0, 256 * 1024));
      if (isAnimatedImage(mime, bytes)) asset.animated = true;
    }
  } else {
    const probed = await probeContainer(file, mime);
    let src = data;
    let objectUrl = '';
    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') src = objectUrl = URL.createObjectURL(typed);
    } catch {
      /* fall back to the data URL */
    }
    const measured = await measureMedia(src, kind, opts.measureTimeoutMs);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    // A .webm with no picture is a sound.
    if (mime === 'video/webm' && measured.loaded && !measured.width && !measured.height) {
      mime = 'audio/webm';
      asset.mime = mime;
      asset.data = `data:audio/webm;base64,${data.slice(data.indexOf(',') + 1)}`;
    }
    if (assetKind(mime) === 'video') {
      asset.width = measured.width || probed.width || 0;
      asset.height = measured.height || probed.height || 0;
    }
    const duration = measured.duration || probed.duration || 0;
    if (duration > 0) asset.duration = Math.round(duration * 1000) / 1000;
  }
  asset.hash = await hashString(asset.data);
  rememberContentHash(asset);
  return asset;
}

/** Adds an asset, re-using an identical existing one (by content hash). Mutates `assets`. */
export function addAssetDedup(assets: Project['assets'], asset: Asset): string {
  const existing = Object.values(assets).find((a) => a.hash === asset.hash);
  if (existing) return existing.id;
  assets[asset.id] = asset;
  return asset.id;
}

// ---------------- export optimisation ----------------

export interface OptimizeOptions {
  maxDimension: number;
  quality: number;
}

export const DEFAULT_OPTIMIZE: OptimizeOptions = { maxDimension: 1920, quality: 0.82 };

/** True when optimisation may re-encode this asset (still raster images only). */
export function isOptimizable(a: Asset): boolean {
  if (a.animated || !/^image\/(png|jpeg|webp|bmp|avif)$/.test(a.mime)) return false;
  // Older projects did not record animation: check APNG / animated WebP headers.
  if ((a.mime === 'image/png' || a.mime === 'image/webp') && isAnimatedImage(a.mime, dataUrlHead(a.data))) return false;
  return true;
}

/**
 * Re-encodes large raster images (downscaled, WebP or JPEG) when that makes
 * them smaller. Asset ids are preserved so the project structure is unchanged.
 * GIFs and other animated images, SVGs (vector), videos and sounds are
 * returned untouched (the very same objects).
 */
export async function optimizeAssets(project: Project, opts: OptimizeOptions = DEFAULT_OPTIMIZE): Promise<Project> {
  const assets: Project['assets'] = {};
  for (const [id, a] of Object.entries(project.assets)) {
    assets[id] = await optimizeAsset(a, opts).catch(() => a);
  }
  return { ...project, assets };
}

let webpSupport: boolean | null = null;
function canEncodeWebp(): boolean {
  if (webpSupport === null) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 2;
      webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

export async function optimizeAsset(a: Asset, opts: OptimizeOptions): Promise<Asset> {
  if (!isOptimizable(a)) return a;
  const img = new Image();
  img.src = a.data;
  await img.decode();
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  if (!w0 || !h0) return a;
  const k = Math.min(1, opts.maxDimension / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k));
  const h = Math.max(1, Math.round(h0 * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return a;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const type = canEncodeWebp() ? 'image/webp' : 'image/jpeg';
  if (type === 'image/jpeg' && a.mime === 'image/png') {
    // JPEG has no transparency: only use it when the PNG is fully opaque.
    const px = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < px.length; i += 4 * 7) if (px[i] < 255) return a;
  }
  const data = canvas.toDataURL(type, opts.quality);
  const bytes = dataUrlBytes(data);
  if (!data.startsWith(`data:${type}`) || bytes >= a.bytes * 0.95) return a;
  return { ...a, data, mime: type, width: w, height: h, bytes, hash: await hashString(data) };
}

export function totalAssetBytes(project: Project): number {
  return Object.values(project.assets).reduce((s, a) => s + a.bytes, 0);
}
