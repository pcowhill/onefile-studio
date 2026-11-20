import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { Asset, Project } from '../../model/types';
import { assetKind } from '../../model/types';
import type { CropRect, MediaEdit } from '../../model/mediaEdit';
import { editedSize, flipEdit, isIdentity, orientationMatrix, orientedSize, rotateEdit, sanitizeEdit } from '../../model/mediaEdit';
import { mediaUrl, dataUrlToBlob } from '../../runtime/env';
import { Icon } from '../ui/Icon';
import type { Handle } from './cropMath';
import { dragCrop, fitAspect, formatPrecise, FULL, minSide, moveTrim, normAspect } from './cropMath';
import '../../styles/capture.css';

/**
 * The lightweight, nondestructive media editors: crop/rotate/flip for
 * pictures, trim + crop for videos, trim for sounds. They only ever produce a
 * `MediaEdit` (a description); the file's bytes are never changed.
 */

/** A playable URL for an asset (images: the data URL; media: a cached Blob URL). */
export function assetSrc(asset: Asset): string {
  const kind = assetKind(asset.mime);
  if (kind === 'image') return asset.data;
  const fake = { assets: { [asset.id]: asset } } as unknown as Project;
  return mediaUrl(fake, asset.id, kind) ?? asset.data;
}

const ASPECTS: Array<{ id: string; label: string; ratio: number | 'original' | null }> = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'original', label: 'Original', ratio: 'original' },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '1:1', label: '1:1', ratio: 1 },
];

/** The editing surface for any media kind. */
export function MediaEditSurface({ asset, src, edit, onChange }: { asset: Asset; src?: string; edit: MediaEdit; onChange(e: MediaEdit): void }) {
  const kind = assetKind(asset.mime);
  const url = src ?? assetSrc(asset);
  if (kind === 'image') return <ImageSurface asset={asset} src={url} edit={edit} onChange={onChange} />;
  if (kind === 'video') return <VideoSurface asset={asset} src={url} edit={edit} onChange={onChange} />;
  return <AudioSurface asset={asset} src={url} edit={edit} onChange={onChange} />;
}

// ---------------- shared: stage sizing ----------------

function useWidth(ref: React.RefObject<HTMLElement | null>, fallback = 640): number {
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(el.clientWidth || fallback);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fallback]);
  return w;
}

function fitBox(aspect: number, maxW: number, maxH: number) {
  const a = aspect > 0 ? aspect : 16 / 9;
  let w = maxW;
  let h = w / a;
  if (h > maxH) {
    h = maxH;
    w = h * a;
  }
  return { w: Math.round(w), h: Math.round(h) };
}

