import type { Page, Project, SceneElement } from '../../model/types';

/**
 * Who owns an interaction list in the Behavior UI: an element, or a slide /
 * section (page-level and project-wide interactions are edited from the slide).
 */
export interface IxOwner {
  kind: 'element' | 'page';
  /** The element id ('' for a slide): actions resolve "@self" to it. */
  selfId: string;
  name: string;
  /** Element type, or '@page'. */
  type: string;
  /** The page the owner lives on (target pickers list it first). */
  pageId: string;
  el?: SceneElement;
}

export function elementOwner(project: Project, el: SceneElement): IxOwner {
  const page = project.pages.find((p) => p.elements.some((e) => e.id === el.id));
  return { kind: 'element', selfId: el.id, name: el.name, type: el.type, pageId: page?.id ?? '', el };
}

export function pageOwner(project: Project, page: Page): IxOwner {
  const i = project.pages.indexOf(page);
  const noun = project.kind === 'slides' ? 'slide' : 'section';
  const generic = !page.name || /^(slide|section) \d+$/i.test(page.name.trim());
  return { kind: 'page', selfId: '', name: generic ? `${noun} ${i + 1}` : `${noun} ${i + 1} (${page.name})`, type: '@page', pageId: page.id };
}
