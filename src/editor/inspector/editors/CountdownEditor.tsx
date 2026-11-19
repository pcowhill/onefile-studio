import { useEffect, useMemo, useState } from 'react';
import type { CountdownProps } from '../../../runtime/elements/countdown';
import { countdownState } from '../../../runtime/elements/countdown';
import { addDays, formatOffset, formatWallTime, relativeTime, tzOffset, utcToZonedParts, WEEKDAYS, zonedTimeToUtc } from '../../../runtime/time';
import { isValidTimeZone } from '../../../model/propSchemas';
import type { P } from '../shared';
import { SHADOW_OPTS } from '../shared';
import { ColorPicker, Field, FontPicker, Section, Segmented, Slider, TextInput, Toggle } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { localTimeZone } from '../../catalog';
import '../../../styles/interactive.css';

/** Common IANA zones, grouped for the picker (the author's own zone and UTC are always offered too). */
const ZONE_GROUPS: Array<[string, string[]]> = [
  [
    'Americas',
    [
      'Pacific/Honolulu',
      'America/Anchorage',
      'America/Los_Angeles',
      'America/Denver',
      'America/Phoenix',
      'America/Chicago',
      'America/Mexico_City',
      'America/New_York',
      'America/Toronto',
      'America/Bogota',
      'America/Halifax',
      'America/Santiago',
      'America/Argentina/Buenos_Aires',
      'America/Sao_Paulo',
    ],
  ],
  [
    'Europe & Africa',
    [
      'Europe/London',
      'Europe/Dublin',
      'Europe/Lisbon',
      'Africa/Lagos',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Madrid',
      'Europe/Rome',
      'Europe/Amsterdam',
      'Europe/Stockholm',
      'Europe/Warsaw',
      'Europe/Athens',
      'Europe/Helsinki',
      'Africa/Cairo',
      'Africa/Johannesburg',
      'Europe/Istanbul',
      'Africa/Nairobi',
      'Europe/Moscow',
    ],
  ],
  [
    'Asia & Pacific',
    [
      'Asia/Dubai',
      'Asia/Karachi',
      'Asia/Kolkata',
      'Asia/Kathmandu',
      'Asia/Dhaka',
      'Asia/Bangkok',
      'Asia/Jakarta',
      'Asia/Singapore',
      'Asia/Hong_Kong',
      'Asia/Shanghai',
      'Asia/Manila',
      'Asia/Seoul',
      'Asia/Tokyo',
      'Australia/Perth',
      'Australia/Brisbane',
      'Australia/Adelaide',
      'Australia/Sydney',
      'Pacific/Auckland',
    ],
  ],
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const zoneName = (tz: string) => tz.replace(/_/g, ' ');

function zoneLabel(tz: string, now: number): string {
  let off = '';
  try {
    off = formatOffset(tzOffset(now, tz));
  } catch {
    /* unsupported zone */
  }
  return tz === 'UTC' ? 'UTC' : `${zoneName(tz)} (${off})`;
}

function allZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?(k: string): string[] }).supportedValuesOf;
    if (fn) return fn('timeZone');
  } catch {
    /* older browsers */
  }
  return ZONE_GROUPS.flatMap(([, z]) => z);
}

/** Re-renders every `ms` so relative times ("in 5 minutes") stay current. */
function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Wall-clock values of `iso` in `tz` for the native date/time inputs. */
function wallInputs(iso: string, tz: string) {
  const t = Date.parse(iso);
  const p = utcToZonedParts(Number.isFinite(t) ? t : Date.now(), tz);
  return { date: `${p.year}-${pad2(p.month)}-${pad2(p.day)}`, time: `${pad2(p.hour)}:${pad2(p.minute)}`, parts: p };
}

function toIso(date: string, time: string, tz: string): string | null {
  const d = /^(\d{4,6})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!d || !t) return null;
  const ms = zonedTimeToUtc({ year: +d[1], month: +d[2], day: +d[3], hour: +t[1], minute: +t[2], second: t[3] ? +t[3] : 0 }, tz);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

