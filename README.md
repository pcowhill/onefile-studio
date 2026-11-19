# OneFile Studio

A friendly, offline visual editor for **interactive slide presentations and scrolling webpages** — no code required. Everything you make exports as **one self-contained HTML file** that works offline, can be emailed or double-clicked, and can always be **re-opened in the editor** to keep working.

> Prototype / MVP. Built to explore what this product should become.

**Live app:** https://pcowhill.github.io/onefile-studio/ (deployed from `main` by GitHub Actions)
**Offline copy:** [`dist/index.html`](dist/index.html) is the whole editor in a single file — download it and open it from disk.

## What you can do

- Start a **Slide presentation** (16:9, scales to any screen) or a **Scrolling webpage** (stacked sections, scales down on small screens).
- Add **text, images, shapes, arrows and buttons** with good-looking defaults, then drag, resize, rotate, align, layer, duplicate, copy/paste — with full **undo/redo** and keyboard shortcuts.
- Use ready-made interactive components that work immediately: **Before & After** slider, **Gallery**, **Scrolling text** panel, **Progress** bar/ring, **Next/Back** navigation buttons, **Score counter**.
- Give elements behaviour with **WHEN → IF → DO** interactions:
  - When: click, right-click (plus double-click and pointer-enters under “More”)
  - If (optional): a variable comparison such as “Score is at least 50”
  - Do (in order): show / hide / toggle, go to a slide or section, add / subtract / set / reset a number variable, change a gallery image, play an animation (pop, shake, bounce…), wait.
- Number **variables** shown in text with `{Name}` tokens or bound to progress bars.
- **Entrance animations** (fade, slide, pop, arrow “draw”) and a **rigid drag** behaviour viewers can use.
- A custom **right-click menu** on editor surfaces; **Preview** runs the real playback engine.
- **Export** one `.html` file (original or optimised images) and **import** it back later.
- Drafts are auto-saved in the browser (IndexedDB). Three **examples** are available from the start screen.

## Quick start

```bash
npm ci
npm run dev          # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run build` | Type-check and produce the single-file build in `dist/index.html` |
| `npm run preview` | Serve `dist/` on http://localhost:4173 |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm test` | Unit/component tests (Vitest + jsdom) |
| `npm run test:e2e` | End-to-end tests (Playwright, Chromium) — needs a fresh `npm run build` |
| `npm run check` | All of the above in order |

Node 22+ is recommended. No network access is needed at runtime.

## Using the editor

1. Pick **Slide presentation** or **Scrolling webpage**, or open an example.
2. Insert things from the toolbar or the **Insert** panel. Double-click text to edit it.
3. Select an element; use the **Design** tab to style it and the **Behavior** tab to add interactions (“Add interaction” → choose a trigger card → add actions).
4. Manage images (**Images**), number variables (**Variables**) and slides/sections (**Slides/Sections**, right-click a thumbnail for options).
5. **Preview** (`Ctrl/⌘+Enter`) to try it, **Export** (`Ctrl/⌘+E`) to download the HTML file.
6. To continue editing an exported file, use **Open a file** (start screen or folder icon) or drop it on the start screen.

Shortcuts: `Ctrl/⌘+Z` / `Shift+Ctrl/⌘+Z` undo/redo · `Ctrl/⌘+D` duplicate · `Ctrl/⌘+C/V/X` · `Delete` · arrows nudge (`Shift` = 10px) · `Ctrl/⌘+[ / ]` layer · `Enter` edit text · `Esc` deselect · `Ctrl/⌘+wheel` zoom · `Alt` while dragging disables snapping · `Shift` while resizing toggles aspect lock.

## Export & import

An exported file contains, in this order: a strict Content-Security-Policy (no network at all), minimal CSS, the **full project JSON** (`<script type="application/json" id="ofs-project">`, safely escaped), and the minified **playback runtime** (~50 KB). Images are embedded as base64 data URLs and de-duplicated; unused images are pruned. The embedded font (Nunito, OFL) is included only if the project uses it.

Importing parses the HTML inertly (scripts are never executed), reads only the JSON payload, and validates/normalises it (unknown types, unsafe colours, non-embedded image URLs and dangling references are dropped with a warning).

“Optimised” export downsizes raster images to 1920 px and re-encodes them (WebP, or JPEG for opaque images) when that is smaller. The optimised images become the project’s images when the file is re-imported.

## Architecture (short)

```
src/model     project types, factories, validation (schema v1)
src/runtime   playback engine: element renderers + registries for triggers,
              actions, animations, drag modes; player for slides & pages
src/io        export (standalone HTML), import, assets, IndexedDB drafts
src/editor    React UI: store (undo/redo), canvas, panels, inspector, behaviors
src/examples  example projects + original SVG artwork
build/        Vite plugins (runtime-as-string, single-file build)
```

The **same runtime code** renders the editor canvas, runs Preview, and is bundled (via esbuild, `virtual:ofs-runtime`) into every exported file. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SCHEMA.md](docs/SCHEMA.md) and [docs/EXTENDING.md](docs/EXTENDING.md).

## Testing

- **Unit** (`tests/unit`): schema validation, serialisation/escaping, export ↔ import round trips, asset embedding/de-duplication, interactions (click, right-click, conditions, ordering, waits), variables, gallery, before/after, scrolling text, navigation, drag, store undo/redo and editing operations.
- **End-to-end** (`tests/e2e`): for each example the test exports through the real UI, opens the downloaded file from disk via `file://` in an **offline** browser context, asserts **zero network requests** and no script errors, checks images decode, exercises the interactions, then re-imports the file and compares the project structure and behaviour. Further tests cover editing, undo/redo, the custom context menu, building interactions in the UI, sections, image upload + optimised export, and draft persistence.

## Known limitations

- Desktop-first editor (min. width ~1024 px). Exported webpages **scale down** proportionally on small screens rather than re-flowing into a mobile layout.
- Fonts other than the embedded “Friendly” (Nunito) font use system font stacks, so text can render slightly differently between operating systems.
- Resizing rotated elements works, but alignment/snapping uses unrotated bounding boxes.
- Only number variables and one condition type (variable comparison); no keyboard/timer/variable-change triggers yet.
- Drafts live in this browser’s storage only; export to keep a durable copy. Very large images can make files big (use “Optimised”).
- No audio/video, timelines, collaboration, or custom code (by design for the MVP).

## License

MIT for the code. Bundled font: Nunito (SIL Open Font License 1.1). All artwork in `src/examples/art.ts` is original.
