import type { Project } from '../../model/types';
import type { MediaEdit } from '../../model/mediaEdit';
import { isIdentity, orientationMatrix, orientedSize, resolveEdit } from '../../model/mediaEdit';
import { assetUrl } from '../env';
import { h, svg } from './types';

/**
 * Renders an image asset filling its parent (100% × 100%), honouring the
 * nondestructive edit (crop, quarter-turn rotation, flips) and a fit mode.
 *
 * Unedited images are plain `<img>` elements with object-fit, exactly as in
 * v0.2. Edited ones are a tiny inline SVG: the viewBox is the crop (in pixels
 * of the rotated picture), `preserveAspectRatio` gives cover/contain, and the
 * original bitmap is drawn through an orientation matrix. This scales cleanly
 * on any slide size, needs no canvas re-encoding (no quality loss), and the
 * original pixels stay in the file so the edit can always be changed.
 */
export function imageFill(
  doc: Document,
  project: Project,
  assetId: unknown,
  opts: { fit: 'cover' | 'contain'; alt: string; edit?: unknown; className?: string },
): HTMLElement | SVGSVGElement | null {
  const url = assetUrl(project, assetId);
  if (!url) return null;
  const asset = project.assets[assetId as string];
  const edit = resolveEdit(project, assetId, opts.edit);
  if (isIdentity(edit) || !(asset.width > 0 && asset.height > 0)) {
    const img = h(doc, 'img', opts.className);
    img.src = url;
    img.alt = opts.alt;
    img.draggable = false;
    img.style.objectFit = opts.fit === 'contain' ? 'contain' : 'cover';
    return img;
  }
  return editedSvg(doc, url, asset.width, asset.height, edit, opts.fit, opts.alt, opts.className);
}

/** The SVG for an edited picture (exported for the editor's previews). */
export function editedSvg(
  doc: Document,
  url: string,
  width: number,
  height: number,
  edit: MediaEdit,
  fit: 'cover' | 'contain',
  alt: string,
  className = '',
): SVGSVGElement {
  const o = orientedSize(width, height, edit.rotate);
  const c = edit.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const view = [c.x * o.width, c.y * o.height, c.w * o.width, c.h * o.height].map((n) => Math.round(n * 1000) / 1000);
  const root = svg(doc, 'svg', {
    viewBox: view.join(' '),
    preserveAspectRatio: `xMidYMid ${fit === 'contain' ? 'meet' : 'slice'}`,
    role: 'img',
    class: `ofs-edimg ${className}`.trim(),
  });
  if (alt) root.setAttribute('aria-label', alt);
  const image = svg(doc, 'image', {
    x: 0,
    y: 0,
    width,
    height,
    preserveAspectRatio: 'none',
    transform: `matrix(${orientationMatrix(width, height, edit).join(' ')})`,
  });
  image.setAttribute('href', url);
  image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
  root.appendChild(image);
  return root;
}

export const EDITED_IMAGE_CSS = `.ofs-edimg{display:block;width:100%;height:100%;overflow:hidden;user-select:none;pointer-events:none}`;
