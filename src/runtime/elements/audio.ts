import type { RenderCtx, RuntimeElementDef } from './types';
import { h, num, SHADOWS } from './types';
import { mediaUrl } from '../env';
import { fontStack } from '../fonts';
import { COMPONENT_EVENTS, emit } from '../triggers';
import { contrastText, parseHex, withAlpha } from '../../model/paint';
import { baseName, formatTime, glyph, releaseMedia, safePlay, whenVisible } from './mediaShared';

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

/** Comfortable element height for each player style (logical px). */
export const AUDIO_STYLE_HEIGHT: Record<AudioProps['style'], number> = { player: 96, compact: 56, native: 72 };

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
  render(el, ctx) {
    const { doc, env, onCleanup } = ctx;
    const p = el.props;
    const play = env.mode === 'play';
    const style = p.style === 'compact' || p.style === 'native' ? p.style : 'player';
    const radius = Math.max(0, num(p.radius, 0));
    const node = h(doc, 'div', `ofs-audio ofs-audio-${style}`, {
      fontFamily: fontStack(p.font),
      background: p.background,
      color: p.color,
      border: `1px solid ${p.borderColor}`,
      borderRadius: `${style === 'compact' ? Math.min(radius * 2, 999) : radius}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
    });
    const hexAccent = !!parseHex(p.accent);
    node.style.setProperty('--ofs-a-accent', p.accent);
    node.style.setProperty('--ofs-a-on-accent', contrastText(p.accent));
    node.style.setProperty('--ofs-a-soft', hexAccent ? withAlpha(p.accent, 0.14) : 'rgba(127,127,127,.14)');
    node.style.setProperty('--ofs-a-ring', hexAccent ? withAlpha(p.accent, 0.45) : 'rgba(127,127,127,.4)');
    node.style.setProperty('--ofs-a-track', parseHex(p.color) ? withAlpha(p.color, 0.13) : p.borderColor);

    const asset = env.project.assets[p.assetId];
    const url = mediaUrl(env.project, p.assetId, 'audio');
    if (!url) {
      node.classList.add('ofs-audio-empty');
      const ic = h(doc, 'span', 'ofs-audio-empty-icon');
      ic.appendChild(glyph(doc, 'note', style === 'compact' ? 18 : 24));
      const text = h(doc, 'span', 'ofs-audio-empty-text');
      const strong = h(doc, 'strong');
      strong.textContent = play ? 'Sound' : 'Add a sound';
      text.appendChild(strong);
      if (!play && style !== 'compact') {
        const sub = h(doc, 'small');
        sub.textContent = 'MP3, WAV, OGG or M4A file';
        text.appendChild(sub);
      }
      node.append(ic, text);
      return { node };
    }
    const title = String(p.title || baseName(asset?.name) || 'Sound');
    const known = Number(asset?.duration) > 0 ? Number(asset!.duration) : 0;

    if (style === 'native') {
      const a = h(doc, 'audio', 'ofs-audio-native-el');
      a.preload = 'metadata';
      a.controls = true;
      a.src = url;
      a.setAttribute('aria-label', title);
      // Dark cards get the browser's dark controls.
      a.style.colorScheme = parseHex(p.background) && contrastText(p.background) === '#ffffff' ? 'dark' : 'light';
      node.appendChild(a);
      if (!play) {
        a.tabIndex = -1;
        return { node };
      }
      return { node, api: wire(a, node, p, ctx, () => {}) };
    }

    // Custom player: [play] [title · time / seek bar] [volume]
    const btn = h(doc, 'button', 'ofs-audio-btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Play ${title}`);
    btn.appendChild(glyph(doc, 'play', style === 'compact' ? 16 : 22));
    const main = h(doc, 'div', 'ofs-audio-main');
    const top = h(doc, 'div', 'ofs-audio-top');
    const titleEl = h(doc, 'span', 'ofs-audio-title');
    titleEl.textContent = title;
    const time = h(doc, 'span', 'ofs-audio-time');
    time.textContent = `${formatTime(0)} / ${formatTime(known)}`;
    const track = h(doc, 'div', 'ofs-audio-track');
    track.setAttribute('role', 'slider');
    track.setAttribute('aria-label', `Seek in ${title}`);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(Math.round(known)));
    track.setAttribute('aria-valuenow', '0');
    track.setAttribute('aria-valuetext', `${formatTime(0)} of ${formatTime(known)}`);
    const fill = h(doc, 'div', 'ofs-audio-fill');
    const knob = h(doc, 'div', 'ofs-audio-knob');
    track.append(fill, knob);
    if (style === 'compact') {
      main.append(titleEl, track, time);
    } else {
      top.append(titleEl, time);
      main.append(top, track);
    }
    node.append(btn, main);

    let volBtn: HTMLButtonElement | null = null;
    let volRange: HTMLInputElement | null = null;
    if (style === 'player') {
      const vol = h(doc, 'div', 'ofs-audio-vol');
      volBtn = h(doc, 'button', 'ofs-audio-mute');
      volBtn.type = 'button';
      volBtn.setAttribute('aria-label', 'Mute');
      volBtn.appendChild(glyph(doc, 'volume', 18, false));
      vol.appendChild(volBtn);
      if (el.w >= 400) {
        volRange = h(doc, 'input', 'ofs-audio-volume');
        volRange.type = 'range';
        volRange.min = '0';
        volRange.max = '100';
        volRange.value = String(Math.round(Math.max(0, Math.min(100, num(p.volume, 80)))));
        volRange.setAttribute('aria-label', 'Volume');
        vol.appendChild(volRange);
      }
      node.appendChild(vol);
    }

    if (!play) {
      for (const b of [btn, volBtn, volRange, track]) if (b) b.tabIndex = -1;
      return { node };
    }

    const a = h(doc, 'audio');
    a.preload = 'metadata';
    a.src = url;
    a.hidden = true;
    node.appendChild(a);
    track.tabIndex = 0;

    const total = () => (Number.isFinite(a.duration) && a.duration > 0 ? a.duration : known);
    const paint = () => {
      const d = total();
      const t = Math.max(0, Math.min(d || 0, a.currentTime || 0));
      const pct = d > 0 ? `${(t / d) * 100}%` : '0%';
      fill.style.width = pct;
      knob.style.left = pct;
      time.textContent = `${formatTime(t)} / ${formatTime(d)}`;
      track.setAttribute('aria-valuemax', String(Math.round(d)));
      track.setAttribute('aria-valuenow', String(Math.round(t)));
      track.setAttribute('aria-valuetext', `${formatTime(t)} of ${formatTime(d)}`);
      const playing = !a.paused && !a.ended;
      const g = btn.firstElementChild;
      if (g && g.getAttribute('class')?.includes(playing ? 'play' : 'pause'))
        btn.replaceChild(glyph(doc, playing ? 'pause' : 'play', style === 'compact' ? 16 : 22), g);
      btn.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${title}`);
      if (volBtn) {
        const muted = a.muted || a.volume === 0;
        const vg = volBtn.firstElementChild;
        if (vg && !vg.getAttribute('class')?.includes(muted ? 'muted' : 'volume')) volBtn.replaceChild(glyph(doc, muted ? 'muted' : 'volume', 18, false), vg);
        volBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
      }
    };
    const api = wire(a, node, p, ctx, paint);
    const on = (target: EventTarget, type: string, fn: (e: Event) => void) => {
      target.addEventListener(type, fn);
      onCleanup(() => target.removeEventListener(type, fn));
    };
    on(btn, 'click', () => (a.paused || a.ended ? api.play() : api.pause()));

    // Seeking: pointer drag and keyboard (role="slider").
    const seekTo = (seconds: number) => {
      const d = total();
      if (!(d > 0)) return;
      try {
        a.currentTime = Math.max(0, Math.min(d, seconds));
      } catch {
        /* not seekable yet */
      }
      paint();
    };
    const seekAt = (clientX: number) => {
      const r = track.getBoundingClientRect();
      if (r.width > 0) seekTo(((clientX - r.left) / r.width) * total());
    };
    let dragging = false;
    on(track, 'pointerdown', (e) => {
      const pe = e as PointerEvent;
      if (pe.button !== 0) return;
      dragging = true;
      track.classList.add('ofs-audio-seeking');
      try {
        track.setPointerCapture(pe.pointerId);
      } catch {
        /* synthetic events */
      }
      seekAt(pe.clientX);
      pe.preventDefault();
    });
    on(track, 'pointermove', (e) => {
      if (dragging) seekAt((e as PointerEvent).clientX);
    });
    const end = () => {
      dragging = false;
      track.classList.remove('ofs-audio-seeking');
    };
    on(track, 'pointerup', end);
    on(track, 'pointercancel', end);
    on(track, 'keydown', (e) => {
      const k = e as KeyboardEvent;
      const d = total();
      const now = a.currentTime || 0;
      const step: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: d * 0.1, PageDown: -d * 0.1 };
      if (k.key in step) seekTo(now + step[k.key]);
      else if (k.key === 'Home') seekTo(0);
      else if (k.key === 'End') seekTo(d);
      else return;
      k.preventDefault();
      k.stopPropagation();
    });
    if (volBtn)
      on(volBtn, 'click', () => {
        if (a.volume === 0) {
          a.volume = 0.8;
          if (volRange) volRange.value = '80';
          a.muted = false;
        } else a.muted = !a.muted;
        paint();
      });
    if (volRange) {
      const vr = volRange;
      on(vr, 'input', () => {
        a.volume = Math.max(0, Math.min(1, Number(vr.value) / 100));
        a.muted = false;
        paint();
      });
      on(vr, 'pointerdown', (e) => e.stopPropagation());
    }
    for (const t of ['timeupdate', 'loadedmetadata', 'durationchange', 'volumechange', 'seeked']) on(a, t, paint);
    paint();
    return { node, api };
  },
  css: `.ofs-audio{width:100%;height:100%;display:flex;align-items:center;gap:14px;padding:0 18px;overflow:hidden;line-height:1.2;user-select:none}
.ofs-audio-compact{gap:12px;padding:0 14px 0 10px}
.ofs-audio-native{padding:0 14px;justify-content:center}
.ofs-audio-native-el{width:100%;display:block;max-height:100%}
.ofs-audio-btn{flex:none;width:52px;height:52px;border-radius:50%;border:0;padding:0;margin:0;display:flex;align-items:center;justify-content:center;background:var(--ofs-a-accent);color:var(--ofs-a-on-accent);cursor:pointer;box-shadow:0 6px 16px var(--ofs-a-soft);transition:transform .15s ease}
.ofs-audio-btn .ofs-glyph-play{margin-left:3px}
.ofs-audio-compact .ofs-audio-btn{width:36px;height:36px}
.ofs-audio-compact .ofs-audio-btn .ofs-glyph-play{margin-left:2px}
.ofs-audio-btn:hover{transform:scale(1.06)}
.ofs-audio-btn:active{transform:scale(.96)}
.ofs-audio-btn:focus-visible,.ofs-audio-mute:focus-visible{outline:3px solid var(--ofs-a-ring);outline-offset:3px}
.ofs-audio-blocked .ofs-audio-btn{animation:ofs-a-pulse 1.8s ease-out infinite}
.ofs-audio-native.ofs-audio-blocked{box-shadow:0 0 0 3px var(--ofs-a-ring)!important}
@keyframes ofs-a-pulse{0%{box-shadow:0 0 0 0 var(--ofs-a-ring)}75%,100%{box-shadow:0 0 0 14px rgba(0,0,0,0)}}
.ofs-audio-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:10px}
.ofs-audio-compact .ofs-audio-main{flex-direction:row;align-items:center;gap:12px}
.ofs-audio-top{display:flex;align-items:baseline;gap:12px;min-width:0}
.ofs-audio-title{flex:1 1 auto;min-width:0;font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ofs-audio-compact .ofs-audio-title{flex:0 1 auto;max-width:42%;font-size:14px}
.ofs-audio-time{flex:none;font-size:12.5px;font-weight:600;opacity:.66;font-variant-numeric:tabular-nums;white-space:nowrap}
.ofs-audio-track{position:relative;flex:1 1 auto;min-width:40px;height:6px;border-radius:999px;background:var(--ofs-a-track);cursor:pointer;touch-action:none;outline:none}
.ofs-audio-track::before{content:'';position:absolute;left:0;right:0;top:-9px;bottom:-9px}
.ofs-audio-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:inherit;background:var(--ofs-a-accent)}
.ofs-audio-knob{position:absolute;top:50%;left:0;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--ofs-a-accent);box-shadow:0 1px 4px rgba(0,0,0,.25),0 0 0 3px var(--ofs-a-soft);transform:scale(.0001);transition:transform .15s ease}
.ofs-audio:hover .ofs-audio-knob,.ofs-audio-track:focus-visible .ofs-audio-knob,.ofs-audio-seeking .ofs-audio-knob{transform:scale(1)}
.ofs-audio-track:focus-visible{box-shadow:0 0 0 3px var(--ofs-a-ring)}
.ofs-audio-vol{flex:none;display:flex;align-items:center;gap:6px}
.ofs-audio-mute{width:32px;height:32px;border-radius:50%;border:0;padding:0;display:flex;align-items:center;justify-content:center;background:transparent;color:inherit;opacity:.72;cursor:pointer}
.ofs-audio-mute:hover{opacity:1;background:var(--ofs-a-soft)}
.ofs-audio-volume{width:64px;accent-color:var(--ofs-a-accent);cursor:pointer;margin:0}
.ofs-audio-empty{gap:14px}
.ofs-audio-empty-icon{flex:none;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--ofs-a-soft);color:var(--ofs-a-accent)}
.ofs-audio-compact .ofs-audio-empty-icon{width:34px;height:34px}
.ofs-audio-empty-text{display:flex;flex-direction:column;gap:3px;min-width:0}
.ofs-audio-empty-text strong{font-size:15px;font-weight:700}
.ofs-audio-empty-text small{font-size:12px;opacity:.62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (prefers-reduced-motion:reduce){.ofs-audio-blocked .ofs-audio-btn{animation:none}.ofs-audio-knob{transition:none}}`,
};

/** Connects an <audio> element to playback state, honest autoplay and the element API. */
function wire(a: HTMLAudioElement, node: HTMLElement, p: AudioProps, ctx: RenderCtx, paint: () => void) {
  const { onCleanup } = ctx;
  a.loop = !!p.loop;
  a.volume = Math.max(0, Math.min(1, num(p.volume, 80) / 100));
  let blocked = false;
  const sync = () => {
    const paused = a.paused || a.ended;
    node.classList.toggle('ofs-audio-blocked', blocked && paused);
    node.classList.toggle('ofs-audio-playing', !paused);
    node.dataset.state = blocked && paused ? 'blocked' : paused ? 'paused' : 'playing';
    paint();
  };
  const doPlay = () =>
    safePlay(a, (outcome) => {
      if (outcome === 'blocked') blocked = true;
      if (outcome === 'playing') blocked = false;
      sync();
    });
  const on = (type: string, fn: () => void) => {
    a.addEventListener(type, fn);
    onCleanup(() => a.removeEventListener(type, fn));
  };
  on('play', () => {
    blocked = false;
    sync();
  });
  on('pause', sync);
  on('playing', sync);
  on('ended', () => {
    sync();
    emit(node, COMPONENT_EVENTS.mediaEnded);
  });
  on('error', () => {
    node.classList.add('ofs-audio-error');
    node.title = "This sound can't be played in this browser.";
  });
  if (p.autoplay) whenVisible(node, ctx, doPlay);
  onCleanup(() => releaseMedia(a));
  sync();
  return {
    play: doPlay,
    pause: () => a.pause(),
    restart: () => {
      try {
        a.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
      doPlay();
    },
  };
}
