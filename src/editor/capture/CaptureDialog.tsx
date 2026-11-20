import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { toast } from '../ui/toast';
import { editor } from '../store/store';
import type { Asset } from '../../model/types';
import { assetKind } from '../../model/types';
import type { MediaEdit } from '../../model/mediaEdit';
import { describeEdit, editedSize, isIdentity, orientationMatrix, orientedSize } from '../../model/mediaEdit';
import type { CaptureSource, PairSession, RecordingClock, RecordingSession } from '../../io/capture';
import {
  browserDeps,
  CAPTURE_PREFIX,
  captureName,
  captureScreenshot,
  extensionFor,
  frameToPng,
  friendlyCaptureError,
  levelMeter,
  openCamera,
  pausedClock,
  recordedSeconds,
  releaseStreams,
  resumedClock,
  startedClock,
  startMicrophone,
  startScreen,
  startScreenCamera,
  startWebcam,
  verifyPlayable,
  waitForFrames,
} from '../../io/capture';
import { withWebmCues } from '../../io/webmCues';
import { fileToAsset } from '../../io/assets';
import { formatBytes } from '../../io/exportHtml';
import { formatTime } from '../../runtime/elements/mediaShared';
import { addCapturedAsset, insertMedia, insertPictureInPicture, replaceElementImage } from '../ops';
import { MediaEditBody } from '../media/MediaEditor';
import { CaptureIllustration } from './illustrations';
import { closeCapture, useMediaUi } from '../media/mediaUi';
import '../../styles/capture.css';

/** Seconds counted down before a recording starts (Start now skips it). */
export const COUNTDOWN_SECONDS = 3;

const TITLES: Record<CaptureSource, string> = {
  screenshot: 'Screenshot',
  photo: 'Webcam photo',
  screen: 'Screen recording',
  webcam: 'Webcam recording',
  microphone: 'Voice recording',
  screenCamera: 'Screen + webcam',
};

const WAITING: Record<CaptureSource, string> = {
  screenshot: 'Choose a screen, window or tab in your browser’s sharing window.',
  photo: 'Allow OneFile Studio to use your camera when your browser asks.',
  screen: 'Choose a screen, window or tab in your browser’s sharing window. Tick “Share audio” too if you want its sound.',
  webcam: 'Allow OneFile Studio to use your camera and microphone when your browser asks.',
  microphone: 'Allow OneFile Studio to use your microphone when your browser asks.',
  screenCamera: 'First choose what to share, then allow your camera and microphone.',
};

type Phase = 'acquire' | 'live' | 'countdown' | 'recording' | 'paused' | 'processing' | 'review' | 'edit' | 'error';

/** A capture that is ready but not in the library yet. */
interface Pending {
  asset: Asset;
  url: string;
  edit: MediaEdit;
  role: 'main' | 'camera';
}

/** Mounted once by the editor: shows the capture dialog when requested. */
export function CaptureHost() {
  const req = useMediaUi((s) => s.capture);
  if (!req) return null;
  return <CaptureDialog key={req.source + (req.replaceElementId ?? '')} source={req.source} replaceElementId={req.replaceElementId} />;
}

