import type { Page, Project, SceneElement } from '../../model/types';
import { useEditor, editor } from '../store/store';
import { Icon } from '../ui/Icon';
import {
  ColorPicker,
  Field,
  FontPicker,
  ImageChooser,
  NumberInput,
  PaintPicker,
  Section,
  Segmented,
  Select,
  Slider,
  TextArea,
  TextInput,
  Toggle,
} from '../ui/controls';
import { align, moveLayer, updateElement, updatePage, updateProps, updateSelected } from '../ops';
import { EDITOR_ELEMENTS } from '../catalog';
import type { TextProps } from '../../runtime/elements/text';
import type { ImageProps } from '../../runtime/elements/image';
import type { ShapeProps } from '../../runtime/elements/shape';
import type { ArrowProps } from '../../runtime/elements/arrow';
import type { ButtonProps, NavButtonProps } from '../../runtime/elements/button';
import type { BeforeAfterProps } from '../../runtime/elements/beforeAfter';
import type { GalleryProps } from '../../runtime/elements/gallery';
import type { ScrollTextProps } from '../../runtime/elements/scrollText';
import type { ProgressProps } from '../../runtime/elements/progress';
import { AssetLibrary } from '../ui/controls';
import { pickImages } from '../ops';

type P<T> = { el: SceneElement<T>; set(patch: Partial<T>, merge?: string): void; project: Project };

const SHADOW_OPTS = [
  { value: 'none', label: 'None' },
  { value: 'soft', label: 'Soft' },
  { value: 'lifted', label: 'Lifted' },
];

export function DesignPanel({ els }: { els: SceneElement[] }) {
  const project = useEditor((s) => s.project)!;
  if (els.length > 1) return <MultiDesign els={els} />;
  const el = els[0];
  const set = (patch: Record<string, unknown>, merge?: string) => updateProps(el.id, patch, merge);
  const props = { el, set, project } as unknown as P<never>;
  const Editor = EDITORS[el.type];
  return (
    <div className="ed-inspector-body">
      {EDITOR_ELEMENTS[el.type]?.builtIn && (
        <div className="ed-builtin">
          <Icon name="sparkle" size={16} />
          <span>{EDITOR_ELEMENTS[el.type].builtIn}</span>
        </div>
      )}
      {Editor && <Editor {...props} />}
      <ArrangeSection els={[el]} />
    </div>
  );
}

function MultiDesign({ els }: { els: SceneElement[] }) {
  return (
    <div className="ed-inspector-body">
      <div className="ed-builtin">
        <Icon name="select" size={16} />
        <span>{els.length} elements selected. Drag any of them to move them together.</span>
      </div>
      <ArrangeSection els={els} />
    </div>
  );
}

