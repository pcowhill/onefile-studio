import type { RuntimeElementDef } from './types';
import { h, num, SHADOWS } from './types';
import { fontStack } from '../fonts';
import { hasTokens, interpolate } from '../format';

export interface TextProps {
  text: string;
  font: string;
  size: number;
  weight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  valign: 'top' | 'middle' | 'bottom';
  lineHeight: number;
  italic: boolean;
  letterSpacing: number;
  background: string;
  padding: number;
  radius: number;
  shadow: string;
}

export const textDef: RuntimeElementDef<TextProps> = {
  id: 'text',
  defaults: () => ({
    text: 'Your text here',
    font: 'rounded',
    size: 32,
    weight: 700,
    color: '#1d1b2c',
    align: 'left',
    valign: 'top',
    lineHeight: 1.25,
    italic: false,
    letterSpacing: 0,
    background: 'transparent',
    padding: 0,
    radius: 0,
    shadow: 'none',
  }),
  render(el, { doc, env, onCleanup }) {
    const p = el.props;
    const node = h(doc, 'div', 'ofs-text', {
      justifyContent: p.valign === 'middle' ? 'center' : p.valign === 'bottom' ? 'flex-end' : 'flex-start',
      textAlign: p.align,
      fontFamily: fontStack(p.font),
      fontSize: `${num(p.size, 32)}px`,
      fontWeight: String(num(p.weight, 400)),
      fontStyle: p.italic ? 'italic' : 'normal',
      lineHeight: String(num(p.lineHeight, 1.25)),
      letterSpacing: `${num(p.letterSpacing, 0)}em`,
      color: p.color,
      background: p.background || 'transparent',
      padding: `${num(p.padding, 0)}px`,
      borderRadius: `${num(p.radius, 0)}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
    });
    const span = h(doc, 'div', 'ofs-text-body');
    node.appendChild(span);
    const text = String(p.text ?? '');
    const paint = () => {
      span.textContent = interpolate(text, env.vars);
    };
    paint();
    if (hasTokens(text)) onCleanup(env.vars.subscribe(paint));
    return { node };
  },
};
