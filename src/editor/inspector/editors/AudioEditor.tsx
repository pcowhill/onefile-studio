import type { AudioProps } from '../../../runtime/elements/audio';
import type { P } from '../shared';
import { Section } from '../../ui/controls';

/** Inspector for the Audio element. */
export function AudioEditor({ el }: P<AudioProps>) {
  return (
    <Section title="Audio" icon="sparkle">
      <p className="ed-note">{el.name}</p>
    </Section>
  );
}
