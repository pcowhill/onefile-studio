import type { CropRect } from '../../model/mediaEdit';
import { MIN_CROP, MIN_TRIM } from '../../model/mediaEdit';

/**
 * Pure geometry for the crop and trim editors. Crop rectangles are normalised
 * (0..1) to the displayed picture; an aspect ratio in pixels becomes a
 * normalised one by dividing by the picture's own aspect.
 */

export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Normalised aspect (w/h of the rect in 0..1 units) for a pixel aspect on a picture of `pictureAspect`. */
export const normAspect = (pixelAspect: number, pictureAspect: number) => pixelAspect / pictureAspect;

/** The minimum crop side in normalised units (at least 16 px, at least MIN_CROP). */
export function minSide(pixels: number): number {
  return pixels > 0 ? Math.min(1, Math.max(MIN_CROP, 16 / pixels)) : MIN_CROP;
}

/**
 * The largest rectangle with normalised aspect `a` that fits in the picture,
 * centred on `around`'s centre (shifted to stay inside).
 */
export function fitAspect(around: CropRect, a: number): CropRect {
  let w = 1;
  let h = 1 / a;
  if (h > 1) {
    h = 1;
    w = a;
  }
  // Keep roughly the current size when it is smaller than the maximum.
  const scale = Math.min(1, Math.max(around.w / w, around.h / h));
  w *= scale;
  h *= scale;
  const cx = around.x + around.w / 2;
  const cy = around.y + around.h / 2;
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
}

/**
 * The crop after dragging `handle` by (dx, dy) normalised units from `start`.
 * `a` (normalised aspect) locks the ratio; `minW`/`minH` keep it usable.
 */
export function dragCrop(start: CropRect, handle: Handle, dx: number, dy: number, a: number | null, minW = MIN_CROP, minH = MIN_CROP): CropRect {
  if (handle === 'move') {
    return { ...start, x: clamp(start.x + dx, 0, 1 - start.w), y: clamp(start.y + dy, 0, 1 - start.h) };
  }
  let x1 = start.x;
  let y1 = start.y;
  let x2 = start.x + start.w;
  let y2 = start.y + start.h;
  if (handle.includes('w')) x1 = clamp(x1 + dx, 0, x2 - minW);
  if (handle.includes('e')) x2 = clamp(x2 + dx, x1 + minW, 1);
  if (handle.includes('n')) y1 = clamp(y1 + dy, 0, y2 - minH);
  if (handle.includes('s')) y2 = clamp(y2 + dy, y1 + minH, 1);
  if (!a) return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };

  const corner = handle.length === 2;
  if (corner) {
    // Anchor the opposite corner; follow the larger movement.
    const ax = handle.includes('w') ? start.x + start.w : start.x;
    const ay = handle.includes('n') ? start.y + start.h : start.y;
    let w = x2 - x1;
    let h = y2 - y1;
    if (w / h > a) h = w / a;
    else w = h * a;
    const maxW = handle.includes('w') ? ax : 1 - ax;
    const maxH = handle.includes('n') ? ay : 1 - ay;
    if (w > maxW) {
      w = maxW;
      h = w / a;
    }
    if (h > maxH) {
      h = maxH;
      w = h * a;
    }
    if (w < minW) {
      w = minW;
      h = w / a;
    }
    if (h < minH) {
      h = minH;
      w = h * a;
    }
    return { x: handle.includes('w') ? ax - w : ax, y: handle.includes('n') ? ay - h : ay, w, h };
  }
  // Edge: the other side follows, centred on the start rectangle.
  if (handle === 'e' || handle === 'w') {
    let w = x2 - x1;
    let h = w / a;
    if (h > 1) {
      h = 1;
      w = h * a;
    }
    const x = handle === 'w' ? start.x + start.w - w : start.x;
    const cy = start.y + start.h / 2;
    return { x: clamp(x, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
  }
  let h = y2 - y1;
  let w = h * a;
  if (w > 1) {
    w = 1;
    h = w / a;
  }
  const y = handle === 'n' ? start.y + start.h - h : start.y;
  const cx = start.x + start.w / 2;
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(y, 0, 1 - h), w, h };
}

/** Moves one end of a trim range, keeping at least MIN_TRIM between the ends and both inside [0, duration]. */
export function moveTrim(range: { start: number; end: number }, which: 'start' | 'end', t: number, duration: number): { start: number; end: number } {
  if (which === 'start') return { start: clamp(t, 0, Math.max(0, range.end - MIN_TRIM)), end: range.end };
  return { start: range.start, end: clamp(t, Math.min(duration, range.start + MIN_TRIM), duration) };
}

/** "1:05.3" — minutes, seconds and tenths (trim labels). */
export function formatPrecise(seconds: number): string {
  const s = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const tenths = Math.round(s * 10);
  const m = Math.floor(tenths / 600);
  const rest = (tenths % 600) / 10;
  return `${m}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`;
}
