import { useMemo } from 'react';
import type { ThemeId } from '../../model/types';
import { THEME_IDS, THEMES, applyProjectTheme, countCustomized, getTheme } from '../../model/theme';
import type { ThemeTokens } from '../../model/theme';
import { paintToCss } from '../../model/paint';
import { fontStack } from '../../runtime/fonts';
import { useEditor, editor } from '../store/store';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { toast } from '../ui/toast';

const gradId = (t: ThemeTokens, k: string) => `thp-${t.id}-${k}`;

function PaintDefs({ t }: { t: ThemeTokens }) {
  const defs: Array<[string, string, string, number]> = [];
  for (const [k, p] of Object.entries({ base: t.backgrounds.base, hero: t.backgrounds.hero, fill: t.progressFill })) {
    if (p.kind === 'linear') defs.push([k, p.from, p.to, p.angle]);
  }
  t.tones.slice(0, 3).forEach(([a, b], i) => defs.push([`tone${i}`, a, t.gradients ? b : b, 135]));
  return (
    <defs>
      {defs.map(([k, a, b, angle]) => {
        const r = ((angle - 90) * Math.PI) / 180;
        return (
          <linearGradient key={k} id={gradId(t, k)} x1={0.5 - Math.cos(r) / 2} y1={0.5 - Math.sin(r) / 2} x2={0.5 + Math.cos(r) / 2} y2={0.5 + Math.sin(r) / 2}>
            <stop offset="0" stopColor={a} />
            <stop offset="1" stopColor={b} />
          </linearGradient>
        );
      })}
    </defs>
  );
}

const fillOf = (t: ThemeTokens, k: 'base' | 'hero' | 'fill') => {
  const p = k === 'fill' ? t.progressFill : t.backgrounds[k];
  return p.kind === 'linear' ? `url(#${gradId(t, k)})` : p.color;
};

/**
 * Illustrated preview of a theme: a miniature slide with a hero panel, a
 * heading, text, a button, a card with a small chart and a quiz option —
 * drawn with the theme's real colours, fonts, radii and button shape.
 */
export function ThemePreview({ id, compact }: { id: ThemeId; compact?: boolean }) {
  const t = getTheme(id);
  const c = t.colors;
  const btnR = t.button.shape === 'pill' ? 11 : t.button.shape === 'rounded' ? 6 : 3;
  const card = Math.min(14, t.radius.card * 0.55);
  const heading = fontStack(t.fonts.heading);
  const body = fontStack(t.fonts.body);
  return (
    <svg viewBox="0 0 240 150" className={`ed-theme-preview ${compact ? 'is-compact' : ''}`} aria-hidden="true">
      <PaintDefs t={t} />
      <rect width="240" height="150" fill={fillOf(t, 'base')} />
      {/* hero panel */}
      <rect x="10" y="10" width="104" height="130" rx={card} fill={fillOf(t, 'hero')} />
      <text
        x="20"
        y="34"
        fontFamily={t.fonts.label === 'mono' ? fontStack('mono') : fontStack(t.fonts.label)}
        fontSize="7"
        fontWeight={700}
        letterSpacing="1.2"
        fill={c.heroMuted}
      >
        UPDATE 2.0
      </text>
      <text x="19" y="58" fontFamily={heading} fontSize="19" fontWeight={t.weights.heading} fill={c.heroText} letterSpacing={t.tracking.heading * 19}>
        Big idea
      </text>
      <rect x="20" y="68" width="70" height="4" rx="2" fill={c.heroMuted} opacity=".7" />
      <rect x="20" y="77" width="54" height="4" rx="2" fill={c.heroMuted} opacity=".7" />
      <rect
        x="20"
        y="96"
        width="56"
        height="22"
        rx={btnR}
        fill={t.button.variant === 'outline' ? 'none' : c.heroButton}
        stroke={c.heroButton}
        strokeWidth={t.button.variant === 'outline' ? 1.5 : 0}
      />
      <text
        x="48"
        y="110.5"
        textAnchor="middle"
        fontFamily={fontStack(t.button.font)}
        fontSize="8"
        fontWeight={800}
        fill={c.heroButton === '#ffffff' ? c.accent : c.onAccent}
      >
        Let's go
      </text>
      {/* card with chart */}
      <rect
        x="124"
        y="10"
        width="106"
        height="76"
        rx={card}
        fill={c.surface}
        stroke={c.border}
        strokeWidth={t.outlineWidth ? 1 : 0}
        style={{
          filter:
            t.shadows.card === 'glow'
              ? `drop-shadow(0 0 4px ${c.accent}55)`
              : t.shadows.card === 'none'
                ? undefined
                : 'drop-shadow(0 2px 4px rgba(20,16,50,.12))',
        }}
      />
      <text x="134" y="26" fontFamily={heading} fontSize="9" fontWeight={t.weights.heading} fill={c.text}>
        Growth
      </text>
      <path d="M134 74h86" stroke={c.border} strokeWidth="1" />
      {[22, 34, 26, 44, 38, 50].map((hgt, i) => (
        <rect key={i} x={137 + i * 14} y={74 - hgt} width="9" height={hgt} rx={t.gradients ? 3 : 1.5} fill={t.chart[i % 2]} />
      ))}
      {/* quiz option + text */}
      <rect
        x="124"
        y="94"
        width="106"
        height="20"
        rx={Math.min(10, t.radius.card * 0.45)}
        fill={c.surfaceAlt}
        stroke={c.border}
        strokeWidth={t.outlineWidth ? 1 : 0}
      />
      <circle cx="135" cy="104" r="5" fill={c.success} />
      <path d="M132.6 104l1.7 1.7 3-3.2" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <text x="145" y="107" fontFamily={body} fontSize="8" fontWeight={t.weights.body + 100} fill={c.text}>
        Correct answer
      </text>
      <rect x="124" y="122" width="88" height="4" rx="2" fill={c.muted} opacity=".55" />
      <rect x="124" y="131" width="64" height="4" rx="2" fill={c.muted} opacity=".55" />
      {!compact && <rect x="196" y="120" width="34" height="18" rx={btnR} fill={c.accent} />}
    </svg>
  );
}