function ArrangeSection({ els }: { els: SceneElement[] }) {
  const single = els.length === 1 ? els[0] : null;
  return (
    <Section title="Arrange" icon="layers">
      <Field label={single ? 'Align on page' : 'Align together'}>
        <div className="ed-align">
          {(
            [
              ['left', 'alignLeft'],
              ['centerH', 'alignCenterH'],
              ['right', 'alignRight'],
              ['top', 'alignTop'],
              ['middle', 'alignMiddle'],
              ['bottom', 'alignBottom'],
            ] as const
          ).map(([k, icon]) => (
            <button key={k} className="ed-icon-btn" onClick={() => align(k)} title={`Align ${k === 'centerH' ? 'centre' : k}`} aria-label={`Align ${k}`}>
              <Icon name={icon} size={18} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Layer">
        <div className="ed-row">
          <button className="ed-btn ed-btn-sm ed-btn-ghost" onClick={() => moveLayer('forward')}>
            <Icon name="front" size={15} /> Forward
          </button>
          <button className="ed-btn ed-btn-sm ed-btn-ghost" onClick={() => moveLayer('backward')}>
            <Icon name="back" size={15} /> Backward
          </button>
        </div>
      </Field>
      {single && (
        <>
          <Field label="Rotation">
            <Slider
              value={single.rotation}
              min={-180}
              max={180}
              unit="°"
              onChange={(v) => updateElement(single.id, (d) => void (d.rotation = v), 'rotation')}
              ariaLabel="Rotation"
            />
          </Field>
          <details className="ed-details">
            <summary>Exact size & position</summary>
            <div className="ed-grid2">
              {(['x', 'y', 'w', 'h'] as const).map((k) => (
                <label key={k} className="ed-mini-field">
                  <span>{{ x: 'X', y: 'Y', w: 'Width', h: 'Height' }[k]}</span>
                  <NumberInput
                    value={single[k]}
                    min={k === 'w' || k === 'h' ? 4 : undefined}
                    ariaLabel={k}
                    onChange={(v) => updateElement(single.id, (d) => void (d[k] = Math.round(v)), k)}
                  />
                </label>
              ))}
            </div>
          </details>
        </>
      )}
      <div className="ed-toggles">
        <Toggle label="Lock in place" checked={els.every((e) => e.locked)} onChange={(v) => updateSelected((e) => void (e.locked = v))} />
      </div>
    </Section>
  );
}

// ---------------- per-type editors ----------------

function TextEditor({ el, set }: P<TextProps>) {
  const p = el.props;
  const vars = useEditor((s) => s.project!.variables);
  return (
    <>
      <Section title="Text" icon="text">
        <TextArea value={p.text} onChange={(v) => set({ text: v }, 'text')} rows={3} ariaLabel="Text content" />
        {vars.length > 0 && (
          <div className="ed-chips">
            <span className="ed-chips-label">Insert variable:</span>
            {vars.map((v) => (
              <button key={v.id} className="ed-chip" onClick={() => set({ text: `${p.text}{${v.name}}` })}>
                {`{${v.name}}`}
              </button>
            ))}
          </div>
        )}
        <Field label="Font">
          <FontPicker value={p.font} onChange={(f) => set({ font: f })} />
        </Field>
        <div className="ed-grid2">
          <Field label="Size">
            <NumberInput value={p.size} min={6} max={400} step={2} onChange={(v) => set({ size: v }, 'size')} ariaLabel="Font size" />
          </Field>
          <Field label="Weight">
            <Select
              value={String(p.weight)}
              onChange={(v) => set({ weight: Number(v) })}
              ariaLabel="Font weight"
              options={[
                { value: '400', label: 'Regular' },
                { value: '500', label: 'Medium' },
                { value: '700', label: 'Bold' },
                { value: '800', label: 'Extra bold' },
                { value: '900', label: 'Black' },
              ]}
            />
          </Field>
        </div>
        <Field label="Alignment">
          <div className="ed-row">
            <Segmented
              value={p.align}
              onChange={(v) => set({ align: v })}
              ariaLabel="Horizontal alignment"
              options={[
                { value: 'left', icon: 'textLeft', title: 'Left' },
                { value: 'center', icon: 'textCenter', title: 'Centre' },
                { value: 'right', icon: 'textRight', title: 'Right' },
              ]}
            />
            <Segmented
              value={p.valign}
              onChange={(v) => set({ valign: v })}
              ariaLabel="Vertical alignment"
              options={[
                { value: 'top', icon: 'alignTop', title: 'Top' },
                { value: 'middle', icon: 'alignMiddle', title: 'Middle' },
                { value: 'bottom', icon: 'alignBottom', title: 'Bottom' },
              ]}
            />
          </div>
        </Field>
        <Field label="Colour">
          <ColorPicker value={p.color} onChange={(c) => set({ color: c })} />
        </Field>
      </Section>
      <Section title="Style" icon="palette" defaultOpen={false}>
        <Field label="Highlight background">
          <ColorPicker
            value={p.background}
            onChange={(c) =>
              set({ background: c, padding: c !== 'transparent' && !p.padding ? 12 : p.padding, radius: c !== 'transparent' && !p.radius ? 12 : p.radius })
            }
            allowTransparent
          />
        </Field>
        {p.background !== 'transparent' && (
          <>
            <Field label="Roundness">
              <Slider value={p.radius} min={0} max={60} onChange={(v) => set({ radius: v }, 'radius')} unit="px" />
            </Field>
            <Field label="Padding">
              <Slider value={p.padding} min={0} max={60} onChange={(v) => set({ padding: v }, 'padding')} unit="px" />
            </Field>
          </>
        )}
        <Field label="Line spacing">
          <Slider value={p.lineHeight} min={0.9} max={2.4} step={0.05} onChange={(v) => set({ lineHeight: v }, 'lh')} />
        </Field>
        <Field label="Letter spacing">
          <Slider value={p.letterSpacing} min={-0.05} max={0.3} step={0.01} onChange={(v) => set({ letterSpacing: v }, 'ls')} />
        </Field>
        <Toggle label="Italic" checked={p.italic} onChange={(v) => set({ italic: v })} />
      </Section>
    </>
  );
}

function ImageEditor({ el, set }: P<ImageProps>) {
  const p = el.props;
  return (
    <Section title="Image" icon="image">
      <ImageChooser value={p.assetId} onChange={(id) => set({ assetId: id })} />
      <Field label="Fit">
        <Segmented
          value={p.fit}
          onChange={(v) => set({ fit: v })}
          options={[
            { value: 'cover', label: 'Fill frame' },
            { value: 'contain', label: 'Show whole' },
          ]}
        />
      </Field>
      <Field label="Rounded corners">
        <Slider value={p.radius} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(v) => set({ radius: v }, 'radius')} unit="px" />
      </Field>
      <Field label="Shadow">
        <Segmented value={p.shadow} onChange={(v) => set({ shadow: v })} options={SHADOW_OPTS} size="sm" />
      </Field>
      <Field label="Border">
        <div className="ed-row">
          <Slider value={p.borderWidth} min={0} max={20} onChange={(v) => set({ borderWidth: v }, 'bw')} unit="px" />
        </div>
      </Field>
      {p.borderWidth > 0 && <ColorPicker value={p.borderColor} onChange={(c) => set({ borderColor: c })} />}
      <Field label="Description (for screen readers)">
        <TextInput value={p.alt} onChange={(v) => set({ alt: v }, 'alt')} placeholder="What does the image show?" />
      </Field>
    </Section>
  );
}

function ShapeEditor({ el, set }: P<ShapeProps>) {
  const p = el.props;
  return (
    <Section title="Shape" icon="shape">
      <Field label="Shape">
        <div className="ed-shape-grid">
          {(['rect', 'ellipse', 'triangle', 'diamond', 'star', 'heart', 'hexagon', 'blob'] as const).map((k) => (
            <button key={k} className={`ed-shape-opt ${p.shape === k ? 'is-on' : ''}`} onClick={() => set({ shape: k })} title={k} aria-label={k}>
              <ShapeGlyph kind={k} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Fill">
        <PaintPicker value={p.fill} onChange={(f) => set({ fill: f }, 'fill')} />
      </Field>
      {p.shape === 'rect' && (
        <Field label="Rounded corners">
          <Slider value={p.radius} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(v) => set({ radius: v }, 'radius')} unit="px" />
        </Field>
      )}
      <Field label="Outline">
        <Slider value={p.strokeWidth} min={0} max={24} onChange={(v) => set({ strokeWidth: v }, 'sw')} unit="px" />
      </Field>
      {p.strokeWidth > 0 && <ColorPicker value={p.stroke} onChange={(c) => set({ stroke: c })} />}
      <Field label="Shadow">
        <Segmented value={p.shadow} onChange={(v) => set({ shadow: v })} options={SHADOW_OPTS} size="sm" />
      </Field>
      <Field label="Opacity">
        <Slider value={Math.round(p.opacity * 100)} min={5} max={100} unit="%" onChange={(v) => set({ opacity: v / 100 }, 'op')} />
      </Field>
    </Section>
  );
}

import { SHAPE_PATHS } from '../../runtime/elements/shape';
function ShapeGlyph({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 100 100" width="26" height="26">
      {kind === 'rect' ? (
        <rect x="8" y="16" width="84" height="68" rx="14" />
      ) : kind === 'ellipse' ? (
        <circle cx="50" cy="50" r="42" />
      ) : (
        <path d={SHAPE_PATHS[kind]} />
      )}
    </svg>
  );
}

function ArrowEditor({ el, set }: P<ArrowProps>) {
  const p = el.props;
  return (
    <Section title="Arrow" icon="arrow">
      <p className="ed-note">Drag the round handles on the canvas to point the arrow anywhere.</p>
      <Field label="Colour">
        <ColorPicker value={p.color} onChange={(c) => set({ color: c })} />
      </Field>
      <Field label="Thickness">
        <Slider value={p.width} min={1} max={30} onChange={(v) => set({ width: v }, 'width')} unit="px" />
      </Field>
      <Field label="Curve">
        <Slider
          value={p.bend}
          min={-1}
          max={1}
          step={0.05}
          onChange={(v) => set({ bend: v }, 'bend')}
          format={(v) => (v === 0 ? 'Straight' : v < 0 ? 'Left' : 'Right')}
        />
      </Field>
      <div className="ed-grid2">
        <Field label="Tip">
          <Select
            value={p.head}
            onChange={(v) => set({ head: v })}
            options={[
              { value: 'triangle', label: 'Solid' },
              { value: 'line', label: 'Open' },
              { value: 'none', label: 'None' },
            ]}
          />
        </Field>
        <Field label="Tail">
          <Select
            value={p.tail}
            onChange={(v) => set({ tail: v })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'dot', label: 'Dot' },
              { value: 'triangle', label: 'Arrow' },
            ]}
          />
        </Field>
      </div>
      <Toggle label="Dashed line" checked={p.dashed} onChange={(v) => set({ dashed: v })} />
      <button
        className="ed-btn ed-btn-sm ed-btn-ghost"
        onClick={() =>
          updateElement(el.id, (d) => {
            const a = d.props as unknown as ArrowProps;
            [a.start, a.end] = [a.end, a.start];
          })
        }
      >
        <Icon name="rotate" size={15} /> Flip direction
      </button>
    </Section>
  );
}

const ICONS = [
  { value: 'none', label: 'No icon' },
  { value: 'arrow-right', label: 'Arrow →' },
  { value: 'arrow-left', label: 'Arrow ←' },
  { value: 'chevron-down', label: 'Chevron ↓' },
  { value: 'play', label: 'Play' },
  { value: 'star', label: 'Star' },
  { value: 'heart', label: 'Heart' },
  { value: 'refresh', label: 'Restart' },
  { value: 'plus', label: 'Plus' },
  { value: 'check', label: 'Check' },
  { value: 'home', label: 'Home' },
];

function ButtonLook({ el, set }: P<ButtonProps>) {
  const p = el.props;
  return (
    <>
      <Field label="Label">
        <TextInput value={p.label} onChange={(v) => set({ label: v }, 'label')} ariaLabel="Button label" />
      </Field>
      <Field label="Style">
        <div className="ed-btn-variants">
          {(['solid', 'soft', 'outline', 'ghost'] as const).map((v) => (
            <button key={v} className={`ed-variant ${p.variant === v ? 'is-on' : ''}`} onClick={() => set({ variant: v })}>
              <span className={`ed-variant-demo is-${v}`} style={{ ['--c' as string]: p.color }}>
                Aa
              </span>
              <small>{v[0].toUpperCase() + v.slice(1)}</small>
            </button>
          ))}
        </div>
      </Field>
      <Field label="Colour">
        <ColorPicker value={p.color} onChange={(c) => set({ color: c })} />
      </Field>
      <div className="ed-grid2">
        <Field label="Shape">
          <Select
            value={p.radius}
            onChange={(v) => set({ radius: v })}
            options={[
              { value: 'pill', label: 'Pill' },
              { value: 'rounded', label: 'Rounded' },
              { value: 'square', label: 'Square' },
            ]}
          />
        </Field>
        <Field label="Text size">
          <NumberInput value={p.size} min={10} max={60} onChange={(v) => set({ size: v }, 'size')} />
        </Field>
      </div>
      <div className="ed-grid2">
        <Field label="Icon">
          <Select value={p.icon} onChange={(v) => set({ icon: v })} options={ICONS} />
        </Field>
        {p.icon !== 'none' && (
          <Field label="Icon side">
            <Segmented
              size="sm"
              value={p.iconSide}
              onChange={(v) => set({ iconSide: v })}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
              ]}
            />
          </Field>
        )}
      </div>
      <Field label="Font">
        <FontPicker value={p.font} onChange={(f) => set({ font: f })} />
      </Field>
      <Toggle label="Shadow" checked={p.shadow} onChange={(v) => set({ shadow: v })} />
    </>
  );
}

