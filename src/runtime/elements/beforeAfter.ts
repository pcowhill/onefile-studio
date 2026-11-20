import type { RuntimeElementDef } from './types';
import { h, icon, num, SHADOWS } from './types';
import { imageFill } from './editedImage';
import { placeholder } from './image';

export interface BeforeAfterProps {
  before: string;
  after: string;
  /** Initial divider position, 0..100. */
  position: number;
  orientation: 'horizontal' | 'vertical';
  handle: 'circle' | 'line' | 'pill';
  accent: string;
  showLabels: boolean;
  beforeLabel: string;
  afterLabel: string;
  radius: number;
  shadow: string;
}

export const beforeAfterDef: RuntimeElementDef<BeforeAfterProps> = {
  id: 'beforeAfter',
  defaults: () => ({
    before: '',
    after: '',
    position: 50,
    orientation: 'horizontal',
    handle: 'circle',
    accent: '#ffffff',
    showLabels: true,
    beforeLabel: 'Before',
    afterLabel: 'After',
    radius: 18,
    shadow: 'lifted',
  }),
  render(el, { doc, env, onCleanup }) {
    const p = el.props;
    const vertical = p.orientation === 'vertical';
    const node = h(doc, 'div', `ofs-ba ofs-ba-${vertical ? 'v' : 'h'} ofs-ba-handle-${p.handle}`, {
      borderRadius: `${num(p.radius, 0)}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
    });
    node.style.setProperty('--ofs-ba-accent', p.accent || '#fff');
    const layer = (assetId: string, cls: string, label: string) => {
      const wrap = h(doc, 'div', `ofs-ba-layer ${cls}`);
      const img = imageFill(doc, env.project, assetId, { fit: 'cover', alt: label });
      if (img) {
        wrap.appendChild(img);
      } else wrap.appendChild(placeholder(doc, label + ' image'));
      return wrap;
    };
    const after = layer(p.after, 'ofs-ba-after', p.afterLabel || 'After');
    const before = layer(p.before, 'ofs-ba-before', p.beforeLabel || 'Before');
    node.append(after, before);
    if (p.showLabels) {
      const lb = h(doc, 'span', 'ofs-ba-label ofs-ba-label-before');
      lb.textContent = p.beforeLabel;
      const la = h(doc, 'span', 'ofs-ba-label ofs-ba-label-after');
      la.textContent = p.afterLabel;
      node.append(lb, la);
    }
    const divider = h(doc, 'div', 'ofs-ba-divider');
    const knob = h(doc, 'div', 'ofs-ba-knob');
    if (p.handle !== 'line') {
      knob.append(icon(doc, vertical ? 'chevron-left' : 'chevron-left', 16), icon(doc, 'chevron-right', 16));
    }
    divider.appendChild(knob);
    node.appendChild(divider);

    let pos = Math.max(0, Math.min(100, num(p.position, 50)));
    const apply = () => {
      before.style.clipPath = vertical ? `inset(0 0 ${100 - pos}% 0)` : `inset(0 ${100 - pos}% 0 0)`;
      if (vertical) divider.style.top = `${pos}%`;
      else divider.style.left = `${pos}%`;
      knob.setAttribute('aria-valuenow', String(Math.round(pos)));
    };
    apply();
    node.dataset.position = String(pos);

    if (env.mode === 'play') {
      knob.tabIndex = 0;
      knob.setAttribute('role', 'slider');
      knob.setAttribute('aria-label', `${p.beforeLabel} / ${p.afterLabel} comparison`);
      knob.setAttribute('aria-valuemin', '0');
      knob.setAttribute('aria-valuemax', '100');
      const setFromEvent = (e: PointerEvent) => {
        const r = node.getBoundingClientRect();
        const span = vertical ? r.height : r.width;
        if (!span) return;
        const v = vertical ? (e.clientY - r.top) / span : (e.clientX - r.left) / span;
        pos = Math.max(0, Math.min(100, v * 100));
        node.dataset.position = String(Math.round(pos));
        apply();
      };
      let dragging = false;
      const down = (e: PointerEvent) => {
        if (e.button !== 0) return;
        dragging = true;
        e.stopPropagation();
        node.classList.add('ofs-ba-dragging');
        try {
          node.setPointerCapture(e.pointerId);
        } catch {
          /* not supported */
        }
        setFromEvent(e);
      };
      const move = (e: PointerEvent) => {
        if (dragging) setFromEvent(e);
      };
      const up = () => {
        dragging = false;
        node.classList.remove('ofs-ba-dragging');
      };
      const key = (e: KeyboardEvent) => {
        const step = e.shiftKey ? 10 : 2;
        if (['ArrowLeft', 'ArrowUp'].includes(e.key)) pos = Math.max(0, pos - step);
        else if (['ArrowRight', 'ArrowDown'].includes(e.key)) pos = Math.min(100, pos + step);
        else return;
        e.preventDefault();
        e.stopPropagation();
        node.dataset.position = String(Math.round(pos));
        apply();
      };
      node.addEventListener('pointerdown', down);
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
      node.addEventListener('pointercancel', up);
      knob.addEventListener('keydown', key);
      onCleanup(() => {
        node.removeEventListener('pointerdown', down);
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
        node.removeEventListener('pointercancel', up);
        knob.removeEventListener('keydown', key);
      });
    }
    return { node };
  },
};
