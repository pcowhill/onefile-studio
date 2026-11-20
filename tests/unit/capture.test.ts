import { describe, expect, it, vi } from 'vitest';
import type { CaptureDeps, RecorderLike, RecorderOptions } from '../../src/io/capture';
import {
  AUDIO_MIME_CANDIDATES,
  captureName,
  captureScreenshot,
  captureSupport,
  extensionFor,
  friendlyCaptureError,
  openCamera,
  pausedClock,
  pickMimeType,
  recordedSeconds,
  recordStream,
  resumedClock,
  startedClock,
  startMicrophone,
  startScreen,
  startScreenCamera,
  startWebcam,
  VIDEO_MIME_CANDIDATES,
  VIDEO_ONLY_MIME_CANDIDATES,
  videoCandidates,
} from '../../src/io/capture';

/**
 * Capture lifecycle against fake browser APIs (jsdom has no getUserMedia,
 * getDisplayMedia or MediaRecorder). The approach follows the reference
 * video editor's recording tests: tracks record whether they were stopped,
 * the fake recorder records its calls and delivers chunks on stop.
 */

class FakeTrack extends EventTarget {
  stopped = false;
  constructor(public kind: 'audio' | 'video') {
    super();
  }
  stop() {
    this.stopped = true;
  }
  /** What the browser does when its own "Stop sharing" button is used. */
  end() {
    this.stopped = true;
    this.dispatchEvent(new Event('ended'));
  }
}

function fakeStream(kinds: Array<'audio' | 'video'>) {
  const tracks = kinds.map((k) => new FakeTrack(k));
  const stream = {
    tracks,
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
  };
  return stream as unknown as MediaStream & { tracks: FakeTrack[] };
}

class FakeRecorder implements RecorderLike {
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  state = 'inactive';
  calls: string[] = [];
  chunks: Blob[];
  constructor(
    public stream: MediaStream,
    public options: RecorderOptions,
    chunks = [new Blob(['abc'], { type: 'video/webm' })],
  ) {
    this.chunks = chunks;
  }
  get mimeType() {
    return this.options.mimeType ?? 'video/webm';
  }
  start(timeslice?: number) {
    this.calls.push(`start:${timeslice}`);
    this.state = 'recording';
  }
  pause() {
    this.calls.push('pause');
    this.state = 'paused';
  }
  resume() {
    this.calls.push('resume');
    this.state = 'recording';
  }
  stop() {
    this.calls.push('stop');
    this.state = 'inactive';
    for (const c of this.chunks) this.ondataavailable?.({ data: c });
    queueMicrotask(() => this.onstop?.());
  }
}

function deps(opts: { supported?: string[]; failUser?: (c: MediaStreamConstraints) => Error | null; failDisplay?: Error; chunks?: Blob[] } = {}) {
  const recorders: FakeRecorder[] = [];
  const streams: Array<MediaStream & { tracks: FakeTrack[] }> = [];
  const d: CaptureDeps & { recorders: FakeRecorder[]; streams: typeof streams } = {
    recorders,
    streams,
    getUserMedia: vi.fn(async (c: MediaStreamConstraints) => {
      const err = opts.failUser?.(c);
      if (err) throw err;
      const s = fakeStream([...(c.video ? (['video'] as const) : []), ...(c.audio ? (['audio'] as const) : [])]);
      streams.push(s);
      return s;
    }),
    getDisplayMedia: vi.fn(async () => {
      if (opts.failDisplay) throw opts.failDisplay;
      const s = fakeStream(['video']);
      streams.push(s);
      return s;
    }),
    createRecorder: (stream, options) => {
      const r = new FakeRecorder(stream, options, opts.chunks);
      recorders.push(r);
      return r;
    },
    isTypeSupported: (m) => (opts.supported ?? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'audio/webm;codecs=opus']).includes(m),
  };
  return d;
}

const named = (name: string) => Object.assign(new Error(name), { name });
const allStopped = (s: { tracks: FakeTrack[] }) => s.tracks.every((t) => t.stopped);

