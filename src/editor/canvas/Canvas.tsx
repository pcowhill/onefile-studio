import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Page, Project, SceneElement } from '../../model/types';
import { createStaticEnv } from '../../runtime/env';
import type { RuntimeEnv } from '../../runtime/env';
import { applyBackground, pageHeight } from '../../runtime/mount';
import type { ArrowProps } from '../../runtime/elements/arrow';
import { editor, findEl, useEditor } from '../store/store';
import { ElementView } from './ElementView';
import { resizeBox, snapBox } from './snap';
import type { Box, Guide, Handle } from './snap';
import { EDITOR_ELEMENTS } from '../catalog';
import { addImageFiles, insertImage } from '../ops';
import { elementMenu, canvasMenu } from './menus';
import { openContextMenu } from '../ui/contextMenu';
import { Icon } from '../ui/Icon';

interface View {
  page: Page;
  index: number;
  top: number;
  height: number;
}

type Gesture =
  | {
      kind: 'move';
      sx: number;
      sy: number;
      items: Array<{ id: string; x: number; y: number }>;
      pageId: string;
      moved: boolean;
      clickedId: string;
      wasSelected: boolean;
      shift: boolean;
    }
  | { kind: 'resize'; id: string; handle: Handle; sx: number; sy: number; start: Box; rotation: number; keepAspect: boolean }
  | { kind: 'rotate'; id: string; cx: number; cy: number; startAngle: number; startRotation: number }
  | { kind: 'endpoint'; id: string; which: 'start' | 'end'; fixed: { x: number; y: number }; pageTop: number }
  | { kind: 'marquee'; sx: number; sy: number; shift: boolean; base: string[] }
  | { kind: 'section'; pageId: string; sy: number; startH: number };

