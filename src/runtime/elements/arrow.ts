import type { RuntimeElementDef } from './types';
import { h, num, svg } from './types';

export interface Pt {
  x: number;
  y: number;
}

export interface ArrowProps {
  color: string;
  width: number;
  /** Endpoints normalised to the element box (0..1). */
  start: Pt;
  end: Pt;
  /** Curvature, -1..1. */
  bend: number;
  head: 'triangle' | 'line' | 'none';
  tail: 'none' | 'dot' | 'triangle';
  dashed: boolean;
}

export interface ArrowGeometry {
  line: string;
  head?: { kind: 'triangle' | 'line'; d: string };
  tail?: { kind: 'dot' | 'triangle'; d?: string; cx?: number; cy?: number; r?: number };
}

export function arrowGeometry(p: ArrowProps, w: number, hgt: number): ArrowGeometry {
  const sw = Math.max(1, num(p.width, 6));
  const s = { x: num(p.start?.x, 0) * w, y: num(p.start?.y, 0.5) * hgt };
  const e = { x: num(p.end?.x, 1) * w, y: num(p.end?.y, 0.5) * hgt };
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bend = Math.max(-1, Math.min(1, num(p.bend, 0)));
  const c = { x: (s.x + e.x) / 2 + nx * bend * len * 0.5, y: (s.y + e.y) / 2 + ny * bend * len * 0.5 };
  const headLen = Math.min(len * 0.45, Math.max(12, sw * 3.4));
  const headW = headLen * 0.9;
  // Tangents at both ends.
  const tEnd = unit(bend ? { x: e.x - c.x, y: e.y - c.y } : { x: dx, y: dy });
  const tStart = unit(bend ? { x: s.x - c.x, y: s.y - c.y } : { x: -dx, y: -dy });
  let lineEnd = e;
  let lineStart = s;
  const out: ArrowGeometry = { line: '' };
  if (p.head === 'triangle') {
    lineEnd = { x: e.x - tEnd.x * headLen * 0.7, y: e.y - tEnd.y * headLen * 0.7 };
    out.head = { kind: 'triangle', d: triangle(e, tEnd, headLen, headW) };
  } else if (p.head === 'line') {
    out.head = { kind: 'line', d: chevron(e, tEnd, headLen, headW) };
  }
  if (p.tail === 'triangle') {
    lineStart = { x: s.x - tStart.x * headLen * 0.7, y: s.y - tStart.y * headLen * 0.7 };
    out.tail = { kind: 'triangle', d: triangle(s, tStart, headLen, headW) };
  } else if (p.tail === 'dot') {
    out.tail = { kind: 'dot', cx: s.x, cy: s.y, r: Math.max(4, sw * 1.2) };
  }
  out.line = bend
    ? `M${f(lineStart.x)} ${f(lineStart.y)} Q${f(c.x)} ${f(c.y)} ${f(lineEnd.x)} ${f(lineEnd.y)}`
    : `M${f(lineStart.x)} ${f(lineStart.y)} L${f(lineEnd.x)} ${f(lineEnd.y)}`;
  return out;
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();
function unit(v: Pt): Pt {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}
function triangle(tip: Pt, t: Pt, len: number, w: number): string {
  const bx = tip.x - t.x * len;
  const by = tip.y - t.y * len;
  const nx = -t.y;
  const ny = t.x;
  return `M${f(tip.x)} ${f(tip.y)} L${f(bx + (nx * w) / 2)} ${f(by + (ny * w) / 2)} L${f(bx - (nx * w) / 2)} ${f(by - (ny * w) / 2)} Z`;
}
function chevron(tip: Pt, t: Pt, len: number, w: number): string {
  const bx = tip.x - t.x * len;
  const by = tip.y - t.y * len;
  const nx = -t.y;
  const ny = t.x;
  return `M${f(bx + (nx * w) / 2)} ${f(by + (ny * w) / 2)} L${f(tip.x)} ${f(tip.y)} L${f(bx - (nx * w) / 2)} ${f(by - (ny * w) / 2)}`;
}

export const arrowDef: RuntimeElementDef<ArrowProps> = {
  id: 'arrow',
  defaults: () => ({
    color: '#ff5d73',
    width: 8,
    start: { x: 0.04, y: 0.5 },
    end: { x: 0.96, y: 0.5 },
    bend: 0,
    head: 'triangle',
    tail: 'none',
    dashed: false,
  }),
  render(el, { doc }) {
    const p = el.props;
    const node = h(doc, 'div', 'ofs-arrow');
    const w = Math.max(1, el.w);
    const ht = Math.max(1, el.h);
    const g = arrowGeometry(p, w, ht);
    const sw = Math.max(1, num(p.width, 6));
    const s = svg(doc, 'svg', { viewBox: `0 0 ${w} ${ht}`, width: '100%', height: '100%' });
    const line = svg(doc, 'path', {
      d: g.line,
      fill: 'none',
      stroke: p.color,
      'stroke-width': sw,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: 'ofs-arrow-line',
    });
    if (p.dashed) line.setAttribute('stroke-dasharray', `${sw * 2.2} ${sw * 1.8}`);
    s.appendChild(line);
    const addEnd = (d: { kind: string; d?: string; cx?: number; cy?: number; r?: number }) => {
      if (d.kind === 'dot') {
        s.appendChild(svg(doc, 'circle', { cx: d.cx!, cy: d.cy!, r: d.r!, fill: p.color, class: 'ofs-arrow-head' }));
      } else if (d.kind === 'triangle') {
        s.appendChild(
          svg(doc, 'path', {
            d: d.d!,
            fill: p.color,
            stroke: p.color,
            'stroke-width': Math.max(1, sw * 0.35),
            'stroke-linejoin': 'round',
            class: 'ofs-arrow-head',
          }),
        );
      } else {
        s.appendChild(
          svg(doc, 'path', {
            d: d.d!,
            fill: 'none',
            stroke: p.color,
            'stroke-width': sw,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            class: 'ofs-arrow-head',
          }),
        );
      }
    };
    if (g.head) addEnd(g.head);
    if (g.tail) addEnd(g.tail);
    node.appendChild(s);
    return { node };
  },
};
