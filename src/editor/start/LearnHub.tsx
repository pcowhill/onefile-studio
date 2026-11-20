import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { LESSONS, LEVELS } from '../learn/lessons';
import { completedLessons, onProgressChange, resetLessonProgress } from '../learn/progress';
import { startLesson } from '../learn/session';

/**
 * The Learn hub: three levels of short, hands-on lessons. Any lesson can be
 * started at any time; each runs in its own practice project.
 */
export function LearnHub({ onClose }: { onClose(): void }) {
  const [done, setDone] = useState<string[]>(completedLessons);
  useEffect(() => onProgressChange(() => setDone(completedLessons())), []);
  return (
    <Modal onClose={onClose} label="Learn" className="lh" wide>
      <header className="tg-head">
        <div>
          <h2>
            <Icon name="learn" size={22} /> Learn by doing
          </h2>
          <p>Short lessons inside the real editor. Each one uses a practice project — your own work is never touched. Skip around as you like.</p>
        </div>
      </header>
      <div className="lh-levels">
        {LEVELS.map((lv) => (
          <section key={lv.id} className="lh-level" style={{ ['--lv' as string]: lv.color }} aria-label={lv.label}>
            <h3>
              <span className="lh-level-dot" aria-hidden="true" /> {lv.label}
            </h3>
            <p className="lh-blurb">{lv.blurb}</p>
            <ul>
              {LESSONS.filter((l) => l.level === lv.id).map((l) => {
                const complete = done.includes(l.id);
                return (
                  <li key={l.id}>
                    <button className={`lh-lesson ${complete ? 'is-done' : ''}`} onClick={() => startLesson(l.id)} data-testid={`lesson-${l.id}`}>
                      <LessonArt id={l.id} />
                      <span className="lh-text">
                        <strong>
                          {l.number}. {l.title}
                        </strong>
                        <span>{l.summary}</span>
                        <small>
                          <Icon name="clock" size={12} /> {l.minutes} min{complete ? ' · completed' : ''}
                        </small>
                      </span>
                      <span className="lh-go" aria-hidden="true">
                        {complete ? <Icon name="check" size={16} stroke={3} /> : <Icon name="play" size={14} fill="currentColor" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <footer className="lh-foot">
        <span>
          {done.length} of {LESSONS.length} lessons completed
        </span>
        {done.length > 0 && (
          <button className="ed-link" onClick={resetLessonProgress} data-testid="reset-lesson-progress">
            Reset progress
          </button>
        )}
      </footer>
    </Modal>
  );
}

/** Tiny illustrations, one per lesson. */
export function LessonArt({ id }: { id: string }) {
  const frame = (body: React.ReactNode, bg = '#f4f1fe') => (
    <svg viewBox="0 0 72 52" className="lh-art" aria-hidden="true">
      <rect width="72" height="52" rx="10" fill={bg} />
      {body}
    </svg>
  );
  switch (id) {
    case 'first-onefile':
      return frame(
        <>
          <rect x="10" y="12" width="30" height="6" rx="3" fill="#6d4aff" />
          <rect x="10" y="22" width="20" height="4" rx="2" fill="#c9bdfb" />
          <rect x="40" y="24" width="20" height="18" rx="4" fill="#ff7eb3" />
          <path d="M58 40l5 5" stroke="#2a2340" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="38" y="22" width="24" height="22" rx="5" fill="none" stroke="#6d4aff" strokeWidth="1.5" strokeDasharray="3 2" />
        </>,
      );
    case 'interactive':
      return frame(
        <>
          <rect x="8" y="30" width="26" height="12" rx="6" fill="#6d4aff" />
          <path d="M30 40l3 8 2-3 3 3 1.5-1.5-3-3 3-2z" fill="#2a2340" />
          <path d="M38 24c6-6 10-6 14-4" stroke="#2bb673" strokeWidth="2" fill="none" strokeDasharray="3 2" />
          <rect x="44" y="10" width="20" height="14" rx="4" fill="#ffd23f" />
          <path d="M50 17l2.5 2.5 5-5" stroke="#2a2340" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>,
        '#eafaf2',
      );
    case 'share':
      return frame(
        <>
          <path d="M24 8h16l8 8v28H24z" fill="#fff" stroke="#6d4aff" strokeWidth="2" strokeLinejoin="round" />
          <path d="M40 8v8h8" fill="none" stroke="#6d4aff" strokeWidth="2" strokeLinejoin="round" />
          <text x="36" y="34" textAnchor="middle" fontSize="8" fontWeight="900" fill="#6d4aff" fontFamily="system-ui">
            .html
          </text>
          <path d="M54 30h10M60 26l4 4-4 4" stroke="#2bb673" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M18 30H8M12 26l-4 4 4 4" stroke="#ff7eb3" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>,
        '#eef4ff',
      );
    case 'media':
      return frame(
        <>
          <rect x="8" y="8" width="56" height="36" rx="5" fill="#ffd3a5" />
          <path d="M8 34l14-12 10 8 10-10 22 16v4a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z" fill="#2bb673" />
          <path d="M8 13a5 5 0 0 1 5-5h23v36H13a5 5 0 0 1-5-5z" fill="#c9ccd6" opacity=".9" />
          <rect x="35" y="8" width="2" height="36" fill="#fff" />
          <circle cx="36" cy="26" r="5" fill="#fff" />
        </>,
        '#fff4e6',
      );
    case 'motion':
      return frame(
        <>
          <path d="M14 38c8-20 20-26 34-22" stroke="#c9bdfb" strokeWidth="2" fill="none" strokeDasharray="3 3" />
          <path d="M52 8l3 6 6.5 1-4.7 4.5 1.2 6.5-6-3.2-6 3.2 1.2-6.5L42.5 15l6.5-1z" fill="#ffd23f" stroke="#e0a800" strokeWidth="1" />
          <rect x="8" y="34" width="22" height="10" rx="5" fill="#3d8bff" />
          <path d="M34 39h8M39 36l3 3-3 3" stroke="#3d8bff" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>,
        '#eef4ff',
      );
    case 'variables':
      return frame(
        <>
          <rect x="8" y="10" width="24" height="16" rx="5" fill="#6d4aff" />
          <text x="20" y="22" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff" fontFamily="system-ui">
            7
          </text>
          <rect x="8" y="34" width="56" height="8" rx="4" fill="#e5e0fb" />
          <rect x="8" y="34" width="38" height="8" rx="4" fill="#2bb673" />
          <path d="M40 18h10M46 14v8" stroke="#3d8bff" strokeWidth="2.5" strokeLinecap="round" />
        </>,
      );
    case 'challenge':
      return frame(
        <>
          <rect x="40" y="22" width="24" height="20" rx="4" fill="#c97b3d" />
          <rect x="40" y="22" width="24" height="7" rx="3" fill="#a3602b" />
          <circle cx="52" cy="32" r="2.5" fill="#ffd23f" />
          {[10, 20, 30].map((x, i) => (
            <path key={x} d={`M${x} ${16 + (i % 2) * 8}l5 5-5 5-5-5z`} fill={['#ff7eb3', '#3d8bff', '#2bb673'][i]} />
          ))}
          <text x="52" y="16" textAnchor="middle" fontSize="9" fontWeight="900" fill="#6d4aff" fontFamily="system-ui">
            IF
          </text>
        </>,
        '#fff7e0',
      );
    default:
      return frame(
        <>
          <path d="M36 8l16 9v18l-16 9-16-9V17z" fill="#c7d2fe" stroke="#4f46e5" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M20 17l16 9 16-9M36 26v18" stroke="#4f46e5" strokeWidth="1.6" fill="none" />
          <rect x="54" y="34" width="12" height="10" rx="2.5" fill="#fff" stroke="#4f46e5" strokeWidth="1.4" />
          <text x="60" y="42" textAnchor="middle" fontSize="7" fontWeight="900" fill="#4f46e5" fontFamily="system-ui">
            R
          </text>
        </>,
        '#eef2ff',
      );
  }
}
