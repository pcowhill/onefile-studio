import type { ParamValue } from '../model/types';

/**
 * Keyboard triggers (v4). A key is stored as a small, layout-friendly id:
 * a lowercase letter ("a"), a digit ("1"), a named key ("Space", "Enter",
 * "ArrowRight"…) or one of a few punctuation characters ("?", "+"…).
 * Ctrl/⌘ combinations are never used: they belong to the browser and the OS.
 */
export interface KeySpec {
  key: string;
  shift: boolean;
  alt: boolean;
  /** Fire again while the key is held down (auto-repeat). Off by default. */
  repeat: boolean;
}

const NAMED: Record<string, { label: string; short?: string }> = {
  Space: { label: 'Space' },
  Enter: { label: 'Enter', short: '↵' },
  Escape: { label: 'Esc' },
  ArrowLeft: { label: 'Left arrow', short: '←' },
  ArrowRight: { label: 'Right arrow', short: '→' },
  ArrowUp: { label: 'Up arrow', short: '↑' },
  ArrowDown: { label: 'Down arrow', short: '↓' },
  Backspace: { label: 'Backspace', short: '⌫' },
  Delete: { label: 'Delete' },
  Home: { label: 'Home' },
  End: { label: 'End' },
  PageUp: { label: 'Page Up' },
  PageDown: { label: 'Page Down' },
};
const PUNCT = new Set(['+', '-', '=', '?', '/', '.', ',', '*', '[', ']']);

export function isKeyId(id: unknown): id is string {
  return typeof id === 'string' && (/^[a-z0-9]$/.test(id) || Object.prototype.hasOwnProperty.call(NAMED, id) || PUNCT.has(id));
}

/** Key id for a keyboard event, or null for keys triggers cannot use (modifiers alone, F-keys, Tab…). */
export function keyIdFromEvent(e: Pick<KeyboardEvent, 'key' | 'code'>): string | null {
  const k = e.key;
  if (k === ' ' || k === 'Spacebar' || e.code === 'Space') return 'Space';
  if (k === 'Esc') return 'Escape';
  if (Object.prototype.hasOwnProperty.call(NAMED, k)) return k;
  if (/^[a-zA-Z0-9]$/.test(k)) return k.toLowerCase();
  if (PUNCT.has(k)) return k;
  // Alt/Option and Shift change the character (e.g. "å", "!"): fall back to the physical key.
  const letter = /^Key([A-Z])$/.exec(e.code ?? '');
  if (letter) return letter[1].toLowerCase();
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code ?? '');
  if (digit) return digit[1];
  return null;
}

/** Human-friendly name of a key id ("Space", "Right arrow", "K", "5"). */
export function keyLabel(id: string): string {
  if (Object.prototype.hasOwnProperty.call(NAMED, id)) return NAMED[id].label;
  return id.length === 1 ? id.toUpperCase() : id;
}

/** Compact keycap text ("→", "Space", "K"). */
export function keyCap(id: string): string {
  if (Object.prototype.hasOwnProperty.call(NAMED, id)) return NAMED[id].short ?? NAMED[id].label;
  return id.length === 1 ? id.toUpperCase() : id;
}

/** "Shift + K", "Alt + 1", "Space". */
export function describeKey(spec: Pick<KeySpec, 'key' | 'shift' | 'alt'>): string {
  if (!spec.key) return 'a key';
  return [spec.shift && !PUNCT.has(spec.key) ? 'Shift' : '', spec.alt ? 'Alt' : '', keyLabel(spec.key)].filter(Boolean).join(' + ');
}

export function keySpec(options: Record<string, ParamValue> | undefined): KeySpec {
  const o = options ?? {};
  return { key: isKeyId(o.key) ? o.key : '', shift: o.shift === true, alt: o.alt === true, repeat: o.repeat === true };
}

/** Does a keydown event match the spec? Ctrl/⌘ combinations never match. */
export function matchesKey(spec: KeySpec, e: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey' | 'repeat'>): boolean {
  if (!spec.key || e.ctrlKey || e.metaKey) return false;
  if (e.repeat && !spec.repeat) return false;
  if (keyIdFromEvent(e) !== spec.key) return false;
  if (!!e.altKey !== spec.alt) return false;
  // Punctuation often needs Shift on one layout and not another ("?", "+"), so Shift is ignored for it.
  if (!PUNCT.has(spec.key) && !!e.shiftKey !== spec.shift) return false;
  return true;
}

/** Built-in slide navigation keys (author key triggers take precedence on their slide). */
export const NAV_KEYS = new Set(['Space', 'ArrowRight', 'ArrowLeft', 'PageUp', 'PageDown', 'Home', 'End']);

const TYPING_ROLES = /^(textbox|searchbox|combobox|slider|spinbutton|listbox|menu|menubar|grid|tree|radiogroup|tablist)$/;

/**
 * True when a key press belongs to something the viewer is using: a text
 * field, a slider, a select… Key triggers and slide navigation ignore those.
 */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
  const role = el.getAttribute?.('role');
  return !!role && TYPING_ROLES.test(role);
}

/**
 * Enter/Space on a focused button or link normally activates it. Keyboard
 * users (visible focus ring) keep that; after a mouse click (no focus ring)
 * the author's key trigger wins, so "press Space to continue" keeps working.
 */
export function keyActivatesFocused(t: EventTarget | null, keyId: string | null): boolean {
  if (keyId !== 'Enter' && keyId !== 'Space') return false;
  const el = t as HTMLElement | null;
  if (!el || typeof el.matches !== 'function') return false;
  if (!el.matches('button, a[href], summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"]')) return false;
  try {
    return el.matches(':focus-visible');
  } catch {
    return false;
  }
}
