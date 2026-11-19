import { useRef, useState } from 'react';
import { useEditor, editor } from '../store/store';
import type { LeftTab } from '../store/store';
import { Icon } from '../ui/Icon';
import { PageThumb } from './PageThumb';
import { CATALOG, CATALOG_GROUPS, templatesFor } from '../catalog';
import type { CatalogItem } from '../catalog';
import { addImageFiles, addPage, addVariable, assetUsage, deleteAsset, deletePage, deleteVariable, duplicatePage, insertCatalogItem, insertImage, movePage, pickImages, renameVariable, variableUsage } from '../ops';
import { openContextMenu } from '../ui/contextMenu';
import { Popover, NumberInput } from '../ui/controls';
import { formatBytes } from '../../io/exportHtml';
import { CatalogIllustration, TemplateIllustration } from './illustrations';

const TABS: Array<{ id: LeftTab; label: string; icon: string }> = [
  { id: 'pages', label: 'Pages', icon: 'slides' },
  { id: 'insert', label: 'Insert', icon: 'plus' },
  { id: 'images', label: 'Images', icon: 'image' },
  { id: 'variables', label: 'Variables', icon: 'variable' },
];

export function LeftPanel() {
  const tab = useEditor((s) => s.leftTab);
  const kind = useEditor((s) => s.project?.kind);
  return (
    <aside className="ed-left" aria-label="Project panel">
      <nav className="ed-rail" aria-label="Panels">
        {TABS.map((t) => (
          <button key={t.id} className={`ed-rail-btn ${tab === t.id ? 'is-on' : ''}`} onClick={() => editor().set({ leftTab: t.id })} aria-pressed={tab === t.id} data-testid={`tab-${t.id}`}>
            <Icon name={t.id === 'pages' && kind === 'page' ? 'page' : t.icon} size={21} />
            <span>{t.id === 'pages' ? (kind === 'slides' ? 'Slides' : 'Sections') : t.label}</span>
          </button>
        ))}
      </nav>
      <div className="ed-left-body">
        {tab === 'pages' && <PagesPanel />}
        {tab === 'insert' && <InsertPanel />}
        {tab === 'images' && <ImagesPanel />}
        {tab === 'variables' && <VariablesPanel />}
      </div>
    </aside>
  );
}

function PanelHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="ed-panel-head">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function PagesPanel() {
  const project = useEditor((s) => s.project)!;
  const pageId = useEditor((s) => s.pageId);
  const slides = project.kind === 'slides';
  const noun = slides ? 'slide' : 'section';
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const menu = (e: React.MouseEvent, id: string, i: number) => {
    e.preventDefault();
    editor().setPage(id);
    openContextMenu(
      e.clientX,
      e.clientY,
      [
        { label: `Duplicate ${noun}`, icon: 'duplicate', onClick: () => duplicatePage(id) },
        { label: `Add ${noun} after`, icon: 'plus', onClick: () => addPage(undefined, id) },
        { divider: true },
        { label: 'Move up', icon: 'up', disabled: i === 0, onClick: () => movePage(id, i - 1) },
        { label: 'Move down', icon: 'down', disabled: i === project.pages.length - 1, onClick: () => movePage(id, i + 1) },
        { divider: true },
        { label: `Delete ${noun}`, icon: 'trash', danger: true, disabled: project.pages.length <= 1, onClick: () => deletePage(id) },
      ],
      project.pages[i].name,
    );
  };

  return (
    <div className="ed-panel">
      <PanelHead title={slides ? 'Slides' : 'Sections'}>
        <AddPageButton />
      </PanelHead>
      <div className="ed-pages" ref={listRef} role="list">
        {project.pages.map((p, i) => (
          <div
            key={p.id}
            role="listitem"
            className={`ed-page-item ${p.id === pageId ? 'is-on' : ''} ${dragId === p.id ? 'is-dragging' : ''} ${dropAt === i ? 'is-drop-before' : ''} ${dropAt === i + 1 && i === project.pages.length - 1 ? 'is-drop-after' : ''}`}
            draggable
            onDragStart={(e) => {
              setDragId(p.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/x-ofs-page', p.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setDropAt(null);
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dropAt != null) {
                const from = project.pages.findIndex((x) => x.id === dragId);
                movePage(dragId, dropAt > from ? dropAt - 1 : dropAt);
              }
              setDragId(null);
              setDropAt(null);
            }}
            onContextMenu={(e) => menu(e, p.id, i)}
          >
            <span className="ed-page-num">{i + 1}</span>
            <button className="ed-page-btn" onClick={() => editor().setPage(p.id)} aria-label={`${p.name}`} aria-current={p.id === pageId}>
              <PageThumb project={project} page={p} index={i} width={slides ? 176 : 176} />
            </button>
            <button className="ed-page-more" aria-label={`${p.name} options`} onClick={(e) => menu(e, p.id, i)}>
              <Icon name="more" size={18} stroke={3} />
            </button>
          </div>
        ))}
      </div>
      <div className="ed-panel-foot">
        <AddPageButton big />
      </div>
    </div>
  );
}

