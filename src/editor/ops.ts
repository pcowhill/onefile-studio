import type { Asset, Page, Project, SceneElement, Variable } from '../model/types';
import { SELF_TARGET } from '../model/types';
import { cloneElement, clonePage, createElement, createPage, createVariable } from '../model/factory';
import { pageHeight } from '../runtime/mount';
import { editor, findEl, useEditor } from './store/store';
import type { Built, CatalogItem, PageTemplate } from './catalog';
import { nameFor } from './catalog';
import { addAssetDedup, fileToAsset } from '../io/assets';
import { toast } from './ui/toast';
import { applyThemeToElement, getTheme, markExplicit, themeNewBackground, themeNewElement } from '../model/theme';

export type Recipe<T> = (draft: T) => void;

const page = (p: Project, id: string): Page | undefined => p.pages.find((x) => x.id === id);

// ---------------- element insertion ----------------

/** Places a new element in the centre of the current page (cascading if occupied). */
export function placeCentered(project: Project, pg: Page, el: SceneElement) {
  const W = project.settings.width;
  const H = pageHeight(project, pg);
  if (el.w > W * 0.9) {
    const k = (W * 0.9) / el.w;
    el.w *= k;
    el.h *= k;
  }
  if (el.h > H * 0.9) {
    const k = (H * 0.9) / el.h;
    el.w *= k;
    el.h *= k;
  }
  let x = Math.round((W - el.w) / 2);
  let y = Math.round((H - el.h) / 2);
  // Cascade so a new element never lands exactly on top of an existing one.
  const near = (e: SceneElement) => Math.abs(e.x + e.w / 2 - (x + el.w / 2)) < 30 && Math.abs(e.y + e.h / 2 - (y + el.h / 2)) < 30;
  for (let i = 0; i < 12 && pg.elements.some(near); i++) {
    x += 32;
    y += 32;
  }
  x = Math.max(0, Math.min(W - el.w, x));
  y = Math.max(0, Math.min(H - el.h, y));
  el.x = x;
  el.y = y;
}

export function insertBuilt(built: Built, opts: { keepPosition?: boolean; keepStyle?: boolean } = {}) {
  const s = editor();
  if (!s.project) return;
  const el = built.element;
  // New elements follow the project theme (every themeable prop is "themed").
  if (!opts.keepStyle) themeNewElement(el, getTheme(s.project.settings.theme));
  s.update((d) => {
    const pg = page(d, s.pageId);
    if (!pg) return;
    for (const a of built.assets ?? []) if (!d.assets[a.id]) d.assets[a.id] = a;
    for (const v of built.variables ?? []) if (!d.variables.some((x) => x.id === v.id)) d.variables.push(v);
    el.name = nameFor(d, el.type);
    if (!opts.keepPosition) placeCentered(d, pg, el);
    pg.elements.push(el);
  });
  s.select([el.id]);
  return el.id;
}

export function insertCatalogItem(item: CatalogItem) {
  const s = editor();
  if (!s.project) return;
  const pg = page(s.project, s.pageId);
  if (!pg) return;
  if (item.needsImage) {
    void pickImages(false).then((assets) => {
      if (assets[0]) insertImage(assets[0]);
    });
    return;
  }
  const built = item.build({ project: s.project, page: pg });
  insertBuilt(built);
  if (built.variables?.length) toast(`Created the variable “${built.variables[0].name}”. Change it with interactions in the Behavior tab.`, 'info');
}

/** Opens the OS file picker for images and adds them to the project's assets. */
export function pickImages(multiple = true): Promise<Asset[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif';
    input.multiple = multiple;
    input.onchange = async () => resolve(await addImageFiles([...(input.files ?? [])]));
    input.click();
  });
}