function CaptureDialog({ source, replaceElementId }: { source: CaptureSource; replaceElementId?: string }) {
  const [phase, setPhase] = useState<Phase>('acquire');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [clock, setClock] = useState<RecordingClock | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState<Pending[]>([]);
  const [editing, setEditing] = useState(0);
  const [draftEdit, setDraftEdit] = useState<MediaEdit>({});
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  const alive = useRef(true);
  const session = useRef<RecordingSession | null>(null);
  const pair = useRef<PairSession | null>(null);
  const photoStream = useRef<MediaStream | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const preview2 = useRef<HTMLVideoElement>(null);
  const meterBar = useRef<HTMLSpanElement>(null);
  const urls = useRef<string[]>([]);
  const stopRef = useRef<() => void>(() => {});
  const pauseBtn = useRef<HTMLButtonElement>(null);
  const startNowBtn = useRef<HTMLButtonElement>(null);
  const isRecording = source === 'screen' || source === 'webcam' || source === 'microphone' || source === 'screenCamera';

  /** Releases every device/stream this dialog holds. Safe to call repeatedly. */
  const releaseAll = useCallback(() => {
    session.current?.cancel();
    pair.current?.cancel();
    session.current = null;
    pair.current = null;
    releaseStreams(photoStream.current);
    photoStream.current = null;
  }, []);

  // A capture never outlives the dialog: closing, unmounting or leaving the page releases everything.
  useEffect(() => {
    alive.current = true;
    const onHide = () => releaseAll();
    window.addEventListener('pagehide', onHide);
    return () => {
      alive.current = false;
      window.removeEventListener('pagehide', onHide);
      releaseAll();
      for (const u of urls.current) URL.revokeObjectURL(u);
      urls.current = [];
    };
  }, [releaseAll]);

  const existingNames = () => [...Object.values(editor().project?.assets ?? {}).map((a) => a.name), ...pending.map((p) => p.asset.name)];

  const fail = (err: unknown) => {
    releaseAll();
    if (!alive.current) return;
    setError(friendlyCaptureError(err, source));
    setPhase('error');
  };

  /** Turns captured blobs into (not yet stored) assets for the review step. */
  const toPending = async (items: Array<{ blob: Blob; name: string; role: Pending['role'] }>) => {
    const out: Pending[] = [];
    for (const it of items) {
      const kind = it.blob.type.startsWith('image/') ? 'image' : it.blob.type.startsWith('audio/') ? 'audio' : 'video';
      let blob = it.blob;
      if (kind !== 'image') {
        blob = await withWebmCues(new File([blob], it.name, { type: blob.type })).catch(() => blob);
        await verifyPlayable(blob, kind === 'audio' ? 'audio' : 'video');
      }
      const file = new File([blob], it.name, { type: blob.type });
      const asset = await fileToAsset(file);
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      out.push({ asset, url, edit: {}, role: it.role });
    }
    return out;
  };

  const startClock = () => {
    setClock(startedClock(Date.now()));
    setElapsed(0);
    setPhase('recording');
  };

  /** Acquires the source (the browser asks for permission) and moves to the right phase. */
  const start = useCallback(async () => {
    setError('');
    setNotice('');
    setPhase('acquire');
    const deps = browserDeps();
    const onShareEnded = () => stopRef.current();
    try {
      if (source === 'screenshot') {
        const blob = await captureScreenshot(deps);
        if (!alive.current) return;
        setPhase('processing');
        const name = captureName(CAPTURE_PREFIX.screenshot, existingNames(), 'png');
        const items = await toPending([{ blob, name, role: 'main' }]);
        if (!alive.current) return;
        setPending(items);
        setPhase('review');
        return;
      }
      if (source === 'photo') {
        const { stream } = await openCamera(deps, false);
        if (!alive.current) return releaseStreams(stream);
        photoStream.current = stream;
        setPhase('live');
        return;
      }
      if (source === 'screenCamera') {
        const p = await startScreenCamera(onShareEnded, deps);
        if (!alive.current) return p.cancel();
        pair.current = p;
        if (!p.camera.stream.getAudioTracks().length) setNotice('No microphone was found, so the webcam video will be silent.');
      } else {
        const s = source === 'screen' ? await startScreen(onShareEnded, deps) : source === 'webcam' ? await startWebcam(deps) : await startMicrophone(deps);
        if (!alive.current) return s.cancel();
        session.current = s;
        if (source === 'webcam' && !(s as { hasAudio?: boolean }).hasAudio) setNotice('No microphone was found, so this recording will be silent.');
        if (source === 'screen' && !(s as { hasAudio?: boolean }).hasAudio) setNotice('Recording without sound (the browser didn’t share any audio).');
      }
      setCountdown(COUNTDOWN_SECONDS);
      setPhase('countdown');
    } catch (err) {
      fail(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  useEffect(() => {
    void start();
  }, [start, attempt]);

  // Live previews: muted (never echoes the captured sound).
  useEffect(() => {
    const wire = (el: HTMLVideoElement | null, stream: MediaStream | null | undefined) => {
      if (!el || !stream || el.srcObject === stream) return;
      el.srcObject = stream;
      el.muted = true;
      void el.play().catch(() => {});
    };
    if (photoStream.current) wire(preview.current, photoStream.current);
    if (session.current && source !== 'microphone') wire(preview.current, session.current.stream);
    if (pair.current) {
      wire(preview.current, pair.current.screen.stream);
      wire(preview2.current, pair.current.camera.stream);
    }
  });

  // Countdown, then the take begins.
  useEffect(() => {
    if (phase !== 'countdown') return;
    startNowBtn.current?.focus();
    if (countdown <= 0) {
      session.current?.begin();
      pair.current?.begin();
      startClock();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Recorded-time readout (paused spans excluded).
  useEffect(() => {
    if (!clock) return;
    const read = () => setElapsed(recordedSeconds(clock, Date.now()));
    read();
    if (phase !== 'recording') return;
    const t = setInterval(read, 250);
    return () => clearInterval(t);
  }, [clock, phase]);

  useEffect(() => {
    if (phase === 'recording') pauseBtn.current?.focus();
  }, [phase]);

  // Audio level meter for sources with a microphone (wired once per take).
  const capturing = phase === 'recording' || phase === 'countdown' || phase === 'paused';
  useEffect(() => {
    if (!capturing) return;
    const stream = source === 'screenCamera' ? pair.current?.camera.stream : session.current?.stream;
    if (!stream) return;
    const meter = levelMeter(stream);
    if (!meter) return;
    let raf = 0;
    const loop = () => {
      if (meterBar.current) meterBar.current.style.setProperty('--level', String(meter.read()));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      meter.close();
    };
  }, [capturing, source]);

  const stop = async () => {
    if (phase === 'countdown') {
      // The browser's "Stop sharing" during the countdown: nothing was recorded.
      releaseAll();
      setError(friendlyCaptureError({ name: 'EmptyRecording' }, source));
      setPhase('error');
      return;
    }
    if (phase !== 'recording' && phase !== 'paused') return;
    setPhase('processing');
    try {
      const names = existingNames();
      if (pair.current) {
        const p = pair.current;
        const screenName = captureName('Screen recording', names, extensionFor(p.screen.mimeType));
        const camName = captureName('Webcam recording', names, extensionFor(p.camera.mimeType));
        const files = await p.stop(screenName, camName);
        pair.current = null;
        const items = await toPending([
          { blob: files.screen, name: screenName, role: 'main' },
          { blob: files.camera, name: camName, role: 'camera' },
        ]);
        if (!alive.current) return;
        setPending(items);
      } else if (session.current) {
        const s = session.current;
        const name = captureName(CAPTURE_PREFIX[source], names, extensionFor(s.mimeType));
        const file = await s.stop(name);
        session.current = null;
        const items = await toPending([{ blob: file, name, role: 'main' }]);
        if (!alive.current) return;
        setPending(items);
      }
      setPhase('review');
    } catch (err) {
      fail(err);
    }
  };
  stopRef.current = () => void stop();

  const togglePause = () => {
    const target = pair.current ?? session.current;
    if (!target || !clock) return;
    if (phase === 'recording') {
      target.pause();
      setClock(pausedClock(clock, Date.now()));
      setPhase('paused');
    } else if (phase === 'paused') {
      target.resume();
      setClock(resumedClock(clock, Date.now()));
      setPhase('recording');
    }
  };

  const takePhoto = async () => {
    const v = preview.current;
    if (!v) return;
    try {
      await waitForFrames(v, 1);
      const blob = await frameToPng(v);
      releaseStreams(photoStream.current);
      photoStream.current = null;
      setPhase('processing');
      const name = captureName(CAPTURE_PREFIX.photo, existingNames(), 'png');
      const items = await toPending([{ blob, name, role: 'main' }]);
      if (!alive.current) return;
      setPending(items);
      setPhase('review');
    } catch (err) {
      fail(err);
    }
  };

  const retake = () => {
    releaseAll();
    for (const u of urls.current) URL.revokeObjectURL(u);
    urls.current = [];
    setPending([]);
    setClock(null);
    setElapsed(0);
    setAttempt((a) => a + 1);
  };

  const close = () => {
    if (phase === 'edit') return setPhase('review');
    if ((phase === 'recording' || phase === 'paused') && elapsed > 2 && !window.confirm('Stop and throw away this recording?')) return;
    releaseAll();
    closeCapture();
  };

  // ---------- finishing ----------
  const store = (): Asset[] => pending.map((p) => addCapturedAsset(p.asset, p.edit)).filter((a): a is Asset => !!a);

  const saveToLibrary = () => {
    const stored = store();
    toast(stored.length > 1 ? 'Both recordings are in your media library.' : `“${stored[0]?.name}” is in your media library.`);
    closeCapture();
  };
  const insert = () => {
    const stored = store();
    if (!stored.length) return;
    if (replaceElementId && assetKind(stored[0].mime) === 'image') replaceElementImage(replaceElementId, stored[0]);
    else if (stored.length === 2) insertPictureInPicture(stored[0], stored[1]);
    else insertMedia(stored[0]);
    toast(stored.length === 2 ? 'Placed both recordings: click either one to play them together.' : 'Added to your page.');
    closeCapture();
  };
  const insertMainOnly = () => {
    const stored = store();
    if (stored[0]) insertMedia(stored[0]);
    toast('Placed the screen recording. The webcam recording is in your media library.');
    closeCapture();
  };

  // ---------- rendering ----------
  const title = TITLES[source];
  const recordingish = phase === 'countdown' || phase === 'recording' || phase === 'paused';
  const hasAudioMeter = source === 'microphone' || source === 'webcam' || source === 'screenCamera';

  let body;
  if (phase === 'edit' && pending[editing]) {
    const p = pending[editing];
    body = (
      <MediaEditBody
        asset={p.asset}
        src={p.url}
        edit={draftEdit}
        onChange={setDraftEdit}
        intro="Make a quick adjustment before adding it. The original stays in your project, so you can change this later."
        footer={
          <>
            <button className="ed-btn ed-btn-ghost" onClick={() => setPhase('review')}>
              Back
            </button>
            <button
              className="ed-btn ed-btn-primary"
              data-testid="edit-done"
              onClick={() => {
                setPending((list) => list.map((x, i) => (i === editing ? { ...x, edit: draftEdit } : x)));
                setPhase('review');
              }}
            >
              Done
            </button>
          </>
        }
      />
    );
  } else {
    body = (
      <>
        <div className="ed-cap-head">
          <span className="ed-cap-head-art">
            <CaptureIllustration id={source} />
          </span>
          <div>
            <h2>{title}</h2>
            <p className="ed-cap-status" aria-live="polite" data-testid="capture-status">
              {phase === 'acquire' && WAITING[source]}
              {phase === 'live' && 'Smile! Take the photo when you’re ready.'}
              {phase === 'countdown' && `Starting in ${countdown}…`}
              {phase === 'recording' && (
                <>
                  <span className="ed-rec-dot" aria-hidden="true" /> Recording — <b data-testid="record-elapsed">{formatTime(elapsed)}</b>
                </>
              )}
              {phase === 'paused' && (
                <>
                  Paused — <b data-testid="record-elapsed">{formatTime(elapsed)}</b>
                </>
              )}
              {phase === 'processing' && 'Getting it ready…'}
              {phase === 'review' && (pending.length > 1 ? 'Here are your two recordings.' : 'Here it is. Make a quick adjustment, or add it right away.')}
              {phase === 'error' && 'That didn’t work.'}
            </p>
          </div>
        </div>
        {notice && (phase === 'countdown' || phase === 'recording' || phase === 'paused' || phase === 'review') && (
          <div className="ed-media-tip">
            <Icon name="info" size={16} />
            <span>{notice}</span>
          </div>
        )}

        {phase === 'acquire' && (
          <div className="ed-cap-wait">
            <span className="ed-cap-spinner" aria-hidden="true" />
            <span>Waiting for your browser…</span>
          </div>
        )}

        {(phase === 'live' || (recordingish && source !== 'microphone')) && (
          <div className={`ed-cap-stage ${source === 'screenCamera' ? 'has-pip' : ''}`}>
            <video
              ref={preview}
              className={`ed-cap-preview ${source === 'photo' || source === 'webcam' ? 'is-mirrored' : ''}`}
              muted
              playsInline
              autoPlay
              data-testid="capture-preview"
            />
            {source === 'screenCamera' && (
              <video ref={preview2} className="ed-cap-pip is-mirrored" muted playsInline autoPlay data-testid="capture-preview-camera" />
            )}
            {phase === 'countdown' && (
              <span className="ed-cap-count" aria-hidden="true">
                {countdown}
              </span>
            )}
            {(phase === 'recording' || phase === 'paused') && (
              <span className={`ed-cap-rec ${phase === 'paused' ? 'is-paused' : ''}`}>
                <span className="ed-rec-dot" aria-hidden="true" /> {phase === 'paused' ? 'PAUSED' : 'REC'} {formatTime(elapsed)}
              </span>
            )}
          </div>
        )}

        {recordingish && source === 'microphone' && (
          <div className={`ed-cap-mic ${phase === 'recording' ? 'is-live' : ''}`}>
            <span className="ed-cap-mic-icon">
              <Icon name="mic" size={34} stroke={2.2} />
            </span>
            {phase === 'countdown' ? (
              <span className="ed-cap-count is-inline">{countdown}</span>
            ) : (
              <span className="ed-cap-mic-time">{formatTime(elapsed)}</span>
            )}
          </div>
        )}

        {recordingish && hasAudioMeter && (
          <div className="ed-cap-meter" aria-label="Microphone level" role="img">
            <Icon name="mic" size={14} />
            <span className="ed-cap-meter-bar" ref={meterBar} />
          </div>
        )}

        {phase === 'processing' && (
          <div className="ed-cap-wait">
            <span className="ed-cap-spinner" aria-hidden="true" />
            <span>Getting it ready…</span>
          </div>
        )}

        {phase === 'review' && (
          <div className={`ed-cap-review ${pending.length > 1 ? 'is-pair' : ''}`}>
            {pending.map((p, i) => (
              <ReviewItem
                key={p.asset.id}
                item={p}
                label={pending.length > 1 ? (p.role === 'camera' ? 'Webcam' : 'Screen') : undefined}
                onEdit={() => {
                  setEditing(i);
                  setDraftEdit(p.edit);
                  setPhase('edit');
                }}
              />
            ))}
          </div>
        )}

        {phase === 'error' && (
          <div className="ed-cap-error" role="alert" data-testid="capture-error">
            <Icon name="warning" size={22} />
            <span>{error}</span>
          </div>
        )}

        <div className="ed-modal-actions ed-cap-actions">
          {phase === 'live' && (
            <>
              <button className="ed-btn ed-btn-ghost" onClick={close}>
                Cancel
              </button>
              <button className="ed-btn ed-btn-primary ed-btn-lg" onClick={() => void takePhoto()} data-testid="take-photo" autoFocus>
                <Icon name="camera" size={18} /> Take photo
              </button>
            </>
          )}
          {phase === 'countdown' && (
            <>
              <button className="ed-btn ed-btn-ghost" onClick={close} data-testid="record-cancel">
                Cancel
              </button>
              <button className="ed-btn ed-btn-soft" ref={startNowBtn} onClick={() => setCountdown(0)} data-testid="record-start-now">
                Start now
              </button>
            </>
          )}
          {(phase === 'recording' || phase === 'paused') && (
            <>
              <button className="ed-btn ed-btn-ghost" onClick={close} data-testid="record-cancel">
                Cancel
              </button>
              {(pair.current ?? session.current)?.canPause && (
                <button className="ed-btn ed-btn-soft" ref={pauseBtn} onClick={togglePause} data-testid="record-pause">
                  <Icon name={phase === 'paused' ? 'record' : 'pause'} size={16} /> {phase === 'paused' ? 'Resume' : 'Pause'}
                </button>
              )}
              <button className="ed-btn ed-btn-primary ed-btn-stop" onClick={() => void stop()} data-testid="record-stop">
                <Icon name="stop" size={16} fill="currentColor" /> Stop recording
              </button>
            </>
          )}
          {phase === 'review' && (
            <>
              <button className="ed-btn ed-btn-ghost" onClick={retake} data-testid="capture-retake">
                <Icon name="restart" size={16} /> {isRecording ? 'Record again' : 'Retake'}
              </button>
              <span className="ed-grow" />
              <button className="ed-btn ed-btn-soft" onClick={saveToLibrary} data-testid="capture-save">
                {pending.length > 1 ? 'Save both to library' : 'Save to library'}
              </button>
              {pending.length > 1 && (
                <button className="ed-btn ed-btn-soft" onClick={insertMainOnly} data-testid="capture-insert-screen">
                  Insert screen only
                </button>
              )}
              <button className="ed-btn ed-btn-primary" onClick={insert} data-testid="capture-insert">
                <Icon name="plus" size={16} /> {replaceElementId ? 'Use in image' : pending.length > 1 ? 'Insert both' : 'Insert on page'}
              </button>
            </>
          )}
          {phase === 'error' && (
            <>
              <button className="ed-btn ed-btn-ghost" onClick={close}>
                Close
              </button>
              <button className="ed-btn ed-btn-primary" onClick={retake} data-testid="capture-retry">
                <Icon name="restart" size={16} /> Try again
              </button>
            </>
          )}
          {(phase === 'acquire' || phase === 'processing') && (
            <button className="ed-btn ed-btn-ghost" onClick={close}>
              Cancel
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <Modal label={phase === 'edit' ? 'Edit capture' : title} onClose={close} wide className={`ed-cap-modal ${phase === 'edit' ? 'ed-medit-modal' : ''}`}>
      {body}
    </Modal>
  );
}

function ReviewItem({ item, label, onEdit }: { item: Pending; label?: string; onEdit(): void }) {
  const kind = assetKind(item.asset.mime);
  const a = item.asset;
  const size = kind === 'image' ? editedSize(a.width, a.height, item.edit) : null;
  const facts = [
    kind !== 'audio' && a.width ? `${Math.round(size?.width ?? a.width)} × ${Math.round(size?.height ?? a.height)}` : '',
    a.duration ? formatTime(item.edit.trim ? item.edit.trim.end - item.edit.trim.start : a.duration) : '',
    formatBytes(a.bytes),
  ].filter(Boolean);
  const verb = kind === 'image' ? 'Crop & rotate' : kind === 'video' ? 'Trim & crop' : 'Trim';
  const described = describeEdit(item.edit, formatTime);
  return (
    <figure className={`ed-cap-item is-${kind}`} data-testid="capture-review-item">
      {label && <span className="ed-cap-item-label">{label}</span>}
      <div className="ed-cap-item-media">
        {kind === 'image' && <PicturePreview src={item.url} asset={a} edit={item.edit} />}
        {kind === 'video' && <video src={item.url} controls playsInline preload="metadata" data-testid="capture-result-video" />}
        {kind === 'audio' && (
          <div className="ed-cap-audio">
            <Icon name="audio" size={28} />
            <audio src={item.url} controls preload="metadata" data-testid="capture-result-audio" />
          </div>
        )}
      </div>
      <figcaption>
        <span className="ed-cap-item-name">
          <strong>{a.name}</strong>
          <small>{facts.join(' · ')}</small>
          {described && <em className="ed-cap-edited">{described}</em>}
        </span>
        <button className="ed-btn ed-btn-sm ed-btn-soft" onClick={onEdit} data-testid="capture-edit">
          <Icon name={kind === 'image' ? 'crop' : 'scissors'} size={14} /> {verb}
        </button>
      </figcaption>
    </figure>
  );
}

/** A picture with its (pending) edit applied, like the runtime's edited images. */
export function PicturePreview({ src, asset, edit }: { src: string; asset: Asset; edit: MediaEdit }) {
  if (isIdentity(edit) || !asset.width || !asset.height) return <img src={src} alt={asset.name} data-testid="capture-result-image" />;
  const o = orientedSize(asset.width, asset.height, edit.rotate);
  const c = edit.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  return (
    <svg
      viewBox={`${c.x * o.width} ${c.y * o.height} ${c.w * o.width} ${c.h * o.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={asset.name}
      data-testid="capture-result-image"
    >
      <image
        href={src}
        width={asset.width}
        height={asset.height}
        preserveAspectRatio="none"
        transform={`matrix(${orientationMatrix(asset.width, asset.height, edit).join(' ')})`}
      />
    </svg>
  );
}
