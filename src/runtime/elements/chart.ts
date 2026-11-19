import type { RuntimeElementDef } from './types';
import { h, num, svg, SHADOWS } from './types';
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

const DEFAULT_PALETTE = ['#6d4aff', '#ff7eb3', '#ffb100', '#00b894', '#3d8bff', '#ff6b6b'];
const PRESETS = new Set(['clean', 'soft', 'bold']);
const MINUS = '−';

// ---------------------------------------------------------------- numbers

/** A "nice" step (1, 2, 2.5 or 5 × 10^n) close to `raw`. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const e = Math.floor(Math.log10(raw));
  const f = raw / Math.pow(10, e);
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * Math.pow(10, e);
}

export interface Ticks {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/** Rounded axis ticks covering [lo, hi] with roughly `count` ticks. */
export function niceTicks(lo: number, hi: number, count = 5): Ticks {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) [lo, hi] = [0, 1];
  if (lo > hi) [lo, hi] = [hi, lo];
  if (lo === hi) {
    const d = lo === 0 ? 1 : Math.abs(lo) * 0.5;
    if (lo >= 0 && lo - d < 0) {
      hi = lo + d;
      lo = 0;
    } else {
      lo -= d;
      hi += d;
    }
  }
  const step = niceStep((hi - lo) / Math.max(1, count - 1));
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  const n = Math.min(50, Math.round((max - min) / step));
  for (let i = 0; i <= n; i++) {
    const t = Math.round((min + i * step) / step) * step;
    ticks.push(Math.abs(t) < step * 1e-9 ? 0 : Number(t.toPrecision(12)));
  }
  return { min: ticks[0], max: ticks[ticks.length - 1], step, ticks };
}

function decimalsFor(step: number): number {
  for (let k = 0; k <= 6; k++) {
    const v = step * Math.pow(10, k);
    if (Math.abs(Math.round(v) - v) < 1e-6) return k;
  }
  return 6;
}

const UNITS: Array<[number, string]> = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

function withAffixes(v: number, body: string, prefix: string, suffix: string): string {
  return `${v < 0 ? MINUS : ''}${prefix}${body}${suffix}`;
}

/** Exact value for tooltips: every digit the author typed, with prefix/suffix. */
export function formatExact(v: number, prefix = '', suffix = ''): string {
  return withAffixes(v, Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 10 }), prefix, suffix);
}

/** Short value for labels: 1,234 · 12.5K · 3.2M. */
export function formatShort(v: number, prefix = '', suffix = ''): string {
  const a = Math.abs(v);
  for (const [u, s] of UNITS) {
    if (a >= u * 10 || (u >= 1e6 && a >= u)) {
      return withAffixes(v, `${(a / u).toLocaleString('en-US', { maximumFractionDigits: 1 })}${s}`, prefix, suffix);
    }
  }
  return withAffixes(v, a.toLocaleString('en-US', { maximumFractionDigits: 2 }), prefix, suffix);
}

/** Axis tick label: compact once the axis reaches 10,000, one style per axis. */
export function formatTick(v: number, t: Ticks, prefix = '', suffix = ''): string {
  if (v === 0) return `${prefix}0${suffix}`;
  const top = Math.max(Math.abs(t.min), Math.abs(t.max));
  for (const [u, s] of UNITS) {
    if (top >= u * 10 || (u >= 1e6 && top >= u)) {
      const d = decimalsFor(t.step / u);
      return withAffixes(v, `${(Math.abs(v) / u).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${s}`, prefix, suffix);
    }
  }
  const d = decimalsFor(t.step);
  return withAffixes(v, Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }), prefix, suffix);
}

// ---------------------------------------------------------------- geometry

const r2 = (v: number) => Math.round(v * 100) / 100;

function linePath(pts: Array<[number, number]>): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join('');
}

/** Monotone cubic interpolation (no overshoot above/below the data). */
function smoothPath(pts: Array<[number, number]>): string {
  const n = pts.length;
  if (n < 3) return linePath(pts);
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    m.push(dx ? (pts[i + 1][1] - pts[i][1]) / dx : 0);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const dx = (x1 - x0) / 3;
    d += `C${r2(x0 + dx)} ${r2(y0 + t[i] * dx)} ${r2(x1 - dx)} ${r2(y1 - t[i + 1] * dx)} ${r2(x1)} ${r2(y1)}`;
  }
  return d;
}

/** Bar with rounded data-end and a square baseline end. */
function barPath(x: number, w: number, y0: number, y1: number, radius: number): string {
  const hgt = Math.abs(y0 - y1);
  const r = Math.max(0, Math.min(radius, w / 2, hgt));
  const up = y1 <= y0;
  const s = up ? 1 : -1;
  if (r <= 0.01) return `M${r2(x)} ${r2(y0)}V${r2(y1)}H${r2(x + w)}V${r2(y0)}Z`;
  return (
    `M${r2(x)} ${r2(y0)}V${r2(y1 + s * r)}` +
    `Q${r2(x)} ${r2(y1)} ${r2(x + r)} ${r2(y1)}` +
    `H${r2(x + w - r)}Q${r2(x + w)} ${r2(y1)} ${r2(x + w)} ${r2(y1 + s * r)}` +
    `V${r2(y0)}Z`
  );
}

