import { useEffect, useMemo, useState } from 'react';
import { useEditor } from '../store/store';
import { Icon } from '../ui/Icon';
import { closeCoach, confirmStep, contextFor, goToStep, revealElement, setMinimized, stepDone, useCoach, watchEditor } from './coach';
import type { CoachRun } from './coach';
import type { CoachStep } from '../../templates';
import { getLesson, LEVELS } from './lessons';
import { restartLesson, backToLessons } from './session';

/**
 * The coach card. In the editor it is docked along the bottom of the canvas
 * area (the canvas shrinks by that height, so it never covers the slide);
 * on the start screen it floats. Guides (template quick-start) are a
 * checklist that ticks itself; lessons are short step sequences with Back /
 * Next / Skip. It never blocks the editor, and can be minimised or closed.
 */
export function Coach({ dock = false }: { dock?: boolean }) {
  const run = useCoach((s) => s.run);
  const hasProject = useEditor((s) => !!s.project);
  useEffect(() => {
    if (!dock) return watchEditor();
  }, [dock]);
  // The editor renders the docked coach; the app-level one only floats over the start screen.
  if (!run || (!dock && hasProject)) return null;
  if (run.minimized)
    return (
      <button
        className={`co-pill ${dock ? 'is-dock' : ''}`}
        onClick={() => setMinimized(false)}
        data-testid="coach-pill"
        aria-label={`Show ${run.kind === 'lesson' ? 'lesson' : 'guide'}: ${run.title}`}
      >
        <Icon name={run.kind === 'lesson' ? 'learn' : 'check'} size={16} />
        <span>{run.kind === 'lesson' ? `${run.title} · step ${run.index + 1}/${run.steps.length}` : run.title}</span>
      </button>
    );
  return run.kind === 'guide' ? <Guide run={run} dock={dock} /> : <LessonCard run={run} dock={dock} />;
}

function useCtx(run: CoachRun) {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const inspectorTab = useEditor((s) => s.inspectorTab);
  const leftTab = useEditor((s) => s.leftTab);
  return useMemo(
    () => contextFor(run, project, selection),
    // The UI tabs are read inside contextFor; list them so checks re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, project, selection, inspectorTab, leftTab],
  );
}

