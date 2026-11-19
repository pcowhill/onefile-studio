import type { RenderCtx, RuntimeElementDef } from './types';
import { h, icon, num, SHADOWS } from './types';
import { contrastText, shade, withAlpha } from '../../model/paint';
import { fontStack } from '../fonts';
import type { SceneElement } from '../../model/types';

export interface ButtonProps {
  label: string;
  variant: 'solid' | 'soft' | 'outline' | 'ghost';
  color: string;
  size: number;
  radius: 'square' | 'rounded' | 'pill';
  icon: string;
  iconSide: 'left' | 'right';
  font: string;
  shadow: boolean;
}

export interface NavButtonProps extends ButtonProps {
  /** "next" | "prev" | "first" | "last" | a page id. */
  target: string;
}

export function buttonDefaults(): ButtonProps {
  return {
    label: 'Click me',
    variant: 'solid',
    color: '#6d4aff',
    size: 20,
    radius: 'pill',
    icon: 'none',
    iconSide: 'right',
    font: 'rounded',
    shadow: true,
  };
}

export function renderButton(el: SceneElement<ButtonProps>, { doc, env }: RenderCtx): HTMLButtonElement {
  const p = el.props;
  const color = p.color || '#6d4aff';
  const size = num(p.size, 20);
  const btn = h(doc, 'button', `ofs-button ofs-button-${p.variant}`);
  btn.type = 'button';
  if (env.mode !== 'play') btn.tabIndex = -1;
  const radius = p.radius === 'square' ? '6px' : p.radius === 'rounded' ? `${Math.round(size * 0.6)}px` : '999px';
  const s = btn.style;
  s.fontFamily = fontStack(p.font);
  s.fontSize = `${size}px`;
  s.borderRadius = radius;
  s.setProperty('--ofs-btn', color);
  s.setProperty('--ofs-btn-hover', shade(color, -0.12));
  if (p.variant === 'solid') {
    s.background = color;
    s.color = contrastText(color);
    if (p.shadow) s.boxShadow = `0 6px 0 ${shade(color, -0.28)}, ${SHADOWS.soft}`;
  } else if (p.variant === 'soft') {
    s.background = withAlpha(color, 0.16);
    s.color = shade(color, -0.25);
  } else if (p.variant === 'outline') {
    s.background = 'transparent';
    s.border = `${Math.max(2, Math.round(size / 8))}px solid ${color}`;
    s.color = color;
  } else {
    s.background = 'transparent';
    s.color = color;
  }
  if (p.shadow && p.variant !== 'solid' && p.variant !== 'ghost') s.boxShadow = SHADOWS.soft;
  const label = h(doc, 'span', 'ofs-button-label');
  label.textContent = p.label;
  if (p.icon && p.icon !== 'none') {
    const ic = icon(doc, p.icon, Math.round(size * 1.05), p.icon === 'star' || p.icon === 'heart' || p.icon === 'play');
    if (p.iconSide === 'left') btn.append(ic, label);
    else btn.append(label, ic);
  } else btn.append(label);
  if (!p.label) btn.setAttribute('aria-label', p.icon);
  return btn;
}

export const buttonDef: RuntimeElementDef<ButtonProps> = {
  id: 'button',
  defaults: buttonDefaults,
  render(el, ctx) {
    const node = h(ctx.doc, 'div', 'ofs-button-wrap');
    node.appendChild(renderButton(el, ctx));
    return { node };
  },
};

export const navButtonDef: RuntimeElementDef<NavButtonProps> = {
  id: 'navButton',
  defaults: () => ({ ...buttonDefaults(), label: 'Next', icon: 'arrow-right', target: 'next' }),
  render(el, ctx) {
    const node = h(ctx.doc, 'div', 'ofs-button-wrap');
    const btn = renderButton(el, ctx);
    node.appendChild(btn);
    if (ctx.env.mode === 'play') {
      const go = () => ctx.env.navigate(String(el.props.target || 'next'));
      btn.addEventListener('click', go);
      ctx.onCleanup(() => btn.removeEventListener('click', go));
      const update = () => {
        const t = el.props.target;
        const { index, count } = ctx.env.nav;
        const disabled = ctx.env.project.kind === 'slides' && ((t === 'next' && index >= count - 1) || (t === 'prev' && index <= 0));
        btn.classList.toggle('ofs-disabled', disabled);
      };
      update();
      ctx.onCleanup(ctx.env.nav.subscribe(update));
    }
    return { node };
  },
};