/** Rough text width (no layout available in edit/thumb mode or in exports before paint). */
const textW = (s: string, fs: number) => [...s].length * fs * 0.58;

function truncate(s: string, maxW: number, fs: number): string {
  const chars = [...s];
  const max = Math.max(1, Math.floor(maxW / (fs * 0.58) + 1e-6));
  return chars.length <= max ? s : `${chars.slice(0, Math.max(1, max - 1)).join('')}…`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------- element

interface Series {
  name: string;
  values: number[];
  color: string;
  index: number;
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
  render(el, { doc, env, onCleanup }) {
    const p = el.props;
    const play = env.mode === 'play';
    const W = Math.max(60, num(el.w, 640));
    const H = Math.max(40, num(el.h, 400));
    const type: 'bar' | 'line' = p.chartType === 'line' ? 'line' : 'bar';
    const preset = (PRESETS.has(p.preset) ? p.preset : 'soft') as ChartProps['preset'];
    const prefix = String(p.valuePrefix ?? '').slice(0, 24);
    const suffix = String(p.valueSuffix ?? '').slice(0, 24);
    const tickSuffix = suffix.length <= 4 ? suffix : '';
    const palette = Array.isArray(p.palette) && p.palette.length ? p.palette.map(String) : DEFAULT_PALETTE;
    const labels = (Array.isArray(p.labels) ? p.labels : []).map((l) => String(l ?? ''));
    const n = labels.length;
    const allSeries: Series[] = (Array.isArray(p.series) ? p.series : [])
      .filter((s) => s && typeof s === 'object')
      .map((s, i) => ({
        name: String(s.name ?? '') || `Series ${i + 1}`,
        values: Array.from({ length: n }, (_, j) => {
          const v = Number(Array.isArray(s.values) ? s.values[j] : 0);
          return Number.isFinite(v) ? v : 0;
        }),
        color: palette[i % palette.length],
        index: i,
      }));
    const textColor = p.textColor || '#1d1b2c';
    const muted = p.mutedColor || '#4b4766';
    const grid = p.gridColor || '#e4e0f5';
    const surface = p.background && p.background !== 'transparent' ? p.background : '';

    const node = h(doc, 'div', `ofs-chart ofs-chart-is-${type} ofs-chart-${preset}`, {
      fontFamily: fontStack(p.font),
      color: textColor,
      background: p.background,
      borderRadius: `${Math.max(0, num(p.radius, 0))}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
    });
    node.style.setProperty('--ofs-chart-muted', muted);
    node.style.setProperty('--ofs-chart-surface', surface || 'transparent');

    // Base type size scales with the box so charts stay legible at any size.
    const base = clamp(Math.min(W / 38, H / 24), 9, 18);
    const pad = clamp(Math.min(W, H) * 0.06, 8, 28);
    const tickFs = Math.max(8, base * 0.78);
    const titleFs = base * 1.3;
    const legFs = Math.max(8, base * 0.82);
    const innerW = W - pad * 2;
    const scaleStroke = clamp(base / 15, 0.75, 1.3);

    const stateKey = `${el.id}:hidden`;
    const hidden = new Set<number>(play ? ((env.state.get(stateKey) as number[] | undefined) ?? []) : []);

    // ---------------- header: title + legend
    const title = String(p.title ?? '').trim();
    const titleH = title ? titleFs * 1.3 : 0;
    const legendOn = !!p.showLegend && allSeries.length > 0 && n > 0;
    const legendToggle = legendOn && play && !!p.legendToggle;
    const legItemW = (s: Series) => legFs * 2.2 + textW(s.name, legFs) + (legendToggle ? legFs * 0.6 : 0);
    const legGap = legFs * 0.5;
    const legRowH = legFs * 1.9;
    const legTotal = legendOn ? allSeries.reduce((a, s) => a + legItemW(s), 0) + legGap * (allSeries.length - 1) : 0;
    const sameRow = legendOn && !!title && textW(title, titleFs) + base * 1.5 + legTotal <= innerW;
    let legRows = 0;
    if (legendOn && !sameRow) {
      let x = 0;
      legRows = 1;
      for (const s of allSeries) {
        const w = Math.min(innerW, legItemW(s));
        if (x > 0 && x + w > innerW) {
          legRows++;
          x = 0;
        }
        x += w + legGap;
      }
    }
    const headerH = sameRow ? Math.max(titleH, legRowH) : titleH + (title && legendOn ? base * 0.3 : 0) + legRows * legRowH;

    if (title) {
      const t = h(doc, 'div', 'ofs-chart-title', {
        left: `${pad}px`,
        top: `${pad + (sameRow ? (headerH - titleH) / 2 : 0)}px`,
        width: `${sameRow ? innerW - legTotal - base : innerW}px`,
        height: `${titleH}px`,
        lineHeight: `${titleH}px`,
        fontSize: `${titleFs}px`,
      });
      t.textContent = title;
      node.appendChild(t);
    }

    const legendItems: HTMLElement[] = [];
    if (legendOn) {
      const legend = h(doc, 'div', 'ofs-chart-legend', {
        left: `${pad}px`,
        top: `${pad + (sameRow ? (headerH - legRowH) / 2 : titleH + (title ? base * 0.3 : 0))}px`,
        width: `${innerW}px`,
        fontSize: `${legFs}px`,
        justifyContent: sameRow ? 'flex-end' : 'flex-start',
        columnGap: `${legGap}px`,
      });
      for (const s of allSeries) {
        const item = h(doc, legendToggle ? 'button' : 'span', 'ofs-chart-legend-item', { height: `${legRowH}px` });
        const sw = h(doc, 'span', `ofs-chart-key ofs-chart-key-${type}`, { background: s.color });
        const name = h(doc, 'span', 'ofs-chart-legend-name');
        name.textContent = s.name;
        item.append(sw, name);
        item.dataset.series = String(s.index);
        if (legendToggle) {
          const b = item as HTMLButtonElement;
          b.type = 'button';
          b.title = `Show or hide ${s.name}`;
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            if (hidden.has(s.index)) hidden.delete(s.index);
            else hidden.add(s.index);
            env.state.set(stateKey, [...hidden]);
            syncLegend();
            draw();
          });
        }
        legendItems.push(item);
        legend.appendChild(item);
      }
      node.appendChild(legend);
    }
    const syncLegend = () => {
      legendItems.forEach((item, i) => {
        const off = hidden.has(allSeries[i].index);
        item.classList.toggle('ofs-off', off);
        if (legendToggle) item.setAttribute('aria-pressed', String(!off));
      });
      node.dataset.hidden = [...hidden].sort((a, b) => a - b).join(',');
    };
    syncLegend();

    // ---------------- plot (SVG) + tooltip
    const plot = svg(doc, 'svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'ofs-chart-svg', role: 'img' });
    plot.setAttribute(
      'aria-label',
      `${type === 'bar' ? 'Bar' : 'Line'} chart${title ? `: ${title}` : ''}${play ? '. Use the arrow keys to read values.' : ''}`,
    );
    node.appendChild(plot);
    const tip = h(doc, 'div', 'ofs-chart-tip', {
      fontSize: `${clamp(base * 0.85, 10, 16)}px`,
      maxWidth: `${W - 8}px`,
      background: textColor,
      color: surface || '#ffffff',
    });
    tip.setAttribute('role', 'status');
    tip.setAttribute('aria-live', 'polite');
    node.appendChild(tip);
    const empty = h(doc, 'div', 'ofs-chart-empty', { fontSize: `${clamp(base * 0.9, 10, 16)}px`, color: muted });
    node.appendChild(empty);

    const plotTopBase = pad + headerH + (headerH ? base * 0.9 : 0);
    const xTitleH = p.xLabel ? tickFs * 1.9 : 0;
    const yTitleW = p.yLabel ? tickFs * 1.8 : 0;
    const valFs0 = Math.max(7, tickFs * 0.92);

    // Interaction targets of the current drawing.
    type Item = { s: number; i: number; x: number; y: number; on: SVGElement[] };
    let items: Item[] = [];
    let columns: Array<{ x: number; y: number; on: SVGElement[] }> = [];
    let guide: SVGLineElement | null = null;
    let marks: SVGGElement | null = null;
    let cursor = -1;

    const T = (attrs: Record<string, string | number>, text: string, cls = '') => {
      const t = svg(doc, 'text', attrs);
      if (cls) t.setAttribute('class', cls);
      t.textContent = text;
      return t;
    };

    function draw() {
      hideTip();
      while (plot.firstChild) plot.removeChild(plot.firstChild);
      items = [];
      columns = [];
      cursor = -1;
      const visible = allSeries.filter((s) => !hidden.has(s.index));
      const noData = n === 0 || allSeries.length === 0;
      empty.textContent = noData ? (play ? 'No data yet' : 'Add data to draw this chart') : visible.length ? '' : 'All series are hidden';
      empty.style.display = empty.textContent ? '' : 'none';
      empty.style.top = `${plotTopBase}px`;
      if (noData) return;
      const values = visible.flatMap((s) => s.values);
      let lo = values.length ? Math.min(...values) : 0;
      let hi = values.length ? Math.max(...values) : 1;
      const includeZero = type === 'bar' || !values.length || (lo >= 0 ? lo <= hi * 0.5 : hi <= 0 ? hi >= lo * 0.5 : true);
      if (includeZero) {
        lo = Math.min(lo, 0);
        hi = Math.max(hi, 0);
      }
      if (lo === hi && lo === 0) hi = 1;

      const plotTop = plotTopBase + (p.showValues ? tickFs * 1.3 : tickFs * 0.6);
      const bottomBase = pad + xTitleH;
      const countFor = (ph: number) => clamp(Math.round(ph / (tickFs * (preset === 'clean' ? 3.6 : 3))) + 1, 2, 9);
      let ticks = niceTicks(lo, hi, countFor(H - plotTop - bottomBase - tickFs * 1.8));
      const tickW = (t: Ticks) => Math.max(...t.ticks.map((v) => textW(formatTick(v, t, prefix, tickSuffix), tickFs)));
      let left = pad + yTitleW + tickW(ticks) + tickFs * 0.7;
      const right = pad;
      let plotW = Math.max(10, W - left - right);
      let band = plotW / n;

      // Category labels: horizontal → thinned → rotated.
      const longest = Math.max(...labels.map((l) => textW(l, tickFs)));
      let every = 1;
      let rotate = false;
      if (longest > band * 0.92) {
        const everyH = Math.ceil((longest + tickFs) / band);
        if (everyH <= 2 || longest <= tickFs * 3.5) every = everyH;
        else {
          rotate = true;
          every = Math.max(1, Math.ceil((tickFs * 1.5) / band));
        }
      }
      const maxRotW = Math.min(longest, H * 0.3, tickFs * 14);
      const xTickH = rotate ? maxRotW * Math.sin(Math.PI / 4.5) + tickFs * 1.6 : tickFs * 1.9;
      const plotH = Math.max(10, H - plotTop - bottomBase - xTickH);
      const finalTicks = niceTicks(lo, hi, countFor(plotH));
      if (finalTicks.ticks.join() !== ticks.ticks.join()) {
        ticks = finalTicks;
        left = Math.max(left, pad + yTitleW + tickW(ticks) + tickFs * 0.7);
        plotW = Math.max(10, W - left - right);
        band = plotW / n;
      }
      const { min, max } = ticks;
      const y = (v: number) => plotTop + ((max - v) / (max - min || 1)) * plotH;
      const base0 = y(clamp(0, min, max));
      const plotBottom = plotTop + plotH;

      // Grid + y ticks
      const axis = svg(doc, 'g', { class: 'ofs-chart-axis' });
      for (const v of ticks.ticks) {
        const yy = r2(y(v));
        if (p.showGrid && v !== 0)
          axis.appendChild(svg(doc, 'line', { x1: left, x2: W - right, y1: yy, y2: yy, stroke: grid, 'stroke-width': 1, class: 'ofs-chart-grid' }));
        axis.appendChild(
          T(
            { x: r2(left - tickFs * 0.7), y: yy, 'text-anchor': 'end', 'dominant-baseline': 'central', 'font-size': r2(tickFs), fill: muted },
            formatTick(v, ticks, prefix, tickSuffix),
            'ofs-chart-tick',
          ),
        );
      }
      // Baseline (zero line, or the bottom edge).
      axis.appendChild(
        svg(doc, 'line', {
          x1: left,
          x2: W - right,
          y1: r2(base0),
          y2: r2(base0),
          stroke: preset === 'bold' ? textColor : muted,
          'stroke-opacity': preset === 'bold' ? 0.75 : 0.45,
          'stroke-width': preset === 'bold' ? 2 : 1,
          class: 'ofs-chart-baseline',
        }),
      );
      // X labels
      labels.forEach((l, i) => {
        if (i % every !== 0) return;
        const cx = left + (i + 0.5) * band;
        const ty = plotBottom + tickFs * 1.25;
        if (rotate) {
          axis.appendChild(
            T(
              {
                x: r2(cx),
                y: r2(plotBottom + tickFs * 0.9),
                'text-anchor': 'end',
                'dominant-baseline': 'central',
                'font-size': r2(tickFs),
                fill: muted,
                transform: `rotate(-40 ${r2(cx)} ${r2(plotBottom + tickFs * 0.9)})`,
              },
              truncate(l, maxRotW, tickFs),
              'ofs-chart-cat',
            ),
          );
        } else {
          axis.appendChild(
            T(
              { x: r2(cx), y: r2(ty), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': r2(tickFs), fill: muted },
              truncate(l, band * every * 0.95, tickFs),
              'ofs-chart-cat',
            ),
          );
        }
      });
      if (p.xLabel)
        axis.appendChild(
          T(
            { x: r2(left + plotW / 2), y: r2(H - pad - tickFs * 0.45), 'text-anchor': 'middle', 'font-size': r2(tickFs), fill: muted, 'font-weight': 700 },
            truncate(String(p.xLabel), plotW, tickFs),
            'ofs-chart-axis-title',
          ),
        );
      if (p.yLabel) {
        const yx = pad + tickFs * 0.75;
        const yy = plotTop + plotH / 2;
        axis.appendChild(
          T(
            {
              x: r2(yx),
              y: r2(yy),
              'text-anchor': 'middle',
              'dominant-baseline': 'central',
              'font-size': r2(tickFs),
              fill: muted,
              'font-weight': 700,
              transform: `rotate(-90 ${r2(yx)} ${r2(yy)})`,
            },
            truncate(String(p.yLabel), plotH, tickFs),
            'ofs-chart-axis-title',
          ),
        );
      }
      plot.appendChild(axis);

      marks = svg(doc, 'g', { class: 'ofs-chart-marks' });
      const labelsG = svg(doc, 'g', { class: 'ofs-chart-values' });
      const hits = svg(doc, 'g', { class: 'ofs-chart-hits' });
      const m = visible.length;
      const valueText = (v: number) => formatShort(v, prefix, suffix);
      const maxValW = (fs: number) => Math.max(0, ...visible.flatMap((s) => s.values.map((v) => textW(valueText(v), fs))));

      if (type === 'bar') {
        const groupFrac = preset === 'bold' ? 0.8 : preset === 'clean' ? 0.64 : 0.72;
        const gap = m > 1 ? clamp(band * 0.03, 1, 4) : 0;
        const cap = base * (preset === 'clean' ? 2.1 : preset === 'soft' ? 2.7 : 3.3);
        const barW = Math.max(1, Math.min(cap, (band * groupFrac - gap * Math.max(0, m - 1)) / Math.max(1, m)));
        const groupW = barW * m + gap * Math.max(0, m - 1);
        const radius = preset === 'clean' ? 2 : preset === 'soft' ? Math.min(barW * 0.38, base * 0.75) : 4;
        let valFs = valFs0;
        const room = Math.max(barW + gap, m === 1 ? band * 0.92 : barW * 1.5);
        while (p.showValues && maxValW(valFs) > room && valFs > 7) valFs -= 0.5;
        const showValues = p.showValues && maxValW(valFs) <= room;
        let k = 0;
        for (let i = 0; i < n; i++) {
          const gx = left + i * band + (band - groupW) / 2;
          visible.forEach((s, j) => {
            const v = s.values[i];
            const x = gx + j * (barW + gap);
            const y1 = y(clamp(v, min, max));
            const path = svg(doc, 'path', { d: barPath(x, barW, base0, y1, radius), fill: s.color, class: `ofs-chart-bar${v < 0 ? ' ofs-neg' : ''}` });
            path.dataset.s = String(s.index);
            path.dataset.i = String(i);
            path.dataset.value = String(v);
            if (play) path.style.animationDelay = `${Math.min(600, k * 28)}ms`;
            marks!.appendChild(path);
            k++;
            items.push({ s: s.index, i, x: x + barW / 2, y: Math.min(y1, base0), on: [path] });
            const hit = svg(doc, 'rect', { x: r2(x - gap / 2), y: r2(plotTop), width: r2(barW + gap), height: r2(plotH), class: 'ofs-chart-hit' });
            hit.dataset.k = String(items.length - 1);
            hits.appendChild(hit);
            if (showValues) {
              labelsG.appendChild(
                T(
                  {
                    x: r2(x + barW / 2),
                    y: r2(v < 0 ? y1 + valFs * 0.95 : y1 - valFs * 0.45),
                    'text-anchor': 'middle',
                    'font-size': r2(valFs),
                    fill: textColor,
                    'font-weight': preset === 'bold' ? 800 : 700,
                  },
                  valueText(v),
                  'ofs-chart-value',
                ),
              );
            }
          });
        }
      } else {
        const sw = (preset === 'clean' ? 2 : preset === 'soft' ? 3 : 4.5) * scaleStroke;
        const pr = (preset === 'clean' ? 3.5 : preset === 'soft' ? 4.5 : 5.5) * scaleStroke;
        const dense = band < pr * 3.2;
        if (dense) node.classList.add('ofs-chart-dense');
        else node.classList.remove('ofs-chart-dense');
        const xs = labels.map((_, i) => left + (i + 0.5) * band);
        const areaBase = base0;
        const pointNodes: SVGElement[][] = labels.map(() => []);
        let valFs = valFs0;
        while (p.showValues && maxValW(valFs) > band * 0.95 && valFs > 7) valFs -= 0.5;
        const valEvery = Math.max(1, Math.ceil((maxValW(valFs) + valFs * 0.5) / band));
        visible.forEach((s) => {
          const pts = s.values.map((v, i) => [xs[i], y(clamp(v, min, max))] as [number, number]);
          const d = preset === 'soft' ? smoothPath(pts) : linePath(pts);
          if (preset === 'soft' && pts.length > 1) {
            const area = svg(doc, 'path', {
              d: `${d}L${r2(pts[pts.length - 1][0])} ${r2(areaBase)}L${r2(pts[0][0])} ${r2(areaBase)}Z`,
              fill: s.color,
              'fill-opacity': visible.length > 1 ? 0.08 : 0.14,
              class: 'ofs-chart-area',
            });
            marks!.appendChild(area);
          }
          if (pts.length > 1) {
            const line = svg(doc, 'path', {
              d,
              fill: 'none',
              stroke: s.color,
              'stroke-width': r2(sw),
              'stroke-linejoin': 'round',
              'stroke-linecap': 'round',
              pathLength: 1,
              class: 'ofs-chart-line',
            });
            line.dataset.s = String(s.index);
            marks!.appendChild(line);
          }
          pts.forEach(([px, py], i) => {
            const c = svg(doc, 'circle', {
              cx: r2(px),
              cy: r2(py),
              r: r2(pr),
              fill: s.color,
              stroke: surface || 'none',
              'stroke-width': surface ? r2(Math.max(1.5, sw * 0.6)) : 0,
              class: 'ofs-chart-pt',
            });
            c.dataset.s = String(s.index);
            c.dataset.i = String(i);
            c.dataset.value = String(s.values[i]);
            if (play) c.style.animationDelay = `${Math.min(900, 250 + i * 25)}ms`;
            marks!.appendChild(c);
            pointNodes[i].push(c);
            if (p.showValues && i % valEvery === 0) {
              const v = s.values[i];
              labelsG.appendChild(
                T(
                  {
                    x: r2(px),
                    y: r2(py - pr - valFs * 0.45),
                    'text-anchor': 'middle',
                    'font-size': r2(valFs),
                    fill: textColor,
                    'font-weight': preset === 'bold' ? 800 : 700,
                  },
                  valueText(v),
                  'ofs-chart-value',
                ),
              );
            }
          });
        });
        guide = svg(doc, 'line', {
          x1: 0,
          x2: 0,
          y1: r2(plotTop),
          y2: r2(plotBottom),
          stroke: muted,
          'stroke-opacity': 0.5,
          'stroke-width': 1,
          class: 'ofs-chart-guide',
        });
        plot.appendChild(guide);
        xs.forEach((x, i) => {
          const top = visible.length ? Math.min(...visible.map((s) => y(clamp(s.values[i], min, max)))) : plotTop;
          columns.push({ x, y: top, on: pointNodes[i] });
          const hit = svg(doc, 'rect', {
            x: r2(x - band / 2),
            y: r2(plotTop - tickFs * 0.6),
            width: r2(band),
            height: r2(plotH + tickFs * 0.6),
            class: 'ofs-chart-hit',
          });
          hit.dataset.k = String(i);
          hits.appendChild(hit);
        });
      }
      plot.appendChild(marks);
      plot.appendChild(labelsG);
      if (play) plot.appendChild(hits);
    }

    // ---------------- tooltip
    function clearOn() {
      plot.querySelectorAll('.ofs-on').forEach((e) => e.classList.remove('ofs-on'));
      marks?.classList.remove('ofs-chart-hovering');
    }
    function hideTip() {
      tip.classList.remove('ofs-show');
      clearOn();
      if (guide) guide.classList.remove('ofs-show');
    }
    function row(s: Series, v: number) {
      const r = h(doc, 'div', 'ofs-chart-tip-row');
      const key = h(doc, 'span', `ofs-chart-tip-key ofs-chart-key-${type}`, { background: s.color });
      const val = h(doc, 'strong', 'ofs-chart-tip-value');
      val.textContent = formatExact(v, prefix, suffix);
      const name = h(doc, 'span', 'ofs-chart-tip-name');
      name.textContent = s.name;
      r.append(key, val, name);
      return r;
    }
    function placeTip(ax: number, ay: number, side: boolean) {
      tip.classList.add('ofs-show');
      const tw = tip.offsetWidth || 140;
      const th = tip.offsetHeight || 56;
      let x: number;
      let yy: number;
      if (side) {
        x = ax + 14 + tw <= W - 4 ? ax + 14 : ax - 14 - tw;
        yy = ay - th / 2;
      } else {
        x = ax - tw / 2;
        yy = ay - th - 12;
        if (yy < 4) yy = ay + 14;
      }
      tip.style.left = `${r2(clamp(x, 4, Math.max(4, W - tw - 4)))}px`;
      tip.style.top = `${r2(clamp(yy, 4, Math.max(4, H - th - 4)))}px`;
    }
    function showItem(k: number) {
      const it = items[k];
      if (!it) return;
      const s = allSeries[it.s];
      clearOn();
      it.on.forEach((e) => e.classList.add('ofs-on'));
      marks?.classList.add('ofs-chart-hovering');
      tip.replaceChildren();
      const head = h(doc, 'div', 'ofs-chart-tip-label');
      head.textContent = labels[it.i];
      tip.append(head, row(s, s.values[it.i]));
      placeTip(it.x, it.y, false);
    }
    function showColumn(i: number) {
      const col = columns[i];
      if (!col) return;
      clearOn();
      col.on.forEach((e) => e.classList.add('ofs-on'));
      marks?.classList.add('ofs-chart-hovering');
      if (guide) {
        guide.setAttribute('x1', String(r2(col.x)));
        guide.setAttribute('x2', String(r2(col.x)));
        guide.classList.add('ofs-show');
      }
      tip.replaceChildren();
      const head = h(doc, 'div', 'ofs-chart-tip-label');
      head.textContent = labels[i];
      tip.appendChild(head);
      for (const s of allSeries) if (!hidden.has(s.index)) tip.appendChild(row(s, s.values[i]));
      placeTip(col.x, col.y, true);
    }
    const show = (k: number) => (type === 'bar' ? showItem(k) : showColumn(k));
    const count = () => (type === 'bar' ? items.length : columns.length);

    draw();

    // Screen-reader data table (all series, exact values).
    if (n && allSeries.length) {
      const table = h(doc, 'table', 'ofs-chart-sr');
      if (title) {
        const cap = h(doc, 'caption');
        cap.textContent = title;
        table.appendChild(cap);
      }
      const hr = h(doc, 'tr');
      hr.appendChild(h(doc, 'th'));
      for (const s of allSeries) {
        const th = h(doc, 'th');
        th.scope = 'col';
        th.textContent = s.name;
        hr.appendChild(th);
      }
      table.appendChild(hr);
      labels.forEach((l, i) => {
        const tr = h(doc, 'tr');
        const th = h(doc, 'th');
        th.scope = 'row';
        th.textContent = l;
        tr.appendChild(th);
        for (const s of allSeries) {
          const td = h(doc, 'td');
          td.textContent = formatExact(s.values[i], prefix, suffix);
          tr.appendChild(td);
        }
        table.appendChild(tr);
      });
      node.appendChild(table);
    }

    if (play) {
      const over = (e: Event) => {
        const t = (e.target as Element | null)?.closest?.('.ofs-chart-hit') as SVGElement | null;
        if (t) {
          cursor = Number(t.dataset.k);
          show(cursor);
        } else hideTip();
      };
      const leave = () => hideTip();
      plot.addEventListener('pointerover', over);
      plot.addEventListener('pointerleave', leave);
      plot.setAttribute('tabindex', '0');
      const key = (e: KeyboardEvent) => {
        const c = count();
        if (!c) return;
        let next: number;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = cursor < 0 ? 0 : Math.min(c - 1, cursor + 1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = cursor < 0 ? 0 : Math.max(0, cursor - 1);
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = c - 1;
        else if (e.key === 'Escape') {
          hideTip();
          return;
        } else return;
        e.preventDefault();
        e.stopPropagation();
        cursor = next;
        show(cursor);
      };
      const focus = () => {
        if (count()) show(cursor < 0 ? (cursor = 0) : cursor);
      };
      plot.addEventListener('keydown', key);
      plot.addEventListener('focus', focus);
      plot.addEventListener('blur', leave);
      onCleanup(() => {
        plot.removeEventListener('pointerover', over);
        plot.removeEventListener('pointerleave', leave);
        plot.removeEventListener('keydown', key);
        plot.removeEventListener('focus', focus);
        plot.removeEventListener('blur', leave);
      });

      // Entrance animation once the chart is on screen (CSS handles reduced motion).
      node.classList.add('ofs-chart-anim');
      const IO = (doc.defaultView as (Window & typeof globalThis) | null)?.IntersectionObserver;
      if (IO) {
        const io = new IO((entries) => {
          if (entries.some((en) => en.isIntersecting)) {
            node.classList.add('ofs-chart-run');
            io.disconnect();
          }
        });
        io.observe(node);
        onCleanup(() => io.disconnect());
      } else node.classList.add('ofs-chart-run');
    }
    return { node };
  },
  css: `.ofs-chart{width:100%;height:100%;overflow:hidden;position:relative;user-select:none;-webkit-user-select:none}
.ofs-chart-svg{position:absolute;left:0;top:0;display:block;overflow:hidden;outline:none}
.ofs-chart-svg:focus-visible{outline:2px solid var(--ofs-chart-muted);outline-offset:-4px;border-radius:inherit}
.ofs-chart-svg text{font-variant-numeric:tabular-nums}
.ofs-chart-title{position:absolute;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:1}
.ofs-chart-legend{position:absolute;display:flex;flex-wrap:wrap;align-items:center;z-index:1;pointer-events:none}
.ofs-chart-legend-item{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:.45em;max-width:100%;color:var(--ofs-chart-muted);font-weight:700;line-height:1;white-space:nowrap;transition:opacity .2s ease}
button.ofs-chart-legend-item{pointer-events:auto;cursor:pointer;padding:0 .35em;border-radius:999px}
button.ofs-chart-legend-item:hover{background:rgba(127,127,127,.12)}
button.ofs-chart-legend-item:focus-visible{outline:2px solid currentColor;outline-offset:1px}
.ofs-chart-legend-name{overflow:hidden;text-overflow:ellipsis}
.ofs-chart-legend-item.ofs-off{opacity:.45}
.ofs-chart-legend-item.ofs-off .ofs-chart-legend-name{text-decoration:line-through}
.ofs-chart-legend-item.ofs-off .ofs-chart-key{background:transparent!important;box-shadow:inset 0 0 0 2px var(--ofs-chart-muted)}
.ofs-chart-key{flex:none;display:inline-block;width:.8em;height:.8em;border-radius:.22em}
.ofs-chart-key-line{width:1.1em;height:.24em;border-radius:1em}
.ofs-chart-soft .ofs-chart-key-bar{border-radius:50%}
.ofs-chart-empty{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-weight:700;text-align:center;padding:12px;pointer-events:none}
.ofs-chart-bar,.ofs-chart-pt,.ofs-chart-area,.ofs-chart-line{transition:opacity .18s ease}
.ofs-chart-hit{fill:transparent;cursor:crosshair}
.ofs-chart-hovering .ofs-chart-bar:not(.ofs-on){opacity:.35}
.ofs-chart-hovering .ofs-chart-bar.ofs-on{filter:brightness(1.06)}
.ofs-chart-hovering .ofs-chart-pt:not(.ofs-on){opacity:.35}
.ofs-chart-pt{transform-box:fill-box;transform-origin:50% 50%}
.ofs-chart-pt.ofs-on{transform:scale(1.45)}
.ofs-chart-dense .ofs-chart-pt{opacity:0}
.ofs-chart-dense .ofs-chart-pt.ofs-on{opacity:1}
.ofs-chart-guide{opacity:0;pointer-events:none}
.ofs-chart-guide.ofs-show{opacity:1}
.ofs-chart-tip{position:absolute;left:0;top:0;z-index:3;pointer-events:none;opacity:0;visibility:hidden;min-width:7em;padding:.55em .8em .6em;border-radius:.7em;background:#1d1b2c;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.22);line-height:1.3;transition:opacity .12s ease}
.ofs-chart-tip.ofs-show{opacity:1;visibility:visible}
.ofs-chart-tip-label{font-weight:700;opacity:.72;font-size:.86em;margin-bottom:.25em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ofs-chart-tip-row{display:flex;align-items:center;gap:.5em;white-space:nowrap}
.ofs-chart-tip-row+.ofs-chart-tip-row{margin-top:.2em}
.ofs-chart-tip-key{flex:none;display:inline-block;width:.9em;height:.22em;border-radius:1em}
.ofs-chart-tip-value{font-weight:800;font-variant-numeric:tabular-nums}
.ofs-chart-tip-name{opacity:.8;overflow:hidden;text-overflow:ellipsis}
.ofs-chart-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
.ofs-chart-anim .ofs-chart-bar{transform-box:fill-box;transform-origin:50% 100%;animation:ofs-chart-grow .75s cubic-bezier(.22,1,.36,1) both paused}
.ofs-chart-anim .ofs-chart-bar.ofs-neg{transform-origin:50% 0}
.ofs-chart-anim .ofs-chart-line{stroke-dasharray:1 1;animation:ofs-chart-draw 1.1s cubic-bezier(.45,0,.2,1) both paused}
.ofs-chart-anim .ofs-chart-area,.ofs-chart-anim .ofs-chart-value{animation:ofs-chart-fade .6s ease .45s backwards paused}
.ofs-chart-anim .ofs-chart-pt{animation:ofs-chart-fade .35s ease backwards paused}
.ofs-chart-run .ofs-chart-bar,.ofs-chart-run .ofs-chart-line,.ofs-chart-run .ofs-chart-area,.ofs-chart-run .ofs-chart-value,.ofs-chart-run .ofs-chart-pt{animation-play-state:running}
@keyframes ofs-chart-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes ofs-chart-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes ofs-chart-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.ofs-chart-anim .ofs-chart-bar,.ofs-chart-anim .ofs-chart-line,.ofs-chart-anim .ofs-chart-area,.ofs-chart-anim .ofs-chart-value,.ofs-chart-anim .ofs-chart-pt{animation:none}.ofs-chart-bar,.ofs-chart-pt,.ofs-chart-tip{transition:none}}`,
};
