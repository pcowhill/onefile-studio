# Architecture

OneFile Studio is a static, client-only React + TypeScript app. Its defining feature is that every project exports to one HTML file that runs offline and can be imported back. The architecture is organised so that **one playback engine** serves the editor canvas, Preview, and exported files.

## Layers

```
            ┌──────────────────── src/editor (React) ────────────────────┐
            │ store (zustand + immer, undo/redo) · canvas · panels ·     │
            │ inspector · behavior editor · dialogs · start screen       │
            └──────┬───────────────────────┬─────────────────────────────┘
                   │ renders via            │ serialises via
            ┌──────▼──────────┐      ┌──────▼─────────────┐
            │ src/runtime     │      │ src/io             │
            │ (vanilla DOM)   │◄─────┤ exportHtml (embeds │
            │ player, element │ code │ runtime string)    │
            │ renderers,      │      │ importHtml, assets │
            │ registries      │      │ storage (IndexedDB)│
            └──────┬──────────┘      └──────┬─────────────┘
                   └──────────┬─────────────┘
                       ┌──────▼──────┐
                       │ src/model   │ types · factories · validate
                       └─────────────┘
```

- **Model** (`src/model`): the versioned `Project` type (see [SCHEMA.md](SCHEMA.md)), factories (`createProject`, `createElement`…), `validateProject` (treats all input as untrusted and normalises it against the registries; structured props are checked by `propSchemas.ts`), and the **theme system** (`src/model/theme`).
- **Runtime** (`src/runtime`): framework-free DOM code. It must stay small and must not import React or editor code.
  - `elements/*` — one renderer per element type (`RuntimeElementDef`: `defaults()` + `render()` + optional `css`), registered in `elements/index.ts`. v0.2 adds `video`, `audio`, `chart`, `table`, `countdown` and `quiz`.
  - `triggers.ts`, `actions.ts`, `conditions.ts`, `animations.ts`, `drag.ts` — registries for interaction pieces. `keys.ts` (v0.4) holds key ids, matching and the "is the viewer typing?" rules for keyboard triggers.
  - `model3d/` (v0.4) — `contract.ts` (no three.js) defines the 3D add-on interface; `viewer.ts` + `addon.ts` are the three.js viewer, bundled separately.
  - `player.ts` — `createPlayer(container, project)` builds the slide stage (scaled, letterboxed, transitions, keyboard, built-in controls) or the scrolling page (full-width section backgrounds, scaled content column, scroll progress, entrance animations on scroll), binds triggers and runs interactions.
  - `standalone.ts` — the entry bundled into exports: reads the embedded JSON and calls `createPlayer`.
- **IO** (`src/io`): standalone HTML generation, import/extraction, asset helpers (hashing, de-duplication, optimisation), draft storage, download.
- **Editor** (`src/editor`): UI only. Element/trigger/action **UI metadata** (labels, icons, illustrations, inspectors, sentence editors) lives here, keyed by the same ids as the runtime registries.

## One engine everywhere

| Surface | How it renders |
| --- | --- |
| Editor canvas | `renderContent()` from the runtime for each element (mode `edit`: no behaviour), wrapped in React-managed positioning + selection overlay |
| Thumbnails | `renderPageStatic()` (mode `thumb`) |
| Preview | `createPlayer()` imported directly (mode `play`) |
| Exported file | the same `src/runtime/standalone.ts` bundled by esbuild into a string (`virtual:ofs-runtime`, see `build/plugins.ts`) and inlined |
| 3D models | `src/runtime/model3d/addon.ts` bundled into a second string (`virtual:ofs-runtime-3d`): exports include it only when a model is shown; the editor injects the same string on first use (see *3D models* below) |

Because Preview and exports execute identical source, behaviour cannot drift between them. The e2e suite verifies this by testing both.

## Themes

`src/model/theme` holds four token sets (`tokens.ts`: colours, background paints, decorative tones, chart palette, fonts, weights, radii, shadows, button shape…) and per-type **mappers** (`mappers.ts`) that turn tokens into element props for a style role (`heading`, `card`, `primary`…). Components never get one implementation per theme — a new component only adds one mapper entry.

Provenance (`apply.ts`): props store resolved values; `element.themed` lists the keys that follow the theme, `background.themed` and `settings.backdropThemed` do the same for paints. Switching theme rewrites only those values; inspector edits go through `updateProps`, which marks edited keys explicit. Because values are resolved, the runtime and exported files are theme-agnostic: Preview, exports and old files render exactly what is stored. v1 projects migrate with no themed keys (see SCHEMA.md), so they keep their exact look until the author chooses "Restyle everything".

