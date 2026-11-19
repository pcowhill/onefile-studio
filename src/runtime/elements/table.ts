import type { RuntimeElementDef } from './types';
import { h, num, svg, SHADOWS } from './types';
import { fontStack } from '../fonts';
import { parseHex } from '../../model/paint';

export type ColumnAlign = 'auto' | 'left' | 'center' | 'right';

export interface TableProps {
  /** Cell text, row by row. When `headerRow` is on, row 0 is the header. */
  rows: string[][];
  headerRow: boolean;
  /** Per-column alignment ("auto" right-aligns numbers). */
  columnAlign: ColumnAlign[];
  /** "lined" (row dividers), "boxed" (full grid) or "minimal" (no lines). */
  preset: 'lined' | 'boxed' | 'minimal';
  striped: boolean;
  hoverHighlight: boolean;
  /** Viewers can sort by clicking a header. */
  sortable: boolean;
  size: number;
  font: string;
  textColor: string;
  headerBg: string;
  headerText: string;
  stripe: string;
  borderColor: string;
  background: string;
  accent: string;
  radius: number;
  shadow: string;
}

/**
 * Reads a number from cell text the way people write them: currency symbols,
 * percent signs, spaces and thousand separators are ignored, "(12)" and
 * "−12" are negative, "1,5" / "1.234,5" decimal commas are understood.
 * Returns null for anything that is not a number.
 */
