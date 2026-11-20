import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

export function Modal({
  children,
  onClose,
  label,
  className = '',
  wide,
  docked,
}: {
  children: ReactNode;
  onClose(): void;
  label: string;
  className?: string;
  wide?: boolean;
  /** Docked to the left without dimming, so the canvas stays visible (live previews). */
  docked?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The latest onClose, so a parent re-rendering (a new callback) never re-runs
  // the focus handling below and steals focus from a control in the dialog.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      prev?.focus?.();
    };
  }, []);
  return createPortal(
    <div className={`ed-modal-backdrop ${docked ? 'is-docked' : ''}`} onPointerDown={(e) => e.target === e.currentTarget && closeRef.current()}>
      <div ref={ref} className={`ed-modal ${wide ? 'is-wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <button className="ed-modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
