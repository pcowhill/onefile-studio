import { useEffect, useRef, useState } from 'react';
import type { Interaction, ParamValue, Project } from '../../model/types';
import { describeKey, isKeyId, keyCap, keyIdFromEvent, keyLabel, keySpec, NAV_KEYS } from '../../runtime/keys';
import { Icon } from '../ui/Icon';
import type { IxOwner } from './owner';

const QUICK_KEYS = ['Space', 'Enter', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Escape'];
const MODIFIER_KEYS = new Set(['Shift', 'Alt', 'AltGraph', 'Control', 'Meta', 'CapsLock', 'OS', 'Fn', 'Hyper', 'Super']);
const NAV_ROLE: Record<string, string> = {
  Space: 'next',
  ArrowRight: 'next',
  PageDown: 'next',
  ArrowLeft: 'previous',
  PageUp: 'previous',
  Home: 'first',
  End: 'last',
};

/**
 * Friendly key chooser: "Press a key", the chosen key drawn as keycaps, a few
 * quick picks, and (tucked away) "repeat while held". Ctrl/⌘ combinations
 * are refused because they belong to the browser.
 */
export function KeyPicker({
  options,
  onChange,
  autoCapture,
  conflicts,
}: {
  options: Record<string, ParamValue>;
  onChange(patch: Record<string, ParamValue | undefined>): void;
  autoCapture?: boolean;
  conflicts: string[];
}) {
  const spec = keySpec(options);
  const [capturing, setCapturing] = useState(!!autoCapture && !spec.key);
  const [hint, setHint] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!capturing) return;
    setHint('');
    const onKey = (e: KeyboardEvent) => {
      // Capture phase + stopImmediatePropagation: editor shortcuts (Delete, arrows…) must not run.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (MODIFIER_KEYS.has(e.key)) return;
      if (e.ctrlKey || e.metaKey) {
        setHint('Ctrl and ⌘ shortcuts belong to the browser. Try a key on its own, or with Shift or Alt.');
        return;
      }
      const id = keyIdFromEvent(e);
      if (!id) {
        setHint(`“${e.key}” can't be used. Try a letter, a number, Space, Enter or an arrow key.`);
        return;
      }
      onChange({ key: id, shift: e.shiftKey && /^[a-z0-9]$|^[A-Z]/.test(id) ? true : undefined, alt: e.altKey || undefined });
      setCapturing(false);
    };
    const outside = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setCapturing(false);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', outside, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', outside, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing]);

  const caps = [spec.shift ? 'Shift' : '', spec.alt ? 'Alt' : '', spec.key ? keyCap(spec.key) : ''].filter(Boolean);
  return (
    <div className="ed-keypick" ref={boxRef} data-testid="key-picker">
      {capturing ? (
        <div className="ed-keypick-capture" role="status" aria-live="polite">
          <span className="ed-keypick-pulse">
            <Icon name="keyboard" size={18} />
          </span>
          <span>
            <strong>Press a key…</strong>
            <small>{hint || 'Letters, numbers, Space, Enter, arrows. Add Shift or Alt if you like.'}</small>
          </span>
          <button className="ed-btn ed-btn-xs ed-btn-ghost" onClick={() => setCapturing(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="ed-keypick-row">
          {spec.key ? (
            <button
              className="ed-keycaps"
              onClick={() => setCapturing(true)}
              title="Change the key"
              aria-label={`Key: ${describeKey(spec)}. Change`}
              data-testid="key-current"
            >
              {caps.map((c, i) => (
                <span key={i} className="ed-keycap-wrap">
                  {i > 0 && <span className="ed-keycap-plus">+</span>}
                  <kbd className={`ed-keycap ${c.length > 2 ? 'is-wide' : ''}`}>{c}</kbd>
                </span>
              ))}
            </button>
          ) : null}
          <button className={`ed-btn ed-btn-sm ${spec.key ? 'ed-btn-ghost' : 'ed-btn-primary'}`} onClick={() => setCapturing(true)} data-testid="press-key">
            <Icon name="keyboard" size={15} /> {spec.key ? 'Change' : 'Press a key'}
          </button>
        </div>
      )}
      {!spec.key && !capturing && (
        <div className="ed-keypick-quick" aria-label="Common keys">
          {QUICK_KEYS.map((k) => (
            <button key={k} className="ed-keycap is-button" title={keyLabel(k)} onClick={() => onChange({ key: k, shift: undefined, alt: undefined })}>
              {keyCap(k)}
            </button>
          ))}
        </div>
      )}
      {spec.key && (
        <label className="ed-keypick-repeat">
          <input type="checkbox" checked={spec.repeat} onChange={(e) => onChange({ repeat: e.target.checked || undefined })} />
          Repeat while the key is held down
        </label>
      )}
      {conflicts.map((c) => (
        <p key={c} className="ed-keypick-note">
          <Icon name="info" size={13} /> {c}
        </p>
      ))}
    </div>
  );
}

/** Notes about a key choice: replacing built-in slide navigation, or sharing a key with another rule. */
export function keyConflicts(project: Project, owner: IxOwner, ix: Interaction, scope: 'page' | 'project' = 'page'): string[] {
  const spec = keySpec(ix.options);
  if (!spec.key || !isKeyId(spec.key)) return [];
  const out: string[] = [];
  const everywhere = scope === 'project';
  if (project.kind === 'slides' && NAV_KEYS.has(spec.key) && !spec.shift && !spec.alt)
    out.push(
      `${keyLabel(spec.key)} normally goes to the ${NAV_ROLE[spec.key]} slide. This rule replaces that ${everywhere ? 'on every slide' : 'while this slide is showing'}.`,
    );
  const same = (other: Interaction) =>
    other.id !== ix.id &&
    other.trigger === 'key' &&
    (() => {
      const o = keySpec(other.options);
      return o.key === spec.key && o.shift === spec.shift && o.alt === spec.alt;
    })();
  const pages = everywhere ? project.pages : project.pages.filter((p) => p.id === owner.pageId);
  const lists = [project.interactions ?? [], ...pages.flatMap((p) => [p.interactions ?? [], ...p.elements.map((e) => e.interactions)])];
  if (lists.some((l) => l.some(same))) out.push(`Another interaction also uses ${describeKey(spec)} — both will run.`);
  return out;
}
