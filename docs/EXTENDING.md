# Extending OneFile Studio

Every extensible concept is a pair: a **runtime definition** (behaviour, bundled into exports) and an **editor definition** (how it appears in the UI). Both use the same string id.

## Add an element type

1. **Runtime** — create `src/runtime/elements/myThing.ts`:
   ```ts
   export interface MyThingProps {
     color: string;
     count: number;
   }
   export const myThingDef: RuntimeElementDef<MyThingProps> = {
     id: 'myThing',
     defaults: () => ({ color: '#6d4aff', count: 3 }),
     render(el, { doc, env, onCleanup }) {
       const node = h(doc, 'div', 'ofs-mything');
       // Build DOM with textContent only. In env.mode === 'play' you may add
       // listeners (remember onCleanup); return `api` for actions to call.
       return { node };
     },
   };
   ```
   Register it in `src/runtime/elements/index.ts` and put its CSS in the def's `css` string (prefix classes with `ofs-`); it is appended to the shared runtime stylesheet.
   Validation picks up defaults automatically: props are type-checked against `defaults()`; colour props must use a key listed in `COLOR_KEYS` (`validate.ts`). Asset references go in `ASSET_REFS` (`src/model/propSchemas.ts`, with the required asset kind); arrays, nested records and references to variables need a sanitizer in `PROP_SANITIZERS` (and cross-field fixes in `fixupProps`).
   **Theme it:** add a mapper to `MAPPERS` in `src/model/theme/mappers.ts` returning the props that should follow the theme (colours, fonts, radius, shadow — never content or layout). Optionally offer roles in `ROLE_OPTIONS`. Check it in all four themes.
2. **Editor** — add metadata to `EDITOR_ELEMENTS` in `src/editor/catalog.ts` (label, icon, colour, `keepAspect`, `inlineText`, `builtIn` note), a catalog entry in `CATALOG` (with an illustration in `src/editor/panels/illustrations.tsx`), and an inspector component registered in `EDITORS` in `src/editor/inspector/DesignPanel.tsx`.
3. **Tests** — add a playback test in `tests/unit/player.test.ts`.

## Add a trigger

1. Register a `TriggerDef` in `src/runtime/triggers.ts`:
   ```ts
   triggerRegistry.register({
     id: 'longpress',
     bind(node, fire, ctx) {
       /* add listeners */ return () => {
         /* remove */
       };
     },
   });
   ```
   Triggers bound to elements receive the element wrapper node (pages: the slide/section node; project: the player root). For component events, have the element call `emit(node, 'ofs-my-event', detail)` and register a trigger that listens for it with `forTypes: ['myThing']`.
   - `owners` (default `['element']`) says who may own it: add `'page'` / `'project'` for slide-level or project-wide triggers. The validator and the editor read it.
   - `options(raw)` sanitises trigger settings (stored in `interaction.options`); `ctx.options` has the clean values at bind time.
   - `ctx.onKey(spec, fire)` dispatches keys while the owner is active; `ctx.onEnter(fn)` / `ctx.onLeave(fn)` follow the owner's page becoming (and stopping being) the current one — see `key`, `pageStart` and `pageTimer`.
2. Add a `TriggerUi` entry to `TRIGGERS` in `src/editor/behavior/catalog.tsx` with a label, sentence, category (`mouse`, `keyboard`, `timing`, `state`, `component` — each has a colour) and an SVG illustration. Mark it `primary` to show it prominently; otherwise it appears under “More”. Set `forTypes` for component triggers (they are then shown first for that element type only) and the same `owners` as the runtime. `standalone: true` for sentences that do not start with the element's name, and `{page}` in texts becomes "slide"/"section". Trigger settings get their UI in `InteractionCard` (`BehaviorPanel.tsx`; e.g. `KeyPicker`) and their wording in `triggerSentence`. Only list triggers that actually work.

## Add an action