interface Preset {
  id: string;
  label: string;
  make(now: number, tz: string): number;
}
const PRESETS: Preset[] = [
  { id: 'hour', label: 'In 1 hour', make: (now) => Math.ceil((now + 3600_000) / 60_000) * 60_000 },
  {
    id: 'tomorrow',
    label: 'Tomorrow 9:00',
    make: (now, tz) => zonedTimeToUtc({ ...addDays(utcToZonedParts(now, tz), 1), hour: 9, minute: 0 }, tz),
  },
  {
    id: 'friday',
    label: 'Next Friday 17:00',
    make: (now, tz) => {
      const today = utcToZonedParts(now, tz);
      const ahead = (5 - today.weekday + 7) % 7 || 7;
      return zonedTimeToUtc({ ...addDays(today, ahead), hour: 17, minute: 0 }, tz);
    },
  },
  {
    id: 'newyear',
    label: 'New Year',
    make: (now, tz) => zonedTimeToUtc({ year: utcToZonedParts(now, tz).year + 1, month: 1, day: 1, hour: 0, minute: 0 }, tz),
  },
];

function StyleGlyph({ kind }: { kind: CountdownProps['style'] }) {
  if (kind === 'cards')
    return (
      <svg viewBox="0 0 64 36" width="58" height="32" aria-hidden="true">
        {[2, 23, 44].map((x) => (
          <g key={x}>
            <rect x={x} y="4" width="18" height="20" rx="4" className="ed-cd-fill" />
            <rect x={x + 4} y="28" width="10" height="3" rx="1.5" className="ed-cd-muted" />
            <rect x={x + 5} y="11" width="8" height="6" rx="1.5" className="ed-cd-on" />
          </g>
        ))}
      </svg>
    );
  if (kind === 'digital')
    return (
      <svg viewBox="0 0 64 36" width="58" height="32" aria-hidden="true">
        <text x="32" y="25" textAnchor="middle" className="ed-cd-digits">
          12:45
        </text>
      </svg>
    );
  return (
    <svg viewBox="0 0 64 36" width="58" height="32" aria-hidden="true">
      <rect x="3" y="15" width="8" height="7" rx="2" className="ed-cd-fill" />
      <rect x="13" y="17" width="9" height="4" rx="2" className="ed-cd-muted" />
      <rect x="25" y="15" width="8" height="7" rx="2" className="ed-cd-fill" />
      <rect x="35" y="17" width="5" height="4" rx="2" className="ed-cd-muted" />
      <rect x="43" y="15" width="8" height="7" rx="2" className="ed-cd-fill" />
      <rect x="53" y="17" width="8" height="4" rx="2" className="ed-cd-muted" />
    </svg>
  );
}

const UNIT_TOGGLES: Array<{ key: 'showDays' | 'showHours' | 'showMinutes' | 'showSeconds'; label: string }> = [
  { key: 'showDays', label: 'Days' },
  { key: 'showHours', label: 'Hours' },
  { key: 'showMinutes', label: 'Minutes' },
  { key: 'showSeconds', label: 'Seconds' },
];

