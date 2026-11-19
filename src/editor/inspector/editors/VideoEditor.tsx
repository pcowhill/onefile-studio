import type { VideoProps } from '../../../runtime/elements/video';
import type { P } from '../shared';
import { Section } from '../../ui/controls';

/** Inspector for the Video element. */
export function VideoEditor({ el }: P<VideoProps>) {
  return (
    <Section title="Video" icon="sparkle">
      <p className="ed-note">{el.name}</p>
    </Section>
  );
}
