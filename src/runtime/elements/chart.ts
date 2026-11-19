import type { RuntimeElementDef } from './types';
import { h, num, SHADOWS } from './types';
import { fontStack } from '../fonts';

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartProps {
  chartType: 'bar' | 'line';
  title: string;
  /** Category labels (x axis). */
  labels: string[];
  series: ChartSeries[];
  /** Series colours (index-matched; cycles). */
  palette: string[];
  /** "clean" (thin, airy), "soft" (rounded, area fills) or "bold" (thick, high contrast). */
  preset: 'clean' | 'soft' | 'bold';
  showLegend: boolean;
  /** Viewers can click legend entries to hide/show series. */
  legendToggle: boolean;
  showValues: boolean;
  showGrid: boolean;
  xLabel: string;
  yLabel: string;
  valuePrefix: string;
  valueSuffix: string;
  font: string;
  textColor: string;
  mutedColor: string;
  gridColor: string;
  background: string;
  radius: number;
  shadow: string;
}

export const chartDef: RuntimeElementDef<ChartProps> = {
  id: 'chart',
  defaults: () => ({
    chartType: 'bar',
    title: 'Monthly visitors',
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    series: [
      { name: '2025', values: [32, 41, 38, 52, 61, 70] },
      { name: '2026', values: [45, 52, 58, 66, 79, 92] },
    ],
    palette: ['#6d4aff', '#ff7eb3', '#ffb100', '#00b894', '#3d8bff', '#ff6b6b'],
    preset: 'soft',
    showLegend: true,
    legendToggle: true,
    showValues: false,
    showGrid: true,
    xLabel: '',
    yLabel: '',
    valuePrefix: '',
    valueSuffix: '',
    font: 'rounded',
    textColor: '#1d1b2c',
    mutedColor: '#4b4766',
    gridColor: '#e4e0f5',
    background: '#ffffff',
    radius: 24,
    shadow: 'soft',
  }),
  render(el, { doc }) {
    const p = el.props;
    const node = h(doc, 'div', 'ofs-chart', {
      fontFamily: fontStack(p.font),
      color: p.textColor,
      background: p.background,
      borderRadius: `${num(p.radius, 0)}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
    });
    node.textContent = p.title;
    return { node };
  },
  css: `.ofs-chart{width:100%;height:100%;overflow:hidden}`,
};
