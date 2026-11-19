import type { Background, Page, Project, ProjectKind, SceneElement, ThemeId, Variable } from './types';
import { SCHEMA_ID, SCHEMA_VERSION } from './types';
import { uid } from './ids';
import { elementRegistry } from '../runtime/elements';
import { DEFAULT_THEME, getTheme } from './theme/tokens';
import { themeBackdrop, themeNewBackground } from './theme/apply';

export const SLIDE_SIZE = { width: 1280, height: 720 };
export const PAGE_SIZE = { width: 1000, height: 560 };

export function createProject(kind: ProjectKind, title?: string, theme: ThemeId = DEFAULT_THEME): Project {
  const now = new Date().toISOString();
  const t = getTheme(theme);
  const project: Project = {
    schema: SCHEMA_ID,
    version: SCHEMA_VERSION,
    id: uid('prj'),
    kind,
    meta: { title: title ?? (kind === 'slides' ? 'Untitled presentation' : 'Untitled page'), createdAt: now, updatedAt: now },
    settings: {
      width: kind === 'slides' ? SLIDE_SIZE.width : PAGE_SIZE.width,
      height: kind === 'slides' ? SLIDE_SIZE.height : PAGE_SIZE.height,
      transition: t.transition,
      showNavigation: true,
      backdrop: themeBackdrop(t, kind),
      theme: t.id,
      backdropThemed: true,
    },
    pages: [],
    variables: [],
    assets: {},
  };
  project.pages.push(createPage(project, kind === 'slides' ? 'Slide 1' : 'Section 1'));
  return project;
}

/** A themed base background for the project's theme. */
export function defaultBackground(project?: Pick<Project, 'settings'>, role = 'base'): Background {
  return themeNewBackground(getTheme(project?.settings.theme), role);
}

export function createPage(project: Project, name?: string, background?: Background): Page {
  const n = project.pages.length + 1;
  return {
    id: uid('pg'),
    name: name ?? (project.kind === 'slides' ? `Slide ${n}` : `Section ${n}`),
    background: background ?? defaultBackground(project),
    ...(project.kind === 'page' ? { height: project.settings.height } : {}),
    elements: [],
  };
}

export function createElement<P extends object = Record<string, unknown>>(
  type: string,
  init: Partial<Omit<SceneElement<P>, 'props'>> & { props?: Partial<P> } = {},
): SceneElement<P> {
  const def = elementRegistry.get(type);
  if (!def) throw new Error(`Unknown element type "${type}"`);
  const { props, ...rest } = init;
  return {
    id: uid('el'),
    type,
    name: type,
    x: 100,
    y: 100,
    w: 240,
    h: 120,
    rotation: 0,
    hidden: false,
    locked: false,
    interactions: [],
    entrance: null,
    drag: null,
    ...rest,
    props: { ...(def.defaults() as P), ...(props ?? {}) } as P,
  };
}

export function createVariable(name: string, initial = 0): Variable {
  return { id: uid('var'), name, type: 'number', initial };
}

/** Deep clone with fresh ids for elements and interactions (used by duplicate/paste). */
export function cloneElement(el: SceneElement): SceneElement {
  const copy = JSON.parse(JSON.stringify(el)) as SceneElement;
  copy.id = uid('el');
  copy.interactions = copy.interactions.map((ix) => ({
    ...ix,
    id: uid('ix'),
    actions: ix.actions.map((a) => ({ ...a, id: uid('ac') })),
    conditions: ix.conditions.map((c) => ({ ...c, id: uid('cd') })),
  }));
  return copy;
}

export function clonePage(page: Page): Page {
  const map = new Map<string, string>();
  const elements = page.elements.map((el) => {
    const c = cloneElement(el);
    map.set(el.id, c.id);
    return c;
  });
  // Re-point interactions that targeted elements within the duplicated page.
  for (const el of elements) {
    for (const ix of el.interactions) {
      for (const a of ix.actions) {
        const t = a.params.target;
        if (typeof t === 'string' && map.has(t)) a.params.target = map.get(t)!;
      }
    }
  }
  return { ...(JSON.parse(JSON.stringify(page)) as Page), id: uid('pg'), name: `${page.name} copy`, elements };
}
