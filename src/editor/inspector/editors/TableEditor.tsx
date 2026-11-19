import { useState } from 'react';
import type { ColumnAlign, TableProps } from '../../../runtime/elements/table';
import type { P } from '../shared';
import { SHADOW_OPTS } from '../shared';
import { ColorPicker, Field, FontPicker, NumberInput, Section, Segmented, Slider, Toggle } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { gridToTable } from '../../../io/csv';
import { DataGrid } from './DataGrid';
import '../../../styles/data.css';

function PresetGlyph({
  preset,
  head,
  headText,
  border,
  stripe,
}: {
  preset: TableProps['preset'];
  head: string;
  headText: string;
  border: string;
  stripe: string;
}) {
  const rows = [14, 22, 30];
  return (
    <svg viewBox="0 0 72 40" width="72" height="40" aria-hidden="true" style={{ background: '#fff' }}>
      <rect x="0" y="0" width="72" height="10" fill={head} />
      {[14, 34, 54].map((x) => (
        <rect key={x} x={x - 8} y="4" width="12" height="2.4" rx="1.2" fill={headText} opacity=".9" />
      ))}
      {rows.map((y, i) => (
        <g key={y}>
          {i % 2 === 1 && <rect x="0" y={y - 4} width="72" height="8" fill={stripe} />}
          {[14, 34, 54].map((x) => (
            <rect key={x} x={x - 8} y={y - 1.2} width={i === 1 && x === 34 ? 8 : 12} height="2.4" rx="1.2" fill="#a9a4c4" />
          ))}
          {preset === 'lined' && i < 2 && <line x1="0" x2="72" y1={y + 4} y2={y + 4} stroke={border} strokeWidth="1" />}
          {preset === 'boxed' && <line x1="0" x2="72" y1={y + 4} y2={y + 4} stroke={border} strokeWidth="1" />}
        </g>
      ))}
      {preset === 'boxed' && [24, 44].map((x) => <line key={x} x1={x} x2={x} y1="0" y2="40" stroke={border} strokeWidth="1" />)}
      {preset === 'boxed' && <rect x=".5" y=".5" width="71" height="39" fill="none" stroke={border} />}
    </svg>
  );
}

/** Inspector for the Table element. */
export function TableEditor({ el, set }: P<TableProps>) {
  const p = el.props;
  const [editing, setEditing] = useState(false);
  const rows = Array.isArray(p.rows) ? p.rows : [];
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const bodyRows = p.headerRow ? Math.max(0, rows.length - 1) : rows.length;
  const aligns = Array.from({ length: cols }, (_, i) => p.columnAlign?.[i] ?? 'auto');
  const stripe = p.striped ? p.stripe : '#fff';
  return (
    <>
      <Section title="Table" icon="table">
        <div className="ed-data-card">
          <span className="ed-data-card-icon">
            <Icon name="table" size={18} />
          </span>
          <div className="ed-data-card-text">
            <strong data-testid="table-data-summary">
              {bodyRows} {bodyRows === 1 ? 'row' : 'rows'} · {cols} {cols === 1 ? 'column' : 'columns'}
            </strong>
            <small>{p.headerRow ? (rows[0] ?? []).filter(Boolean).join(', ') || 'Header row' : 'No header row'}</small>
          </div>
          <button className="ed-btn ed-btn-sm ed-btn-primary" onClick={() => setEditing(true)} data-testid="table-edit-cells">
            <Icon name="edit" size={14} /> Edit cells
          </button>
        </div>
        <Field label="Style">
          <div className="ed-data-presets" role="radiogroup" aria-label="Table style">
            {(['lined', 'boxed', 'minimal'] as const).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={p.preset === s}
                className={`ed-data-preset ${p.preset === s ? 'is-on' : ''}`}
                onClick={() => set({ preset: s })}
                data-testid={`table-preset-${s}`}
              >
                <PresetGlyph
                  preset={s}
                  head={p.headerRow ? p.headerBg : '#fff'}
                  headText={p.headerRow ? p.headerText : '#a9a4c4'}
                  border={p.borderColor}
                  stripe={stripe}
                />
                <small>{s[0].toUpperCase() + s.slice(1)}</small>
              </button>
            ))}
          </div>
        </Field>
        <div className="ed-toggles">
          <Toggle label="Header row" description="The first row labels the columns" checked={p.headerRow} onChange={(v) => set({ headerRow: v })} />
          <Toggle label="Striped rows" checked={p.striped} onChange={(v) => set({ striped: v })} />
          <Toggle label="Highlight row on hover" checked={p.hoverHighlight} onChange={(v) => set({ hoverHighlight: v })} />
          {p.headerRow && (
            <Toggle label="Viewers can sort" description="Click a column header to sort" checked={p.sortable} onChange={(v) => set({ sortable: v })} />
          )}
        </div>
        <Field label="Text size">
          <NumberInput value={p.size} min={8} max={72} onChange={(v) => set({ size: v }, 'size')} ariaLabel="Text size" />
        </Field>
      </Section>
      <Section title="Columns" icon="alignLeft" defaultOpen={false}>
        <p className="ed-note">“Auto” puts numbers on the right so they line up.</p>
        <div className="ed-data-cols">
          {aligns.map((a, c) => (
            <div key={c} className="ed-data-col-row">
              <span>{(p.headerRow && rows[0]?.[c]) || `Column ${c + 1}`}</span>
              <Segmented<ColumnAlign>
                size="sm"
                value={a}
                ariaLabel={`Alignment of column ${c + 1}`}
                onChange={(v) => {
                  const next = [...aligns];
                  next[c] = v;
                  set({ columnAlign: next }, 'align');
                }}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'left', icon: 'textLeft', title: 'Left' },
                  { value: 'center', icon: 'textCenter', title: 'Centre' },
                  { value: 'right', icon: 'textRight', title: 'Right' },
                ]}
              />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Colours" icon="palette" defaultOpen={false}>
        <Field label="Header">
          <ColorPicker value={p.headerBg} onChange={(c) => set({ headerBg: c })} />
        </Field>
        <Field label="Header text">
          <ColorPicker value={p.headerText} onChange={(c) => set({ headerText: c })} />
        </Field>
        <Field label="Background">
          <ColorPicker value={p.background} onChange={(c) => set({ background: c })} allowTransparent />
        </Field>
        <Field label="Text">
          <ColorPicker value={p.textColor} onChange={(c) => set({ textColor: c })} />
        </Field>
        <Field label="Stripes">
          <ColorPicker value={p.stripe} onChange={(c) => set({ stripe: c })} />
        </Field>
        <Field label="Lines">
          <ColorPicker value={p.borderColor} onChange={(c) => set({ borderColor: c })} />
        </Field>
        <Field label="Accent (hover & scrollbar)">
          <ColorPicker value={p.accent} onChange={(c) => set({ accent: c })} />
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
          mode="table"
          title="Table cells"
          initial={rows}
          headerRow={p.headerRow}
          columnAlign={p.columnAlign}
          onClose={() => setEditing(false)}
          onDone={({ grid, headerRow, columnAlign }) => {
            const next = gridToTable(grid);
            const width = next[0]?.length ?? 1;
            set({ rows: next, headerRow, columnAlign: Array.from({ length: width }, (_, i) => columnAlign[i] ?? 'auto') }, `cells:${Date.now()}`);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}
