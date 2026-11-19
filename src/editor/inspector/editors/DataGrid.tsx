import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../../ui/Modal';
import { Icon } from '../../ui/Icon';
import { Segmented, Toggle } from '../../ui/controls';
import { gridToChart, isInvalidValue, padGrid, parseDelimited, pasteBlock } from '../../../io/csv';
import type { Grid } from '../../../io/csv';
import type { ColumnAlign } from '../../../runtime/elements/table';
import { MAX_CHART_POINTS, MAX_CHART_SERIES, MAX_TABLE_COLS, MAX_TABLE_ROWS } from '../../../model/propSchemas';
import '../../../styles/data.css';

export interface DataGridResult {
  grid: Grid;
  headerRow: boolean;
  columnAlign: ColumnAlign[];
}

export interface DataGridProps {
  /** "chart": first column = labels, first row = series names, values must be numbers. */
  mode: 'chart' | 'table';
  title: string;
  initial: Grid;
  headerRow?: boolean;
  columnAlign?: ColumnAlign[];
  /** Chart: series colours shown beside the column names. */
  seriesColors?: string[];
  onDone(result: DataGridResult): void;
  onClose(): void;
}

const colName = (c: number) => {
  let s = '';
  let n = c + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const plural = (n: number, w: string) => `${n} ${n === 1 ? w : `${w}s`}`;

/** Spreadsheet-like editor for chart data and table cells (shared by both inspectors). */
export function DataGrid({ mode, title, initial, headerRow: initialHeader = true, columnAlign = [], seriesColors = [], onDone, onClose }: DataGridProps) {
  const chart = mode === 'chart';
  const maxRows = chart ? MAX_CHART_POINTS + 1 : MAX_TABLE_ROWS;
  const maxCols = chart ? MAX_CHART_SERIES + 1 : MAX_TABLE_COLS;
  const [grid, setGrid] = useState<Grid>(() => {
    const g = padGrid(initial.length ? initial.map((r) => [...r]) : [['']]);
    if (chart && g.length < 2) g.push(Array<string>(g[0].length).fill(''));
    if (chart && g[0].length < 2) g.forEach((r) => r.push(''));
    return g;
  });
  const [header, setHeader] = useState(initialHeader);
  const [aligns, setAligns] = useState<ColumnAlign[]>(() => Array.from({ length: grid[0].length }, (_, i) => columnAlign[i] ?? 'auto'));
  const [notice, setNotice] = useState<{ text: string; kind: 'info' | 'warn' } | null>(null);
  const [menu, setMenu] = useState<{ kind: 'row' | 'col'; index: number; x: number; y: number } | null>(null);
  const dirty = useRef(false);
  const pendingFocus = useRef<[number, number] | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = grid.length;
  const cols = grid[0]?.length ?? 1;
  const headRow = chart || header;

  useLayoutEffect(() => {
    const f = pendingFocus.current;
    if (!f) return;
    pendingFocus.current = null;
    const input = tableRef.current?.querySelector<HTMLInputElement>(`input[data-r="${f[0]}"][data-c="${f[1]}"]`);
    if (input) {
      input.focus();
      input.select();
    }
  });

  useEffect(() => {
    // Start typing straight away in the first data cell (after the modal takes focus).
    const t = setTimeout(() => tableRef.current?.querySelector<HTMLInputElement>(`input[data-r="${chart ? 1 : 0}"][data-c="${chart ? 1 : 0}"]`)?.focus(), 30);
    return () => clearTimeout(t);
  }, [chart]);

  const commit = (next: Grid, nextAligns = aligns) => {
    dirty.current = true;
    const w = next[0]?.length ?? 1;
    setGrid(next);
    setAligns(Array.from({ length: w }, (_, i) => nextAligns[i] ?? 'auto'));
  };

  const setCell = (r: number, c: number, v: string) => {
    const next = grid.map((row) => [...row]);
    next[r][c] = v;
    commit(next);
  };

  const insertRow = (at: number) => {
    if (rows >= maxRows) return limitNotice();
    const next = grid.map((r) => [...r]);
    next.splice(at, 0, Array<string>(cols).fill(''));
    commit(next);
    pendingFocus.current = [at, chart ? 0 : 0];
  };
  const deleteRow = (at: number) => {
    if (rows <= (chart ? 2 : 1) || (chart && at === 0)) return;
    commit(grid.filter((_, i) => i !== at));
  };
  const insertCol = (at: number) => {
    if (cols >= maxCols) return limitNotice();
    const nextAligns = [...aligns];
    nextAligns.splice(at, 0, 'auto');
    commit(
      grid.map((r) => {
        const n = [...r];
        n.splice(at, 0, '');
        return n;
      }),
      nextAligns,
    );
    pendingFocus.current = [0, at];
  };
  const deleteCol = (at: number) => {
    if (cols <= (chart ? 2 : 1) || (chart && at === 0)) return;
    commit(
      grid.map((r) => r.filter((_, i) => i !== at)),
      aligns.filter((_, i) => i !== at),
    );
  };
  const limitNotice = () =>
    setNotice({
      kind: 'warn',
      text: chart
        ? `Charts can show up to ${MAX_CHART_POINTS} labels and ${MAX_CHART_SERIES} series.`
        : `Tables can have up to ${MAX_TABLE_ROWS} rows and ${MAX_TABLE_COLS} columns.`,
    });

  const transpose = () => {
    const next: Grid = Array.from({ length: Math.min(maxRows, cols) }, (_, c) => Array.from({ length: Math.min(maxCols, rows) }, (_, r) => grid[r][c]));
    if (cols > maxRows || rows > maxCols) limitNotice();
    commit(next, []);
  };

  const replaceAll = (block: Grid, source: string) => {
    if (!block.length) {
      setNotice({ kind: 'warn', text: `${source} looks empty.` });
      return;
    }
    const clipped = block.length > maxRows || block.some((r) => r.length > maxCols);
    let next = padGrid(block.slice(0, maxRows).map((r) => r.slice(0, maxCols)));
    if (chart) {
      if (next.length < 2) next = [...next, Array<string>(next[0].length).fill('')];
      if (next[0].length < 2) next = next.map((r) => [...r, '']);
    }
    commit(next, []);
    setNotice(
      clipped
        ? {
            kind: 'warn',
            text: `Imported from ${source}. Only the first ${chart ? maxRows - 1 : maxRows} rows and ${chart ? maxCols - 1 : maxCols} columns were kept.`,
          }
        : { kind: 'info', text: `Imported ${plural(block.length, 'row')} from ${source}.` },
    );
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5_000_000) {
      setNotice({ kind: 'warn', text: 'That file is too big (5 MB at most).' });
      return;
    }
    const text = await file.text();
    replaceAll(parseDelimited(text, undefined, { rows: maxRows + 1, cols: maxCols + 1 }), file.name.slice(0, 60));
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || !/[\t\r\n]/.test(text.replace(/[\r\n]+$/, ''))) return; // one value: normal paste
    e.preventDefault();
    const block = parseDelimited(text, text.includes('\t') ? '\t' : undefined, { rows: maxRows + 1, cols: maxCols + 1 });
    if (!block.length) return;
    const { grid: next, clipped } = pasteBlock(grid, block, r, c, maxRows, maxCols);
    commit(next);
    setNotice(
      clipped
        ? { kind: 'warn', text: `Pasted, but some cells did not fit (${chart ? 'charts' : 'tables'} have a size limit).` }
        : { kind: 'info', text: `Pasted ${plural(block.length, 'row')} × ${plural(Math.max(...block.map((b) => b.length)), 'column')}.` },
    );
  };

  const move = (r: number, c: number) => {
    const input = tableRef.current?.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"]`);
    if (input) {
      input.focus();
      input.select();
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const t = e.currentTarget;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) move(Math.max(0, r - 1), c);
      else if (r + 1 < rows) move(r + 1, c);
      else if (rows < maxRows) {
        insertRow(rows);
        pendingFocus.current = [rows, c];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(Math.min(rows - 1, r + 1), c);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(Math.max(0, r - 1), c);
    } else if (e.key === 'ArrowLeft' && t.selectionStart === 0 && t.selectionEnd === 0 && c > 0) {
      e.preventDefault();
      move(r, c - 1);
    } else if (e.key === 'ArrowRight' && t.selectionStart === t.value.length && t.selectionEnd === t.value.length && c + 1 < cols) {
      e.preventDefault();
      move(r, c + 1);
    }
  };

  const summary = useMemo(() => {
    if (!chart) {
      const bodyRows = header ? rows - 1 : rows;
      return `${plural(bodyRows, 'row')} · ${plural(cols, 'column')}${header ? ' + header' : ''}`;
    }
    const r = gridToChart(grid);
    const bad = r.invalid.length ? ` · ${plural(r.invalid.length, 'cell')} not a number (counted as 0)` : '';
    return `${plural(r.labels.length, 'label')} · ${r.series.length} series${bad}`;
  }, [chart, grid, header, rows, cols]);
  const hasInvalid = chart && summary.includes('not a number');

  const close = () => {
    if (!dirty.current || window.confirm('Discard your changes to the data?')) onClose();
  };

  const colLabel = (c: number) => (chart ? (c === 0 ? 'Labels' : `Series ${c}`) : colName(c));
  const rowLabel = (r: number) => (chart ? (r === 0 ? 'Names' : String(r)) : header && r === 0 ? 'Header' : String(header ? r : r + 1));
  const cellLabel = (r: number, c: number) => {
    if (chart) {
      if (r === 0) return c === 0 ? 'Corner' : `Name of series ${c}`;
      return c === 0 ? `Label ${r}` : `Series ${c}, value ${r}`;
    }
    return `Row ${r + 1}, column ${colName(c)}`;
  };

  return (
    <Modal label={title} onClose={close} className="ed-dg-modal" wide>
      <div className="ed-dg-head">
        <span className="ed-dg-head-icon">
          <Icon name={chart ? 'chart' : 'table'} size={22} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>
            {chart
              ? 'First column = labels along the bottom, top row = series names. Paste straight from a spreadsheet.'
              : 'Type in the cells or paste straight from a spreadsheet. Enter moves down, Tab moves right.'}
          </p>
        </div>
      </div>

      <div className="ed-dg-toolbar">
        <button className="ed-btn ed-btn-sm ed-btn-soft" onClick={() => insertRow(rows)} disabled={rows >= maxRows} data-testid="dg-add-row">
          <Icon name="plus" size={14} stroke={2.6} /> {chart ? 'Add label' : 'Add row'}
        </button>
        <button className="ed-btn ed-btn-sm ed-btn-soft" onClick={() => insertCol(cols)} disabled={cols >= maxCols} data-testid="dg-add-col">
          <Icon name="plus" size={14} stroke={2.6} /> {chart ? 'Add series' : 'Add column'}
        </button>
        {chart && (
          <button className="ed-btn ed-btn-sm ed-btn-ghost" onClick={transpose} title="Swap rows and columns">
            <Icon name="rotate" size={14} /> Swap rows & columns
          </button>
        )}
        <span className="ed-dg-spacer" />
        <button className="ed-btn ed-btn-sm ed-btn-ghost" onClick={() => fileRef.current?.click()} data-testid="dg-import">
          <Icon name="upload" size={14} /> Import CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
          data-testid="dg-file"
        />
      </div>

      {notice && (
        <div className={`ed-dg-notice is-${notice.kind}`} role="status">
          <Icon name={notice.kind === 'warn' ? 'warning' : 'check'} size={15} />
          <span>{notice.text}</span>
          <button className="ed-icon-btn is-xs" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <Icon name="close" size={12} />
          </button>
        </div>
      )}

      <div className="ed-dg-scroll">
        <table className={`ed-dg ${chart ? 'is-chart' : 'is-table'}`} ref={tableRef} data-testid="data-grid">
          <thead>
            <tr>
              <th className="ed-dg-corner" />
              {grid[0].map((_, c) => (
                <th key={c} className={`ed-dg-colhead ${chart && c === 0 ? 'is-label' : ''}`}>
                  <span className="ed-dg-colname">
                    {chart && c > 0 && (
                      <i className="ed-dg-dot" style={seriesColors.length ? { background: seriesColors[(c - 1) % seriesColors.length] } : undefined} />
                    )}
                    {colLabel(c)}
                  </span>
                  {!chart && aligns[c] !== 'auto' && <Icon name={`text${aligns[c][0].toUpperCase()}${aligns[c].slice(1)}`} size={13} />}
                  {!(chart && c === 0) && (
                    <button
                      className="ed-dg-menu-btn"
                      aria-label={`Column ${colLabel(c)} options`}
                      onClick={(e) => {
                        const b = e.currentTarget.getBoundingClientRect();
                        setMenu({ kind: 'col', index: c, x: b.right, y: b.bottom + 4 });
                      }}
                    >
                      <Icon name="more" size={14} />
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r} className={headRow && r === 0 ? 'is-head' : ''}>
                <th className="ed-dg-rowhead">
                  <span>{rowLabel(r)}</span>
                  {!(chart && r === 0) && (
                    <button
                      className="ed-dg-menu-btn"
                      aria-label={`Row ${rowLabel(r)} options`}
                      onClick={(e) => {
                        const b = e.currentTarget.getBoundingClientRect();
                        setMenu({ kind: 'row', index: r, x: b.left, y: b.bottom + 4 });
                      }}
                    >
                      <Icon name="more" size={14} />
                    </button>
                  )}
                </th>
                {row.map((cell, c) => {
                  const corner = chart && r === 0 && c === 0;
                  const invalid = chart && r > 0 && c > 0 && isInvalidValue(cell);
                  const numeric = chart && r > 0 && c > 0;
                  return (
                    <td key={c} className={`${invalid ? 'is-invalid' : ''} ${chart && c === 0 ? 'is-label' : ''}`}>
                      {corner ? (
                        <span className="ed-dg-cornercell">Label ↓ · Series →</span>
                      ) : (
                        <input
                          value={cell}
                          data-r={r}
                          data-c={c}
                          aria-label={cellLabel(r, c)}
                          aria-invalid={invalid || undefined}
                          title={invalid ? 'Not a number — it will count as 0' : undefined}
                          inputMode={numeric ? 'decimal' : undefined}
                          className={numeric ? 'is-num' : ''}
                          style={!chart && aligns[c] !== 'auto' ? { textAlign: aligns[c] } : undefined}
                          placeholder={chart && r === 0 ? `Series ${c}` : undefined}
                          spellCheck={false}
                          onChange={(e) => setCell(r, c, e.target.value)}
                          onKeyDown={(e) => onKey(e, r, c)}
                          onPaste={(e) => onPaste(e, r, c)}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ed-dg-foot">
        <div className={`ed-dg-summary ${hasInvalid ? 'is-warn' : ''}`} data-testid="dg-summary">
          {hasInvalid && <Icon name="warning" size={14} />}
          {summary}
        </div>
        {!chart && (
          <div className="ed-dg-header-toggle">
            <Toggle
              label="Use first row as header"
              checked={header}
              onChange={(v) => {
                dirty.current = true;
                setHeader(v);
              }}
            />
          </div>
        )}
        <div className="ed-modal-actions">
          <button className="ed-btn ed-btn-ghost" onClick={close}>
            Cancel
          </button>
          <button className="ed-btn ed-btn-primary" onClick={() => onDone({ grid, headerRow: header, columnAlign: aligns })} data-testid="dg-done">
            <Icon name="check" size={16} stroke={2.6} /> Done
          </button>
        </div>
      </div>

      {menu && (
        <GridMenu x={menu.x} y={menu.y} align={menu.kind === 'col' ? 'right' : 'left'} onClose={() => setMenu(null)}>
          {menu.kind === 'col' ? (
            <>
              {!chart && (
                <div className="ed-dg-menu-align">
                  <small>Align</small>
                  <Segmented<ColumnAlign>
                    size="sm"
                    value={aligns[menu.index] ?? 'auto'}
                    ariaLabel="Column alignment"
                    onChange={(v) => {
                      const next = [...aligns];
                      next[menu.index] = v;
                      dirty.current = true;
                      setAligns(next);
                    }}
                    options={[
                      { value: 'auto', label: 'Auto', title: 'Automatic (numbers on the right)' },
                      { value: 'left', icon: 'textLeft', title: 'Left' },
                      { value: 'center', icon: 'textCenter', title: 'Centre' },
                      { value: 'right', icon: 'textRight', title: 'Right' },
                    ]}
                  />
                </div>
              )}
              <MenuItem icon="left" onClick={() => insertCol(menu.index)} disabled={cols >= maxCols || (chart && menu.index === 0)}>
                Insert {chart ? 'series' : 'column'} before
              </MenuItem>
              <MenuItem icon="right" onClick={() => insertCol(menu.index + 1)} disabled={cols >= maxCols}>
                Insert {chart ? 'series' : 'column'} after
              </MenuItem>
              <MenuItem icon="trash" danger onClick={() => deleteCol(menu.index)} disabled={cols <= (chart ? 2 : 1)}>
                Delete {chart ? 'series' : 'column'}
              </MenuItem>
            </>
          ) : (
            <>
              <MenuItem icon="up" onClick={() => insertRow(menu.index)} disabled={rows >= maxRows || (chart && menu.index === 0)}>
                Insert {chart ? 'label' : 'row'} above
              </MenuItem>
              <MenuItem icon="down" onClick={() => insertRow(menu.index + 1)} disabled={rows >= maxRows}>
                Insert {chart ? 'label' : 'row'} below
              </MenuItem>
              <MenuItem icon="trash" danger onClick={() => deleteRow(menu.index)} disabled={rows <= (chart ? 2 : 1)}>
                Delete {chart ? 'label' : 'row'}
              </MenuItem>
            </>
          )}
        </GridMenu>
      )}
    </Modal>
  );
}

function MenuItem({ icon, children, onClick, disabled, danger }: { icon: string; children: ReactNode; onClick(): void; disabled?: boolean; danger?: boolean }) {
  return (
    <button className={`ed-dg-menu-item ${danger ? 'is-danger' : ''}`} onClick={onClick} disabled={disabled} data-close>
      <Icon name={icon} size={15} />
      {children}
    </button>
  );
}

/** Small fixed-position menu (escapes the grid's scroll clipping). */
function GridMenu({ x, y, align, onClose, children }: { x: number; y: number; align: 'left' | 'right'; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const hgt = el.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, align === 'right' ? x - w : x));
    const top = y + hgt > window.innerHeight - 8 ? Math.max(8, y - hgt - 36) : y;
    setPos({ left, top });
  }, [x, y, align]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', down, true);
    return () => window.removeEventListener('pointerdown', down, true);
  }, [onClose]);
  return createPortal(
    <div
      ref={ref}
      className="ed-dg-menu"
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-close]')) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
