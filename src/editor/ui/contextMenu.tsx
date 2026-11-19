import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Icon } from './Icon';

export interface MenuItem {
  label?: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  title?: string;
  onClick?(): void;
}

interface MenuState {
  menu: { x: number; y: number; items: MenuItem[]; title?: string } | null;
}
const useMenu = create<MenuState>(() => ({ menu: null }));

export function openContextMenu(x: number, y: number, items: MenuItem[], title?: string) {
  useMenu.setState({ menu: { x, y, items, title } });
}
export function closeContextMenu() {
  useMenu.setState({ menu: null });
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const mod = isMac ? '⌘' : 'Ctrl+';

/** The editor's custom right-click menu (only shown over editor surfaces). */
export function ContextMenu() {
  const menu = useMenu((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    // offsetWidth/Height ignore the opening animation's transform.
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    setPos({ x: Math.max(8, Math.min(menu.x, window.innerWidth - w - 8)), y: Math.max(8, Math.min(menu.y, window.innerHeight - h - 8)) });
    ref.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e.type === 'pointerdown' && ref.current?.contains(e.target as Node)) return;
      closeContextMenu();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length]?.focus();
      }
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', key);
    };
  }, [menu]);
  if (!menu) return null;
  return (
    <div ref={ref} className="ed-menu" role="menu" style={{ left: pos.x || menu.x, top: pos.y || menu.y }} onContextMenu={(e) => e.preventDefault()}>
      {menu.title && <div className="ed-menu-title">{menu.title}</div>}
      {menu.items.map((it, i) =>
        it.divider ? (
          <div key={i} className="ed-menu-sep" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`ed-menu-item ${it.danger ? 'is-danger' : ''}`}
            disabled={it.disabled}
            title={it.title}
            onClick={() => {
              closeContextMenu();
              it.onClick?.();
            }}
          >
            <Icon name={it.icon ?? 'sparkle'} size={17} />
            <span>{it.label}</span>
            {it.shortcut && <kbd>{it.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}
