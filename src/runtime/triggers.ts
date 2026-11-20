import type { InteractionOwner, ParamValue } from '../model/types';
import { Registry } from './registry';
import type { KeySpec } from './keys';
import { isKeyId, keySpec } from './keys';

export type TriggerOptions = Record<string, ParamValue>;

/**
 * What the player offers a trigger besides the owner's DOM node: its options,
 * keyboard dispatch and the owner page's lifecycle. "Active" means the owner's
 * slide/section is the current one (project-wide triggers are always active).
 */
export interface TriggerContext {
  options: TriggerOptions;
  /** Calls `fire` for key presses matching `spec` while the owner is active. */
  onKey(spec: KeySpec, fire: (e: KeyboardEvent) => void): () => void;
  /** Calls `fn` each time the owner's page becomes the current one. */
  onEnter(fn: () => void): () => void;
  /** Calls `fn` each time the owner's page stops being the current one. */
  onLeave(fn: () => void): () => void;
  win: Window;
}

/**
 * A trigger binds listeners for an interaction owner (an element wrapper,
 * a page node or the player root) and calls `fire` when its moment happens.
 * Register new definitions here and add a matching card in the editor's
 * trigger catalog.
 */
export interface TriggerDef {
  id: string;
  /** Makes the element look clickable (pointer cursor, keyboard focus). */
  clickable?: boolean;
  /** Only meaningful on these element types (component events). */
  forTypes?: string[];
  /** Who may own it. Default: elements only. */
  owners?: InteractionOwner[];
  /** Validates untrusted options; returns the clean options. */
  options?(raw: Record<string, unknown>): TriggerOptions;
  bind(node: HTMLElement, fire: (e: Event) => void, ctx: TriggerContext): () => void;
}

export function triggerAllows(def: TriggerDef | undefined, owner: InteractionOwner): boolean {
  return !!def && (def.owners ?? ['element']).includes(owner);
}

export const triggerRegistry = new Registry<TriggerDef>('trigger');

function listen(node: HTMLElement, type: string, fn: (e: Event) => void) {
  node.addEventListener(type, fn);
  return () => node.removeEventListener(type, fn);
}

triggerRegistry.register({
  id: 'click',
  clickable: true,
  bind(node, fire) {
    const offClick = listen(node, 'click', (e) => fire(e));
    // Keyboard activation for accessibility when the element is not a native button.
    const offKey = listen(node, 'keydown', (e) => {
      const k = e as KeyboardEvent;
      if ((k.key === 'Enter' || k.key === ' ') && k.target === node) {
        k.preventDefault();
        fire(k);
      }
    });
    return () => {
      offClick();
      offKey();
    };
  },
});

triggerRegistry.register({
  id: 'rightclick',
  bind(node, fire) {
    // The browser menu is suppressed only on elements with a right-click interaction.
    return listen(node, 'contextmenu', (e) => {
      e.preventDefault();
      fire(e);
    });
  },
});

triggerRegistry.register({
  id: 'dblclick',
  clickable: true,
  bind: (node, fire) => listen(node, 'dblclick', fire),
});

triggerRegistry.register({
  id: 'hover',
  bind: (node, fire) => listen(node, 'pointerenter', fire),
});

/**
 * Component events. Elements announce them by dispatching a bubbling DOM
 * event from their content node (see `emit`); the trigger listens on the
 * element wrapper like any other trigger.
 */
export const COMPONENT_EVENTS = {
  countdownDone: 'ofs-countdown-done',
  quizAnswer: 'ofs-quiz-answer',
  mediaEnded: 'ofs-media-ended',
} as const;

export function emit(node: HTMLElement, type: string, detail: Record<string, unknown> = {}) {
  const Ev = node.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
  node.dispatchEvent(new Ev(type, { bubbles: true, detail }));
}

triggerRegistry.register({
  id: 'countdownDone',
  forTypes: ['countdown'],
  bind: (node, fire) => listen(node, COMPONENT_EVENTS.countdownDone, fire),
});

const quizTrigger = (id: string, want: boolean | null) =>
  triggerRegistry.register({
    id,
    forTypes: ['quiz'],
    bind: (node, fire) =>
      listen(node, COMPONENT_EVENTS.quizAnswer, (e) => {
        const correct = !!(e as CustomEvent<{ correct?: boolean }>).detail?.correct;
        if (want === null || correct === want) fire(e);
      }),
  });
quizTrigger('quizCorrect', true);
quizTrigger('quizIncorrect', false);
quizTrigger('quizAnswered', null);

triggerRegistry.register({
  id: 'mediaEnded',
  forTypes: ['video', 'audio'],
  bind: (node, fire) => listen(node, COMPONENT_EVENTS.mediaEnded, fire),
});

/**
 * Keyboard (v4): "When Space is pressed". Works on elements, pages and the
 * whole project; the player only dispatches while the owner's page is current.
 */
triggerRegistry.register({
  id: 'key',
  owners: ['element', 'page', 'project'],
  options(raw) {
    const out: TriggerOptions = { key: isKeyId(raw.key) ? raw.key : '' };
    if (raw.shift === true) out.shift = true;
    if (raw.alt === true) out.alt = true;
    if (raw.repeat === true) out.repeat = true;
    return out;
  },
  bind: (_node, fire, ctx) => ctx.onKey(keySpec(ctx.options), fire),
});

const pageEvent = (win: Window, type: string) => new ((win as typeof window).CustomEvent ?? CustomEvent)(type);

/** "When the slide opens" (v4): each time the slide is shown / the section becomes the current one. */
triggerRegistry.register({
  id: 'pageStart',
  owners: ['page'],
  bind: (_node, fire, ctx) => ctx.onEnter(() => fire(pageEvent(ctx.win, 'ofs-page-start'))),
});

export const MAX_DELAY_SECONDS = 600;

/** "After N seconds on this slide" (v4): restarts on every visit, cancelled when leaving. */
triggerRegistry.register({
  id: 'pageTimer',
  owners: ['page'],
  options(raw) {
    const n = Number(raw.seconds);
    return { seconds: Number.isFinite(n) ? Math.max(0, Math.min(MAX_DELAY_SECONDS, n)) : 3 };
  },
  bind(_node, fire, ctx) {
    let t: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (t !== undefined) ctx.win.clearTimeout(t);
      t = undefined;
    };
    const offEnter = ctx.onEnter(() => {
      stop();
      const s = Number(ctx.options.seconds);
      t = ctx.win.setTimeout(() => fire(pageEvent(ctx.win, 'ofs-page-timer')), Math.max(0, Number.isFinite(s) ? s : 3) * 1000);
    });
    const offLeave = ctx.onLeave(stop);
    return () => {
      stop();
      offEnter();
      offLeave();
    };
  },
});
