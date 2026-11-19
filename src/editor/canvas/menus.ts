import type { SceneElement } from '../../model/types';
import type { MenuItem } from '../ui/contextMenu';
import { mod } from '../ui/contextMenu';
import { editor } from '../store/store';
import { copySelection, deleteSelection, duplicateSelection, moveLayer, pasteClipboard, selectAll, updateSelected, addPage } from '../ops';
import { EDITOR_ELEMENTS } from '../catalog';

export function elementMenu(els: SceneElement[]): MenuItem[] {
  const single = els.length === 1 ? els[0] : null;
  const allLocked = els.every((e) => e.locked);
  const allHidden = els.every((e) => e.hidden);
  const items: MenuItem[] = [];
  if (single && EDITOR_ELEMENTS[single.type]?.inlineText && !single.locked) {
    items.push({ label: 'Edit text', icon: 'text', shortcut: 'Enter', onClick: () => editor().set({ editingTextId: single.id }) });
  }
  items.push(
    { label: 'Edit properties', icon: 'palette', onClick: () => editor().set({ inspectorTab: 'design' }) },
    {
      label: 'Add interaction',
      icon: 'bolt',
      disabled: !single,
      title: single ? undefined : 'Select one element to add an interaction',
      onClick: () => single && editor().set({ inspectorTab: 'behavior', triggerPickerFor: single.id }),
    },
    { divider: true },
    { label: 'Duplicate', icon: 'duplicate', shortcut: `${mod}D`, onClick: () => duplicateSelection() },
    { label: 'Copy', icon: 'copy', shortcut: `${mod}C`, onClick: () => copySelection() },
    { label: 'Paste', icon: 'paste', shortcut: `${mod}V`, disabled: !editor().clipboard.length, onClick: () => pasteClipboard() },
    { divider: true },
    { label: 'Bring forward', icon: 'front', shortcut: `${mod}]`, onClick: () => moveLayer('forward') },
    { label: 'Send backward', icon: 'back', shortcut: `${mod}[`, onClick: () => moveLayer('backward') },
    { label: 'Bring to front', icon: 'up', onClick: () => moveLayer('front') },
    { label: 'Send to back', icon: 'down', onClick: () => moveLayer('back') },
    { divider: true },
    { label: allHidden ? 'Show at start' : 'Hide at start', icon: allHidden ? 'eye' : 'eyeOff', title: 'Hidden elements can be revealed by interactions', onClick: () => updateSelected((el) => void (el.hidden = !allHidden)) },
    { label: allLocked ? 'Unlock' : 'Lock', icon: allLocked ? 'unlock' : 'lock', onClick: () => updateSelected((el) => void (el.locked = !allLocked)) },
    { divider: true },
    { label: 'Delete', icon: 'trash', shortcut: 'Del', danger: true, onClick: () => deleteSelection() },
  );
  return items;
}

export function canvasMenu(): MenuItem[] {
  const s = editor();
  const slides = s.project?.kind === 'slides';
  return [
    { label: 'Paste', icon: 'paste', shortcut: `${mod}V`, disabled: !s.clipboard.length, onClick: () => pasteClipboard() },
    { label: 'Select all', icon: 'select', shortcut: `${mod}A`, onClick: () => selectAll() },
    { divider: true },
    { label: slides ? 'Slide background…' : 'Section background…', icon: 'palette', onClick: () => s.set({ selection: [], inspectorTab: 'design' }) },
    { label: slides ? 'Add slide after this' : 'Add section after this', icon: 'plus', onClick: () => addPage(undefined, s.pageId) },
    { label: 'Insert element…', icon: 'grid', onClick: () => s.set({ leftTab: 'insert' }) },
  ];
}
