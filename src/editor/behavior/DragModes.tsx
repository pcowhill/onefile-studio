import { useEffect, useRef } from 'react';
import type { SceneElement } from '../../model/types';
import { dragFeel, dragRegistry, poseTransform } from '../../runtime/drag';
import { updateElement } from '../ops';
import { Field, Slider } from '../ui/controls';
import { Icon } from '../ui/Icon';

const MODES = [
  { id: 'rigid', label: 'Rigid', hint: 'Direct and precise' },
  { id: 'floaty', label: 'Floaty', hint: 'Playful and springy' },
  { id: 'weighted', label: 'Weighted', hint: 'Physical, with momentum' },
] as const;

function ModeArt({ mode }: { mode: string }) {
  return (
    <svg viewBox="0 0 96 60" aria-hidden="true" className="ed-dragmode-art">
      {mode === 'rigid' && (
        <>
          <rect x="12" y="18" width="30" height="24" rx="5" fill="currentColor" opacity=".25" />
          <rect x="52" y="18" width="30" height="24" rx="5" fill="currentColor" />
          <path d="M30 30h26" stroke="#2a2340" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 6" />
          <path d="M70 37l4 9 2-4 4-1z" fill="#fff" stroke="#2a2340" strokeWidth="2" strokeLinejoin="round" />
        </>
      )}
      {mode === 'floaty' && (
        <>
          <path d="M8 44c8-10 16-10 24 0s16 10 24 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".35" />
          <g transform="rotate(-12 64 28)">
            <rect x="49" y="15" width="32" height="25" rx="6" fill="currentColor" />
          </g>
          <path d="M44 14l-5-4M46 24h-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".6" />
          <path d="M66 18l4 9 2-4 4-1z" fill="#fff" stroke="#2a2340" strokeWidth="2" strokeLinejoin="round" />
        </>
      )}
      {mode === 'weighted' && (
        <>
          <g transform="rotate(24 46 32)">
            <rect x="30" y="18" width="34" height="27" rx="5" fill="currentColor" />
            <rect x="30" y="18" width="34" height="27" rx="5" fill="none" stroke="#2a2340" strokeWidth="2" opacity=".25" />
          </g>
          <path d="M14 22a30 30 0 0 1 14-10M12 34a34 34 0 0 1 4-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".45" />
          <circle cx="62" cy="47" r="4" fill="#2a2340" />
          <path d="M64 46l14-6" stroke="#2a2340" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 4" />
          <path d="M78 36l4 9 2-4 4-1z" fill="#fff" stroke="#2a2340" strokeWidth="2" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/**
 * "Viewers can drag it" with three illustrated feels, a couple of sliders for
 * the physics modes and a small playground running the real runtime mode.
 */
export function DragModePicker({ el }: { el: SceneElement }) {
  const mode = el.drag?.mode ?? null;
  const feel = dragFeel(el.drag);
  const set = (patch: Partial<NonNullable<SceneElement['drag']>> | null, merge?: string) =>
    updateElement(
      el.id,
      (d) => {
        if (patch === null) d.drag = null;
        else {
          const next = { ...(d.drag ?? { mode: 'rigid' }), ...patch };
          if (next.mode === 'rigid') {
            delete next.amount;
            delete next.settle;
          }
          d.drag = next;
        }
      },
      merge,
    );
  return (
    <div className="ed-dragmodes" data-testid="drag-modes">
      <div className="ed-dragmodes-head">
        <Icon name="hand" size={16} />
        <strong>Viewers can drag it</strong>
      </div>
      <div className="ed-dragmode-grid" role="radiogroup" aria-label="Dragging">
        <button role="radio" aria-checked={!mode} className={`ed-dragmode is-none ${!mode ? 'is-on' : ''}`} onClick={() => set(null)} data-testid="drag-none">
          <Icon name="lock" size={18} />
          <span>Off</span>
        </button>
        {MODES.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={mode === m.id}
            className={`ed-dragmode ${mode === m.id ? 'is-on' : ''}`}
            onClick={() => set({ mode: m.id })}
            data-testid={`drag-${m.id}`}
            title={m.hint}
          >
            <ModeArt mode={m.id} />
            <strong>{m.label}</strong>
            <small>{m.hint}</small>
          </button>
        ))}
      </div>
      {mode && mode !== 'rigid' && (
        <>
          <Field label={mode === 'floaty' ? 'Playfulness' : 'Weight'}>
            <Slider value={Math.round(feel.amount * 100)} min={0} max={100} onChange={(v) => set({ amount: v / 100 }, 'drag-amount')} unit="%" />
          </Field>
          <Field label={mode === 'floaty' ? 'Settling speed' : 'Slows down'}>
            <Slider value={Math.round(feel.settle * 100)} min={0} max={100} onChange={(v) => set({ settle: v / 100 }, 'drag-settle')} unit="%" />
          </Field>
        </>
      )}
      {mode && <DragPlayground mode={mode} amount={feel.amount} settle={feel.settle} />}
      {mode && <p className="ed-note">Works in Preview and in the exported file. Positions reset when the file is opened again.</p>}
    </div>
  );
}

/** A tiny stage where the author can feel the chosen mode (the same runtime code as playback). */
function DragPlayground({ mode, amount, settle }: { mode: string; amount: number; settle: number }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    const def = dragRegistry.get(mode);
    if (!stage || !card || !def) return;
    const W = stage.clientWidth || 260;
    const H = stage.clientHeight || 120;
    const el = { id: 'demo', type: 'shape', name: 'Demo', x: W / 2 - 40, y: H / 2 - 26, w: 80, h: 52, rotation: 0 } as SceneElement;
    const pos = { x: el.x, y: el.y };
    let angle = 0;
    const place = (t = '') => {
      card.style.left = `${pos.x}px`;
      card.style.top = `${pos.y}px`;
      card.style.transform = t;
    };
    place();
    const off = def.attach(card, {
      el,
      feel: { amount, settle },
      scale: () => 1,
      bounds: () => ({ w: stage.clientWidth || W, h: stage.clientHeight || H }),
      position: () => pos,
      moveTo(x, y) {
        pos.x = x;
        pos.y = y;
        place(card.style.transform);
      },
      angle: () => angle,
      setPose(p) {
        pos.x = p.x;
        pos.y = p.y;
        angle = p.angle;
        place(poseTransform(p.angle, p.stretch, p.stretchAngle));
      },
      toLocal(cx, cy) {
        const r = stage.getBoundingClientRect();
        return { x: cx - r.left, y: cy - r.top };
      },
      win: window,
    });
    return () => {
      off();
      card.classList.remove('ofs-draggable', 'ofs-dragging');
    };
  }, [mode, amount, settle]);
  return (
    <div className="ed-dragplay" ref={stageRef} data-testid="drag-playground">
      <span className="ed-dragplay-hint">Try it: drag the card</span>
      <div className="ed-dragplay-card" ref={cardRef}>
        <Icon name="hand" size={18} />
      </div>
    </div>
  );
}
