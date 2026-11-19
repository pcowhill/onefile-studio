import type { RuntimeElementDef } from './types';
import { h, num, SHADOWS } from './types';
import { assetUrl, mediaUrl } from '../env';
import { COMPONENT_EVENTS, emit } from '../triggers';
import { contrastText, parseHex, withAlpha } from '../../model/paint';
import { baseName, glyph, releaseMedia, safePlay, whenVisible } from './mediaShared';

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

/** Height of the browser-window title bar and padding of the border frame (logical px). */
export const VIDEO_BAR_HEIGHT = 34;
export const VIDEO_BORDER_PAD = 6;

/** Extra height a frame adds around the picture (used to size the element to the video's aspect ratio). */
export function videoFrameExtra(frame: VideoProps['frame']): { w: number; h: number } {
  if (frame === 'browser') return { w: 0, h: VIDEO_BAR_HEIGHT };
  if (frame === 'border') return { w: VIDEO_BORDER_PAD * 2, h: VIDEO_BORDER_PAD * 2 };
  return { w: 0, h: 0 };
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
  render(el, ctx) {
    const { doc, env, onCleanup } = ctx;
    const p = el.props;
    const play = env.mode === 'play';
    const frame = p.frame === 'border' || p.frame === 'browser' ? p.frame : 'none';
    const radius = Math.max(0, num(p.radius, 0));
    const asset = env.project.assets[p.assetId];
    const title = String(p.alt || baseName(asset?.name) || 'Video');

    const node = h(doc, 'div', `ofs-video ofs-video-frame-${frame}`, {
      borderRadius: `${radius}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
      background: frame === 'none' ? p.background : p.borderColor,
    });
    node.style.setProperty('--ofs-v-accent', p.accent);
    node.style.setProperty('--ofs-v-on-accent', contrastText(p.accent));
    node.style.setProperty('--ofs-v-ring', parseHex(p.accent) ? withAlpha(p.accent, 0.5) : 'rgba(255,255,255,.45)');

    if (frame === 'browser') {
      const barText = contrastText(p.borderColor);
      const bar = h(doc, 'div', 'ofs-video-bar', { color: barText });
      const dots = h(doc, 'span', 'ofs-video-dots');
      for (let i = 0; i < 3; i++) dots.appendChild(h(doc, 'i'));
      const url = h(doc, 'span', 'ofs-video-url', { background: barText === '#ffffff' ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.6)' });
      url.textContent = title;
      bar.append(dots, url);
      node.appendChild(bar);
    }
    const screen = h(doc, 'div', 'ofs-video-screen', {
      background: p.background,
      borderRadius: frame === 'border' ? `${Math.max(0, radius - VIDEO_BORDER_PAD + 1)}px` : frame === 'browser' ? '0' : 'inherit',
    });
    node.appendChild(screen);

    const url = mediaUrl(env.project, p.assetId, 'video');
    if (!url) {
      screen.appendChild(emptyState(doc, p, play));
      return { node };
    }

    const v = h(doc, 'video', 'ofs-video-media');
    v.preload = 'metadata';
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('aria-label', title);
    v.style.objectFit = p.fit === 'cover' ? 'cover' : 'contain';
    const poster = assetUrl(env.project, p.posterId);
    if (poster) v.poster = poster;
    // Outside playback show a still picture: the poster, or the first frame (#t= nudges Safari to paint it).
    v.src = play ? url : `${url}#t=0.1`;
    screen.appendChild(v);

    const overlay = h(doc, 'button', 'ofs-video-play');
    overlay.type = 'button';
    overlay.setAttribute('aria-label', `Play ${title}`);
    overlay.appendChild(glyph(doc, 'play', 40));
    screen.appendChild(overlay);

    if (!play) {
      v.muted = true;
      v.tabIndex = -1;
      overlay.tabIndex = -1;
      // Viewers first see a paused video, unless it can start by itself (muted autoplay).
      overlay.hidden = !!(p.autoplay && p.muted);
      return { node };
    }

    v.controls = !!p.controls;
    v.loop = !!p.loop;
    v.muted = !!p.muted;
    v.defaultMuted = !!p.muted;

    const hint = h(doc, 'span', 'ofs-video-hint');
    hint.textContent = 'Press play to start';
    hint.hidden = true;
    screen.appendChild(hint);

    let started = false;
    let blocked = false;
    let failed = false;
    const sync = () => {
      const paused = v.paused || v.ended;
      overlay.hidden = failed || !(paused && (!p.controls || !started || blocked));
      hint.hidden = !(blocked && paused);
      node.classList.toggle('ofs-video-blocked', blocked && paused);
      node.dataset.state = failed ? 'error' : blocked && paused ? 'blocked' : paused ? 'paused' : 'playing';
    };
    const showError = () => {
      if (failed) return;
      failed = true;
      const box = h(doc, 'div', 'ofs-video-error');
      box.textContent = "This video can't be played in this browser.";
      screen.appendChild(box);
      sync();
    };
    const doPlay = () =>
      safePlay(v, (outcome) => {
        if (outcome === 'blocked') blocked = true;
        else if (outcome === 'failed' && v.error) showError();
        else if (outcome === 'playing') blocked = false;
        sync();
      });

    const on = (target: EventTarget, type: string, fn: (e: Event) => void) => {
      target.addEventListener(type, fn);
      onCleanup(() => target.removeEventListener(type, fn));
    };
    on(v, 'play', () => {
      started = true;
      blocked = false;
      sync();
    });
    on(v, 'playing', sync);
    on(v, 'pause', sync);
    on(v, 'ended', () => {
      sync();
      emit(node, COMPONENT_EVENTS.mediaEnded);
    });
    on(v, 'error', showError);
    on(overlay, 'click', () => doPlay());
    if (!p.controls) {
      // Without native controls the picture itself toggles playback.
      screen.classList.add('ofs-video-toggle');
      screen.tabIndex = 0;
      screen.setAttribute('role', 'button');
      screen.setAttribute('aria-label', `${title}: play or pause`);
      const toggle = () => (v.paused || v.ended ? doPlay() : v.pause());
      on(screen, 'click', (e) => {
        if (!overlay.contains(e.target as Node)) toggle();
      });
      on(screen, 'keydown', (e) => {
        const k = e as KeyboardEvent;
        if ((k.key === ' ' || k.key === 'Enter') && k.target === screen) {
          k.preventDefault();
          toggle();
        }
      });
    }
    if (p.autoplay) whenVisible(node, ctx, doPlay);
    onCleanup(() => releaseMedia(v));
    sync();

    return {
      node,
      api: {
        play: doPlay,
        pause: () => v.pause(),
        restart: () => {
          try {
            v.currentTime = 0;
          } catch {
            /* not seekable yet */
          }
          doPlay();
        },
      },
    };
  },
  css: `.ofs-video{position:relative;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;isolation:isolate}
.ofs-video-frame-border{padding:${VIDEO_BORDER_PAD}px}
.ofs-video-screen{position:relative;flex:1 1 auto;min-height:0;overflow:hidden}
.ofs-video-media{position:absolute;inset:0;width:100%;height:100%;display:block;background:transparent}
.ofs-video-bar{flex:none;height:${VIDEO_BAR_HEIGHT}px;display:flex;align-items:center;gap:12px;padding:0 12px;font:600 12px/1 system-ui,-apple-system,'Segoe UI',sans-serif;user-select:none}
.ofs-video-dots{display:flex;gap:6px;flex:none}
.ofs-video-dots i{display:block;width:11px;height:11px;border-radius:50%;background:#ff5f57;box-shadow:inset 0 0 0 .5px rgba(0,0,0,.18)}
.ofs-video-dots i:nth-child(2){background:#febc2e}
.ofs-video-dots i:nth-child(3){background:#28c840}
.ofs-video-url{flex:1 1 auto;min-width:0;max-width:62%;margin:0 auto;transform:translateX(-24px);height:21px;line-height:21px;border-radius:7px;padding:0 12px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.85}
.ofs-video-play{position:absolute;left:50%;top:50%;z-index:2;transform:translate(-50%,-50%);width:clamp(44px,15%,88px);aspect-ratio:1/1;height:auto;border:0;padding:0;margin:0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--ofs-v-accent);color:var(--ofs-v-on-accent);box-shadow:0 12px 32px rgba(0,0,0,.35),0 0 0 6px rgba(255,255,255,.16);cursor:pointer;transition:transform .18s ease}
.ofs-video-play svg{width:44%;height:44%;margin-left:7%}
.ofs-video-play:hover{transform:translate(-50%,-50%) scale(1.07)}
.ofs-video-play:focus-visible{outline:3px solid #fff;outline-offset:4px}
.ofs-video-play[hidden],.ofs-video-hint[hidden]{display:none}
.ofs-video-blocked .ofs-video-play{animation:ofs-v-pulse 1.8s ease-out infinite}
@keyframes ofs-v-pulse{0%{box-shadow:0 12px 32px rgba(0,0,0,.35),0 0 0 0 var(--ofs-v-ring)}75%,100%{box-shadow:0 12px 32px rgba(0,0,0,.35),0 0 0 22px rgba(0,0,0,0)}}
.ofs-video-hint{position:absolute;left:50%;bottom:9%;z-index:2;transform:translateX(-50%);padding:6px 12px;border-radius:999px;background:rgba(10,10,20,.66);color:#fff;font:600 12px/1.2 system-ui,sans-serif;white-space:nowrap;pointer-events:none;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.ofs-video-toggle{cursor:pointer;outline:none}
.ofs-video-toggle:focus-visible{box-shadow:inset 0 0 0 3px var(--ofs-v-accent)}
.ofs-video-error{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;background:rgba(10,10,20,.72);color:#fff;font:600 14px/1.4 system-ui,sans-serif}
.ofs-video-empty{position:absolute;inset:0;border-radius:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px;text-align:center;overflow:hidden;font:600 15px/1.25 system-ui,-apple-system,'Segoe UI',sans-serif}
.ofs-video-empty::before{content:'';position:absolute;inset:10px;border:2px dashed currentColor;border-radius:inherit;opacity:.18;pointer-events:none}
.ofs-video-empty-icon{width:clamp(40px,14%,76px);aspect-ratio:1/1;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--ofs-v-accent);color:var(--ofs-v-on-accent);box-shadow:0 0 0 8px var(--ofs-v-ring)}
.ofs-video-empty-icon svg{width:44%;height:44%;margin-left:7%}
.ofs-video-empty small{font-weight:500;font-size:12px;opacity:.65}
@media (prefers-reduced-motion:reduce){.ofs-video-blocked .ofs-video-play{animation:none}}`,
};

function emptyState(doc: Document, p: VideoProps, play: boolean): HTMLElement {
  const text = contrastText(p.background);
  const glow = parseHex(p.accent) ? `radial-gradient(120% 85% at 50% 0%, ${withAlpha(p.accent, 0.3)}, rgba(0,0,0,0) 62%), ` : '';
  const box = h(doc, 'div', 'ofs-video-empty', { color: text, background: `${glow}${p.background}` });
  const ic = h(doc, 'span', 'ofs-video-empty-icon');
  ic.appendChild(glyph(doc, 'play', 32));
  const label = h(doc, 'strong');
  label.textContent = play ? 'Video' : 'Add a video';
  box.append(ic, label);
  if (!play) {
    const sub = h(doc, 'small');
    sub.textContent = 'MP4 or WebM · choose a file on the right';
    box.appendChild(sub);
  }
  return box;
}