describe('capability detection', () => {
  it('offers each source only where the browser can provide it, with a reason otherwise', () => {
    expect(Object.values(captureSupport(deps(), true).reasons).every((r) => r === null)).toBe(true);
    const noScreen = captureSupport({ ...deps(), getDisplayMedia: undefined }, true).reasons;
    expect(noScreen.screenshot).toMatch(/can’t share your screen/);
    expect(noScreen.screenCamera).toMatch(/can’t share your screen/);
    expect(noScreen.webcam).toBeNull();
    const noRecorder = captureSupport({ ...deps(), createRecorder: undefined }, true).reasons;
    expect(noRecorder.screenshot).toBeNull();
    expect(noRecorder.photo).toBeNull();
    expect(noRecorder.screen).toMatch(/can’t record/);
    const insecure = captureSupport({}, false).reasons;
    expect(Object.values(insecure).every((r) => /secure page/.test(r ?? ''))).toBe(true);
  });

  it('chooses the first container the recorder supports, and none that names a missing audio track', () => {
    expect(pickMimeType(VIDEO_MIME_CANDIDATES, (m) => m === 'video/webm')).toBe('video/webm');
    expect(pickMimeType(VIDEO_MIME_CANDIDATES, (m) => m.startsWith('video/mp4'))).toBe('video/mp4;codecs=avc1,mp4a');
    expect(pickMimeType(AUDIO_MIME_CANDIDATES, () => false)).toBeUndefined();
    expect(pickMimeType(AUDIO_MIME_CANDIDATES, undefined)).toBeUndefined();
    expect(
      pickMimeType(['a', 'b'], (m) => {
        if (m === 'a') throw new Error('boom');
        return true;
      }),
    ).toBe('b');
    expect(videoCandidates(fakeStream(['video']))).toBe(VIDEO_ONLY_MIME_CANDIDATES);
    expect(videoCandidates(fakeStream(['video', 'audio']))).toBe(VIDEO_MIME_CANDIDATES);
    expect(VIDEO_ONLY_MIME_CANDIDATES.some((m) => /opus|mp4a/.test(m))).toBe(false);
  });

  it('names files and extensions predictably', () => {
    expect(captureName('Screenshot', [], 'png')).toBe('Screenshot 1.png');
    expect(captureName('Screenshot', ['Screenshot 1.png', 'Screenshot 4.png', 'Screen recording 9.webm'], 'png')).toBe('Screenshot 5.png');
    expect(captureName('Screen recording', ['Screen recording 2.mp4'], 'webm')).toBe('Screen recording 3.webm');
    expect(extensionFor('video/mp4')).toBe('mp4');
    expect(extensionFor('video/webm')).toBe('webm');
    expect(extensionFor('audio/mp4')).toBe('m4a');
    expect(extensionFor('audio/ogg')).toBe('ogg');
    expect(extensionFor('image/png')).toBe('png');
  });
});

describe('recording lifecycle', () => {
  it('records the microphone: deferred start, pause/resume, stop to a File, microphone released', async () => {
    const d = deps();
    const s = await startMicrophone(d);
    const rec = d.recorders[0];
    expect(rec.options.mimeType).toBe('audio/webm;codecs=opus');
    expect(rec.options.videoKeyFrameIntervalDuration).toBeUndefined();
    expect(rec.calls).toEqual([]); // nothing until the countdown ends
    s.pause(); // ignored before begin
    s.begin();
    s.begin(); // once only
    s.pause();
    s.pause();
    s.resume();
    expect(rec.calls).toEqual(['start:1000', 'pause', 'resume']);
    expect(s.canPause).toBe(true);
    const file = await s.stop('Voice recording 1.webm');
    expect(file.name).toBe('Voice recording 1.webm');
    expect(file.type).toBe('audio/webm');
    expect(file.size).toBe(3);
    expect(allStopped(d.streams[0])).toBe(true);
    await expect(s.stop('again')).rejects.toThrow();
  });

  it('cancel discards the take and releases the device, also during the countdown', async () => {
    const d = deps();
    const a = await startMicrophone(d);
    a.cancel();
    expect(allStopped(d.streams[0])).toBe(true);
    expect(d.recorders[0].calls).toEqual([]);
    const b = await startWebcam(d);
    b.begin();
    b.cancel();
    b.cancel();
    expect(allStopped(d.streams[1])).toBe(true);
    expect(d.recorders[1].calls).toEqual(['start:1000', 'stop']);
  });

  it('an empty take is reported, not added', async () => {
    const d = deps({ chunks: [] });
    const s = await startMicrophone(d);
    s.begin();
    await expect(s.stop('x.webm')).rejects.toMatchObject({ name: 'EmptyRecording' });
    expect(allStopped(d.streams[0])).toBe(true);
    const never = await startMicrophone(deps());
    await expect(never.stop('x.webm')).rejects.toMatchObject({ name: 'EmptyRecording' });
  });

  it('releases the device when the recorder cannot be created', () => {
    const stream = fakeStream(['audio']);
    expect(() =>
      recordStream(
        stream,
        {
          createRecorder: () => {
            throw named('NotSupportedError');
          },
        },
        AUDIO_MIME_CANDIDATES,
        'audio/webm',
        false,
      ),
    ).toThrow();
    expect(allStopped(stream as unknown as { tracks: FakeTrack[] })).toBe(true);
  });

  it('a webcam without a microphone still records, silently', async () => {
    const d = deps({ failUser: (c) => (c.audio ? named('NotFoundError') : null) });
    const s = await startWebcam(d);
    expect(s.hasAudio).toBe(false);
    expect(d.recorders[0].options.mimeType).toBe('video/webm;codecs=vp9');
    expect(d.recorders[0].options.videoKeyFrameIntervalDuration).toBe(1000);
    s.cancel();
  });

  it('a camera refusal surfaces (no silent fallback when the camera itself is denied)', async () => {
    const d = deps({ failUser: () => named('NotAllowedError') });
    await expect(openCamera(d)).rejects.toMatchObject({ name: 'NotAllowedError' });
  });

  it('the browser’s own "Stop sharing" concludes a screen recording', async () => {
    const d = deps();
    const ended = vi.fn();
    const s = await startScreen(ended, d);
    s.begin();
    d.streams[0].tracks[0].end();
    expect(ended).toHaveBeenCalledTimes(1);
    const f = await s.stop('Screen recording 1.webm');
    expect(f.size).toBeGreaterThan(0);
  });

  it('screen + webcam: both start together, one stop concludes both', async () => {
    const d = deps();
    const pair = await startScreenCamera(() => {}, d);
    pair.begin();
    expect(d.recorders.map((r) => r.calls)).toEqual([['start:1000'], ['start:1000']]);
    pair.pause();
    pair.resume();
    const files = await pair.stop('Screen recording 1.webm', 'Webcam recording 1.webm');
    expect(files.screen.name).toBe('Screen recording 1.webm');
    expect(files.camera.name).toBe('Webcam recording 1.webm');
    expect(d.streams.every(allStopped)).toBe(true);
  });

  it('screen + webcam: a camera denial cancels the whole start and releases the screen', async () => {
    const d = deps({ failUser: () => named('NotAllowedError') });
    await expect(startScreenCamera(() => {}, d)).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(d.streams).toHaveLength(1);
    expect(allStopped(d.streams[0])).toBe(true);
  });

  it('screen + webcam cancel releases everything', async () => {
    const d = deps();
    const pair = await startScreenCamera(() => {}, d);
    pair.begin();
    pair.cancel();
    expect(d.streams.every(allStopped)).toBe(true);
  });

  it('a dismissed screen picker becomes a friendly message', async () => {
    const d = deps({ failDisplay: named('NotAllowedError') });
    const err = await startScreen(() => {}, d).catch((e) => e);
    expect(friendlyCaptureError(err, 'screen')).toMatch(/Screen sharing was cancelled/);
  });
});

