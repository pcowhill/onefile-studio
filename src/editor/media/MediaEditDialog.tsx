import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useEditor, findEl } from '../store/store';
import type { MediaEdit } from '../../model/mediaEdit';
import { isIdentity } from '../../model/mediaEdit';
import { assetKind } from '../../model/types';
import { assetUses, saveElementEdit, saveLibraryEdit } from '../ops';
import { toast } from '../ui/toast';
import { cleanEdit, KIND_NOUN, MediaEditBody, sameEdit } from './MediaEditor';
import { closeMediaEdit, useMediaUi } from './mediaUi';

/** Mounted once by the editor: shows the media editor when one is requested. */
export function MediaEditHost() {
  const req = useMediaUi((s) => s.edit);
  if (!req) return null;
  return <MediaEditDialog key={`${req.assetId ?? ''}:${req.elementId ?? ''}`} />;
}

function MediaEditDialog() {
  const req = useMediaUi((s) => s.edit)!;
  const project = useEditor((s) => s.project)!;
  const found = req.elementId ? findEl(project, req.elementId) : null;
  const props = (found?.el.props ?? {}) as { assetId?: string; edit?: MediaEdit | null };
  const assetId = req.assetId ?? props.assetId ?? '';
  const asset = project.assets[assetId];
  const own = found && props.edit && typeof props.edit === 'object' ? props.edit : null;
  const initial: MediaEdit = (found ? own : null) ?? asset?.edit ?? {};
  const [edit, setEdit] = useState<MediaEdit>(initial);
  if (!asset) {
    queueMicrotask(closeMediaEdit);
    return null;
  }
  const noun = KIND_NOUN[assetKind(asset.mime)];
  const uses = assetUses(project, asset.id);
  const clean = cleanEdit(asset, edit);
  const changed = !sameEdit(clean, cleanEdit(asset, initial));
  const close = () => closeMediaEdit();

  const saveLibrary = () => {
    saveLibraryEdit(asset.id, clean);
    if (found && own) saveElementEdit(found.el.id, null);
    toast(isIdentity(clean) ? `Restored the original ${noun}.` : `Saved. Every use of this ${noun} shows the change.`);
    close();
  };
  const saveThis = () => {
    saveElementEdit(found!.el.id, clean);
    toast(`Saved for this ${noun} only.`);
    close();
  };

  let intro: string;
  let footer;
  if (found) {
    const others = uses.total - 1;
    intro =
      others > 0
        ? `This ${noun} appears ${uses.total} times. Change only this one, or the library version that every use without its own adjustments follows.`
        : `Changes are nondestructive: the original ${noun} stays in your project.`;
    footer = (
      <>
        <button className="ed-btn ed-btn-ghost" onClick={close}>
          Cancel
        </button>
        {others > 0 && (
          <button
            className="ed-btn ed-btn-soft"
            onClick={saveLibrary}
            data-testid="edit-save-library"
            title={`Update the library version (${uses.total} uses)`}
          >
            Apply to all uses
          </button>
        )}
        <button className="ed-btn ed-btn-primary" onClick={others > 0 ? saveThis : saveLibrary} data-testid="edit-save">
          {others > 0 ? 'Apply to this one' : 'Save'}
        </button>
      </>
    );
  } else {
    intro =
      uses.own > 0
        ? `Used ${uses.total}× in your project. ${uses.own} of them ${uses.own === 1 ? 'has its' : 'have their'} own adjustments and won't change.`
        : uses.total > 0
          ? `Used ${uses.total}× in your project — every use shows the change.`
          : `Not used yet. Your edit applies wherever you place it.`;
    footer = (
      <>
        <button className="ed-btn ed-btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="ed-btn ed-btn-primary" onClick={saveLibrary} disabled={!changed} data-testid="edit-save">
          Save edits
        </button>
      </>
    );
  }

  return (
    <Modal label={`Edit ${noun}`} onClose={close} wide className="ed-medit-modal">
      <MediaEditBody asset={asset} edit={edit} onChange={setEdit} intro={intro} footer={footer} />
    </Modal>
  );
}
