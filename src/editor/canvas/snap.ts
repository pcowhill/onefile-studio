export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Guide {
  axis: 'x' | 'y';
  pos: number;
}

/**
 * Snaps a moving box to page edges/centre and to other elements' edges/centres.
 * Returns the adjusted offset and the guide lines to draw.
 */
export function snapBox(box: Box, others: Box[], page: { w: number; h: number }, threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const xs = [0, page.w / 2, page.w];
  const ys = [0, page.h / 2, page.h];
  for (const o of others) {
    xs.push(o.x, o.x + o.w / 2, o.x + o.w);
    ys.push(o.y, o.y + o.h / 2, o.y + o.h);
  }
  const best = (edges: number[], cands: number[]) => {
    let d = Infinity;
    let at = 0;
    for (const e of edges)
      for (const c of cands) {
        const dist = c - e;
        if (Math.abs(dist) < Math.abs(d)) {
          d = dist;
          at = c;
        }
      }
    return { d, at };
  };
  const bx = best([box.x, box.x + box.w / 2, box.x + box.w], xs);
  const by = best([box.y, box.y + box.h / 2, box.y + box.h], ys);
  const guides: Guide[] = [];
  let dx = 0;
  let dy = 0;
  if (Math.abs(bx.d) <= threshold) {
    dx = bx.d;
    guides.push({ axis: 'x', pos: bx.at });
  }
  if (Math.abs(by.d) <= threshold) {
    dy = by.d;
    guides.push({ axis: 'y', pos: by.at });
  }
  return { dx, dy, guides };
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Resizes a (possibly rotated) box by dragging `handle` by (dx, dy) screen-aligned logical units. */
export function resizeBox(start: Box, rotation: number, handle: Handle, dx: number, dy: number, keepAspect: boolean, minSize = 8): Box {
  const t = (rotation * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const ldx = dx * cos + dy * sin;
  const ldy = -dx * sin + dy * cos;
  let l = -start.w / 2;
  let r = start.w / 2;
  let tp = -start.h / 2;
  let b = start.h / 2;
  if (handle.includes('e')) r += ldx;
  if (handle.includes('w')) l += ldx;
  if (handle.includes('s')) b += ldy;
  if (handle.includes('n')) tp += ldy;
  if (r - l < minSize) {
    if (handle.includes('w')) l = r - minSize;
    else r = l + minSize;
  }
  if (b - tp < minSize) {
    if (handle.includes('n')) tp = b - minSize;
    else b = tp + minSize;
  }
  if (keepAspect && handle.length === 2) {
    const ratio = start.w / start.h;
    const w = r - l;
    const h = b - tp;
    if (w / h > ratio) {
      const nh = w / ratio;
      if (handle.includes('n')) tp = b - nh;
      else b = tp + nh;
    } else {
      const nw = h * ratio;
      if (handle.includes('w')) l = r - nw;
      else r = l + nw;
    }
  }
  const w = r - l;
  const h = b - tp;
  const cx = (l + r) / 2;
  const cy = (tp + b) / 2;
  const gx = cx * cos - cy * sin;
  const gy = cx * sin + cy * cos;
  const ocx = start.x + start.w / 2 + gx;
  const ocy = start.y + start.h / 2 + gy;
  return { x: Math.round(ocx - w / 2), y: Math.round(ocy - h / 2), w: Math.round(w), h: Math.round(h) };
}
