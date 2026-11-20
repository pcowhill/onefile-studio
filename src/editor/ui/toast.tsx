import { create } from 'zustand';
import { Icon } from './Icon';

export type ToastKind = 'info' | 'success' | 'error';
export interface ToastAction {
  label: string;
  run(): void;
}
interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
  action?: ToastAction;
}
const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));
let seq = 0;

export function toast(text: string, kind: ToastKind = 'success', ms = 4200, action?: ToastAction) {
  const id = ++seq;
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind, action }] }));
  setTimeout(() => useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="ed-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`ed-toast ed-toast-${t.kind}`}>
          <Icon name={t.kind === 'error' ? 'warning' : t.kind === 'info' ? 'info' : 'check'} size={18} />
          <span>{t.text}</span>
          {t.action && (
            <button
              className="ed-toast-action"
              onClick={() => {
                t.action!.run();
                useToasts.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            className="ed-toast-close"
            aria-label="Dismiss"
            onClick={() => useToasts.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }))}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
