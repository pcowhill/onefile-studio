import { describe, expect, it } from 'vitest';
import { mountPlayer } from './helpers';
import { createElement, createProject } from '../../src/model/factory';
import { THEME_IDS, themeNewElement } from '../../src/model/theme';
import { validateProject } from '../../src/model/validate';
import { renderContent } from '../../src/runtime/mount';
import { NavStore, VarStore } from '../../src/runtime/env';
import type { RenderMode, RuntimeEnv } from '../../src/runtime/env';
import { formatExact, formatShort, formatTick, niceTicks } from '../../src/runtime/elements/chart';
import type { ChartProps } from '../../src/runtime/elements/chart';
import { MAX_CHART_POINTS, MAX_CHART_SERIES } from '../../src/model/propSchemas';
import type { SceneElement } from '../../src/model/types';

function chart(props: Partial<ChartProps> = {}, init: Partial<SceneElement> = {}) {
  return createElement<ChartProps>('chart', { id: 'el_chart', w: 640, h: 400, ...init, props });
}

function play(el: SceneElement) {
  const p = createProject('slides');
  p.pages[0].elements.push(el);
  const m = mountPlayer(p);
  return { ...m, node: m.q(el.id)!.querySelector<HTMLElement>('.ofs-chart')! };
}

function render(el: SceneElement, mode: RenderMode = 'edit') {
  const project = createProject('slides');
  const env: RuntimeEnv = { mode, project, vars: new VarStore([]), nav: new NavStore(), state: new Map(), navigate() {} };
  return renderContent(el, env, document);
}

const hover = (node: Element) => node.dispatchEvent(new Event('pointerover', { bubbles: true }));

describe('chart scales and formatting', () => {
  it('produces rounded ticks that cover the data', () => {
    expect(niceTicks(0, 92, 6).ticks).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(0, 1, 5).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
    const neg = niceTicks(-4500, 23000, 6);
    expect(neg.min).toBeLessThanOrEqual(-4500);
    expect(neg.max).toBeGreaterThanOrEqual(23000);
    expect(neg.ticks).toContain(0);
    // Degenerate input never throws and gives a usable range.
    expect(niceTicks(5, 5).ticks.length).toBeGreaterThan(1);
    expect(niceTicks(0, 0).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(NaN, Infinity).ticks.length).toBeGreaterThan(1);
  });

  it('formats exact, short and tick values with prefix/suffix and negatives', () => {
    expect(formatExact(1234.5, '$')).toBe('$1,234.5');
    expect(formatExact(-12, '', '%')).toBe('−12%');
    expect(formatShort(12500, '$')).toBe('$12.5K');
    expect(formatShort(2_300_000)).toBe('2.3M');
    const t = niceTicks(0, 25000, 6);
    expect(formatTick(20000, t)).toBe('20K');
    expect(formatTick(0, t)).toBe('0');
    expect(formatTick(0.5, niceTicks(0, 1, 5))).toBe('0.50');
  });
});

