import type { RuntimeElementDef } from './types';
import { h, num, SHADOWS } from './types';
import { fontStack } from '../fonts';

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
  render(el, { doc }) {
    const p = el.props;
    const node = h(doc, 'div', 'ofs-table', {
      fontFamily: fontStack(p.font),
      color: p.textColor,
      background: p.background,
      borderRadius: `${num(p.radius, 0)}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
    });
    node.textContent = (p.rows[0] ?? []).join(' · ');
    return { node };
  },
  css: `.ofs-table{width:100%;height:100%;overflow:auto}`,
};
