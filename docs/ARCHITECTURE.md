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

- **Model** (`src/model`): the versioned `Project` type (see [SCHEMA.md](SCHEMA.md)), factories (`createProject`, `createElement`…), and `validateProject`, which treats all input as untrusted and normalises it against the registries.
- **Runtime** (`src/runtime`): framework-free DOM code. It must stay small and must not import React or editor code.
  - `elements/*` — one renderer per element type (`RuntimeElementDef`: `defaults()` + `render()`), registered in `elements/index.ts`.
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

## Export pipeline

1. `pruneUnusedAssets` drops images nothing references.
2. Optional `optimizeAssets` re-encodes large raster images (ids unchanged, so structure is preserved).
3. `buildStandaloneHtml` writes: CSP meta (`default-src 'none'`; inline script/style only; `data:` images/fonts), base CSS, optional embedded font, the project JSON escaped by `jsonForScript` (`<`, `>`, `&`, U+2028/9 → `\uXXXX`), then the runtime (already escaped for inline use).

The file never references remote URLs; the CSP makes network access impossible even if data were tampered with.

## Import pipeline

`DOMParser` parses the file inertly → the `#ofs-project` JSON is read → `validateProject` checks schema id/version (migrations hook in `migrate()`), sanitises every field, fills defaults from the element registry, drops unknown/unsafe content with warnings. Only `data:image/*;base64` asset URLs are accepted. Text is always rendered with `textContent` (never `innerHTML`).

## Editor state

`src/editor/store/store.ts` holds the project as immutable snapshots (immer). `update()` pushes history (optionally merging rapid edits by key), `begin()/live()/commit()` turn a whole drag/resize into one undo step, `amend()` applies derived fixes (e.g. text auto-height) without a history entry. Drafts autosave to IndexedDB (debounced) via `src/editor/session.ts`.

## Builds

- `vite build` produces `dist/index.html` with all JS/CSS/fonts inlined (`singleFilePlugin`), using a relative base so it works from GitHub Pages sub-paths and from disk.
- The output is deterministic; CI fails if the committed `dist/` differs from a fresh build.
