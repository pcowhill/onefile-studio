import { describe, expect, it } from 'vitest';
import { chartToGrid, detectDelimiter, gridToChart, gridToTable, parseDelimited, pasteBlock, toDelimited, trimGrid } from '../../src/io/csv';
import { MAX_CHART_POINTS, MAX_CHART_SERIES, MAX_TABLE_ROWS } from '../../src/model/propSchemas';

describe('CSV / TSV parsing', () => {
  it('parses simple CSV and pads ragged rows', () => {
    expect(parseDelimited('a,b,c\n1,2\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', ''],
    ]);
  });

  it('handles quotes, escaped quotes, delimiters and newlines inside quotes', () => {
    const text = 'name,quote\r\n"Smith, Jo","She said ""hi"""\r\n"multi\nline",x';
    expect(parseDelimited(text)).toEqual([
      ['name', 'quote'],
      ['Smith, Jo', 'She said "hi"'],
      ['multi\nline', 'x'],
    ]);
  });

  it('supports CR-only line endings, a BOM, blank trailing lines and empty quoted fields', () => {
    expect(parseDelimited('﻿a;b\r1;""\r\r\n\n')).toEqual([
      ['a', 'b'],
      ['1', ''],
    ]);
  });

  it('auto-detects the delimiter', () => {
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(detectDelimiter('a;b;c\n1,5;2,5;3')).toBe(';');
    expect(detectDelimiter('"x,y"|b\n1|2')).toBe('|');
    expect(detectDelimiter('just one column')).toBe(',');
    // Spreadsheet paste: tabs, with commas inside numbers.
    expect(parseDelimited('Month\tSales\nJan\t1,200\nFeb\t1,500')).toEqual([
      ['Month', 'Sales'],
      ['Jan', '1,200'],
      ['Feb', '1,500'],
    ]);
  });

  it('trims unquoted whitespace but keeps it inside quotes', () => {
    expect(parseDelimited('a , b,"  c  " ')).toEqual([['a', 'b', '  c  ']]);
  });

  it('respects row and column limits and survives garbage', () => {
    const big = Array.from({ length: 500 }, (_, i) => `${i},x`).join('\n');
    expect(parseDelimited(big, undefined, { rows: 10 })).toHaveLength(10);
    expect(parseDelimited('1,2,3,4,5', ',', { cols: 2 })).toEqual([['1', '2']]);
    expect(parseDelimited('')).toEqual([]);
    expect(parseDelimited('"unterminated')).toEqual([['unterminated']]);
    expect(parseDelimited(null as unknown as string)).toEqual([]);
  });

  it('round-trips through toDelimited', () => {
    const grid = [
      ['a', 'b,c', 'say "x"'],
      ['line\nbreak', ' pad', ''],
    ];
    expect(parseDelimited(toDelimited(grid))).toEqual(grid);
    expect(parseDelimited(toDelimited(grid, '\t'), '\t')).toEqual(grid);
  });
});

describe('grid helpers', () => {
  it('pastes a block, growing the grid within limits', () => {
    const { grid, clipped } = pasteBlock([['a', 'b']], [['1', '2', '3'], ['4']], 0, 1, 10, 3);
    expect(grid).toEqual([
      ['a', '1', '2'],
      ['', '4', ''],
    ]);
    expect(clipped).toBe(true);
  });

  it('trims empty trailing rows and columns', () => {
    expect(
      trimGrid([
        ['a', '', ''],
        ['', 'b', ' '],
        ['', '', ''],
      ]),
    ).toEqual([
      ['a', ''],
      ['', 'b'],
    ]);
  });

  it('converts chart props to a grid and back', () => {
    const props = {
      labels: ['Jan', 'Feb'],
      series: [
        { name: 'A', values: [1, 2.5] },
        { name: 'B', values: [-3, 4] },
      ],
    };
    const grid = chartToGrid(props);
    expect(grid).toEqual([
      ['', 'A', 'B'],
      ['Jan', '1', '-3'],
      ['Feb', '2.5', '4'],
    ]);
    const back = gridToChart(grid);
    expect({ labels: back.labels, series: back.series }).toEqual(props);
    expect(back.invalid).toEqual([]);
  });

  it('flags non-numbers (treated as 0), names unnamed series and drops blank rows', () => {
    const r = gridToChart([
      ['', 'Sales', ''],
      ['Jan', '$1,200', '7'],
      ['', '', ''],
      ['Feb', 'lots', ''],
    ]);
    expect(r.labels).toEqual(['Jan', 'Feb']);
    expect(r.series).toEqual([
      { name: 'Sales', values: [1200, 0] },
      { name: 'Series 2', values: [7, 0] },
    ]);
    expect(r.invalid).toEqual([[3, 1]]);
  });

  it('applies chart and table limits', () => {
    const wide = [Array.from({ length: 40 }, (_, i) => (i ? `S${i}` : ''))];
    for (let r = 0; r < 300; r++) wide.push(Array.from({ length: 40 }, (_, i) => (i ? String(r) : `L${r}`)));
    const c = gridToChart(wide);
    expect(c.labels).toHaveLength(MAX_CHART_POINTS);
    expect(c.series).toHaveLength(MAX_CHART_SERIES);
    const t = gridToTable(Array.from({ length: 1000 }, () => ['x', 'y']));
    expect(t).toHaveLength(MAX_TABLE_ROWS);
    expect(gridToTable([])).toEqual([['']]);
  });
});
