import type { TableProps } from '../../../runtime/elements/table';
import type { P } from '../shared';
import { Section } from '../../ui/controls';

/** Inspector for the Table element. */
export function TableEditor({ el }: P<TableProps>) {
  return (
    <Section title="Table" icon="sparkle">
      <p className="ed-note">{el.name}</p>
    </Section>
  );
}
