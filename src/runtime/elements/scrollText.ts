import type { RuntimeElementDef } from './types';
import { h, icon, num, SHADOWS } from './types';
import { fontStack } from '../fonts';
import { renderRichText } from '../format';

export interface ScrollTextProps {
  title: string;
  text: string;
  font: string;
  size: number;
  color: string;
  background: string;
  accent: string;
  padding: number;
  radius: number;
  borderWidth: number;
  borderColor: string;
  lineHeight: number;
  fadeEdges: boolean;
  shadow: string;
}

export const scrollTextDef: RuntimeElementDef<ScrollTextProps> = {
  id: 'scrollText',
  defaults: () => ({
    title: 'A little story',
    text: 'This panel scrolls on its own, so you can fit long passages into a tidy space.\n\nUse a blank line to start a new paragraph. Start a line with "- " for bullet points, or "# " for a heading.\n\n- Readers scroll with a mouse wheel, trackpad or finger\n- The rest of the page stays put\n- Colours and sizes are yours to choose\n\n# Keep going\n\nThere is plenty of room here for instructions, transcripts, poems, credits, terms or anything else that would otherwise crowd your design. **Bold text** works too.\n\nWhen readers reach the end, the fade at the bottom disappears to show there is nothing more to read.',
    font: 'rounded',
    size: 18,
    color: '#2b2840',
    background: '#ffffff',
    accent: '#6d4aff',
    padding: 28,
    radius: 20,
    borderWidth: 0,
    borderColor: '#e4e0f5',
    lineHeight: 1.6,
    fadeEdges: true,
    shadow: 'soft',
  }),
  render(el, { doc, env, onCleanup }) {
    const p = el.props;
    const node = h(doc, 'div', 'ofs-scrolltext', {
      background: p.background,
      color: p.color,
      borderRadius: `${num(p.radius, 0)}px`,
      border: num(p.borderWidth, 0) > 0 ? `${num(p.borderWidth, 0)}px solid ${p.borderColor}` : 'none',
      boxShadow: SHADOWS[p.shadow] ?? 'none',
      fontFamily: fontStack(p.font),
      fontSize: `${num(p.size, 18)}px`,
      lineHeight: String(num(p.lineHeight, 1.6)),
    });
    node.style.setProperty('--ofs-accent', p.accent || '#6d4aff');
    const body = h(doc, 'div', 'ofs-scrolltext-body', { padding: `${num(p.padding, 24)}px` });
    if (p.fadeEdges) node.classList.add('ofs-fade');
    if (p.title) {
      const t = h(doc, 'h2', 'ofs-scrolltext-title');
      t.textContent = p.title;
      body.appendChild(t);
    }
    body.appendChild(renderRichText(doc, String(p.text ?? '')));
    node.appendChild(body);
    const hint = h(doc, 'div', 'ofs-scrolltext-hint');
    hint.appendChild(icon(doc, 'chevron-down', 18));
    node.appendChild(hint);
    if (env.mode === 'play') body.tabIndex = 0;
    const update = () => {
      const max = body.scrollHeight - body.clientHeight;
      node.classList.toggle('ofs-at-top', body.scrollTop <= 2);
      node.classList.toggle('ofs-at-end', max <= 2 || body.scrollTop >= max - 2);
    };
    node.classList.add('ofs-at-top');
    body.addEventListener('scroll', update, { passive: true });
    onCleanup(() => body.removeEventListener('scroll', update));
    // Measure once laid out.
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(update) : 0;
    onCleanup(() => {
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    });
    return { node };
  },
};
