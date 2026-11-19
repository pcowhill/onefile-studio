# OneFile Studio

A friendly, offline visual editor for **interactive slide presentations and scrolling webpages** — no code required. Everything you make exports as **one self-contained HTML file** that works offline, can be emailed or double-clicked, and can always be **re-opened in the editor** to keep working.

> Prototype / MVP. Built to explore what this product should become.

**Live app:** https://pcowhill.github.io/onefile-studio/ (deployed from `main` by GitHub Actions)
**Offline copy:** [`dist/index.html`](dist/index.html) is the whole editor in a single file — download it and open it from disk.

## What you can do

- Pick one of four **themes** — **Playful**, **Professional**, **Technical** (dark) or **Editorial** — then start a **Slide presentation** (16:9, scales to any screen) or a **Scrolling webpage** (stacked sections, scales down on small screens). Switch themes any time: the canvas restyles live, your own customisations are kept, and every element has a one-click **Reset to theme**.
- Add **text, images, shapes, arrows and buttons** with good-looking defaults, then drag, resize, rotate, align, layer, duplicate, copy/paste — with full **undo/redo** and keyboard shortcuts.
- **Rich media**: embed **video** (MP4, WebM), **audio** (MP3, WAV, OGG, M4A) and **animated GIFs** — all packed into the exported file, with play / pause / restart actions, honest autoplay handling and a polished audio player.
- **Data components**: interactive **bar and line charts** (hover tooltips, legend toggles, three presets, a spreadsheet-like data editor with paste and CSV import) and **tables** (viewer sorting, striping, header row, CSV/paste).
- **Countdown** (cards, digital or inline; any time zone, DST-safe; optional daily/weekly repeat; a “countdown finishes” trigger) and **Quiz** questions (instant feedback, retry, reveal, optional score variable, “answered correctly/wrongly” triggers).
- Use ready-made interactive components that work immediately: **Before & After** slider, **Gallery**, **Scrolling text** panel, **Progress** bar/ring, **Next/Back** navigation buttons, **Score counter**.
- Give elements behaviour with **WHEN → IF → DO** interactions:
  - When: click, right-click (plus double-click and pointer-enters under “More”); components add their own: quiz answered correctly / wrongly, countdown finishes, video/audio finishes
  - If (optional): a variable comparison such as “Score is at least 50”
  - Do (in order): show / hide / toggle, go to a slide or section, add / subtract / set / reset a number variable, change a gallery image, play / pause / restart a video or sound, reset a quiz, play an animation (pop, shake, bounce…), wait.
- Number **variables** shown in text with `{Name}` tokens or bound to progress bars.
- **Entrance animations** (fade, slide, pop, arrow “draw”) and a **rigid drag** behaviour viewers can use.
- A custom **right-click menu** on editor surfaces; **Preview** runs the real playback engine.
- **Export** one `.html` file (original or optimised images) with a size estimate and a breakdown of the largest files, and **import** it back later.
- Drafts are auto-saved in the browser (IndexedDB; large media stored once, not on every save). Six **examples** are available from the start screen, including three v0.2 showcases: a *feature release walkthrough* (Professional: video, chart, table), an *event announcement* (Editorial webpage: countdown, animated GIF) and an *interactive knowledge check* (Technical: quizzes, score, completion badge).

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
3. Select an element; use the **Design** tab to style it and the **Behavior** tab to add interactions (“Add interaction” → choose a trigger card → add actions). The strip at the top of the Design tab shows the element's theme style (e.g. *Heading*, *Card*) and offers **Reset to theme** after you customise it.
4. Change the look with the **theme** button next to the title. Manage pictures, videos and sounds (**Media**), number variables (**Variables**) and slides/sections (**Slides/Sections**, right-click a thumbnail for options).
5. **Preview** (`Ctrl/⌘+Enter`) to try it, **Export** (`Ctrl/⌘+E`) to download the HTML file.
6. To continue editing an exported file, use **Open a file** (start screen or folder icon) or drop it on the start screen.

Shortcuts: `Ctrl/⌘+Z` / `Shift+Ctrl/⌘+Z` undo/redo · `Ctrl/⌘+D` duplicate · `Ctrl/⌘+C/V/X` · `Delete` · arrows nudge (`Shift` = 10px) · `Ctrl/⌘+[ / ]` layer · `Enter` edit text · `Esc` deselect · `Ctrl/⌘+wheel` zoom · `Alt` while moving or resizing disables snapping · `Shift` while resizing toggles aspect lock.