// ---------------- crop overlay ----------------

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function CropOverlay({
  crop,
  onChange,
  aspect,
  pixels,
  boxW,
  boxH,
}: {
  crop: CropRect;
  onChange(c: CropRect): void;
  /** Normalised aspect lock, or null for free. */
  aspect: number | null;
  /** Picture size in pixels (for the minimum crop). */
  pixels: { width: number; height: number };
  boxW: number;
  boxH: number;
}) {
  const drag = useRef<{ handle: Handle; x: number; y: number; start: CropRect } | null>(null);
  const minW = minSide(pixels.width);
  const minH = minSide(pixels.height);
  const down = (handle: Handle) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = { handle, x: e.clientX, y: e.clientY, start: crop };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / boxW;
    const dy = (e.clientY - d.y) / boxH;
    onChange(dragCrop(d.start, d.handle, dx, dy, aspect, minW, minH));
  };
  const up = () => (drag.current = null);
  const key = (e: ReactKeyboardEvent) => {
    const step = e.altKey ? 0.002 : 0.02;
    const k: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = k[e.key];
    if (!v) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(dragCrop(crop, e.shiftKey ? 'se' : 'move', v[0], v[1], aspect, minW, minH));
  };
  return (
    <div className="ed-crop-layer" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div className="ed-crop-clip" aria-hidden="true">
        <div className="ed-crop-shade" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }} />
      </div>
      <div
        className="ed-crop-box"
        style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
        onPointerDown={down('move')}
        tabIndex={0}
        role="group"
        aria-label="Crop area. Arrow keys move it, Shift + arrow keys resize it."
        data-testid="crop-box"
        onKeyDown={key}
      >
        <span className="ed-crop-grid" aria-hidden="true" />
        {HANDLES.map((h) => (
          <span key={h} className={`ed-crop-handle is-${h}`} data-handle={h} onPointerDown={down(h)} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}

function AspectChips({ value, onPick }: { value: string; onPick(id: string): void }) {
  return (
    <div className="ed-chips" role="radiogroup" aria-label="Crop shape">
      {ASPECTS.map((a) => (
        <button key={a.id} role="radio" aria-checked={value === a.id} className={value === a.id ? 'is-on' : ''} onClick={() => onPick(a.id)}>
          {a.id !== 'free' && a.id !== 'original' && <span className="ed-chip-shape" style={{ aspectRatio: String(a.ratio) }} aria-hidden="true" />}
          {a.label}
        </button>
      ))}
    </div>
  );
}

/** Crop state helpers shared by the picture and video surfaces. */
function useCropControls(edit: MediaEdit, onChange: (e: MediaEdit) => void, picture: { width: number; height: number }) {
  const [aspectId, setAspectId] = useState('free');
  const pictureAspect = picture.width > 0 && picture.height > 0 ? picture.width / picture.height : 16 / 9;
  const ratioOf = (id: string) => {
    const a = ASPECTS.find((x) => x.id === id)?.ratio;
    return a === 'original' ? pictureAspect : (a ?? null);
  };
  const lock = ratioOf(aspectId);
  const crop = edit.crop ?? FULL;
  const setCrop = (c: CropRect) => onChange(withCrop(edit, c));
  const pick = (id: string) => {
    setAspectId(id);
    const r = ratioOf(id);
    if (r) setCrop(fitAspect(crop, normAspect(r, pictureAspect)));
  };
  return { aspectId, pick, crop, setCrop, lock: lock ? normAspect(lock, pictureAspect) : null, setAspectId };
}

function withCrop(edit: MediaEdit, c: CropRect): MediaEdit {
  const out = { ...edit };
  const full = c.x <= 0.0001 && c.y <= 0.0001 && c.w >= 0.9999 && c.h >= 0.9999;
  if (full) delete out.crop;
  else out.crop = c;
  return out;
}

// ---------------- pictures ----------------

function OrientedImage({ src, width, height, edit }: { src: string; width: number; height: number; edit: MediaEdit }) {
  const o = orientedSize(width, height, edit.rotate);
  return (
    <svg className="ed-crop-media" viewBox={`0 0 ${o.width} ${o.height}`} preserveAspectRatio="none" aria-hidden="true">
      <image
        href={src}
        x={0}
        y={0}
        width={width}
        height={height}
        preserveAspectRatio="none"
        transform={`matrix(${orientationMatrix(width, height, edit).join(' ')})`}
      />
    </svg>
  );
}

function ImageSurface({ asset, src, edit, onChange }: { asset: Asset; src: string; edit: MediaEdit; onChange(e: MediaEdit): void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const W = asset.width || 800;
  const H = asset.height || 600;
  const o = orientedSize(W, H, edit.rotate);
  const box = fitBox(o.width / o.height, width, 400);
  const crop = useCropControls(edit, onChange, o);
  const out = editedSize(W, H, edit);
  return (
    <div className="ed-medit">
      <div className="ed-medit-tools" role="toolbar" aria-label="Picture tools">
        <div className="ed-medit-toolgroup">
          <button
            className="ed-medit-tool"
            onClick={() => onChange(rotateEdit(edit, -1))}
            title="Rotate left"
            aria-label="Rotate left"
            data-testid="rotate-left"
          >
            <Icon name="rotateLeft" size={18} />
          </button>
          <button
            className="ed-medit-tool"
            onClick={() => onChange(rotateEdit(edit, 1))}
            title="Rotate right"
            aria-label="Rotate right"
            data-testid="rotate-right"
          >
            <Icon name="rotate" size={18} />
          </button>
          <button
            className={`ed-medit-tool ${edit.flipH ? 'is-on' : ''}`}
            onClick={() => onChange(flipEdit(edit, 'h'))}
            title="Flip horizontally"
            aria-label="Flip horizontally"
            aria-pressed={!!edit.flipH}
            data-testid="flip-h"
          >
            <Icon name="flipH" size={18} />
          </button>
          <button
            className={`ed-medit-tool ${edit.flipV ? 'is-on' : ''}`}
            onClick={() => onChange(flipEdit(edit, 'v'))}
            title="Flip vertically"
            aria-label="Flip vertically"
            aria-pressed={!!edit.flipV}
            data-testid="flip-v"
          >
            <Icon name="flipV" size={18} />
          </button>
        </div>
        <AspectChips value={crop.aspectId} onPick={crop.pick} />
      </div>
      <div className="ed-medit-stage" ref={wrap}>
        <div className="ed-crop-frame" style={{ width: box.w, height: box.h }}>
          <OrientedImage src={src} width={W} height={H} edit={edit} />
          <CropOverlay crop={crop.crop} onChange={crop.setCrop} aspect={crop.lock} pixels={o} boxW={box.w} boxH={box.h} />
        </div>
      </div>
      <p className="ed-medit-facts" data-testid="crop-size">
        <Icon name="crop" size={14} /> {Math.round(out.width)} × {Math.round(out.height)} px
        {edit.crop ? (
          <span>
            {' '}
            · from {W} × {H}
          </span>
        ) : null}
        <span className="ed-medit-tip">Drag the corners to crop · the original stays in your project</span>
      </p>
    </div>
  );
}

// ---------------- timing (videos, sounds) ----------------

/** Plays a media element only inside [start, end]; returns transport state. */
function useSegmentPlayer(media: React.RefObject<HTMLMediaElement | null>, start: number, end: number) {
  const [time, setTime] = useState(start);
  const [playing, setPlaying] = useState(false);
  const range = useRef({ start, end });
  range.current = { start, end };
  useEffect(() => {
    const m = media.current;
    if (!m) return;
    let raf = 0;
    const tick = () => {
      const { end: e } = range.current;
      if (e > 0 && m.currentTime >= e) {
        m.pause();
        m.currentTime = e;
      }
      setTime(m.currentTime);
      if (!m.paused) raf = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      setPlaying(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      setTime(m.currentTime);
    };
    const onSeek = () => setTime(m.currentTime);
    m.addEventListener('play', onPlay);
    m.addEventListener('pause', onPause);
    m.addEventListener('ended', onPause);
    m.addEventListener('seeked', onSeek);
    return () => {
      cancelAnimationFrame(raf);
      m.removeEventListener('play', onPlay);
      m.removeEventListener('pause', onPause);
      m.removeEventListener('ended', onPause);
      m.removeEventListener('seeked', onSeek);
      m.pause();
    };
  }, [media]);
  const seek = useCallback(
    (t: number) => {
      const m = media.current;
      if (!m) return;
      try {
        m.currentTime = t;
      } catch {
        /* not ready */
      }
      setTime(t);
    },
    [media],
  );
  const toggle = useCallback(() => {
    const m = media.current;
    if (!m) return;
    if (!m.paused) return m.pause();
    const { start: s, end: e } = range.current;
    if (m.currentTime < s || m.currentTime >= e - 0.05) m.currentTime = s;
    void m.play().catch(() => setPlaying(false));
  }, [media]);
  return { time, playing, seek, toggle };
}

/** Reads the media's duration (asset metadata first; the element as a fallback). */
function useDuration(asset: Asset, media: React.RefObject<HTMLMediaElement | null>): number {
  const [d, setD] = useState(asset.duration && asset.duration > 0 ? asset.duration : 0);
  useEffect(() => {
    const m = media.current;
    if (!m || d > 0) return;
    const read = () => {
      if (Number.isFinite(m.duration) && m.duration > 0) setD(m.duration);
    };
    m.addEventListener('loadedmetadata', read);
    m.addEventListener('durationchange', read);
    read();
    return () => {
      m.removeEventListener('loadedmetadata', read);
      m.removeEventListener('durationchange', read);
    };
  }, [media, d]);
  return d;
}

/** Peaks (0..1) of a sound, for the waveform; null while loading or when unavailable. */
function useWaveform(asset: Asset, buckets = 160): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Decoding very large files costs a lot of memory: the waveform is a nicety.
    if (asset.bytes > 40 * 1024 * 1024) return;
    const AC = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!AC) return;
    (async () => {
      const ctx = new AC();
      try {
        const buf = await dataUrlToBlob(asset.data).arrayBuffer();
        const audio = await ctx.decodeAudioData(buf);
        const ch = audio.getChannelData(0);
        const size = Math.max(1, Math.floor(ch.length / buckets));
        const out: number[] = [];
        for (let b = 0; b < buckets; b++) {
          let peak = 0;
          for (let i = b * size; i < Math.min(ch.length, (b + 1) * size); i += 4) peak = Math.max(peak, Math.abs(ch[i]));
          out.push(peak);
        }
        const max = Math.max(0.01, ...out);
        if (!cancelled) setPeaks(out.map((p) => p / max));
      } catch {
        /* undecodable: no waveform */
      } finally {
        void ctx.close().catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset, buckets]);
  return peaks;
}

function TrimBar({
  duration,
  start,
  end,
  time,
  onRange,
  onSeek,
  peaks,
  tall,
}: {
  duration: number;
  start: number;
  end: number;
  time: number;
  onRange(start: number, end: number, moved: 'start' | 'end'): void;
  onSeek(t: number): void;
  peaks?: number[] | null;
  tall?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<'start' | 'end' | 'seek' | null>(null);
  const pct = (t: number) => `${(duration > 0 ? Math.max(0, Math.min(1, t / duration)) : 0) * 100}%`;
  const at = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return r.width > 0 ? Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration)) : 0;
  };
  const apply = (which: 'start' | 'end', t: number) => {
    const next = moveTrim({ start, end }, which, t, duration);
    onRange(next.start, next.end, which);
  };
  const down = (which: 'start' | 'end' | 'seek') => (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = which;
    track.current?.setPointerCapture?.(e.pointerId);
    if (which === 'seek') onSeek(Math.max(start, Math.min(end, at(e.clientX))));
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const t = at(e.clientX);
    if (d === 'seek') onSeek(Math.max(start, Math.min(end, t)));
    else apply(d, t);
  };
  const up = () => (drag.current = null);
  const keys = (which: 'start' | 'end') => (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 1 : 0.1;
    const v = which === 'start' ? start : end;
    const k: Record<string, number> = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step };
    if (e.key in k) apply(which, v + k[e.key]);
    else if (e.key === 'Home') apply(which, 0);
    else if (e.key === 'End') apply(which, duration);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div className={`ed-trim ${tall ? 'is-tall' : ''}`}>
      <div
        className="ed-trim-track"
        ref={track}
        onPointerDown={down('seek')}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        data-testid="trim-track"
      >
        {peaks ? (
          <svg className="ed-trim-wave" viewBox={`0 0 ${peaks.length} 100`} preserveAspectRatio="none" aria-hidden="true">
            {peaks.map((p, i) => (
              <rect key={i} x={i + 0.15} width={0.7} y={50 - Math.max(2, p * 46)} height={Math.max(4, p * 92)} rx={0.35} />
            ))}
          </svg>
        ) : (
          <span className="ed-trim-ticks" aria-hidden="true" />
        )}
        <span className="ed-trim-out is-left" style={{ width: pct(start) }} />
        <span className="ed-trim-out is-right" style={{ left: pct(end) }} />
        <span className="ed-trim-sel" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }} />
        <span className="ed-trim-head" style={{ left: pct(time) }} aria-hidden="true" />
        {(['start', 'end'] as const).map((w) => (
          <span
            key={w}
            className={`ed-trim-handle is-${w}`}
            style={{ left: pct(w === 'start' ? start : end) }}
            role="slider"
            tabIndex={0}
            aria-label={w === 'start' ? 'Trim start' : 'Trim end'}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration * 10) / 10}
            aria-valuenow={Math.round((w === 'start' ? start : end) * 10) / 10}
            aria-valuetext={formatPrecise(w === 'start' ? start : end)}
            data-testid={`trim-${w}`}
            onPointerDown={down(w)}
            onPointerMove={move}
            onPointerUp={up}
            onKeyDown={keys(w)}
          />
        ))}
      </div>
      <div className="ed-trim-labels">
        <span>
          Start <b data-testid="trim-start-label">{formatPrecise(start)}</b>
        </span>
        <span className="is-len">
          Length <b data-testid="trim-length">{formatPrecise(end - start)}</b> of {formatPrecise(duration)}
        </span>
        <span>
          End <b data-testid="trim-end-label">{formatPrecise(end)}</b>
        </span>
      </div>
    </div>
  );
}