describe('chart rendering', () => {
  it('renders grouped bars with title, legend, ticks and category labels', () => {
    const { node } = render(chart());
    expect(node.querySelector('.ofs-chart-title')!.textContent).toBe('Monthly visitors');
    expect(node.querySelectorAll('.ofs-chart-bar')).toHaveLength(12);
    expect([...node.querySelectorAll('.ofs-chart-legend-item')].map((e) => e.textContent)).toEqual(['2025', '2026']);
    const ticks = [...node.querySelectorAll('.ofs-chart-tick')].map((t) => t.textContent);
    expect(ticks[0]).toBe('0');
    expect(ticks[ticks.length - 1]).toBe('100');
    expect([...node.querySelectorAll('.ofs-chart-cat')].map((t) => t.textContent)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
    expect(node.querySelectorAll('.ofs-chart-grid').length).toBeGreaterThan(2);
    // Static modes have no interactive buttons.
    expect(node.querySelector('button')).toBeNull();
  });

  it('renders a line chart with one path and a point per value', () => {
    const { node } = render(chart({ chartType: 'line', preset: 'clean' }));
    expect(node.querySelectorAll('.ofs-chart-line')).toHaveLength(2);
    expect(node.querySelectorAll('.ofs-chart-pt')).toHaveLength(12);
    expect(node.querySelector('.ofs-chart-area')).toBeNull();
    const soft = render(chart({ chartType: 'line', preset: 'soft' })).node;
    expect(soft.querySelectorAll('.ofs-chart-area')).toHaveLength(2);
    expect(soft.querySelector('.ofs-chart-line')!.getAttribute('d')).toContain('C');
  });

  it('shows value labels, hides grid and legend on request', () => {
    const { node } = render(chart({ showValues: true, showGrid: false, showLegend: false, valuePrefix: '$' }));
    const values = [...node.querySelectorAll('.ofs-chart-value')].map((v) => v.textContent);
    expect(values).toContain('$92');
    expect(node.querySelector('.ofs-chart-grid')).toBeNull();
    expect(node.querySelector('.ofs-chart-legend')).toBeNull();
  });

  it('draws negative bars below the zero line', () => {
    const { node } = render(chart({ labels: ['A', 'B'], series: [{ name: 'P&L', values: [10, -5] }] }));
    const bars = [...node.querySelectorAll<SVGPathElement>('.ofs-chart-bar')];
    expect(bars[1].classList.contains('ofs-neg')).toBe(true);
    const ticks = [...node.querySelectorAll('.ofs-chart-tick')].map((t) => t.textContent);
    expect(ticks[0]).toMatch(/^−/);
  });

  it('handles empty and degenerate data without errors', () => {
    expect(render(chart({ labels: [], series: [] })).node.querySelector('.ofs-chart-empty')!.textContent).toMatch(/Add data/);
    expect(() => render(chart({ labels: ['A'], series: [{ name: '', values: [0] }] }))).not.toThrow();
    expect(() => render(chart({ chartType: 'line', labels: ['A'], series: [{ name: 'x', values: [3] }] }))).not.toThrow();
    // Bad runtime values (as if the props bypassed validation).
    const bad = chart({ labels: ['A', 'B'], series: [{ name: 'x', values: [NaN, Infinity] as number[] }], palette: [] });
    expect(() => render(bad)).not.toThrow();
    expect(() => render(chart(), 'thumb')).not.toThrow();
    for (const [w, h] of [
      [60, 40],
      [2000, 1200],
      [120, 900],
    ])
      expect(() => render(chart({}, { w, h }))).not.toThrow();
  });

  it('thins out or rotates crowded category labels', () => {
    const labels = Array.from({ length: 60 }, (_, i) => `Category number ${i + 1}`);
    const { node } = render(chart({ labels, series: [{ name: 'A', values: labels.map((_, i) => i) }] }));
    const cats = node.querySelectorAll('.ofs-chart-cat');
    expect(cats.length).toBeLessThan(60);
    expect(cats.length).toBeGreaterThan(3);
    expect(cats[0].getAttribute('transform')).toMatch(/rotate/);
  });

  it('renders in all four themes', () => {
    for (const theme of THEME_IDS) {
      for (const chartType of ['bar', 'line'] as const) {
        const el = themeNewElement(chart({ chartType }), theme);
        const { node } = render(el);
        expect(node.querySelectorAll(chartType === 'bar' ? '.ofs-chart-bar' : '.ofs-chart-pt').length, theme).toBe(12);
        expect(node.style.background).not.toBe('');
      }
    }
  });
});

describe('chart interactivity (play mode)', () => {
  it('shows a tooltip with series name, label and exact value on hover, and dims the other bars', () => {
    const { node } = play(chart({ valuePrefix: '$', series: [{ name: 'Revenue', values: [1234.5, 2, 3, 4, 5, 6] }] }));
    const hits = node.querySelectorAll('.ofs-chart-hit');
    expect(hits).toHaveLength(6);
    hover(hits[0]);
    const tip = node.querySelector('.ofs-chart-tip')!;
    expect(tip.classList.contains('ofs-show')).toBe(true);
    expect(tip.textContent).toContain('Jan');
    expect(tip.textContent).toContain('Revenue');
    expect(tip.textContent).toContain('$1,234.5');
    expect(node.querySelector('.ofs-chart-marks')!.classList.contains('ofs-chart-hovering')).toBe(true);
    expect(node.querySelectorAll('.ofs-chart-bar.ofs-on')).toHaveLength(1);
    node.querySelector('svg')!.dispatchEvent(new Event('pointerleave'));
    expect(tip.classList.contains('ofs-show')).toBe(false);
  });

  it('line tooltips list every visible series at the hovered label', () => {
    const { node } = play(chart({ chartType: 'line' }));
    hover(node.querySelectorAll('.ofs-chart-hit')[5]);
    const tip = node.querySelector('.ofs-chart-tip')!;
    expect(tip.querySelector('.ofs-chart-tip-label')!.textContent).toBe('Jun');
    expect([...tip.querySelectorAll('.ofs-chart-tip-row')].map((r) => r.textContent)).toEqual(['702025', '922026']);
    expect(node.querySelectorAll('.ofs-chart-pt.ofs-on')).toHaveLength(2);
  });

  it('legend buttons hide and show a series and rescale', () => {
    const { node } = play(chart());
    const buttons = node.querySelectorAll<HTMLButtonElement>('button.ofs-chart-legend-item');
    expect(buttons).toHaveLength(2);
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    buttons[1].click();
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    expect(node.querySelectorAll('.ofs-chart-bar')).toHaveLength(6);
    expect([...node.querySelectorAll('.ofs-chart-bar')].every((b) => (b as SVGElement).dataset.s === '0')).toBe(true);
    // The axis rescales to the remaining data (max 70, was 92).
    const ticks = [...node.querySelectorAll('.ofs-chart-tick')].map((t) => t.textContent);
    expect(Number(ticks[ticks.length - 1])).toBeGreaterThanOrEqual(70);
    expect(Number(ticks[ticks.length - 1])).toBeLessThan(92);
    // Colours follow the series, not their position.
    expect(node.querySelector('.ofs-chart-bar')!.getAttribute('fill')).toBe('#6d4aff');
    hover(node.querySelectorAll('.ofs-chart-hit')[0]);
    expect(node.querySelector('.ofs-chart-tip')!.textContent).toContain('2025');
    buttons[1].click();
    expect(node.querySelectorAll('.ofs-chart-bar')).toHaveLength(12);
  });

  it('legend toggling can be turned off', () => {
    const { node } = play(chart({ legendToggle: false }));
    expect(node.querySelector('button.ofs-chart-legend-item')).toBeNull();
    expect(node.querySelectorAll('.ofs-chart-legend-item')).toHaveLength(2);
  });

  it('arrow keys move through values and show the tooltip', () => {
    const { node } = play(chart());
    const plot = node.querySelector('svg')!;
    expect(plot.getAttribute('tabindex')).toBe('0');
    plot.dispatchEvent(new Event('focus'));
    const tip = node.querySelector('.ofs-chart-tip')!;
    expect(tip.textContent).toContain('32');
    const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    plot.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(tip.textContent).toContain('45');
    expect(tip.textContent).toContain('2026');
  });

  it('provides an accessible data table', () => {
    const { node } = play(chart());
    const table = node.querySelector('table.ofs-chart-sr')!;
    expect(table.querySelectorAll('tr')).toHaveLength(7);
    expect(table.textContent).toContain('92');
  });
});

describe('chart props validation', () => {
  const roundTrip = (props: Record<string, unknown>) => {
    const p = createProject('slides');
    const el = chart();
    (el as unknown as { props: unknown }).props = props;
    p.pages[0].elements.push(el);
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('invalid');
    return r.project.pages[0].elements[0].props as unknown as ChartProps;
  };

  it('keeps valid chart props unchanged', () => {
    const el = chart({ chartType: 'line', preset: 'bold', valuePrefix: '$', xLabel: 'Week' });
    const p = createProject('slides');
    p.pages[0].elements.push(el);
    const r = validateProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok && r.project.pages[0].elements[0].props).toEqual(el.props);
  });

  it('sanitises hostile input', () => {
    const huge = Array.from({ length: 5000 }, (_, i) => i);
    const out = roundTrip({
      chartType: 'pie<script>',
      preset: 42,
      labels: [...huge.map(String), { evil: true }],
      series: [...Array.from({ length: 50 }, () => ({ name: 'x'.repeat(1000), values: [NaN, 'abc', null, '12', 1e300, -Infinity, ...huge] })), 'not a series'],
      palette: ['red;background:url(x)', '#123456', 'javascript:alert(1)'],
      valuePrefix: 'x'.repeat(10000),
      title: { toString: 'no' },
      showLegend: 'yes',
    });
    expect(out.chartType).toBe('bar');
    expect(out.preset).toBe('soft');
    expect(out.labels).toHaveLength(MAX_CHART_POINTS);
    expect(out.series).toHaveLength(MAX_CHART_SERIES);
    expect(out.series[0].name.length).toBeLessThanOrEqual(60);
    expect(out.series[0].values).toHaveLength(MAX_CHART_POINTS);
    expect(out.series[0].values.slice(0, 6)).toEqual([0, 0, 0, 12, 1e12, 0]);
    expect(out.series.every((s) => s.values.every(Number.isFinite))).toBe(true);
    expect(out.palette).toEqual(['#123456']);
    expect(out.valuePrefix.length).toBeLessThanOrEqual(12);
    expect(out.title).toBe('Monthly visitors');
    expect(out.showLegend).toBe(true);
    // And it still renders.
    expect(() => render(createElement('chart', { props: out }))).not.toThrow();
  });

  it('pads short series to the number of labels', () => {
    const out = roundTrip({ labels: ['a', 'b', 'c'], series: [{ name: 's', values: [1] }] });
    expect(out.series[0].values).toEqual([1, 0, 0]);
    const notArr = roundTrip({ labels: 'abc', series: 'nope' });
    expect(Array.isArray(notArr.labels)).toBe(true);
    expect(Array.isArray(notArr.series)).toBe(true);
  });
});
