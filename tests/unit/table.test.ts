import { describe, expect, it } from 'vitest';
import { mountPlayer } from './helpers';
import { createElement, createProject } from '../../src/model/factory';
import { THEME_IDS, themeNewElement } from '../../src/model/theme';
import { validateProject } from '../../src/model/validate';
import { renderContent } from '../../src/runtime/mount';
import { NavStore, VarStore } from '../../src/runtime/env';
import type { RuntimeEnv } from '../../src/runtime/env';
import { compareCells, isNumericColumn, parseNumeric } from '../../src/runtime/elements/table';
import type { TableProps } from '../../src/runtime/elements/table';
import { MAX_TABLE_COLS, MAX_TABLE_ROWS } from '../../src/model/propSchemas';
import type { SceneElement } from '../../src/model/types';

const ROWS = [
  ['Name', 'Price', 'Growth', 'Notes'],
  ['Banana', '$1,200', '5%', 'yellow'],
  ['apple', '$95', '-2%', ''],
  ['Cherry', '$10,000.50', '12%', 'red'],
  ['date', '(40)', '0%', 'brown'],
];

function table(props: Partial<TableProps> = {}) {
  return createElement<TableProps>('table', { id: 'el_table', w: 600, h: 300, props: { rows: ROWS, columnAlign: ['auto', 'auto', 'auto', 'auto'], ...props } });
}
function play(el: SceneElement) {
  const p = createProject('slides');
  p.pages[0].elements.push(el);
  const m = mountPlayer(p);
  return m.q(el.id)!.querySelector<HTMLElement>('.ofs-table')!;
}
function render(el: SceneElement) {
  const env: RuntimeEnv = { mode: 'edit', project: createProject('slides'), vars: new VarStore([]), nav: new NavStore(), state: new Map(), navigate() {} };
  return renderContent(el, env, document).node;
}
const column = (node: HTMLElement, c: number) => [...node.querySelectorAll('tbody tr')].map((tr) => tr.children[c].textContent);

describe('numeric parsing', () => {
  it('understands currency, percentages, separators and negatives', () => {
    expect(parseNumeric('$1,200')).toBe(1200);
    expect(parseNumeric('€ 3.5')).toBe(3.5);
    expect(parseNumeric('12%')).toBe(12);
    expect(parseNumeric('(40)')).toBe(-40);
    expect(parseNumeric('−12')).toBe(-12);
    expect(parseNumeric('1.234,5')).toBe(1234.5);
    expect(parseNumeric('3,5')).toBe(3.5);
    expect(parseNumeric('1 000 000')).toBe(1000000);
    expect(parseNumeric('1e3')).toBe(1000);
    expect(parseNumeric('abc')).toBeNull();
    expect(parseNumeric('12 apples')).toBeNull();
    expect(parseNumeric('')).toBeNull();
    expect(parseNumeric(NaN)).toBeNull();
  });

  it('detects numeric columns and compares cells', () => {
    expect(isNumericColumn(['1', '2', '', '$3'])).toBe(true);
    expect(isNumericColumn(['a', '2', 'b'])).toBe(false);
    expect(compareCells('10', '9', 'asc')).toBeGreaterThan(0);
    expect(compareCells('item 10', 'item 9', 'asc')).toBeGreaterThan(0);
    expect(compareCells('', 'a', 'asc')).toBeGreaterThan(0);
    expect(compareCells('', 'a', 'desc')).toBeGreaterThan(0);
  });
});