const PAD = 56;
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function Canvas() {
  const project = useEditor((s) => s.project)!;
  const pageId = useEditor((s) => s.pageId);
  const selection = useEditor((s) => s.selection);
  const zoomSetting = useEditor((s) => s.zoom);
  const editingTextId = useEditor((s) => s.editingTextId);
  const highlightId = useEditor((s) => s.highlightId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [guides, setGuides] = useState<Array<Guide & { top: number; len: number }>>([]);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const slides = project.kind === 'slides';
  const W = project.settings.width;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const views: View[] = useMemo(() => {
    if (slides) {
      const index = Math.max(
        0,
        project.pages.findIndex((p) => p.id === pageId),
      );
      const page = project.pages[index];
      return [{ page, index, top: 0, height: project.settings.height }];
    }
    let top = 0;
    return project.pages.map((page, index) => {
      const v = { page, index, top, height: pageHeight(project, page) };
      top += v.height;
      return v;
    });
  }, [project, pageId, slides]);
  const totalH = views.reduce((s, v) => s + v.height, 0);

  const fit = slides ? Math.min((size.w - PAD * 2) / W, (size.h - PAD * 2) / project.settings.height) : Math.min(1, (size.w - PAD * 2) / W);
  const z = Math.max(0.1, zoomSetting ?? fit);
  useEffect(() => {
    if (Math.abs(editor().fitZoom - fit) > 0.001) editor().set({ fitZoom: fit });
  }, [fit]);

  const stageW = W * z;
  const stageH = totalH * z;
  const innerW = Math.max(size.w, stageW + PAD * 2);
  const innerH = Math.max(size.h, stageH + PAD * 2);
  const stageLeft = (innerW - stageW) / 2;
  const stageTop = slides ? Math.max(PAD, (innerH - stageH) / 2) : PAD;

  // Envs: one per view (slides need their index for progress bars).
  const envCache = useRef(new Map<string, RuntimeEnv>());
  const envFor = useCallback(
    (index: number) => {
      const key = `${index}`;
      const cached = envCache.current.get(key);
      if (
        cached &&
        cached.project.assets === project.assets &&
        cached.project.variables === project.variables &&
        cached.nav.count === project.pages.length &&
        cached.project.kind === project.kind
      )
        return cached;
      const env = createStaticEnv(project, 'edit', index);
      envCache.current.set(key, env);
      return env;
    },
    [project],
  );

  const pageTop = useCallback((pid: string) => views.find((v) => v.page.id === pid)?.top ?? 0, [views]);

  /** Converts a client point to logical stage coordinates. */
  const toLogical = (cx: number, cy: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: (cx - r.left) / z, y: (cy - r.top) / z };
  };
  const viewAt = (gy: number) => views.find((v) => gy >= v.top && gy < v.top + v.height) ?? (gy < 0 ? views[0] : views[views.length - 1]);

  // ---------- gestures ----------
  const onWindowMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const s = editor();
    const p = s.project!;
    if (g.kind === 'move') {
      let dx = (e.clientX - g.sx) / z;
      let dy = (e.clientY - g.sy) / z;
      if (!g.moved && Math.hypot(dx * z, dy * z) < 3) return;
      if (!g.moved) {
        g.moved = true;
        s.begin();
      }
      const pg = p.pages.find((x) => x.id === g.pageId)!;
      const sel = g.items.map((it) => ({ it, el: findEl(p, it.id)?.el })).filter((x) => x.el);
      const bx = Math.min(...sel.map((x) => x.it.x));
      const by = Math.min(...sel.map((x) => x.it.y));
      const box = { x: bx + dx, y: by + dy, w: Math.max(...sel.map((x) => x.it.x + x.el!.w)) - bx, h: Math.max(...sel.map((x) => x.it.y + x.el!.h)) - by };
      if (!e.altKey) {
        const others = pg.elements.filter((o) => !g.items.some((it) => it.id === o.id) && !o.hidden).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
        const ph = pageHeight(p, pg);
        const snap = snapBox(box, others, { w: W, h: ph }, 7 / z);
        dx += snap.dx;
        dy += snap.dy;
        const top = pageTop(pg.id);
        setGuides(snap.guides.map((gd) => ({ ...gd, top, len: gd.axis === 'x' ? ph : W })));
      } else setGuides([]);
      s.live((d) => {
        for (const it of g.items) {
          const f = findEl(d, it.id);
          if (f) {
            f.el.x = Math.round(it.x + dx);
            f.el.y = Math.round(it.y + dy);
          }
        }
      });
    } else if (g.kind === 'resize') {
      const dx = (e.clientX - g.sx) / z;
      const dy = (e.clientY - g.sy) / z;
      const keep = e.shiftKey ? !g.keepAspect : g.keepAspect;
      const b = resizeBox(g.start, g.rotation, g.handle, dx, dy, keep);
      s.live((d) => {
        const f = findEl(d, g.id);
        if (f) Object.assign(f.el, b);
      });
    } else if (g.kind === 'rotate') {
      let a = (Math.atan2(e.clientY - g.cy, e.clientX - g.cx) * 180) / Math.PI;
      let r = g.startRotation + (a - g.startAngle);
      r = ((((r + 180) % 360) + 360) % 360) - 180;
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      else for (const snapA of [-180, -90, 0, 90, 180]) if (Math.abs(r - snapA) < 4) r = snapA;
      a = Math.round(r);
      s.live((d) => {
        const f = findEl(d, g.id);
        if (f) f.el.rotation = a === -180 ? 180 : a;
      });
    } else if (g.kind === 'endpoint') {
      const pt = toLogical(e.clientX, e.clientY);
      const local = { x: pt.x, y: pt.y - g.pageTop };
      s.live((d) => {
        const f = findEl(d, g.id);
        if (!f) return;
        const props = f.el.props as unknown as ArrowProps;
        const pad = Math.max(18, (props.width || 6) * 2.2);
        const a = g.which === 'start' ? local : g.fixed;
        const b = g.which === 'start' ? g.fixed : local;
        const minX = Math.min(a.x, b.x) - pad;
        const minY = Math.min(a.y, b.y) - pad;
        const w = Math.max(pad * 2, Math.abs(a.x - b.x) + pad * 2);
        const h = Math.max(pad * 2, Math.abs(a.y - b.y) + pad * 2);
        f.el.x = Math.round(minX);
        f.el.y = Math.round(minY);
        f.el.w = Math.round(w);
        f.el.h = Math.round(h);
        f.el.rotation = 0;
        props.start = { x: round3((a.x - minX) / w), y: round3((a.y - minY) / h) };
        props.end = { x: round3((b.x - minX) / w), y: round3((b.y - minY) / h) };
      });
    } else if (g.kind === 'marquee') {
      const a = toLogical(g.sx, g.sy);
      const b = toLogical(e.clientX, e.clientY);
      const box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
      setMarquee(box);
      const hits: string[] = [];
      for (const v of views)
        for (const el of v.page.elements) {
          if (el.locked) continue;
          const ey = v.top + el.y;
          if (el.x < box.x + box.w && el.x + el.w > box.x && ey < box.y + box.h && ey + el.h > box.y) hits.push(el.id);
        }
      const next = g.shift ? [...new Set([...g.base, ...hits])] : hits;
      s.select(next);
    } else if (g.kind === 'section') {
      const dy = (e.clientY - g.sy) / z;
      s.live((d) => {
        const pg = d.pages.find((x) => x.id === g.pageId);
        if (pg) pg.height = Math.max(120, Math.round(g.startH + dy));
      });
    }
  };

  const onWindowUp = () => {
    const g = gesture.current;
    gesture.current = null;
    setGuides([]);
    setMarquee(null);
    if (!g) return;
    const s = editor();
    if (g.kind === 'move') {
      if (!g.moved) {
        if (!g.shift && g.wasSelected && s.selection.length > 1) s.select([g.clickedId]);
        return;
      }
      if (!slides) reparentAfterMove(g.items.map((i) => i.id));
      s.commit();
    } else if (g.kind !== 'marquee') {
      s.commit();
    }
  };

  // Window listeners are attached once and dispatch to the latest handlers, so
  // re-renders during a gesture never detach them.
  const moveRef = useRef(onWindowMove);
  const upRef = useRef(onWindowUp);
  moveRef.current = onWindowMove;
  upRef.current = onWindowUp;
  useEffect(() => {
    const move = (e: PointerEvent) => gesture.current && moveRef.current(e);
    const up = () => gesture.current && upRef.current();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  const startGesture = (g: Gesture) => {
    gesture.current = g;
  };

  function reparentAfterMove(ids: string[]) {
    const s = editor();
    s.live((d) => {
      let top = 0;
      const tops = d.pages.map((p) => {
        const t = top;
        top += pageHeight(d, p);
        return t;
      });
      for (const id of ids) {
        const f = findEl(d, id);
        if (!f) continue;
        const fromIdx = d.pages.indexOf(f.page);
        const cy = tops[fromIdx] + f.el.y + f.el.h / 2;
        let toIdx = tops.findIndex((t, i) => cy >= t && cy < t + pageHeight(d, d.pages[i]));
        if (toIdx < 0) toIdx = cy < 0 ? 0 : d.pages.length - 1;
        if (toIdx === fromIdx) continue;
        f.page.elements.splice(f.index, 1);
        f.el.y = Math.round(f.el.y + tops[fromIdx] - tops[toIdx]);
        d.pages[toIdx].elements.push(f.el);
      }
    });
  }

  const onElementPointerDown = (e: React.PointerEvent, el: SceneElement, page: Page) => {
    if (e.button !== 0) return;
    const s = editor();
    if (s.editingTextId === el.id) return;
    e.stopPropagation();
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (page.id !== s.pageId) s.setPage(page.id);
    const wasSelected = s.selection.includes(el.id);
    let sel = s.selection;
    if (e.shiftKey) sel = wasSelected ? sel.filter((x) => x !== el.id) : [...sel, el.id];
    else if (!wasSelected) sel = [el.id];
    s.select(sel);
    if (!sel.includes(el.id)) return;
    const p = editor().project!;
    const items = sel
      .map((id) => findEl(p, id))
      .filter((f): f is NonNullable<typeof f> => !!f && !f.el.locked && f.page.id === page.id)
      .map((f) => ({ id: f.el.id, x: f.el.x, y: f.el.y }));
    if (!items.length) return;
    startGesture({ kind: 'move', sx: e.clientX, sy: e.clientY, items, pageId: page.id, moved: false, clickedId: el.id, wasSelected, shift: e.shiftKey });
  };

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.ed-el, .ed-handle, .ed-zoom, .ed-section-tab')) return;
    const s = editor();
    if (s.editingTextId) s.set({ editingTextId: null });
    if (!slides && stageRef.current) {
      const pt = toLogical(e.clientX, e.clientY);
      if (pt.x >= 0 && pt.x <= W) {
        const v = viewAt(pt.y);
        if (v && v.page.id !== s.pageId) s.setPage(v.page.id);
      }
    }
    const base = e.shiftKey ? editor().selection : [];
    if (!e.shiftKey) editor().select([]);
    startGesture({ kind: 'marquee', sx: e.clientX, sy: e.clientY, shift: e.shiftKey, base });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('textarea')) return;
    e.preventDefault();
    const elNode = target.closest<HTMLElement>('.ed-el');
    const s = editor();
    if (elNode?.dataset.id) {
      const id = elNode.dataset.id;
      const f = findEl(s.project!, id);
      if (f && f.page.id !== s.pageId) s.setPage(f.page.id);
      if (!editor().selection.includes(id)) s.select([id]);
      const els = editor()
        .selection.map((x) => findEl(s.project!, x)?.el)
        .filter((x): x is SceneElement => !!x);
      openContextMenu(e.clientX, e.clientY, elementMenu(els), els.length > 1 ? `${els.length} elements` : els[0]?.name);
    } else {
      if (!slides && stageRef.current) {
        const pt = toLogical(e.clientX, e.clientY);
        const v = viewAt(pt.y);
        if (v) s.setPage(v.page.id);
      }
      openContextMenu(e.clientX, e.clientY, canvasMenu(), slides ? 'Slide' : 'Section');
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const elNode = (e.target as HTMLElement).closest<HTMLElement>('.ed-el');
    const id = elNode?.dataset.id;
    if (!id) return;
    const f = findEl(editor().project!, id);
    if (f && EDITOR_ELEMENTS[f.el.type]?.inlineText && !f.el.locked) {
      editor().select([id]);
      editor().set({ editingTextId: id });
    } else if (f) {
      editor().set({ inspectorTab: 'design' });
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const next = Math.max(0.1, Math.min(4, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    editor().set({ zoom: next });
  };

  const onDrop = async (e: React.DragEvent) => {
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    const pt = toLogical(e.clientX, e.clientY);
    if (!slides) {
      const v = viewAt(pt.y);
      if (v) editor().setPage(v.page.id);
    }
    const assets = await addImageFiles(files);
    for (const a of assets) insertImage(a);
  };

  // Non-passive wheel listener so ctrl+wheel zoom can preventDefault.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, []);

  const selected = selection.map((id) => findEl(project, id)).filter((f): f is NonNullable<typeof f> => !!f && views.some((v) => v.page.id === f.page.id));

  return (
    <div
      className={`ed-canvas ${slides ? 'is-slides' : 'is-page'}`}
      ref={scrollRef}
      onPointerDown={onBackgroundPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) e.preventDefault();
      }}
      onDrop={(e) => void onDrop(e)}
      data-testid="canvas"
    >
      <div className="ed-canvas-inner" style={{ width: innerW, height: innerH }}>
        <div ref={stageRef} className="ed-stage" style={{ left: stageLeft, top: stageTop, width: stageW, height: stageH }}>
          <div className="ed-stage-scale ofs-editing" style={{ width: W, height: totalH, transform: `scale(${z})`, ['--z' as string]: z }}>
            {views.map((v) => (
              <PageBackground
                key={v.page.id + ':bg'}
                project={project}
                page={v.page}
                top={v.top}
                height={v.height}
                active={v.page.id === pageId}
                slides={slides}
              />
            ))}
            {views.map((v) =>
              v.page.elements.map((el) => (
                <div key={el.id} onPointerDown={(e) => onElementPointerDown(e, el, v.page)} style={{ display: 'contents' }}>
                  <ElementView el={el} env={envFor(v.index)} top={v.top} editing={editingTextId === el.id} highlighted={highlightId === el.id} />
                </div>
              )),
            )}
          </div>
          {/* Screen-space overlay: selection, handles, guides */}
          <div className="ed-overlay">
            {!slides &&
              views.map((v) => (
                <div key={v.page.id} className={`ed-section-frame ${v.page.id === pageId ? 'is-active' : ''}`} style={{ top: v.top * z, height: v.height * z }}>
                  <button className="ed-section-tab" onPointerDown={(e) => e.stopPropagation()} onClick={() => editor().setPage(v.page.id)}>
                    {v.index + 1}. {v.page.name}
                  </button>
                  <div
                    className="ed-handle ed-section-resize"
                    title="Drag to change the section height"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      editor().setPage(v.page.id);
                      editor().begin();
                      startGesture({ kind: 'section', pageId: v.page.id, sy: e.clientY, startH: v.height });
                    }}
                  >
                    <span>
                      <Icon name="drag" size={14} /> {Math.round(v.height)} px
                    </span>
                  </div>
                </div>
              ))}
            {selected.map(({ el, page }) => (
              <SelectionBox
                key={el.id}
                el={el}
                top={pageTop(page.id)}
                z={z}
                single={selected.length === 1}
                onHandle={(h, e) => {
                  e.stopPropagation();
                  editor().begin();
                  startGesture({
                    kind: 'resize',
                    id: el.id,
                    handle: h,
                    sx: e.clientX,
                    sy: e.clientY,
                    start: { x: el.x, y: el.y, w: el.w, h: el.h },
                    rotation: el.rotation,
                    keepAspect: !!EDITOR_ELEMENTS[el.type]?.keepAspect,
                  });
                }}
                onRotate={(e) => {
                  e.stopPropagation();
                  const r = stageRef.current!.getBoundingClientRect();
                  const cx = r.left + (el.x + el.w / 2) * z;
                  const cy = r.top + (pageTop(page.id) + el.y + el.h / 2) * z;
                  editor().begin();
                  startGesture({
                    kind: 'rotate',
                    id: el.id,
                    cx,
                    cy,
                    startAngle: (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI,
                    startRotation: el.rotation,
                  });
                }}
                onEndpoint={(which, e) => {
                  e.stopPropagation();
                  const ends = arrowEnds(el);
                  editor().begin();
                  startGesture({ kind: 'endpoint', id: el.id, which, fixed: which === 'start' ? ends.end : ends.start, pageTop: pageTop(page.id) });
                }}
              />
            ))}
            {guides.map((g, i) =>
              g.axis === 'x' ? (
                <div key={i} className="ed-guide ed-guide-x" style={{ left: g.pos * z, top: g.top * z, height: g.len * z }} />
              ) : (
                <div key={i} className="ed-guide ed-guide-y" style={{ top: (g.top + g.pos) * z, left: 0, width: g.len * z }} />
              ),
            )}
            {marquee && <div className="ed-marquee" style={{ left: marquee.x * z, top: marquee.y * z, width: marquee.w * z, height: marquee.h * z }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Arrow endpoints in page-local logical coordinates (accounting for rotation). */
function arrowEnds(el: SceneElement) {
  const p = el.props as unknown as ArrowProps;
  const t = (el.rotation * Math.PI) / 180;
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const toGlobal = (pt: { x: number; y: number }) => {
    const lx = pt.x * el.w - el.w / 2;
    const ly = pt.y * el.h - el.h / 2;
    return { x: cx + lx * Math.cos(t) - ly * Math.sin(t), y: cy + lx * Math.sin(t) + ly * Math.cos(t) };
  };
  return { start: toGlobal(p.start), end: toGlobal(p.end) };
}

function SelectionBox({
  el,
  top,
  z,
  single,
  onHandle,
  onRotate,
  onEndpoint,
}: {
  el: SceneElement;
  top: number;
  z: number;
  single: boolean;
  onHandle(h: Handle, e: React.PointerEvent): void;
  onRotate(e: React.PointerEvent): void;
  onEndpoint(which: 'start' | 'end', e: React.PointerEvent): void;
}) {
  const isArrow = el.type === 'arrow';
  const showHandles = single && !el.locked;
  const p = el.props as unknown as ArrowProps;
  return (
    <div
      className={`ed-selbox ${el.locked ? 'is-locked' : ''}`}
      style={{ left: el.x * z, top: (top + el.y) * z, width: el.w * z, height: el.h * z, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined }}
    >
      {showHandles &&
        !isArrow &&
        HANDLES.map((h) => <div key={h} className={`ed-handle ed-handle-${h}`} onPointerDown={(e) => onHandle(h, e)} data-handle={h} />)}
      {showHandles && isArrow && (
        <>
          <div
            className="ed-handle ed-handle-end"
            style={{ left: p.start.x * el.w * z, top: p.start.y * el.h * z }}
            onPointerDown={(e) => onEndpoint('start', e)}
            data-handle="start"
            title="Drag to move the start"
          />
          <div
            className="ed-handle ed-handle-end is-head"
            style={{ left: p.end.x * el.w * z, top: p.end.y * el.h * z }}
            onPointerDown={(e) => onEndpoint('end', e)}
            data-handle="end"
            title="Drag to move the tip"
          />
        </>
      )}
      {showHandles && !isArrow && (
        <div className="ed-handle ed-handle-rotate" onPointerDown={onRotate} title="Drag to rotate (Shift snaps)" data-handle="rotate">
          <Icon name="rotate" size={12} stroke={2.6} />
        </div>
      )}
      {el.locked && single && (
        <div className="ed-lock-badge">
          <Icon name="lock" size={12} /> Locked
        </div>
      )}
    </div>
  );
}

/** Page background layer (also handles the active-section highlight). */
function PageBackground({
  project,
  page,
  top,
  height,
  active,
  slides,
}: {
  project: Project;
  page: Page;
  top: number;
  height: number;
  active: boolean;
  slides: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.replaceChildren();
    applyBackground(node, page.background, project, document);
    // project.assets is the only other input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.background, project.assets]);
  return <div ref={ref} className={`ed-page-bg ${active && !slides ? 'is-active' : ''}`} style={{ top, height, width: project.settings.width }} />;
}
