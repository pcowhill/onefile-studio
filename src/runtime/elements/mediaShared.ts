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
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
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

/**
 * Plays only a segment of a media element (a nondestructive trim), and owns
 * the "finished" moment for both trimmed and untrimmed media:
 *
 * - playing starts at the trim start (also after the segment finished);
 * - playback stops exactly at the trim end, or jumps back to the start when
 *   looping (native `loop` cannot loop a segment, so it is used only when the
 *   whole file plays);
 * - seeking outside the segment (native controls, keyboard) is clamped into it;
 * - `onEnded` fires once each time the segment plays to its end (never while
 *   looping), exactly like the native `ended` event for untrimmed media.
 *
 * `end` = 0 means "until the end of the file".
 */
export interface Segment {
  /** Start of the segment (s). */
  start: number;
  /** End of the segment (s), using the media's duration when known. */
  end(): number;
  /** Seconds played inside the segment. */
  time(): number;
  /** Length of the segment (s); 0 when unknown. */
  length(): number;
  /** Seeks to `seconds` inside the segment. */
  seek(seconds: number): void;
  /** Call before play(): rewinds to the start when outside the segment or finished. */
  prepare(): void;
  /** Seeks to the segment's start. */
  restart(): void;
}

export function playSegment(
  media: HTMLMediaElement,
  ctx: RenderCtx,
  opts: { start: number; end: number; loop: boolean; knownDuration: number; onEnded(): void },
): Segment {
  const start = Math.max(0, opts.start || 0);
  const trimmed = start > 0 || opts.end > 0;
  media.loop = !!opts.loop && !trimmed;
  const duration = () => (Number.isFinite(media.duration) && media.duration > 0 ? media.duration : opts.knownDuration);
  const end = () => {
    const d = duration();
    if (opts.end > 0) return d > 0 ? Math.min(opts.end, d) : opts.end;
    return d;
  };
  const setTime = (t: number) => {
    try {
      if (Math.abs(media.currentTime - t) > 0.001) media.currentTime = t;
    } catch {
      /* not seekable yet */
    }
  };
  const win = ctx.doc.defaultView;
  let raf = 0;
  let finishing = false;
  const finish = () => {
    if (finishing) return;
    finishing = true;
    if (opts.loop) {
      setTime(start);
      const r = media.play();
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } else {
      media.pause();
      setTime(end());
      opts.onEnded();
    }
    finishing = false;
  };
  const check = () => {
    const e = end();
    if (trimmed && opts.end > 0 && e > 0 && !media.paused && media.currentTime >= e - 0.015) finish();
  };
  const tick = () => {
    raf = 0;
    check();
    if (!media.paused && !media.ended && win?.requestAnimationFrame) raf = win.requestAnimationFrame(tick);
  };
  const stopTick = () => {
    if (raf && win?.cancelAnimationFrame) win.cancelAnimationFrame(raf);
    raf = 0;
  };
  const on = (type: string, fn: () => void) => {
    media.addEventListener(type, fn);
    ctx.onCleanup(() => media.removeEventListener(type, fn));
  };
  if (trimmed) {
    on('playing', () => {
      if (!raf && win?.requestAnimationFrame) raf = win.requestAnimationFrame(tick);
    });
    on('pause', stopTick);
    // A background tab pauses animation frames: timeupdate still fires.
    on('timeupdate', check);
    on('seeking', () => {
      const e = end();
      if (media.currentTime < start - 0.01) setTime(start);
      else if (e > 0 && media.currentTime > e + 0.01) setTime(e);
    });
    on('loadedmetadata', () => {
      if (media.currentTime < start) setTime(start);
    });
    ctx.onCleanup(stopTick);
  }
  on('ended', () => {
    stopTick();
    if (trimmed && opts.loop) finish();
    else opts.onEnded();
  });
  return {
    start,
    end,
    time: () => Math.max(0, Math.min(Math.max(0, end() - start), (media.currentTime || 0) - start)),
    length: () => Math.max(0, end() - start),
    seek: (seconds) => setTime(Math.max(start, Math.min(end() || start + seconds, start + seconds))),
    prepare: () => {
      const e = end();
      const t = media.currentTime || 0;
      if (media.ended || t < start - 0.05 || (e > 0 && t >= e - 0.05)) setTime(start);
    },
    restart: () => setTime(start),
  };
}
