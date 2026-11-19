import type { RenderCtx } from './types';
import { svg } from './types';

/**
 * Helpers shared by the Video and Audio elements (framework-free, bundled into
 * every export).
 */

/** "1:05" / "1:02:03". Unknown or invalid durations render as "0:00". */
export function formatTime(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export type PlayOutcome = 'playing' | 'blocked' | 'failed';

/**
 * Calls `media.play()` and reports honestly what happened: browsers reject
 * play() without a user gesture (typically unmuted autoplay), and some codecs
 * are unsupported. An AbortError (pause() raced the play request) is not a
 * failure — the element is simply paused again.
 */
export function safePlay(media: HTMLMediaElement, done: (outcome: PlayOutcome) => void): void {
  let result: unknown;
  try {
    result = media.play();
  } catch {
    done('failed');
    return;
  }
  if (result && typeof (result as Promise<void>).then === 'function') {
    (result as Promise<void>).then(
      () => done('playing'),
      (err: { name?: string } | undefined) => {
        if (err?.name === 'AbortError') return;
        done(err?.name === 'NotAllowedError' ? 'blocked' : 'failed');
      },
    );
  } else {
    // Very old browsers: play() returns nothing; trust the paused flag.
    done(media.paused ? 'failed' : 'playing');
  }
}

/**
 * Runs `fn` once, when `node` first becomes visible (for webpages and for
 * elements that start hidden). Falls back to running immediately.
 */
export function whenVisible(node: HTMLElement, ctx: RenderCtx, fn: () => void): void {
  const win = ctx.doc.defaultView as (Window & typeof globalThis) | null;
  const IO = win?.IntersectionObserver;
  if (!IO) {
    queueMicrotask(fn);
    return;
  }
  let done = false;
  const io = new IO(
    (entries) => {
      if (done || !entries.some((e) => e.isIntersecting && e.intersectionRatio > 0)) return;
      done = true;
      io.disconnect();
      fn();
    },
    { threshold: [0, 0.35] },
  );
  io.observe(node);
  ctx.onCleanup(() => io.disconnect());
}

/** Releases a media element's decoder (slides are destroyed on navigation). */
export function releaseMedia(media: HTMLMediaElement): void {
  try {
    media.pause();
    media.removeAttribute('src');
    media.load();
  } catch {
    /* ignore */
  }
}

const GLYPHS: Record<string, string> = {
  play: 'M8.5 5.6v12.8a.9.9 0 0 0 1.37.77l10.2-6.4a.9.9 0 0 0 0-1.54L9.87 4.83A.9.9 0 0 0 8.5 5.6z',
  pause: 'M7 5h3.4v14H7zM13.6 5H17v14h-3.4z',
  replay: 'M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4v4.6h4.6',
  volume: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  muted: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5',
  note: 'M9 18.5V6l10-2v12.5M9 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 13h4M4 17h4M16 9h4M16 13h4M16 17h4',
};

/** Small solid/outline glyphs used by the media players. */
export function glyph(doc: Document, name: keyof typeof GLYPHS | string, size: number, filled = name === 'play' || name === 'pause'): SVGSVGElement {
  const s = svg(doc, 'svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' });
  s.setAttribute('class', `ofs-icon ofs-glyph-${name}`);
  s.appendChild(
    svg(doc, 'path', {
      d: GLYPHS[name] ?? GLYPHS.play,
      fill: filled ? 'currentColor' : 'none',
      stroke: filled ? 'none' : 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return s;
}

/** Strips a file extension for display ("intro.mp4" → "intro"). */
export function baseName(name: string | undefined): string {
  return String(name ?? '').replace(/\.[a-z0-9]{1,5}$/i, '');
}
