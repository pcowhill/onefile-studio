import type { Page, Project, SceneElement } from '../model/types';
import type { Direction } from '../model/types';
import { NavStore, VarStore } from './env';
import type { RuntimeEnv } from './env';
import { applyBackground, mountElement, pageHeight, unmountElement } from './mount';
import type { MountedElement } from './mount';
import { ensureRuntimeStyles } from './styles';
import { triggerRegistry } from './triggers';
import { HIDE_EFFECTS, runInteraction, SHOW_EFFECTS } from './actions';
import type { PlayerControl } from './actions';
import { playAnimation } from './animations';
import { dragRegistry } from './drag';
import { h, icon } from './elements/types';

export interface PlayerOptions {
  /** Slide index (or section index) to start on. */
  startPage?: number;
  /** Listen to keyboard arrows for slide navigation. Default true. */
  keyboard?: boolean;
  /** Show a fullscreen button in the slide controls (standalone exports). */
  fullscreenButton?: boolean;
  onPageChange?(index: number): void;
}

export interface Player {
  root: HTMLElement;
  vars: VarStore;
  nav: NavStore;
  control: PlayerControl;
  currentPage(): number;
  goTo(target: string | number): void;
  isVisible(id: string): boolean;
  destroy(): void;
}

interface PageView {
  page: Page;
  index: number;
  node: HTMLElement;
  /** Element container in logical coordinates. */
  stage: HTMLElement;
  mounted: MountedElement[];
  observer?: IntersectionObserver;
}

/**
 * Creates an interactive player for `project` inside `container`.
 * This is THE playback engine: the editor's Preview and every exported HTML
 * file run exactly this code.
 */
