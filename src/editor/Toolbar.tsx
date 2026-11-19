import { useEditor, editor } from './store/store';
import { Icon } from './ui/Icon';
import { mod } from './ui/contextMenu';
import { goHome, pickAndImport, persist } from './session';
import { CATALOG } from './catalog';
import { insertCatalogItem } from './ops';
import { Logo } from './ui/Logo';
import { ThemeDots } from './theme/ThemePicker';
import { getTheme } from '../model/theme';

const QUICK = [
  { id: 'heading', label: 'Text', icon: 'text' },
  { id: 'image', label: 'Image', icon: 'image' },
  { id: 'shape-rect', label: 'Shape', icon: 'shape' },
  { id: 'arrow', label: 'Arrow', icon: 'arrow' },
  { id: 'button', label: 'Button', icon: 'button' },
];

export function Toolbar() {
  const project = useEditor((s) => s.project)!;
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const saveState = useEditor((s) => s.saveState);
  const slides = project.kind === 'slides';
  return (
    <header className="ed-toolbar">
      <div className="ed-tb-left">
        <button className="ed-home" onClick={() => void goHome()} title="Back to start" aria-label="Back to start screen">
          <Logo size={34} />
        </button>
        <div className="ed-title-wrap">
          <input
            className="ed-title"
            value={project.meta.title}
            aria-label="Project title"
            onChange={(e) =>
              editor().update(
                (d) => {
                  d.meta.title = e.target.value.slice(0, 200);
                },
                { merge: 'title' },
              )
            }
          />
          <span className={`ed-kind ${slides ? 'is-slides' : 'is-page'}`}>
            <Icon name={slides ? 'slides' : 'page'} size={13} /> {slides ? 'Slides' : 'Webpage'}
          </span>
          <button
            className="ed-theme-btn"
            onClick={() => editor().set({ themeOpen: true, editingTextId: null })}
            title="Change the look of the whole project"
            data-testid="theme-button"
          >
            <ThemeDots id={project.settings.theme} />
            <span>{getTheme(project.settings.theme).label}</span>
          </button>
        </div>
      </div>
      <div className="ed-tb-center">
        <div className="ed-tb-group">
          <button className="ed-tool" onClick={() => editor().undo()} disabled={!canUndo} title={`Undo (${mod}Z)`} aria-label="Undo" data-testid="undo">
            <Icon name="undo" />
          </button>
          <button className="ed-tool" onClick={() => editor().redo()} disabled={!canRedo} title={`Redo (${mod}Shift+Z)`} aria-label="Redo" data-testid="redo">
            <Icon name="redo" />
          </button>
        </div>
        <div className="ed-tb-group">
          {QUICK.map((q) => (
            <button
              key={q.id}
              className="ed-tool has-label"
              onClick={() => insertCatalogItem(CATALOG.find((c) => c.id === q.id)!)}
              title={`Add ${q.label.toLowerCase()}`}
              data-testid={`quick-${q.id}`}
            >
              <Icon name={q.icon} />
              <span>{q.label}</span>
            </button>
          ))}
          <button className="ed-tool has-label is-accent" onClick={() => editor().set({ leftTab: 'insert' })} title="All elements and interactive components">
            <Icon name="sparkle" />
            <span>More</span>
          </button>
        </div>
      </div>
      <div className="ed-tb-right">
        <button
          className={`ed-save is-${saveState}`}
          onClick={() => void persist()}
          title="Your work is saved automatically in this browser. Export to get a file."
        >
          <Icon name={saveState === 'error' ? 'warning' : saveState === 'saved' ? 'check' : 'clock'} size={15} />
          {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : 'Unsaved'}
        </button>
        <button className="ed-tool" onClick={pickAndImport} title="Open an exported HTML file" aria-label="Open file">
          <Icon name="folder" />
        </button>
        <button
          className="ed-btn ed-btn-play"
          onClick={() => editor().set({ previewOpen: true, editingTextId: null })}
          title={`Preview (${mod}Enter)`}
          data-testid="preview"
        >
          <Icon name="play" size={16} fill="currentColor" /> Preview
        </button>
        <button
          className="ed-btn ed-btn-primary"
          onClick={() => editor().set({ exportOpen: true, editingTextId: null })}
          title={`Export (${mod}E)`}
          data-testid="export"
        >
          <Icon name="download" size={17} /> Export
        </button>
      </div>
    </header>
  );
}
