import { useEffect, useRef, useState } from 'react';
import type { Action, Condition, Interaction, ParamValue, Project, SceneElement } from '../../model/types';
import type { IxOwner } from './owner';
import { elementOwner, pageOwner } from './owner';
import { KeyPicker, keyConflicts } from './KeyPicker';
import { DragModePicker } from './DragModes';
import { linkDisplay, linkProblem } from '../../model/links';
import { SELF_TARGET } from '../../model/types';
import { uid } from '../../model/ids';
import { useEditor, editor, findEl } from '../store/store';
import { Icon } from '../ui/Icon';
import { Field, NumberInput, Section, Segmented, Select, Slider, TextInput, Toggle } from '../ui/controls';
import { updateElement } from '../ops';
import {
  ACTIONS,
  ACTION_CATEGORIES,
  actionUi,
  EMPHASIS_PRESETS,
  ENTRANCE_PRESETS,
  MODEL_VIEWS,
  pageNoun,
  TRIGGER_CATEGORIES,
  triggerSentence,
  triggersFor,
  triggerUi,
  VISIBILITY_EFFECTS,
} from './catalog';
import { MAX_DELAY_SECONDS } from '../../runtime/triggers';
import { COMPARE_OPS } from '../../runtime/conditions';
import { EDITOR_ELEMENTS } from '../catalog';
import { pageTargetOptions } from '../inspector/DesignPanel';
import { playAnimation } from '../../runtime/animations';
import { Modal } from '../ui/Modal';
import '../../styles/behavior.css';

export function BehaviorPanel({ el }: { el: SceneElement }) {
  const project = useEditor((s) => s.project)!;
  const builtIn = EDITOR_ELEMENTS[el.type]?.builtIn;
  const owner = elementOwner(project, el);
  return (
    <div className="ed-inspector-body">
      {builtIn && (
        <div className="ed-builtin">
          <Icon name="sparkle" size={16} />
          <span>
            <strong>Works automatically.</strong> {builtIn}
          </span>
        </div>
      )}
      <Section title="Interactions" icon="bolt">
        <InteractionList
          owner={owner}
          list={el.interactions}
          project={project}
          update={(fn) => updateElement(el.id, (d) => fn(d.interactions))}
          pickerKey={el.id}
          empty="Make this element respond to viewers — reveal something, change a score, jump to another slide…"
        />
      </Section>
      <EntranceSection el={el} />
      <Section title="Visibility & dragging" icon="eye">
        <Toggle
          label="Hidden when the page opens"
          description="Reveal it later with a “Show” action"
          checked={el.hidden}
          onChange={(v) => updateElement(el.id, (d) => void (d.hidden = v))}
        />
        <DragModePicker el={el} />
      </Section>
    </div>
  );
}

/**
 * A WHEN → IF → DO list for any owner (an element or a slide). `update`
 * applies a change to the owner's list as one undoable edit. Page owners can
 * also move keyboard interactions to the project ("every slide") list.
 */
export function InteractionList({
  owner,
  list,
  project,
  update,
  pickerKey,
  empty,
  onScope,
  scope,
}: {
  owner: IxOwner;
  list: Interaction[];
  project: Project;
  update(fn: (list: Interaction[]) => void, merge?: string): void;
  /** Value of `triggerPickerFor` that opens this list's trigger picker. */
  pickerKey: string;
  empty?: string;
  /** Page owners: move an interaction between "this slide" and "every slide". */
  onScope?(ix: Interaction, to: 'page' | 'project'): void;
  scope?: 'page' | 'project';
}) {
  const pickerFor = useEditor((s) => s.triggerPickerFor);
  const [changing, setChanging] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  const addInteraction = (trigger: string) => {
    const id = uid('ix');
    const ix: Interaction = { id, trigger, conditions: [], actions: [] };
    if (trigger === 'key') ix.options = { key: '' };
    if (trigger === 'pageTimer') ix.options = { seconds: 3 };
    update((l) => void l.push(ix));
    setOpenId(id);
    setFresh(id);
  };

  return (
    <>
      {list.length === 0 && empty && (
        <div className="ed-ix-empty">
          <div className="ed-ix-flow">
            <span className="ed-flow-when">When</span>
            <Icon name="right" size={14} />
            <span className="ed-flow-if">If</span>
            <Icon name="right" size={14} />
            <span className="ed-flow-do">Do</span>
          </div>
          <p>{empty}</p>
        </div>
      )}
      {list.map((ix, i) => (
        <InteractionCard
          key={ix.id}
          owner={owner}
          ix={ix}
          index={i}
          project={project}
          fresh={fresh === ix.id}
          scope={scope}
          onScope={onScope}
          open={openId === ix.id || list.length === 1}
          onToggle={() => setOpenId(openId === ix.id ? null : ix.id)}
          onChangeTrigger={() => setChanging(ix.id)}
          onChange={(fn, merge) =>
            update((l) => {
              const t = l.find((x) => x.id === ix.id);
              if (t) fn(t);
            }, merge)
          }
          onDelete={() =>
            update(
              (l) =>
                void l.splice(
                  l.findIndex((x) => x.id === ix.id),
                  1,
                ),
            )
          }
          onMove={(d) =>
            update((l) => {
              const j = i + d;
              if (j < 0 || j >= l.length) return;
              [l[i], l[j]] = [l[j], l[i]];
            })
          }
          count={list.length}
        />
      ))}
      <button className="ed-btn ed-btn-primary ed-btn-block" onClick={() => editor().set({ triggerPickerFor: pickerKey })} data-testid="add-interaction">
        <Icon name="plus" size={18} /> Add interaction
      </button>
      {pickerFor === pickerKey && (
        <TriggerPicker
          owner={owner}
          onPick={(t) => {
            addInteraction(t);
            editor().set({ triggerPickerFor: null });
          }}
          onClose={() => editor().set({ triggerPickerFor: null })}
        />
      )}
      {changing && (
        <TriggerPicker
          owner={owner}
          current={list.find((x) => x.id === changing)?.trigger}
          onPick={(t) => {
            update((l) => {
              const ix = l.find((x) => x.id === changing);
              if (!ix || ix.trigger === t) return;
              ix.trigger = t;
              delete ix.options;
              if (t === 'key') ix.options = { key: '' };
              if (t === 'pageTimer') ix.options = { seconds: 3 };
            });
            if (t === 'key') setFresh(changing);
            setChanging(null);
          }}
          onClose={() => setChanging(null)}
        />
      )}
    </>
  );
}

