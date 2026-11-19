import type { Asset, Page, Project, SceneElement, Variable } from '../model/types';

type Listener = () => void;

/** Holds the live values of project variables during playback. */
export class VarStore {
  private values = new Map<string, number>();
  private listeners = new Set<Listener>();
  private defs: Variable[];

  constructor(defs: Variable[]) {
    this.defs = defs;
    for (const v of defs) this.values.set(v.id, v.initial);
  }
  list(): Variable[] {
    return this.defs;
  }
  get(id: string): number {
    return this.values.get(id) ?? 0;
  }
  set(id: string, value: number): void {
    if (!this.defs.some((d) => d.id === id)) return;
    const v = Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : 0;
    if (this.values.get(id) === v) return;
    this.values.set(id, v);
    this.emit();
  }
  reset(id: string): void {
    const def = this.defs.find((d) => d.id === id);
    if (def) this.set(id, def.initial);
  }
  resetAll(): void {
    for (const d of this.defs) this.values.set(d.id, d.initial);
    this.emit();
  }
  byName(name: string): Variable | undefined {
    const n = name.trim().toLowerCase();
    return this.defs.find((d) => d.name.trim().toLowerCase() === n);
  }
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.values);
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of [...this.listeners]) fn();
  }
}

/** Current page/slide position (and scroll progress for webpages). */
export class NavStore {
  index = 0;
  count = 1;
  /** 0..1 scroll progress (webpages). */
  scroll = 0;
  private listeners = new Set<Listener>();
  set(patch: Partial<Pick<NavStore, 'index' | 'count' | 'scroll'>>) {
    Object.assign(this, patch);
    for (const fn of [...this.listeners]) fn();
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export type RenderMode = 'play' | 'edit' | 'thumb';

/** Everything an element renderer may depend on. */
export interface RuntimeEnv {
  mode: RenderMode;
  project: Project;
  vars: VarStore;
  nav: NavStore;
  /** Per-element persistent state (e.g. gallery index) that survives re-mounting. */
  state: Map<string, unknown>;
  /** Navigate (play mode only). */
  navigate(target: string): void;
}

export function assetUrl(project: Project, id: unknown): string | undefined {
  if (typeof id !== 'string') return undefined;
  const a: Asset | undefined = project.assets[id];
  if (!a || typeof a.data !== 'string' || !a.data.startsWith('data:image/')) return undefined;
  return a.data;
}

const blobUrls = new Map<string, string>();

/**
 * URL for an embedded video/audio asset. Large media plays and seeks far more
 * reliably from a Blob than from a multi-megabyte data: URL, so the base64
 * payload is decoded (in chunks, without network access) into a Blob once per
 * asset and cached. Falls back to the data: URL where Blob URLs are unavailable.
 */
export function mediaUrl(project: Project, id: unknown, kind: 'video' | 'audio'): string | undefined {
  if (typeof id !== 'string') return undefined;
  const a: Asset | undefined = project.assets[id];
  if (!a || typeof a.data !== 'string' || !a.data.startsWith(`data:${kind}/`)) return undefined;
  const key = `${a.hash}:${a.bytes}:${a.data.length}`;
  const cached = blobUrls.get(key);
  if (cached) return cached;
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof Blob === 'undefined' || typeof atob !== 'function') return a.data;
  try {
    const url = URL.createObjectURL(dataUrlToBlob(a.data));
    blobUrls.set(key, url);
    return url;
  } catch {
    return a.data;
  }
}

/** Decodes a base64 data: URL into a Blob in ~1.5 MB chunks (keeps peak memory low). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
  const parts: Uint8Array[] = [];
  const CHUNK = 4 * 1024 * 512;
  for (let i = comma + 1; i < dataUrl.length; i += CHUNK) {
    const bin = atob(dataUrl.slice(i, Math.min(dataUrl.length, i + CHUNK)));
    const bytes = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    parts.push(bytes);
  }
  return new Blob(parts as BlobPart[], { type: mime });
}

export function findElement(project: Project, id: string): { page: Page; el: SceneElement; index: number } | null {
  for (let i = 0; i < project.pages.length; i++) {
    const el = project.pages[i].elements.find((e) => e.id === id);
    if (el) return { page: project.pages[i], el, index: i };
  }
  return null;
}

export function createStaticEnv(project: Project, mode: RenderMode, pageIndex = 0): RuntimeEnv {
  const nav = new NavStore();
  nav.index = pageIndex;
  nav.count = project.pages.length;
  return {
    mode,
    project,
    vars: new VarStore(project.variables),
    nav,
    state: new Map(),
    navigate: () => {},
  };
}
