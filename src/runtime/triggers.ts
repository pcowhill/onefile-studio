import { Registry } from './registry';

/**
 * A trigger binds a DOM listener to an element and calls `fire` when the
 * configured event happens. Add hover/keyboard/timer triggers by registering
 * new definitions here (and a matching card in the editor's trigger catalog).
 */
export interface TriggerDef {
  id: string;
  /** Makes the element look clickable (pointer cursor, keyboard focus). */
  clickable?: boolean;
  /** Only meaningful on these element types (component events). */
  forTypes?: string[];
  bind(node: HTMLElement, fire: (e: Event) => void): () => void;
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