describe('screenshots', () => {
  it('grabs one still and releases the share at once', async () => {
    const d = deps();
    const png = new Blob(['png'], { type: 'image/png' });
    const out = await captureScreenshot(d, async () => png);
    expect(out).toBe(png);
    expect(d.getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: false });
    expect(allStopped(d.streams[0])).toBe(true);
  });

  it('releases the share even when no frame arrives', async () => {
    const d = deps();
    await expect(
      captureScreenshot(d, async () => {
        throw named('AbortError');
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(allStopped(d.streams[0])).toBe(true);
  });

  it('a cancelled picker grants nothing to release', async () => {
    const d = deps({ failDisplay: named('NotAllowedError') });
    await expect(captureScreenshot(d)).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(d.streams).toHaveLength(0);
  });
});

describe('friendly errors and the recorded-time clock', () => {
  it('never shows raw browser messages', () => {
    const raw = Object.assign(new Error('Permission denied by system xyz'), { name: 'NotAllowedError' });
    expect(friendlyCaptureError(raw, 'webcam')).toMatch(/Access to your camera was blocked/);
    expect(friendlyCaptureError(raw, 'microphone')).toMatch(/microphone was blocked/);
    expect(friendlyCaptureError(named('NotFoundError'), 'microphone')).toMatch(/No microphone/);
    expect(friendlyCaptureError(named('NotFoundError'), 'photo')).toMatch(/No camera/);
    expect(friendlyCaptureError(named('NotReadableError'), 'webcam')).toMatch(/another app/);
    expect(friendlyCaptureError(new Error('x'), 'screen')).toMatch(/Something went wrong/);
    expect(friendlyCaptureError(undefined, 'screen')).not.toMatch(/undefined/);
    for (const name of [
      'NotAllowedError',
      'NotFoundError',
      'NotReadableError',
      'AbortError',
      'SecurityError',
      'EmptyRecording',
      'UnplayableRecording',
      'TypeError',
    ])
      expect(friendlyCaptureError(named(name), 'screen')).not.toMatch(/Error/);
  });

  it('counts recorded time without paused spans', () => {
    let c = startedClock(1000);
    expect(recordedSeconds(c, 3000)).toBe(2);
    c = pausedClock(c, 4000);
    expect(recordedSeconds(c, 9000)).toBe(3);
    c = resumedClock(c, 10000);
    expect(recordedSeconds(c, 11500)).toBe(4.5);
    expect(pausedClock(pausedClock(c, 12000), 13000)).toEqual(pausedClock(c, 12000));
  });
});
