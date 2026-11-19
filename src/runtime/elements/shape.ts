import type { RuntimeElementDef } from './types';
import { DROP_SHADOWS, h, num, SHADOWS, svg } from './types';
import type { Paint } from '../../model/types';
import { paintToCss } from '../../model/paint';

export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'diamond' | 'star' | 'heart' | 'hexagon' | 'blob';

export interface ShapeProps {
  shape: ShapeKind;
  fill: Paint;
  stroke: string;
  strokeWidth: number;
  radius: number;
  shadow: string;
  opacity: number;
}

/** Paths drawn in a 100×100 box and stretched to the element size. */
export const SHAPE_PATHS: Record<string, string> = Object.assign(Object.create(null), {
  triangle: 'M50 3 L97 95 L3 95 Z',
  diamond: 'M50 2 L98 50 L50 98 L2 50 Z',
  star: 'M50 3 L62.2 35.5 L97 37.3 L69.8 59 L79 92.7 L50 73.5 L21 92.7 L30.2 59 L3 37.3 L37.8 35.5 Z',
  heart: 'M50 92 C22 72 3 56 3 32 C3 15 16 4 30 4 C40 4 46 10 50 17 C54 10 60 4 70 4 C84 4 97 15 97 32 C97 56 78 72 50 92 Z',
  hexagon: 'M27 4 L73 4 L97 50 L73 96 L27 96 L3 50 Z',
  blob: 'M52 4 C74 3 95 18 96 42 C98 66 84 92 58 96 C33 100 9 86 4 62 C-1 38 14 6 52 4 Z',
});

let gradSeq = 0;

export const shapeDef: RuntimeElementDef<ShapeProps> = {
  id: 'shape',
  defaults: () => ({
    shape: 'rect',
    fill: { kind: 'linear', from: '#8b6cff', to: '#5b3df5', angle: 135 },
    stroke: '#ffffff',
    strokeWidth: 0,
    radius: 24,
    shadow: 'soft',
    opacity: 1,
  }),
  render(el, { doc }) {
    const p = el.props;
    const sw = num(p.strokeWidth, 0);
    const opacity = String(Math.max(0, Math.min(1, num(p.opacity, 1))));
    if (p.shape === 'rect' || p.shape === 'ellipse' || !SHAPE_PATHS[p.shape]) {
      const node = h(doc, 'div', 'ofs-shape', {
        background: paintToCss(p.fill),
        borderRadius: p.shape === 'ellipse' ? '50%' : `${num(p.radius, 0)}px`,
        border: sw > 0 ? `${sw}px solid ${p.stroke}` : 'none',
        boxShadow: SHADOWS[p.shadow] ?? 'none',
        opacity,
      });
      return { node };
    }
    const node = h(doc, 'div', 'ofs-shape ofs-shape-svg', { opacity });
    if (p.shadow && p.shadow !== 'none') node.style.filter = DROP_SHADOWS[p.shadow] ?? DROP_SHADOWS.soft;
    const s = svg(doc, 'svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', width: '100%', height: '100%' });
    let fill: string;
    if (p.fill?.kind === 'linear') {
      const gid = `ofs-g${++gradSeq}`;
      const defs = svg(doc, 'defs');
      const a = ((num(p.fill.angle, 135) - 90) * Math.PI) / 180;
      const grad = svg(doc, 'linearGradient', {
        id: gid,
        x1: 0.5 - Math.cos(a) / 2,
        y1: 0.5 - Math.sin(a) / 2,
        x2: 0.5 + Math.cos(a) / 2,
        y2: 0.5 + Math.sin(a) / 2,
      });
      grad.appendChild(svg(doc, 'stop', { offset: 0, 'stop-color': p.fill.from }));
      grad.appendChild(svg(doc, 'stop', { offset: 1, 'stop-color': p.fill.to }));
      defs.appendChild(grad);
      s.appendChild(defs);
      fill = `url(#${gid})`;
    } else fill = p.fill?.kind === 'solid' ? p.fill.color : '#8b6cff';
    s.appendChild(
      svg(doc, 'path', {
        d: SHAPE_PATHS[p.shape],
        fill,
        stroke: sw > 0 ? p.stroke : 'none',
        'stroke-width': sw,
        'vector-effect': 'non-scaling-stroke',
        'stroke-linejoin': 'round',
      }),
    );
    node.appendChild(s);
    return { node };
  },
};
