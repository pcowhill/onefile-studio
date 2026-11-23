import { useEffect, useState } from 'react';
import { listDrafts, deleteDraft } from '../../io/storage';
import type { DraftSummary } from '../../io/storage';
import { EXAMPLES } from '../../examples';
import { importFile, openDraft, openExample, pickAndImport, startNew } from '../session';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { ThemeGrid } from '../theme/ThemePicker';
import type { ThemeId } from '../../model/types';
import { DEFAULT_THEME, isThemeId } from '../../model/theme';
import { TEMPLATES } from '../../templates';
import { LESSONS } from '../learn/lessons';
import { TemplateGallery } from './TemplateGallery';
import { LearnHub } from './LearnHub';
import { useStartUi } from './startUi';
import { siteHomeUrl } from '../deepLink';

const THEME_KEY = 'ofs:start-theme';
function initialTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isThemeId(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function StartScreen() {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [over, setOver] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(initialTheme);
  const panel = useStartUi((s) => s.panel);
  const setPanel = (p: 'templates' | 'learn' | null) => useStartUi.setState({ panel: p });
  const pickTheme = (id: ThemeId) => {
    setTheme(id);
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
      /* storage unavailable */
    }
  };
  useEffect(() => {
    void listDrafts().then(setDrafts);
  }, []);
  return (
    <div
      className={`st ${over ? 'is-over' : ''}`}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) void importFile(f);
      }}
    >
      <header className="st-head">
        <div className="st-brand">
          <Logo size={40} />
          <span>
            OneFile <b>Studio</b>
          </span>
        </div>
        <div className="st-head-actions">
          {siteHomeUrl() && (
            <a className="ed-btn ed-btn-ghost" href={siteHomeUrl()!} data-testid="site-home">
              <Icon name="home" size={18} /> Showcase
            </a>
          )}
          <button className="ed-btn ed-btn-ghost" onClick={() => setPanel('learn')} data-testid="open-learn">
            <Icon name="learn" size={18} /> Learn
          </button>
          <button className="ed-btn ed-btn-ghost" onClick={pickAndImport} data-testid="open-file">
            <Icon name="folder" size={18} /> Open a file
          </button>
        </div>
      </header>
      <main className="st-main">
        <section className="st-hero">
          <h1>
            What will you <span>make</span> today?
          </h1>
          <p>Build interactive slides and webpages without code — then share them as a single HTML file that works anywhere, even offline.</p>
        </section>
        <section className="st-themes" aria-label="Choose a style">
          <h2>
            <Icon name="palette" size={18} /> Pick a style <small>— you can change it any time</small>
          </h2>
          <ThemeGrid value={theme} onPick={pickTheme} compact />
        </section>
        <section className="st-create" aria-label="Create a new project">
          <button className="st-card st-card-slides" onClick={() => startNew('slides', theme)} data-testid="new-slides">
            <SlidesArt />
            <span className="st-card-text">
              <strong>Slide presentation</strong>
              <span>16:9 slides that scale to any screen, with buttons, reveals and animations.</span>
            </span>
            <span className="st-card-go">
              <Icon name="right" size={20} />
            </span>
          </button>
          <button className="st-card st-card-page" onClick={() => startNew('page', theme)} data-testid="new-page">
            <PageArt />
            <span className="st-card-text">
              <strong>Scrolling webpage</strong>
              <span>A tall page of stacked sections — great for stories, portfolios and guides.</span>
            </span>
            <span className="st-card-go">
              <Icon name="right" size={20} />
            </span>
          </button>
          <button className="st-card st-card-templates" onClick={() => setPanel('templates')} data-testid="browse-templates">
            <TemplatesArt />
            <span className="st-card-text">
              <strong>Start from a template</strong>
              <span>{TEMPLATES.length} polished starting points — walkthroughs, meetings, invitations and more.</span>
            </span>
            <span className="st-card-go">
              <Icon name="right" size={20} />
            </span>
          </button>
        </section>
        <section className="st-learn" aria-label="Learn">
          <LearnArt />
          <p>
            <strong>New to OneFile Studio?</strong> Learn by doing with {LESSONS.length} short, hands-on lessons — from your first slide to interactive
            challenges.
          </p>
          <button className="ed-btn ed-btn-soft" onClick={() => setPanel('learn')} data-testid="start-learning">
            <Icon name="learn" size={17} /> Start learning
          </button>
        </section>
        <div className="st-columns">
          <section className="st-examples" aria-label="Examples">
            <h2>
              <Icon name="sparkle" size={18} /> Open an example
            </h2>
            <div className="st-ex-grid">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  className="st-ex"
                  onClick={() => openExample(ex.id)}
                  style={{ ['--c' as string]: ex.color }}
                  data-testid={`example-${ex.id}`}
                >
                  <ExampleArt id={ex.id} />
                  <strong>{ex.title}</strong>
                  <span>{ex.description}</span>
                  <em>
                    <Icon name={ex.kind === 'slides' ? 'slides' : 'page'} size={13} /> {ex.kind === 'slides' ? 'Slides' : 'Webpage'}
                  </em>
                </button>
              ))}
            </div>
          </section>
          <aside className="st-side">
            <section className="st-import">
              <h2>
                <Icon name="upload" size={18} /> Keep editing a file
              </h2>
              <button className="st-drop" onClick={pickAndImport}>
                <Icon name="file" size={28} />
                <strong>Drop an exported .html file here</strong>
                <span>or click to browse — every OneFile export can be re-opened.</span>
              </button>
            </section>
            {drafts.length > 0 && (
              <section className="st-recent">
                <h2>
                  <Icon name="clock" size={18} /> Recent drafts
                </h2>
                <ul>
                  {drafts.slice(0, 6).map((d) => (
                    <li key={d.id}>
                      <button className="st-draft" onClick={() => void openDraft(d.id)}>
                        <span className={`st-draft-icon ${d.kind === 'slides' ? 'is-slides' : 'is-page'}`}>
                          <Icon name={d.kind === 'slides' ? 'slides' : 'page'} size={16} />
                        </span>
                        <span className="st-draft-text">
                          <strong>{d.title}</strong>
                          <small>
                            {d.pages} {d.kind === 'slides' ? 'slides' : 'sections'} · {timeAgo(d.updatedAt)}
                          </small>
                        </span>
                      </button>
                      <button
                        className="ed-icon-btn is-xs"
                        aria-label={`Delete draft ${d.title}`}
                        title="Delete draft"
                        onClick={async () => {
                          if (!confirm(`Delete the draft “${d.title}” from this browser?`)) return;
                          await deleteDraft(d.id);
                          setDrafts(await listDrafts());
                        }}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="st-note">Drafts live in this browser only. Export to keep a copy.</p>
              </section>
            )}
          </aside>
        </div>
      </main>
      {panel === 'templates' && <TemplateGallery onClose={() => setPanel(null)} />}
      {panel === 'learn' && <LearnHub onClose={() => setPanel(null)} />}
      {over && (
        <div className="st-dropzone">
          <Icon name="upload" size={40} />
          <strong>Drop to open</strong>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

function SlidesArt() {
  return (
    <svg viewBox="0 0 220 150" className="st-art" aria-hidden="true">
      <defs>
        <linearGradient id="sa1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b6cff" />
          <stop offset="1" stopColor="#5b3df5" />
        </linearGradient>
      </defs>
      <rect x="46" y="16" width="150" height="86" rx="10" fill="#d9d0ff" transform="rotate(6 121 59)" />
      <rect x="30" y="26" width="150" height="86" rx="10" fill="url(#sa1)" />
      <rect x="44" y="44" width="70" height="10" rx="5" fill="#fff" />
      <rect x="44" y="60" width="50" height="6" rx="3" fill="#cfc4ff" />
      <circle cx="148" cy="68" r="20" fill="#ffd23f" />
      <path d="M140 68 l6 6 l11 -12" stroke="#2a2340" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="44" y="88" width="40" height="12" rx="6" fill="#ff7eb3" />
      <rect x="30" y="122" width="150" height="6" rx="3" fill="#ece6ff" />
      <rect x="30" y="122" width="90" height="6" rx="3" fill="#ff7eb3" />
    </svg>
  );
}

function TemplatesArt() {
  return (
    <svg viewBox="0 0 220 150" className="st-art" aria-hidden="true">
      <rect x="22" y="34" width="96" height="64" rx="9" fill="#0b1f44" transform="rotate(-8 70 66)" />
      <rect x="36" y="44" width="40" height="7" rx="3.5" fill="#e8effd" transform="rotate(-8 70 66)" />
      <rect x="36" y="56" width="28" height="5" rx="2.5" fill="#7aa2f7" transform="rotate(-8 70 66)" />
      <rect x="102" y="30" width="96" height="64" rx="9" fill="#fff3d6" transform="rotate(7 150 62)" />
      <rect x="114" y="44" width="46" height="7" rx="3.5" fill="#5a3426" transform="rotate(7 150 62)" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={116 + i * 18} y="58" width="13" height="16" rx="3" fill="#2b2320" transform="rotate(7 150 62)" />
      ))}
      <rect x="58" y="58" width="104" height="70" rx="10" fill="#ff7eb3" />
      <rect x="58" y="58" width="104" height="70" rx="10" fill="url(#tpa)" />
      <defs>
        <linearGradient id="tpa" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b6cff" />
          <stop offset="1" stopColor="#ff7eb3" />
        </linearGradient>
      </defs>
      <rect x="72" y="72" width="52" height="8" rx="4" fill="#fff" />
      <rect x="72" y="86" width="36" height="5" rx="2.5" fill="#ffe1ef" />
      <rect x="72" y="104" width="30" height="12" rx="6" fill="#ffd23f" />
      <circle cx="140" cy="100" r="12" fill="#fff" opacity=".9" />
      <path d="M135 100l4 4 7-8" stroke="#6d4aff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LearnArt() {
  return (
    <svg viewBox="0 0 96 64" className="st-learn-art" aria-hidden="true">
      <rect x="6" y="30" width="22" height="26" rx="6" fill="#2bb673" />
      <rect x="37" y="18" width="22" height="38" rx="6" fill="#3d8bff" />
      <rect x="68" y="6" width="22" height="50" rx="6" fill="#6d4aff" />
      <path d="M12 43l4 4 7-8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M44 37h8M48 33v8" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M79 24l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" fill="#ffd23f" />
    </svg>
  );
}

function PageArt() {
  return (
    <svg viewBox="0 0 220 150" className="st-art" aria-hidden="true">
      <rect x="60" y="6" width="100" height="140" rx="10" fill="#fff" stroke="#e7e1fb" strokeWidth="2" />
      <path d="M60 16 a10 10 0 0 1 10 -10 h80 a10 10 0 0 1 10 10 v34 h-100z" fill="#2bb673" />
      <rect x="76" y="20" width="56" height="8" rx="4" fill="#fff" />
      <rect x="84" y="33" width="40" height="5" rx="2.5" fill="#b6f5d8" />
      <rect x="72" y="60" width="76" height="30" rx="6" fill="#ffb27a" />
      <path d="M72 66 a6 6 0 0 1 6 -6 h32 v30 h-32 a6 6 0 0 1 -6 -6z" fill="#c9ccd6" />
      <rect x="109" y="58" width="3" height="34" rx="1.5" fill="#fff" />
      <rect x="72" y="100" width="50" height="5" rx="2.5" fill="#d6d1e8" />
      <rect x="72" y="110" width="70" height="5" rx="2.5" fill="#d6d1e8" />
      <rect x="72" y="120" width="40" height="5" rx="2.5" fill="#d6d1e8" />
      <path d="M176 60 v40 M170 92 l6 8 6 -8" stroke="#6d4aff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExampleArt({ id }: { id: string }) {
  if (id === 'together')
    return (
      <svg viewBox="0 0 160 90" className="st-ex-art" aria-hidden="true">
        <rect width="160" height="90" rx="8" fill="#f3efff" />
        <circle cx="42" cy="40" r="15" fill="#ff6f9c" />
        <path d="M80 23l5 10.5 11.5 1.2-8.6 7.6 2.5 11.2L80 48l-10.4 5.5 2.5-11.2-8.6-7.6 11.5-1.2z" fill="#ffb53d" />
        <path d="M118 55c-9-6-15-11-15-18 0-5 4-9 8.5-9 3 0 5 2 6.5 4 1.5-2 3.5-4 6.5-4 4.5 0 8.5 4 8.5 9 0 7-6 12-15 18z" fill="#2fc28b" />
        <path d="M27 63h106" stroke="#cfc2fa" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M42 60v6M80 60v6M118 60v6" stroke="#cfc2fa" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="55" y="71" width="50" height="11" rx="5.5" fill="#6d4aff" />
      </svg>
    );
  if (id === 'explainer')
    return (
      <svg viewBox="0 0 160 90" className="st-ex-art" aria-hidden="true">
        <rect width="160" height="90" rx="8" fill="#0b1220" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={10 + i * 38} y="30" width="28" height="18" rx="4" fill={i === 0 ? '#22d3ee' : '#16233a'} stroke="#22385a" />
        ))}
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${39 + i * 38} 39h8`} stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
        ))}
        <rect x="12" y="58" width="44" height="12" rx="6" fill="rgba(34,211,238,.18)" />
        <rect x="104" y="60" width="16" height="12" rx="3" fill="#e6edf7" />
        <rect x="124" y="60" width="16" height="12" rx="3" fill="#e6edf7" />
        <path d="M108 66h8M114 63l3 3-3 3" stroke="#0b1220" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <text x="132" y="69.5" textAnchor="middle" fontSize="8" fontWeight="900" fill="#0b1220" fontFamily="system-ui">
          R
        </text>
        <rect x="12" y="12" width="60" height="7" rx="3.5" fill="#e6edf7" />
      </svg>
    );
  if (id === 'explorer')
    return (
      <svg viewBox="0 0 160 90" className="st-ex-art" aria-hidden="true">
        <defs>
          <radialGradient id="exg" cx="0.65" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#e0e7ff" />
            <stop offset="1" stopColor="#f8fafc" />
          </radialGradient>
        </defs>
        <rect width="160" height="90" rx="8" fill="url(#exg)" />
        <rect x="12" y="16" width="44" height="8" rx="4" fill="#1e293b" />
        <rect x="12" y="30" width="36" height="4" rx="2" fill="#94a3b8" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x="12" y={44 + i * 12} width="34" height="8" rx="4" fill={i === 0 ? '#4f46e5' : '#e0e7ff'} />
        ))}
        <ellipse cx="108" cy="72" rx="30" ry="5" fill="#1e293b" opacity=".12" />
        <rect x="86" y="44" width="46" height="16" rx="4" fill="#f1ede4" />
        <rect x="84" y="40" width="50" height="6" rx="2" fill="#1b2d6b" />
        <path d="M96 40V24" stroke="#f1ede4" strokeWidth="3" />
        <rect x="90" y="18" width="12" height="7" rx="2" fill="#f06a3c" />
        {[90, 108, 126].map((x) => (
          <circle key={x} cx={x} cy="64" r="6" fill="#2b2e33" />
        ))}
        <path d="M70 30a40 14 0 0 0 76 0" fill="none" stroke="#4f46e5" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
      </svg>
    );
  if (id === 'release')
    return (
      <svg viewBox="0 0 160 90" className="st-ex-art" aria-hidden="true">
        <defs>
          <linearGradient id="ear" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0b1f44" />
            <stop offset="1" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>
        <rect width="160" height="90" rx="8" fill="url(#ear)" />
        <rect x="12" y="18" width="34" height="7" rx="3.5" fill="#e8effd" />
        <rect x="12" y="31" width="50" height="10" rx="3" fill="#fff" />
        <rect x="12" y="46" width="42" height="4" rx="2" fill="#cbd5e1" />
        <rect x="12" y="62" width="30" height="10" rx="3" fill="#fff" />
        <rect x="76" y="16" width="72" height="56" rx="6" fill="#fff" />
        <rect x="76" y="16" width="72" height="8" rx="4" fill="#f1f5f9" />
        <circle cx="112" cy="46" r="10" fill="#2563eb" />
        <path d="M109 41.5v9l7.5-4.5z" fill="#fff" />
        <rect x="82" y="64" width="60" height="3" rx="1.5" fill="#e2e8f0" />
        <rect x="82" y="64" width="26" height="3" rx="1.5" fill="#2563eb" />
      </svg>
    );
  if (id === 'event')
    return (
      <svg viewBox="0 0 160 90" className="st-ex-art" aria-hidden="true">
        <rect width="160" height="90" rx="8" fill="#fbf7f1" />
        <rect x="0" y="0" width="160" height="40" rx="8" fill="#5a3426" />
        <rect x="0" y="32" width="160" height="8" fill="#5a3426" />
        <text x="80" y="27" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff8f0" fontFamily="'OFS Fraunces', Georgia, serif">
          The Autumn Social
        </text>
        {[40, 64, 88, 112].map((x, i) => (
          <g key={x}>
            <rect x={x - 10} y="50" width="20" height="24" rx="4" fill="#2b2320" />
            <text x={x} y="66" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff8f0" fontFamily="system-ui">
              {['02', '14', '37', '05'][i]}
            </text>
          </g>
        ))}
        <circle cx="140" cy="62" r="3" fill="#d99a3d" />
        <circle cx="20" cy="58" r="2.5" fill="#b5532c" />
        <rect x="134" y="74" width="5" height="3" fill="#6f8f5c" transform="rotate(30 136 75)" />
      </svg>
    );
  if (id === 'knowledge')
    return (
      <svg viewBox="0 0 160 90" className="st-ex-art" aria-hidden="true">
        <rect width="160" height="90" rx="8" fill="#0b1220" />
        <rect x="12" y="14" width="80" height="8" rx="4" fill="#e6edf7" />
        {[30, 46, 62].map((y, i) => (
          <g key={y}>
            <rect x="12" y={y} width="86" height="12" rx="3" fill={i === 1 ? 'rgba(52,211,153,.18)' : '#16233a'} stroke={i === 1 ? '#34d399' : '#22385a'} />
            <circle cx="19" cy={y + 6} r="3" fill={i === 1 ? '#34d399' : '#64779a'} />
          </g>
        ))}
        <circle cx="128" cy="44" r="18" fill="none" stroke="rgba(148,163,184,.25)" strokeWidth="6" />
        <path d="M128 26 a18 18 0 1 1 -15.6 27" fill="none" stroke="#22d3ee" strokeWidth="6" strokeLinecap="round" />
        <text x="128" y="48" textAnchor="middle" fontSize="11" fontWeight="700" fill="#e6edf7" fontFamily="system-ui">
          2/3
        </text>
      </svg>
    );
  if (id === 'presentation')
    return (
      <svg viewBox="0 0 160 90" className="st-ex-art" aria-hidden="true">
        <defs>
          <linearGradient id="ea1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2b1b6b" />
            <stop offset="1" stopColor="#6d4aff" />
          </linearGradient>
        </defs>
        <rect width="160" height="90" rx="8" fill="url(#ea1)" />
        <rect x="12" y="28" width="56" height="10" rx="3" fill="#fff" />
        <rect x="12" y="42" width="40" height="10" rx="3" fill="#fff" />
        <rect x="12" y="58" width="50" height="4" rx="2" fill="#cfc4ff" />
        <circle cx="118" cy="45" r="28" fill="#ff7eb3" opacity=".8" />
        <path d="M110 60 l20 -32 l4 26z" fill="#fff" />
        <rect x="0" y="86" width="160" height="4" fill="#ffd23f" />
      </svg>
    );
  if (id === 'before-after')
    return (
      <svg viewBox="0 0 160 90" className="st-ex-art" aria-hidden="true">
        <rect width="160" height="90" rx="8" fill="#ffd3a5" />
        <path d="M0 60 L40 30 L70 50 L100 25 L130 48 L160 35 V90 H0Z" fill="#2bb673" />
        <path d="M0 8 a8 8 0 0 1 8 -8 H80 V90 H8 a8 8 0 0 1 -8 -8Z" fill="#c9ccd6" />
        <path d="M0 60 L40 30 L70 50 L80 45 V90 H8 a8 8 0 0 1 -8 -8Z" fill="#9196a6" />
        <rect x="78.5" y="0" width="3" height="90" fill="#fff" />
        <circle cx="80" cy="45" r="10" fill="#fff" />
        <path d="M76 41 l-4 4 4 4 M84 41 l4 4 -4 4" stroke="#1f9d5f" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 160 90" className="st-ex-art" aria-hidden="true">
      <defs>
        <radialGradient id="ea3" cx=".4" cy=".35" r=".7">
          <stop offset="0" stopColor="#ffb6e1" />
          <stop offset="1" stopColor="#c2338a" />
        </radialGradient>
      </defs>
      <rect width="160" height="90" rx="8" fill="#2a1757" />
      <circle cx="110" cy="46" r="26" fill="url(#ea3)" />
      <ellipse cx="110" cy="50" rx="38" ry="9" fill="none" stroke="#ffd23f" strokeWidth="3.5" transform="rotate(-12 110 50)" />
      <circle cx="102" cy="44" r="3" fill="#2a1840" />
      <circle cx="118" cy="44" r="3" fill="#2a1840" />
      <path d="M104 53 q6 5 12 0" stroke="#2a1840" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="14" y="22" width="48" height="18" rx="6" fill="#ffd23f" />
      <rect x="14" y="50" width="48" height="6" rx="3" fill="rgba(255,255,255,.2)" />
      <rect x="14" y="50" width="30" height="6" rx="3" fill="#ff7eb3" />
      <circle cx="20" cy="74" r="2.5" fill="#fff" />
      <circle cx="148" cy="12" r="2" fill="#fff" />
    </svg>
  );
}
