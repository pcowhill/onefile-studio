import type {
  Action,
  AnimationRef,
  Asset,
  Background,
  Condition,
  DragBehavior,
  Interaction,
  InteractionOwner,
  Page,
  Paint,
  Project,
  SceneElement,
  Variable,
} from './types';
import { assetKind, SCHEMA_ID, SCHEMA_VERSION, SELF_TARGET } from './types';
import { isIdentity, sanitizeEdit } from './mediaEdit';
import { SAFE_ID, uid } from './ids';
import { isSafeColor } from './paint';
import { elementRegistry } from '../runtime/elements';
import { triggerAllows, triggerRegistry } from '../runtime/triggers';
import { normalizeLink } from './links';
import { isGlbDataUrl } from './glb';
import { actionRegistry } from '../runtime/actions';
import { animationRegistry } from '../runtime/animations';
import { dragRegistry } from '../runtime/drag';
import { COMPARE_OPS } from '../runtime/conditions';
import { BACKGROUND_ROLES, DEFAULT_THEME, isThemeId } from './theme/tokens';
import { ASSET_REFS, assetOfKind, PROP_SANITIZERS } from './propSchemas';
import type { SanitizeCtx } from './propSchemas';

export type ValidationResult = { ok: true; project: Project; warnings: string[] } | { ok: false; errors: string[] };

export class ProjectError extends Error {}

/** Embedded asset MIME types accepted on import. */
const DATA_URL_HEAD =
  /^data:(image\/(?:png|jpeg|jpg|gif|webp|svg\+xml|avif|bmp)|video\/(?:mp4|webm|ogg)|audio\/(?:mpeg|wav|ogg|mp4|aac|webm|flac)|model\/gltf-binary);base64,/;
const B64_BODY = /[A-Za-z0-9+/]*={0,2}$/y;
const COLOR_KEYS = new Set([
  'color',
  'stroke',
  'borderColor',
  'accent',
  'track',
  'labelColor',
  'background',
  'textColor',
  'mutedColor',
  'gridColor',
  'headerBg',
  'headerText',
  'stripe',
  'cardBg',
  'cardText',
  'choiceBg',
  'success',
  'danger',
]);

