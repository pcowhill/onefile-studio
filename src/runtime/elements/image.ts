import type { RuntimeElementDef } from './types';
import { h, num, SHADOWS, svg } from './types';
import { imageFill } from './editedImage';
import type { MediaEdit } from '../../model/mediaEdit';

export interface ImageProps {
  assetId: string;
  fit: 'cover' | 'contain';
  radius: number;
  borderWidth: number;
  borderColor: string;
  shadow: string;
  alt: string;
  /** This element's own crop/rotate/flip (v3); null follows the media library's version. */
  edit: MediaEdit | null;
}

export function placeholder(doc: Document, label: string): HTMLElement {
  const box = h(doc, 'div', 'ofs-placeholder');
  const s = svg(doc, 'svg', { viewBox: '0 0 48 48', width: 44, height: 44, 'aria-hidden': 'true' });
  s.appendChild(svg(doc, 'rect', { x: 5, y: 9, width: 38, height: 30, rx: 6, fill: 'none', stroke: 'currentColor', 'stroke-width': 3 }));
  s.appendChild(svg(doc, 'circle', { cx: 17, cy: 19, r: 4, fill: 'currentColor' }));
  s.appendChild(svg(doc, 'path', { d: 'M8 36l11-11 8 8 5-5 9 9', fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
  box.appendChild(s);
  const t = h(doc, 'span');
  t.textContent = label;
  box.appendChild(t);
  return box;
}

export const imageDef: RuntimeElementDef<ImageProps> = {
  id: 'image',
  defaults: () => ({ assetId: '', fit: 'cover', radius: 16, borderWidth: 0, borderColor: '#ffffff', shadow: 'soft', alt: '', edit: null }),
  render(el, { doc, env }) {
    const p = el.props;
    const node = h(doc, 'div', 'ofs-image', {
      borderRadius: `${num(p.radius, 0)}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
      border: num(p.borderWidth, 0) > 0 ? `${num(p.borderWidth, 0)}px solid ${p.borderColor}` : 'none',
    });
    const pic = imageFill(doc, env.project, p.assetId, {
      fit: p.fit === 'contain' ? 'contain' : 'cover',
      alt: String(p.alt || env.project.assets[p.assetId]?.name || ''),
      edit: p.edit,
    });
    if (pic) {
      node.appendChild(pic);
    } else {
      node.appendChild(placeholder(doc, 'Image'));
    }
    return { node };
  },
};