function Controls({ run }: { run: CoachRun }) {
  return (
    <span className="co-controls">
      {run.kind === 'lesson' && (
        <button
          className="ed-icon-btn is-xs"
          aria-label="Restart lesson"
          title="Restart lesson (starts a fresh practice project)"
          onClick={() => restartLesson(run.id)}
          data-testid="coach-restart"
        >
          <Icon name="restart" size={14} />
        </button>
      )}
      <button className="ed-icon-btn is-xs" aria-label="Minimise" title="Minimise" onClick={() => setMinimized(true)} data-testid="coach-minimise">
        <Icon name="minus" size={14} />
      </button>
      <button
        className="ed-icon-btn is-xs"
        aria-label={run.kind === 'lesson' ? 'Exit lesson' : 'Close guide'}
        title={run.kind === 'lesson' ? 'Exit lesson (your practice project stays)' : 'Dismiss'}
        onClick={closeCoach}
        data-testid="coach-close"
      >
        <Icon name="close" size={14} />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------- template guide
function Guide({ run, dock }: { run: CoachRun; dock: boolean }) {
  const ctx = useCtx(run);
  const states = run.steps.map((s) => stepDone(run, s, ctx));
  const [open, setOpen] = useState<string | null>(null);
  const firstOpen = states.indexOf(false);
  const openIndex = run.steps.findIndex((s) => s.id === open);
  const index = openIndex >= 0 ? openIndex : firstOpen;
  const current = index >= 0 ? run.steps[index] : null;
  const doneCount = states.filter(Boolean).length;
  const finished = doneCount === run.steps.length;
  return (
    <aside className={`co-card ${dock ? 'is-dock' : ''}`} role="region" aria-label={run.title} data-testid="coach" data-kind="guide">
      <div className="co-side">
        <div className="co-head">
          <span className="co-badge">
            <Icon name="check" size={13} stroke={3} /> Quick start
          </span>
          <Controls run={run} />
        </div>
        <h2 className="co-title">{run.title}</h2>
        <div className="co-bar" aria-hidden="true">
          <span style={{ width: `${(doneCount / run.steps.length) * 100}%` }} />
        </div>
        <p className="co-foot">
          {doneCount} of {run.steps.length} done · ticks itself as you go
        </p>
      </div>
      <div className="co-main">
        <ol className="co-chips" aria-label="Steps">
          {run.steps.map((s, i) => (
            <li key={s.id}>
              <button
                className={`co-chip ${states[i] ? 'is-done' : ''} ${i === index && !finished ? 'is-on' : ''}`}
                onClick={() => setOpen(s.id)}
                aria-current={i === index && !finished ? 'step' : undefined}
                data-testid={`guide-${s.id}`}
                data-done={states[i]}
              >
                <span className="co-check" aria-hidden="true">
                  {states[i] ? <Icon name="check" size={12} stroke={3.4} /> : i + 1}
                </span>
                {s.title}
                {states[i] && <span className="sr-only"> (done)</span>}
              </button>
            </li>
          ))}
        </ol>
        {finished ? (
          <div className="co-detail co-done" role="status">
            <p>
              <strong>All set! 🎉</strong> Your project is ready to share — and still yours to change any way you like.
            </p>
            <button className="ed-btn ed-btn-sm ed-btn-soft" onClick={closeCoach} data-testid="coach-finish">
              Close guide
            </button>
          </div>
        ) : (
          current && (
            <div className="co-detail" aria-live="polite">
              <p>
                <strong>{current.title}.</strong> {current.body}
              </p>
              <div className="co-actions">
                {current.element && (
                  <button className="ed-btn ed-btn-xs ed-btn-soft" onClick={() => revealElement(current.element!)} data-testid="coach-show-me">
                    <Icon name="eye" size={13} /> Show me
                  </button>
                )}
                {!states[index] && (
                  <button className="ed-btn ed-btn-xs ed-btn-ghost" onClick={() => confirmStep(current.id)} data-testid="coach-mark-done">
                    Mark as done
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>
      {current && !finished && !states[index] && <Spotlight step={current} />}
    </aside>
  );
}

// ---------------------------------------------------------------- lessons
function LessonCard({ run, dock }: { run: CoachRun; dock: boolean }) {
  const ctx = useCtx(run);
  const lesson = getLesson(run.id);
  const level = LEVELS.find((l) => l.id === lesson?.level);
  const step = run.steps[run.index];
  const done = stepDone(run, step, ctx);
  const last = run.index === run.steps.length - 1;
  const checkable = !!step.done;
  return (
    <aside
      className={`co-card is-lesson ${dock ? 'is-dock' : ''}`}
      role="region"
      aria-label={`Lesson: ${run.title}`}
      data-testid="coach"
      data-kind="lesson"
      style={{ ['--lv' as string]: level?.color }}
    >
      <div className="co-side">
        <div className="co-head">
          <span className="co-badge">
            <Icon name="learn" size={13} /> {level?.label ?? 'Lesson'} · {lesson?.number ?? ''}
          </span>
          <Controls run={run} />
        </div>
        <h2 className="co-title">{run.title}</h2>
        <div
          className="co-dots"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={run.steps.length}
          aria-valuenow={run.index + 1}
          aria-label="Lesson progress"
        >
          {run.steps.map((s, i) => (
            <span key={s.id} className={i < run.index ? 'is-past' : i === run.index ? 'is-now' : ''} />
          ))}
        </div>
        <p className="co-foot">
          Step {run.index + 1} of {run.steps.length}
        </p>
      </div>
      <div className={`co-main co-step ${done && checkable ? 'is-done' : ''}`} aria-live="polite" data-testid="coach-step" data-step={step.id} data-done={done}>
        <h3>
          {step.title}
          {checkable && done && (
            <span className="co-success" data-testid="coach-success">
              <Icon name="check" size={14} stroke={3} /> Nice — done!
            </span>
          )}
        </h3>
        <p>{step.body}</p>
        {step.element && !last && (
          <button className="ed-btn ed-btn-xs ed-btn-soft" onClick={() => revealElement(step.element!)} data-testid="coach-show-me">
            <Icon name="eye" size={13} /> Show me
          </button>
        )}
      </div>
      <div className="co-nav">
        <button className="ed-btn ed-btn-sm ed-btn-ghost" onClick={() => goToStep(run.index - 1)} disabled={run.index === 0} data-testid="coach-back">
          <Icon name="left" size={14} /> Back
        </button>
        {last ? (
          <>
            <button className="ed-btn ed-btn-sm ed-btn-ghost" onClick={closeCoach} data-testid="coach-keep-editing">
              Keep editing
            </button>
            <button className="ed-btn ed-btn-sm ed-btn-primary" onClick={() => void backToLessons()} data-testid="coach-more-lessons">
              More lessons
            </button>
          </>
        ) : checkable && !done ? (
          <button className="ed-btn ed-btn-sm ed-btn-ghost" onClick={() => goToStep(run.index + 1)} data-testid="coach-skip">
            Skip step
          </button>
        ) : (
          <button className="ed-btn ed-btn-sm ed-btn-primary" onClick={() => goToStep(run.index + 1)} data-testid="coach-next">
            Next <Icon name="right" size={14} />
          </button>
        )}
      </div>
      {!done && <Spotlight step={step} />}
    </aside>
  );
}

// ---------------------------------------------------------------- spotlight
/** A pulsing outline around the control a step talks about (found by selector, so layout changes don't break it). */
function Spotlight({ step }: { step: CoachStep }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!step.control) {
      setRect(null);
      return;
    }
    const find = () => {
      const nodes = [...document.querySelectorAll<HTMLElement>(step.control!)];
      const visible = nodes.map((n) => n.getBoundingClientRect()).find((r) => r.width > 0 && r.height > 0);
      setRect((prev) =>
        visible && prev && Math.abs(prev.x - visible.x) + Math.abs(prev.y - visible.y) + Math.abs(prev.width - visible.width) < 1 ? prev : (visible ?? null),
      );
    };
    find();
    const t = setInterval(find, 300);
    return () => clearInterval(t);
  }, [step.control]);
  if (!rect) return null;
  return (
    <div
      className="co-spot"
      aria-hidden="true"
      data-testid="coach-spotlight"
      style={{ left: rect.x - 5, top: rect.y - 5, width: rect.width + 10, height: rect.height + 10 }}
    />
  );
}
