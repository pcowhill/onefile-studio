import type { ChartProps, ChartSeries } from '../runtime/elements/chart';
import { parseNumeric } from '../runtime/elements/table';
import { MAX_CHART_POINTS, MAX_CHART_SERIES, MAX_TABLE_COLS, MAX_TABLE_ROWS } from '../model/propSchemas';

export { parseNumeric };

/** A rectangular grid of cell text (row by row). */
export type Grid = string[][];

const CANDIDATES = ['\t', ',', ';', '|'] as const;

/**
 * Guesses the delimiter of CSV/TSV text by counting candidates outside quotes
 * in the first lines and preferring the one that splits lines most consistently.
 */
export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 20_000);
  const lines: Array<Record<string, number>> = [];
  let counts: Record<string, number> = {};
  let quoted = false;
  for (let i = 0; i < sample.length && lines.length < 20; i++) {
    const ch = sample[i];
    if (ch === '"') {
      if (quoted && sample[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && sample[i + 1] === '\n') i++;
      lines.push(counts);
      counts = {};
    } else if (!quoted && (CANDIDATES as readonly string[]).includes(ch)) {
      counts[ch] = (counts[ch] ?? 0) + 1;
    }
  }
  if (Object.keys(counts).length) lines.push(counts);
  let best = ',';
  let bestScore = 0;
  for (const d of CANDIDATES) {
    const per = lines.map((l) => l[d] ?? 0);
    const used = per.filter((n) => n > 0);
    if (!used.length) continue;
    // Lines that agree with the most common count score highest.
    const freq = new Map<number, number>();
    for (const n of used) freq.set(n, (freq.get(n) ?? 0) + 1);
    const agree = Math.max(...freq.values());
    const score = agree * 10 + used.length + (d === '\t' ? 0.5 : 0);
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Parses CSV/TSV text (RFC 4180 style): quoted fields, doubled quotes inside
 * quotes, CRLF/CR/LF line endings, a leading BOM. Trailing blank lines are
 * dropped and rows are padded to the same width.
 */
export function parseDelimited(text: string, delimiter?: string, limits: { rows?: number; cols?: number } = {}): Grid {
  const src = String(text ?? '').replace(/^\uFEFF/, '');
  const d = delimiter ?? detectDelimiter(src);
  const maxRows = limits.rows ?? 10_000;
  const maxCols = limits.cols ?? 1_000;
  const rows: Grid = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let wasQuoted = false;
  let fieldStarted = false;
  const endField = () => {
    if (row.length < maxCols) row.push(wasQuoted ? field : field.trim());
    field = '';
    fieldStarted = false;
    wasQuoted = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && !fieldStarted && field.trim() === '') {
      field = '';
      quoted = true;
      wasQuoted = true;
      fieldStarted = true;
    } else if (ch === d) endField();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
      if (rows.length >= maxRows) break;
    } else if (!(wasQuoted && /\s/.test(ch))) {
      field += ch;
      if (ch !== ' ' && ch !== '\t') fieldStarted = true;
    }
  }
  if (rows.length < maxRows && (field !== '' || row.length || quoted || wasQuoted)) endRow();
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === '')) rows.pop();
  return padGrid(rows);
}