// ---------------- trigger picker ("When…") ----------------

export function TriggerPicker({ owner, current, onPick, onClose }: { owner: IxOwner; current?: string; onPick(id: string): void; onClose(): void }) {
  const kind = useEditor((s) => s.project?.kind);
  const available = triggersFor(owner.type);
  const special = available.filter((t) => t.forTypes);
  const primary = available.filter((t) => t.primary || (special.length && t.forTypes));
  const more = available.filter((t) => !primary.includes(t));
  const [showMore, setShowMore] = useState(!!current && more.some((m) => m.id === current));
  const cats = [...new Set(available.map((t) => t.category))];
  return (
    <Modal onClose={onClose} label="Choose a trigger" className="ed-trigger-modal">
      <div className="ed-when">
        <div className="ed-when-head">
          <h2>When…</h2>
          {owner.kind === 'element' ? (
            <p>
              <strong>{owner.name}</strong> is…
            </p>
          ) : (
            <p>
              something happens on <strong>{owner.name}</strong>…
            </p>
          )}
          <div className="ed-cat-legend">
            {cats.map((c) => (
              <span key={c} className="ed-cat-chip" style={{ ['--c' as string]: TRIGGER_CATEGORIES[c].color, ['--s' as string]: TRIGGER_CATEGORIES[c].soft }}>
                <i /> {TRIGGER_CATEGORIES[c].label}
              </span>
            ))}
          </div>
        </div>
        <div className={`ed-trigger-grid ${primary.length > 3 ? 'is-many' : ''}`}>
          {primary.map((t) => (
            <TriggerCard key={t.id} id={t.id} selected={current === t.id} onPick={onPick} big kind={kind} />
          ))}
        </div>
        {more.length > 0 && (
          <div className="ed-more">
            <button className="ed-more-toggle" onClick={() => setShowMore(!showMore)} aria-expanded={showMore}>
              <Icon name="chevron" size={14} className={showMore ? 'is-flipped' : ''} /> {showMore ? 'Fewer triggers' : `More triggers (${more.length})`}
            </button>
            {showMore && (
              <div className="ed-trigger-grid is-small">
                {more.map((t) => (
                  <TriggerCard key={t.id} id={t.id} selected={current === t.id} onPick={onPick} kind={kind} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function TriggerCard({ id, selected, onPick, big, kind }: { id: string; selected: boolean; onPick(id: string): void; big?: boolean; kind?: Project['kind'] }) {
  const t = triggerUi(id)!;
  const cat = TRIGGER_CATEGORIES[t.category];
  return (
    <button
      className={`ed-trigger-card ${big ? 'is-big' : ''} ${selected ? 'is-on' : ''}`}
      style={{ ['--c' as string]: cat.color, ['--s' as string]: cat.soft }}
      onClick={() => onPick(id)}
      data-testid={`trigger-${id}`}
    >
      <span className="ed-trigger-art-wrap">{t.art}</span>
      <span className="ed-trigger-label">{pageNoun(t.label, kind)}</span>
      <span className="ed-trigger-desc">{pageNoun(t.description, kind)}</span>
      {selected && (
        <span className="ed-trigger-check">
          <Icon name="check" size={14} stroke={3} />
        </span>
      )}
    </button>
  );
}

// ---------------- interaction card ----------------

function InteractionCard({
  owner,
  ix,
  index,
  count,
  project,
  open,
  fresh,
  scope,
  onScope,
  onToggle,
  onChange,
  onDelete,
  onMove,
  onChangeTrigger,
}: {
  owner: IxOwner;
  ix: Interaction;
  fresh?: boolean;
  scope?: 'page' | 'project';
  onScope?(ix: Interaction, to: 'page' | 'project'): void;
  index: number;
  count: number;
  project: Project;
  open: boolean;
  onToggle(): void;
  onChange(fn: (ix: Interaction) => void, merge?: string): void;
  onDelete(): void;
  onMove(d: number): void;
  onChangeTrigger(): void;
}) {
  const t = triggerUi(ix.trigger);
  const cat = TRIGGER_CATEGORIES[t?.category ?? 'mouse'];
  const summary = ix.actions.length ? ix.actions.map((a) => actionSummary(a, project, owner.selfId)).join(', then ') : 'nothing yet';
  const setOptions = (patch: Record<string, ParamValue | undefined>, merge?: string) =>
    onChange((d) => {
      const o = { ...(d.options ?? {}) };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === false) delete o[k];
        else o[k] = v;
      }
      d.options = o;
    }, merge);
  const noun = project.kind === 'slides' ? 'slide' : 'section';
  return (
    <div className={`ed-ix ${open ? 'is-open' : ''}`} style={{ ['--c' as string]: cat.color, ['--s' as string]: cat.soft }} data-testid="interaction">
      <div className="ed-ix-head">
        <button className="ed-ix-trigger" onClick={onChangeTrigger} title="Change trigger">
          <span className="ed-ix-when">When</span>
          <span className="ed-ix-tlabel">{triggerSentence(ix, project.kind)}</span>
        </button>
        <div className="ed-ix-tools">
          {count > 1 && (
            <>
              <button className="ed-icon-btn is-xs" aria-label="Move interaction up" disabled={index === 0} onClick={() => onMove(-1)}>
                <Icon name="up" size={14} />
              </button>
              <button className="ed-icon-btn is-xs" aria-label="Move interaction down" disabled={index === count - 1} onClick={() => onMove(1)}>
                <Icon name="down" size={14} />
              </button>
            </>
          )}
          <button className="ed-icon-btn is-xs is-danger" aria-label="Delete interaction" onClick={onDelete}>
            <Icon name="trash" size={14} />
          </button>
          {count > 1 && (
            <button className="ed-icon-btn is-xs" aria-label={open ? 'Collapse' : 'Expand'} onClick={onToggle}>
              <Icon name="chevron" size={14} className={open ? 'is-flipped' : ''} />
            </button>
          )}
        </div>
      </div>
      {!open && (
        <button className="ed-ix-summary" onClick={onToggle}>
          {ix.conditions.length > 0 && <span className="ed-ix-if-badge">if…</span>} {summary}
        </button>
      )}
      {ix.trigger === 'key' && (
        <KeyPicker
          options={ix.options ?? {}}
          autoCapture={!!fresh}
          onChange={(patch) => setOptions(patch)}
          conflicts={keyConflicts(project, owner, ix, scope)}
        />
      )}
      {open && ix.trigger === 'pageTimer' && (
        <div className="ed-ix-opts">
          <span className="ed-w">After</span>
          <NumberInput
            value={Number(ix.options?.seconds ?? 3)}
            step={0.5}
            min={0}
            max={MAX_DELAY_SECONDS}
            onChange={(v) => setOptions({ seconds: v }, `${ix.id}:sec`)}
            ariaLabel="Seconds"
            width={104}
          />
          <span className="ed-w">seconds on this {noun}</span>
        </div>
      )}
      {open && onScope && ix.trigger === 'key' && (
        <div className="ed-ix-opts">
          <span className="ed-w">Works on</span>
          <Segmented
            size="sm"
            ariaLabel="Where this shortcut works"
            value={scope ?? 'page'}
            onChange={(v) => onScope(ix, v)}
            options={[
              { value: 'page', label: `This ${noun}` },
              { value: 'project', label: `Every ${noun}` },
            ]}
          />
        </div>
      )}
      {open && (
        <>
          <ConditionsEditor ix={ix} project={project} onChange={onChange} />
          <div className="ed-ix-do">
            <div className="ed-ix-do-label">Do</div>
            {ix.actions.length === 0 && <div className="ed-ix-noaction">Add the first action ↓</div>}
            <ol className="ed-actions">
              {ix.actions.map((a, i) => (
                <ActionRow
                  key={a.id}
                  action={a}
                  index={i}
                  count={ix.actions.length}
                  owner={owner}
                  project={project}
                  onParams={(patch, merge) => onChange((d) => Object.assign(d.actions[i].params, patch), merge ? `${a.id}:${merge}` : undefined)}
                  onDelete={() => onChange((d) => void d.actions.splice(i, 1))}
                  onMove={(dir) =>
                    onChange((d) => {
                      const j = i + dir;
                      if (j < 0 || j >= d.actions.length) return;
                      [d.actions[i], d.actions[j]] = [d.actions[j], d.actions[i]];
                    })
                  }
                />
              ))}
            </ol>
            <ActionPicker
              project={project}
              many={count > 1}
              onPick={(type) => onChange((d) => void d.actions.push({ id: uid('ac'), type, params: actionUi(type)!.defaults(project, owner.selfId) }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ConditionsEditor({ ix, project, onChange }: { ix: Interaction; project: Project; onChange(fn: (ix: Interaction) => void, merge?: string): void }) {
  if (!project.variables.length && !ix.conditions.length) return null;
  const add = () =>
    onChange((d) => void d.conditions.push({ id: uid('cd'), type: 'variable', variableId: project.variables[0]?.id ?? '', op: 'gte', value: 10 }));
  return (
    <div className="ed-ix-if">
      {ix.conditions.map((c, i) => (
        <div key={c.id} className="ed-cond">
          <span className="ed-ix-if-label">{i === 0 ? 'Only if' : 'and'}</span>
          <Select
            value={c.variableId}
            onChange={(v) => onChange((d) => void (d.conditions[i].variableId = v))}
            options={project.variables.map((v) => ({ value: v.id, label: v.name }))}
            ariaLabel="Condition variable"
          />
          <Select
            value={c.op}
            onChange={(v) => onChange((d) => void (d.conditions[i].op = v as Condition['op']))}
            options={Object.entries(COMPARE_OPS).map(([k, o]) => ({ value: k as Condition['op'], label: o.label }))}
            ariaLabel="Comparison"
          />
          <NumberInput
            value={c.value}
            onChange={(v) => onChange((d) => void (d.conditions[i].value = v), `cond:${c.id}`)}
            ariaLabel="Compare value"
            width={96}
          />
          <button className="ed-icon-btn is-xs is-danger" aria-label="Remove condition" onClick={() => onChange((d) => void d.conditions.splice(i, 1))}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      {project.variables.length > 0 && (
        <button className="ed-link ed-add-cond" onClick={add}>
          <Icon name="plus" size={13} /> {ix.conditions.length ? 'Add another condition' : 'Only if… (optional condition)'}
        </button>
      )}
    </div>
  );
}

// ---------------- actions ----------------

function ActionPicker({ project, many, onPick }: { project: Project; many: boolean; onPick(type: string): void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [open]);
  const cats = Object.values(ACTION_CATEGORIES);
  const isSlides = project.kind === 'slides';
  return (
    <div className="ed-action-picker" ref={ref}>
      <button className={`ed-btn ed-btn-soft ed-btn-block ${open ? 'is-on' : ''}`} onClick={() => setOpen(!open)} data-testid="add-action">
        <Icon name="plus" size={16} /> Add action
      </button>
      {open && (
        <div className="ed-action-menu">
          {cats.map((c) => {
            const list = ACTIONS.filter((a) => a.category === c.id);
            if (!list.length) return null;
            return (
              <div key={c.id} className="ed-action-group" style={{ ['--c' as string]: c.color, ['--s' as string]: c.soft }}>
                <div className="ed-action-group-label">{c.label}</div>
                <div className="ed-action-cards">
                  {list.map((a) => {
                    const why = a.unavailable?.(project) ?? null;
                    const label = a.id === 'navigate' ? (isSlides ? 'Go to slide' : 'Scroll to section') : a.label;
                    return (
                      <button
                        key={a.id}
                        className="ed-action-card"
                        disabled={!!why}
                        title={why ?? a.description}
                        data-testid={`action-${a.id}`}
                        onClick={() => {
                          onPick(a.id);
                          setOpen(false);
                        }}
                      >
                        <span className="ed-action-icon">
                          <Icon name={a.icon} size={17} />
                        </span>
                        <span className="ed-action-text">
                          <strong>{label}</strong>
                          <small>{why ?? a.description}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="ed-action-foot">Actions run in order, top to bottom{many ? '. Interactions with the same trigger also run in order.' : '.'}</p>
        </div>
      )}
    </div>
  );
}

function ActionRow({
  action,
  index,
  count,
  owner,
  project,
  onParams,
  onDelete,
  onMove,
}: {
  action: Action;
  index: number;
  count: number;
  owner: IxOwner;
  project: Project;
  onParams(patch: Record<string, ParamValue>, merge?: string): void;
  onDelete(): void;
  onMove(d: number): void;
}) {
  const ui = actionUi(action.type);
  const cat = ACTION_CATEGORIES[ui?.category ?? 'visibility'];
  const p = action.params;
  const varSelect = (allowAll = false) => (
    <Select
      value={String(p.variable ?? '')}
      onChange={(v) => onParams({ variable: v })}
      ariaLabel="Variable"
      options={[
        ...(p.variable ? [] : [{ value: '', label: 'Choose…' }]),
        ...(allowAll ? [{ value: '@all', label: 'All variables' }] : []),
        ...project.variables.map((v) => ({ value: v.id, label: v.name })),
      ]}
    />
  );
  const target = (filter?: (e: SceneElement) => boolean, allowSelf = true) => (
    <ElementPicker
      value={String(p.target ?? '')}
      owner={owner}
      project={project}
      filter={filter}
      allowSelf={allowSelf && owner.kind === 'element'}
      onChange={(v) => onParams({ target: v })}
    />
  );
  const el = owner.el;
  const isType = (...types: string[]) => !!el && types.includes(el.type);
  let body: React.ReactNode;
  switch (action.type) {
    case 'show':
    case 'hide':
    case 'toggle':
      body = (
        <>
          <span className="ed-w">{action.type === 'show' ? 'Show' : action.type === 'hide' ? 'Hide' : 'Show/hide'}</span>
          {target()}
          <Select value={String(p.effect ?? 'none')} onChange={(v) => onParams({ effect: v })} options={VISIBILITY_EFFECTS} ariaLabel="Effect" />
        </>
      );
      break;
    case 'navigate':
      body = (
        <>
          <span className="ed-w">{project.kind === 'slides' ? 'Go to' : 'Scroll to'}</span>
          <Select value={String(p.page ?? 'next')} onChange={(v) => onParams({ page: v })} options={pageTargetOptions(project)} ariaLabel="Destination" />
        </>
      );
      break;
    case 'varAdd':
    case 'varSubtract':
      body = (
        <>
          <span className="ed-w">{action.type === 'varAdd' ? 'Add' : 'Subtract'}</span>
          <NumberInput value={Number(p.amount ?? 1)} onChange={(v) => onParams({ amount: v }, 'amount')} ariaLabel="Amount" width={96} />
          <span className="ed-w">{action.type === 'varAdd' ? 'to' : 'from'}</span>
          {varSelect()}
        </>
      );
      break;
    case 'varSet':
      body = (
        <>
          <span className="ed-w">Set</span>
          {varSelect()}
          <span className="ed-w">to</span>
          <NumberInput value={Number(p.value ?? 0)} onChange={(v) => onParams({ value: v }, 'value')} ariaLabel="Value" width={96} />
        </>
      );
      break;
    case 'varReset':
      body = (
        <>
          <span className="ed-w">Reset</span>
          {varSelect(true)}
          <span className="ed-w">to the starting value</span>
        </>
      );
      break;
    case 'gallery':
      body = (
        <>
          <span className="ed-w">Show the</span>
          <Select
            value={String(p.direction ?? 'next')}
            onChange={(v) => onParams({ direction: v })}
            ariaLabel="Which image"
            options={[
              { value: 'next', label: 'next' },
              { value: 'prev', label: 'previous' },
              { value: 'first', label: 'first' },
            ]}
          />
          <span className="ed-w">image in</span>
          {target((e) => e.type === 'gallery', isType('gallery'))}
        </>
      );
      break;
    case 'mediaPlay':
    case 'mediaPause':
    case 'mediaRestart':
    case 'mediaToggle':
      body = (
        <>
          <span className="ed-w">
            {action.type === 'mediaPlay' ? 'Play' : action.type === 'mediaPause' ? 'Pause' : action.type === 'mediaToggle' ? 'Play / pause' : 'Restart'}
          </span>
          {target((e) => e.type === 'video' || e.type === 'audio', isType('video', 'audio'))}
        </>
      );
      break;
    case 'quizReset':
      body = (
        <>
          <span className="ed-w">Reset</span>
          {target((e) => e.type === 'quiz', isType('quiz'))}
          <span className="ed-w">so it can be answered again</span>
        </>
      );
      break;
    case 'animate':
      body = (
        <>
          <span className="ed-w">Play</span>
          <Select value={String(p.preset ?? 'pop')} onChange={(v) => onParams({ preset: v })} options={EMPHASIS_PRESETS} ariaLabel="Animation" />
          <span className="ed-w">on</span>
          {target()}
        </>
      );
      break;
    case 'openLink':
      body = <LinkEditor params={p} onParams={onParams} />;
      break;
    case 'modelView':
      body = (
        <>
          <span className="ed-w">Turn</span>
          {target((e) => e.type === 'model', isType('model'))}
          <span className="ed-w">to</span>
          <Select value={String(p.view ?? 'reset')} onChange={(v) => onParams({ view: v })} options={MODEL_VIEWS} ariaLabel="View" />
        </>
      );
      break;
    case 'modelSpin':
      body = (
        <>
          <Select
            value={String(p.mode ?? 'toggle')}
            onChange={(v) => onParams({ mode: v })}
            ariaLabel="Spin"
            options={[
              { value: 'toggle', label: 'Start / stop spinning' },
              { value: 'start', label: 'Start spinning' },
              { value: 'stop', label: 'Stop spinning' },
            ]}
          />
          {target((e) => e.type === 'model', isType('model'))}
        </>
      );
      break;
    case 'wait':
      body = (
        <>
          <span className="ed-w">Wait</span>
          <NumberInput
            value={Number(p.seconds ?? 0.5)}
            step={0.25}
            min={0}
            max={60}
            onChange={(v) => onParams({ seconds: v }, 'sec')}
            ariaLabel="Seconds"
            width={96}
          />
          <span className="ed-w">seconds</span>
        </>
      );
      break;
    default:
      body = <span className="ed-w">{action.type}</span>;
  }
  return (
    <li
      className={`ed-action ${action.type === 'openLink' ? 'is-wide' : ''}`}
      style={{ ['--c' as string]: cat.color, ['--s' as string]: cat.soft }}
      data-testid="action-row"
    >
      <span className="ed-action-num">{index + 1}</span>
      <div className="ed-action-body">{body}</div>
      <div className="ed-action-tools">
        {count > 1 && (
          <>
            <button className="ed-icon-btn is-xs" aria-label="Move action up" disabled={index === 0} onClick={() => onMove(-1)}>
              <Icon name="up" size={13} />
            </button>
            <button className="ed-icon-btn is-xs" aria-label="Move action down" disabled={index === count - 1} onClick={() => onMove(1)}>
              <Icon name="down" size={13} />
            </button>
          </>
        )}
        <button className="ed-icon-btn is-xs is-danger" aria-label="Remove action" onClick={onDelete}>
          <Icon name="close" size={13} />
        </button>
      </div>
    </li>
  );
}

/** "Open <url> in a new tab", with friendly validation and an optional description for screen readers. */
export function LinkEditor({ params, onParams }: { params: Record<string, ParamValue>; onParams(patch: Record<string, ParamValue>, merge?: string): void }) {
  const url = String(params.url ?? '');
  const [touched, setTouched] = useState(!!url);
  const problem = linkProblem(url);
  const [more, setMore] = useState(!!params.label);
  return (
    <div className="ed-link-editor">
      <div className="ed-link-row">
        <span className="ed-w">Open</span>
        <div className={`ed-link-input ${touched && problem ? 'is-bad' : ''}`} onBlur={() => setTouched(true)}>
          <Icon name="link" size={14} />
          <TextInput value={url} onChange={(v) => onParams({ url: v.slice(0, 2000) }, 'url')} placeholder="https://example.com" ariaLabel="Link address" />
        </div>
      </div>
      {touched && problem && (
        <p className="ed-link-problem" role="alert" data-testid="link-problem">
          <Icon name="warning" size={13} /> {problem}
        </p>
      )}
      <div className="ed-link-row">
        <Select
          value={params.newTab === false ? 'same' : 'new'}
          onChange={(v) => onParams({ newTab: v === 'new' })}
          ariaLabel="Where it opens"
          options={[
            { value: 'new', label: 'in a new tab' },
            { value: 'same', label: 'in the same tab' },
          ]}
        />
        {!more && (
          <button className="ed-link" onClick={() => setMore(true)}>
            Add a description
          </button>
        )}
      </div>
      {more && (
        <TextInput
          value={String(params.label ?? '')}
          onChange={(v) => onParams({ label: v.slice(0, 200) }, 'label')}
          placeholder="Describe the link (read aloud by screen readers)"
          ariaLabel="Link description"
        />
      )}
    </div>
  );
}

/** Dropdown for choosing a target element; hovering an option highlights it on the canvas. */
function ElementPicker({
  value,
  owner,
  project,
  onChange,
  filter,
  allowSelf = true,
}: {
  value: string;
  owner: IxOwner;
  project: Project;
  onChange(v: string): void;
  filter?(e: SceneElement): boolean;
  allowSelf?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close, true);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      editor().set({ highlightId: null });
    };
  }, [open]);
  const el = owner.el;
  const isSelf = !!el && (value === SELF_TARGET || value === el.id);
  const found = !isSelf && value ? findEl(project, value) : null;
  const label = isSelf ? 'this element' : found ? found.el.name : 'choose…';
  const home = project.pages.find((pg) => pg.id === owner.pageId);
  const groups = project.pages
    .map((pg, i) => ({ pg, i, els: pg.elements.filter((e) => e.id !== el?.id && (!filter || filter(e))) }))
    .filter((g) => g.els.length)
    .sort((a, b) => (a.pg === home ? -1 : b.pg === home ? 1 : a.i - b.i));
  return (
    <div className="ed-elpick" ref={ref}>
      <button className={`ed-elpick-btn ${!value ? 'is-empty' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <span>{label}</span>
        <Icon name="chevron" size={13} />
      </button>
      {open && (
        <div className="ed-elpick-menu" role="listbox">
          {allowSelf && el && (!filter || filter(el)) && (
            <button
              role="option"
              aria-selected={isSelf}
              className={isSelf ? 'is-on' : ''}
              onClick={() => {
                onChange(SELF_TARGET);
                setOpen(false);
              }}
            >
              <Icon name="cursor" size={15} /> This element
            </button>
          )}
          {groups.map((g) => (
            <div key={g.pg.id}>
              <div className="ed-elpick-group">{g.pg === home ? `On this ${project.kind === 'slides' ? 'slide' : 'section'}` : `${g.i + 1}. ${g.pg.name}`}</div>
              {g.els.map((e) => (
                <button
                  key={e.id}
                  role="option"
                  aria-selected={value === e.id}
                  className={value === e.id ? 'is-on' : ''}
                  onPointerEnter={() => editor().set({ highlightId: e.id })}
                  onPointerLeave={() => editor().set({ highlightId: null })}
                  onClick={() => {
                    onChange(e.id);
                    setOpen(false);
                  }}
                >
                  <Icon name={EDITOR_ELEMENTS[e.type]?.icon ?? 'shape'} size={15} /> {e.name}
                  {e.hidden && <em>hidden</em>}
                </button>
              ))}
            </div>
          ))}
          {!groups.length && !allowSelf && <div className="ed-elpick-empty">Nothing suitable on any page yet.</div>}
        </div>
      )}
    </div>
  );
}

export function actionSummary(a: Action, project: Project, selfId: string): string {
  const p = a.params;
  const name = (id: unknown) => ((id === SELF_TARGET || id === selfId) && selfId ? 'this' : (typeof id === 'string' && findEl(project, id)?.el.name) || '…');
  const v = (id: unknown) => (id === '@all' ? 'all variables' : (project.variables.find((x) => x.id === id)?.name ?? '…'));
  switch (a.type) {
    case 'show':
      return `show ${name(p.target)}`;
    case 'hide':
      return `hide ${name(p.target)}`;
    case 'toggle':
      return `show/hide ${name(p.target)}`;
    case 'navigate':
      return `go to ${
        pageTargetOptions(project)
          .find((o) => o.value === p.page)
          ?.label.toLowerCase() ?? '…'
      }`;
    case 'varAdd':
      return `add ${p.amount} to ${v(p.variable)}`;
    case 'varSubtract':
      return `subtract ${p.amount} from ${v(p.variable)}`;
    case 'varSet':
      return `set ${v(p.variable)} to ${p.value}`;
    case 'varReset':
      return `reset ${v(p.variable)}`;
    case 'gallery':
      return `${p.direction ?? 'next'} image in ${name(p.target)}`;
    case 'animate':
      return `${p.preset} ${name(p.target)}`;
    case 'wait':
      return `wait ${p.seconds}s`;
    case 'mediaPlay':
      return `play ${name(p.target)}`;
    case 'mediaPause':
      return `pause ${name(p.target)}`;
    case 'mediaRestart':
      return `restart ${name(p.target)}`;
    case 'mediaToggle':
      return `play / pause ${name(p.target)}`;
    case 'quizReset':
      return `reset ${name(p.target)}`;
    case 'openLink':
      return p.url ? `open ${linkDisplay(p.url)}` : 'open a link';
    case 'modelView':
      return `turn ${name(p.target)} to ${MODEL_VIEWS.find((v) => v.value === p.view)?.label ?? 'a view'}`;
    case 'modelSpin':
      return `${p.mode === 'start' ? 'start spinning' : p.mode === 'stop' ? 'stop spinning' : 'start/stop spinning'} ${name(p.target)}`;
    default:
      return a.type;
  }
}

// ---------------- entrance animation ----------------

function EntranceSection({ el }: { el: SceneElement }) {
  const a = el.entrance;
  const presets = ENTRANCE_PRESETS.filter((p) => !p.onlyFor || p.onlyFor === el.type);
  const set = (patch: Partial<NonNullable<SceneElement['entrance']>> | null, merge?: string) =>
    updateElement(
      el.id,
      (d) => {
        if (patch === null) d.entrance = null;
        else d.entrance = { preset: 'fadeIn', duration: 700, delay: 0, ...(d.entrance ?? {}), ...patch };
      },
      merge,
    );
  const preview = () => {
    const node = document.querySelector<HTMLElement>(`.ed-el[data-id="${el.id}"] .ofs-anim`);
    if (node && a) void playAnimation(node, a.preset, { duration: a.duration, direction: a.direction });
  };
  return (
    <Section
      title="Entrance animation"
      icon="sparkle"
      aside={
        a ? (
          <button className="ed-btn ed-btn-xs ed-btn-ghost" onClick={preview}>
            <Icon name="play" size={12} /> Preview
          </button>
        ) : undefined
      }
    >
      <div className="ed-anim-grid">
        <button className={`ed-anim-opt ${!a ? 'is-on' : ''}`} onClick={() => set(null)}>
          <Icon name="close" size={18} />
          <span>None</span>
        </button>
        {presets.map((p) => (
          <button
            key={p.value}
            className={`ed-anim-opt ${a?.preset === p.value ? 'is-on' : ''}`}
            onClick={() => set({ preset: p.value, direction: p.value === 'slideIn' ? (a?.direction ?? 'up') : undefined })}
          >
            <Icon name={p.icon} size={18} />
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      {a && (
        <>
          {a.preset === 'slideIn' && (
            <Field label="Comes from">
              <Segmented
                value={a.direction ?? 'up'}
                onChange={(v) => set({ direction: v })}
                options={[
                  { value: 'left', icon: 'right', title: 'From the left' },
                  { value: 'right', icon: 'left', title: 'From the right' },
                  { value: 'down', icon: 'up', title: 'From below' },
                  { value: 'up', icon: 'down', title: 'From above' },
                ]}
              />
            </Field>
          )}
          <Field label="Duration">
            <Slider value={a.duration / 1000} min={0.2} max={3} step={0.1} unit="s" onChange={(v) => set({ duration: Math.round(v * 1000) }, 'anim-dur')} />
          </Field>
          <Field label="Delay">
            <Slider value={a.delay / 1000} min={0} max={5} step={0.1} unit="s" onChange={(v) => set({ delay: Math.round(v * 1000) }, 'anim-delay')} />
          </Field>
          <p className="ed-note">
            {useEditor.getState().project?.kind === 'page' ? 'Plays when the element scrolls into view.' : 'Plays each time the slide appears.'}
          </p>
        </>
      )}
    </Section>
  );
}

// ---------------- slide / section behavior ----------------

/**
 * Behavior of the current slide or section: keyboard shortcuts, "when the
 * slide opens" and "after a delay" — no invisible button needed. Keyboard
 * rules can be switched to work on every slide (project-wide).
 */
export function PageBehaviorPanel() {
  const project = useEditor((s) => s.project)!;
  const pageId = useEditor((s) => s.pageId);
  const page = project.pages.find((p) => p.id === pageId) ?? project.pages[0];
  const owner = pageOwner(project, page);
  const noun = project.kind === 'slides' ? 'slide' : 'section';
  const projectOwner: IxOwner = { ...owner, type: '@project', name: `every ${noun}` };
  const updatePageList = (fn: (list: Interaction[]) => void, merge?: string) =>
    editor().update(
      (d) => {
        const pg = d.pages.find((p) => p.id === page.id);
        if (!pg) return;
        const list = pg.interactions ?? [];
        fn(list);
        if (list.length) pg.interactions = list;
        else delete pg.interactions;
      },
      merge ? { merge: `page-ix:${page.id}:${merge}` } : undefined,
    );
  const updateProjectList = (fn: (list: Interaction[]) => void, merge?: string) =>
    editor().update(
      (d) => {
        const list = d.interactions ?? [];
        fn(list);
        if (list.length) d.interactions = list;
        else delete d.interactions;
      },
      merge ? { merge: `project-ix:${merge}` } : undefined,
    );
  const onScope = (ix: Interaction, to: 'page' | 'project') =>
    editor().update((d) => {
      const pg = d.pages.find((p) => p.id === page.id);
      if (!pg) return;
      const from = to === 'project' ? (pg.interactions ?? []) : (d.interactions ?? []);
      const i = from.findIndex((x) => x.id === ix.id);
      if (i < 0) return;
      const [moved] = from.splice(i, 1);
      // A project-wide rule has no "this element": drop @self targets.
      for (const a of moved.actions) if (a.params.target === SELF_TARGET) a.params.target = '';
      if (to === 'project') {
        d.interactions = [...(d.interactions ?? []), moved];
        if (!from.length) delete pg.interactions;
      } else {
        pg.interactions = [...(pg.interactions ?? []), moved];
        if (!from.length) delete d.interactions;
      }
    });
  const projectList = project.interactions ?? [];
  return (
    <div className="ed-inspector-body" data-testid="page-behavior">
      <Section title={`This ${noun}`} icon="bolt">
        <InteractionList
          owner={owner}
          list={page.interactions ?? []}
          project={project}
          update={updatePageList}
          pickerKey={`@page:${page.id}`}
          scope="page"
          onScope={onScope}
          empty={`Do things when the ${noun} opens, after a few seconds, or when a key is pressed — no button needed. Example: “When Space is pressed → animate Arrow 1”.`}
        />
      </Section>
      {projectList.length > 0 && (
        <Section title={`Every ${noun}`} icon="keyboard">
          <p className="ed-note">Keyboard shortcuts that work wherever the viewer is.</p>
          <InteractionList
            owner={projectOwner}
            list={projectList}
            project={project}
            update={updateProjectList}
            pickerKey="@project"
            scope="project"
            onScope={onScope}
          />
        </Section>
      )}
    </div>
  );
}
