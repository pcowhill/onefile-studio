import { useEffect } from 'react';
import { editor } from './store/store';
import { selectedElements } from './store/store';
import { copySelection, deleteSelection, duplicateSelection, moveLayer, nudge, pasteClipboard, selectAll, addImageFiles, insertImage } from './ops';
import { EDITOR_ELEMENTS } from './catalog';
import { persist } from './session';
import { toast } from './ui/toast';

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = editor();
      if (!s.project || s.previewOpen) return;
      if (document.querySelector('.ed-modal-backdrop')) return;
      const m = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (m && k === 's') {
        e.preventDefault();
        void persist().then(() => toast('Saved in this browser. Use Export to get a file you can share.', 'success'));
        return;
      }
      if (m && k === 'e') {
        e.preventDefault();
        s.set({ exportOpen: true });
        return;
      }
      if (m && k === 'enter') {
        e.preventDefault();
        s.set({ previewOpen: true, editingTextId: null });
        return;
      }
      if (isTyping(e.target)) return;
      if (m && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (m && k === 'y') {
        e.preventDefault();
        s.redo();
      } else if (m && k === 'd') {
        e.preventDefault();
        duplicateSelection();
      } else if (m && k === 'c') {
        copySelection();
      } else if (m && k === 'x') {
        copySelection();
        deleteSelection();
      } else if (m && k === 'v') {
        // Images on the system clipboard are handled by the paste event below.
        if (s.clipboard.length) {
          e.preventDefault();
          pasteClipboard();
        }
      } else if (m && k === 'a') {
        e.preventDefault();
        selectAll();
      } else if (m && (e.key === ']' || e.key === '}')) {
        e.preventDefault();
        moveLayer(e.shiftKey ? 'front' : 'forward');
      } else if (m && (e.key === '[' || e.key === '{')) {
        e.preventDefault();
        moveLayer(e.shiftKey ? 'back' : 'backward');
      } else if (m && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        s.set({ zoom: Math.min(4, (s.zoom ?? s.fitZoom) * 1.2) });
      } else if (m && e.key === '-') {
        e.preventDefault();
        s.set({ zoom: Math.max(0.1, (s.zoom ?? s.fitZoom) / 1.2) });
      } else if (m && e.key === '0') {
        e.preventDefault();
        s.set({ zoom: null });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selection.length) {
          e.preventDefault();
          deleteSelection();
        }
      } else if (e.key.startsWith('Arrow') && s.selection.length) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0);
      } else if (e.key === 'Escape') {
        if (s.editingTextId) s.set({ editingTextId: null });
        else s.select([]);
      } else if (e.key === 'Enter') {
        // Enter on a focused control (an inspector button, a link…) activates
        // that control; it only starts text editing from the canvas.
        const t = e.target as HTMLElement | null;
        if (t?.closest?.('button, a[href], [role=button], [role=option], [role=menuitem]') && !t.closest('.ed-canvas')) return;
        const els = selectedElements(s);
        if (els.length === 1 && EDITOR_ELEMENTS[els[0].type]?.inlineText && !els[0].locked) {
          e.preventDefault();
          s.set({ editingTextId: els[0].id });
        }
      }
    };
    const onPaste = async (e: ClipboardEvent) => {
      if (!editor().project || isTyping(e.target)) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      for (const a of await addImageFiles(files)) insertImage(a);
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      const st = editor().saveState;
      if (editor().project && (st === 'unsaved' || st === 'saving')) {
        void persist();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);
}
