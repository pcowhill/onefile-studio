import type { Interaction, ParamValue, Project, SceneElement } from '../../model/types';
import { uid } from '../../model/ids';
import { editor, findEl } from '../store/store';
import { updateElement } from '../ops';
import { Icon } from '../ui/Icon';
import { Select } from '../ui/controls';
import { pageTargetOptions } from '../inspector/DesignPanel';
import { actionSummary, LinkEditor } from './BehaviorPanel';
import { triggerSentence } from './catalog';
import '../../styles/behavior.css';

type Choice = 'navigate' | 'show' | 'openLink' | 'custom';

const OPTIONS: Array<{ id: Choice; label: (p: Project) => string; icon: string; c: string; s: string }> = [
  { id: 'navigate', label: (p) => (p.kind === 'slides' ? 'Go to next slide' : 'Scroll to a section'), icon: 'next', c: '#3d8bff', s: '#e2ecff' },
  { id: 'show', label: () => 'Show an element', icon: 'eye', c: '#00a884', s: '#dcf7ee' },
  { id: 'openLink', label: () => 'Open a link', icon: 'external', c: '#0891b2', s: '#dff5fa' },
  { id: 'custom', label: () => 'Something else…', icon: 'bolt', c: '#6d4aff', s: '#efeaff' },
];

/** The element's single, simple click rule (one click interaction, one action, no conditions), if that is all it has. */
function simpleClick(el: SceneElement): Interaction | null {
  if (el.interactions.length !== 1) return null;
  const ix = el.interactions[0];
  if (ix.trigger !== 'click' || ix.conditions.length || ix.actions.length !== 1) return null;
  return ['navigate', 'show', 'openLink'].includes(ix.actions[0].type) ? ix : null;
}

/**
 * "What happens when clicked?" — the common cases without the full
 * WHEN → IF → DO builder. It writes an ordinary click interaction, so the
 * Behavior tab shows (and can extend) exactly the same rule.
 */
export function QuickClick({ el, project }: { el: SceneElement; project: Project }) {
  const simple = simpleClick(el);
  const current: Choice | null = simple ? (simple.actions[0].type as Choice) : el.interactions.length ? 'custom' : null;
  const page = findEl(project, el.id)?.page;

  const choose = (c: Choice) => {
    if (c === 'custom') {
      editor().set({ inspectorTab: 'behavior', triggerPickerFor: el.interactions.length ? null : el.id });
      return;
    }
    if (current === c) return;
    const params: Record<string, ParamValue> =
      c === 'navigate' ? { page: 'next' } : c === 'openLink' ? { url: '', newTab: true } : { target: firstHidden(page?.elements ?? [], el.id), effect: 'pop' };
    updateElement(el.id, (d) => {
      d.interactions = [{ id: uid('ix'), trigger: 'click', conditions: [], actions: [{ id: uid('ac'), type: c, params }] }];
    });
  };
  const setParams = (patch: Record<string, ParamValue>, merge?: string) =>
    updateElement(
      el.id,
      (d) => {
        const a = d.interactions[0]?.actions[0];
        if (a) Object.assign(a.params, patch);
      },
      merge,
    );
  const locked = current === 'custom';
  return (
    <div className="ed-quickclick" data-testid="quick-click">
      <div className="ed-quickact" role="radiogroup" aria-label="What happens when clicked">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={current === o.id}
            className={`ed-quickact-opt ${current === o.id ? 'is-on' : ''}`}
            style={{ ['--c' as string]: o.c, ['--s' as string]: o.s }}
            disabled={locked && o.id !== 'custom'}
            title={locked && o.id !== 'custom' ? 'This element already has its own interactions — edit them in the Behavior tab' : undefined}
            onClick={() => choose(o.id)}
            data-testid={`quick-${o.id}`}
          >
            <span className="ed-quickact-ic">
              <Icon name={o.icon} size={15} />
            </span>
            {o.label(project)}
          </button>
        ))}
      </div>
      {simple && (
        <div className="ed-quickact-detail">
          {simple.actions[0].type === 'openLink' && <LinkEditor params={simple.actions[0].params} onParams={(p, m) => setParams(p, m ? `quick:${m}` : undefined)} />}
          {simple.actions[0].type === 'navigate' && (
            <Select value={String(simple.actions[0].params.page ?? 'next')} onChange={(v) => setParams({ page: v })} options={pageTargetOptions(project)} ariaLabel="Destination" />
          )}
          {simple.actions[0].type === 'show' && (
            <Select
              value={String(simple.actions[0].params.target ?? '')}
              onChange={(v) => setParams({ target: v })}
              ariaLabel="Element to show"
              options={[
                ...(simple.actions[0].params.target ? [] : [{ value: '', label: 'Choose an element…' }]),
                ...(page?.elements ?? []).filter((e) => e.id !== el.id).map((e) => ({ value: e.id, label: `${e.name}${e.hidden ? ' (hidden)' : ''}` })),
              ]}
            />
          )}
        </div>
      )}
      {locked && (
        <p className="ed-note">
          {el.interactions
            .slice(0, 2)
            .map((ix) => `When ${triggerSentence(ix, project.kind)}: ${ix.actions.map((a) => actionSummary(a, project, el.id)).join(', then ') || 'nothing yet'}`)
            .join(' · ')}
        </p>
      )}
    </div>
  );
}

const firstHidden = (els: SceneElement[], self: string) => els.find((e) => e.hidden && e.id !== self)?.id ?? '';