1. Register an `ActionDef` in `src/runtime/actions.ts`. `execute(params, ctx)` gets the `PlayerControl` (vars, visibility, navigation, element APIs, animation) and may return a Promise to delay the next step. Start the work synchronously and return a Promise only for the part that should hold the step up (v0.7: actions in a Together group are started one after another in the same task and the group waits for all their Promises), and never rely on the order in which a group's Promises settle.
2. Add an `ActionUi` to `ACTIONS` in `src/editor/behavior/catalog.tsx` (category, icon, default params, optional `unavailable()` reason) and a sentence editor case in `ActionRow` (`BehaviorPanel.tsx`), plus a summary in `actionSummary`.
3. If params reference elements or variables, name them `target` / `variable` so validation clears dangling references. Params that need stricter checks (like `openLink`'s `url`, see `src/model/links.ts`) are validated in `validate.ts → interactions()` _and_ again in the action itself.

## Add an animation preset

Register in `src/runtime/animations.ts` with `kind` (`entrance`, `emphasis`, `exit`) and `keyframes()` (Web Animations API) or `custom()`. Expose it in the editor via `ENTRANCE_PRESETS` or `EMPHASIS_PRESETS` in `src/editor/behavior/catalog.tsx`.

## Add a drag mode

`src/runtime/drag.ts` defines `DragMode { id, attach(node, ctx) }`. `ctx` gives the element, its `feel` settings (`amount`, `settle`, 0..1), the stage scale, page bounds, position/angle, `moveTo()`, `setPose()` (position, angle, squash & stretch — viewer state only), `toLocal()` (pointer → page coordinates) and `win` for animation frames. Physics modes can reuse the `DragPhysics` interface and the shared driver (`floatyPhysics`, `weightedPhysics`). Offer a new mode in `MODES` in `src/editor/behavior/DragModes.tsx` (with an illustration); the inspector's playground runs the real mode, and validation accepts any registered mode id.

## Conditions

`src/runtime/conditions.ts` evaluates `{ type: 'variable' }` comparisons. New condition types need a `type` discriminator, evaluation there, validation in `validate.ts → interactions()`, and UI in `ConditionsEditor`.

## Add a theme

Add a `ThemeTokens` object to `THEMES` in `src/model/theme/tokens.ts` (and its id to the `ThemeId` union in `src/model/types.ts` and the validator's accepted ids follow automatically). Every mapper derives from tokens, so all components pick it up. `tests/unit/theme.test.ts` checks completeness and WCAG contrast of the key text/background pairs; the theme picker preview is drawn from the tokens.

## Support media edits in a new element

Elements that show an image, video or sound should honour nondestructive edits (`src/model/mediaEdit.ts`). For pictures, render through `imageFill(doc, project, assetId, { fit, alt, edit })` (`src/runtime/elements/editedImage.ts`) instead of a bare `<img>`: it follows the library version, or `edit` when the element has its own. For media playback, wrap the element with `playSegment()` (`mediaShared.ts`) and resolve the trim with `resolveEdit()` + `trimBounds()`. To let authors give the element its own edit, add `edit: null` to its defaults and `edit: mediaEdit(kind)` to `PROP_SANITIZERS`, and show `MediaEditRow` in its inspector.

## Support a new 3D format or viewer feature

The renderer lives in `src/runtime/model3d/viewer.ts` (three.js) behind the `Model3dRuntime` contract (`contract.ts`); the `model` element and editor only talk to the contract. A new format needs an upload check like `inspectGlb()` (`src/model/glb.ts`), its MIME in `ACCEPTED_MODEL_TYPES` / `DATA_URL_HEAD`, and a loader that works without network access under the export CSP (no `fetch`, no workers, no external decoders). Keep the add-on separate from the core runtime so files without models stay small.

## Add a capture source

Capture lives in `src/io/capture.ts` (framework-free, injectable `CaptureDeps`). A new source needs: an id in `CaptureSource` with a reason in `captureSupport()`, a starter returning a `RecordingSession` built with `recordStream()` (so release-on-every-path comes for free), a card in `CAPTURE_CARDS` with an illustration (`src/editor/capture/illustrations.tsx`), and its acquire step in `CaptureDialog.start()`. Add a fake-device e2e test in `tests/e2e/capture.spec.ts` that asserts no track is left live.

## Add a template

1. Write a factory in `src/templates/projects.ts` that returns a project built with `createProject` and the `kit(theme)` helpers (`el`, `text`, `page` with theme roles), so it follows the theme and stays editable. Give elements **meaningful names** and **stable ids**, keep layouts simple enough to edit (prefer one element per idea: a button as a clickable box, a `label` text as a callout), and compute anything date-dependent when the factory runs. Put new artwork in `src/templates/art.ts` (original SVG, via `svgAsset`) and reuse one asset for every place a picture appears.
2. Register it in `TEMPLATES` (`src/templates/index.ts`) with a category, kind, default theme, difficulty, two to four feature chips and a short `guide` (three to five steps: what to change first, then the shared `previewStep` and `exportStep`). Build checks with `changed(id, ...props)`, `anyChanged(...)` and `happened(event)`.
3. `tests/unit/templates.test.ts` runs every registered template automatically (validity, names, guide targets, independence, all four themes, export ↔ import, playback). Add an end-to-end test in `tests/e2e/v05.spec.ts` that exports it, opens the file offline and exercises its interactions.

## Add a lesson

Add a `Lesson` to `LESSONS` in `src/editor/learn/lessons.ts`: `level`, `title`, a one-line `summary`, `minutes`, a `setup()` that builds a practice project (title starting with _Practice —_) and four to seven `steps`. Keep each instruction to one or two sentences that name the control the way the UI labels it, point at it with `control` (a stable `data-testid`) or `element`, and give a semantic `done` check where one exists (`added(type)`, `hasAction(...)`, `stepEvent('preview')`…). End with a `finale`. Add a small illustration in `LessonArt` (`src/editor/start/LearnHub.tsx`) and check the step logic in `tests/unit/lessons.test.ts`.
