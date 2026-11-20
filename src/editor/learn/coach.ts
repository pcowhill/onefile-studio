import { create } from 'zustand';
import type { Project } from '../../model/types';
import type { CoachContext, CoachStep } from '../../templates';
import { editor, useEditor } from '../store/store';
import { markLessonDone } from './progress';

/**
 * The coach: a small, editor-only helper that shows either a template's
 * quick-start checklist ("guide") or a step-by-step lesson over the real
 * editor. It never touches the playback runtime or exports. Progress is
 * checked semantically against the project and a few editor events — never
 * against pixels or screen positions — and every step can be skipped.
 */

export type CoachKind = 'guide' | 'lesson';

export interface CoachRun {
  kind: CoachKind;
  /** Template id (guides) or lesson id. */
  id: string;
  title: string;
  steps: CoachStep[];
  /** Current step (lessons). */
  index: number;
  /** Project the run belongs to (guides close when another project opens). */
  projectId: string | null;
  initial: Project | null;
  stepStart: Project | null;
  events: string[];
  stepEvents: string[];
  /** Steps the user confirmed or that passed their check (sticky). */
  done: string[];
  minimized: boolean;
}

interface CoachState {
  run: CoachRun | null;
}

export const useCoach = create<CoachState>(() => ({ run: null }));
const get = () => useCoach.getState().run;
const patch = (p: Partial<CoachRun>) => {
  const run = get();
  if (run) useCoach.setState({ run: { ...run, ...p } });
};

export function startCoach(kind: CoachKind, id: string, title: string, steps: CoachStep[]) {
  const project = editor().project;
  useCoach.setState({
    run: {
      kind,
      id,
      title,
      steps,
      index: 0,
      projectId: project?.id ?? null,
      initial: project,
      stepStart: project,
      events: [],
      stepEvents: [],
      done: [],
      minimized: false,
    },
  });
}

export function closeCoach() {
  useCoach.setState({ run: null });
}

export function setMinimized(minimized: boolean) {
  patch({ minimized });
}

/** Lessons: move to step `i` (Back/Next/Skip); the step's checks start from now. */
export function goToStep(i: number) {
  const run = get();
  if (!run) return;
  const index = Math.max(0, Math.min(run.steps.length - 1, i));
  patch({ index, stepStart: editor().project ?? run.stepStart, stepEvents: [] });
  if (run.kind === 'lesson' && index === run.steps.length - 1) markLessonDone(run.id);
}

/** Records an editor event ('preview', 'export', 'import', 'theme'…) for checks. */
export function coachEvent(name: string) {
  const run = get();
  if (!run) return;
  patch({ events: [...run.events, name], stepEvents: [...run.stepEvents, name] });
}

export function confirmStep(id: string) {
  const run = get();
  if (run && !run.done.includes(id)) patch({ done: [...run.done, id] });
}

export function contextFor(run: CoachRun, project: Project | null, selection: readonly string[]): CoachContext | null {
  const p = project ?? run.initial;
  if (!p) return null;
  return {
    project: p,
    initial: run.initial ?? p,
    stepStart: run.stepStart ?? p,
    events: new Set(run.events),
    stepEvents: new Set(run.stepEvents),
    selection,
    ui: { inspectorTab: editor().inspectorTab, leftTab: editor().leftTab },
  };
}

/** Is step `s` complete? A failing check never throws or blocks. */
export function stepDone(run: CoachRun, s: CoachStep, ctx: CoachContext | null): boolean {
  if (run.done.includes(s.id)) return true;
  if (!s.done || !ctx) return false;
  try {
    return s.done(ctx);
  } catch {
    return false;
  }
}

/**
 * Watches the editor for events the checks care about: opening Preview, and
 * switching theme. Guides end when their project is closed or replaced.
 * Returns an unsubscribe function.
 */
export function watchEditor(): () => void {
  let prev = useEditor.getState();
  return useEditor.subscribe((s) => {
    const was = prev;
    prev = s;
    const run = get();
    if (!run) return;
    if (s.previewOpen && !was.previewOpen) coachEvent('preview');
    if (s.project && was.project && s.project.id === was.project.id && s.project.settings.theme !== was.project.settings.theme) coachEvent('theme');
    if (run.kind === 'guide' && (s.project?.id ?? null) !== run.projectId) {
      closeCoach();
      return;
    }
    // A lesson that starts on the start screen (or re-imports a file) adopts the project that opens.
    if (run.kind === 'lesson' && s.project && !run.initial) patch({ initial: s.project, stepStart: s.project, projectId: s.project.id });
  });
}

/** Reveals an element: its slide/section, selected, Design tab, briefly highlighted. */
export function revealElement(id: string) {
  const s = editor();
  const page = s.project?.pages.find((p) => p.elements.some((e) => e.id === id));
  if (!page) return false;
  s.setPage(page.id);
  s.select([id]);
  s.set({ leftTab: 'pages', inspectorTab: 'design', highlightId: id });
  setTimeout(() => {
    if (editor().highlightId === id) editor().set({ highlightId: null });
  }, 1600);
  return true;
}
