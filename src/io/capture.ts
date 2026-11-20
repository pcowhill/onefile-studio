/**
 * Browser-native capture: screenshots, webcam photos, and screen / webcam /
 * microphone / screen + webcam recordings, delivered as ordinary `File`s that
 * go through the same asset pipeline as uploads (`addMediaFiles`).
 *
 * The recording lifecycle (deferred start for the countdown, pause/resume,
 * stop-to-File, cancel-to-discard, stream release on every conclusion, the
 * browser's own "Stop sharing" ending a take, paired screen + camera takes
 * started back to back) is adapted from the browser video editor in
 * pcowhill/claude-agile-team-demo (`src/lib/recording.ts`), simplified for
 * OneFile Studio. Every browser API is injectable (`CaptureDeps`) because
 * jsdom has neither getUserMedia/getDisplayMedia nor MediaRecorder.
 */

/** The slice of MediaRecorder this module uses. */
export interface RecorderLike {
  start(timeslice?: number): void;
  stop(): void;
  pause?(): void;
  resume?(): void;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  readonly mimeType: string;
  readonly state?: string;
}

export interface RecorderOptions {
  mimeType?: string;
  /** Spec'd keyframe spacing (ms); unknown options are ignored by browsers that lack it. */
  videoKeyFrameIntervalDuration?: number;
  videoBitsPerSecond?: number;
}

export interface CaptureDeps {
  getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
  getDisplayMedia?: (c: DisplayMediaStreamOptions) => Promise<MediaStream>;
  createRecorder?: (stream: MediaStream, options: RecorderOptions) => RecorderLike;
  isTypeSupported?: (mime: string) => boolean;
}

/** The real browser APIs, where they exist (insecure contexts expose no mediaDevices). */
export function browserDeps(): CaptureDeps {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  const MR = typeof MediaRecorder !== 'undefined' ? MediaRecorder : undefined;
  return {
    getUserMedia: md?.getUserMedia ? (c) => md.getUserMedia(c) : undefined,
    getDisplayMedia: md?.getDisplayMedia ? (c) => md.getDisplayMedia(c) : undefined,
    createRecorder: MR ? (s, o) => new MR(s, o) as unknown as RecorderLike : undefined,
    isTypeSupported: MR ? (m) => MR.isTypeSupported(m) : undefined,
  };
}

export type CaptureSource = 'screenshot' | 'photo' | 'screen' | 'webcam' | 'microphone' | 'screenCamera';

export interface CaptureSupport {
  /** Per source: null when available, otherwise a friendly reason. */
  reasons: Record<CaptureSource, string | null>;
}

/** Which capture sources this browser/context can offer, and why not. */
export function captureSupport(deps: CaptureDeps = browserDeps(), secure = typeof isSecureContext === 'undefined' ? true : isSecureContext): CaptureSupport {
  const insecure = 'Capture needs a secure page (https:// or localhost). Open OneFile Studio from a secure address to use it.';
  const noScreen = 'This browser can’t share your screen (screen sharing is usually not available on phones and tablets).';
  const noDevices = 'This browser doesn’t give pages access to cameras or microphones.';
  const noRecorder = 'This browser can’t record media.';
  const screen = !secure && !deps.getDisplayMedia ? insecure : deps.getDisplayMedia ? null : noScreen;
  const user = !secure && !deps.getUserMedia ? insecure : deps.getUserMedia ? null : noDevices;
  const rec = deps.createRecorder ? null : noRecorder;
  return {
    reasons: {
      screenshot: screen,
      photo: user,
      screen: screen ?? rec,
      webcam: user ?? rec,
      microphone: user ?? rec,
      screenCamera: screen ?? user ?? rec,
    },
  };
}

// ---------------- formats ----------------

/** Video containers, first supported wins (Chromium/Firefox: WebM; Safari: MP4). */
export const VIDEO_MIME_CANDIDATES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4'];
/**
 * For a stream with no audio track: no audio codec named. Firefox's recorder
 * stalls forever when told `vp8,opus` for a video-only stream (reference #579).
 */
export const VIDEO_ONLY_MIME_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1', 'video/mp4'];
export const AUDIO_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

/** Keyframe every second: trims and seeks in recordings stay fast. */
export const KEYFRAME_INTERVAL_MS = 1000;

