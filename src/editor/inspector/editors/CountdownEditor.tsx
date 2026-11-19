import type { CountdownProps } from '../../../runtime/elements/countdown';
import type { P } from '../shared';
import { Section } from '../../ui/controls';

/** Inspector for the Countdown element. */
export function CountdownEditor({ el }: P<CountdownProps>) {
  return (
    <Section title="Countdown" icon="sparkle">
      <p className="ed-note">{el.name}</p>
    </Section>
  );
}
