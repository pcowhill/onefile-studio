import type { ChartProps } from '../../../runtime/elements/chart';
import type { P } from '../shared';
import { Section } from '../../ui/controls';

/** Inspector for the Chart element. */
export function ChartEditor({ el }: P<ChartProps>) {
  return (
    <Section title="Chart" icon="sparkle">
      <p className="ed-note">{el.name}</p>
    </Section>
  );
}
