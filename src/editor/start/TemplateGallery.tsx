import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '../../templates';
import type { TemplateCategory, TemplateDef } from '../../templates';
import type { Project, ThemeId } from '../../model/types';
import { applyProjectTheme, THEME_IDS, THEMES } from '../../model/theme';
import { createPlayer } from '../../runtime/player';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { PageThumb } from '../panels/PageThumb';
import { ThemeDots } from '../theme/ThemePicker';
import { openTemplate } from '../learn/session';

/**
 * The template gallery: a category filter and a grid of cards whose pictures
 * are rendered live from the template projects themselves (so a changed
 * template can never show a stale preview). Preview plays the template
 * without saving anything; "Use template" opens an independent copy.
 */
export function TemplateGallery({ onClose }: { onClose(): void }) {
  const [cat, setCat] = useState<TemplateCategory | 'all'>('all');
  const [previewing, setPreviewing] = useState<TemplateDef | null>(null);
  // Built once per opening: the cards render these projects' first page.
  const built = useMemo(() => new Map(TEMPLATES.map((t) => [t.id, t.build()] as const)), []);
  const shown = TEMPLATES.filter((t) => cat === 'all' || t.category === cat);
  const cats = TEMPLATE_CATEGORIES.filter((c) => c.id === 'all' || TEMPLATES.some((t) => t.category === c.id));

  if (previewing) return <TemplatePreview def={previewing} onBack={() => setPreviewing(null)} />;
  return (
    <Modal onClose={onClose} label="Templates" className="tg" wide>
      <header className="tg-head">
        <div>
          <h2>
            <Icon name="template" size={22} /> Start from a template
          </h2>
          <p>Polished starting points. Every template is a normal project — change, add or remove anything.</p>
        </div>
      </header>
      <div className="tg-cats" role="tablist" aria-label="Categories">
        {cats.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={cat === c.id}
            className={`tg-cat ${cat === c.id ? 'is-on' : ''}`}
            onClick={() => setCat(c.id)}
            data-testid={`tpl-cat-${c.id}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="tg-grid" data-testid="template-grid">
        {shown.map((t) => {
          const p = built.get(t.id)!;
          return (
            <article key={t.id} className="tg-card" data-testid={`template-${t.id}`}>
              <button className="tg-thumb" onClick={() => setPreviewing(t)} aria-label={`Preview ${t.title}`} style={{ background: p.settings.backdrop }}>
                <FitThumb project={p} />
                <span className="tg-kind">
                  <Icon name={t.kind === 'slides' ? 'slides' : 'page'} size={13} /> {t.kind === 'slides' ? `Slides · ${p.pages.length}` : 'Scrolling webpage'}
                </span>
              </button>
              <div className="tg-body">
                <h3>{t.title}</h3>
                <p>{t.description}</p>
                <div className="tg-meta">
                  <span className={`tg-level is-${t.difficulty.toLowerCase()}`}>{t.difficulty}</span>
                  <ThemeDots id={t.theme} size={9} />
                  <span className="tg-theme">{THEMES[t.theme].label}</span>
                </div>
              </div>
              <div className="tg-actions">
                <button className="ed-btn ed-btn-sm ed-btn-ghost" onClick={() => setPreviewing(t)} data-testid={`preview-template-${t.id}`}>
                  <Icon name="play" size={14} /> Preview
                </button>
                <button className="ed-btn ed-btn-sm ed-btn-primary" onClick={() => openTemplate(t)} data-testid={`use-template-${t.id}`}>
                  Use template
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </Modal>
  );
}

/** The project's first page, rendered by the runtime at the card's actual width. */
function FitThumb({ project }: { project: Project }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth); // layout width: unaffected by the dialog's pop-in transform
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <span className="tg-fit" ref={ref}>
      {w > 0 && <PageThumb project={project} page={project.pages[0]} index={0} width={w} />}
    </span>
  );
}

/** Plays a template with the real runtime (nothing is saved) and lets the author try it in another theme. */
function TemplatePreview({ def, onBack }: { def: TemplateDef; onBack(): void }) {
  const [theme, setTheme] = useState<ThemeId>(def.theme);
  const [run, setRun] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const project = useMemo<Project>(() => {
    const p = def.build();
    if (theme !== p.settings.theme) applyProjectTheme(p, theme);
    return p;
    // `run` rebuilds the project too (fresh variables and countdown).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, theme, run]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const player = createPlayer(el, project, {
      openLink(href) {
        if (/^(mailto|tel):/.test(href)) return window.location.assign(href);
        window.open(href, '_blank', 'noopener,noreferrer');
      },
    });
    player.root.focus({ preventScroll: true });
    return () => player.destroy();
  }, [project]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onBack]);
  return createPortal(
    <div className="ed-preview tg-preview" role="dialog" aria-modal="true" aria-label={`Preview: ${def.title}`} data-testid="template-preview">
      <div className="ed-preview-bar">
        <button className="ed-btn ed-btn-sm ed-btn-light" onClick={onBack} data-testid="template-preview-back">
          <Icon name="left" size={15} /> Templates
        </button>
        <span className="ed-preview-title">{def.title}</span>
        <span className="tg-preview-themes" role="radiogroup" aria-label="Try another style">
          <small>Style</small>
          {THEME_IDS.map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={theme === id}
              className={`tg-swatch ${theme === id ? 'is-on' : ''}`}
              onClick={() => setTheme(id)}
              title={THEMES[id].label}
              data-testid={`preview-theme-${id}`}
            >
              <ThemeDots id={id} size={8} />
              <span>{THEMES[id].label}</span>
            </button>
          ))}
        </span>
        <span className="ed-spacer" />
        <button className="ed-btn ed-btn-sm ed-btn-dark" onClick={() => setRun((r) => r + 1)} title="Start over">
          <Icon name="restart" size={15} /> Restart
        </button>
        <button className="ed-btn ed-btn-sm ed-btn-primary" onClick={() => openTemplate(def, theme)} data-testid="template-preview-use">
          Use this template
        </button>
      </div>
      <div className="ed-preview-stage" ref={host} key={`${theme}-${run}`} />
    </div>,
    document.body,
  );
}