export function ThemeDots({ id, size = 10 }: { id: ThemeId; size?: number }) {
  const t = getTheme(id);
  return (
    <span className="ed-theme-dots" aria-hidden="true">
      {[paintToCss(t.backgrounds.hero), t.colors.accent, t.colors.accent2, t.colors.bg].map((c, i) => (
        <i key={i} style={{ background: c, width: size, height: size }} />
      ))}
    </span>
  );
}

/** Grid of theme cards. `value` is highlighted; `onPick` fires on click. */
export function ThemeGrid({ value, onPick, compact, medium }: { value: ThemeId; onPick(id: ThemeId): void; compact?: boolean; medium?: boolean }) {
  return (
    <div className={`ed-theme-grid ${compact ? 'is-compact' : ''} ${medium ? 'is-medium' : ''}`} role="radiogroup" aria-label="Theme">
      {THEME_IDS.map((id) => {
        const t = THEMES[id];
        return (
          <button
            key={id}
            role="radio"
            aria-checked={value === id}
            className={`ed-theme-card ${value === id ? 'is-on' : ''}`}
            onClick={() => onPick(id)}
            data-testid={`theme-${id}`}
            title={t.tagline}
          >
            <ThemePreview id={id} compact={compact} />
            <span className="ed-theme-meta">
              <strong style={{ fontFamily: fontStack(t.fonts.heading) }}>{t.label}</strong>
              {!compact && <small>{t.tagline}</small>}
            </span>
            {value === id && (
              <span className="ed-theme-check">
                <Icon name="check" size={14} stroke={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Switch the theme of the open project; the canvas restyles live behind the dialog. */
export function setProjectTheme(id: ThemeId, resetCustom = false) {
  editor().update((d) => applyProjectTheme(d, id, { resetCustom }));
}

export function ThemeDialog() {
  const project = useEditor((s) => s.project)!;
  const theme = project.settings.theme;
  const custom = useMemo(() => countCustomized(project), [project]);
  const close = () => editor().set({ themeOpen: false });
  return (
    <Modal onClose={close} label="Theme" className="ed-theme-modal" docked>
      <div className="ed-theme-head">
        <span className="ed-theme-head-icon">
          <Icon name="palette" size={22} />
        </span>
        <div>
          <h2>Choose a theme</h2>
          <p>Colours, fonts, shapes and components change across every {project.kind === 'slides' ? 'slide' : 'section'} — watch the canvas as you try them.</p>
        </div>
      </div>
      <ThemeGrid value={theme} onPick={(id) => setProjectTheme(id)} medium />
      {custom > 0 && (
        <div className="ed-theme-custom">
          <Icon name="info" size={16} />
          <span>
            <strong>
              {custom} {custom === 1 ? 'item keeps its' : 'items keep their'} own style.
            </strong>{' '}
            Things you styled yourself (or made before themes existed) are left alone.
          </span>
          <button
            className="ed-btn ed-btn-sm ed-btn-soft"
            data-testid="theme-restyle-all"
            onClick={() => {
              setProjectTheme(theme, true);
              toast(`Everything now follows the ${getTheme(theme).label} theme. Undo brings your styles back.`, 'success');
            }}
          >
            <Icon name="reset" size={14} /> Restyle everything
          </button>
        </div>
      )}
      <div className="ed-modal-actions">
        <button className="ed-btn ed-btn-primary" onClick={close} data-testid="theme-done">
          Done
        </button>
      </div>
    </Modal>
  );
}