function ButtonEditor(props: P<ButtonProps>) {
  return (
    <Section title="Button" icon="button">
      <ButtonLook {...props} />
      <button
        className="ed-btn ed-btn-soft ed-btn-block"
        onClick={() => editor().set({ inspectorTab: 'behavior', triggerPickerFor: props.el.interactions.length ? null : props.el.id })}
      >
        <Icon name="bolt" size={16} /> {props.el.interactions.length ? 'Edit what it does' : 'Make it do something'}
      </button>
    </Section>
  );
}

export function pageTargetOptions(project: Project) {
  const noun = project.kind === 'slides' ? 'slide' : 'section';
  return [
    { value: 'next', label: `Next ${noun}` },
    { value: 'prev', label: `Previous ${noun}` },
    { value: 'first', label: `First ${noun}` },
    { value: 'last', label: `Last ${noun}` },
    ...project.pages.map((p, i) => ({ value: p.id, label: `${i + 1}. ${p.name}` })),
  ];
}

function NavButtonEditor(props: P<NavButtonProps>) {
  const { el, set, project } = props;
  return (
    <>
      <Section title="Goes to" icon="next">
        <Select value={el.props.target} onChange={(v) => set({ target: v })} options={pageTargetOptions(project)} ariaLabel="Navigation target" />
      </Section>
      <Section title="Look" icon="button">
        <ButtonLook {...(props as unknown as P<ButtonProps>)} />
      </Section>
    </>
  );
}

