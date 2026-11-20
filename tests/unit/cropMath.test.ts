import { describe, expect, it } from 'vitest';
import { dragCrop, fitAspect, formatPrecise, FULL, minSide, moveTrim, normAspect } from '../../src/editor/media/cropMath';

const close = (actual: object, b: Record<string, number>) => {
  const a = actual as Record<string, number>;
  for (const k of Object.keys(b)) expect(a[k]).toBeCloseTo(b[k], 5);
};

describe('crop geometry', () => {
  it('moves without leaving the picture', () => {
    const c = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
    expect(dragCrop(c, 'move', 0.1, -0.1, null)).toEqual({ x: 0.30000000000000004, y: 0.1, w: 0.5, h: 0.5 });
    expect(dragCrop(c, 'move', 5, 5, null)).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
    expect(dragCrop(c, 'move', -5, -5, null)).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 });
  });

  it('resizes freely from edges and corners, keeping a minimum size', () => {
    close(dragCrop(FULL, 'se', -0.5, -0.25, null), { x: 0, y: 0, w: 0.5, h: 0.75 });
    close(dragCrop(FULL, 'nw', 0.1, 0.2, null), { x: 0.1, y: 0.2, w: 0.9, h: 0.8 });
    close(dragCrop(FULL, 'w', 2, 0, null, 0.05, 0.05), { x: 0.95, w: 0.05 });
    close(dragCrop(FULL, 'n', 0, 0.3, null), { y: 0.3, h: 0.7 });
  });

  it('keeps a locked aspect ratio while resizing from a corner, anchored at the opposite corner', () => {
    // Square crop on a 2:1 picture: normalised aspect 0.5.
    const a = normAspect(1, 2);
    const start = { x: 0, y: 0, w: 0.5, h: 1 };
    const r = dragCrop(start, 'se', -0.25, 0, a);
    expect(r.w / r.h).toBeCloseTo(a);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    // Growing beyond the picture is capped.
    const big = dragCrop({ x: 0.5, y: 0.5, w: 0.25, h: 0.5 }, 'se', 1, 1, a);
    expect(big.x + big.w).toBeLessThanOrEqual(1.000001);
    expect(big.y + big.h).toBeLessThanOrEqual(1.000001);
    expect(big.w / big.h).toBeCloseTo(a);
    const nw = dragCrop({ x: 0.5, y: 0.5, w: 0.25, h: 0.5 }, 'nw', -1, -1, a);
    expect(nw.x + nw.w).toBeCloseTo(0.75);
    expect(nw.y + nw.h).toBeCloseTo(1);
    expect(nw.w / nw.h).toBeCloseTo(a);
  });

  it('keeps a locked aspect ratio from an edge handle', () => {
    const r = dragCrop({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, 'e', 0.1, 0, 1);
    expect(r.w).toBeCloseTo(0.5);
    expect(r.h).toBeCloseTo(0.5);
    const s = dragCrop({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, 's', 0, 0.1, 1);
    expect(s.w / s.h).toBeCloseTo(1);
  });

  it('fits the largest rectangle of a shape inside the picture', () => {
    // 16:9 on a 4:3 picture.
    const r = fitAspect(FULL, normAspect(16 / 9, 4 / 3));
    expect(r.w).toBeCloseTo(1);
    expect(r.h).toBeCloseTo(0.75);
    expect(r.y).toBeCloseTo(0.125);
    const sq = fitAspect(FULL, normAspect(1, 16 / 9));
    expect(sq.h).toBeCloseTo(1);
    expect(sq.w).toBeCloseTo(9 / 16);
  });

  it('never allows crops below 16 pixels', () => {
    expect(minSide(100)).toBeCloseTo(0.16);
    expect(minSide(10000)).toBe(0.02);
    expect(minSide(0)).toBe(0.02);
  });
});

describe('trim geometry', () => {
  it('keeps start before end with a minimum length, inside the file', () => {
    expect(moveTrim({ start: 0, end: 10 }, 'start', 4, 10)).toEqual({ start: 4, end: 10 });
    expect(moveTrim({ start: 0, end: 10 }, 'start', 12, 10)).toEqual({ start: 9.9, end: 10 });
    expect(moveTrim({ start: 0, end: 10 }, 'start', -3, 10)).toEqual({ start: 0, end: 10 });
    expect(moveTrim({ start: 4, end: 10 }, 'end', 2, 10)).toEqual({ start: 4, end: 4.1 });
    expect(moveTrim({ start: 4, end: 8 }, 'end', 50, 10)).toEqual({ start: 4, end: 10 });
  });

  it('formats precise times', () => {
    expect(formatPrecise(0)).toBe('0:00.0');
    expect(formatPrecise(4.26)).toBe('0:04.3');
    expect(formatPrecise(65.04)).toBe('1:05.0');
    expect(formatPrecise(NaN)).toBe('0:00.0');
  });
});
