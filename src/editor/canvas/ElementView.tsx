import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import type { SceneElement } from '../../model/types';
import type { RuntimeEnv } from '../../runtime/env';
import { renderContent } from '../../runtime/mount';
import { fontStack } from '../../runtime/fonts';
import { EDITOR_ELEMENTS } from '../catalog';
import { updateElement } from '../ops';
import { useEditor } from '../store/store';

interface Props {
  el: SceneElement;
  env: RuntimeEnv;
  top: number;
  editing: boolean;
  highlighted: boolean;
}

/**
 * Renders one element on the editor canvas using the playback runtime's own
 * renderer, so what authors see matches Preview and exports exactly.
 */
export const ElementView = memo(function ElementView({ el, env, top, editing, highlighted }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = contentRef.current;
    if (!host) return;
    const c = renderContent(el, env, document);
    host.appendChild(c.node);
    // Text boxes grow to fit their content (e.g. after a font-size change).
    if (el.type === 'text') {
      const body = c.node.querySelector<HTMLElement>('.ofs-text-body');
      const pad = Number((el.props as { padding?: number }).padding) || 0;
      const needed = body ? Math.ceil(body.offsetHeight + pad * 2) : 0;
      if (needed > el.h + 1) {
        const id = el.id;
        queueMicrotask(() =>
          useEditor.getState().amend((d) => {
            for (const pg of d.pages) {
              const t = pg.elements.find((x) => x.id === id);
              if (t && t.h < needed) t.h = needed;
            }
          }),
        );
      }
    }
    return () => {
      c.destroy();
      c.node.remove();
    };
    // Re-render content only when its appearance can change (not on move).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el.props, el.w, el.h, el.type, env]);

  return (
    <div
      className={`ofs-el ed-el ${el.hidden ? 'is-hidden-start' : ''} ${el.locked ? 'is-locked' : ''} ${highlighted ? 'is-highlight' : ''}`}
      data-id={el.id}
      data-name={el.name}
      style={{
        left: el.x,
        top: top + el.y,
        width: Math.max(1, el.w),
        height: Math.max(1, el.h),
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
      }}
    >
      <div className="ofs-anim" ref={contentRef} style={editing ? { visibility: 'hidden' } : undefined} />
      {editing && <InlineTextEditor el={el} />}
    </div>
  );
});

function InlineTextEditor({ el }: { el: SceneElement }) {
  const def = EDITOR_ELEMENTS[el.type];
  const key = def?.inlineText ?? 'text';
  const p = el.props as Record<string, unknown>;
  const ref = useRef<HTMLTextAreaElement>(null);
  const isButton = el.type === 'button' || el.type === 'navButton';
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus();
    t.select();
  }, []);
  const finish = () => useEditor.getState().set({ editingTextId: null });
  const style: React.CSSProperties = isButton
    ? {
        fontFamily: fontStack(p.font),
        fontSize: Number(p.size) || 20,
        fontWeight: 800,
        textAlign: 'center',
        lineHeight: `${el.h}px`,
        padding: 0,
        color: '#1d1b2c',
        background: 'rgba(255,255,255,.95)',
        borderRadius: 12,
      }
    : {
        fontFamily: fontStack(p.font),
        fontSize: Number(p.size) || 24,
        fontWeight: Number(p.weight) || 400,
        fontStyle: p.italic ? 'italic' : 'normal',
        lineHeight: String(p.lineHeight ?? 1.25),
        letterSpacing: `${Number(p.letterSpacing) || 0}em`,
        textAlign: (p.align as 'left') ?? 'left',
        color: String(p.color ?? '#1d1b2c'),
        padding: Number(p.padding) || 0,
        background: p.background && p.background !== 'transparent' ? String(p.background) : 'transparent',
        borderRadius: Number(p.radius) || 0,
      };
  return (
    <textarea
      ref={ref}
      className="ed-inline-text"
      aria-label="Edit text"
      value={String(p[key] ?? '')}
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || (isButton && e.key === 'Enter')) {
          e.preventDefault();
          finish();
        }
      }}
      onBlur={finish}
      onChange={(e) => {
        const value = isButton ? e.target.value.replace(/\n/g, ' ') : e.target.value;
        const ta = e.target;
        updateElement(
          el.id,
          (d) => {
            (d.props as Record<string, unknown>)[key] = value;
            if (!isButton && ta.scrollHeight > d.h + 1) d.h = Math.ceil(ta.scrollHeight);
          },
          'inline-text',
        );
      }}
    />
  );
}
