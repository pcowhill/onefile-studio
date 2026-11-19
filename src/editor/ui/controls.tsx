import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Paint } from '../../model/types';
import { paintToCss } from '../../model/paint';
import { FONT_PRESETS } from '../../runtime/fonts';
import { Icon } from './Icon';
import { useEditor } from '../store/store';
import { pickImages } from '../ops';
import { getTheme } from '../../model/theme';

export const PALETTE = [
  '#1d1b2c',
  '#4b4766',
  '#9a96b0',
  '#ffffff',
  '#6d4aff',
  '#b06bff',
  '#3d8bff',
  '#0abde3',
  '#00b894',
  '#2bb673',
  '#ffd23f',
  '#ff9f43',
  '#ff5d73',
  '#e84393',
  '#f3f0ff',
  '#fff4e6',
];
export const GRADIENTS: Array<[string, string]> = [
  ['#8b6cff', '#5b3df5'],
  ['#ff7eb3', '#6d4aff'],
  ['#ffb86c', '#ff6b6b'],
  ['#7ef0c1', '#14b8a6'],
  ['#9be7ff', '#3d8bff'],
  ['#ffe66d', '#ff9f43'],
  ['#fbc2eb', '#a6c1ee'],
  ['#1b1834', '#3a2a7a'],
];

export function Section({
  title,
  icon,
  children,
  aside,
  defaultOpen = true,
}: {
  title: string;
  icon?: string;
  children: ReactNode;
  aside?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`ed-section ${open ? 'is-open' : ''}`}>
      <header className="ed-section-head">
        <button className="ed-section-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          {icon && <Icon name={icon} size={16} />}
          <span>{title}</span>
          <Icon name="chevron" size={16} className="ed-chev" />
        </button>
        {aside}
      </header>
      {open && <div className="ed-section-body">{children}</div>}
    </section>
  );
}

