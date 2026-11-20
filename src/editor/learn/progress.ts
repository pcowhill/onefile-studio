/**
 * Lesson progress, kept in localStorage when it is available. Progress is a
 * convenience only: when storage is blocked (private windows, strict
 * settings) it lives in memory for the session and everything still works.
 */
const KEY = 'ofs:lessons-done';
let memory: string[] = [];
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return memory;
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return memory;
  }
}

function write(ids: string[]) {
  memory = ids;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable: keep it in memory */
  }
  for (const fn of listeners) fn();
}

export function completedLessons(): string[] {
  return read();
}

export function markLessonDone(id: string) {
  const ids = read();
  if (!ids.includes(id)) write([...ids, id]);
}

export function resetLessonProgress() {
  memory = [];
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  for (const fn of listeners) fn();
}

export function onProgressChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