function holdLabel(min: number) {
  if (min <= 0) return 'Roll over at once';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Inspector for the Countdown element. */
export function CountdownEditor({ el, set }: P<CountdownProps>) {
  const p = el.props;
  const now = useNow();
  const tz = isValidTimeZone(p.timezone) ? p.timezone : 'UTC';
  const local = useMemo(localTimeZone, []);
  const { date, time } = wallInputs(p.target, tz);
  const [otherZone, setOtherZone] = useState(false);
  const zones = useMemo(allZones, []);

  const curated = new Set(['UTC', local, ...ZONE_GROUPS.flatMap(([, z]) => z)]);
  const zoneOptions = (
    <>
      <option value={local}>{`${zoneLabel(local, now)} · your zone`}</option>
      {local !== 'UTC' && <option value="UTC">{zoneLabel('UTC', now)}</option>}
      {!curated.has(tz) && <option value={tz}>{zoneLabel(tz, now)}</option>}
      {ZONE_GROUPS.map(([group, list]) => (
        <optgroup key={group} label={group}>
          {list
            .filter((z) => z !== local)
            .map((z) => (
              <option key={z} value={z}>
                {zoneLabel(z, now)}
              </option>
            ))}
        </optgroup>
      ))}
      <option value="@other">Another time zone…</option>
    </>
  );

  /** Keep the wall-clock date and time; reinterpret them in the new zone. */
  const changeZone = (next: string) => {
    if (!isValidTimeZone(next)) return;
    const iso = toIso(date, time, next);
    set(iso ? { timezone: next, target: iso } : { timezone: next });
  };
  const setWall = (d: string, t: string) => {
    const iso = toIso(d, t, tz);
    if (iso) set({ target: iso }, 'cd-target');
  };

  const st = countdownState(p, now);
  const repeating = p.repeat === 'daily' || p.repeat === 'weekly';
  const occ = st.occurrence;
  const tParts = wallInputs(p.target, tz).parts;
  const summary = repeating ? (
    <>
      Repeats <b>{p.repeat === 'daily' ? 'every day' : `every ${WEEKDAYS[tParts.weekday]}`}</b> at <b>{time}</b> in {zoneName(tz)} — next on{' '}
      <b>{formatWallTime(occ, tz, false)}</b>, {st.done ? 'showing the done message now' : relativeTime(occ - now)}.
    </>
  ) : (
    <>
      Counts down to <b>{formatWallTime(occ, tz)}</b> in {zoneName(tz)} —{' '}
      {st.done ? `that was ${relativeTime(occ - now)}` : `that's ${relativeTime(occ - now)}`}.
    </>
  );
  const viewerNote = tz !== local && !st.done ? ` For you that's ${formatWallTime(occ, local)}.` : '';
  const onlyOne = UNIT_TOGGLES.filter((u) => p[u.key]).length <= 1;

  return (
    <>
      <Section title="Countdown" icon="timer">
        <div className={`ed-cd-summary ${st.done && !repeating ? 'is-past' : ''}`} data-testid="countdown-summary" aria-live="polite">
          <Icon name={st.done && !repeating ? 'warning' : 'clock'} size={16} />
          <span>
            {summary}
            {viewerNote && <small>{viewerNote}</small>}
            {st.done && !repeating && <small> Viewers will see “{p.doneText || 'the done message'}”. Pick a future time to count down to.</small>}
          </span>
        </div>
        <div className="ed-grid2">
          <Field label="Date">
            <input
              className="ed-input"
              type="date"
              value={date}
              aria-label="Countdown date"
              data-testid="countdown-date"
              onChange={(e) => e.target.value && setWall(e.target.value, time)}
            />
          </Field>
          <Field label="Time">
            <input
              className="ed-input"
              type="time"
              value={time}
              aria-label="Countdown time"
              data-testid="countdown-time"
              onChange={(e) => e.target.value && setWall(date, e.target.value)}
            />
          </Field>
        </div>
        <Field label="Time zone" hint="The date and time above are in this zone. Viewers anywhere see the right amount of time left.">
          <div className="ed-select">
            <select
              value={tz}
              aria-label="Time zone"
              data-testid="countdown-zone"
              onChange={(e) => {
                if (e.target.value === '@other') setOtherZone(true);
                else {
                  setOtherZone(false);
                  changeZone(e.target.value);
                }
              }}
            >
              {zoneOptions}
            </select>
            <Icon name="chevron" size={14} />
          </div>
        </Field>
        {otherZone && <ZoneSearch zones={zones} onPick={(z) => (changeZone(z), setOtherZone(false))} />}
        <div className="ed-chips ed-cd-presets">
          <span className="ed-chips-label">Quick:</span>
          {PRESETS.map((pr) => (
            <button
              key={pr.id}
              className="ed-chip"
              data-testid={`countdown-preset-${pr.id}`}
              onClick={() => set({ target: new Date(pr.make(Date.now(), tz)).toISOString(), repeat: 'none' })}
            >
              {pr.label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Display" icon="palette">
        <Field label="Style">
          <div className="ed-cd-styles" role="radiogroup" aria-label="Countdown style">
            {(['cards', 'digital', 'inline'] as const).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={p.style === k}
                className={`ed-cd-style ${p.style === k ? 'is-on' : ''}`}
                onClick={() => set({ style: k })}
                data-testid={`countdown-style-${k}`}
              >
                <StyleGlyph kind={k} />
                <small>{k === 'cards' ? 'Cards' : k === 'digital' ? 'Digital' : 'Inline'}</small>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Show">
          <div className="ed-cd-units" role="group" aria-label="Units">
            {UNIT_TOGGLES.map((u) => (
              <button
                key={u.key}
                className={`ed-cd-unit ${p[u.key] ? 'is-on' : ''}`}
                aria-pressed={p[u.key]}
                disabled={p[u.key] && onlyOne}
                title={p[u.key] && onlyOne ? 'At least one unit is shown' : undefined}
                onClick={() => set({ [u.key]: !p[u.key] } as Partial<CountdownProps>)}
              >
                {u.label}
              </button>
            ))}
          </div>
        </Field>
        {!p.showDays && p.showHours && <p className="ed-note">Days are hidden, so hours keep counting past 24.</p>}
        <Toggle label="Show unit labels" checked={p.showLabels} onChange={(v) => set({ showLabels: v })} />
        <Field label="Title">
          <TextInput value={p.title} onChange={(v) => set({ title: v }, 'cd-title')} placeholder="Optional, e.g. Starts in" ariaLabel="Countdown title" />
        </Field>
        <Field label="When time is up, show">
          <TextInput value={p.doneText} onChange={(v) => set({ doneText: v }, 'cd-done')} placeholder="It's here!" ariaLabel="Done text" />
        </Field>
        <p className="ed-note">Tip: use the Behavior tab’s “Countdown finishes” trigger to show something or move on when it reaches zero.</p>
      </Section>
      <Section title="Repeat" icon="restart" defaultOpen={repeating}>
        <Segmented
          value={repeating ? p.repeat : 'none'}
          onChange={(v) => set({ repeat: v })}
          ariaLabel="Repeat"
          options={[
            { value: 'none', label: 'Once' },
            { value: 'daily', label: 'Every day' },
            { value: 'weekly', label: 'Every week' },
          ]}
        />
        {repeating && (
          <>
            <p className="ed-note">
              Always counts to the next {time} {p.repeat === 'weekly' ? `on a ${WEEKDAYS[tParts.weekday]}` : ''} in {zoneName(tz)}, also across daylight-saving
              changes.
            </p>
            <Field label="Keep the done message up for">
              <Slider
                value={Math.min(p.holdMinutes, 720)}
                min={0}
                max={720}
                step={5}
                onChange={(v) => set({ holdMinutes: v }, 'cd-hold')}
                format={holdLabel}
                ariaLabel="Hold time"
              />
            </Field>
          </>
        )}
      </Section>
      <Section title="Colours & fonts" icon="palette" defaultOpen={false}>
        <Field label="Numbers font">
          <FontPicker value={p.font} onChange={(f) => set({ font: f })} />
        </Field>
        <Field label="Label font">
          <FontPicker value={p.labelFont} onChange={(f) => set({ labelFont: f })} />
        </Field>
        {p.style === 'cards' && (
          <>
            <Field label="Card colour">
              <ColorPicker value={p.cardBg} onChange={(c) => set({ cardBg: c })} />
            </Field>
            <Field label="Card numbers">
              <ColorPicker value={p.cardText} onChange={(c) => set({ cardText: c })} />
            </Field>
          </>
        )}
        <Field label={p.style === 'cards' ? 'Title colour' : 'Text colour'}>
          <ColorPicker value={p.color} onChange={(c) => set({ color: c })} />
        </Field>
        <Field label="Accent (separators, numbers in a sentence, done message)">
          <ColorPicker value={p.accent} onChange={(c) => set({ accent: c })} />
        </Field>
        <Field label="Labels">
          <ColorPicker value={p.labelColor} onChange={(c) => set({ labelColor: c })} />
        </Field>
        {p.style === 'cards' && (
          <>
            <Field label="Rounded corners">
              <Slider value={p.radius} min={0} max={60} unit="px" onChange={(v) => set({ radius: v }, 'radius')} />
            </Field>
            <Field label="Shadow">
              <Segmented value={p.shadow} onChange={(v) => set({ shadow: v })} options={SHADOW_OPTS} size="sm" />
            </Field>
          </>
        )}
      </Section>
    </>
  );
}

function ZoneSearch({ zones, onPick }: { zones: string[]; onPick(z: string): void }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase().replace(/\s+/g, '_');
  const matches = query ? zones.filter((z) => z.toLowerCase().includes(query)).slice(0, 8) : [];
  return (
    <div className="ed-cd-search">
      <TextInput value={q} onChange={setQ} placeholder="Search a city or region, e.g. Lima" ariaLabel="Search time zones" autoFocus />
      {matches.length > 0 && (
        <div className="ed-cd-matches" role="listbox" aria-label="Matching time zones">
          {matches.map((z) => (
            <button key={z} role="option" aria-selected={false} className="ed-cd-match" onClick={() => onPick(z)}>
              {zoneLabel(z, Date.now())}
            </button>
          ))}
        </div>
      )}
      {query && !matches.length && <p className="ed-note">No time zone matches “{q}”.</p>}
    </div>
  );
}
