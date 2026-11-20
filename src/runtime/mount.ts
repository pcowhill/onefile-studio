import type { Background, Page, Project, SceneElement } from '../model/types';
import { paintToCss } from '../model/paint';
import type { RuntimeEnv } from './env';
import { assetUrl } from './env';
import { imageFill } from './elements/editedImage';
import { isIdentity, resolveEdit } from '../model/mediaEdit';
import { elementRegistry } from './elements';
import type { ElementApi } from './elements/types';
import { h } from './elements/types';

export interface RenderedContent {
  node: HTMLElement;
  api?: ElementApi;
  destroy(): void;
}

/** Renders an element's visual content (fills its parent box). Used by the player and the editor canvas. */
export function renderContent(el: SceneElement, env: RuntimeEnv, doc: Document): RenderedContent {
  const def = elementRegistry.get(el.type);
  const cleanups: Array<() => void> = [];
  const destroy = () => {
    for (const fn of cleanups.splice(0)) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
  };
  if (!def) {
    const node = h(doc, 'div', 'ofs-unknown');
    node.textContent = `Unsupported element: ${el.type}`;
    return { node, destroy };
  }
  const { node, api } = def.render(el, { env, doc, onCleanup: (fn) => cleanups.push(fn) });
  node.classList.add('ofs-content');
  return { node, api, destroy };
}

export interface MountedElement {
  el: SceneElement;
  /** Positioned box (position, size, rotation). */
  wrapper: HTMLElement;
  /** Inner layer that animations transform, so they never fight rotation/position. */
  anim: HTMLElement;
  content: RenderedContent;
  cleanups: Array<() => void>;
}

export function mountElement(el: SceneElement, env: RuntimeEnv, doc: Document): MountedElement {
  const wrapper = h(doc, 'div', `ofs-el ofs-el-${el.type}`);
  wrapper.dataset.id = el.id;
  wrapper.dataset.name = el.name;
  positionWrapper(wrapper, el);
  const anim = h(doc, 'div', 'ofs-anim');
  const content = renderContent(el, env, doc);
  anim.appendChild(content.node);
  wrapper.appendChild(anim);
  return { el, wrapper, anim, content, cleanups: [] };
}

export function positionWrapper(wrapper: HTMLElement, el: Pick<SceneElement, 'x' | 'y' | 'w' | 'h' | 'rotation'>) {
  const s = wrapper.style;
  s.left = `${el.x}px`;
  s.top = `${el.y}px`;
  s.width = `${Math.max(1, el.w)}px`;
  s.height = `${Math.max(1, el.h)}px`;
  s.transform = el.rotation ? `rotate(${el.rotation}deg)` : '';
}

export function unmountElement(m: MountedElement) {
  for (const fn of m.cleanups.splice(0)) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  m.content.destroy();
  m.wrapper.remove();
}

/** Paints a page/section background onto `node`. */
export function applyBackground(node: HTMLElement, bg: Background | undefined, project: Project, doc: Document) {
  node.style.background = paintToCss(bg?.paint);
  const url = assetUrl(project, bg?.imageId);
  if (url) {
    const fit = bg?.imageFit === 'contain' ? 'contain' : 'cover';
    const edit = resolveEdit(project, bg?.imageId);
    const img = h(doc, 'div', 'ofs-bg-image', isIdentity(edit) ? { backgroundImage: `url("${url}")`, backgroundSize: fit } : undefined);
    if (!isIdentity(edit)) {
      const pic = imageFill(doc, project, bg?.imageId, { fit, alt: '' });
      if (pic) img.appendChild(pic);
    }
    node.appendChild(img);
    const dim = Math.max(0, Math.min(0.9, Number(bg?.imageDim) || 0));
    if (dim > 0) node.appendChild(h(doc, 'div', 'ofs-bg-dim', { background: `rgba(10, 8, 30, ${dim})` }));
  }
}

export function pageHeight(project: Project, page: Page): number {
  return project.kind === 'page' ? Math.max(80, page.height ?? project.settings.height) : project.settings.height;
}

/**
 * Static (non-interactive) rendering of one page — used for thumbnails and
 * editor previews. Initially hidden elements are omitted.
 */
export function renderPageStatic(project: Project, pageIndex: number, env: RuntimeEnv, doc: Document): { node: HTMLElement; destroy(): void } {
  const page = project.pages[pageIndex];
  const node = h(doc, 'div', 'ofs-page-static', {
    width: `${project.settings.width}px`,
    height: `${pageHeight(project, page)}px`,
  });
  applyBackground(node, page.background, project, doc);
  const mounted: MountedElement[] = [];
  for (const el of page.elements) {
    if (el.hidden) continue;
    const m = mountElement(el, env, doc);
    mounted.push(m);
    node.appendChild(m.wrapper);
  }
  return { node, destroy: () => mounted.forEach(unmountElement) };
}