export function parseNumeric(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s || s.length > 60) return null;
  let neg = false;
  const paren = /^\((.*)\)$/.exec(s);
  if (paren) {
    neg = true;
    s = paren[1].trim();
  }
  s = s
    .replace(/[−‒–]/g, '-')
    .replace(/[\s\u00a0\u2009\u202f']/g, '')
    .replace(/^([+-]?)(?:[$€£¥₹₩₽¢]|US\$|USD|EUR|GBP)/i, '$1')
    .replace(/(?:[$€£¥₹₩₽¢%‰]|USD|EUR|GBP)$/i, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

/** True when most filled cells of a column are numbers. */
export function isNumericColumn(cells: string[]): boolean {
  const filled = cells.filter((c) => String(c ?? '').trim() !== '');
  if (!filled.length) return false;
  const nums = filled.filter((c) => parseNumeric(c) !== null).length;
  return nums / filled.length >= 0.75;
}

export type SortDir = 'asc' | 'desc';

/** Compares two cells: numbers numerically, text naturally, blanks always last. */
export function compareCells(a: string, b: string, dir: SortDir): number {
  const ea = String(a ?? '').trim() === '';
  const eb = String(b ?? '').trim() === '';
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  const na = parseNumeric(a);
  const nb = parseNumeric(b);
  let r: number;
  if (na !== null && nb !== null) r = na - nb;
  else if (na !== null) r = -1;
  else if (nb !== null) r = 1;
  else r = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  return dir === 'asc' ? r : -r;
}

/** Row order (indices) for sorting `body` by column `col`; stable. */
export function sortOrder(body: string[][], col: number, dir: SortDir): number[] {
  return body.map((_, i) => i).sort((i, j) => compareCells(body[i][col] ?? '', body[j][col] ?? '', dir) || i - j);
}

function alpha(color: string, a: number, fallback: string): string {
  const rgb = parseHex(color || '');
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})` : fallback;
}

const PRESETS = new Set(['lined', 'boxed', 'minimal']);
const ALIGNS = new Set(['left', 'center', 'right']);

export const tableDef: RuntimeElementDef<TableProps> = {
  id: 'table',
  defaults: () => ({
    rows: [
      ['Plan', 'Seats', 'Price', 'Support'],
      ['Starter', '5', '$9', 'Email'],
      ['Team', '25', '$29', 'Chat'],
      ['Business', '100', '$79', 'Priority'],
    ],
    headerRow: true,
    columnAlign: ['auto', 'auto', 'auto', 'auto'],
    preset: 'lined',
    striped: true,
    hoverHighlight: true,
    sortable: true,
    size: 18,
    font: 'rounded',
    textColor: '#1d1b2c',
    headerBg: '#6d4aff',
    headerText: '#ffffff',
    stripe: '#f3f0ff',
    borderColor: '#e4e0f5',
    background: '#ffffff',
    accent: '#6d4aff',
    radius: 24,
    shadow: 'soft',
  }),
  render(el, { doc, env, onCleanup }) {
    const p = el.props;
    const play = env.mode === 'play';
    const preset = PRESETS.has(p.preset) ? p.preset : 'lined';
    const rows = (Array.isArray(p.rows) ? p.rows : []).filter(Array.isArray).map((r) => r.map((c) => (typeof c === 'string' ? c : String(c ?? ''))));
    const cols = Math.max(1, ...rows.map((r) => r.length));
    const grid = (rows.length ? rows : [['']]).map((r) => [...r, ...Array<string>(cols - r.length).fill('')]);
    const hasHeader = !!p.headerRow && grid.length > 0;
    const head = hasHeader ? grid[0] : null;
    const body = hasHeader ? grid.slice(1) : grid;
    const aligns = Array.isArray(p.columnAlign) ? p.columnAlign : [];
    const colAlign = Array.from({ length: cols }, (_, c) => {
      const a = aligns[c];
      if (typeof a === 'string' && ALIGNS.has(a)) return a;
      return isNumericColumn(body.map((r) => r[c])) ? 'right' : 'left';
    });
    const numericCol = Array.from({ length: cols }, (_, c) => isNumericColumn(body.map((r) => r[c])));
    const size = Math.max(8, Math.min(72, num(p.size, 18)));
    const radius = Math.max(0, num(p.radius, 0));

    const node = h(doc, 'div', `ofs-table ofs-table-${preset}`, {
      fontFamily: fontStack(p.font),
      color: p.textColor,
      background: p.background,
      borderRadius: `${radius}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
      fontSize: `${size}px`,
    });
    if (p.striped) node.classList.add('ofs-table-striped');
    if (p.hoverHighlight && play) node.classList.add('ofs-table-hover');
    const vars: Record<string, string> = {
      '--ofs-tb-head': p.headerBg,
      '--ofs-tb-head-text': p.headerText,
      '--ofs-tb-stripe': p.stripe,
      '--ofs-tb-border': p.borderColor,
      '--ofs-tb-accent': p.accent,
      '--ofs-tb-hover': alpha(p.accent, 0.1, 'rgba(127, 127, 127, 0.12)'),
      '--ofs-tb-bg': p.background,
    };
    for (const [k, v] of Object.entries(vars)) node.style.setProperty(k, v);

    const scroll = h(doc, 'div', 'ofs-table-scroll');
    const table = h(doc, 'table', 'ofs-table-el');
    if (el.name) table.setAttribute('aria-label', el.name);
    const tbody = h(doc, 'tbody');
    const bodyRows = body.map((r) => {
      const tr = h(doc, 'tr');
      r.forEach((cell, c) => {
        const td = h(doc, 'td');
        td.textContent = cell;
        td.style.textAlign = colAlign[c];
        if (numericCol[c]) td.classList.add('ofs-table-num');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
      return tr;
    });

    const canSort = !!p.sortable && !!head && body.length > 1;
    const ths: HTMLTableCellElement[] = [];
    const stateKey = `${el.id}:sort`;
    let sort = (play ? (env.state.get(stateKey) as { col: number; dir: SortDir } | undefined) : undefined) ?? null;
    if (sort && !(sort.col >= 0 && sort.col < cols)) sort = null;

    const applySort = () => {
      const order = sort ? sortOrder(body, sort.col, sort.dir) : body.map((_, i) => i);
      for (const i of order) tbody.appendChild(bodyRows[i]);
      ths.forEach((th, c) => {
        const dir = sort && sort.col === c ? sort.dir : null;
        if (canSort) th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none');
        th.classList.toggle('ofs-sorted-asc', dir === 'asc');
        th.classList.toggle('ofs-sorted-desc', dir === 'desc');
      });
      node.dataset.sort = sort ? `${sort.col}:${sort.dir}` : '';
    };

    if (head) {
      const thead = h(doc, 'thead');
      const tr = h(doc, 'tr');
      head.forEach((cell, c) => {
        const th = h(doc, 'th');
        th.scope = 'col';
        th.style.textAlign = colAlign[c];
        const label = h(doc, 'span', 'ofs-table-th-label');
        label.textContent = cell;
        if (canSort) {
          const ind = svg(doc, 'svg', { viewBox: '0 0 10 14', width: '0.62em', height: '0.9em', 'aria-hidden': 'true', class: 'ofs-table-sort-ind' });
          ind.appendChild(svg(doc, 'path', { d: 'M5 1L9 5.5H1z', class: 'ofs-table-sort-up' }));
          ind.appendChild(svg(doc, 'path', { d: 'M5 13L1 8.5h8z', class: 'ofs-table-sort-down' }));
          const inner = h(doc, play ? 'button' : 'span', 'ofs-table-sort');
          if (play) {
            (inner as HTMLButtonElement).type = 'button';
            inner.title = `Sort by ${cell || `column ${c + 1}`}`;
            inner.addEventListener('click', (e) => {
              e.stopPropagation();
              if (!sort || sort.col !== c) sort = { col: c, dir: 'asc' };
              else if (sort.dir === 'asc') sort = { col: c, dir: 'desc' };
              else sort = null;
              env.state.set(stateKey, sort ?? undefined);
              applySort();
            });
          }
          if (play) {
            // The whole header cell is a click target (the button stays the keyboard target).
            th.classList.add('ofs-table-th-sortable');
            th.addEventListener('click', (e) => {
              if (e.target === th) (inner as HTMLButtonElement).click();
            });
          }
          if (colAlign[c] === 'right') inner.classList.add('ofs-table-sort-end');
          inner.appendChild(label);
          inner.appendChild(ind);
          th.appendChild(inner);
        } else th.appendChild(label);
        ths.push(th);
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }
    table.appendChild(tbody);
    scroll.appendChild(table);
    node.appendChild(scroll);
    if (play) {
      // Keyboard users can scroll an overflowing table.
      const fit = () => {
        const over = scroll.scrollHeight > scroll.clientHeight + 1 || scroll.scrollWidth > scroll.clientWidth + 1;
        if (over) scroll.tabIndex = 0;
        else scroll.removeAttribute('tabindex');
      };
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fit) : 0;
      onCleanup(() => {
        if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      });
    }
    applySort();
    return { node };
  },
  css: `.ofs-table{width:100%;height:100%;overflow:hidden;position:relative;line-height:1.35}
.ofs-table-scroll{width:100%;height:100%;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--ofs-tb-accent) transparent;border-radius:inherit;outline:none}
.ofs-table-scroll:focus-visible{box-shadow:inset 0 0 0 3px var(--ofs-tb-accent)}
.ofs-table-scroll::-webkit-scrollbar{width:8px;height:8px}
.ofs-table-scroll::-webkit-scrollbar-thumb{background:var(--ofs-tb-accent);border-radius:8px;border:2px solid transparent;background-clip:padding-box}
.ofs-table-scroll::-webkit-scrollbar-track,.ofs-table-scroll::-webkit-scrollbar-corner{background:transparent}
.ofs-editing .ofs-table-scroll{pointer-events:auto}
.ofs-table-el{width:100%;border-collapse:separate;border-spacing:0;font-size:1em;color:inherit}
.ofs-table-el th,.ofs-table-el td{padding:.62em .95em;vertical-align:middle;overflow-wrap:anywhere;word-break:normal}
.ofs-table-el th{position:sticky;top:0;z-index:1;background:var(--ofs-tb-head);color:var(--ofs-tb-head-text);font-weight:800;font-size:.86em;letter-spacing:.02em;text-align:left;white-space:nowrap;padding-top:.78em;padding-bottom:.78em}
.ofs-table-el td.ofs-table-num{font-variant-numeric:tabular-nums;white-space:nowrap}
.ofs-table-lined td{border-bottom:1px solid var(--ofs-tb-border)}
.ofs-table-lined tbody tr:last-child td{border-bottom:0}
.ofs-table-boxed{border:1px solid var(--ofs-tb-border)}
.ofs-table-boxed th,.ofs-table-boxed td{border-right:1px solid var(--ofs-tb-border);border-bottom:1px solid var(--ofs-tb-border)}
.ofs-table-boxed th{border-color:color-mix(in srgb,var(--ofs-tb-border) 60%,var(--ofs-tb-head))}
.ofs-table-boxed tr>:last-child{border-right:0}
.ofs-table-boxed tbody tr:last-child td{border-bottom:0}
.ofs-table-minimal th,.ofs-table-minimal td{padding-left:1.1em;padding-right:1.1em}
.ofs-table-minimal td{padding-top:.72em;padding-bottom:.72em}
.ofs-table-striped tbody tr:nth-child(even) td{background:var(--ofs-tb-stripe)}
.ofs-table-hover tbody tr:hover td{background-image:linear-gradient(var(--ofs-tb-hover),var(--ofs-tb-hover))}
.ofs-table-hover tbody tr:hover td:first-child{box-shadow:inset 3px 0 0 var(--ofs-tb-accent)}
.ofs-table-sort{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:.45em;max-width:100%;cursor:pointer;border-radius:6px;font:inherit;color:inherit;letter-spacing:inherit}
span.ofs-table-sort{cursor:default}
.ofs-table-sort-end{flex-direction:row-reverse}
.ofs-table-th-sortable{cursor:pointer}
.ofs-table-sort:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.ofs-table-th-label{overflow:hidden;text-overflow:ellipsis}
.ofs-table-sort-ind{flex:none;opacity:.55;transition:opacity .15s}
.ofs-table-sort-ind path{fill:currentColor;opacity:.4;transition:opacity .15s}
button.ofs-table-sort:hover .ofs-table-sort-ind{opacity:1}
.ofs-sorted-asc .ofs-table-sort-ind,.ofs-sorted-desc .ofs-table-sort-ind{opacity:1}
.ofs-sorted-asc .ofs-table-sort-up,.ofs-sorted-desc .ofs-table-sort-down{opacity:1}
.ofs-sorted-asc .ofs-table-sort-down,.ofs-sorted-desc .ofs-table-sort-up{opacity:.18}
@media (prefers-reduced-motion:reduce){.ofs-table-sort-ind,.ofs-table-sort-ind path{transition:none}}`,
};