Editor surfaces: start-screen style picker, the docked theme dialog (live canvas restyle, illustrated previews drawn from real tokens), a style strip in the inspector (role picker, "Theme" badge or "Reset to theme"), theme backgrounds in slide settings, theme swatches first in colour pickers, and "on dark" roles when inserting onto dark slides.

## Media

Video/audio/GIF assets are embedded as base64 `data:` URLs inside the project JSON — exports always contain the real bytes and never blob: URLs. At playback `mediaUrl()` (`runtime/env.ts`) decodes a media asset once, in chunks, into a `Blob` and uses an object URL: large media seeks and plays far more reliably than from a multi-megabyte data URL, and no network/`fetch` is involved (the CSP forbids it). Autoplay honours browser policies: when `play()` is refused the element shows a play button instead of pretending to play. Image optimisation never touches GIFs (animation preserved), video or audio.

Uploading (`io/assets.ts`) normalises MIME types, measures video/audio (with header parsing as a fallback), detects animated GIF/APNG/WebP, and de-duplicates by content hash. Exports are sized without building them twice (`io/exportPlan.ts`: the HTML shell plus exact base64 lengths), and blocked when too large or when an element points at a missing/wrong-kind file.

Drafts (`io/storage.ts`, IndexedDB v2) keep asset payloads in a separate store keyed by a SHA-256 computed locally, so autosave rewrites only the small project record; v1 draft records still load and are converted on their next save.

## Media edits (v3)

