import { useState } from 'react';
import type { ChartProps } from '../../../runtime/elements/chart';
import type { P } from '../shared';
import { SHADOW_OPTS } from '../shared';
import { ColorPicker, Field, FontPicker, Section, Segmented, Slider, TextInput, Toggle } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { chartToGrid, gridToChart } from '../../../io/csv';
import { DataGrid } from './DataGrid';
import '../../../styles/data.css';

const FALLBACK = ['#6d4aff', '#ff7eb3', '#ffb100', '#00b894', '#3d8bff', '#ff6b6b'];

function TypeGlyph({ type }: { type: 'bar' | 'line' }) {
  return (
    <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">
      <line x1="6" y1="35" x2="58" y2="35" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" />
      {type === 'bar' ? (
        <>
          {[
            [10, 18],
            [23, 10],
            [36, 22],
            [49, 6],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="8" height={35 - y} rx="2.5" fill={i % 2 ? '#ff7eb3' : '#6d4aff'} />
          ))}
        </>
      ) : (
        <>
          <path d="M8 28 C 16 26, 18 16, 26 18 S 38 26, 44 14 S 52 8, 56 7" fill="none" stroke="#6d4aff" strokeWidth="3" strokeLinecap="round" />
          <path d="M8 32 L 22 26 L 36 29 L 56 20" fill="none" stroke="#ff7eb3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function PresetGlyph({ preset, type, colors, bg, grid }: { preset: ChartProps['preset']; type: 'bar' | 'line'; colors: string[]; bg: string; grid: string }) {
  const [a, b] = [colors[0] ?? FALLBACK[0], colors[1] ?? colors[0] ?? FALLBACK[1]];
  const r = preset === 'clean' ? 1 : preset === 'soft' ? 4 : 2;
  const sw = preset === 'clean' ? 1.6 : preset === 'soft' ? 2.4 : 3.6;
  const bars = [14, 22, 10, 26];
  return (
    <svg viewBox="0 0 72 44" width="72" height="44" aria-hidden="true" style={{ background: bg === 'transparent' ? '#fff' : bg }}>
      <line x1="6" y1="12" x2="66" y2="12" stroke={grid} strokeWidth="1" />
      <line x1="6" y1="24" x2="66" y2="24" stroke={grid} strokeWidth="1" />
      <line x1="6" y1="37" x2="66" y2="37" stroke={grid} strokeWidth={preset === 'bold' ? 2 : 1} />
      {type === 'bar' ? (
        bars.map((hgt, i) => {
          const w = preset === 'bold' ? 11 : preset === 'clean' ? 7 : 9;
          const x = 10 + i * 14 + (11 - w) / 2;
          const y = 37 - hgt;
          const rr = Math.min(r, w / 2);
          return <path key={i} d={`M${x} 37V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V37Z`} fill={i % 2 ? b : a} />;
        })
      ) : (
        <>
          {preset === 'soft' && <path d="M10 28 C 20 26, 24 16, 34 18 S 50 22, 62 9 L62 37 L10 37 Z" fill={a} fillOpacity=".16" />}
          <path
            d={preset === 'soft' ? 'M10 28 C 20 26, 24 16, 34 18 S 50 22, 62 9' : 'M10 28 L 26 18 L 42 21 L 62 9'}
            fill="none"
            stroke={a}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {preset !== 'soft' && [10, 26, 42, 62].map((x, i) => <circle key={i} cx={x} cy={[28, 18, 21, 9][i]} r={preset === 'bold' ? 3.4 : 2.2} fill={a} />)}
        </>
      )}
    </svg>
  );
}

/** Inspector for the Chart element. */
export function ChartEditor({ el, set }: P<ChartProps>) {
  const p = el.props;
  const [editing, setEditing] = useState(false);
  const series = Array.isArray(p.series) ? p.series : [];
  const labels = Array.isArray(p.labels) ? p.labels : [];
  const palette = Array.isArray(p.palette) && p.palette.length ? p.palette : FALLBACK;
  const colorOf = (i: number) => palette[i % palette.length];
  const setSeriesColor = (i: number, c: string) => {
    const next = Array.from({ length: Math.max(palette.length, i + 1) }, (_, k) => colorOf(k));
    next[i] = c;
    set({ palette: next }, `palette${i}`);
  };
  const type = p.chartType === 'line' ? 'line' : 'bar';
  return (
    <>
      <Section title="Chart" icon="chart">
        <Field label="Type">
          <div className="ed-data-types" role="radiogroup" aria-label="Chart type">
            {(['bar', 'line'] as const).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={type === t}
                className={`ed-data-type ${type === t ? 'is-on' : ''}`}
                onClick={() => set({ chartType: t })}
                data-testid={`chart-type-${t}`}
              >
                <TypeGlyph type={t} />
                {t === 'bar' ? 'Bar' : 'Line'}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Title">
          <TextInput value={p.title} onChange={(v) => set({ title: v.slice(0, 200) }, 'title')} placeholder="Optional" ariaLabel="Chart title" />
        </Field>
        <div className="ed-data-card">
          <span className="ed-data-card-icon">
            <Icon name="table" size={18} />
          </span>
          <div className="ed-data-card-text">
            <strong data-testid="chart-data-summary">
              {labels.length} {labels.length === 1 ? 'label' : 'labels'} · {series.length} series
            </strong>
            <small>{series.map((s) => s.name).join(', ') || 'No data yet'}</small>
          </div>
          <button className="ed-btn ed-btn-sm ed-btn-primary" onClick={() => setEditing(true)} data-testid="chart-edit-data">
            <Icon name="edit" size={14} /> Edit data
          </button>
        </div>
        <Field label="Style">
          <div className="ed-data-presets" role="radiogroup" aria-label="Chart style">
            {(['clean', 'soft', 'bold'] as const).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={p.preset === s}
                className={`ed-data-preset ${p.preset === s ? 'is-on' : ''}`}
                onClick={() => set({ preset: s })}
                data-testid={`chart-preset-${s}`}
              >
                <PresetGlyph preset={s} type={type} colors={palette} bg={p.background} grid={p.gridColor} />
                <small>{s[0].toUpperCase() + s.slice(1)}</small>
              </button>
            ))}
          </div>
        </Field>
        <div className="ed-toggles">
          <Toggle label="Legend" checked={p.showLegend} onChange={(v) => set({ showLegend: v })} />
          {p.showLegend && (
            <Toggle
              label="Viewers can hide series"
              description="Click a legend entry to show or hide it"
              checked={p.legendToggle}
              onChange={(v) => set({ legendToggle: v })}
            />
          )}
          <Toggle label="Value labels" checked={p.showValues} onChange={(v) => set({ showValues: v })} />
          <Toggle label="Gridlines" checked={p.showGrid} onChange={(v) => set({ showGrid: v })} />
        </div>
      </Section>
      <Section title="Axes & labels" icon="text" defaultOpen={false}>
        <div className="ed-grid2">
          <Field label="Bottom axis">
            <TextInput value={p.xLabel} onChange={(v) => set({ xLabel: v.slice(0, 80) }, 'xLabel')} placeholder="e.g. Month" ariaLabel="Bottom axis title" />
          </Field>
          <Field label="Side axis">
            <TextInput value={p.yLabel} onChange={(v) => set({ yLabel: v.slice(0, 80) }, 'yLabel')} placeholder="e.g. Visitors" ariaLabel="Side axis title" />
          </Field>
          <Field label="Before values">
            <TextInput value={p.valuePrefix} onChange={(v) => set({ valuePrefix: v.slice(0, 12) }, 'prefix')} placeholder="e.g. $" ariaLabel="Value prefix" />
          </Field>
          <Field label="After values">
            <TextInput value={p.valueSuffix} onChange={(v) => set({ valueSuffix: v.slice(0, 12) }, 'suffix')} placeholder="e.g. %" ariaLabel="Value suffix" />
          </Field>
        </div>
      </Section>
      <Section title="Colours" icon="palette" defaultOpen={false}>
        <Field label="Series colours">
          <div className="ed-data-series">
            {(series.length ? series : [{ name: 'Series 1', values: [] }]).map((s, i) => (
              <label key={i} className="ed-data-series-row">
                <span className="ed-mini-color" style={{ background: colorOf(i) }} title="Change colour">
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(colorOf(i)) ? colorOf(i) : '#6d4aff'}
                    onChange={(e) => setSeriesColor(i, e.target.value)}
                    aria-label={`Colour of ${s.name || `series ${i + 1}`}`}
                  />
                </span>
                <span>{s.name || `Series ${i + 1}`}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Background">
          <ColorPicker value={p.background} onChange={(c) => set({ background: c })} allowTransparent />
        </Field>
        <Field label="Title & values">
          <ColorPicker value={p.textColor} onChange={(c) => set({ textColor: c })} />
        </Field>
        <Field label="Axis & legend text">
          <ColorPicker value={p.mutedColor} onChange={(c) => set({ mutedColor: c })} />
        </Field>
        <Field label="Gridlines">
          <ColorPicker
            value={p.gridColor}
            onChange={(c) => set({ gridColor: c })}
            palette={['#e4e0f5', '#e2e8f0', '#22385a', '#e6dacb', '#d0d0d0', '#ffffff']}
          />
        </Field>
        <Field label="Font">
          <FontPicker value={p.font} onChange={(f) => set({ font: f })} />
        </Field>
        <Field label="Rounded corners">
          <Slider value={p.radius} min={0} max={48} unit="px" onChange={(v) => set({ radius: v }, 'radius')} />
        </Field>
        <Field label="Shadow">
          <Segmented value={p.shadow} onChange={(v) => set({ shadow: v })} options={SHADOW_OPTS} size="sm" />
        </Field>
      </Section>
      {editing && (
        <DataGrid
          mode="chart"
          title="Chart data"
          initial={chartToGrid(p)}
          seriesColors={palette}
          onClose={() => setEditing(false)}
          onDone={({ grid }) => {
            const { labels: l, series: s } = gridToChart(grid);
            set({ labels: l, series: s }, `data:${Date.now()}`);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}