export function createPlayer(container: HTMLElement, project: Project, opts: PlayerOptions = {}): Player {
  const doc = container.ownerDocument;
  const win = doc.defaultView ?? window;
  ensureRuntimeStyles(doc);
  const slides = project.kind === 'slides';
  const W = project.settings.width;
  const vars = new VarStore(project.variables);
  const nav = new NavStore();
  nav.count = project.pages.length;
  const elementState = new Map<string, unknown>();
  const visibility = new Map<string, boolean>();
  for (const p of project.pages) for (const el of p.elements) visibility.set(el.id, !el.hidden);
  const mounted = new Map<string, MountedElement>();
  const cleanups: Array<() => void> = [];
  let scale = 1;
  let destroyed = false;

  const root = h(doc, 'div', `ofs-player ofs-player-${slides ? 'slides' : 'page'}`);
  root.style.background = project.settings.backdrop || '#14112a';
  root.tabIndex = -1;
  container.appendChild(root);

  const env: RuntimeEnv = {
    mode: 'play',
    project,
    vars,
    nav,
    state: elementState,
    navigate: (t) => goTo(t),
  };

  const control: PlayerControl = {
    vars,
    isVisible: (id) => visibility.get(id) ?? false,
    async setVisible(id, visible, effect) {
      visibility.set(id, visible);
      const m = mounted.get(id);
      if (!m) return;
      if (visible) {
        m.wrapper.classList.remove('ofs-hidden', 'ofs-await');
        const preset = effect ? SHOW_EFFECTS[effect] : undefined;
        if (preset) await playAnimation(m.anim, preset, { direction: 'up' as Direction });
      } else {
        const preset = effect ? HIDE_EFFECTS[effect] : undefined;
        if (preset) await playAnimation(m.anim, preset, { direction: 'down' as Direction });
        if (!visibility.get(id)) m.wrapper.classList.add('ofs-hidden');
      }
    },
    navigate: (t) => goTo(t),
    api: (id) => mounted.get(id)?.content.api,
    animate(id, preset, o) {
      const m = mounted.get(id);
      if (!m || m.wrapper.classList.contains('ofs-hidden')) return Promise.resolve();
      return playAnimation(m.anim, preset, { duration: o.duration, direction: o.direction as Direction });
    },
  };

  // ---------- element mounting ----------
  function mount(el: SceneElement, view: PageView) {
    const m = mountElement(el, env, doc);
    mounted.set(el.id, m);
    view.mounted.push(m);
    if (!visibility.get(el.id)) m.wrapper.classList.add('ofs-hidden');
    const pos = { x: el.x, y: el.y };
    const saved = elementState.get(`pos:${el.id}`) as { x: number; y: number } | undefined;
    if (saved) {
      pos.x = saved.x;
      pos.y = saved.y;
      m.wrapper.style.left = `${pos.x}px`;
      m.wrapper.style.top = `${pos.y}px`;
    }
    if (el.drag?.mode) {
      const mode = dragRegistry.get(el.drag.mode);
      if (mode) {
        m.cleanups.push(
          mode.attach(m.wrapper, {
            el,
            scale: () => scale,
            bounds: () => ({ w: W, h: pageHeight(project, view.page) }),
            position: () => pos,
            moveTo(x, y) {
              pos.x = x;
              pos.y = y;
              elementState.set(`pos:${el.id}`, { x, y });
              m.wrapper.style.left = `${x}px`;
              m.wrapper.style.top = `${y}px`;
            },
          }),
        );
      }
    }
    const byTrigger = new Map<string, typeof el.interactions>();
    for (const ix of el.interactions ?? []) {
      if (!ix.actions?.length) continue;
      const list = byTrigger.get(ix.trigger) ?? [];
      list.push(ix);
      byTrigger.set(ix.trigger, list);
    }
    for (const [trig, list] of byTrigger) {
      const def = triggerRegistry.get(trig);
      if (!def) continue;
      if (def.clickable) {
        m.wrapper.classList.add('ofs-clickable');
        if (!m.wrapper.querySelector('button')) {
          m.wrapper.tabIndex = 0;
          m.wrapper.setAttribute('role', 'button');
          m.wrapper.setAttribute('aria-label', el.name);
        }
      }
      m.cleanups.push(
        def.bind(m.wrapper, (event) => {
          void (async () => {
            for (const ix of list) await runInteraction(ix, { player: control, selfId: el.id, event });
          })();
        }),
      );
    }
    view.stage.appendChild(m.wrapper);
    return m;
  }

  function buildView(index: number): PageView {
    const page = project.pages[index];
    const node = h(doc, 'div', slides ? 'ofs-slide' : 'ofs-section');
    node.dataset.page = page.id;
    node.dataset.index = String(index);
    applyBackground(node, page.background, project, doc);
    let stage = node;
    if (!slides) {
      const inner = h(doc, 'div', 'ofs-section-inner');
      stage = h(doc, 'div', 'ofs-section-stage', { width: `${W}px`, height: `${pageHeight(project, page)}px` });
      inner.appendChild(stage);
      node.appendChild(inner);
    }
    const view: PageView = { page, index, node, stage, mounted: [] };
    for (const el of page.elements) mount(el, view);
    return view;
  }

  function destroyView(v: PageView) {
    v.observer?.disconnect();
    for (const m of v.mounted) {
      if (mounted.get(m.el.id) === m) mounted.delete(m.el.id);
      unmountElement(m);
    }
    v.node.remove();
  }

  function playEntrances(v: PageView) {
    for (const m of v.mounted) {
      const a = m.el.entrance;
      if (!a?.preset) continue;
      if (!visibility.get(m.el.id)) continue;
      void playAnimation(m.anim, a.preset, { duration: a.duration, delay: a.delay, direction: a.direction });
    }
  }

  // ---------- slides ----------
  let current = Math.max(0, Math.min(project.pages.length - 1, opts.startPage ?? 0));
  let views: PageView[] = [];
  let wrap: HTMLElement | null = null;
  let stageEl: HTMLElement | null = null;
  let activeView: PageView | null = null;
  let outgoing: { view: PageView; anims: Animation[] } | null = null;
  let countLabel: HTMLElement | null = null;
  let prevBtn: HTMLButtonElement | null = null;
  let nextBtn: HTMLButtonElement | null = null;

  function resolveTarget(target: string | number): number {
    const n = project.pages.length;
    if (typeof target === 'number') return target;
    if (target === 'next') return nav.index + 1;
    if (target === 'prev') return nav.index - 1;
    if (target === 'first') return 0;
    if (target === 'last') return n - 1;
    const idx = project.pages.findIndex((p) => p.id === target);
    return idx >= 0 ? idx : nav.index;
  }

  function finishOutgoing() {
    if (!outgoing) return;
    outgoing.anims.forEach((a) => a.cancel());
    destroyView(outgoing.view);
    outgoing = null;
  }

  function showSlide(index: number, dir: number) {
    if (!stageEl) return;
    finishOutgoing();
    const prev = activeView;
    const view = buildView(index);
    stageEl.appendChild(view.node);
    activeView = view;
    current = index;
    nav.set({ index });
    updateNavUi();
    opts.onPageChange?.(index);
    const t = project.settings.transition;
    if (prev && t !== 'none' && typeof view.node.animate === 'function') {
      const anims: Animation[] = [];
      const dur = 450;
      if (t === 'fade') {
        anims.push(view.node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur, easing: 'ease' }));
      } else {
        const easing = 'cubic-bezier(.22,1,.36,1)';
        anims.push(view.node.animate([{ transform: `translateX(${dir * 100}%)` }, { transform: 'translateX(0)' }], { duration: dur + 100, easing }));
        anims.push(
          prev.node.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 100}%)` }], { duration: dur + 100, easing, fill: 'forwards' }),
        );
      }
      outgoing = { view: prev, anims };
      void Promise.all(anims.map((a) => a.finished.catch(() => undefined))).then(() => {
        if (outgoing?.view === prev) finishOutgoing();
      });
    } else if (prev) {
      destroyView(prev);
    }
    playEntrances(view);
  }

  function updateNavUi() {
    if (countLabel) countLabel.textContent = `${current + 1} / ${project.pages.length}`;
    if (prevBtn) prevBtn.disabled = current <= 0;
    if (nextBtn) nextBtn.disabled = current >= project.pages.length - 1;
  }

  function layoutSlides() {
    if (!wrap || !stageEl) return;
    const cw = root.clientWidth || win.innerWidth;
    const ch = root.clientHeight || win.innerHeight;
    const H = project.settings.height;
    const pad = Math.min(24, Math.min(cw, ch) * 0.03);
    scale = Math.max(0.05, Math.min((cw - pad * 2) / W, (ch - pad * 2) / H));
    const sw = W * scale;
    const sh = H * scale;
    wrap.style.width = `${sw}px`;
    wrap.style.height = `${sh}px`;
    wrap.style.left = `${(cw - sw) / 2}px`;
    wrap.style.top = `${(ch - sh) / 2}px`;
    stageEl.style.transform = `scale(${scale})`;
  }

  // ---------- webpage ----------
  function layoutPage() {
    const cw = root.clientWidth || win.innerWidth;
    scale = Math.min(1, cw / W);
    for (const v of views) {
      const inner = v.node.firstElementChild?.classList.contains('ofs-section-inner')
        ? (v.node.firstElementChild as HTMLElement)
        : (v.node.querySelector(':scope > .ofs-section-inner') as HTMLElement | null);
      const hgt = pageHeight(project, v.page);
      if (inner) {
        inner.style.width = `${W * scale}px`;
        inner.style.height = `${hgt * scale}px`;
      }
      v.stage.style.transform = `scale(${scale})`;
    }
    onScroll();
  }

  function onScroll() {
    const max = root.scrollHeight - root.clientHeight;
    const frac = max > 1 ? Math.max(0, Math.min(1, root.scrollTop / max)) : 1;
    const probe = root.scrollTop + root.clientHeight * 0.35;
    let idx = 0;
    views.forEach((v, i) => {
      if (v.node.offsetTop <= probe) idx = i;
    });
    if (frac !== nav.scroll || idx !== nav.index) {
      nav.set({ scroll: frac, index: idx });
      if (idx !== current) {
        current = idx;
        opts.onPageChange?.(idx);
      }
    }
  }

  function goTo(target: string | number) {
    if (destroyed) return;
    const n = project.pages.length;
    const idx = resolveTarget(target);
    if (idx < 0 || idx >= n) return;
    if (slides) {
      if (idx === current && activeView) return;
      showSlide(idx, idx >= current ? 1 : -1);
    } else {
      const v = views[idx];
      if (!v) return;
      if (typeof v.node.scrollIntoView === 'function') v.node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else root.scrollTop = v.node.offsetTop;
    }
  }

  // ---------- build ----------
  if (slides) {
    wrap = h(doc, 'div', 'ofs-stage-wrap');
    stageEl = h(doc, 'div', 'ofs-stage', { width: `${W}px`, height: `${project.settings.height}px` });
    wrap.appendChild(stageEl);
    root.appendChild(wrap);
    if (project.settings.showNavigation && project.pages.length > 1) {
      const bar = h(doc, 'div', 'ofs-nav');
      prevBtn = h(doc, 'button');
      prevBtn.type = 'button';
      prevBtn.setAttribute('aria-label', 'Previous slide');
      prevBtn.appendChild(icon(doc, 'chevron-left', 20));
      prevBtn.addEventListener('click', () => goTo('prev'));
      countLabel = h(doc, 'span', 'ofs-nav-count');
      nextBtn = h(doc, 'button');
      nextBtn.type = 'button';
      nextBtn.setAttribute('aria-label', 'Next slide');
      nextBtn.appendChild(icon(doc, 'chevron-right', 20));
      nextBtn.addEventListener('click', () => goTo('next'));
      bar.append(prevBtn, countLabel, nextBtn);
      if (opts.fullscreenButton && doc.fullscreenEnabled) {
        const fs = h(doc, 'button');
        fs.type = 'button';
        fs.setAttribute('aria-label', 'Toggle fullscreen');
        const s = icon(doc, 'plus', 18);
        s.querySelector('path')!.setAttribute('d', 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5');
        fs.appendChild(s);
        fs.addEventListener('click', () => {
          if (doc.fullscreenElement) void doc.exitFullscreen();
          else void doc.documentElement.requestFullscreen?.();
        });
        bar.appendChild(fs);
      }
      root.appendChild(bar);
    }
    showSlide(current, 1);
    layoutSlides();
  } else {
    views = project.pages.map((_, i) => buildView(i));
    for (const v of views) root.appendChild(v.node);
    root.addEventListener('scroll', onScroll, { passive: true });
    cleanups.push(() => root.removeEventListener('scroll', onScroll));
    // Entrance animations play when each element scrolls into view.
    const IO = (win as typeof window).IntersectionObserver;
    for (const v of views) {
      const animated = v.mounted.filter((m) => m.el.entrance?.preset && visibility.get(m.el.id));
      if (!animated.length) continue;
      if (!IO) {
        playEntrances(v);
        continue;
      }
      const observer = new IO(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const m = animated.find((x) => x.wrapper === entry.target);
            observer.unobserve(entry.target);
            if (!m) continue;
            m.wrapper.classList.remove('ofs-await');
            const a = m.el.entrance!;
            void playAnimation(m.anim, a.preset, { duration: a.duration, delay: a.delay, direction: a.direction });
          }
        },
        { root, threshold: 0.2 },
      );
      for (const m of animated) {
        m.wrapper.classList.add('ofs-await');
        observer.observe(m.wrapper);
      }
      v.observer = observer;
    }
    layoutPage();
    if (current > 0) requestAnimationFrame(() => (root.scrollTop = views[current]?.node.offsetTop ?? 0));
  }

  const layout = () => (slides ? layoutSlides() : layoutPage());
  const RO = (win as typeof window).ResizeObserver;
  if (RO) {
    const ro = new RO(() => layout());
    ro.observe(root);
    cleanups.push(() => ro.disconnect());
  } else {
    win.addEventListener('resize', layout);
    cleanups.push(() => win.removeEventListener('resize', layout));
  }

  if (slides && opts.keyboard !== false) {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (['ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && t?.tagName !== 'BUTTON')) {
        e.preventDefault();
        goTo('next');
      } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        goTo('prev');
      } else if (e.key === 'Home') goTo('first');
      else if (e.key === 'End') goTo('last');
    };
    doc.addEventListener('keydown', onKey);
    cleanups.push(() => doc.removeEventListener('keydown', onKey));
  }

  return {
    root,
    vars,
    nav,
    control,
    currentPage: () => current,
    goTo,
    isVisible: (id) => visibility.get(id) ?? false,
    destroy() {
      destroyed = true;
      cleanups.forEach((fn) => fn());
      finishOutgoing();
      if (activeView) destroyView(activeView);
      views.forEach(destroyView);
      root.remove();
    },
  };
}
