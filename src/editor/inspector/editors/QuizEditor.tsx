import type { QuizProps } from '../../../runtime/elements/quiz';
import { choiceLetter } from '../../../runtime/elements/quiz';
import { MAX_QUIZ_CHOICES } from '../../../model/propSchemas';
import type { P } from '../shared';
import { SHADOW_OPTS } from '../shared';
import { ColorPicker, Field, FontPicker, NumberInput, Section, Segmented, Select, Slider, TextArea, Toggle } from '../../ui/controls';
import { Icon } from '../../ui/Icon';
import { addVariable } from '../../ops';
import { editor } from '../../store/store';
import '../../../styles/interactive.css';

const MIN_CHOICES = 2;

function LayoutGlyph({ kind }: { kind: QuizProps['layout'] }) {
  return (
    <svg viewBox="0 0 48 32" width="48" height="32" aria-hidden="true">
      {kind === 'list' &&
        [3, 12, 21].map((y) => (
          <g key={y}>
            <rect x="4" y={y} width="40" height="7" rx="2.5" className="ed-qz-row" />
            <rect x="6" y={y + 1.5} width="4" height="4" rx="1.2" className="ed-qz-dot" />
          </g>
        ))}
      {kind === 'grid' &&
        [
          [4, 4],
          [25, 4],
          [4, 17],
          [25, 17],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="19" height="11" rx="2.5" className="ed-qz-row" />
            <rect x={x + 2} y={y + 2} width="4" height="4" rx="1.2" className="ed-qz-dot" />
          </g>
        ))}
      {kind === 'pills' &&
        [
          [3, 6, 15],
          [20, 6, 13],
          [35, 6, 10],
          [3, 18, 18],
          [23, 18, 14],
        ].map(([x, y, w]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height="8" rx="4" className="ed-qz-row" />)}
    </svg>
  );
}