function BeforeAfterEditor({ el, set }: P<BeforeAfterProps>) {
  const p = el.props;
  return (
    <>
      <Section title="Images" icon="compare">
        <Field label="Before">
          <ImageChooser value={p.before} onChange={(id) => set({ before: id })} compact />
        </Field>
        <Field label="After">
          <ImageChooser value={p.after} onChange={(id) => set({ after: id })} compact />
        </Field>
        <button className="ed-btn ed-btn-sm ed-btn-ghost" onClick={() => set({ before: p.after, after: p.before })}>
          <Icon name="rotate" size={15} /> Swap images
        </button>
      </Section>
      <Section title="Appearance" icon="palette">
        <Field label="Divider direction">
          <Segmented
            value={p.orientation}
            onChange={(v) => set({ orientation: v })}
            options={[
              { value: 'horizontal', label: 'Side by side' },
              { value: 'vertical', label: 'Top & bottom' },
            ]}
          />
        </Field>
        <Field label="Handle">
          <Segmented
            value={p.handle}
            onChange={(v) => set({ handle: v })}
            options={[
              { value: 'circle', label: 'Circle' },
              { value: 'pill', label: 'Pill' },
              { value: 'line', label: 'Minimal' },
            ]}
          />
        </Field>
        <Field label="Starting position">
          <Slider value={p.position} min={0} max={100} unit="%" onChange={(v) => set({ position: v }, 'pos')} />
        </Field>
        <Field label="Divider colour">
          <ColorPicker value={p.accent} onChange={(c) => set({ accent: c })} />
        </Field>
        <Toggle label="Show labels" checked={p.showLabels} onChange={(v) => set({ showLabels: v })} />
        {p.showLabels && (
          <div className="ed-grid2">
            <TextInput value={p.beforeLabel} onChange={(v) => set({ beforeLabel: v }, 'bl')} ariaLabel="Before label" />
            <TextInput value={p.afterLabel} onChange={(v) => set({ afterLabel: v }, 'al')} ariaLabel="After label" />
          </div>
        )}
        <Field label="Rounded corners">
          <Slider value={p.radius} min={0} max={60} unit="px" onChange={(v) => set({ radius: v }, 'radius')} />
        </Field>
        <Field label="Shadow">
          <Segmented value={p.shadow} onChange={(v) => set({ shadow: v })} options={SHADOW_OPTS} size="sm" />
        </Field>
      </Section>
    </>
  );
}

