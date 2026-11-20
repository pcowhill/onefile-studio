import { useMemo } from 'react';
import type { CaptureSource } from '../../io/capture';
import { captureSupport } from '../../io/capture';
import { openCapture } from '../media/mediaUi';
import { CaptureIllustration } from './illustrations';
import '../../styles/capture.css';

export const CAPTURE_CARDS: Array<{ id: CaptureSource; label: string; hint: string; color: string }> = [
  { id: 'screenshot', label: 'Screenshot', hint: 'A still of a screen, window or tab', color: '#7c5cff' },
  { id: 'screen', label: 'Record screen', hint: 'Show how something works', color: '#6d4aff' },
  { id: 'webcam', label: 'Record webcam', hint: 'Talk to your viewers', color: '#e5487f' },
  { id: 'photo', label: 'Webcam photo', hint: 'Snap a picture', color: '#ff7eb3' },
  { id: 'microphone', label: 'Record voice', hint: 'Narration or a quick note', color: '#0e9f6e' },
  { id: 'screenCamera', label: 'Screen + webcam', hint: 'Both at once, as two videos', color: '#4a2fd9' },
];

/**
 * The "Capture" half of the Media panel: illustrated cards for every source.
 * Sources this browser can't offer stay visible but disabled, with the reason.
 */
export function CaptureCards() {
  const support = useMemo(() => captureSupport(), []);
  return (
    <section className="ed-cap-cards" aria-label="Capture">
      <h3>
        Capture <small>right here, no uploading</small>
      </h3>
      <div className="ed-cat-grid">
        {CAPTURE_CARDS.map((c) => {
          const reason = support.reasons[c.id];
          return (
            <button
              key={c.id}
              className="ed-cat-card ed-cap-card"
              style={{ ['--cat' as string]: c.color }}
              disabled={!!reason}
              title={reason ?? c.hint}
              aria-describedby={reason ? `cap-why-${c.id}` : undefined}
              onClick={() => openCapture({ source: c.id })}
              data-testid={`capture-${c.id}`}
            >
              <span className="ed-cat-art">
                <CaptureIllustration id={c.id} />
              </span>
              <span className="ed-cat-label">{c.label}</span>
              {reason && (
                <span id={`cap-why-${c.id}`} className="ed-visually-hidden">
                  {reason}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {Object.values(support.reasons).every(Boolean) && <p className="ed-note ed-cap-unavailable">{support.reasons.screen}</p>}
    </section>
  );
}
