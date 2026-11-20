import type { Asset, SceneElement } from '../../model/types';
import { assetKind } from '../../model/types';
import type { MediaEdit } from '../../model/mediaEdit';
import { describeEdit, isIdentity } from '../../model/mediaEdit';
import { formatTime } from '../../runtime/elements/mediaShared';
import { Icon } from '../ui/Icon';
import { saveElementEdit } from '../ops';
import { openCapture, openMediaEdit } from './mediaUi';

/**
 * Inspector row for image, video and sound elements: opens the media editor
 * for this element, says whether it follows the library version or has its
 * own adjustments, and offers to go back to the library version.
 */
export function MediaEditRow({
  el,
  asset,
  allowScreenshot,
}: {
  el: SceneElement<{ edit?: MediaEdit | null }>;
  asset: Asset | undefined;
  allowScreenshot?: boolean;
}) {
  const own = el.props.edit;
  const hasOwn = !!own && typeof own === 'object';
  if (!asset)
    return allowScreenshot ? (
      <div className="ed-medit-row">
        <button
          className="ed-btn ed-btn-sm ed-btn-soft"
          onClick={() => openCapture({ source: 'screenshot', replaceElementId: el.id })}
          data-testid="image-screenshot"
        >
          <Icon name="capture" size={14} /> Use a screenshot
        </button>
      </div>
    ) : null;
  const kind = assetKind(asset.mime);
  const verb = kind === 'image' ? 'Crop & rotate' : kind === 'video' ? 'Trim & crop' : 'Trim';
  const effective = hasOwn ? own! : (asset.edit ?? {});
  const status = isIdentity(effective)
    ? hasOwn
      ? 'Showing the original (its own setting)'
      : 'Showing the original'
    : `${describeEdit(effective, formatTime)}${hasOwn ? ' (just here)' : ' (library version)'}`;
  return (
    <div className="ed-medit-row">
      <div className="ed-row">
        <button className="ed-btn ed-btn-sm ed-btn-soft" onClick={() => openMediaEdit({ elementId: el.id })} data-testid="element-edit-media">
          <Icon name={kind === 'image' ? 'crop' : 'scissors'} size={14} /> {verb}
        </button>
        {allowScreenshot && (
          <button
            className="ed-btn ed-btn-sm ed-btn-ghost"
            onClick={() => openCapture({ source: 'screenshot', replaceElementId: el.id })}
            title="Replace this picture with a new screenshot"
            data-testid="image-screenshot"
          >
            <Icon name="capture" size={14} /> Screenshot
          </button>
        )}
      </div>
      <p className="ed-medit-status" data-testid="element-edit-status">
        {status}
        {hasOwn && (
          <button className="ed-link" onClick={() => saveElementEdit(el.id, null)} data-testid="use-library-version">
            Use library version
          </button>
        )}
      </p>
    </div>
  );
}