export function Field({ label, children, inline, hint }: { label: string; children: ReactNode; inline?: boolean; hint?: string }) {
  return (
    <div className={`ed-field ${inline ? 'is-inline' : ''}`}>
      <div className="ed-field-label">{label}</div>
      <div className="ed-field-control">{children}</div>
      {hint && <div className="ed-field-hint">{hint}</div>}
    </div>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label?: string;
  icon?: string;
  title?: string;
  render?: ReactNode;
}
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  ariaLabel,
}: {
  value: T;
  options: SegOption<T>[];
  onChange(v: T): void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}) {
  return (
    <div className={`ed-seg ed-seg-${size}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'is-on' : ''}
          title={o.title ?? o.label}
          onClick={() => onChange(o.value)}
        >
          {o.render ?? (o.icon ? <Icon name={o.icon} size={17} /> : null)}
          {o.label && !o.render && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = '',
  format,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(v: number): void;
  unit?: string;
  format?(v: number): string;
  ariaLabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="ed-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${Math.max(0, Math.min(100, pct))}%` }}
      />
      <span className="ed-slider-val">{format ? format(value) : `${Math.round(value * 100) / 100}${unit}`}</span>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange(v: boolean): void; label: string; description?: string }) {
  const id = useId();
  return (
    <label className="ed-toggle" htmlFor={id}>
      <span className="ed-toggle-text">
        <span>{label}</span>
        {description && <small>{description}</small>}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ed-toggle-track" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}

/** Colours of the open project's theme (shown first in colour pickers). */
function useThemeSwatches(): string[] {
  const id = useEditor((s) => s.project?.settings.theme);
  const t = getTheme(id);
  const c = t.colors;
  return [...new Set([c.text, c.muted, c.accent, c.accent2, c.bg, c.surfaceAlt, ...t.chart.slice(2, 4)])].filter((x) => x.startsWith('#')).slice(0, 8);
}

export function ColorPicker({
  value,
  onChange,
  allowTransparent,
  palette = PALETTE,
}: {
  value: string;
  onChange(v: string): void;
  allowTransparent?: boolean;
  palette?: string[];
}) {
  const themeSwatches = useThemeSwatches();
  const isCustom = !palette.includes(value) && !themeSwatches.includes(value) && value !== 'transparent';
  return (
    <div className="ed-swatches">
      {palette === PALETTE && (
        <>
          {themeSwatches.map((c) => (
            <button
              key={`t${c}`}
              className={`ed-swatch is-theme ${value.toLowerCase() === c ? 'is-on' : ''}`}
              style={{ background: c }}
              title={`Theme colour ${c}`}
              aria-label={`Theme colour ${c}`}
              onClick={() => onChange(c)}
            />
          ))}
          <span className="ed-swatch-sep" aria-hidden="true" />
        </>
      )}
      {allowTransparent && (
        <button
          className={`ed-swatch ed-swatch-none ${value === 'transparent' ? 'is-on' : ''}`}
          title="None"
          aria-label="No colour"
          onClick={() => onChange('transparent')}
        />
      )}
      {palette.map((c) => (
        <button
          key={c}
          className={`ed-swatch ${value.toLowerCase() === c ? 'is-on' : ''}`}
          style={{ background: c }}
          title={c}
          aria-label={`Colour ${c}`}
          onClick={() => onChange(c)}
        />
      ))}
      <label className={`ed-swatch ed-swatch-custom ${isCustom ? 'is-on' : ''}`} title="Custom colour" style={isCustom ? { background: value } : undefined}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#6d4aff'} onChange={(e) => onChange(e.target.value)} aria-label="Custom colour" />
        {!isCustom && <Icon name="plus" size={14} stroke={3} />}
      </label>
    </div>
  );
}

export function PaintPicker({ value, onChange }: { value: Paint; onChange(p: Paint): void }) {
  const [mode, setMode] = useState<'solid' | 'linear'>(value.kind);
  return (
    <div className="ed-paint">
      <Segmented
        size="sm"
        value={mode}
        onChange={(m) => {
          setMode(m);
          if (m === 'linear' && value.kind === 'solid') onChange({ kind: 'linear', from: value.color, to: GRADIENTS[0][1], angle: 135 });
          if (m === 'solid' && value.kind === 'linear') onChange({ kind: 'solid', color: value.from });
        }}
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'linear', label: 'Gradient' },
        ]}
      />
      {mode === 'solid' ? (
        <ColorPicker value={value.kind === 'solid' ? value.color : value.from} onChange={(c) => onChange({ kind: 'solid', color: c })} />
      ) : (
        <>
          <div className="ed-swatches">
            {GRADIENTS.map(([a, b]) => {
              const on = value.kind === 'linear' && value.from === a && value.to === b;
              return (
                <button
                  key={a + b}
                  className={`ed-swatch ${on ? 'is-on' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                  aria-label={`Gradient ${a} to ${b}`}
                  onClick={() => onChange({ kind: 'linear', from: a, to: b, angle: value.kind === 'linear' ? value.angle : 135 })}
                />
              );
            })}
          </div>
          {value.kind === 'linear' && (
            <div className="ed-grad-custom">
              <label className="ed-mini-color" style={{ background: value.from }} title="Start colour">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(value.from) ? value.from : '#6d4aff'}
                  onChange={(e) => onChange({ ...value, from: e.target.value })}
                  aria-label="Gradient start colour"
                />
              </label>
              <label className="ed-mini-color" style={{ background: value.to }} title="End colour">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(value.to) ? value.to : '#6d4aff'}
                  onChange={(e) => onChange({ ...value, to: e.target.value })}
                  aria-label="Gradient end colour"
                />
              </label>
              <Slider value={value.angle} min={0} max={360} step={15} unit="°" onChange={(a) => onChange({ ...value, angle: a })} ariaLabel="Gradient angle" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function PaintSwatch({ paint }: { paint: Paint }) {
  return <span className="ed-paint-swatch" style={{ background: paintToCss(paint) }} />;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange(v: T): void;
  options: Array<{ value: T; label: string }>;
  ariaLabel?: string;
}) {
  return (
    <div className="ed-select">
      <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={ariaLabel}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron" size={14} />
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus,
  onEnter,
}: {
  value: string;
  onChange(v: string): void;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  onEnter?(): void;
}) {
  return (
    <input
      className="ed-input"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnter?.();
      }}
    />
  );
}

export function TextArea({ value, onChange, rows = 4, ariaLabel }: { value: string; onChange(v: string): void; rows?: number; ariaLabel?: string }) {
  return <textarea className="ed-input ed-textarea" rows={rows} value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value)} />;
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
  ariaLabel,
  width,
}: {
  value: number;
  onChange(v: number): void;
  step?: number;
  min?: number;
  max?: number;
  ariaLabel?: string;
  width?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(Math.round(value * 100) / 100)), [value]);
  const commit = (t: string) => {
    const n = Number(t);
    if (Number.isFinite(n)) onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n)));
    else setText(String(value));
  };
  return (
    <div className="ed-number" style={width ? { width } : undefined}>
      <button aria-label="Decrease" onClick={() => onChange(Math.max(min ?? -Infinity, value - step))}>
        <Icon name="minus" size={14} stroke={2.6} />
      </button>
      <input
        value={text}
        aria-label={ariaLabel}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
      />
      <button aria-label="Increase" onClick={() => onChange(Math.min(max ?? Infinity, value + step))}>
        <Icon name="plus" size={14} stroke={2.6} />
      </button>
    </div>
  );
}

export function FontPicker({ value, onChange }: { value: string; onChange(v: string): void }) {
  return (
    <div className="ed-fonts">
      {FONT_PRESETS.map((f) => (
        <button key={f.id} className={`ed-font ${value === f.id ? 'is-on' : ''}`} onClick={() => onChange(f.id)} title={f.label}>
          <span style={{ fontFamily: f.stack }}>Aa</span>
          <small>{f.label}</small>
        </button>
      ))}
    </div>
  );
}

/** Small popover anchored below its trigger. */
export function Popover({
  trigger,
  children,
  align = 'left',
  width = 280,
}: {
  trigger(open: boolean, toggle: () => void): ReactNode;
  children(close: () => void): ReactNode;
  align?: 'left' | 'right';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="ed-pop-wrap" ref={ref}>
      {trigger(open, () => setOpen(!open))}
      {open && (
        <div className={`ed-pop ed-pop-${align}`} style={{ width }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Choose an image: upload a new one or pick from images already in the project. */
export function ImageChooser({ value, onChange, label = 'Image', compact }: { value: string; onChange(id: string): void; label?: string; compact?: boolean }) {
  const assets = useEditor((s) => s.project?.assets ?? {});
  const a = assets[value];
  return (
    <div className={`ed-imgchoose ${compact ? 'is-compact' : ''}`}>
      <div className="ed-imgchoose-thumb" style={a ? { backgroundImage: `url("${a.data}")` } : undefined}>
        {!a && <Icon name="image" size={22} />}
      </div>
      <div className="ed-imgchoose-side">
        <div className="ed-imgchoose-name">{a ? a.name : `No ${label.toLowerCase()} yet`}</div>
        <div className="ed-row">
          <button
            className="ed-btn ed-btn-sm ed-btn-soft"
            onClick={() =>
              void pickImages(false).then((list) => {
                if (list[0]) onChange(list[0].id);
              })
            }
          >
            <Icon name="upload" size={14} /> Upload
          </button>
          <AssetLibrary onPick={onChange} />
        </div>
      </div>
    </div>
  );
}

export function AssetLibrary({ onPick, label = 'Library' }: { onPick(id: string): void; label?: string }) {
  const assets = useEditor((s) => s.project?.assets ?? {});
  const list = Object.values(assets);
  return (
    <Popover
      width={268}
      align="right"
      trigger={(_, toggle) => (
        <button
          className="ed-btn ed-btn-sm ed-btn-ghost"
          onClick={toggle}
          disabled={!list.length}
          title={list.length ? 'Choose an image already in this project' : 'No images in this project yet'}
        >
          <Icon name="grid" size={14} /> {label}
        </button>
      )}
    >
      {(close) => (
        <div className="ed-lib">
          {list.map((a) => (
            <button
              key={a.id}
              className="ed-lib-item"
              title={a.name}
              style={{ backgroundImage: `url("${a.data}")` }}
              onClick={() => {
                onPick(a.id);
                close();
              }}
            />
          ))}
        </div>
      )}
    </Popover>
  );
}
