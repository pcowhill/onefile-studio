import type { Asset, Project } from '../model/types';
import { uid } from '../model/ids';

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif', 'image/bmp'];
export const MAX_IMAGE_BYTES = 40 * 1024 * 1024;

export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('Could not read file'));
    r.readAsDataURL(blob);
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

export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  const b64 = dataUrl.slice(i + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** Converts a local image file into an embeddable asset (base64 data URL). */
export async function fileToAsset(file: File): Promise<Asset> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error(`"${file.name}" is not a supported image (PNG, JPEG, GIF, WebP, SVG).`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`"${file.name}" is larger than 40 MB.`);
  let data = await readAsDataUrl(file);
  if (!/;base64,/.test(data)) data = `data:${file.type};base64,${btoa(unescape(encodeURIComponent(decodeURIComponent(data.split(',')[1]))))}`;
  const { width, height } = await measureImage(data);
  return { id: uid('as'), name: file.name.slice(0, 120), mime: file.type, data, width, height, bytes: dataUrlBytes(data), hash: await hashString(data) };
}

/** Adds an asset, re-using an identical existing one (by content hash). Mutates `assets`. */
export function addAssetDedup(assets: Project['assets'], asset: Asset): string {
  const existing = Object.values(assets).find((a) => a.hash === asset.hash);
  if (existing) return existing.id;
  assets[asset.id] = asset;
  return asset.id;
}

export interface OptimizeOptions {
  maxDimension: number;
  quality: number;
}

export const DEFAULT_OPTIMIZE: OptimizeOptions = { maxDimension: 1920, quality: 0.82 };

/**
 * Re-encodes large raster images (downscaled, WebP or JPEG) when that makes
 * them smaller. Asset ids are preserved so the project structure is unchanged.
 * GIFs (may be animated) and SVGs (vector) are left untouched.
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
  if (!/^image\/(png|jpeg|webp|bmp|avif)$/.test(a.mime)) return a;
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
