import type { Asset } from '../../../model/types';
import type { ModelProps } from '../../../runtime/elements/model';
import type { P } from '../shared';
import { SHADOW_OPTS } from '../shared';
import { ColorPicker, Field, MediaChooser, Section, Segmented, Slider, TextInput, Toggle } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { updateElement } from '../../ops';
import '../../../styles/media.css';

const stripExt = (name: string) => name.replace(/\.[a-z0-9]{1,5}$/i, '');

const VIEWS = [
  { id: 'three', label: '¾ view', yaw: 30, pitch: 15 },
  { id: 'front', label: 'Front', yaw: 0, pitch: 6 },
  { id: 'side', label: 'Side', yaw: 90, pitch: 6 },
  { id: 'top', label: 'Top', yaw: 0, pitch: 80 },
];

const LIGHTS: Array<{ value: ModelProps['lighting']; label: string; hint: string }> = [
  { value: 'studio', label: 'Studio', hint: 'Bright and even' },
  { value: 'soft', label: 'Soft', hint: 'Gentle, no harsh shadows' },
  { value: 'dramatic', label: 'Dramatic', hint: 'Strong key light and a coloured rim' },
];

function LightArt({ kind }: { kind: ModelProps['lighting'] }) {
  return (
    <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">
      <rect width="64" height="40" rx="7" fill={kind === 'dramatic' ? '#221d38' : kind === 'soft' ? '#f4f1ff' : '#eef1f7'} />
      {kind === 'studio' && <path d="M8 4l14 14M56 4L42 18" stroke="#ffd23f" strokeWidth="3" strokeLinecap="round" />}
      {kind === 'soft' && <circle cx="32" cy="2" r="18" fill="#fff" opacity=".9" />}
      {kind === 'dramatic' && <path d="M6 4l16 16" stroke="#ffd23f" strokeWidth="3" strokeLinecap="round" />}
      <circle cx="32" cy="24" r="10" fill={kind === 'dramatic' ? '#6d6a80' : '#8b6cff'} />
      {kind === 'dramatic' && <path d="M39 17a10 10 0 0 1 0 14" stroke="#ff7eb3" strokeWidth="3" fill="none" strokeLinecap="round" />}
      {kind !== 'dramatic' && <circle cx="28.5" cy="20.5" r="3.5" fill="#fff" opacity=".55" />}
      <ellipse cx="32" cy="35.5" rx="11" ry="2" fill="#2a2340" opacity={kind === 'soft' ? 0.12 : 0.25} />
    </svg>
  );
}

/** Inspector for the 3D model viewer: file, starting view, look and what viewers may do. */
export function ModelEditor({ el, set }: P<ModelProps>) {
  const p = el.props;
  const choose = (a: Asset) =>
    updateElement(el.id, (d) => {
      const props = d.props as unknown as ModelProps;
      props.assetId = a.id;
      if (!props.alt) props.alt = stripExt(a.name);
    });
  const hasModel = !!p.assetId;
  return (
    <>
      <Section title="3D model" icon="cube">
        <MediaChooser kind="model" value={p.assetId} onChange={choose} />
        {!hasModel && (
          <p className="ed-note">
            Use a binary glTF (<b>.glb</b>) file with its textures embedded — most 3D tools (Blender, SketchUp, online libraries) can export one.
          </p>
        )}
      </Section>
      {hasModel && (
        <Section title="Starting view" icon="orbit">
          <div className="ed-model-views" role="group" aria-label="Quick views">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                className={`ed-btn ed-btn-sm ${Math.round(p.yaw) === v.yaw && Math.round(p.pitch) === v.pitch ? 'ed-btn-primary' : 'ed-btn-soft'}`}
                onClick={() => set({ yaw: v.yaw, pitch: v.pitch })}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Field label="Turn">
            <Slider value={Math.round(((((p.yaw + 180) % 360) + 360) % 360) - 180)} min={-180} max={180} unit="°" onChange={(v) => set({ yaw: v }, 'yaw')} />
          </Field>
          <Field label="Tilt">
            <Slider value={Math.round(p.pitch)} min={-20} max={80} unit="°" onChange={(v) => set({ pitch: v }, 'pitch')} />
          </Field>
          <Field label="Zoom">
            <Slider value={Math.round(p.zoom * 100)} min={50} max={200} step={5} unit="%" onChange={(v) => set({ zoom: v / 100 }, 'zoom')} />
          </Field>
          <p className="ed-note">Viewers start here; “Reset view” and the “Turn 3D view” action come back to it.</p>
        </Section>
      )}
      <Section title="Look" icon="palette">
        <Field label="Lighting">
          <div className="ed-media-opts" role="radiogroup" aria-label="Lighting">
            {LIGHTS.map((l) => (
              <button
                key={l.value}
                role="radio"
                aria-checked={p.lighting === l.value}
                className={`ed-media-opt ${p.lighting === l.value ? 'is-on' : ''}`}
                onClick={() => set({ lighting: l.value })}
                title={l.hint}
                data-testid={`lighting-${l.value}`}
              >
                <LightArt kind={l.value} />
                <span>{l.label}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Background">
          <Segmented
            value={p.backdrop}
            onChange={(v) => set({ backdrop: v })}
            options={[
              { value: 'gradient', label: 'Glow' },
              { value: 'solid', label: 'Solid' },
              { value: 'none', label: 'None' },
            ]}
          />
        </Field>
        {p.backdrop !== 'none' && <ColorPicker value={p.background} onChange={(c) => set({ background: c })} />}
        <Field label="Accent">
          <ColorPicker value={p.accent} onChange={(c) => set({ accent: c })} />
        </Field>
        <Toggle label="Soft shadow under the model" checked={p.groundShadow} onChange={(v) => set({ groundShadow: v })} />
        <Field label="Rounded corners">
          <Slider value={p.radius} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(v) => set({ radius: v }, 'radius')} unit="px" />
        </Field>
        <Field label="Shadow">
          <Segmented value={p.shadow} onChange={(v) => set({ shadow: v })} options={SHADOW_OPTS} size="sm" />
        </Field>
      </Section>
      <Section title="Viewers can…" icon="hand">
        <Toggle label="Turn it" description="Drag to orbit around the model" checked={p.allowRotate} onChange={(v) => set({ allowRotate: v })} />
        <Toggle label="Zoom" description="Scroll, pinch or the + / − buttons" checked={p.allowZoom} onChange={(v) => set({ allowZoom: v })} />
        <Toggle label="Move it" description="Right-drag or two fingers to pan" checked={p.allowPan} onChange={(v) => set({ allowPan: v })} />
        <Toggle label="Show view buttons" description="Reset view, zoom and full screen" checked={p.controls} onChange={(v) => set({ controls: v })} />
        <Toggle label="Spin by itself" description="Turns slowly until the viewer grabs it" checked={p.autoRotate} onChange={(v) => set({ autoRotate: v })} />
        {p.autoRotate && (
          <Field label="Spin speed">
            <Slider value={Math.round(p.rotateSpeed * 100)} min={20} max={300} step={10} unit="%" onChange={(v) => set({ rotateSpeed: v / 100 }, 'speed')} />
          </Field>
        )}
        <p className="ed-note">
          <Icon name="info" size={12} /> In the editor the model is a still picture so you can move and resize it. Press Preview to try it.
        </p>
      </Section>
      <Section title="Accessibility" icon="eye" defaultOpen={false}>
        <Field label="Description (for screen readers)">
          <TextInput value={p.alt} onChange={(v) => set({ alt: v }, 'alt')} placeholder="What does the model show?" />
        </Field>
      </Section>
    </>
  );
}
