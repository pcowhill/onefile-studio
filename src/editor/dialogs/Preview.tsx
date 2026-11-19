import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createPlayer } from '../../runtime/player';
import type { Player } from '../../runtime/player';
import { useEditor, editor } from '../store/store';
import { Icon } from '../ui/Icon';

/** Preview runs the real playback engine — the same code embedded in exports. */
export function Preview() {
  const project = useEditor((s) => s.project)!;
  const pageId = useEditor((s) => s.pageId);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [run, setRun] = useState(0);
  const [page, setPage] = useState(0);
  const [vars, setVars] = useState<Record<string, number>>({});
  const startIndex = Math.max(0, project.pages.findIndex((p) => p.id === pageId));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const player = createPlayer(host, project, { startPage: startIndex, onPageChange: setPage });
    playerRef.current = player;
    setPage(player.currentPage());
    setVars(player.vars.snapshot());
    const off = player.vars.subscribe(() => setVars(player.vars.snapshot()));
    player.root.focus({ preventScroll: true });
    (window as unknown as { __ofsPreview?: Player }).__ofsPreview = player;
    return () => {
      off();
      player.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        editor().set({ previewOpen: false });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const close = () => {
    // Jump the editor to the page the viewer ended on.
    const p = project.pages[playerRef.current?.currentPage() ?? startIndex];
    editor().set({ previewOpen: false });
    if (p) editor().setPage(p.id);
  };

  return createPortal(
    <div className="ed-preview" role="dialog" aria-modal="true" aria-label="Preview">
      <div className="ed-preview-bar">
        <span className="ed-preview-badge">
          <Icon name="play" size={14} fill="currentColor" /> Preview
        </span>
        <span className="ed-preview-title">{project.meta.title}</span>
        <span className="ed-preview-info">
          {project.kind === 'slides' ? `Slide ${page + 1} of ${project.pages.length}` : `Section ${page + 1} of ${project.pages.length}`}
          {project.variables.map((v) => (
            <span key={v.id} className="ed-preview-var">
              {v.name}: <b>{vars[v.id] ?? v.initial}</b>
            </span>
          ))}
        </span>
        <span className="ed-spacer" />
        <button className="ed-btn ed-btn-sm ed-btn-dark" onClick={() => setRun((r) => r + 1)} title="Start over with fresh variables">
          <Icon name="restart" size={15} /> Restart
        </button>
        <button className="ed-btn ed-btn-sm ed-btn-light" onClick={close} data-testid="close-preview">
          <Icon name="close" size={15} /> Close <kbd>Esc</kbd>
        </button>
      </div>
      <div className="ed-preview-stage" ref={hostRef} key={run} data-testid="preview-stage" />
    </div>,
    document.body,
  );
}
