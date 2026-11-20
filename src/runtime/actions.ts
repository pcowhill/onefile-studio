import type { Interaction, ParamValue } from '../model/types';
import { SELF_TARGET } from '../model/types';
import type { VarStore } from './env';
import type { ElementApi } from './elements/types';
import { Registry } from './registry';
import { evaluateCondition } from './conditions';

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
}

export interface ActionContext {
  player: PlayerControl;
  /** Element that owns the interaction. */
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
    id: 'wait',
    execute: (p) => new Promise<void>((res) => setTimeout(res, Math.max(0, Math.min(60000, n(p.seconds, 1) * 1000)))),
  },
];
defs.forEach((d) => actionRegistry.register(d));

/** Runs one interaction: checks every condition, then executes actions in order. */
export async function runInteraction(ix: Interaction, ctx: ActionContext): Promise<boolean> {
  if (!ix.conditions.every((c) => evaluateCondition(c, ctx.player.vars))) return false;
  for (const a of ix.actions) {
    const def = actionRegistry.get(a.type);
    if (!def) continue;
    try {
      await def.execute(a.params ?? {}, ctx);
    } catch (err) {
      console.warn('[OneFile] action failed', a.type, err);
    }
  }
  return true;
}
