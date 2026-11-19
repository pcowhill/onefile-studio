import { beforeEach, describe, expect, it } from 'vitest';
import { editor } from '../../src/editor/store/store';
import { createProject } from '../../src/model/factory';
import { CATALOG } from '../../src/editor/catalog';
import { align, deleteSelection, duplicateSelection, insertCatalogItem, moveLayer, updateProps, addPage, duplicatePage, deletePage, movePage, copySelection, pasteClipboard, addVariable, renameVariable } from '../../src/editor/ops';

const els = () => editor().project!.pages.find((p) => p.id === editor().pageId)!.elements;
const insert = (id: string) => insertCatalogItem(CATALOG.find((c) => c.id === id)!);

describe('editor store and operations', () => {
  beforeEach(() => editor().openProject(createProject('slides')));

  it('creates elements from the catalog with defaults, names and selection', () => {
    insert('heading');
    insert('shape-rect');
    expect(els().map((e) => e.type)).toEqual(['text', 'shape']);
    expect(els()[0].name).toBe('Text 1');
    expect(editor().selection).toEqual([els()[1].id]);
    // Centred on the slide.
    const s = els()[1];
    expect(s.x + s.w / 2).toBeCloseTo(640, -1);
    expect(s.y + s.h / 2).toBeCloseTo(360, -1);
  });

  it('component inserts bring their sample assets and variables', () => {
    insert('beforeAfter');
    insert('score');
    const p = editor().project!;
    expect(Object.keys(p.assets)).toHaveLength(2);
    expect(p.variables.map((v) => v.name)).toEqual(['Score']);
    expect((els()[1].props as { text: string }).text).toBe('Score: {Score}');
  });

  it('undo and redo every edit', () => {
    insert('heading');
    const id = els()[0].id;
    updateProps(id, { text: 'Hello' });
    expect((els()[0].props as { text: string }).text).toBe('Hello');
    editor().undo();
    expect((els()[0].props as { text: string }).text).toBe('A bold heading');
    editor().undo();
    expect(els()).toHaveLength(0);
    editor().redo();
    editor().redo();
    expect((els()[0].props as { text: string }).text).toBe('Hello');
  });

  it('merges rapid edits with the same key into one undo step', () => {
    insert('heading');
    const id = els()[0].id;
    for (const t of ['H', 'He', 'Hel', 'Hell', 'Hello']) updateProps(id, { text: t }, 'typing');
    const before = editor().past.length;
    editor().undo();
    expect((els()[0].props as { text: string }).text).toBe('A bold heading');
    expect(editor().past.length).toBe(before - 1);
  });

  it('gesture transactions create a single undo step', () => {
    insert('shape-rect');
    const id = els()[0].id;
    const x0 = els()[0].x;
    editor().begin();
    for (let i = 1; i <= 10; i++) editor().live((d) => void (d.pages[0].elements[0].x = x0 + i * 5));
    editor().commit();
    expect(els()[0].x).toBe(x0 + 50);
    editor().undo();
    expect(els()[0].x).toBe(x0);
    expect(els()[0].id).toBe(id);
  });

  it('duplicates, copies/pastes, deletes, layers and aligns', () => {
    insert('heading');
    insert('shape-rect');
    duplicateSelection();
    expect(els()).toHaveLength(3);
    expect(els()[2].name).toBe('Shape 2');
    editor().select([els()[2].id]);
    moveLayer('back');
    expect(els()[0].name).toBe('Shape 2');
    editor().select([els()[0].id]);
    align('left');
    expect(els()[0].x).toBe(0);
    align('bottom');
    expect(els()[0].y + els()[0].h).toBe(720);
    copySelection();
    pasteClipboard();
    expect(els()).toHaveLength(4);
    deleteSelection();
    expect(els()).toHaveLength(3);
  });

  it('manages slides', () => {
    const first = editor().pageId;
    addPage();
    expect(editor().project!.pages).toHaveLength(2);
    const second = editor().pageId;
    insert('heading');
    duplicatePage(second);
    expect(editor().project!.pages).toHaveLength(3);
    expect(editor().project!.pages[2].elements[0].id).not.toBe(editor().project!.pages[1].elements[0].id);
    movePage(first, 2);
    expect(editor().project!.pages[2].id).toBe(first);
    deletePage(first);
    expect(editor().project!.pages).toHaveLength(2);
  });

  it('renaming a variable updates text tokens', () => {
    const v = addVariable('Score');
    insert('body');
    updateProps(els()[0].id, { text: 'You have {Score} points' });
    renameVariable(v.id, 'Points');
    expect((els()[0].props as { text: string }).text).toBe('You have {Points} points');
  });
});