/** Inspector for the Quiz element. */
export function QuizEditor({ el, set, project }: P<QuizProps>) {
  const p = el.props;
  const choices = p.choices;
  const vars = project.variables;
  const scoreVar = vars.find((v) => v.id === p.scoreVariable);

  const setChoice = (i: number, text: string) => set({ choices: choices.map((c, k) => (k === i ? text : c)) }, `qz-choice-${i}`);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= choices.length) return;
    const next = [...choices];
    [next[i], next[j]] = [next[j], next[i]];
    // The correct answer travels with its text.
    const correct = p.correct === i ? j : p.correct === j ? i : p.correct;
    set({ choices: next, correct });
  };
  const remove = (i: number) => {
    if (choices.length <= MIN_CHOICES) return;
    const correct = p.correct === i ? 0 : p.correct > i ? p.correct - 1 : p.correct;
    set({ choices: choices.filter((_, k) => k !== i), correct });
  };
  const add = () => {
    if (choices.length >= MAX_QUIZ_CHOICES) return;
    set({ choices: [...choices, `Answer ${choices.length + 1}`] });
  };

  return (
    <>
      <Section title="Question" icon="quiz">
        <TextArea value={p.question} onChange={(v) => set({ question: v }, 'qz-question')} rows={3} ariaLabel="Question" />
      </Section>
      <Section title={`Answers (${choices.length})`} icon="check">
        <p className="ed-note">Tick the right answer. Viewers see the letters in this order.</p>
        <ol className="ed-qz-answers" data-testid="quiz-answers">
          {choices.map((c, i) => {
            const isCorrect = i === p.correct;
            return (
              <li key={i} className={`ed-qz-answer ${isCorrect ? 'is-correct' : ''}`} data-testid="quiz-answer">
                <button
                  className="ed-qz-correct"
                  role="radio"
                  aria-checked={isCorrect}
                  aria-label={`Mark answer ${choiceLetter(i)} as correct`}
                  title={isCorrect ? 'This is the right answer' : 'Make this the right answer'}
                  onClick={() => set({ correct: i })}
                  data-testid="quiz-mark-correct"
                >
                  {isCorrect ? <Icon name="check" size={14} stroke={3.2} /> : <span className="ed-qz-letter">{choiceLetter(i)}</span>}
                </button>
                <input
                  className="ed-input ed-qz-text"
                  value={c}
                  aria-label={`Answer ${choiceLetter(i)}`}
                  placeholder={`Answer ${choiceLetter(i)}`}
                  onChange={(e) => setChoice(i, e.target.value)}
                />
                {isCorrect && <span className="ed-qz-badge">Correct</span>}
                <span className="ed-qz-tools">
                  <button className="ed-icon-btn is-xs" aria-label={`Move answer ${choiceLetter(i)} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                    <Icon name="up" size={14} />
                  </button>
                  <button
                    className="ed-icon-btn is-xs"
                    aria-label={`Move answer ${choiceLetter(i)} down`}
                    onClick={() => move(i, 1)}
                    disabled={i === choices.length - 1}
                  >
                    <Icon name="down" size={14} />
                  </button>
                  <button
                    className="ed-icon-btn is-xs is-danger"
                    aria-label={`Remove answer ${choiceLetter(i)}`}
                    title={choices.length <= MIN_CHOICES ? 'A question needs at least two answers' : undefined}
                    onClick={() => remove(i)}
                    disabled={choices.length <= MIN_CHOICES}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
        <button className="ed-btn ed-btn-sm ed-btn-soft" onClick={add} disabled={choices.length >= MAX_QUIZ_CHOICES} data-testid="quiz-add-answer">
          <Icon name="plus" size={14} /> {choices.length >= MAX_QUIZ_CHOICES ? `Up to ${MAX_QUIZ_CHOICES} answers` : 'Add answer'}
        </button>
      </Section>
      <Section title="Layout" icon="grid">
        <div className="ed-qz-layouts" role="radiogroup" aria-label="Answer layout">
          {(['list', 'grid', 'pills'] as const).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={p.layout === k}
              className={`ed-cd-style ${p.layout === k ? 'is-on' : ''}`}
              onClick={() => set({ layout: k })}
              data-testid={`quiz-layout-${k}`}
            >
              <LayoutGlyph kind={k} />
              <small>{k === 'list' ? 'List' : k === 'grid' ? 'Grid' : 'Pills'}</small>
            </button>
          ))}
        </div>
        <Toggle label="Show letters (A, B, C…)" checked={p.showLetters} onChange={(v) => set({ showLetters: v })} />
      </Section>
      <Section title="Feedback" icon="sparkle">
        <Field label="When the answer is right">
          <TextArea value={p.feedbackCorrect} onChange={(v) => set({ feedbackCorrect: v }, 'qz-fb-ok')} rows={2} ariaLabel="Feedback when correct" />
        </Field>
        <Field label="When the answer is wrong">
          <TextArea value={p.feedbackIncorrect} onChange={(v) => set({ feedbackIncorrect: v }, 'qz-fb-no')} rows={2} ariaLabel="Feedback when wrong" />
        </Field>
        <Toggle
          label="Allow retry"
          description="Shows a “Try again” button after a wrong answer"
          checked={p.allowRetry}
          onChange={(v) => set({ allowRetry: v })}
        />
        <Toggle
          label="Reveal the right answer"
          description={p.allowRetry ? 'Only used when retry is off' : 'Highlights it after a wrong answer'}
          checked={p.revealAnswer}
          onChange={(v) => set({ revealAnswer: v })}
        />
      </Section>
      <Section title="Points" icon="score" defaultOpen={!!scoreVar}>
        {vars.length ? (
          <>
            <Field label="Add points to">
              <Select
                value={scoreVar ? scoreVar.id : ''}
                onChange={(v) => set({ scoreVariable: v })}
                ariaLabel="Score variable"
                options={[{ value: '', label: 'No variable (no points)' }, ...vars.map((v) => ({ value: v.id, label: v.name }))]}
              />
            </Field>
            {scoreVar && (
              <>
                <Field label="Points for a right answer">
                  <NumberInput value={p.points} onChange={(v) => set({ points: v }, 'qz-points')} ariaLabel="Points" />
                </Field>
                <Toggle
                  label="Only on the first try"
                  description="No points after a wrong answer, even if the retry is right"
                  checked={p.firstTryOnly}
                  onChange={(v) => set({ firstTryOnly: v })}
                />
                <p className="ed-note">
                  Points are added once per viewing. Show them with <code>{`{${scoreVar.name}}`}</code> in any text.
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <p className="ed-note">Keep score across questions with a number variable.</p>
            <button
              className="ed-btn ed-btn-sm ed-btn-soft"
              data-testid="quiz-create-score"
              onClick={() => {
                const v = addVariable('Score');
                set({ scoreVariable: v.id });
              }}
            >
              <Icon name="plus" size={14} /> Create a Score variable
            </button>
          </>
        )}
        <p className="ed-note">
          More ideas: show a message on “Answered correctly” in the{' '}
          <button className="ed-link" onClick={() => editor().set({ inspectorTab: 'behavior' })}>
            Behavior
          </button>{' '}
          tab.
        </p>
      </Section>
      <Section title="Colours & fonts" icon="palette" defaultOpen={false}>
        <Field label="Question font">
          <FontPicker value={p.headingFont} onChange={(f) => set({ headingFont: f })} />
        </Field>
        <Field label="Answers font">
          <FontPicker value={p.font} onChange={(f) => set({ font: f })} />
        </Field>
        <Field label="Panel">
          <ColorPicker value={p.background} onChange={(c) => set({ background: c })} allowTransparent />
        </Field>
        <Field label="Text">
          <ColorPicker value={p.color} onChange={(c) => set({ color: c })} />
        </Field>
        <Field label="Answer background">
          <ColorPicker value={p.choiceBg} onChange={(c) => set({ choiceBg: c })} />
        </Field>
        <Field label="Answer outline">
          <ColorPicker value={p.borderColor} onChange={(c) => set({ borderColor: c })} />
        </Field>
        <Field label="Accent (letters, hover, Try again)">
          <ColorPicker value={p.accent} onChange={(c) => set({ accent: c })} />
        </Field>
        <div className="ed-grid2">
          <Field label="Right">
            <ColorPicker value={p.success} onChange={(c) => set({ success: c })} palette={['#00b894', '#16a34a', '#34d399', '#4b7f52', '#2bb673']} />
          </Field>
          <Field label="Wrong">
            <ColorPicker value={p.danger} onChange={(c) => set({ danger: c })} palette={['#ff5d73', '#dc2626', '#f87171', '#b23a2e', '#e84393']} />
          </Field>
        </div>
        <Field label="Rounded corners">
          <Slider value={p.radius} min={0} max={48} unit="px" onChange={(v) => set({ radius: v }, 'radius')} />
        </Field>
        <Field label="Shadow">
          <Segmented value={p.shadow} onChange={(v) => set({ shadow: v })} options={SHADOW_OPTS} size="sm" />
        </Field>
      </Section>
    </>
  );
}