Edits are data, not pixels (`src/model/mediaEdit.ts`, schema in [SCHEMA.md](SCHEMA.md#media-edits-v3)): `asset.edit` is the library version, `props.edit` on image/video/audio elements an optional per-element override (`null` = follow the library). `resolveEdit(project, assetId, override)` is the single place that decides which applies; the runtime, the editor previews, the export plan and the inspector all go through it.

- **Pictures** — `imageFill()` (`runtime/elements/editedImage.ts`) returns the v0.2 `<img>` for unedited images and otherwise an inline SVG whose viewBox is the crop and whose `<image>` carries the orientation matrix. Image elements, galleries, before/after sliders and page backgrounds all use it, so a library edit applies everywhere. No canvas re-encoding: no quality loss, and the edit stays changeable.
- **Video crop** — the `<video>` sits in a viewport sized with container-query units (`min()`/`max()` of `cqw`/`cqh` for contain/cover) and is scaled/offset in percentages, so it is correct at any element size and slide scale. Native controls would be clipped and would show the whole file, so edited videos get a small themed control bar.
- **Trim** — `playSegment()` (`runtime/elements/mediaShared.ts`) wraps a media element: seeks to the start before playing, stops at the end (animation frames, with `timeupdate` as a background-tab fallback), loops the segment manually, clamps seeks, and owns the `mediaEnded` moment for trimmed and untrimmed media alike.

## Capture

`src/io/capture.ts` is framework-free and fully injectable (`CaptureDeps`): capability detection with reasons, MIME selection, `recordStream()` sessions (deferred start for the countdown, pause/resume, stop → `File`, cancel, stream release on every path), screen/webcam/microphone/screen + webcam starters, frame-safe screenshots (`waitForFrames` via `requestVideoFrameCallback`), playback verification and a level meter. Its lifecycle is adapted from the browser video editor (pcowhill/claude-agile-team-demo `src/lib/recording.ts`); `src/io/webmCues.ts` is ported from the same project to add a seek index to recorded WebM. Captured blobs go through `fileToAsset` like uploads — there is no separate downstream path for recorded media.

UI: `src/editor/capture/` (Capture cards in the Media panel, `CaptureDialog`), `src/editor/media/` (`MediaEditor` surfaces, `MediaEditDialog` for library/element scope, `MediaEditRow` for inspectors, `cropMath.ts` pure geometry). Dialog requests live in a tiny zustand store (`mediaUi.ts`), outside undo history; saving an edit is a normal undoable project update.

## Component events

Interactive components announce events by dispatching bubbling DOM events from their content node (`emit()` in `triggers.ts`); triggers such as `quizCorrect`, `countdownDone` and `mediaEnded` listen on the element wrapper like `click` does, and declare `forTypes` so the editor only offers them where they make sense. Element APIs (`play`, `pause`, `restart`, `reset`…) are reached by actions through `PlayerControl.api()`; `clearState()` resets per-session state (e.g. a quiz answer) even for elements on other slides.

## Interaction owners and keyboard (v0.4)

Interactions belong to an **owner**: an element, a page (`page.interactions`) or the project (`project.interactions`). Each trigger definition lists the owners it allows (`owners`), so the editor's trigger picker, the validator and the player agree. The player binds every owner through one function (`bindInteractions`) and gives triggers a `TriggerContext`: their options, `onKey()` and the owner page's `onEnter()`/`onLeave()`.

- **Page activity** — each page view is *active* while it is the current slide (or, on webpages, the current section by scroll position). `pageStart` runs on activation, `pageTimer` starts a timer there and cancels it on deactivation; outgoing slides are deactivated before transitions start, so nothing fires twice.
- **Keyboard** — one `keydown` listener per player. Bindings from active owners whose key matches run, and the event is then consumed (`preventDefault`), which is how a slide's own → rule takes precedence over built-in navigation. Typing targets (fields, sliders, listboxes…), Ctrl/⌘ combinations, IME composition and auto-repeat (unless asked for) are ignored; Enter/Space on a keyboard-focused button keep activating it. Interactions with the same trigger and options on one owner run in list order. Everything is removed on `destroy()`.
- **Links** — `openLink` re-validates the URL at the moment it runs (`model/links.ts`: http, https, mailto, tel only) and calls `PlayerControl.openLink`. Exports open new tabs with `noopener,noreferrer` (or navigate the same tab); Preview passes its own `openLink` that always uses a new tab so the editor is never navigated away. The export CSP does not restrict navigation, and the file never depends on the link target to render.

## Drag modes (v0.4)

`rigid` is unchanged. `floaty` and `weighted` run a small fixed-step physics integrator (`DragPhysics` in `drag.ts`, DOM-free and unit-tested) inside a `requestAnimationFrame` loop that only runs while dragging or settling. Modes see the element through `DragContext`: `toLocal()` converts pointer positions to page coordinates (slide scale and page scrolling included) and `setPose()` writes position + rotation (+ squash/stretch) to the wrapper once per frame. Poses are viewer state kept in the player's per-session map — never written to the project.

## 3D models (v0.4)

- **One renderer, loaded only when needed.** The `model` element (`runtime/elements/model.ts`) is part of the core runtime but never imports three.js; it asks for the add-on through `loadModelRuntime()` (`window.__ofsModel3d`, or `window.__ofsModel3dLoad` in the editor, which injects the add-on string once). Exports include the add-on script (≈650 KB) before the core runtime only when `usesModels(project)`; files without models stay as small as before.
- **Offline under the export CSP.** GLB bytes are decoded from the embedded data URL; textures load from `blob:` URLs through `<img>` (a GLTFLoader plugin swaps the default `ImageBitmapLoader`, which would need `fetch`, for `TextureLoader`). No workers, decoders or network.
- **Editor vs playback.** In the editor canvas and thumbnails, models are stills rendered by one shared, cached renderer (`poster()`), so editing many models never exhausts WebGL contexts and normal drag/resize gestures apply. In playback each viewer has its own renderer with OrbitControls (rotate, zoom, pan), damping, auto-rotate, named views and overlay buttons. It renders only when something moves, pauses off-screen, renders at the on-screen size, keeps orbit gestures from reaching drag modes and click triggers, and on scrolling webpages only zooms with the wheel after the viewer was touched. Failures (no WebGL, invalid model, lost context) show a message in the frame, with "Try again" where recovery is possible; `destroy()` releases geometry, materials, textures, the environment map and the context.

## Export pipeline

1. `pruneUnusedAssets` drops images nothing references.
2. Optional `optimizeAssets` re-encodes large raster images (ids unchanged, so structure is preserved).
3. `buildStandaloneHtml` writes: CSP meta (`default-src 'none'`; inline script/style only; `data:`/`blob:` images and media, `data:` fonts), base CSS, only the embedded fonts the project uses, the project JSON escaped in one pass by `jsonForScript` (`<`, `>`, `&`, U+2028/9 → `\uXXXX`), the 3D add-on when a model is shown, then the runtime (already escaped for inline use).

The file never references remote URLs; the CSP makes network access impossible even if data were tampered with.

## Import pipeline

`DOMParser` parses the file inertly → the `#ofs-project` JSON is read → `validateProject` checks schema id/version (migrations hook in `migrate()`), sanitises every field, fills defaults from the element registry, drops unknown/unsafe content with warnings. Only base64 `data:` URLs of supported image/video/audio/GLB types are accepted, and references are kind-checked (a video element can only point at a video asset). Text is always rendered with `textContent` (never `innerHTML`).

## Editor state

`src/editor/store/store.ts` holds the project as immutable snapshots (immer). `update()` pushes history (optionally merging rapid edits by key), `begin()/live()/commit()` turn a whole drag/resize into one undo step, `amend()` applies derived fixes (e.g. text auto-height) without a history entry. Drafts autosave to IndexedDB (debounced) via `src/editor/session.ts`.

## Builds

- `vite build` produces `dist/index.html` with all JS/CSS/fonts inlined (`singleFilePlugin`), using a relative base so it works from GitHub Pages sub-paths and from disk.
- The output is deterministic; CI fails if the committed `dist/` differs from a fresh build.