function AddPageButton({ big }: { big?: boolean }) {
  const kind = useEditor((s) => s.project!.kind);
  const pageId = useEditor((s) => s.pageId);
  const templates = templatesFor(kind);
  return (
    <Popover
      width={300}
      align={big ? 'left' : 'right'}
      trigger={(_, toggle) =>
        big ? (
          <button className="ed-btn ed-btn-soft ed-btn-block" onClick={toggle} data-testid="add-page">
            <Icon name="plus" size={18} /> Add {kind === 'slides' ? 'slide' : 'section'}
          </button>
        ) : (
          <button className="ed-icon-btn" onClick={toggle} aria-label={`Add ${kind === 'slides' ? 'slide' : 'section'}`} title="Add">
            <Icon name="plus" size={18} />
          </button>
        )
      }
    >
      {(close) => (
        <div className="ed-templates">
          <div className="ed-pop-title">Choose a layout</div>
          <div className="ed-template-grid">
            {templates.map((t) => (
              <button
                key={t.id}
                className="ed-template"
                onClick={() => {
                  addPage(t, pageId);
                  close();
                }}
              >
                <TemplateIllustration id={t.id} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

function InsertPanel() {
  return (
    <div className="ed-panel">
      <PanelHead title="Insert" />
      <div className="ed-panel-scroll">
        <p className="ed-panel-hint">Click to add to the {useEditor((s) => (s.project?.kind === 'slides' ? 'slide' : 'section'))}. Everything starts with good-looking defaults.</p>
        {CATALOG_GROUPS.map((g) => (
          <div key={g.id} className="ed-cat-group">
            <h3>{g.label}</h3>
            <div className={`ed-cat-grid ${g.id === 'interactive' ? 'is-wide' : ''}`}>
              {CATALOG.filter((c) => c.group === g.id).map((c) => (
                <CatalogCard key={c.id} item={c} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CatalogCard({ item }: { item: CatalogItem }) {
  return (
    <button className="ed-cat-card" onClick={() => insertCatalogItem(item)} title={item.hint} data-testid={`insert-${item.id}`} style={{ ['--cat' as string]: item.color }}>
      <span className="ed-cat-art">
        <CatalogIllustration id={item.id} />
      </span>
      <span className="ed-cat-label">{item.label}</span>
      {item.group === 'interactive' && <span className="ed-cat-hint">{item.hint}</span>}
    </button>
  );
}

function ImagesPanel() {
  const project = useEditor((s) => s.project)!;
  const assets = Object.values(project.assets);
  const [over, setOver] = useState(false);
  return (
    <div className="ed-panel">
      <PanelHead title="Images" />
      <div className="ed-panel-scroll">
        <div
          className={`ed-drop ${over ? 'is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setOver(false);
            await addImageFiles([...e.dataTransfer.files]);
          }}
        >
          <Icon name="upload" size={26} />
          <strong>Drop images here</strong>
          <span>PNG, JPEG, GIF, WebP or SVG — embedded right into your file</span>
          <button className="ed-btn ed-btn-primary ed-btn-sm" onClick={() => void pickImages(true)} data-testid="upload-images">
            Choose images
          </button>
        </div>
        {assets.length > 0 && <p className="ed-panel-hint">Click an image to place it. Right-click for options.</p>}
        <div className="ed-assets">
          {assets.map((a) => {
            const used = assetUsage(project, a.id);
            return (
              <button
                key={a.id}
                className="ed-asset"
                onClick={() => insertImage(a)}
                title={`${a.name} · ${a.width}×${a.height} · ${formatBytes(a.bytes)}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openContextMenu(
                    e.clientX,
                    e.clientY,
                    [
                      { label: 'Place on page', icon: 'plus', onClick: () => insertImage(a) },
                      { label: used ? `Remove (used ${used}×)` : 'Remove from project', icon: 'trash', danger: true, onClick: () => deleteAsset(a.id) },
                    ],
                    a.name,
                  );
                }}
              >
                <span className="ed-asset-img" style={{ backgroundImage: `url("${a.data}")` }} />
                <span className="ed-asset-meta">
                  <span>{a.name}</span>
                  <small>
                    {formatBytes(a.bytes)}
                    {!used && ' · unused'}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VariablesPanel() {
  const project = useEditor((s) => s.project)!;
  return (
    <div className="ed-panel">
      <PanelHead title="Variables">
        <button className="ed-icon-btn" aria-label="Add variable" title="Add variable" onClick={() => addVariable()}>
          <Icon name="plus" size={18} />
        </button>
      </PanelHead>
      <div className="ed-panel-scroll">
        <p className="ed-panel-hint">
          Variables are numbers your project remembers — like a score or a counter. Change them with interactions, show them in text by typing <code>{'{Name}'}</code>, or connect a progress bar.
        </p>
        {project.variables.length === 0 && (
          <div className="ed-empty">
            <div className="ed-empty-art">
              <Icon name="variable" size={30} />
            </div>
            <strong>No variables yet</strong>
            <button className="ed-btn ed-btn-primary ed-btn-sm" onClick={() => addVariable()} data-testid="add-variable">
              <Icon name="plus" size={16} /> Add a variable
            </button>
          </div>
        )}
        {project.variables.map((v) => (
          <div key={v.id} className="ed-var">
            <div className="ed-var-top">
              <span className="ed-var-badge">#</span>
              <input className="ed-input ed-var-name" value={v.name} aria-label="Variable name" onChange={(e) => renameVariable(v.id, e.target.value.replace(/[{}]/g, '').slice(0, 40))} />
              <button
                className="ed-icon-btn is-danger"
                aria-label={`Delete ${v.name}`}
                title="Delete variable"
                onClick={() => {
                  if (variableUsage(project, v.id) === 0 || confirm(`“${v.name}” is used in your project. Delete it anyway?`)) deleteVariable(v.id);
                }}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
            <div className="ed-var-row">
              <span>Starts at</span>
              <NumberInput
                value={v.initial}
                ariaLabel={`${v.name} starting value`}
                onChange={(n) =>
                  editor().update(
                    (d) => {
                      const x = d.variables.find((y) => y.id === v.id);
                      if (x) x.initial = n;
                    },
                    { merge: `var:${v.id}:init` },
                  )
                }
              />
            </div>
            <div className="ed-var-token">
              Show it in text: <code>{`{${v.name}}`}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