/** True for a well-formed base64 data: URL of a supported media type (checked without copying large strings). */
export function isEmbeddedDataUrl(data: unknown): data is string {
  if (typeof data !== 'string') return false;
  const m = DATA_URL_HEAD.exec(data.slice(0, 64));
  if (!m) return false;
  B64_BODY.lastIndex = m[0].length;
  return B64_BODY.test(data);
}
const MAX_TEXT = 100_000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown, d: number, min = -1e6, max = 1e6) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d;
};
const str = (v: unknown, d: string, max = 200) => (typeof v === 'string' ? v.slice(0, max) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

/**
 * Validates and normalises untrusted project data (from imports or drafts).
 * Unknown element/trigger/action types are dropped with a warning; missing
 * properties are filled from the element registry defaults; colours, ids and
 * asset URLs are checked so nothing can escape into markup or the network.
 */
export function validateProject(raw: unknown): ValidationResult {
  const warnings: string[] = [];
  try {
    if (!isObj(raw)) throw new ProjectError('Project data is not an object.');
    if (raw.schema !== SCHEMA_ID) throw new ProjectError('This is not a OneFile Studio project.');
    const version = finite(raw.version, 0);
    if (version > SCHEMA_VERSION) throw new ProjectError(`This project was made with a newer version of OneFile Studio (schema v${version}).`);
    if (version < 1) throw new ProjectError('Unsupported project version.');
    const migrated = migrate(raw, version);
    const kind = migrated.kind === 'page' ? 'page' : migrated.kind === 'slides' ? 'slides' : null;
    if (!kind) throw new ProjectError('Unknown project type.');

    const meta = isObj(migrated.meta) ? migrated.meta : {};
    const ctx: SanitizeCtx = { project: null as unknown as Project, varIds: new Set() };
    const s = isObj(migrated.settings) ? migrated.settings : {};
    const isSlides = kind === 'slides';
    const project: Project = {
      schema: SCHEMA_ID,
      version: SCHEMA_VERSION,
      id: typeof migrated.id === 'string' && SAFE_ID.test(migrated.id) ? migrated.id : uid('prj'),
      kind,
      meta: {
        title: str(meta.title, 'Untitled', 200) || 'Untitled',
        createdAt: str(meta.createdAt, new Date().toISOString(), 40),
        updatedAt: str(meta.updatedAt, new Date().toISOString(), 40),
      },
      settings: {
        width: finite(s.width, isSlides ? 1280 : 1000, 200, 4000),
        height: finite(s.height, isSlides ? 720 : 560, 100, 4000),
        transition: s.transition === 'none' || s.transition === 'slide' ? s.transition : 'fade',
        showNavigation: bool(s.showNavigation, true),
        backdrop: isSafeColor(s.backdrop) ? s.backdrop : isSlides ? '#1b1834' : '#ffffff',
        theme: isThemeId(s.theme) ? s.theme : DEFAULT_THEME,
        ...(s.backdropThemed === true ? { backdropThemed: true } : {}),
      },
      pages: [],
      variables: [],
      assets: {},
    };

    // Assets
    if (isObj(migrated.assets)) {
      for (const [key, a] of Object.entries(migrated.assets)) {
        if (!isObj(a) || !SAFE_ID.test(key) || RESERVED_KEYS.has(key)) {
          warnings.push(`Skipped an invalid asset entry.`);
          continue;
        }
        const data = typeof a.data === 'string' ? a.data : '';
        if (!isEmbeddedDataUrl(data)) {
          warnings.push(`Skipped asset "${str(a.name, key, 60)}" (not a supported embedded image, video, audio or 3D model file).`);
          continue;
        }
        if (data.startsWith('data:model/') && !isGlbDataUrl(data)) {
          warnings.push(`Skipped 3D model "${str(a.name, key, 60)}" (not a valid GLB file).`);
          continue;
        }
        const asset: Asset = {
          id: key,
          name: str(a.name, 'image', 120),
          mime: data.slice(5, data.indexOf(';')),
          data,
          width: finite(a.width, 0, 0, 100000),
          height: finite(a.height, 0, 0, 100000),
          bytes: finite(a.bytes, Math.round((data.length - data.indexOf(',') - 1) * 0.75), 0, 1e10),
          hash: str(a.hash, key, 128),
        };
        const duration = finite(a.duration, 0, 0, 1e7);
        if (duration > 0) asset.duration = duration;
        if (a.animated === true) asset.animated = true;
        if (isObj(a.edit)) {
          const edit = sanitizeEdit(a.edit, assetKind(asset.mime), asset.duration);
          if (!isIdentity(edit)) asset.edit = edit;
        }
        project.assets[key] = asset;
      }
    }

    // Variables
    const varIds = new Set<string>();
    if (Array.isArray(migrated.variables)) {
      for (const v of migrated.variables) {
        if (!isObj(v) || typeof v.id !== 'string' || !SAFE_ID.test(v.id) || varIds.has(v.id)) {
          warnings.push('Skipped an invalid variable.');
          continue;
        }
        varIds.add(v.id);
        const variable: Variable = { id: v.id, name: str(v.name, 'Variable', 40) || 'Variable', type: 'number', initial: finite(v.initial, 0, -1e12, 1e12) };
        project.variables.push(variable);
      }
    }
    ctx.project = project;
    ctx.varIds = varIds;

    // Pages
    if (!Array.isArray(migrated.pages) || migrated.pages.length === 0) throw new ProjectError('The project has no pages.');
    const pageIds = new Set<string>();
    const elIds = new Set<string>();
    for (const rp of migrated.pages.slice(0, 1000)) {
      if (!isObj(rp)) {
        warnings.push('Skipped an invalid page.');
        continue;
      }
      let id = typeof rp.id === 'string' && SAFE_ID.test(rp.id) ? rp.id : uid('pg');
      if (pageIds.has(id)) id = uid('pg');
      pageIds.add(id);
      const page: Page = {
        id,
        name: str(rp.name, `Page ${project.pages.length + 1}`, 80),
        background: background(rp.background, project),
        elements: [],
      };
      if (!isSlides) page.height = finite(rp.height, project.settings.height, 80, 20000);
      if (Array.isArray(rp.elements)) {
        for (const re of rp.elements.slice(0, 2000)) {
          const el = element(re, ctx, elIds, warnings);
          if (el) page.elements.push(el);
        }
      }
      project.pages.push(page);
    }
    if (!project.pages.length) throw new ProjectError('The project has no valid pages.');

    // Second pass: interactions (need complete id sets).
    const refs: Refs = { elIds, varIds, pageIds, steps: version >= 5 };
    const rawPages = migrated.pages as unknown[];
    project.pages.forEach((page, pi) => {
      const rp = rawPages[pi] as Record<string, unknown>;
      const rawEls = Array.isArray(rp?.elements) ? (rp.elements as unknown[]) : [];
      for (const el of page.elements) {
        const re = rawEls.find((x) => isObj(x) && x.id === el.id) as Record<string, unknown> | undefined;
        el.interactions = interactions(re?.interactions, 'element', refs, warnings);
      }
      // v4: page-level interactions (keys, "slide opens", delays).
      const pageIx = interactions(rp?.interactions, 'page', refs, warnings);
      if (pageIx.length) page.interactions = pageIx;
    });
    // v4: project-wide interactions (keyboard shortcuts on every page).
    const projectIx = interactions(migrated.interactions, 'project', refs, warnings);
    if (projectIx.length) project.interactions = projectIx;
    return { ok: true, project, warnings };
  } catch (err) {
    if (err instanceof ProjectError) return { ok: false, errors: [err.message] };
    return { ok: false, errors: [`The project data is damaged: ${(err as Error).message}`] };
  }
}

/**
 * Schema migrations: upgrade older versions step by step. Migrations never
 * change how a project looks.
 *
 * v1 → v2: adds the project theme. v1 projects become "playful" (the original
 * look) and every element/background keeps its stored values as explicit
 * author choices (no `themed` keys), so nothing changes appearance.
 *
 * v2 → v3: adds nondestructive media edits (`asset.edit`, and an `edit` prop on
 * image, video and audio elements). Older files simply have none: elements get
 * `edit: null` (follow the library version) from the registry defaults.
 *
 * v3 → v4: adds page/project interactions, trigger options (keys, delays), the
 * "Open link" action, floaty/weighted drag modes with feel settings, GLB model
 * assets and the 3D model element. All additive: v3 files need no changes.
 *
 * v4 → v5: adds Together steps (`action.together`). Older files have no flags,
 * so every action stays its own step and runs one after another, as before.
 * A stray `together` key in a pre-v5 file is ignored (see `interactions()`),
 * so an older project can never silently start running actions in parallel.
 */
export function migrate(raw: Record<string, unknown>, version: number): Record<string, unknown> {
  let out = raw;
  if (version < 2) {
    const settings = isObj(out.settings) ? out.settings : {};
    out = { ...out, version: 2, settings: { ...settings, theme: DEFAULT_THEME, backdropThemed: false } };
  }
  if (Number(out.version) < 3) out = { ...out, version: 3 };
  if (Number(out.version) < 4) out = { ...out, version: 4 };
  if (Number(out.version) < 5) out = { ...out, version: 5 };
  return out;
}

function paint(v: unknown, d: Paint): Paint {
  if (!isObj(v)) return d;
  if (v.kind === 'solid' && isSafeColor(v.color)) return { kind: 'solid', color: v.color };
  if (v.kind === 'linear' && isSafeColor(v.from) && isSafeColor(v.to))
    return { kind: 'linear', from: v.from, to: v.to, angle: finite(v.angle, 135, -360, 360) };
  return d;
}

const ROLE = /^[a-zA-Z0-9]{1,24}$/;
/** Keys that would touch Object.prototype if used on a plain object. */
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString', 'valueOf']);

function background(v: unknown, project: Project): Background {
  const b = isObj(v) ? v : {};
  const out: Background = { paint: paint(b.paint, { kind: 'solid', color: '#ffffff' }) };
  if (typeof b.imageId === 'string' && assetOfKind(project, b.imageId, 'image')) {
    out.imageId = b.imageId;
    out.imageFit = b.imageFit === 'contain' ? 'contain' : 'cover';
    out.imageDim = finite(b.imageDim, 0, 0, 0.9);
  }
  if (typeof b.role === 'string' && (BACKGROUND_ROLES as string[]).includes(b.role)) out.role = b.role;
  if (b.themed === true) out.themed = true;
  return out;
}

function sanitizeProp(key: string, value: unknown, def: unknown, project: Project): unknown {
  if (def === undefined) return undefined;
  if (typeof def === 'string') {
    if (typeof value !== 'string') return def;
    if (COLOR_KEYS.has(key)) return isSafeColor(value) ? value : def;
    return value.slice(0, MAX_TEXT);
  }
  if (typeof def === 'number') return finite(value, def);
  if (typeof def === 'boolean') return bool(value, def);
  if (Array.isArray(def)) {
    // Generic arrays are asset lists (gallery images); structured arrays use PROP_SANITIZERS.
    if (!Array.isArray(value)) return def;
    return value.filter((x) => assetOfKind(project, x, 'image')).slice(0, 200);
  }
  if (isObj(def)) {
    if ('kind' in def) return paint(value, def as Paint);
    if (!isObj(value)) return def;
    const out: Record<string, unknown> = {};
    for (const [k, d] of Object.entries(def)) out[k] = sanitizeProp(k, value[k], d, project);
    return out;
  }
  return def;
}

function element(raw: unknown, ctx: SanitizeCtx, ids: Set<string>, warnings: string[]): SceneElement | null {
  const project = ctx.project;
  if (!isObj(raw)) return null;
  const type = typeof raw.type === 'string' ? raw.type : '';
  const def = elementRegistry.get(type);
  if (!def) {
    warnings.push(`Removed an element of unsupported type "${type.slice(0, 40)}".`);
    return null;
  }
  let id = typeof raw.id === 'string' && SAFE_ID.test(raw.id) ? raw.id : uid('el');
  if (ids.has(id)) id = uid('el');
  ids.add(id);
  const defaults = def.defaults() as Record<string, unknown>;
  const rp = isObj(raw.props) ? raw.props : {};
  const props: Record<string, unknown> = {};
  const special = PROP_SANITIZERS[type] ?? {};
  for (const [k, d] of Object.entries(defaults)) {
    if (!(k in rp)) props[k] = d;
    else if (special[k]) props[k] = special[k](rp[k], d, ctx);
    else props[k] = sanitizeProp(k, rp[k], d, project);
  }
  for (const [k, kind] of Object.entries(ASSET_REFS[type] ?? {})) {
    if (typeof props[k] === 'string' && props[k] && !assetOfKind(project, props[k], kind)) props[k] = '';
  }
  fixupProps(type, props);
  const out: SceneElement = {
    id,
    type,
    name: str(raw.name, type, 80) || type,
    x: finite(raw.x, 0),
    y: finite(raw.y, 0),
    w: finite(raw.w, 100, 1, 20000),
    h: finite(raw.h, 100, 1, 20000),
    rotation: finite(raw.rotation, 0, -360, 360),
    hidden: bool(raw.hidden, false),
    locked: bool(raw.locked, false),
    props,
    interactions: [],
    entrance: animationRef(raw.entrance),
    drag: dragBehavior(raw.drag),
  };
  if (typeof raw.role === 'string' && ROLE.test(raw.role)) out.role = raw.role;
  if (Array.isArray(raw.themed)) {
    const keys = [...new Set(raw.themed.filter((k): k is string => typeof k === 'string' && k in defaults))];
    if (keys.length) out.themed = keys;
  }
  return out;
}

function dragBehavior(v: unknown): DragBehavior | null {
  if (!isObj(v) || typeof v.mode !== 'string' || !dragRegistry.has(v.mode)) return null;
  const out: DragBehavior = { mode: v.mode };
  if (v.mode !== 'rigid') {
    if (typeof v.amount === 'number' && Number.isFinite(v.amount)) out.amount = finite(v.amount, 0.5, 0, 1);
    if (typeof v.settle === 'number' && Number.isFinite(v.settle)) out.settle = finite(v.settle, 0.5, 0, 1);
  }
  return out;
}

/** Cross-field consistency for structured props (after each field was sanitised). */
function fixupProps(type: string, props: Record<string, unknown>) {
  if (type === 'quiz') {
    const n = (props.choices as unknown[]).length;
    props.correct = Math.max(0, Math.min(n - 1, Math.round(Number(props.correct) || 0)));
  }
  if (type === 'chart') {
    const n = (props.labels as unknown[]).length;
    props.series = (props.series as Array<{ name: string; values: number[] }>).map((s) => ({
      name: s.name,
      values: Array.from({ length: n }, (_, i) => s.values[i] ?? 0),
    }));
  }
  if (type === 'table') {
    const cols = Math.max(1, ...(props.rows as string[][]).map((r) => r.length));
    const align = props.columnAlign as string[];
    props.columnAlign = Array.from({ length: cols }, (_, i) => align[i] ?? 'auto');
  }
}

function animationRef(v: unknown): AnimationRef | null {
  if (!isObj(v) || typeof v.preset !== 'string' || !animationRegistry.has(v.preset)) return null;
  const dir = v.direction;
  return {
    preset: v.preset,
    duration: finite(v.duration, 600, 50, 10000),
    delay: finite(v.delay, 0, 0, 20000),
    ...(dir === 'left' || dir === 'right' || dir === 'up' || dir === 'down' ? { direction: dir } : {}),
  };
}

interface Refs {
  elIds: Set<string>;
  varIds: Set<string>;
  pageIds: Set<string>;
  /** v5+: honour `together` flags (Together steps). */
  steps: boolean;
}

function interactions(v: unknown, owner: InteractionOwner, refs: Refs, warnings: string[]): Interaction[] {
  if (!Array.isArray(v)) return [];
  const out: Interaction[] = [];
  for (const ri of v.slice(0, 100)) {
    if (!isObj(ri)) continue;
    const trigger = typeof ri.trigger === 'string' ? ri.trigger : '';
    const def = triggerRegistry.get(trigger);
    if (!def || !triggerAllows(def, owner)) {
      warnings.push(`Removed an interaction with unsupported trigger "${trigger.slice(0, 40)}".`);
      continue;
    }
    const conditions: Condition[] = [];
    if (Array.isArray(ri.conditions)) {
      for (const rc of ri.conditions) {
        if (!isObj(rc) || rc.type !== 'variable' || typeof rc.variableId !== 'string' || !refs.varIds.has(rc.variableId)) continue;
        const op = typeof rc.op === 'string' && rc.op in COMPARE_OPS ? (rc.op as Condition['op']) : 'gte';
        conditions.push({ id: safeId(rc.id, 'cd'), type: 'variable', variableId: rc.variableId, op, value: finite(rc.value, 0, -1e12, 1e12) });
      }
    }
    const actions: Action[] = [];
    if (Array.isArray(ri.actions)) {
      for (const ra of ri.actions.slice(0, 100)) {
        if (!isObj(ra) || typeof ra.type !== 'string' || !actionRegistry.has(ra.type)) {
          warnings.push('Removed an unsupported action.');
          continue;
        }
        const params: Action['params'] = {};
        if (isObj(ra.params)) {
          for (const [k, pv] of Object.entries(ra.params)) {
            if (!/^[a-zA-Z]{1,30}$/.test(k)) continue;
            if (typeof pv === 'string') params[k] = pv.slice(0, k === 'url' ? 2000 : 200);
            else if (typeof pv === 'number' && Number.isFinite(pv)) params[k] = pv;
            else if (typeof pv === 'boolean') params[k] = pv;
          }
        }
        if (typeof params.target === 'string' && params.target !== SELF_TARGET && !refs.elIds.has(params.target)) params.target = '';
        if (owner !== 'element' && params.target === SELF_TARGET) params.target = '';
        if (typeof params.variable === 'string' && params.variable !== '@all' && !refs.varIds.has(params.variable)) params.variable = '';
        if (ra.type === 'openLink') {
          // Only http(s), mailto and tel links survive; anything else (javascript:, data:…) is dropped.
          const url = typeof params.url === 'string' ? params.url : '';
          if (url && !normalizeLink(url)) {
            warnings.push('Removed a link that was not a web, e-mail or phone address.');
            params.url = '';
          }
        }
        const action: Action = { id: safeId(ra.id, 'ac'), type: ra.type, params };
        // v5: "starts together with the previous action". Only a real boolean
        // true counts, and never on the first kept action (nothing to join).
        if (refs.steps && ra.together === true && actions.length > 0) action.together = true;
        actions.push(action);
      }
    }
    const ix: Interaction = { id: safeId(ri.id, 'ix'), trigger, conditions, actions };
    if (def.options) ix.options = def.options(isObj(ri.options) ? ri.options : {});
    out.push(ix);
  }
  return out;
}

function safeId(v: unknown, prefix: string) {
  return typeof v === 'string' && SAFE_ID.test(v) ? v : uid(prefix);
}

/** Throws a ProjectError with a readable message if invalid. */
export function parseProjectOrThrow(raw: unknown): { project: Project; warnings: string[] } {
  const r = validateProject(raw);
  if (!r.ok) throw new ProjectError(r.errors.join(' '));
  return { project: r.project, warnings: r.warnings };
}
