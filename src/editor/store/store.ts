import { create } from 'zustand';
import { produce, setAutoFreeze } from 'immer';
import type { Page, Project, SceneElement } from '../../model/types';

// Projects are treated as immutable snapshots; freezing them would also freeze
// structuredClone()d copies' sources in dev, which is unnecessary overhead.
setAutoFreeze(false);

export type LeftTab = 'pages' | 'insert' | 'images' | 'variables';
export type InspectorTab = 'design' | 'behavior';
export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

const HISTORY_LIMIT = 150;
const MERGE_WINDOW = 1200;

export interface UpdateOptions {
  /** Consecutive updates with the same key (within ~1 s) form one undo step. */
  merge?: string;
}

export interface EditorState {
  project: Project | null;
  pageId: string;
  selection: string[];
  past: Project[];
  future: Project[];
  /** Snapshot taken when a gesture (drag/resize) begins. */
  txBase: Project | null;
  lastMerge: { key: string; at: number } | null;
  clipboard: SceneElement[];
  leftTab: LeftTab;
  inspectorTab: InspectorTab;
  editingTextId: string | null;
  zoom: number | null;
  /** Zoom level that fits the page in the canvas (set by the canvas). */
  fitZoom: number;
  previewOpen: boolean;
  exportOpen: boolean;
  saveState: SaveState;
  /** Element briefly highlighted (e.g. when hovering a target in a picker). */
  highlightId: string | null;
  /** Opens the "When…" trigger picker for this element id. */
  triggerPickerFor: string | null;

  openProject(p: Project, pageId?: string): void;
  closeProject(): void;
  update(recipe: (draft: Project) => void, opts?: UpdateOptions): void;
  /** Change without creating an undo step (derived adjustments, e.g. auto-fit text). */
  amend(recipe: (draft: Project) => void): void;
  begin(): void;
  /** Apply a change during a gesture (no history entry until commit). */
  live(recipe: (draft: Project) => void): void;
  commit(): void;
  cancel(): void;
  undo(): void;
  redo(): void;
  select(ids: string[]): void;
  setPage(id: string): void;
  set(patch: Partial<EditorState>): void;
}

function touch(p: Project): Project {
  return { ...p, meta: { ...p.meta, updatedAt: new Date().toISOString() } };
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  pageId: '',
  selection: [],
  past: [],
  future: [],
  txBase: null,
  lastMerge: null,
  clipboard: [],
  leftTab: 'pages',
  inspectorTab: 'design',
  editingTextId: null,
  zoom: null,
  fitZoom: 1,
  previewOpen: false,
  exportOpen: false,
  saveState: 'saved',
  highlightId: null,
  triggerPickerFor: null,

  openProject(p, pageId) {
    set({
      project: p,
      pageId: pageId && p.pages.some((x) => x.id === pageId) ? pageId : p.pages[0].id,
      selection: [],
      past: [],
      future: [],
      txBase: null,
      lastMerge: null,
      editingTextId: null,
      zoom: null,
      previewOpen: false,
      exportOpen: false,
      saveState: 'saved',
      inspectorTab: 'design',
      leftTab: 'pages',
    });
  },
  closeProject() {
    set({ project: null, selection: [], past: [], future: [], txBase: null, previewOpen: false, exportOpen: false });
  },
  update(recipe, opts) {
    const { project, past, lastMerge } = get();
    if (!project) return;
    const next = produce(project, recipe);
    if (next === project) return;
    const now = Date.now();
    const merging = !!opts?.merge && lastMerge?.key === opts.merge && now - lastMerge.at < MERGE_WINDOW;
    set({
      project: touch(next),
      past: merging ? past : [...past, project].slice(-HISTORY_LIMIT),
      future: [],
      lastMerge: opts?.merge ? { key: opts.merge, at: now } : null,
      saveState: 'unsaved',
    });
    fixSelection(get, set);
  },
  amend(recipe) {
    const { project } = get();
    if (!project) return;
    const next = produce(project, recipe);
    if (next !== project) set({ project: next, saveState: 'unsaved' });
  },
  begin() {
    const { project } = get();
    set({ txBase: project, lastMerge: null });
  },
  live(recipe) {
    const { project } = get();
    if (!project) return;
    const next = produce(project, recipe);
    if (next !== project) set({ project: next });
  },
  commit() {
    const { txBase, project, past } = get();
    if (!txBase || !project) return set({ txBase: null });
    if (txBase === project) return set({ txBase: null });
    set({ txBase: null, project: touch(project), past: [...past, txBase].slice(-HISTORY_LIMIT), future: [], saveState: 'unsaved' });
  },
  cancel() {
    const { txBase } = get();
    if (txBase) set({ project: txBase, txBase: null });
  },
  undo() {
    const { past, project, future } = get();
    if (!past.length || !project) return;
    const prev = past[past.length - 1];
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], lastMerge: null, saveState: 'unsaved', editingTextId: null });
    fixSelection(get, set);
  },
  redo() {
    const { past, project, future } = get();
    if (!future.length || !project) return;
    const [next, ...rest] = future;
    set({ project: next, past: [...past, project], future: rest, lastMerge: null, saveState: 'unsaved', editingTextId: null });
    fixSelection(get, set);
  },
  select(ids) {
    const cur = get().selection;
    if (cur.length === ids.length && cur.every((x, i) => x === ids[i])) return;
    set({ selection: ids, editingTextId: null });
  },
  setPage(id) {
    if (get().pageId === id) return;
    set({ pageId: id, selection: [], editingTextId: null });
  },
  set(patch) {
    set(patch);
  },
}));

/** Keeps the current page and selection valid after structural changes. */
function fixSelection(get: () => EditorState, set: (p: Partial<EditorState>) => void) {
  const { project, pageId, selection } = get();
  if (!project) return;
  let pid = pageId;
  if (!project.pages.some((p) => p.id === pid)) pid = project.pages[0]?.id ?? '';
  const ids = new Set(project.pages.flatMap((p) => p.elements.map((e) => e.id)));
  const sel = selection.filter((id) => ids.has(id));
  if (pid !== pageId || sel.length !== selection.length) set({ pageId: pid, selection: sel });
}

// ---------- selectors / helpers ----------
export function currentPage(s: Pick<EditorState, 'project' | 'pageId'>): Page | null {
  return s.project?.pages.find((p) => p.id === s.pageId) ?? null;
}

export function findEl(project: Project, id: string): { page: Page; el: SceneElement; index: number } | null {
  for (const page of project.pages) {
    const index = page.elements.findIndex((e) => e.id === id);
    if (index >= 0) return { page, el: page.elements[index], index };
  }
  return null;
}

export function selectedElements(s: Pick<EditorState, 'project' | 'selection'>): SceneElement[] {
  if (!s.project) return [];
  const out: SceneElement[] = [];
  for (const id of s.selection) {
    const f = findEl(s.project, id);
    if (f) out.push(f.el);
  }
  return out;
}

export const editor = () => useEditor.getState();
