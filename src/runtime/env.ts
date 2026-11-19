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
