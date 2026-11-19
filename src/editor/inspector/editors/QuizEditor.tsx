import type { QuizProps } from '../../../runtime/elements/quiz';
import type { P } from '../shared';
import { Section } from '../../ui/controls';

/** Inspector for the Quiz element. */
export function QuizEditor({ el }: P<QuizProps>) {
  return (
    <Section title="Quiz" icon="sparkle">
      <p className="ed-note">{el.name}</p>
    </Section>
  );
}
