import type { Project, ProjectKind } from '../model/types';
import { createProject } from '../model/factory';
import { uid } from '../model/ids';
import { validateProject } from '../model/validate';
import { importFromFile } from '../io/importHtml';
import { listDrafts, loadDraft, saveDraft } from '../io/storage';
import { editor, useEditor } from './store/store';
import { toast } from './ui/toast';
import { EXAMPLES } from '../examples';

const LAST_KEY = 'ofs:last-project';

function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_KEY, id);
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function lastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

function open(project: Project) {
  editor().openProject(project);
  remember(project.id);
  void persist();
}

export function startNew(kind: ProjectKind) {
  open(createProject(kind));
}

export function openExample(id: string) {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) return;
  const p = ex.build();
  p.id = uid('prj');
  open(p);
  toast(`Opened “${ex.title}”. It's a normal project — change anything you like.`, 'info');
}

export async function openDraft(id: string) {
  const raw = await loadDraft(id);
  if (!raw) {
    toast('That draft could not be found.', 'error');
    return;
  }
  const r = validateProject(raw);
  if (!r.ok) {
    toast(r.errors.join(' '), 'error');
    return;
  }
  editor().openProject(r.project);
  remember(r.project.id);
}

export async function importFile(file: File): Promise<boolean> {
  try {
    const { project, warnings } = await importFromFile(file);
    const existing = (await listDrafts()).some((d) => d.id === project.id);
    if (existing) project.id = uid('prj');
    open(project);
    toast(
      `Imported “${project.meta.title}”.${warnings.length ? ` (${warnings.length} item${warnings.length > 1 ? 's' : ''} skipped: ${warnings[0]})` : ''}`,
      warnings.length ? 'info' : 'success',
      6000,
    );
    return true;
  } catch (err) {
    toast((err as Error).message, 'error', 7000);
    return false;
  }
}

export function pickAndImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.html,.htm,.json,text/html,application/json';
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void importFile(f);
  };
  input.click();
}

export async function goHome() {
  await persist();
  editor().closeProject();
  remember(null);
}

let timer: ReturnType<typeof setTimeout> | null = null;
let saving: Promise<void> = Promise.resolve();

/** Saves the current project to IndexedDB now. */
export function persist(): Promise<void> {
  const p = editor().project;
  if (!p) return saving;
  if (timer) clearTimeout(timer);
  timer = null;
  editor().set({ saveState: 'saving' });
  saving = saving
    .then(() => saveDraft(p))
    .then(() => {
      if (editor().project === p) editor().set({ saveState: 'saved' });
    })
    .catch(() => {
      editor().set({ saveState: 'error' });
    });
  return saving;
}

/** Debounced autosave whenever the project changes. */
export function startAutosave() {
  let last = editor().project;
  return useEditor.subscribe((s) => {
    if (s.project === last) return;
    last = s.project;
    if (!s.project || s.txBase) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void persist(), 700);
  });
}
