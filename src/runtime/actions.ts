import type { Action, Interaction, ParamValue } from '../model/types';
import { SELF_TARGET } from '../model/types';
import type { VarStore } from './env';
import type { ElementApi } from './elements/types';
import { Registry } from './registry';
import { evaluateCondition } from './conditions';
import { normalizeLink } from '../model/links';
import { toSteps } from '../model/actionSteps';

/** The player capabilities actions are allowed to use. */
export interface PlayerControl {
  vars: VarStore;
  isVisible(id: string): boolean;
  setVisible(id: string, visible: boolean, effect?: string): Promise<void> | void;
  navigate(target: string): void;
  api(id: string): ElementApi | undefined;
  /** Forgets an element's per-session state (e.g. a quiz answer), even when it is on another slide. */
  clearState?(id: string): void;
  animate(id: string, preset: string, opts: { duration?: number; direction?: string }): Promise<void>;
  /** Opens an already-validated http(s)/mailto/tel URL (v4). */
  openLink?(href: string, newTab: boolean): void;
  /** False once the player is destroyed (Preview closed, project closed): remaining steps are skipped (v5). */
  alive?(): boolean;
}

export interface ActionContext {
  player: PlayerControl;
  /** Element that owns the interaction ('' for page and project interactions). */
  selfId: string;
  event?: Event;
}

export type Params = Record<string, ParamValue>;

export interface ActionDef {
  id: string;
  execute(params: Params, ctx: ActionContext): void | Promise<void>;
}

export const actionRegistry = new Registry<ActionDef>('action');

const target = (p: Params, ctx: ActionContext): string => {
  const t = String(p.target ?? SELF_TARGET);
  return t === SELF_TARGET || !t ? ctx.selfId : t;
};
const n = (v: ParamValue | undefined, d = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};

/** Visibility effects map to animation presets. */
export const SHOW_EFFECTS: Record<string, string> = { fade: 'fadeIn', pop: 'zoomIn', slide: 'slideIn' };
export const HIDE_EFFECTS: Record<string, string> = { fade: 'fadeOut', pop: 'zoomOut', slide: 'slideOut' };

const defs: ActionDef[] = [
  { id: 'show', execute: (p, c) => c.player.setVisible(target(p, c), true, String(p.effect ?? 'none')) },
  { id: 'hide', execute: (p, c) => c.player.setVisible(target(p, c), false, String(p.effect ?? 'none')) },
  {
    id: 'toggle',
    execute(p, c) {
      const id = target(p, c);
      return c.player.setVisible(id, !c.player.isVisible(id), String(p.effect ?? 'none'));
    },
  },
  { id: 'navigate', execute: (p, c) => c.player.navigate(String(p.page ?? 'next')) },
  {
    id: 'gallery',
    execute(p, c) {
      const api = c.player.api(target(p, c));
      if (p.direction === 'prev') api?.prev?.();
      else if (p.direction === 'first') api?.reset?.();
      else api?.next?.();
    },
  },
  {
    id: 'varAdd',
    execute(p, c) {
      const id = String(p.variable ?? '');
      c.player.vars.set(id, c.player.vars.get(id) + n(p.amount, 1));
    },
  },
  {
    id: 'varSubtract',
    execute(p, c) {
      const id = String(p.variable ?? '');
      c.player.vars.set(id, c.player.vars.get(id) - n(p.amount, 1));
    },
  },
  { id: 'varSet', execute: (p, c) => c.player.vars.set(String(p.variable ?? ''), n(p.value, 0)) },
  {
    id: 'varReset',
    execute(p, c) {
      if (p.variable === '@all') c.player.vars.resetAll();
      else c.player.vars.reset(String(p.variable ?? ''));
    },
  },
  {
    id: 'animate',
    execute(p, c) {
      const run = c.player.animate(target(p, c), String(p.preset ?? 'pop'), {
        duration: n(p.duration, 0) || undefined,
        direction: String(p.direction ?? 'left'),
      });
      return p.wait ? run : undefined;
    },
  },
  { id: 'mediaPlay', execute: (p, c) => c.player.api(target(p, c))?.play?.() },
  { id: 'mediaPause', execute: (p, c) => c.player.api(target(p, c))?.pause?.() },
  { id: 'mediaRestart', execute: (p, c) => c.player.api(target(p, c))?.restart?.() },
  { id: 'mediaToggle', execute: (p, c) => c.player.api(target(p, c))?.toggle?.() },
  {
    id: 'quizReset',
    execute(p, c) {
      const id = target(p, c);
      c.player.clearState?.(id);
      c.player.api(id)?.reset?.();
    },
  },
  {
    // v4: the URL is checked again right before opening, whatever the project data says.
    id: 'openLink',
    execute(p, c) {
      const href = normalizeLink(p.url);
      if (href) c.player.openLink?.(href, p.newTab !== false);
    },
  },
  // v4: 3D model viewers.
  { id: 'modelView', execute: (p, c) => c.player.api(target(p, c))?.view?.(String(p.view ?? 'reset')) },
  {
    id: 'modelSpin',
    execute(p, c) {
      const mode = String(p.mode ?? 'toggle');
      c.player.api(target(p, c))?.spin?.(mode === 'start' ? true : mode === 'stop' ? false : undefined);
    },
  },
  {
    id: 'wait',
    execute: (p) => new Promise<void>((res) => setTimeout(res, Math.max(0, Math.min(60000, n(p.seconds, 1) * 1000)))),
  },
];
defs.forEach((d) => actionRegistry.register(d));

/**
 * Starts one action and returns a promise that settles when it has finished.
 * The action's `execute` is called synchronously, so actions started one after
 * another in the same loop really start at the same moment. Failures are
 * logged and never reject: one broken action never stops its neighbours.
 */
function startAction(a: Action, ctx: ActionContext): Promise<void> {
  const def = actionRegistry.get(a.type);
  if (!def) return Promise.resolve();
  try {
    return Promise.resolve(def.execute(a.params ?? {}, ctx)).then(
      () => undefined,
      (err) => console.warn('[OneFile] action failed', a.type, err),
    );
  } catch (err) {
    console.warn('[OneFile] action failed', a.type, err);
    return Promise.resolve();
  }
}

/**
 * Runs one interaction: checks every condition, then runs the actions step by
 * step (v5, see src/model/actionSteps.ts):
 *
 * - Steps run in order: a step starts once every action of the previous step
 *   has finished ("Then").
 * - The actions of a "Together" step are all started at once, in list order,
 *   without waiting for each other; the step finishes when all have settled.
 * - "Finished" means: Show/Hide with an effect → when the effect ends; Wait →
 *   when the time is up; Play animation → at once, unless its (older) "wait"
 *   setting is on; everything else → immediately.
 * - A failing action is logged and skipped; the rest of its step and the
 *   following steps still run (the same policy as before v5).
 * - If the player is destroyed while a step is running, later steps are skipped.
 *
 * Projects without `together` flags have one action per step: exactly the
 * pre-v5 "one after another" behaviour.
 */
export async function runInteraction(ix: Interaction, ctx: ActionContext): Promise<boolean> {
  if (!ix.conditions.every((c) => evaluateCondition(c, ctx.player.vars))) return false;
  for (const step of toSteps(ix.actions)) {
    if (ctx.player.alive && !ctx.player.alive()) break;
    if (step.length === 1) await startAction(step[0], ctx);
    else await Promise.allSettled(step.map((a) => startAction(a, ctx)));
  }
  return true;
}
