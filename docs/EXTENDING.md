# Extending OneFile Studio

Every extensible concept is a pair: a **runtime definition** (behaviour, bundled into exports) and an **editor definition** (how it appears in the UI). Both use the same string id.

## Add an element type

1. **Runtime** — create `src/runtime/elements/myThing.ts`:
   ```ts
   export interface MyThingProps { color: string; count: number }
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
   Register it in `src/runtime/elements/index.ts` and add CSS to `src/runtime/styles.ts` (prefix classes with `ofs-`).
   Validation picks up defaults automatically: props are type-checked against `defaults()`; colour props must use a key listed in `COLOR_KEYS` (`validate.ts`), asset references should be named `assetId`/`before`/`after` or an `images` array.
2. **Editor** — add metadata to `EDITOR_ELEMENTS` in `src/editor/catalog.ts` (label, icon, colour, `keepAspect`, `inlineText`, `builtIn` note), a catalog entry in `CATALOG` (with an illustration in `src/editor/panels/illustrations.tsx`), and an inspector component registered in `EDITORS` in `src/editor/inspector/DesignPanel.tsx`.
3. **Tests** — add a playback test in `tests/unit/player.test.ts`.

## Add a trigger

1. Register a `TriggerDef` in `src/runtime/triggers.ts`:
   ```ts
   triggerRegistry.register({ id: 'longpress', bind(node, fire) { /* add listeners */ return () => { /* remove */ }; } });
   ```
   Triggers bound to elements receive the element wrapper node. Project-level triggers (timers, variable changes, keys) would be bound once in `player.ts` — add a small hook there when the first one is needed.
2. Add a `TriggerUi` entry to `TRIGGERS` in `src/editor/behavior/catalog.tsx` with a label, sentence, category (`mouse`, `keyboard`, `timing`, `state` — each has a colour) and an SVG illustration. Mark it `primary` to show it prominently; otherwise it appears under “More”. Only list triggers that actually work.

## Add an action

1. Register an `ActionDef` in `src/runtime/actions.ts`. `execute(params, ctx)` gets the `PlayerControl` (vars, visibility, navigation, element APIs, animation) and may return a Promise to delay the next action.
2. Add an `ActionUi` to `ACTIONS` in `src/editor/behavior/catalog.tsx` (category, icon, default params, optional `unavailable()` reason) and a sentence editor case in `ActionRow` (`BehaviorPanel.tsx`), plus a summary in `actionSummary`.
3. If params reference elements or variables, name them `target` / `variable` so validation clears dangling references.

## Add an animation preset

Register in `src/runtime/animations.ts` with `kind` (`entrance`, `emphasis`, `exit`) and `keyframes()` (Web Animations API) or `custom()`. Expose it in the editor via `ENTRANCE_PRESETS` or `EMPHASIS_PRESETS` in `src/editor/behavior/catalog.tsx`.

## Add a drag mode

`src/runtime/drag.ts` defines `DragMode { id, attach(node, ctx) }`. `ctx` gives the element, current stage scale, page bounds, position and `moveTo()`. A “floaty” or “weighted” mode would track velocity in `attach` and apply rotation/spring easing to the node (e.g. via a transform on the wrapper). Then offer it in the “Visibility & dragging” section of `BehaviorPanel.tsx` (currently a single toggle for `rigid`).

## Conditions

`src/runtime/conditions.ts` evaluates `{ type: 'variable' }` comparisons. New condition types need a `type` discriminator, evaluation there, validation in `validate.ts → interactions()`, and UI in `ConditionsEditor`.
