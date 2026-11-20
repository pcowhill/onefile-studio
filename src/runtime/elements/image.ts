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
      node.appendChild(emptyImage(doc, env.mode === 'edit'));
    }
    return { node };
  },
  css: `.ofs-image-empty{position:absolute;inset:0;border-radius:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px;text-align:center;overflow:hidden;color:#0b7a63;background:radial-gradient(120% 90% at 50% 0%,#e6fbf4,#d3f2e8 60%,#c4ecdf);font:800 15px/1.25 system-ui,-apple-system,'Segoe UI',sans-serif}
.ofs-image-empty::before{content:'';position:absolute;inset:8px;border:2px dashed currentColor;border-radius:inherit;opacity:.25;pointer-events:none}
.ofs-image-empty svg{width:clamp(36px,22%,96px);height:auto;filter:drop-shadow(0 6px 10px rgba(0,120,90,.18))}
.ofs-image-empty small{font-weight:600;font-size:12px;opacity:.75}`,
};

/** Friendly empty state: an illustrated frame, with a hint in the editor. */
function emptyImage(doc: Document, editing: boolean): HTMLElement {
  const box = h(doc, 'div', 'ofs-image-empty');
  const s = svg(doc, 'svg', { viewBox: '0 0 96 72', 'aria-hidden': 'true' });
  s.appendChild(svg(doc, 'rect', { x: 4, y: 4, width: 88, height: 64, rx: 12, fill: '#fff' }));
  s.appendChild(svg(doc, 'circle', { cx: 68, cy: 24, r: 8, fill: '#ffc94d' }));
  s.appendChild(svg(doc, 'path', { d: 'M8 62l24-26 16 16 10-10 30 22v2a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z', fill: '#00b894' }));
  s.appendChild(svg(doc, 'path', { d: 'M40 62l18-20 30 22v2H42z', fill: '#00987a', opacity: '.8' }));
  box.appendChild(s);
  const t = h(doc, 'strong');
  t.textContent = editing ? 'Add an image' : 'Image';
  box.appendChild(t);
  if (editing) {
    const sub = h(doc, 'small');
    sub.textContent = 'Choose one on the right';
    box.appendChild(sub);
  }
  return box;
}
