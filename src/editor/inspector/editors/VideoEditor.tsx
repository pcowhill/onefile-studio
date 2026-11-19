import type { VideoProps } from '../../../runtime/elements/video';
import type { Asset } from '../../../model/types';
import type { P } from '../shared';
import { SHADOW_OPTS } from '../shared';
import { ColorPicker, Field, ImageChooser, MediaChooser, Section, Segmented, Slider, TextInput, Toggle } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { updateElement, videoSize } from '../../ops';
import '../../../styles/media.css';

const stripExt = (name: string) => name.replace(/\.[a-z0-9]{1,5}$/i, '');

const FRAMES: Array<{ value: VideoProps['frame']; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'border', label: 'Border' },
  { value: 'browser', label: 'Browser' },
];

function FramePreview({ kind }: { kind: VideoProps['frame'] }) {
  return (
    <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">
      {kind === 'border' && <rect x="2" y="2" width="60" height="36" rx="7" fill="#e4e0f5" />}
      {kind === 'browser' && (
        <>
          <rect x="2" y="2" width="60" height="36" rx="6" fill="#e4e0f5" />
          <circle cx="8" cy="7.5" r="1.8" fill="#ff5f57" />
          <circle cx="13" cy="7.5" r="1.8" fill="#febc2e" />
          <circle cx="18" cy="7.5" r="1.8" fill="#28c840" />
          <rect x="24" y="5.3" width="26" height="4.4" rx="2.2" fill="#fff" opacity=".8" />
        </>
      )}
      <rect
        x={kind === 'border' ? 6 : 2}
        y={kind === 'border' ? 6 : kind === 'browser' ? 13 : 2}
        width={kind === 'border' ? 52 : 60}
        height={kind === 'border' ? 28 : kind === 'browser' ? 25 : 36}
        rx={kind === 'browser' ? 0 : 5}
        fill="#2a2640"
      />
      <circle cx="32" cy={kind === 'browser' ? 25.5 : 20} r="6" fill="#6d4aff" />
      <path d={kind === 'browser' ? 'M30.3 22.6v5.8l5-2.9z' : 'M30.3 17.1v5.8l5-2.9z'} fill="#fff" />
    </svg>
  );
}

/** Inspector for the Video element. */
export function VideoEditor({ el, set, project }: P<VideoProps>) {
  const p = el.props;
  const asset = project.assets[p.assetId];
  const hasVideo = !!asset && asset.mime.startsWith('video/');

  const choose = (a: Asset) =>
    updateElement(el.id, (d) => {
      const props = d.props as unknown as VideoProps;
      props.assetId = a.id;
      if (!props.alt) props.alt = stripExt(a.name);
      // Fit the box to the video's own shape (keeping the width), so there are no black bars.
      if (a.width > 0 && a.height > 0) d.h = videoSize(a, d.w, props.frame).h;
    });
  const setFrame = (frame: VideoProps['frame']) =>
    updateElement(el.id, (d) => {
      const props = d.props as unknown as VideoProps;
      props.frame = frame;
      if (hasVideo && asset.width > 0 && asset.height > 0) d.h = videoSize(asset, d.w, frame).h;
    });

  return (
    <>
      <Section title="Video" icon="video">
        <MediaChooser kind="video" value={p.assetId} onChange={choose} />
        {hasVideo && (
          <>
            <Field label="Frame">
              <div className="ed-media-opts" role="radiogroup" aria-label="Frame">
                {FRAMES.map((f) => (
                  <button
                    key={f.value}
                    role="radio"
                    aria-checked={p.frame === f.value}
                    className={`ed-media-opt ${p.frame === f.value ? 'is-on' : ''}`}
                    onClick={() => setFrame(f.value)}
                  >
                    <FramePreview kind={f.value} />
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Fit">
              <Segmented
                value={p.fit}
                onChange={(v) => set({ fit: v })}
                ariaLabel="Fit"
                options={[
                  { value: 'contain', label: 'Show whole' },
                  { value: 'cover', label: 'Fill frame' },
                ]}
              />
            </Field>
            <Field
              label={p.frame === 'browser' ? 'Window title' : 'Description (for screen readers)'}
              hint={p.frame === 'browser' ? 'Shown in the browser bar and read out by screen readers.' : undefined}
            >
              <TextInput value={p.alt} onChange={(v) => set({ alt: v.slice(0, 200) }, 'alt')} placeholder="What does the video show?" />
            </Field>
          </>
        )}
      </Section>
      {hasVideo && (
        <Section title="Playback" icon="play">
          <div className="ed-toggles">
            <Toggle
              label="Show controls"
              description="Viewers get play, seek, volume and full-screen buttons."
              checked={p.controls}
              onChange={(v) => set({ controls: v })}
            />
            <Toggle label="Start automatically" description="Plays as soon as it appears." checked={p.autoplay} onChange={(v) => set({ autoplay: v })} />
            <Toggle label="Loop" description="Starts again from the beginning when it ends." checked={p.loop} onChange={(v) => set({ loop: v })} />
            <Toggle label="Muted" description="Plays without sound." checked={p.muted} onChange={(v) => set({ muted: v })} />
          </div>
          {p.autoplay && !p.muted ? (
            <div className="ed-media-tip" data-testid="autoplay-tip">
              <Icon name="info" size={16} />
              <span>
                Browsers don't let videos with sound start by themselves, so viewers will see a play button instead. Turn on <b>Muted</b> if it should really
                start on its own.
                <button className="ed-btn ed-btn-sm ed-btn-soft" onClick={() => set({ muted: true })}>
                  Mute it
                </button>
              </span>
            </div>
          ) : (
            !p.controls && (
              <p className="ed-note">Without controls, viewers click the video to play or pause it. You can also add Play/Pause buttons in the Behavior tab.</p>
            )
          )}
        </Section>
      )}
      {hasVideo && (
        <Section title="Cover image" icon="image" defaultOpen={false}>
          <p className="ed-note">Shown before the video starts. Without one, viewers see the first frame.</p>
          <ImageChooser value={p.posterId} onChange={(id) => set({ posterId: id })} label="Cover image" onClear={() => set({ posterId: '' })} compact />
        </Section>
      )}
      <Section title="Appearance" icon="palette" defaultOpen={false}>
        <Field label="Rounded corners">
          <Slider value={p.radius} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(v) => set({ radius: v }, 'radius')} unit="px" />
        </Field>
        <Field label="Shadow">
          <Segmented value={p.shadow} onChange={(v) => set({ shadow: v })} options={SHADOW_OPTS} size="sm" />
        </Field>
        <Field label="Play button">
          <ColorPicker value={p.accent} onChange={(c) => set({ accent: c })} />
        </Field>
        <Field label="Background" hint="Fills any space around the picture.">
          <ColorPicker value={p.background} onChange={(c) => set({ background: c })} />
        </Field>
        {p.frame !== 'none' && (
          <Field label={p.frame === 'browser' ? 'Window colour' : 'Border colour'}>
            <ColorPicker value={p.borderColor} onChange={(c) => set({ borderColor: c })} />
          </Field>
        )}
      </Section>
    </>
  );
}
