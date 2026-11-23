import type { Action } from './types';

/**
 * Action steps (v0.7, schema v5).
 *
 * An interaction's `actions` stay one flat, ordered list. An action whose
 * `together` flag is true starts *together with the action before it*, so the
 * list reads as a sequence of steps:
 *
 *   [A, B(together), C(together), D, E]  →  steps [[A, B, C], [D], [E]]
 *
 * Steps run one after another; the actions of one step start at the same time
 * and the next step begins when all of them have finished. Without any flags
 * (every project before v5) each action is its own step — exactly the old
 * "one after another" behaviour.
 *
 * Everything that edits groups goes through `toSteps` → change → `fromSteps`,
 * which rewrites the flags, so a list can never hold a dangling flag.
 */
export function toSteps<A extends Pick<Action, 'together'>>(actions: readonly A[]): A[][] {
  const steps: A[][] = [];
  for (const a of actions) {
    if (a.together && steps.length) steps[steps.length - 1].push(a);
    else steps.push([a]);
  }
  return steps;
}

/** Flattens steps back into an action list, setting `together` on every action but each step's first. */
export function fromSteps(steps: readonly Action[][]): Action[] {
  const out: Action[] = [];
  for (const step of steps) {
    step.forEach((a, i) => {
      if (i > 0) a.together = true;
      else delete a.together;
      out.push(a);
    });
  }
  return out;
}

/** Applies a step-level edit to an action list in place (immer drafts welcome). */
export function editSteps(actions: Action[], fn: (steps: Action[][]) => Action[][] | void): void {
  const steps = toSteps(actions).map((s) => [...s]);
  const next = (fn(steps) ?? steps).filter((s) => s.length > 0);
  const flat = fromSteps(next);
  actions.splice(0, actions.length, ...flat);
}

/** Index of the step holding the action `id`, and its position inside that step. */
export function locate(steps: readonly Action[][], id: string): { step: number; pos: number } | null {
  for (let s = 0; s < steps.length; s++) {
    const pos = steps[s].findIndex((a) => a.id === id);
    if (pos >= 0) return { step: s, pos };
  }
  return null;
}

/** Edits used by the Behavior inspector. Each takes and returns a steps array. */
export const stepOps = {
  /** Moves a whole step up (-1) or down (+1). */
  moveStep(steps: Action[][], index: number, dir: number): Action[][] {
    const j = index + dir;
    if (j < 0 || j >= steps.length) return steps;
    [steps[index], steps[j]] = [steps[j], steps[index]];
    return steps;
  },
  /** Moves an action inside its step (reorders a Together group). */
  moveInStep(steps: Action[][], id: string, dir: number): Action[][] {
    const at = locate(steps, id);
    if (!at) return steps;
    const s = steps[at.step];
    const j = at.pos + dir;
    if (j < 0 || j >= s.length) return steps;
    [s[at.pos], s[j]] = [s[j], s[at.pos]];
    return steps;
  },
  /** "Together": merges step `index + 1` into step `index`. */
  joinNext(steps: Action[][], index: number): Action[][] {
    if (index < 0 || index + 1 >= steps.length) return steps;
    steps[index] = [...steps[index], ...steps[index + 1]];
    steps.splice(index + 1, 1);
    return steps;
  },
  /** "One after another": every action of step `index` becomes its own step, in order. */
  split(steps: Action[][], index: number): Action[][] {
    const s = steps[index];
    if (!s || s.length < 2) return steps;
    steps.splice(index, 1, ...s.map((a) => [a]));
    return steps;
  },
  /** Takes an action out of its group into a new step right after the group. */
  takeOut(steps: Action[][], id: string): Action[][] {
    const at = locate(steps, id);
    if (!at || steps[at.step].length < 2) return steps;
    const [a] = steps[at.step].splice(at.pos, 1);
    steps.splice(at.step + 1, 0, [a]);
    return steps;
  },
  /** Adds an action to step `index` (at its end). */
  addTo(steps: Action[][], index: number, action: Action): Action[][] {
    if (!steps[index]) steps.push([action]);
    else steps[index].push(action);
    return steps;
  },
  /** Removes one action (an emptied step disappears). */
  remove(steps: Action[][], id: string): Action[][] {
    const at = locate(steps, id);
    if (at) steps[at.step].splice(at.pos, 1);
    return steps.filter((s) => s.length);
  },
  /** Removes a whole step. */
  removeStep(steps: Action[][], index: number): Action[][] {
    steps.splice(index, 1);
    return steps;
  },
};