/** Serialises a grid as CSV (or TSV with `\t`), quoting only where needed. */
export function toDelimited(grid: Grid, delimiter = ','): string {
  const q = (s: string) => (s.includes(delimiter) || /["\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return grid.map((r) => r.map((c) => q(String(c ?? ''))).join(delimiter)).join('\r\n');
}

/** Pads every row to the widest row (at least one column). */
export function padGrid(grid: Grid): Grid {
  const cols = Math.max(1, ...grid.map((r) => r.length));
  return grid.map((r) => [...r.map((c) => String(c ?? '')), ...Array<string>(cols - r.length).fill('')]);
}

/** Removes fully empty rows/columns at the bottom/right edge. */
export function trimGrid(grid: Grid): Grid {
  let rows = grid.map((r) => [...r]);
  while (rows.length > 1 && rows[rows.length - 1].every((c) => c.trim() === '')) rows.pop();
  rows = padGrid(rows);
  let cols = rows[0]?.length ?? 1;
  while (cols > 1 && rows.every((r) => (r[cols - 1] ?? '').trim() === '')) cols--;
  return rows.map((r) => r.slice(0, cols));
}

/** Writes `block` into `grid` with its top-left at (row, col), growing the grid up to the limits. */
export function pasteBlock(grid: Grid, block: Grid, row: number, col: number, maxRows: number, maxCols: number): { grid: Grid; clipped: boolean } {
  const out = grid.map((r) => [...r]);
  const width = out[0]?.length ?? 1;
  const needRows = Math.min(maxRows, row + block.length);
  const needCols = Math.min(maxCols, Math.max(width, col + Math.max(0, ...block.map((r) => r.length))));
  const clipped = row + block.length > maxRows || col + Math.max(0, ...block.map((r) => r.length)) > maxCols;
  while (out.length < needRows) out.push(Array<string>(width).fill(''));
  for (const r of out) while (r.length < needCols) r.push('');
  block.forEach((br, i) => {
    const r = row + i;
    if (r >= needRows) return;
    br.forEach((v, j) => {
      const c = col + j;
      if (c < needCols) out[r][c] = v;
    });
  });
  return { grid: out, clipped };
}

/** Formats a number for a grid cell without losing precision. */
function cellNumber(v: number): string {
  return Number.isFinite(v) ? String(v) : '0';
}

/**
 * Chart props → grid: row 0 = ["", series names…], then one row per label
 * (label, value per series).
 */
export function chartToGrid(p: Pick<ChartProps, 'labels' | 'series'>): Grid {
  const labels = Array.isArray(p.labels) ? p.labels : [];
  const series = Array.isArray(p.series) ? p.series : [];
  const grid: Grid = [['', ...series.map((s) => String(s.name ?? ''))]];
  labels.forEach((l, i) => grid.push([String(l ?? ''), ...series.map((s) => cellNumber(Number(s.values?.[i] ?? 0)))]));
  return padGrid(grid);
}

export interface GridChart {
  labels: string[];
  series: ChartSeries[];
  /** Cells (row, col in grid coordinates) that are not numbers (they count as 0). */
  invalid: Array<[number, number]>;
}

/** True if a value cell is filled but not a number. */
export function isInvalidValue(cell: string): boolean {
  return cell.trim() !== '' && parseNumeric(cell) === null;
}

/** Grid → chart props. Blank rows/columns are dropped; non-numbers become 0 and are reported. */
export function gridToChart(grid: Grid): GridChart {
  const g = trimGrid(padGrid(grid.length ? grid : [['']]));
  const head = g[0];
  const body = g.slice(1).filter((r) => r.some((c) => c.trim() !== ''));
  const bodyIdx = g
    .slice(1)
    .map((r, i) => (r.some((c) => c.trim() !== '') ? i + 1 : -1))
    .filter((i) => i > 0);
  const cols: number[] = [];
  for (let c = 1; c < head.length; c++) if (head[c].trim() !== '' || body.some((r) => r[c].trim() !== '')) cols.push(c);
  const invalid: Array<[number, number]> = [];
  const usedCols = cols.slice(0, MAX_CHART_SERIES);
  const usedRows = body.slice(0, MAX_CHART_POINTS);
  const labels = usedRows.map((r) => r[0].trim().slice(0, 60));
  const series = usedCols.map((c, k) => ({
    name: head[c].trim().slice(0, 60) || `Series ${k + 1}`,
    values: usedRows.map((r, i) => {
      const n = parseNumeric(r[c]);
      if (n === null && r[c].trim() !== '') invalid.push([bodyIdx[i], c]);
      return n === null ? 0 : Math.max(-1e12, Math.min(1e12, n));
    }),
  }));
  return { labels, series, invalid };
}

/** Grid → table rows: trims empty edges, applies limits, pads to a rectangle. */
export function gridToTable(grid: Grid): string[][] {
  const g = trimGrid(padGrid(grid.length ? grid : [['']]));
  return padGrid(g.slice(0, MAX_TABLE_ROWS).map((r) => r.slice(0, MAX_TABLE_COLS).map((c) => c.slice(0, 500))));
}
