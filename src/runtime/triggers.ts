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