/** The first candidate the recorder supports, or undefined (browser default). */
export function pickMimeType(candidates: readonly string[], isTypeSupported?: (m: string) => boolean): string | undefined {
  if (!isTypeSupported) return undefined;
  return candidates.find((c) => {
    try {
      return isTypeSupported(c);
    } catch {
      return false;
    }
  });
}

export function videoCandidates(stream: MediaStream): readonly string[] {
  return stream.getAudioTracks().length > 0 ? VIDEO_MIME_CANDIDATES : VIDEO_ONLY_MIME_CANDIDATES;
}

/** File extension for a recorded MIME type. */
export function extensionFor(mime: string): string {
  const m = mime.toLowerCase();
  if (m.startsWith('audio/')) return m.includes('mp4') ? 'm4a' : m.includes('ogg') ? 'ogg' : 'webm';
  if (m.startsWith('image/')) return m.includes('jpeg') ? 'jpg' : 'png';
  return m.includes('mp4') ? 'mp4' : 'webm';
}

/**
 * `<prefix> N.<ext>` with N one more than the highest number already used
 * with that prefix (so removing an old capture never re-issues its name).
 */
export function captureName(prefix: string, existing: readonly string[], ext: string): string {
  let highest = 0;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)\\b`);
  for (const n of existing) {
    const m = re.exec(n);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `${prefix} ${highest + 1}.${ext}`;
}

export const CAPTURE_PREFIX: Record<CaptureSource, string> = {
  screenshot: 'Screenshot',
  photo: 'Photo',
  screen: 'Screen recording',
  webcam: 'Webcam recording',
  microphone: 'Voice recording',
  screenCamera: 'Screen recording',
};

// ---------------- errors ----------------

/**
 * A friendly sentence for a capture failure. Never shows raw browser
 * messages: the error's name decides.
 */
export function friendlyCaptureError(err: unknown, source: CaptureSource): string {
  const name = (err as { name?: string } | null)?.name ?? '';
  const screen = source === 'screen' || source === 'screenshot' || source === 'screenCamera';
  const device = source === 'microphone' ? 'microphone' : source === 'screenCamera' ? 'camera' : 'camera';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return screen
        ? 'Screen sharing was cancelled or not allowed. Choose a screen, window or tab when your browser asks.'
        : `Access to your ${device} was blocked. Allow it in your browser’s address bar (the camera/microphone icon) and try again.`;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return source === 'microphone' ? 'No microphone was found. Connect one and try again.' : 'No camera was found. Connect one and try again.';
    case 'NotReadableError':
    case 'TrackStartError':
      return `Your ${screen ? 'screen' : device} couldn’t be started — another app may be using it. Close that app and try again.`;
    case 'AbortError':
      return 'Capture was interrupted. Please try again.';
    case 'SecurityError':
      return 'This page isn’t allowed to capture media. Open OneFile Studio from a secure address (https://) and try again.';
    case 'EmptyRecording':
      return 'Nothing was recorded. Try recording for a little longer.';
    case 'AssetError':
      // Already a friendly sentence from the asset pipeline (e.g. "too large to embed").
      return (err as Error).message || 'This capture couldn’t be added to your project.';
    case 'UnplayableRecording':
      return 'The recording couldn’t be played back in this browser, so it wasn’t added.';
    case 'NotSupportedError':
    case 'TypeError':
      return 'This browser can’t capture this kind of media.';
    default:
      return 'Something went wrong while capturing. Please try again.';
  }
}

export class CaptureError extends Error {
  constructor(name: string, message = name) {
    super(message);
    this.name = name;
  }
}

/** Stops every track of the given streams (safe to call repeatedly). */
export function releaseStreams(...streams: Array<MediaStream | null | undefined>) {
  for (const s of streams) for (const t of s?.getTracks() ?? []) t.stop();
}

// ---------------- recording sessions ----------------

/** One capture in progress; exactly one of stop/cancel concludes it. */
export interface RecordingSession {
  readonly mimeType: string;
  readonly stream: MediaStream;
  readonly canPause: boolean;
  /** Starts the recorder once (after the countdown). */
  begin(): void;
  pause(): void;
  resume(): void;
  /** Concludes the take and resolves its bytes; rejects with EmptyRecording when nothing was captured. */
  stop(fileName: string): Promise<File>;
  /** Discards the take; releases the device. */
  cancel(): void;
  readonly concluded: boolean;
}

/**
 * Wraps an already-granted stream in a session. The recorder is created now
 * but only started by `begin()`; every conclusion stops all tracks.
 */
export function recordStream(stream: MediaStream, deps: CaptureDeps, candidates: readonly string[], fallbackMime: string, video: boolean): RecordingSession {
  if (!deps.createRecorder) {
    releaseStreams(stream);
    throw new CaptureError('NotSupportedError');
  }
  const mimeType = pickMimeType(candidates, deps.isTypeSupported);
  let recorder: RecorderLike;
  try {
    recorder = deps.createRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      ...(video ? { videoKeyFrameIntervalDuration: KEYFRAME_INTERVAL_MS } : {}),
    });
  } catch (err) {
    releaseStreams(stream);
    throw err instanceof Error ? err : new CaptureError('NotSupportedError');
  }
  const chunks: Blob[] = [];
  let failure: Error | null = null;
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.onerror = () => {
    failure = new CaptureError('RecorderError', 'The recorder failed while recording.');
  };
  let started = false;
  let paused = false;
  let concluded = false;
  const canPause = typeof recorder.pause === 'function' && typeof recorder.resume === 'function';
  const type = () => (recorder.mimeType || mimeType || fallbackMime).split(';')[0];
  const session: RecordingSession = {
    get mimeType() {
      return type();
    },
    stream,
    canPause,
    get concluded() {
      return concluded;
    },
    begin() {
      if (started || concluded) return;
      started = true;
      // A timeslice keeps the data flowing in pieces, so a take that ends
      // abruptly (device unplugged) still has everything recorded so far.
      recorder.start(1000);
    },
    pause() {
      if (!canPause || !started || paused || concluded) return;
      paused = true;
      recorder.pause?.();
    },
    resume() {
      if (!canPause || !started || !paused || concluded) return;
      paused = false;
      recorder.resume?.();
    },
    stop(fileName) {
      if (concluded) return Promise.reject(new CaptureError('AbortError', 'The recording is already finished.'));
      concluded = true;
      if (!started) {
        releaseStreams(stream);
        return Promise.reject(new CaptureError('EmptyRecording'));
      }
      return new Promise<File>((resolve, reject) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          releaseStreams(stream);
          if (failure && !chunks.length) return reject(failure);
          const size = chunks.reduce((n, c) => n + c.size, 0);
          if (!size) return reject(new CaptureError('EmptyRecording'));
          resolve(new File(chunks, fileName, { type: type() }));
        };
        recorder.onstop = finish;
        try {
          if (recorder.state === 'inactive') finish();
          else recorder.stop();
        } catch {
          finish();
        }
      });
    },
    cancel() {
      if (concluded) return;
      concluded = true;
      recorder.ondataavailable = null;
      if (started) {
        recorder.onstop = () => releaseStreams(stream);
        try {
          if (recorder.state !== 'inactive') recorder.stop();
        } catch {
          /* already stopped */
        }
      }
      releaseStreams(stream);
    },
  };
  return session;
}

/** Microphone → audio session (not started). */
export async function startMicrophone(deps: CaptureDeps = browserDeps()): Promise<RecordingSession> {
  if (!deps.getUserMedia) throw new CaptureError('NotSupportedError');
  const stream = await deps.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  return recordStream(stream, deps, AUDIO_MIME_CANDIDATES, 'audio/webm', false);
}

/**
 * Camera (+ microphone when there is one) stream. A missing or refused
 * microphone costs the sound, never the picture: a video-only request is
 * tried before giving up. `withAudio` false asks for video only (photos).
 */
export async function openCamera(deps: CaptureDeps = browserDeps(), withAudio = true): Promise<{ stream: MediaStream; hasAudio: boolean }> {
  if (!deps.getUserMedia) throw new CaptureError('NotSupportedError');
  const video: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };
  if (withAudio) {
    try {
      const stream = await deps.getUserMedia({ video, audio: true });
      return { stream, hasAudio: stream.getAudioTracks().length > 0 };
    } catch (err) {
      // Only retry when the camera itself may still work.
      const name = (err as { name?: string })?.name;
      if (name === 'SecurityError' || name === 'AbortError') throw err;
    }
  }
  const stream = await deps.getUserMedia({ video });
  return { stream, hasAudio: false };
}

/** Webcam → video session (not started). */
export async function startWebcam(deps: CaptureDeps = browserDeps()): Promise<RecordingSession & { hasAudio: boolean }> {
  const { stream, hasAudio } = await openCamera(deps, true);
  return Object.assign(recordStream(stream, deps, videoCandidates(stream), 'video/webm', true), { hasAudio });
}

/**
 * Screen → video session (not started). `onShareEnded` fires when the browser's
 * own "Stop sharing" control (or closing the shared window) ends the capture.
 */
export async function startScreen(onShareEnded: () => void, deps: CaptureDeps = browserDeps()): Promise<RecordingSession & { hasAudio: boolean }> {
  if (!deps.getDisplayMedia) throw new CaptureError('NotSupportedError');
  const stream = await deps.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: true });
  const session = recordStream(stream, deps, videoCandidates(stream), 'video/webm', true);
  for (const t of stream.getVideoTracks()) t.addEventListener('ended', onShareEnded);
  return Object.assign(session, { hasAudio: stream.getAudioTracks().length > 0 });
}

/** Both halves of a screen + webcam take: one Stop / Cancel / Pause drives both. */
export interface PairSession {
  readonly screen: RecordingSession;
  readonly camera: RecordingSession;
  readonly canPause: boolean;
  begin(): void;
  pause(): void;
  resume(): void;
  stop(screenName: string, cameraName: string): Promise<{ screen: File; camera: File }>;
  cancel(): void;
}

/**
 * Screen + webcam: the screen picker first, then the camera (with the
 * microphone travelling with the camera, the narrator's track). Either denial
 * cancels the whole start and releases what was granted. The two recorders
 * start back to back in `begin()`, which keeps them aligned.
 */
export async function startScreenCamera(onShareEnded: () => void, deps: CaptureDeps = browserDeps()): Promise<PairSession> {
  if (!deps.getDisplayMedia || !deps.getUserMedia) throw new CaptureError('NotSupportedError');
  const screenStream = await deps.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: true });
  let cam: { stream: MediaStream; hasAudio: boolean };
  try {
    cam = await openCamera(deps, true);
  } catch (err) {
    releaseStreams(screenStream);
    throw err;
  }
  const screen = recordStream(screenStream, deps, videoCandidates(screenStream), 'video/webm', true);
  let camera: RecordingSession;
  try {
    camera = recordStream(cam.stream, deps, videoCandidates(cam.stream), 'video/webm', true);
  } catch (err) {
    screen.cancel();
    throw err;
  }
  for (const t of screenStream.getVideoTracks()) t.addEventListener('ended', onShareEnded);
  let concluded = false;
  const pair: PairSession = {
    screen,
    camera,
    canPause: screen.canPause && camera.canPause,
    begin() {
      screen.begin();
      camera.begin();
    },
    pause() {
      screen.pause();
      camera.pause();
    },
    resume() {
      screen.resume();
      camera.resume();
    },
    async stop(screenName, cameraName) {
      if (concluded) throw new CaptureError('AbortError');
      concluded = true;
      // Both halves conclude (devices released) before any failure surfaces.
      const [s, c] = await Promise.allSettled([screen.stop(screenName), camera.stop(cameraName)]);
      if (s.status === 'rejected') throw s.reason;
      if (c.status === 'rejected') throw c.reason;
      return { screen: s.value, camera: c.value };
    },
    cancel() {
      if (concluded) return;
      concluded = true;
      screen.cancel();
      camera.cancel();
    },
  };
  return pair;
}

// ---------------- the recorded-time clock ----------------

/** Recorded time excluding paused spans (reference #514). */
export interface RecordingClock {
  readonly bankedMs: number;
  readonly runningSince: number | null;
}
export const startedClock = (now: number): RecordingClock => ({ bankedMs: 0, runningSince: now });
export const pausedClock = (c: RecordingClock, now: number): RecordingClock =>
  c.runningSince === null ? c : { bankedMs: c.bankedMs + Math.max(0, now - c.runningSince), runningSince: null };
export const resumedClock = (c: RecordingClock, now: number): RecordingClock => (c.runningSince !== null ? c : { bankedMs: c.bankedMs, runningSince: now });
export const recordedSeconds = (c: RecordingClock, now: number): number =>
  (c.bankedMs + (c.runningSince === null ? 0 : Math.max(0, now - c.runningSince))) / 1000;

// ---------------- stills ----------------

/**
 * Waits until `video` has presented real frames, so a still is never the
 * black/empty frame a capture shows before the first paint. Uses
 * requestVideoFrameCallback where available (waits for `frames` frames), and
 * falls back to readyState + animation frames. Gives up after `timeoutMs`.
 */
export function waitForFrames(video: HTMLVideoElement, frames = 2, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (ok || (video.videoWidth > 0 && video.readyState >= 2)) resolve();
      else reject(new CaptureError('AbortError', 'No picture arrived from the capture.'));
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const rvfc = (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
    if (typeof rvfc === 'function') {
      let left = frames;
      const onFrame = () => {
        if (--left <= 0 && video.videoWidth > 0) finish(true);
        else rvfc.call(video, onFrame);
      };
      rvfc.call(video, onFrame);
    } else {
      const poll = () => {
        if (done) return;
        if (video.videoWidth > 0 && video.readyState >= 2) setTimeout(() => finish(true), 120);
        else setTimeout(poll, 50);
      };
      poll();
    }
  });
}

/** Draws the video's current frame at its full resolution into a PNG blob. */
export async function frameToPng(video: HTMLVideoElement): Promise<Blob> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new CaptureError('AbortError', 'No picture arrived from the capture.');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new CaptureError('NotSupportedError');
  ctx.drawImage(video, 0, 0, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b && b.size > 0 ? resolve(b) : reject(new CaptureError('NotSupportedError'))), 'image/png'));
}

/** A muted, inline, off-screen video playing `stream` (for stills). */
export async function playHidden(stream: MediaStream): Promise<HTMLVideoElement> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.srcObject = stream;
  try {
    await v.play();
  } catch {
    /* frames still arrive for a muted element in most browsers */
  }
  return v;
}

/**
 * Screenshot: asks the browser for a screen/window/tab, waits for a real
 * frame, grabs it losslessly (PNG) at the source resolution and releases the
 * capture immediately.
 */
export async function captureScreenshot(deps: CaptureDeps = browserDeps(), grab: (stream: MediaStream) => Promise<Blob> = grabStill): Promise<Blob> {
  if (!deps.getDisplayMedia) throw new CaptureError('NotSupportedError');
  const stream = await deps.getDisplayMedia({ video: true, audio: false });
  try {
    return await grab(stream);
  } finally {
    // Released at once, whatever happened: the share never outlives the still.
    releaseStreams(stream);
  }
}

/** Plays a stream off-screen, waits for real frames and grabs one as PNG. */
export async function grabStill(stream: MediaStream): Promise<Blob> {
  const video = await playHidden(stream);
  try {
    await waitForFrames(video, 2);
    return await frameToPng(video);
  } finally {
    video.srcObject = null;
  }
}

// ---------------- verification & levels ----------------

/**
 * Confirms the browser can actually play a recorded file before it enters
 * the library (resolves with its duration, or 0 when unknown).
 */
export function verifyPlayable(file: Blob, kind: 'video' | 'audio', timeoutMs = 8000): Promise<number> {
  return new Promise((resolve, reject) => {
    if (!file.size) return reject(new CaptureError('EmptyRecording'));
    if (typeof URL.createObjectURL !== 'function') return resolve(0);
    const el = document.createElement(kind);
    const url = URL.createObjectURL(file);
    let done = false;
    const end = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeAttribute('src');
      el.load();
      URL.revokeObjectURL(url);
      fn();
    };
    // A browser that never answers is not proof of a broken file: accept it.
    const timer = setTimeout(() => end(() => resolve(0)), timeoutMs);
    el.muted = true;
    el.preload = 'metadata';
    el.onloadedmetadata = () => end(() => resolve(Number.isFinite(el.duration) ? el.duration : 0));
    el.onerror = () => end(() => reject(new CaptureError('UnplayableRecording')));
    el.src = url;
  });
}

/** A live 0..1 loudness reading of a stream's audio (for the level meter). */
export function levelMeter(stream: MediaStream): { read(): number; close(): void } | null {
  const AC =
    (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC || !stream.getAudioTracks().length) return null;
  try {
    const ctx = new AC();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    return {
      read() {
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        return Math.min(1, (peak / 128) * 1.6);
      },
      close() {
        try {
          src.disconnect();
          void ctx.close();
        } catch {
          /* already closed */
        }
      },
    };
  } catch {
    return null;
  }
}
