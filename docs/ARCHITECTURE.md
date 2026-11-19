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
  - `triggers.ts`, `actions.ts`, `conditions.ts`, `animations.ts`, `drag.ts` — registries for interaction pieces.
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

Because Preview and exports execute identical source, behaviour cannot drift between them. The e2e suite verifies this by testing both.

## Themes

`src/model/theme` holds four token sets (`tokens.ts`: colours, background paints, decorative tones, chart palette, fonts, weights, radii, shadows, button shape…) and per-type **mappers** (`mappers.ts`) that turn tokens into element props for a style role (`heading`, `card`, `primary`…). Components never get one implementation per theme — a new component only adds one mapper entry.

Provenance (`apply.ts`): props store resolved values; `element.themed` lists the keys that follow the theme, `background.themed` and `settings.backdropThemed` do the same for paints. Switching theme rewrites only those values; inspector edits go through `updateProps`, which marks edited keys explicit. Because values are resolved, the runtime and exported files are theme-agnostic: Preview, exports and old files render exactly what is stored. v1 projects migrate with no themed keys (see SCHEMA.md), so they keep their exact look until the author chooses "Restyle everything".

Editor surfaces: start-screen style picker, the docked theme dialog (live canvas restyle, illustrated previews drawn from real tokens), a style strip in the inspector (role picker, "Theme" badge or "Reset to theme"), theme backgrounds in slide settings, theme swatches first in colour pickers, and "on dark" roles when inserting onto dark slides.

## Media

Video/audio/GIF assets are embedded as base64 `data:` URLs inside the project JSON — exports always contain the real bytes and never blob: URLs. At playback `mediaUrl()` (`runtime/env.ts`) decodes a media asset once, in chunks, into a `Blob` and uses an object URL: large media seeks and plays far more reliably than from a multi-megabyte data URL, and no network/`fetch` is involved (the CSP forbids it). Autoplay honours browser policies: when `play()` is refused the element shows a play button instead of pretending to play. Image optimisation never touches GIFs (animation preserved), video or audio.

Uploading (`io/assets.ts`) normalises MIME types, measures video/audio (with header parsing as a fallback), detects animated GIF/APNG/WebP, and de-duplicates by content hash. Exports are sized without building them twice (`io/exportPlan.ts`: the HTML shell plus exact base64 lengths), and blocked when too large or when an element points at a missing/wrong-kind file.

Drafts (`io/storage.ts`, IndexedDB v2) keep asset payloads in a separate store keyed by a SHA-256 computed locally, so autosave rewrites only the small project record; v1 draft records still load and are converted on their next save.

## Component events

Interactive components announce events by dispatching bubbling DOM events from their content node (`emit()` in `triggers.ts`); triggers such as `quizCorrect`, `countdownDone` and `mediaEnded` listen on the element wrapper like `click` does, and declare `forTypes` so the editor only offers them where they make sense. Element APIs (`play`, `pause`, `restart`, `reset`…) are reached by actions through `PlayerControl.api()`; `clearState()` resets per-session state (e.g. a quiz answer) even for elements on other slides.

## Export pipeline

1. `pruneUnusedAssets` drops images nothing references.
2. Optional `optimizeAssets` re-encodes large raster images (ids unchanged, so structure is preserved).
3. `buildStandaloneHtml` writes: CSP meta (`default-src 'none'`; inline script/style only; `data:`/`blob:` images and media, `data:` fonts), base CSS, only the embedded fonts the project uses, the project JSON escaped in one pass by `jsonForScript` (`<`, `>`, `&`, U+2028/9 → `\uXXXX`), then the runtime (already escaped for inline use).

The file never references remote URLs; the CSP makes network access impossible even if data were tampered with.

## Import pipeline

`DOMParser` parses the file inertly → the `#ofs-project` JSON is read → `validateProject` checks schema id/version (migrations hook in `migrate()`), sanitises every field, fills defaults from the element registry, drops unknown/unsafe content with warnings. Only base64 `data:` URLs of supported image/video/audio types are accepted, and references are kind-checked (a video element can only point at a video asset). Text is always rendered with `textContent` (never `innerHTML`).

## Editor state

`src/editor/store/store.ts` holds the project as immutable snapshots (immer). `update()` pushes history (optionally merging rapid edits by key), `begin()/live()/commit()` turn a whole drag/resize into one undo step, `amend()` applies derived fixes (e.g. text auto-height) without a history entry. Drafts autosave to IndexedDB (debounced) via `src/editor/session.ts`.

## Builds

- `vite build` produces `dist/index.html` with all JS/CSS/fonts inlined (`singleFilePlugin`), using a relative base so it works from GitHub Pages sub-paths and from disk.
- The output is deterministic; CI fails if the committed `dist/` differs from a fresh build.
