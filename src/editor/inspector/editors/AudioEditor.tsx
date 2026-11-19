import type { AudioProps } from '../../../runtime/elements/audio';
import { AUDIO_STYLE_HEIGHT } from '../../../runtime/elements/audio';
import type { Asset } from '../../../model/types';
import type { P } from '../shared';
import { SHADOW_OPTS } from '../shared';
import { ColorPicker, Field, FontPicker, MediaChooser, Section, Segmented, Slider, TextInput, Toggle } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { updateElement } from '../../ops';
import '../../../styles/media.css';

const STYLES: Array<{ value: AudioProps['style']; label: string }> = [
  { value: 'player', label: 'Player' },
  { value: 'compact', label: 'Compact' },
  { value: 'native', label: 'Browser' },
];

function StylePreview({ kind }: { kind: AudioProps['style'] }) {
  if (kind === 'compact')
    return (
      <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">
        <rect x="2" y="12" width="60" height="16" rx="8" fill="#fff" stroke="#e4e0f5" />
        <circle cx="10" cy="20" r="5" fill="#6d4aff" />
        <path d="M8.8 17.6v4.8l3.8-2.4z" fill="#fff" />
        <rect x="19" y="18.5" width="12" height="3" rx="1.5" fill="#c9c3e3" />
        <rect x="34" y="19" width="22" height="2" rx="1" fill="#e4e0f5" />
        <rect x="34" y="19" width="9" height="2" rx="1" fill="#6d4aff" />
      </svg>
    );
  if (kind === 'native')
    return (
      <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">
        <rect x="2" y="11" width="60" height="18" rx="9" fill="#f1f3f4" />
        <path d="M8 16.5v7l5.5-3.5z" fill="#3c4043" />
        <rect x="17" y="18.5" width="9" height="3" rx="1.5" fill="#9aa0a6" />
        <rect x="29" y="19.2" width="20" height="1.6" rx=".8" fill="#9aa0a6" />
        <path d="M52 18h2l2.5-2v8L54 22h-2z" fill="#3c4043" />
      </svg>
    );
  return (
    <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">
      <rect x="2" y="5" width="60" height="30" rx="8" fill="#fff" stroke="#e4e0f5" />
      <circle cx="14" cy="20" r="7" fill="#6d4aff" />
      <path d="M12.3 16.7v6.6l5.2-3.3z" fill="#fff" />
      <rect x="25" y="13" width="18" height="3.4" rx="1.7" fill="#4b4766" />
      <rect x="47" y="13.2" width="10" height="3" rx="1.5" fill="#c9c3e3" />
      <rect x="25" y="23" width="32" height="2.4" rx="1.2" fill="#e4e0f5" />
      <rect x="25" y="23" width="13" height="2.4" rx="1.2" fill="#6d4aff" />
    </svg>
  );
}

/** Inspector for the Audio element. */
export function AudioEditor({ el, set, project }: P<AudioProps>) {
  const p = el.props;
  const asset = project.assets[p.assetId];
  const hasSound = !!asset && asset.mime.startsWith('audio/');
  const choose = (a: Asset) =>
    updateElement(el.id, (d) => {
      (d.props as unknown as AudioProps).assetId = a.id;
    });
  const setStyle = (style: AudioProps['style']) =>
    updateElement(el.id, (d) => {
      const props = d.props as unknown as AudioProps;
      // Keep the box comfortable for the chosen player (unless the author made it taller on purpose).
      if (d.h === AUDIO_STYLE_HEIGHT[props.style] || style === 'compact' || d.h < AUDIO_STYLE_HEIGHT[style]) d.h = AUDIO_STYLE_HEIGHT[style];
      props.style = style;
    });

  return (
    <>
      <Section title="Sound" icon="audio">
        <MediaChooser kind="audio" value={p.assetId} onChange={choose} />
        <Field label="Player style">
          <div className="ed-media-opts" role="radiogroup" aria-label="Player style">
            {STYLES.map((s) => (
              <button
                key={s.value}
                role="radio"
                aria-checked={p.style === s.value}
                className={`ed-media-opt ${p.style === s.value ? 'is-on' : ''}`}
                onClick={() => setStyle(s.value)}
              >
                <StylePreview kind={s.value} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </Field>
        {p.style !== 'native' && (
          <Field label="Title">
            <TextInput
              value={p.title}
              onChange={(v) => set({ title: v.slice(0, 120) }, 'title')}
              placeholder={hasSound ? asset.name.replace(/\.[a-z0-9]{1,5}$/i, '') : 'Shown in the player'}
              ariaLabel="Title"
            />
          </Field>
        )}
      </Section>
      {hasSound && (
        <Section title="Playback" icon="play">
          <Field label="Volume">
            <Slider value={p.volume} min={0} max={100} step={5} unit="%" onChange={(v) => set({ volume: v }, 'volume')} ariaLabel="Volume" />
          </Field>
          <div className="ed-toggles">
            <Toggle label="Start automatically" description="Plays as soon as it appears." checked={p.autoplay} onChange={(v) => set({ autoplay: v })} />
            <Toggle label="Loop" description="Starts again when it ends — good for background music." checked={p.loop} onChange={(v) => set({ loop: v })} />
          </div>
          {p.autoplay && (
            <div className="ed-media-tip" data-testid="autoplay-tip">
              <Icon name="info" size={16} />
              <span>
                Browsers usually block sound from starting by itself until the viewer clicks something. If that happens, the player waits with its play button
                highlighted. A “Play” button in the Behavior tab is a reliable alternative.
              </span>
            </div>
          )}
        </Section>
      )}
      <Section title="Appearance" icon="palette" defaultOpen={false}>
        {p.style !== 'native' && (
          <>
            <Field label="Font">
              <FontPicker value={p.font} onChange={(f) => set({ font: f })} />
            </Field>
            <Field label="Play button">
              <ColorPicker value={p.accent} onChange={(c) => set({ accent: c })} />
            </Field>
            <Field label="Text">
              <ColorPicker value={p.color} onChange={(c) => set({ color: c })} />
            </Field>
          </>
        )}
        <Field label="Background">
          <ColorPicker value={p.background} onChange={(c) => set({ background: c })} />
        </Field>
        <Field label="Border">
          <ColorPicker value={p.borderColor} onChange={(c) => set({ borderColor: c })} />
        </Field>
        <Field label="Rounded corners">
          <Slider value={p.radius} min={0} max={48} onChange={(v) => set({ radius: v }, 'radius')} unit="px" />
        </Field>
        <Field label="Shadow">
          <Segmented value={p.shadow} onChange={(v) => set({ shadow: v })} options={SHADOW_OPTS} size="sm" />
        </Field>
      </Section>
    </>
  );
}
