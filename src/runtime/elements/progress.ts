import type { RuntimeElementDef } from './types';
import { h, num, svg } from './types';
import type { Paint } from '../../model/types';
import { paintPrimary, paintToCss } from '../../model/paint';
import { formatNumber } from '../format';
import { fontStack } from '../fonts';

export interface ProgressProps {
  /** "slides" = presentation position, "scroll" = reading progress, "variable" = a number variable. */
  source: 'slides' | 'scroll' | 'variable';
  variableId: string;
  max: number;
  style: 'bar' | 'ring';
  fill: Paint;
  track: string;
  label: 'none' | 'percent' | 'value' | 'fraction';
  labelColor: string;
}

export const progressDef: RuntimeElementDef<ProgressProps> = {
  id: 'progress',
  defaults: () => ({
    source: 'slides',
    variableId: '',
    max: 100,
    style: 'bar',
    fill: { kind: 'linear', from: '#ff7eb3', to: '#6d4aff', angle: 90 },
    track: 'rgba(109, 74, 255, 0.14)',
    label: 'none',
    labelColor: '#1d1b2c',
  }),
  render(el, { doc, env, onCleanup }) {
    const p = el.props;
    const node = h(doc, 'div', `ofs-progress ofs-progress-${p.style}`);
    node.setAttribute('role', 'progressbar');
    node.setAttribute('aria-valuemin', '0');
    node.setAttribute('aria-valuemax', '100');
    const label = h(doc, 'span', 'ofs-progress-label', { color: p.labelColor, fontFamily: fontStack('rounded') });
    let setFrac: (f: number) => void;
    if (p.style === 'ring') {
      const size = Math.min(el.w, el.h);
      const stroke = Math.max(6, size * 0.12);
      const r = (size - stroke) / 2;
      const c = 2 * Math.PI * r;
      const s = svg(doc, 'svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size });
      s.appendChild(svg(doc, 'circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: p.track, 'stroke-width': stroke }));
      const arc = svg(doc, 'circle', {
        cx: size / 2,
        cy: size / 2,
        r,
        fill: 'none',
        stroke: paintPrimary(p.fill),
        'stroke-width': stroke,
        'stroke-linecap': 'round',
        'stroke-dasharray': `${c} ${c}`,
        transform: `rotate(-90 ${size / 2} ${size / 2})`,
        class: 'ofs-progress-arc',
      });
      s.appendChild(arc);
      node.appendChild(s);
      label.style.fontSize = `${Math.max(12, size * 0.22)}px`;
      setFrac = (f) => arc.setAttribute('stroke-dashoffset', String(c * (1 - f)));
    } else {
      const track = h(doc, 'div', 'ofs-progress-track', { background: p.track });
      const fill = h(doc, 'div', 'ofs-progress-fill', { background: paintToCss(p.fill) });
      track.appendChild(fill);
      node.appendChild(track);
      label.style.fontSize = `${Math.max(11, Math.min(22, el.h * 0.55))}px`;
      setFrac = (f) => {
        fill.style.width = `${f * 100}%`;
      };
    }
    if (p.label !== 'none') node.appendChild(label);
    if (p.label !== 'none' && p.style === 'bar' && el.h < 26) node.classList.add('ofs-progress-label-outside');

    const compute = (): { frac: number; text: string } => {
      if (p.source === 'variable') {
        const v = env.vars.list().find((x) => x.id === p.variableId);
        const value = v ? env.vars.get(v.id) : 0;
        const max = num(p.max, 100) || 100;
        const frac = Math.max(0, Math.min(1, value / max));
        const text =
          p.label === 'percent' ? `${Math.round(frac * 100)}%` : p.label === 'fraction' ? `${formatNumber(value)} / ${formatNumber(max)}` : formatNumber(value);
        return { frac, text };
      }
      if (p.source === 'scroll') {
        const frac = env.mode === 'play' ? env.nav.scroll : 0.35;
        return { frac, text: `${Math.round(frac * 100)}%` };
      }
      const count = Math.max(1, env.nav.count);
      const frac = count <= 1 ? 1 : (env.nav.index + 1) / count;
      const text = p.label === 'percent' ? `${Math.round(frac * 100)}%` : `${env.nav.index + 1} / ${count}`;
      return { frac, text };
    };
    const update = () => {
      const { frac, text } = compute();
      setFrac(frac);
      label.textContent = text;
      node.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
      node.dataset.value = String(Math.round(frac * 1000) / 1000);
    };
    update();
    if (p.source === 'variable') onCleanup(env.vars.subscribe(update));
    else onCleanup(env.nav.subscribe(update));
    return { node };
  },
};