function useTrim(edit: MediaEdit, onChange: (e: MediaEdit) => void, duration: number) {
  const start = edit.trim ? Math.min(edit.trim.start, duration) : 0;
  const end = edit.trim ? Math.min(edit.trim.end, duration || edit.trim.end) : duration;
  const setRange = (s: number, e: number) => {
    const out = { ...edit };
    if (s <= 0.0005 && e >= duration - 0.0005) delete out.trim;
    else out.trim = { start: Math.round(s * 1000) / 1000, end: Math.round(e * 1000) / 1000 };
    onChange(out);
  };
  return { start, end, setRange };
}

function Transport({ playing, toggle, time, start, label }: { playing: boolean; toggle(): void; time: number; start: number; label: string }) {
  return (
    <div className="ed-transport">
      <button className="ed-transport-play" onClick={toggle} aria-label={playing ? `Pause ${label}` : `Play ${label}`} data-testid="edit-play">
        <Icon name={playing ? 'pause' : 'play'} size={18} stroke={2.4} />
      </button>
      <span className="ed-transport-time">{formatPrecise(Math.max(0, time - start))}</span>
    </div>
  );
}

function VideoSurface({ asset, src, edit, onChange }: { asset: Asset; src: string; edit: MediaEdit; onChange(e: MediaEdit): void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const width = useWidth(wrap);
  const [dims, setDims] = useState({ width: asset.width || 1280, height: asset.height || 720 });
  const box = fitBox(dims.width / dims.height, width, 340);
  const crop = useCropControls(edit, onChange, dims);
  const duration = useDuration(asset, video);
  const trim = useTrim(edit, onChange, duration);
  const player = useSegmentPlayer(video, trim.start, trim.end);
  const out = editedSize(dims.width, dims.height, edit);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const read = () => {
      if (v.videoWidth && v.videoHeight) setDims({ width: v.videoWidth, height: v.videoHeight });
      // Show the first frame of the trimmed part.
      if (v.currentTime === 0) v.currentTime = edit.trim?.start || 0.05;
    };
    v.addEventListener('loadedmetadata', read);
    return () => v.removeEventListener('loadedmetadata', read);
    // Only the first metadata matters (the start frame).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="ed-medit">
      <div className="ed-medit-tools">
        <span className="ed-medit-label">
          <Icon name="crop" size={16} /> Crop
        </span>
        <AspectChips value={crop.aspectId} onPick={crop.pick} />
      </div>
      <div className="ed-medit-stage is-dark" ref={wrap}>
        <div className="ed-crop-frame" style={{ width: box.w, height: box.h }}>
          <video ref={video} className="ed-crop-media" src={src} playsInline preload="auto" data-testid="edit-video" />
          <CropOverlay crop={crop.crop} onChange={crop.setCrop} aspect={crop.lock} pixels={dims} boxW={box.w} boxH={box.h} />
        </div>
      </div>
      <div className="ed-medit-tools">
        <span className="ed-medit-label">
          <Icon name="scissors" size={16} /> Trim
        </span>
        <Transport playing={player.playing} toggle={player.toggle} time={player.time} start={trim.start} label="video" />
      </div>
      {duration > 0 ? (
        <TrimBar
          duration={duration}
          start={trim.start}
          end={trim.end}
          time={player.time}
          onRange={(s, e, moved) => {
            trim.setRange(s, e);
            player.seek(moved === 'start' ? s : Math.max(s, e - 0.04));
          }}
          onSeek={player.seek}
        />
      ) : (
        <p className="ed-note">Reading the video's length…</p>
      )}
      <p className="ed-medit-facts">
        <Icon name="video" size={14} /> {Math.round(out.width)} × {Math.round(out.height)} px · {formatPrecise(Math.max(0, trim.end - trim.start))}
        <span className="ed-medit-tip">The full original video stays in your project, so you can change this later</span>
      </p>
    </div>
  );
}

