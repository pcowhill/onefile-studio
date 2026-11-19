import { useEditor, editor } from './store/store';
import { Toolbar } from './Toolbar';
import { LeftPanel } from './panels/LeftPanel';
import { Canvas } from './canvas/Canvas';
import { Inspector } from './inspector/Inspector';
import { Preview } from './dialogs/Preview';
import { ExportDialog } from './dialogs/ExportDialog';
import { useShortcuts } from './shortcuts';
import { Icon } from './ui/Icon';

export function Editor() {
  const previewOpen = useEditor((s) => s.previewOpen);
  const exportOpen = useEditor((s) => s.exportOpen);
  useShortcuts();
  return (
    <div className="ed-app">
      <Toolbar />
      <div className="ed-main">
        <LeftPanel />
        <div className="ed-center">
          <Canvas />
          <ZoomControls />
          <PageNav />
        </div>
        <Inspector />
      </div>
      {previewOpen && <Preview />}
      {exportOpen && <ExportDialog />}
    </div>
  );
}

function ZoomControls() {
  const zoom = useEditor((s) => s.zoom);
  const fit = useEditor((s) => s.fitZoom);
  const z = zoom ?? fit;
  return (
    <div className="ed-zoom" role="group" aria-label="Zoom">
      <button className="ed-icon-btn" aria-label="Zoom out" onClick={() => editor().set({ zoom: Math.max(0.1, z / 1.2) })}>
        <Icon name="minus" size={16} />
      </button>
      <button className="ed-zoom-val" onClick={() => editor().set({ zoom: zoom === null ? 1 : null })} title={zoom === null ? 'Show at 100%' : 'Fit to screen'}>
        {Math.round(z * 100)}%
      </button>
      <button className="ed-icon-btn" aria-label="Zoom in" onClick={() => editor().set({ zoom: Math.min(4, z * 1.2) })}>
        <Icon name="plus" size={16} />
      </button>
      <button className={`ed-icon-btn ${zoom === null ? 'is-on' : ''}`} aria-label="Fit to screen" title="Fit to screen" onClick={() => editor().set({ zoom: null })}>
        <Icon name="fit" size={16} />
      </button>
    </div>
  );
}

function PageNav() {
  const project = useEditor((s) => s.project)!;
  const pageId = useEditor((s) => s.pageId);
  if (project.kind !== 'slides' || project.pages.length < 2) return null;
  const i = project.pages.findIndex((p) => p.id === pageId);
  const go = (d: number) => {
    const p = project.pages[i + d];
    if (p) editor().setPage(p.id);
  };
  return (
    <div className="ed-pagenav" role="group" aria-label="Slide navigation">
      <button className="ed-icon-btn" aria-label="Previous slide" disabled={i <= 0} onClick={() => go(-1)}>
        <Icon name="left" size={16} />
      </button>
      <span>
        {i + 1} / {project.pages.length}
      </span>
      <button className="ed-icon-btn" aria-label="Next slide" disabled={i >= project.pages.length - 1} onClick={() => go(1)}>
        <Icon name="right" size={16} />
      </button>
    </div>
  );
}
