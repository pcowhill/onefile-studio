import { useEditor, editor, selectedElements } from '../store/store';
import { Icon } from '../ui/Icon';
import { DesignPanel, PageSettings } from './DesignPanel';
import { BehaviorPanel } from '../behavior/BehaviorPanel';
import { EDITOR_ELEMENTS } from '../catalog';
import { updateElement } from '../ops';
import { useShallow } from 'zustand/react/shallow';

export function Inspector() {
  const els = useEditor(useShallow((s) => selectedElements(s)));
  const tab = useEditor((s) => s.inspectorTab);
  const kind = useEditor((s) => s.project?.kind);
  if (!els.length) {
    return (
      <aside className="ed-right" aria-label="Properties">
        <div className="ed-insp-head">
          <span className="ed-insp-icon" style={{ background: '#efeaff', color: '#6d4aff' }}>
            <Icon name={kind === 'slides' ? 'slides' : 'page'} size={18} />
          </span>
          <div className="ed-insp-title">
            <strong>{kind === 'slides' ? 'Slide settings' : 'Section settings'}</strong>
            <small>Select an element to edit it</small>
          </div>
        </div>
        <div className="ed-insp-scroll">
          <PageSettings />
        </div>
      </aside>
    );
  }
  const single = els.length === 1 ? els[0] : null;
  const def = single ? EDITOR_ELEMENTS[single.type] : null;
  return (
    <aside className="ed-right" aria-label="Properties">
      <div className="ed-insp-head">
        <span className="ed-insp-icon" style={{ background: def ? `color-mix(in srgb, ${def.color} 16%, white)` : '#efeaff', color: def?.color ?? '#6d4aff' }}>
          <Icon name={def?.icon ?? 'select'} size={18} />
        </span>
        <div className="ed-insp-title">
          {single ? (
            <input className="ed-name-input" value={single.name} aria-label="Element name" onChange={(e) => updateElement(single.id, (d) => void (d.name = e.target.value.slice(0, 80)), 'name')} />
          ) : (
            <strong>{els.length} elements</strong>
          )}
          <small>{single ? def?.label : 'Multiple selection'}</small>
        </div>
      </div>
      {single && (
        <div className="ed-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'design'} className={tab === 'design' ? 'is-on' : ''} onClick={() => editor().set({ inspectorTab: 'design' })} data-testid="tab-design">
            <Icon name="palette" size={16} /> Design
          </button>
          <button role="tab" aria-selected={tab === 'behavior'} className={tab === 'behavior' ? 'is-on' : ''} onClick={() => editor().set({ inspectorTab: 'behavior' })} data-testid="tab-behavior">
            <Icon name="bolt" size={16} /> Behavior
            {single.interactions.length > 0 && <span className="ed-tab-badge">{single.interactions.length}</span>}
          </button>
        </div>
      )}
      <div className="ed-insp-scroll" key={single?.id ?? 'multi'}>
        {single && tab === 'behavior' ? <BehaviorPanel el={single} /> : <DesignPanel els={els} />}
      </div>
    </aside>
  );
}
