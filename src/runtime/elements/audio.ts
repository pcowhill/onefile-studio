import type { RuntimeElementDef } from './types';
import { h, num, SHADOWS } from './types';
import { mediaUrl } from '../env';
import { fontStack } from '../fonts';

export interface AudioProps {
  /** Audio asset (MP3 / WAV / OGG / M4A). */
  assetId: string;
  /** Shown in the player; empty = the file name. */
  title: string;
  /** "player" = polished card, "compact" = slim pill, "native" = the browser's own controls. */
  style: 'player' | 'compact' | 'native';
  autoplay: boolean;
  loop: boolean;
  /** 0..100 */
  volume: number;
  font: string;
  accent: string;
  background: string;
  color: string;
  borderColor: string;
  radius: number;
  shadow: string;
}

export const audioDef: RuntimeElementDef<AudioProps> = {
  id: 'audio',
  defaults: () => ({
    assetId: '',
    title: '',
    style: 'player',
    autoplay: false,
    loop: false,
    volume: 80,
    font: 'rounded',
    accent: '#6d4aff',
    background: '#ffffff',
    color: '#1d1b2c',
    borderColor: '#e4e0f5',
    radius: 24,
    shadow: 'soft',
  }),
  render(el, { doc, env }) {
    const p = el.props;
    const node = h(doc, 'div', 'ofs-audio', {
      fontFamily: fontStack(p.font),
      background: p.background,
      color: p.color,
      borderRadius: `${num(p.radius, 0)}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
    });
    const url = mediaUrl(env.project, p.assetId, 'audio');
    const label = h(doc, 'span');
    label.textContent = url ? p.title || env.project.assets[p.assetId]?.name || 'Audio' : 'Audio — add a sound file';
    node.appendChild(label);
    return { node };
  },
  css: `.ofs-audio{width:100%;height:100%;display:flex;align-items:center;gap:12px;padding:0 16px;overflow:hidden}`,
};
