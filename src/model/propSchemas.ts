import type { AssetKind, Project } from './types';
import { assetKind } from './types';
import { isSafeColor } from './paint';
import { sanitizeEdit } from './mediaEdit';

/**
 * Validation for structured element props (arrays, nested records, references)
 * that the generic "same type as the default" rule in validate.ts cannot check.
 * Every function receives untrusted input and must return a safe value.
 */
export interface SanitizeCtx {
  project: Project;
  varIds: Set<string>;
}
type Sanitizer = (value: unknown, def: unknown, ctx: SanitizeCtx) => unknown;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const finite = (v: unknown, d = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(-1e12, Math.min(1e12, n)) : d;
};

const stringList =
  (maxItems: number, maxLen: number): Sanitizer =>
  (v, def) =>
    Array.isArray(v) ? v.slice(0, maxItems).map((x) => text(x, maxLen)) : def;

const colorList: Sanitizer = (v, def) => {
  if (!Array.isArray(v)) return def;
  const out = v.filter(isSafeColor).slice(0, 24);
  return out.length ? out : def;
};

const variableRef: Sanitizer = (v, _d, ctx) => (typeof v === 'string' && ctx.varIds.has(v) ? v : '');

export const MAX_CHART_POINTS = 100;
export const MAX_CHART_SERIES = 12;
export const MAX_TABLE_ROWS = 300;
export const MAX_TABLE_COLS = 20;
export const MAX_QUIZ_CHOICES = 10;

const chartSeries: Sanitizer = (v, def) => {
  if (!Array.isArray(v)) return def;
  return v
    .filter(isObj)
    .slice(0, MAX_CHART_SERIES)
    .map((s) => ({
      name: text(s.name, 60),
      values: Array.isArray(s.values) ? s.values.slice(0, MAX_CHART_POINTS).map((x) => finite(x)) : [],
    }));
};

const tableRows: Sanitizer = (v, def) => {
  if (!Array.isArray(v)) return def;
  const rows = v
    .filter(Array.isArray)
    .slice(0, MAX_TABLE_ROWS)
    .map((r) => (r as unknown[]).slice(0, MAX_TABLE_COLS).map((c) => text(c, 500)));
  const cols = Math.max(1, ...rows.map((r) => r.length));
  return rows.length ? rows.map((r) => [...r, ...Array(cols - r.length).fill('')]) : def;
};

const shortText =
  (max: number): Sanitizer =>
  (v, def) =>
    typeof v === 'string' ? v.slice(0, max) : def;

const ALIGNS = new Set(['auto', 'left', 'center', 'right']);
const alignList: Sanitizer = (v, def) =>
  Array.isArray(v) ? v.slice(0, MAX_TABLE_COLS).map((a) => (typeof a === 'string' && ALIGNS.has(a) ? a : 'auto')) : def;

const isoInstant: Sanitizer = (v, def) => {
  if (typeof v !== 'string' || v.length > 40) return def;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : def;
};

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !/^[A-Za-z0-9_+\-/]{1,64}$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const timeZone: Sanitizer = (v) => (isValidTimeZone(v) ? v : 'UTC');

/** One of a fixed set of strings (enumerated props). */
const oneOf =
  (...options: string[]): Sanitizer =>
  (v, def) =>
    typeof v === 'string' && options.includes(v) ? v : def;

/** A finite number clamped to [min, max] (rounded when `int`). */
const range =
  (min: number, max: number, int = false): Sanitizer =>
  (v, def) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (typeof v === 'boolean' || v === null || v === '' || !Number.isFinite(n)) return def;
    const c = Math.max(min, Math.min(max, n));
    return int ? Math.round(c) : c;
  };

/**
 * An element's own media edit (v3): null follows the media library's version,
 * an object (even empty = "the original") overrides it for this element.
 */
const mediaEdit =
  (kind: AssetKind): Sanitizer =>
  (v) =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? sanitizeEdit(v, kind) : null;

/** Structured props per element type. */
export const PROP_SANITIZERS: Record<string, Record<string, Sanitizer>> = {
  image: { edit: mediaEdit('image') },
  video: { edit: mediaEdit('video') },
  audio: { edit: mediaEdit('audio') },
  progress: { variableId: variableRef },
  chart: {
    labels: stringList(MAX_CHART_POINTS, 60),
    series: chartSeries,
    palette: colorList,
    chartType: oneOf('bar', 'line'),
    preset: oneOf('clean', 'soft', 'bold'),
    title: shortText(200),
    xLabel: shortText(80),
    yLabel: shortText(80),
    valuePrefix: shortText(12),
    valueSuffix: shortText(12),
  },
  table: { rows: tableRows, columnAlign: alignList, preset: oneOf('lined', 'boxed', 'minimal') },
  countdown: {
    target: isoInstant,
    timezone: timeZone,
    repeat: oneOf('none', 'daily', 'weekly'),
    // Less than a week (the longest repeat period).
    holdMinutes: range(0, 7 * 24 * 60 - 1, true),
    style: oneOf('cards', 'digital', 'inline'),
    title: (v, def) => (typeof v === 'string' ? v.slice(0, 200) : def),
    doneText: (v, def) => (typeof v === 'string' ? v.slice(0, 300) : def),
    radius: range(0, 400),
  },
  quiz: {
    question: (v, def) => (typeof v === 'string' ? v.slice(0, 2000) : def),
    choices: (v, def, ctx) => {
      const list = stringList(MAX_QUIZ_CHOICES, 300)(v, def, ctx) as string[];
      return list.length >= 2 ? list : def;
    },
    layout: oneOf('list', 'grid', 'pills'),
    feedbackCorrect: (v, def) => (typeof v === 'string' ? v.slice(0, 1000) : def),
    feedbackIncorrect: (v, def) => (typeof v === 'string' ? v.slice(0, 1000) : def),
    scoreVariable: variableRef,
    points: range(-1e6, 1e6),
    radius: range(0, 400),
  },
};

/** Asset reference props and the kind of asset each must point to. */
export const ASSET_REFS: Record<string, Record<string, AssetKind>> = {
  image: { assetId: 'image' },
  beforeAfter: { before: 'image', after: 'image' },
  video: { assetId: 'video', posterId: 'image' },
  audio: { assetId: 'audio' },
};

export function assetOfKind(project: Project, id: unknown, kind: AssetKind): boolean {
  if (typeof id !== 'string' || !id) return false;
  if (!Object.prototype.hasOwnProperty.call(project.assets, id)) return false;
  const a = project.assets[id];
  return !!a && assetKind(a.mime) === kind;
}
