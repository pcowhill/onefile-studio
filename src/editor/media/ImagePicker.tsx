import { useMemo } from 'react';
import type { Asset } from '../../model/types';
import { assetKind } from '../../model/types';
import { captureSupport } from '../../io/capture';
import { useEditor } from '../store/store';
import { pickImages } from '../ops';
import { AssetTile } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { openCapture } from './mediaUi';
import '../../styles/media.css';

/**
 * The empty state of an Image element's inspector (Insert → Image creates a
 * placeholder first, like Video and Audio): pick a picture already in the
 * project, upload one, or capture a screenshot / webcam photo straight into it.
 */
export function ImagePicker({ elementId, onPick }: { elementId: string; onPick(asset: Asset): void }) {
  const assets = useEditor((s) => s.project?.assets ?? {});
  const images = Object.values(assets).filter((a) => assetKind(a.mime) === 'image');
  const support = useMemo(() => captureSupport(), []);
  const upload = () =>
    void pickImages(false).then((list) => {
      if (list[0]) onPick(list[0]);
    });
  return (
    <div className="ed-imgpick" data-testid="image-picker">
      <button className="ed-media-big is-image" onClick={upload} data-testid="choose-image">
        <span className="ed-media-big-icon">
          <Icon name="upload" size={24} />
        </span>
        <strong>Upload an image</strong>
        <small>PNG, JPEG, GIF, WebP or SVG</small>
      </button>
      <div className="ed-imgpick-lib">
        <div className="ed-imgpick-label">
          <Icon name="grid" size={14} /> From this project
        </div>
        {images.length ? (
          <div className="ed-imgpick-grid" role="list">
            {images.map((a) => (
              <button key={a.id} role="listitem" className="ed-imgpick-item" title={a.name} onClick={() => onPick(a)} data-testid="library-image">
                <AssetTile asset={a} />
                <span>{a.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="ed-imgpick-empty">No pictures in this project yet. Upload one, or capture one below — it will appear here for reuse.</p>
        )}
      </div>
      <div className="ed-imgpick-capture">
        <button
          className="ed-btn ed-btn-sm ed-btn-soft"
          disabled={!!support.reasons.screenshot}
          title={support.reasons.screenshot ?? 'Capture a screen, window or tab'}
          onClick={() => openCapture({ source: 'screenshot', replaceElementId: elementId })}
          data-testid="image-screenshot"
        >
          <Icon name="capture" size={14} /> Screenshot
        </button>
        <button
          className="ed-btn ed-btn-sm ed-btn-soft"
          disabled={!!support.reasons.photo}
          title={support.reasons.photo ?? 'Snap a picture with your webcam'}
          onClick={() => openCapture({ source: 'photo', replaceElementId: elementId })}
          data-testid="image-photo"
        >
          <Icon name="camera" size={14} /> Webcam photo
        </button>
      </div>
    </div>
  );
}