## Export & import

An exported file contains, in this order: a strict Content-Security-Policy (no network at all), minimal CSS, the **full project JSON** (`<script type="application/json" id="ofs-project">`, safely escaped), and the minified **playback runtime**. Images, video and audio are embedded as base64 data URLs and de-duplicated; unused files are pruned. At playback, video/audio are decoded once into in-memory Blobs for smooth seeking (still no network). Embedded fonts (Nunito, Inter, Space Grotesk, Fraunces — all OFL) are included only when the project uses them. The export dialog estimates the final size exactly, lists the biggest files, warns about very large exports, and refuses (with an explanation) exports that are too big for a browser to build or that reference a missing file.

Importing parses the HTML inertly (scripts are never executed), reads only the JSON payload, and validates/normalises it (unknown types, unsafe colours, non-embedded or unsupported media, wrong-kind asset references and dangling references are dropped with a warning). Files from v0.1 are migrated automatically and keep their exact appearance.

“Optimised” export downsizes raster images to 1920 px and re-encodes them (WebP, or JPEG for opaque images) when that is smaller. Animated GIF/WebP/PNG, video and audio are never re-encoded. The optimised images become the project’s images when the file is re-imported.

## Architecture (short)

```
src/model     project types, factories, validation (schema v2), themes
src/runtime   playback engine: element renderers + registries for triggers,
              actions, animations, drag modes; player for slides & pages
src/io        export (standalone HTML), import, assets, IndexedDB drafts
src/editor    React UI: store (undo/redo), canvas, panels, inspector, behaviors
src/examples  example projects + original SVG artwork
build/        Vite plugins (runtime-as-string, single-file build)
```

The **same runtime code** renders the editor canvas, runs Preview, and is bundled (via esbuild, `virtual:ofs-runtime`) into every exported file. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SCHEMA.md](docs/SCHEMA.md) and [docs/EXTENDING.md](docs/EXTENDING.md).

## Testing

- **Unit** (`tests/unit`): schema validation and the v1→v2 migration (with real v0.1 exports in `tests/fixtures/v0.1`), themes (completeness, WCAG contrast, provenance, switching, overrides), serialisation/escaping, export ↔ import round trips, media assets (MIME, GIF animation detection, no re-encoding), charts, tables, CSV, countdown time-zone/DST maths and completion, quiz scoring/retry/reset, interactions, variables, all components in all four themes, store undo/redo and editing operations.
- **End-to-end** (`tests/e2e`): for each example and each new component (video, audio, GIF, chart, table, countdown, quiz) and each of the four themes, the test builds or opens the project, exports through the real UI, opens the downloaded file from disk via `file://` in an **offline** browser context, asserts **zero network requests** and no script errors, exercises the behaviour (media really plays, tooltips, sorting, quiz scoring, countdown ticking…), then re-imports the file and compares the project. Further tests cover editing, undo/redo, the context menu, building interactions, sections, uploads, optimised export, theme switching and v0.1 imports, and draft persistence.

## Known limitations

- Video and audio are embedded as-is (no transcoding). Use browser-friendly formats: H.264 MP4 or VP9 WebM for video, MP3/M4A for audio. Large media makes large files (the export dialog shows the size); about 150 MB per file and ~450 MB per export are the practical limits. Media playback is tested in Chromium; Safari/Firefox support depends on the codec.
- Browsers block sound from starting automatically: autoplay with sound shows a play button instead (muted autoplay works).
- The quiz supports one correct answer per question.

- Desktop-first editor (min. width ~1024 px). Exported webpages **scale down** proportionally on small screens rather than re-flowing into a mobile layout.
- Fonts other than the embedded “Friendly” (Nunito) font use system font stacks, so text can render slightly differently between operating systems.
- Resizing rotated elements works, but alignment/snapping uses unrotated bounding boxes, and resizing only snaps for unrotated elements.
- Only number variables and one condition type (variable comparison); no keyboard/timer/variable-change triggers yet.
- Drafts live in this browser’s storage only; export to keep a durable copy. Very large images can make files big (use “Optimised”).
- No timelines, keyboard triggers, hyperlinks, collaboration, or custom code (by design).

## License

MIT for the code. Bundled fonts: Nunito, Inter, Space Grotesk and Fraunces (all SIL Open Font License 1.1). All artwork and example media (`src/examples/art*.ts`, `src/examples/media/`, generated by `scripts/make-example-media.py`) is original.