describe('table rendering', () => {
  it('renders a header row and body cells', () => {
    const node = render(table());
    expect([...node.querySelectorAll('thead th')].map((t) => t.textContent)).toEqual(['Name', 'Price', 'Growth', 'Notes']);
    expect(node.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(node.querySelector('button')).toBeNull();
    expect(node.style.fontSize).toBe('18px');
  });

  it('renders every row in the body without a header row', () => {
    const node = render(table({ headerRow: false }));
    expect(node.querySelector('thead')).toBeNull();
    expect(node.querySelectorAll('tbody tr')).toHaveLength(5);
  });

  it('auto right-aligns numeric columns and respects explicit alignment', () => {
    const node = render(table({ columnAlign: ['auto', 'auto', 'center', 'auto'] }));
    const first = node.querySelector('tbody tr')!.children;
    expect((first[0] as HTMLElement).style.textAlign).toBe('left');
    expect((first[1] as HTMLElement).style.textAlign).toBe('right');
    expect((first[2] as HTMLElement).style.textAlign).toBe('center');
    expect((node.querySelectorAll('thead th')[1] as HTMLElement).style.textAlign).toBe('right');
  });

  it('applies presets and options as classes', () => {
    const node = play(table({ preset: 'boxed', striped: false, hoverHighlight: true }));
    expect(node.classList.contains('ofs-table-boxed')).toBe(true);
    expect(node.classList.contains('ofs-table-striped')).toBe(false);
    expect(node.classList.contains('ofs-table-hover')).toBe(true);
    expect(render(table({ preset: 'weird' as never })).classList.contains('ofs-table-lined')).toBe(true);
  });

  it('renders in all four themes', () => {
    for (const theme of THEME_IDS) {
      const node = render(themeNewElement(table(), theme));
      expect(node.querySelectorAll('td').length, theme).toBe(16);
      expect(node.style.getPropertyValue('--ofs-tb-head'), theme).not.toBe('');
    }
  });

  it('copes with ragged rows and non-string cells', () => {
    const node = render(table({ rows: [['a'], ['b', 'c', 'd'], [1 as unknown as string]], columnAlign: [] }));
    expect(node.querySelectorAll('thead th')).toHaveLength(3);
    expect(node.querySelectorAll('tbody td')).toHaveLength(6);
  });
});

describe('table sorting (play mode)', () => {
  it('cycles ascending → descending → original order with aria-sort', () => {
    const node = play(table());
    const th = node.querySelectorAll('thead th')[1] as HTMLElement;
    const btn = th.querySelector('button')!;
    expect(th.getAttribute('aria-sort')).toBe('none');
    btn.click();
    expect(th.getAttribute('aria-sort')).toBe('ascending');
    expect(column(node, 1)).toEqual(['(40)', '$95', '$1,200', '$10,000.50']);
    btn.click();
    expect(th.getAttribute('aria-sort')).toBe('descending');
    expect(column(node, 1)).toEqual(['$10,000.50', '$1,200', '$95', '(40)']);
    btn.click();
    expect(th.getAttribute('aria-sort')).toBe('none');
    expect(column(node, 0)).toEqual(['Banana', 'apple', 'Cherry', 'date']);
  });

  it('sorts text case-insensitively, percentages numerically, blanks last', () => {
    const node = play(table());
    const ths = node.querySelectorAll('thead th button');
    (ths[0] as HTMLButtonElement).click();
    expect(column(node, 0)).toEqual(['apple', 'Banana', 'Cherry', 'date']);
    (ths[2] as HTMLButtonElement).click();
    expect(column(node, 2)).toEqual(['-2%', '0%', '5%', '12%']);
    expect(node.querySelectorAll('thead th')[0].getAttribute('aria-sort')).toBe('none');
    (ths[3] as HTMLButtonElement).click();
    (ths[3] as HTMLButtonElement).click();
    expect(column(node, 3)).toEqual(['yellow', 'red', 'brown', '']);
  });

  it('is not sortable when turned off or without a header row', () => {
    expect(play(table({ sortable: false })).querySelector('thead button')).toBeNull();
    expect(play(table({ headerRow: false })).querySelector('button')).toBeNull();
  });
});

describe('table props validation', () => {
  const roundTrip = (props: Record<string, unknown>) => {
    const p = createProject('slides');
    const el = table();
    (el as unknown as { props: unknown }).props = props;
    p.pages[0].elements.push(el);
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    if (!r.ok) throw new Error('invalid');
    return r.project.pages[0].elements[0].props as unknown as TableProps;
  };

  it('keeps valid props unchanged', () => {
    const el = table({ preset: 'minimal', columnAlign: ['left', 'right', 'center', 'auto'] });
    const p = createProject('slides');
    p.pages[0].elements.push(el);
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok && r.project.pages[0].elements[0].props).toEqual(el.props);
  });

  it('sanitises hostile rows, alignment and enums', () => {
    const out = roundTrip({
      rows: [...Array.from({ length: 1000 }, () => Array.from({ length: 100 }, (_, i) => (i % 3 ? { x: 1 } : 'y'.repeat(2000)))), 'not a row'],
      columnAlign: ['justify', 'left', 7],
      preset: '<img onerror=1>',
      size: 'huge',
      headerBg: 'url(javascript:alert(1))',
    });
    expect(out.rows).toHaveLength(MAX_TABLE_ROWS);
    expect(out.rows.every((r) => r.length === MAX_TABLE_COLS)).toBe(true);
    expect(out.rows[0][0].length).toBe(500);
    expect(out.rows[0][1]).toBe('');
    expect(out.columnAlign).toHaveLength(MAX_TABLE_COLS);
    expect(out.columnAlign.slice(0, 3)).toEqual(['auto', 'left', 'auto']);
    expect(out.preset).toBe('lined');
    expect(out.size).toBe(18);
    expect(out.headerBg).toBe('#6d4aff');
    expect(() => render(createElement('table', { props: out }))).not.toThrow();
  });
});