export async function addImageFiles(files: File[]): Promise<Asset[]> {
  const out: Asset[] = [];
  for (const f of files) {
    try {
      const asset = await fileToAsset(f);
      let id = asset.id;
      editor().update((d) => {
        id = addAssetDedup(d.assets, asset);
      });
      const stored = editor().project?.assets[id];
      if (stored) out.push(stored);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }
  return out;
}

export function insertImage(asset: Asset) {
  const s = editor();
  if (!s.project) return;
  const max = Math.min(520, s.project.settings.width * 0.5);
  const ratio = asset.width && asset.height ? asset.width / asset.height : 4 / 3;
  const w = ratio >= 1 ? max : max * ratio;
  const h = w / ratio;
  insertBuilt({
    element: createElement('image', { w: Math.round(w), h: Math.round(h), props: { assetId: asset.id, alt: asset.name.replace(/\.[a-z0-9]+$/i, '') } }),
  });
}

// ---------------- element editing ----------------

export function updateElement(id: string, recipe: Recipe<SceneElement>, merge?: string) {
  editor().update(
    (d) => {
      const f = findEl(d, id);
      if (f) recipe(f.el);
    },
    merge ? { merge: `${id}:${merge}` } : undefined,
  );
}

/**
 * Author edits to props. Any edited key becomes an explicit choice that theme
 * changes will no longer touch (see src/model/theme/apply.ts).
 */
export function updateProps(id: string, patch: Record<string, unknown>, merge?: string) {
  updateElement(
    id,
    (el) => {
      Object.assign(el.props as Record<string, unknown>, patch);
      markExplicit(el, Object.keys(patch));
    },
    merge ?? Object.keys(patch).join(','),
  );
}

export function updateSelected(recipe: Recipe<SceneElement>, merge?: string) {
  const ids = editor().selection;
  editor().update(
    (d) => {
      for (const id of ids) {
        const f = findEl(d, id);
        if (f) recipe(f.el);
      }
    },
    merge ? { merge: `sel:${merge}` } : undefined,
  );
}

export function deleteSelection() {
  const { selection } = editor();
  if (!selection.length) return;
  editor().update((d) => {
    for (const pg of d.pages) pg.elements = pg.elements.filter((e) => !selection.includes(e.id));
  });
  editor().select([]);
}

export function duplicateSelection(offset = 24) {
  const s = editor();
  if (!s.project || !s.selection.length) return;
  const ids: string[] = [];
  s.update((d) => {
    for (const id of s.selection) {
      const f = findEl(d, id);
      if (!f) continue;
      const copy = cloneElement(f.el);
      copy.x += offset;
      copy.y += offset;
      copy.name = nameFor(d, copy.type);
      f.page.elements.push(copy);
      ids.push(copy.id);
    }
  });
  s.select(ids);
}

export function copySelection() {
  const s = editor();
  if (!s.project) return;
  const els = s.selection.map((id) => findEl(s.project!, id)?.el).filter((e): e is SceneElement => !!e);
  if (!els.length) return;
  const assets: Asset[] = [];
  const json = JSON.stringify(els);
  for (const a of Object.values(s.project.assets)) if (json.includes(`"${a.id}"`)) assets.push(a);
  s.set({ clipboard: structuredClone(els) });
  clipAssets = assets;
}
let clipAssets: Asset[] = [];

export function pasteClipboard() {
  const s = editor();
  if (!s.project || !s.clipboard.length) return;
  const ids: string[] = [];
  s.update((d) => {
    const pg = page(d, s.pageId);
    if (!pg) return;
    for (const a of clipAssets) if (!d.assets[a.id]) d.assets[a.id] = a;
    const theme = getTheme(d.settings.theme);
    for (const src of s.clipboard) {
      const copy = cloneElement(src);
      // Pasting into a project with another theme: themed props adopt this project's theme.
      applyThemeToElement(copy, theme);
      const sameSpot = pg.elements.some((e) => e.x === copy.x && e.y === copy.y);
      if (sameSpot) {
        copy.x += 24;
        copy.y += 24;
      }
      copy.name = nameFor(d, copy.type);
      pg.elements.push(copy);
      ids.push(copy.id);
    }
  });
  s.select(ids);
  // Paste repeatedly cascades.
  s.set({ clipboard: s.clipboard.map((e) => ({ ...e, x: e.x + 24, y: e.y + 24 })) });
}

export type LayerMove = 'forward' | 'backward' | 'front' | 'back';
export function moveLayer(dir: LayerMove) {
  const { selection } = editor();
  if (!selection.length) return;
  editor().update((d) => {
    for (const pg of d.pages) {
      const els = pg.elements;
      const sel = els.filter((e) => selection.includes(e.id));
      if (!sel.length) continue;
      if (dir === 'front') pg.elements = [...els.filter((e) => !selection.includes(e.id)), ...sel];
      else if (dir === 'back') pg.elements = [...sel, ...els.filter((e) => !selection.includes(e.id))];
      else if (dir === 'forward') {
        for (let i = els.length - 2; i >= 0; i--) {
          if (selection.includes(els[i].id) && !selection.includes(els[i + 1].id)) [els[i], els[i + 1]] = [els[i + 1], els[i]];
        }
      } else {
        for (let i = 1; i < els.length; i++) {
          if (selection.includes(els[i].id) && !selection.includes(els[i - 1].id)) [els[i], els[i - 1]] = [els[i - 1], els[i]];
        }
      }
    }
  });
}

export type AlignKind = 'left' | 'centerH' | 'right' | 'top' | 'middle' | 'bottom';
/** Aligns one element to the page, or several elements to their shared bounds. */
export function align(kind: AlignKind) {
  const s = editor();
  if (!s.project || !s.selection.length) return;
  const els = s.selection.map((id) => findEl(s.project!, id)).filter((f): f is NonNullable<typeof f> => !!f);
  let box: { x: number; y: number; w: number; h: number };
  if (els.length === 1) {
    box = { x: 0, y: 0, w: s.project.settings.width, h: pageHeight(s.project, els[0].page) };
  } else {
    const x = Math.min(...els.map((f) => f.el.x));
    const y = Math.min(...els.map((f) => f.el.y));
    box = { x, y, w: Math.max(...els.map((f) => f.el.x + f.el.w)) - x, h: Math.max(...els.map((f) => f.el.y + f.el.h)) - y };
  }
  updateSelected((el) => {
    if (kind === 'left') el.x = box.x;
    if (kind === 'centerH') el.x = Math.round(box.x + (box.w - el.w) / 2);
    if (kind === 'right') el.x = box.x + box.w - el.w;
    if (kind === 'top') el.y = box.y;
    if (kind === 'middle') el.y = Math.round(box.y + (box.h - el.h) / 2);
    if (kind === 'bottom') el.y = box.y + box.h - el.h;
  });
}

export function nudge(dx: number, dy: number) {
  updateSelected((el) => {
    if (el.locked) return;
    el.x += dx;
    el.y += dy;
  }, 'nudge');
}

export function selectAll() {
  const s = editor();
  const pg = s.project && page(s.project, s.pageId);
  if (pg) s.select(pg.elements.filter((e) => !e.locked).map((e) => e.id));
}

// ---------------- pages ----------------

export function addPage(template?: PageTemplate, afterId?: string) {
  const s = editor();
  if (!s.project) return;
  let id = '';
  s.update((d) => {
    const pg = createPage(d);
    if (template) {
      const theme = getTheme(d.settings.theme);
      const t = template.build(d);
      pg.background = themeNewBackground(theme, t.backgroundRole);
      pg.elements = t.elements.map((el) => themeNewElement(el, theme));
      if (d.kind === 'page' && t.height) pg.height = t.height;
      for (const el of pg.elements) {
        el.name = nameFor({ ...d, pages: [...d.pages, pg] }, el.type);
      }
      if (template.id !== 'blank' && template.id !== 'blank-section') pg.name = `${template.label}`;
    }
    const idx = afterId ? d.pages.findIndex((p) => p.id === afterId) : d.pages.length - 1;
    d.pages.splice(idx + 1, 0, pg);
    id = pg.id;
  });
  s.setPage(id);
}

export function duplicatePage(id: string) {
  const s = editor();
  let newId = '';
  s.update((d) => {
    const idx = d.pages.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const copy = clonePage(d.pages[idx]);
    for (const el of copy.elements) el.name = nameFor({ ...d, pages: [...d.pages, copy] }, el.type);
    d.pages.splice(idx + 1, 0, copy);
    newId = copy.id;
  });
  if (newId) s.setPage(newId);
}

export function deletePage(id: string) {
  const s = editor();
  if (!s.project || s.project.pages.length <= 1) {
    toast('A project needs at least one page.', 'info');
    return;
  }
  const idx = s.project.pages.findIndex((p) => p.id === id);
  s.update((d) => {
    d.pages = d.pages.filter((p) => p.id !== id);
  });
  const pages = editor().project!.pages;
  if (s.pageId === id) s.setPage(pages[Math.max(0, idx - 1)].id);
}

export function movePage(id: string, toIndex: number) {
  editor().update((d) => {
    const from = d.pages.findIndex((p) => p.id === id);
    if (from < 0) return;
    const to = Math.max(0, Math.min(d.pages.length - 1, toIndex));
    if (from === to) return;
    const [pg] = d.pages.splice(from, 1);
    d.pages.splice(to, 0, pg);
  });
}

export function updatePage(id: string, recipe: Recipe<Page>, merge?: string) {
  editor().update(
    (d) => {
      const pg = page(d, id);
      if (pg) recipe(pg);
    },
    merge ? { merge: `page:${id}:${merge}` } : undefined,
  );
}

// ---------------- variables ----------------

export function addVariable(name?: string): Variable {
  const s = editor();
  const used = new Set(s.project?.variables.map((v) => v.name.toLowerCase()));
  let base = name ?? 'Score';
  let n = 2;
  while (used.has(base.toLowerCase())) base = `${name ?? 'Score'} ${n++}`;
  const v = createVariable(base, 0);
  s.update((d) => {
    d.variables.push(v);
  });
  return v;
}

/** Renames a variable and updates `{Old name}` tokens in text. */
export function renameVariable(id: string, name: string) {
  editor().update(
    (d) => {
      const v = d.variables.find((x) => x.id === id);
      if (!v) return;
      const old = v.name;
      v.name = name;
      if (!old.trim() || old === name) return;
      const re = new RegExp(`\\{${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'gi');
      for (const pg of d.pages)
        for (const el of pg.elements) {
          const p = el.props as Record<string, unknown>;
          if (typeof p.text === 'string' && re.test(p.text)) p.text = p.text.replace(re, `{${name}}`);
        }
    },
    { merge: `var:${id}:name` },
  );
}

export function deleteVariable(id: string) {
  editor().update((d) => {
    d.variables = d.variables.filter((v) => v.id !== id);
    for (const pg of d.pages)
      for (const el of pg.elements)
        for (const ix of el.interactions) {
          ix.conditions = ix.conditions.filter((c) => c.variableId !== id);
          for (const a of ix.actions) if (a.params.variable === id) a.params.variable = '';
        }
  });
}

export function variableUsage(project: Project, id: string): number {
  let n = 0;
  const v = project.variables.find((x) => x.id === id);
  for (const pg of project.pages)
    for (const el of pg.elements) {
      if (
        v &&
        typeof (el.props as Record<string, unknown>).text === 'string' &&
        ((el.props as Record<string, unknown>).text as string).toLowerCase().includes(`{${v.name.toLowerCase()}}`)
      )
        n++;
      if ((el.props as Record<string, unknown>).variableId === id) n++;
      for (const ix of el.interactions) {
        n += ix.actions.filter((a) => a.params.variable === id).length;
        n += ix.conditions.filter((c) => c.variableId === id).length;
      }
    }
  return n;
}

// ---------------- assets ----------------

export function assetUsage(project: Project, id: string): number {
  const json = JSON.stringify(project.pages);
  return json.split(`"${id}"`).length - 1;
}

export function deleteAsset(id: string) {
  editor().update((d) => {
    delete d.assets[id];
    for (const pg of d.pages) {
      if (pg.background.imageId === id) delete pg.background.imageId;
      for (const el of pg.elements) {
        const p = el.props as Record<string, unknown>;
        for (const k of ['assetId', 'before', 'after']) if (p[k] === id) p[k] = '';
        if (Array.isArray(p.images)) p.images = (p.images as string[]).filter((x) => x !== id);
      }
    }
  });
}

/** Elements on the current page that an action can target. */
export function targetableElements(project: Project, pageId: string, selfId: string) {
  const pg = page(project, pageId);
  const all = project.pages.flatMap((p) => p.elements.map((el) => ({ el, page: p })));
  return { self: selfId, current: pg?.elements ?? [], all };
}

export function resolveTargetName(project: Project, target: unknown, selfId: string): string {
  if (target === SELF_TARGET || target === selfId) return 'this element';
  const f = typeof target === 'string' && target ? findEl(project, target) : null;
  return f ? f.el.name : 'choose…';
}

export const useProject = () => useEditor((s) => s.project);
