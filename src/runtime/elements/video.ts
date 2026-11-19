import type { RuntimeElementDef } from './types';
import { h, num, SHADOWS } from './types';
import { placeholder } from './image';
import { mediaUrl } from '../env';

export interface VideoProps {
  /** Video asset (MP4 / WebM). */
  assetId: string;
  /** Optional poster image asset shown before playback. */
  posterId: string;
  fit: 'contain' | 'cover';
  /** Native browser playback controls. */
  controls: boolean;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  /** Frame around the video: none, a thin border, or a browser window. */
  frame: 'none' | 'border' | 'browser';
  radius: number;
  shadow: string;
  /** Letterbox colour behind the picture. */
  background: string;
  /** Big play button colour. */
  accent: string;
  borderColor: string;
  /** Accessible description / window title. */
  alt: string;
}

export const videoDef: RuntimeElementDef<VideoProps> = {
  id: 'video',
  defaults: () => ({
    assetId: '',
    posterId: '',
    fit: 'contain',
    controls: true,
    autoplay: false,
    loop: false,
    muted: false,
    frame: 'none',
    radius: 16,
    shadow: 'soft',
    background: '#1d1b2c',
    accent: '#6d4aff',
    borderColor: '#e4e0f5',
    alt: '',
  }),
  render(el, { doc, env }) {
    const p = el.props;
    const node = h(doc, 'div', 'ofs-video', { borderRadius: `${num(p.radius, 0)}px`, boxShadow: SHADOWS[p.shadow] ?? 'none', background: p.background });
    const url = mediaUrl(env.project, p.assetId, 'video');
    if (!url) {
      node.appendChild(placeholder(doc, 'Video — add a video file'));
      return { node };
    }
    const v = h(doc, 'video');
    v.src = url;
    v.style.objectFit = p.fit;
    node.appendChild(v);
    return { node };
  },
  css: `.ofs-video{position:relative;width:100%;height:100%;overflow:hidden}.ofs-video video{width:100%;height:100%;display:block}`,
};