function AudioSurface({ asset, src, edit, onChange }: { asset: Asset; src: string; edit: MediaEdit; onChange(e: MediaEdit): void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const duration = useDuration(asset, audio);
  const trim = useTrim(edit, onChange, duration);
  const player = useSegmentPlayer(audio, trim.start, trim.end);
  const peaks = useWaveform(asset);
  return (
    <div className="ed-medit">
      <audio ref={audio} src={src} preload="auto" data-testid="edit-audio" />
      <div className="ed-medit-tools">
        <span className="ed-medit-label">
          <Icon name="scissors" size={16} /> Trim the start and end
        </span>
        <Transport playing={player.playing} toggle={player.toggle} time={player.time} start={trim.start} label="sound" />
      </div>
      {duration > 0 ? (
        <TrimBar
          tall
          duration={duration}
          start={trim.start}
          end={trim.end}
          time={player.time}
          peaks={peaks}
          onRange={(s, e, moved) => {
            trim.setRange(s, e);
            player.seek(moved === 'start' ? s : Math.max(s, e - 0.5));
          }}
          onSeek={player.seek}
        />
      ) : (
        <p className="ed-note">Reading the sound's length…</p>
      )}
      <p className="ed-medit-facts">
        <Icon name="audio" size={14} /> Plays {formatPrecise(Math.max(0, trim.end - trim.start))}
        {edit.trim ? ` (from ${formatPrecise(trim.start)} to ${formatPrecise(trim.end)})` : ''}
        <span className="ed-medit-tip">Drag the handles to cut silence at the start or end</span>
      </p>
    </div>
  );
}

// ---------------- helpers for dialogs ----------------

/** True when two edits describe the same result. */
export function sameEdit(a: MediaEdit, b: MediaEdit): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Normalises an edit for saving (drops identity parts). */
export function cleanEdit(asset: Asset, edit: MediaEdit): MediaEdit {
  return sanitizeEdit(edit, assetKind(asset.mime), asset.duration);
}

export const KIND_NOUN = { image: 'picture', video: 'video', audio: 'sound' } as const;

/** Title + editing surface + footer, inside an existing dialog body. */
export function MediaEditBody({
  asset,
  src,
  edit,
  onChange,
  intro,
  footer,
}: {
  asset: Asset;
  src?: string;
  edit: MediaEdit;
  onChange(e: MediaEdit): void;
  intro?: ReactNode;
  footer: ReactNode;
}) {
  const kind = assetKind(asset.mime);
  const verb = kind === 'image' ? 'Crop & rotate' : kind === 'video' ? 'Trim & crop' : 'Trim';
  return (
    <>
      <div className="ed-medit-head">
        <span className={`ed-medit-badge is-${kind}`}>
          <Icon name={kind === 'image' ? 'crop' : 'scissors'} size={20} />
        </span>
        <div>
          <h2>
            {verb} <span className="ed-medit-name">{asset.name}</span>
          </h2>
          {intro && <p>{intro}</p>}
        </div>
      </div>
      <MediaEditSurface asset={asset} src={src} edit={edit} onChange={onChange} />
      <div className="ed-modal-actions ed-medit-actions">
        <button className="ed-btn ed-btn-ghost" onClick={() => onChange({})} disabled={isIdentity(edit)} data-testid="edit-reset">
          <Icon name="reset" size={16} /> Reset to original
        </button>
        <span className="ed-grow" />
        {footer}
      </div>
    </>
  );
}
