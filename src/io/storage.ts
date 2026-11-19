import type { Project } from '../model/types';

/** Local draft persistence in IndexedDB (no server). */
const DB_NAME = 'onefile-studio';
const STORE = 'drafts';

export interface DraftSummary {
  id: string;
  title: string;
  kind: Project['kind'];
  updatedAt: string;
  pages: number;
}

interface DraftRecord extends DraftSummary {
  project: Project;
}

let dbPromise: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function saveDraft(project: Project): Promise<void> {
  const rec: DraftRecord = {
    id: project.id,
    title: project.meta.title,
    kind: project.kind,
    updatedAt: project.meta.updatedAt,
    pages: project.pages.length,
    project,
  };
  await tx('readwrite', (s) => s.put(rec));
}

export async function loadDraft(id: string): Promise<Project | null> {
  const rec = (await tx('readonly', (s) => s.get(id))) as DraftRecord | undefined;
  return rec?.project ?? null;
}

export async function listDrafts(): Promise<DraftSummary[]> {
  try {
    const all = (await tx('readonly', (s) => s.getAll())) as DraftRecord[];
    return all
      .map(({ id, title, kind, updatedAt, pages }) => ({ id, title, kind, updatedAt, pages }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function deleteDraft(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export function downloadText(text: string, fileName: string, type = 'text/html') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
