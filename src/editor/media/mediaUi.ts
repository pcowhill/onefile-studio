import { create } from 'zustand';
import type { Asset } from '../../model/types';
import type { MediaEdit } from '../../model/mediaEdit';
import type { CaptureSource } from '../../io/capture';

/**
 * Which capture or media-edit dialog is open. Kept outside the project store:
 * opening a dialog is not an undoable edit.
 */
export interface EditRequest {
  /** The library file to edit… */
  assetId?: string;
  /** …or one element's own adjustments of its file. */
  elementId?: string;
  /** …or a fresh capture that is not in the library yet (edited before it is added). */
  pending?: { asset: Asset; edit: MediaEdit; onDone(edit: MediaEdit): void };
}

export interface CaptureRequest {
  source: CaptureSource;
  /** Replace this image element's picture with the capture (screenshot / photo). */
  replaceElementId?: string;
}

interface MediaUiState {
  edit: EditRequest | null;
  capture: CaptureRequest | null;
}

export const useMediaUi = create<MediaUiState>(() => ({ edit: null, capture: null }));

export const openMediaEdit = (req: EditRequest) => useMediaUi.setState({ edit: req });
export const closeMediaEdit = () => useMediaUi.setState({ edit: null });
export const openCapture = (req: CaptureRequest) => useMediaUi.setState({ capture: req });
export const closeCapture = () => useMediaUi.setState({ capture: null });