function GalleryEditor({ el, set }: P<GalleryProps>) {
  const p = el.props;
  const assets = useEditor((s) => s.project!.assets);
  const move = (i: number, d: number) => {
    const a = [...p.images];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set({ images: a });
  };
  return (
    <>
      <Section title={`Images (${p.images.length})`} icon="gallery">
        <div className="ed-gal-list">
          {p.images.map((id, i) => (
            <div key={id + i} className="ed-gal-item">
              <span className="ed-gal-thumb" style={{ backgroundImage: assets[id] ? `url("${assets[id].data}")` : undefined }} />
              <span className="ed-gal-name">{assets[id]?.name ?? 'Missing image'}</span>
              <button className="ed-icon-btn is-xs" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                <Icon name="up" size={14} />
              </button>
              <button className="ed-icon-btn is-xs" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === p.images.length - 1}>
                <Icon name="down" size={14} />
              </button>
              <button className="ed-icon-btn is-xs is-danger" aria-label="Remove image" onClick={() => set({ images: p.images.filter((_, k) => k !== i) })}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="ed-row">
          <button
            className="ed-btn ed-btn-sm ed-btn-soft"
            onClick={() => void pickImages(true).then((list) => list.length && set({ images: [...p.images, ...list.map((a) => a.id)] }))}
          >
            <Icon name="upload" size={14} /> Add images
          </button>
          <AssetLibrary label="From project" onPick={(id) => set({ images: [...p.images, id] })} />
        </div>
      </Section>
      <Section title="Behaviour & look" icon="palette">
        <Toggle label="Next image on click" checked={p.advanceOnClick} onChange={(v) => set({ advanceOnClick: v })} />
        <Toggle label="Loop back to the start" checked={p.loop} onChange={(v) => set({ loop: v })} />
        <Field label="Transition">
          <Segmented
            size="sm"
            value={p.transition}
            onChange={(v) => set({ transition: v })}
            options={[
              { value: 'fade', label: 'Fade' },
              { value: 'slide', label: 'Slide' },
              { value: 'zoom', label: 'Zoom' },
              { value: 'none', label: 'None' },
            ]}
          />
        </Field>
        <Field label="Controls">
          <Segmented
            size="sm"
            value={p.controls}
            onChange={(v) => set({ controls: v })}
            options={[
              { value: 'dots', label: 'Dots' },
              { value: 'arrows', label: 'Arrows' },
              { value: 'both', label: 'Both' },
              { value: 'none', label: 'None' },
            ]}
          />
        </Field>
        <Field label="Auto-advance">
          <Slider value={p.autoplay} min={0} max={10} step={0.5} onChange={(v) => set({ autoplay: v }, 'auto')} format={(v) => (v ? `every ${v}s` : 'Off')} />
        </Field>
        <Field label="Fit">
          <Segmented
            size="sm"
            value={p.fit}
            onChange={(v) => set({ fit: v })}
            options={[
              { value: 'cover', label: 'Fill frame' },
              { value: 'contain', label: 'Show whole' },
            ]}
          />
        </Field>
        <Field label="Rounded corners">
          <Slider value={p.radius} min={0} max={60} unit="px" onChange={(v) => set({ radius: v }, 'radius')} />
        </Field>
        <Field label="Shadow">
          <Segmented value={p.shadow} onChange={(v) => set({ shadow: v })} options={SHADOW_OPTS} size="sm" />
        </Field>
      </Section>
    </>
  );
}

function ScrollTextEditor({ el, set }: P<ScrollTextProps>) {
  const p = el.props;
  return (
    <>
      <Section title="Content" icon="scroll">
        <Field label="Title">
          <TextInput value={p.title} onChange={(v) => set({ title: v }, 'title')} placeholder="Optional" />
        </Field>
        <Field label="Text" hint='Blank line = new paragraph · "- " = bullet · "# " = heading · **bold**'>
          <TextArea value={p.text} onChange={(v) => set({ text: v }, 'text')} rows={8} ariaLabel="Scrolling text content" />
        </Field>
      </Section>
      <Section title="Style" icon="palette">
        <Field label="Font">
          <FontPicker value={p.font} onChange={(f) => set({ font: f })} />
        </Field>
        <div className="ed-grid2">
          <Field label="Text size">
            <NumberInput value={p.size} min={10} max={48} onChange={(v) => set({ size: v }, 'size')} />
          </Field>
          <Field label="Padding">
            <NumberInput value={p.padding} min={0} max={80} step={4} onChange={(v) => set({ padding: v }, 'pad')} />
          </Field>
        </div>
        <Field label="Panel colour">
          <ColorPicker value={p.background} onChange={(c) => set({ background: c })} allowTransparent />
        </Field>
        <Field label="Text colour">
          <ColorPicker value={p.color} onChange={(c) => set({ color: c })} />
        </Field>
        <Field label="Accent (headings & scrollbar)">
          <ColorPicker value={p.accent} onChange={(c) => set({ accent: c })} />
        </Field>
        <Field label="Rounded corners">
          <Slider value={p.radius} min={0} max={48} unit="px" onChange={(v) => set({ radius: v }, 'radius')} />
        </Field>
        <Toggle label="Fade at the edges" description="Hints that there is more to read" checked={p.fadeEdges} onChange={(v) => set({ fadeEdges: v })} />
        <Field label="Shadow">
          <Segmented value={p.shadow} onChange={(v) => set({ shadow: v })} options={SHADOW_OPTS} size="sm" />
        </Field>
      </Section>
    </>
  );
}

function ProgressEditor({ el, set, project }: P<ProgressProps>) {
  const p = el.props;
  const sources = [
    ...(project.kind === 'slides' ? [{ value: 'slides', label: 'Slide position' }] : [{ value: 'scroll', label: 'Reading progress' }]),
    { value: 'variable', label: 'A variable' },
  ] as Array<{ value: ProgressProps['source']; label: string }>;
  return (
    <Section title="Progress" icon="progress">
      <Field label="Shows">
        <Segmented
          value={p.source}
          onChange={(v) => set({ source: v, variableId: v === 'variable' && !p.variableId ? (project.variables[0]?.id ?? '') : p.variableId })}
          options={sources}
        />
      </Field>
      {p.source === 'variable' && (
        <>
          {project.variables.length ? (
            <div className="ed-grid2">
              <Field label="Variable">
                <Select
                  value={p.variableId}
                  onChange={(v) => set({ variableId: v })}
                  options={[{ value: '', label: 'Choose…' }, ...project.variables.map((v) => ({ value: v.id, label: v.name }))]}
                />
              </Field>
              <Field label="Full at">
                <NumberInput value={p.max} min={1} onChange={(v) => set({ max: v }, 'max')} />
              </Field>
            </div>
          ) : (
            <p className="ed-note">
              Create a variable in the{' '}
              <button className="ed-link" onClick={() => editor().set({ leftTab: 'variables' })}>
                Variables
              </button>{' '}
              panel first.
            </p>
          )}
        </>
      )}
      <Field label="Style">
        <Segmented
          value={p.style}
          onChange={(v) => {
            set({ style: v });
            if (v === 'ring') updateElement(el.id, (d) => void (d.w = d.h = Math.max(80, Math.min(d.w, 160))));
            else updateElement(el.id, (d) => void ((d.h = 16), (d.w = Math.max(d.w, 300))));
          }}
          options={[
            { value: 'bar', label: 'Bar' },
            { value: 'ring', label: 'Ring' },
          ]}
        />
      </Field>
      <Field label="Fill">
        <PaintPicker value={p.fill} onChange={(f) => set({ fill: f }, 'fill')} />
      </Field>
      <Field label="Track">
        <ColorPicker
          value={p.track}
          onChange={(c) => set({ track: c })}
          palette={['rgba(109, 74, 255, 0.14)', '#eeeaf9', '#ffffff', '#1d1b2c', 'rgba(255, 255, 255, 0.25)']}
        />
      </Field>
      <Field label="Label">
        <Select
          value={p.label}
          onChange={(v) => set({ label: v })}
          options={[
            { value: 'none', label: 'No label' },
            { value: 'percent', label: 'Percentage' },
            { value: 'value', label: 'Value' },
            { value: 'fraction', label: p.source === 'variable' ? 'Value / maximum' : 'Slide x / y' },
          ]}
        />
      </Field>
      {p.label !== 'none' && (
        <Field label="Label colour">
          <ColorPicker value={p.labelColor} onChange={(c) => set({ labelColor: c })} />
        </Field>
      )}
    </Section>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EDITORS: Record<string, (p: P<any>) => React.ReactNode> = {
  text: TextEditor,
  image: ImageEditor,
  shape: ShapeEditor,
  arrow: ArrowEditor,
  button: ButtonEditor,
  navButton: NavButtonEditor,
  beforeAfter: BeforeAfterEditor,
  gallery: GalleryEditor,
  scrollText: ScrollTextEditor,
  progress: ProgressEditor,
};

// ---------------- page / project settings ----------------

const BG_PRESETS: Array<Page['background']['paint']> = [
  { kind: 'solid', color: '#ffffff' },
  { kind: 'solid', color: '#fbfaff' },
  { kind: 'solid', color: '#fff8ef' },
  { kind: 'solid', color: '#eefaf5' },
  { kind: 'solid', color: '#1b1834' },
  { kind: 'linear', from: '#6d4aff', to: '#b06bff', angle: 135 },
  { kind: 'linear', from: '#6d4aff', to: '#ff7eb3', angle: 135 },
  { kind: 'linear', from: '#ffd23f', to: '#ff9f43', angle: 135 },
  { kind: 'linear', from: '#7ef0c1', to: '#0abde3', angle: 135 },
  { kind: 'linear', from: '#1b1834', to: '#3a2a7a', angle: 160 },
];

import { paintToCss } from '../../model/paint';

export function PageSettings() {
  const project = useEditor((s) => s.project)!;
  const pageId = useEditor((s) => s.pageId);
  const page = project.pages.find((p) => p.id === pageId)!;
  const slides = project.kind === 'slides';
  const noun = slides ? 'Slide' : 'Section';
  const bg = page.background;
  return (
    <div className="ed-inspector-body">
      <Section title={noun} icon={slides ? 'slides' : 'page'}>
        <Field label="Name">
          <TextInput value={page.name} onChange={(v) => updatePage(page.id, (d) => void (d.name = v.slice(0, 80)), 'name')} ariaLabel={`${noun} name`} />
        </Field>
        <Field label="Background">
          <div className="ed-bg-presets">
            {BG_PRESETS.map((p, i) => (
              <button
                key={i}
                className={`ed-bg-preset ${JSON.stringify(p) === JSON.stringify(bg.paint) ? 'is-on' : ''}`}
                style={{ background: paintToCss(p) }}
                aria-label={`Background preset ${i + 1}`}
                onClick={() => updatePage(page.id, (d) => void (d.background.paint = p))}
              />
            ))}
          </div>
        </Field>
        <details className="ed-details">
          <summary>Custom colour</summary>
          <PaintPicker value={bg.paint} onChange={(p) => updatePage(page.id, (d) => void (d.background.paint = p), 'bg')} />
        </details>
        <Field label="Background image">
          <ImageChooser value={bg.imageId ?? ''} onChange={(id) => updatePage(page.id, (d) => void (d.background.imageId = id))} compact />
        </Field>
        {bg.imageId && (
          <>
            <Field label="Darken image">
              <Slider
                value={Math.round((bg.imageDim ?? 0) * 100)}
                min={0}
                max={80}
                unit="%"
                onChange={(v) => updatePage(page.id, (d) => void (d.background.imageDim = v / 100), 'dim')}
              />
            </Field>
            <button className="ed-btn ed-btn-sm ed-btn-ghost" onClick={() => updatePage(page.id, (d) => void delete d.background.imageId)}>
              <Icon name="close" size={14} /> Remove image
            </button>
          </>
        )}
        {!slides && (
          <Field label="Height">
            <Slider
              value={page.height ?? 560}
              min={120}
              max={2400}
              step={10}
              unit="px"
              onChange={(v) => updatePage(page.id, (d) => void (d.height = v), 'height')}
            />
          </Field>
        )}
      </Section>
      <ProjectSettings />
    </div>
  );
}

function ProjectSettings() {
  const project = useEditor((s) => s.project)!;
  const slides = project.kind === 'slides';
  const upd = (fn: (p: Project) => void, merge?: string) => editor().update(fn, merge ? { merge } : undefined);
  return (
    <Section title="Whole project" icon="settings" defaultOpen={false}>
      {slides && (
        <>
          <Field label="Slide transition">
            <Segmented
              value={project.settings.transition}
              onChange={(v) => upd((d) => void (d.settings.transition = v))}
              options={[
                { value: 'fade', label: 'Fade' },
                { value: 'slide', label: 'Slide' },
                { value: 'none', label: 'None' },
              ]}
            />
          </Field>
          <Toggle
            label="Show slide controls"
            description="Previous / next buttons and slide number"
            checked={project.settings.showNavigation}
            onChange={(v) => upd((d) => void (d.settings.showNavigation = v))}
          />
        </>
      )}
      <Field label={slides ? 'Colour around slides' : 'Page edge colour'}>
        <ColorPicker
          value={project.settings.backdrop}
          onChange={(c) => upd((d) => void (d.settings.backdrop = c))}
          palette={['#1b1834', '#000000', '#2b2840', '#ffffff', '#f3f0ff', '#fff8ef']}
        />
      </Field>
    </Section>
  );
}
