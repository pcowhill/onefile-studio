import type { Asset, Project } from '../model/types';
import { contentHash, pruneContentHashes } from './assets';

/**
 * Local draft persistence in IndexedDB (no server).
 *
 * Database version 2 keeps asset data (often many megabytes of base64 video)
 * out of the frequently rewritten draft records:
 *  - `drafts`  — one small record per project; assets carry `data: ''` and the
 *                record maps asset id → content key.
 *  - `assets`  — `{ key, data, mime, bytes }` keyed by a SHA-256 of the data we
 *                computed ourselves. Written once; shared by drafts that use
 *                the same file; garbage-collected when no draft needs it.
 * Version 1 records (project with embedded data) are still read, and are
 * rewritten in the new format the next time the project is saved.
 */
const DB_NAME = 'onefile-studio';
const DB_VERSION = 2;
const DRAFTS = 'drafts';
const ASSETS = 'assets';

export interface DraftSummary {
  id: string;
  title: string;
  kind: Project['kind'];
  updatedAt: string;
  pages: number;
}

/** v1 record: the whole project, asset data included. */
interface DraftRecordV1 extends DraftSummary {
  project: Project;
}

/** v2 record: asset data lives in the `assets` store. */
export interface DraftRecordV2 extends DraftSummary {
  format: 2;
  project: Project;
  assetKeys: Record<string, string>;
}

type DraftRecord = DraftRecordV1 | DraftRecordV2;

export interface StoredAsset {
  key: string;
  data: string;
  mime: string;
  bytes: number;
}

const isV2 = (r: DraftRecord): r is DraftRecordV2 => (r as DraftRecordV2).format === 2 && typeof (r as DraftRecordV2).assetKeys === 'object';

// ---------------- pure split / join (unit-tested) ----------------

/** Splits a project into a small draft record plus its asset payloads. */
export function splitDraft(project: Project, keys: Record<string, string>): { record: DraftRecordV2; assets: StoredAsset[] } {
  const stripped: Record<string, Asset> = {};
  const payloads = new Map<string, StoredAsset>();
  for (const [id, a] of Object.entries(project.assets)) {
    stripped[id] = { ...a, data: '' };
    const key = keys[id];
    if (key && !payloads.has(key)) payloads.set(key, { key, data: a.data, mime: a.mime, bytes: a.bytes });
  }
  return {
    record: {
      id: project.id,
      title: project.meta.title,
      kind: project.kind,
      updatedAt: project.meta.updatedAt,
      pages: project.pages.length,
      format: 2,
      project: { ...project, assets: stripped },
      assetKeys: { ...keys },
    },
    assets: [...payloads.values()],
  };
}

/** Rebuilds a project from a draft record. Assets whose payload is missing are dropped. */
export function joinDraft(record: DraftRecord, payload: (key: string) => string | undefined): Project {
  if (!isV2(record)) return record.project;
  const assets: Record<string, Asset> = {};
  for (const [id, a] of Object.entries(record.project.assets ?? {})) {
    const data = payload(record.assetKeys[id] ?? '');
    if (typeof data === 'string' && data) assets[id] = { ...a, data };
  }
  return { ...record.project, assets };
}

/** Asset keys referenced by a set of draft records (v1 records reference none). */
export function referencedKeys(records: DraftRecord[]): Set<string> {
  const keys = new Set<string>();
  for (const r of records) if (isV2(r)) for (const k of Object.values(r.assetKeys)) keys.add(k);
  return keys;
}

// ---------------- IndexedDB plumbing ----------------

let dbPromise: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DRAFTS)) db.createObjectStore(DRAFTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS, { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab is upgrading: step aside so it is not blocked forever.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
    req.onblocked = () => {
      /* resolves once older tabs close their connection */
    };
  });
  return dbPromise;
}

const done = (t: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Transaction aborted'));
  });

const result = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Deletes asset payloads that no draft references (inside a readwrite transaction over both stores). */
async function collectGarbage(t: IDBTransaction): Promise<void> {
  const records = (await result(t.objectStore(DRAFTS).getAll())) as DraftRecord[];
  const keep = referencedKeys(records);
  const store = t.objectStore(ASSETS);
  const keys = (await result(store.getAllKeys())) as string[];
  for (const k of keys) if (!keep.has(k)) store.delete(k);
}

/**
 * Saves a draft. Only asset payloads not already stored are written, so
 * autosaving a project with a large video rewrites just a few kilobytes.
 */
export async function saveDraft(project: Project): Promise<void> {
  const keys: Record<string, string> = {};
  for (const a of Object.values(project.assets)) keys[a.id] = await contentHash(a);
  pruneContentHashes(Object.keys(project.assets));
  const { record, assets } = splitDraft(project, keys);
  const db = await open();
  const t = db.transaction([DRAFTS, ASSETS], 'readwrite');
  const finished = done(t);
  finished.catch(() => undefined);
  const store = t.objectStore(ASSETS);
  const drafts = t.objectStore(DRAFTS);
  const previous = (await result(drafts.get(project.id))) as DraftRecord | undefined;
  for (const a of assets) {
    if ((await result(store.getKey(a.key))) === undefined) store.put(a);
  }
  drafts.put(record);
  // A file was replaced or removed: free it unless another draft still uses it.
  const before = previous ? (isV2(previous) ? Object.values(previous.assetKeys) : []) : [];
  const now = new Set(Object.values(keys));
  if (before.some((k) => !now.has(k))) await collectGarbage(t);
  await finished;
}

export async function loadDraft(id: string): Promise<Project | null> {
  const db = await open();
  const t = db.transaction([DRAFTS, ASSETS], 'readonly');
  const rec = (await result(t.objectStore(DRAFTS).get(id))) as DraftRecord | undefined;
  if (!rec) return null;
  if (!isV2(rec)) return rec.project ?? null;
  const store = t.objectStore(ASSETS);
  const payloads = new Map<string, string>();
  for (const key of new Set(Object.values(rec.assetKeys))) {
    const a = (await result(store.get(key))) as StoredAsset | undefined;
    if (a && typeof a.data === 'string') payloads.set(key, a.data);
  }
  return joinDraft(rec, (k) => payloads.get(k));
}

export async function listDrafts(): Promise<DraftSummary[]> {
  try {
    const db = await open();
    const t = db.transaction(DRAFTS, 'readonly');
    const all = (await result(t.objectStore(DRAFTS).getAll())) as DraftRecord[];
    return all.map(({ id, title, kind, updatedAt, pages }) => ({ id, title, kind, updatedAt, pages })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/** Deletes a draft and every stored asset no remaining draft uses. */
export async function deleteDraft(id: string): Promise<void> {
  const db = await open();
  const t = db.transaction([DRAFTS, ASSETS], 'readwrite');
  const finished = done(t);
  finished.catch(() => undefined);
  t.objectStore(DRAFTS).delete(id);
  await collectGarbage(t);
  await finished;
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
