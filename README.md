# OneFile Studio

A friendly, offline visual editor for **interactive slide presentations and scrolling webpages** — no code required. Everything you make exports as **one self-contained HTML file** that works offline, can be emailed or double-clicked, and can always be **re-opened in the editor** to keep working.

> Prototype / MVP, v0.5 (Templates & Guided Creation). Built to explore what this product should become.

**Live app:** https://pcowhill.github.io/onefile-studio/ (deployed from `main` by GitHub Actions)
**Offline copy:** [`dist/index.html`](dist/index.html) is the whole editor in a single file — download it and open it from disk.

## What you can do

- **Start from a template** (v0.5): six polished, fully editable starting points in a gallery on the start screen — *Feature Walkthrough*, *Meeting Presentation*, *Technical Explainer*, *Before & After Story*, *Event Announcement* and *Interactive Greeting* — filtered by category (Presentations, Tutorials & Explanations, Announcements, Interactive Experiences, Personal & Creative). Each card shows a live picture of the real template; **Preview** plays it (and tries it in any of the four styles) without saving anything; **Use template** opens an independent copy. A template is an ordinary project: change, add or remove anything. A compact, dismissible **quick-start checklist** (“Customize your Feature Walkthrough: change the title · replace the screenshot · update the explanation · preview · export”) ticks itself as you work and can point at (“Show me”) each element; replacing a picture that appears in several places offers to replace the other copies in one step.
- **Learn by doing** (v0.5): eight short, hands-on lessons in three levels — *Beginner* (your first OneFile, make it interactive, share and re-import), *Intermediate* (interactive media, animations and navigation, variables and data) and *Advanced* (a small interactive challenge with conditions and branching; 3D, physics dragging and keyboard rules). Lessons run in the real editor inside a separate practice project, highlight the control a step talks about, notice when you have done it (from the project itself, not screen positions), and can always be skipped, restarted or left. Completed lessons are remembered in this browser when storage allows.
- Pick one of four **themes** — **Playful**, **Professional**, **Technical** (dark) or **Editorial** — then start a **Slide presentation** (16:9, scales to any screen) or a **Scrolling webpage** (stacked sections, scales down on small screens). Switch themes any time: the canvas restyles live, your own customisations are kept, and every element has a one-click **Reset to theme**.
- **Interactive 3D models** (v0.4): insert a **3D model** viewer, upload a **GLB** file (or pick one from the project), and viewers can **turn, zoom and pan** it, reset the view or go full screen. Choose a lighting preset (studio, soft, dramatic), a backdrop, auto-spin, which gestures are allowed and the starting view; “Turn 3D view” and “Spin” actions fly the camera from buttons or keys. The 3D viewer is embedded in the export only when the project contains a model, so other files stay small.
- **Keyboard shortcuts and slide-level triggers** (v0.4): “When **Space** is pressed → animate Arrow 1” — with a friendly *Press a key* picker (Shift/Alt optional), right on the slide (no invisible button needed) or for **every slide**. Plus **when the slide opens** and **after a delay**. Key rules on a slide take precedence over the built-in arrow-key navigation there, never fire while viewers type, and ignore held-down keys unless asked.
- **Links** (v0.4): an **Open a link** action (new or same tab, optional description), a **Link button** preset and a “**When clicked**” chooser on buttons (*Go to next slide · Show an element · Open a link · Something else…*). Only web, e-mail and phone links are allowed — `javascript:` and other schemes are refused.
- **Playful dragging** (v0.4): besides **Rigid**, viewers can drag elements that feel **Floaty** (springy, tilts while moving and settles back) or **Weighted** (grab-point physics with momentum; keeps its final angle) — pick one from illustrated cards and try it in a little playground in the inspector.
- Add **text, images, shapes, arrows and buttons** with good-looking defaults, then drag, resize, rotate, align, layer, duplicate, copy/paste — with full **undo/redo** and keyboard shortcuts.
- **Capture right in the editor** (v0.3): **screenshots**, **webcam photos**, and **screen**, **webcam**, **voice** and **screen + webcam** recordings — with a countdown, pause/resume, a live level meter and a review step. Captures land in the media library like any upload. See [docs/CAPTURE.md](docs/CAPTURE.md).
- **Quick, nondestructive media edits** (v0.3): **crop, rotate and flip** pictures, **trim and crop** videos, **trim** sounds (with a waveform). The original stays in your project, so every edit can be changed later — also after exporting and re-importing. Edit the library version (every use follows it) or just one element (the same file can be shown several ways, stored once).
- **Rich media**: embed **video** (MP4, WebM), **audio** (MP3, WAV, OGG, M4A) and **animated GIFs** — all packed into the exported file, with play / pause / restart actions, honest autoplay handling and a polished audio player.
- **Data components**: interactive **bar and line charts** (hover tooltips, legend toggles, three presets, a spreadsheet-like data editor with paste and CSV import) and **tables** (viewer sorting, striping, header row, CSV/paste).
- **Countdown** (cards, digital or inline; any time zone, DST-safe; optional daily/weekly repeat; a “countdown finishes” trigger) and **Quiz** questions (instant feedback, retry, reveal, optional score variable, “answered correctly/wrongly” triggers).
- Use ready-made interactive components that work immediately: **Before & After** slider, **Gallery**, **Scrolling text** panel, **Progress** bar/ring, **Next/Back** navigation buttons, **Score counter**.
- Give elements behaviour with **WHEN → IF → DO** interactions:
  - When: click, right-click, a key press (plus double-click and pointer-enters under “More”); slides add “slide opens” and “after a delay”; components add their own: quiz answered correctly / wrongly, countdown finishes, video/audio finishes
  - If (optional): a variable comparison such as “Score is at least 50”
  - Do (in order): show / hide / toggle, go to a slide or section, add / subtract / set / reset a number variable, change a gallery image, play / pause / restart a video or sound, reset a quiz, play an animation (pop, shake, bounce…), open a link, turn or spin a 3D model, wait.
- Number **variables** shown in text with `{Name}` tokens or bound to progress bars.
- **Entrance animations** (fade, slide, pop, arrow “draw”) and **drag** behaviours viewers can use (rigid, floaty, weighted).
- A custom **right-click menu** on editor surfaces; **Preview** runs the real playback engine.
- **Export** one `.html` file (original or optimised images) with a size estimate and a breakdown of the largest files, and **import** it back later.
- Drafts are auto-saved in the browser (IndexedDB; large media stored once, not on every save). Eight **examples** are available from the start screen, including two v0.4 showcases — an *interactive technical explainer* (Technical: step through an architecture diagram with → / Space, R to replay, number keys, floaty and weighted dragging, links) and an *interactive 3D explorer* (Professional: a rover model you can turn and zoom, part buttons that fly the camera, a spec sheet) — and three v0.2 showcases: a *feature release walkthrough* (Professional: video, chart, table), an *event announcement* (Editorial webpage: countdown, animated GIF) and an *interactive knowledge check* (Technical: quizzes, score, completion badge).

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

1. Pick **Slide presentation** or **Scrolling webpage**, **Start from a template**, or open an example. New here? **Learn** on the start screen has short hands-on lessons.
2. Insert things from the toolbar or the **Insert** panel. Double-click text to edit it. Images, videos, sounds and 3D models start as a placeholder: choose the file in the inspector (upload, pick one already in the project, or capture a screenshot / webcam photo).
3. Select an element; use the **Design** tab to style it and the **Behavior** tab to add interactions (“Add interaction” → choose a trigger card → add actions). With nothing selected, the slide's own **Behavior** tab holds keyboard shortcuts, “slide opens” and “after a delay” rules. The strip at the top of the Design tab shows the element's theme style (e.g. *Heading*, *Card*) and offers **Reset to theme** after you customise it.
4. Change the look with the **theme** button next to the title. Manage, **capture** and **edit** pictures, videos and sounds (**Media**: upload, the Capture cards, and the crop/trim button on each file), number variables (**Variables**) and slides/sections (**Slides/Sections**, right-click a thumbnail for options).
5. **Preview** (`Ctrl/⌘+Enter`) to try it, **Export** (`Ctrl/⌘+E`) to download the HTML file.
6. To continue editing an exported file, use **Open a file** (start screen or folder icon) or drop it on the start screen.

Shortcuts: `Ctrl/⌘+Z` / `Shift+Ctrl/⌘+Z` undo/redo · `Ctrl/⌘+D` duplicate · `Ctrl/⌘+C/V/X` · `Delete` · arrows nudge (`Shift` = 10px) · `Ctrl/⌘+[ / ]` layer · `Enter` edit text · `Esc` deselect · `Ctrl/⌘+wheel` zoom · `Alt` while moving or resizing disables snapping · `Shift` while resizing toggles aspect lock.

## Export & import

An exported file contains, in this order: a strict Content-Security-Policy (no network at all), minimal CSS, the **full project JSON** (`<script type="application/json" id="ofs-project">`, safely escaped), the **3D viewer** (only when the project shows a 3D model) and the minified **playback runtime**. Links are just links: they open their address when clicked (subject to the browser), but nothing in the file depends on them to work offline. Images, video and audio are embedded as base64 data URLs and de-duplicated; unused files are pruned. At playback, video/audio are decoded once into in-memory Blobs for smooth seeking (still no network). Embedded fonts (Nunito, Inter, Space Grotesk, Fraunces — all OFL) are included only when the project uses them. The export dialog estimates the final size exactly, lists the biggest files, warns about very large exports, and refuses (with an explanation) exports that are too big for a browser to build or that reference a missing file.

Importing parses the HTML inertly (scripts are never executed), reads only the JSON payload, and validates/normalises it (unknown types, unsafe colours, non-embedded or unsupported media, wrong-kind asset references and dangling references are dropped with a warning). Files from v0.1 are migrated automatically and keep their exact appearance.

Cropped, rotated and trimmed media are embedded **whole** (edits are nondestructive metadata applied at playback), so trimming does not shrink the export — the dialog says so and estimates the bytes outside your trims.

“Optimised” export downsizes raster images to 1920 px and re-encodes them (WebP, or JPEG for opaque images) when that is smaller. Animated GIF/WebP/PNG, video and audio are never re-encoded. The optimised images become the project’s images when the file is re-imported.

## Architecture (short)

```
src/model     project types, factories, validation (schema v4), themes,
              nondestructive media edits, link and GLB checks
src/runtime   playback engine: element renderers + registries for triggers,
              actions, animations, drag modes; player for slides & pages;
              model3d/ = the separately bundled three.js 3D viewer add-on
src/io        export (standalone HTML), import, assets, IndexedDB drafts,
              capture (screenshots, recordings), WebM seek-index fixer
src/editor    React UI: store (undo/redo), canvas, panels, inspector, behaviors;
              start/ (start screen, template gallery, Learn hub),
              learn/ (the coach: template guides and lessons — editor only)
src/templates project templates (registry, factories, original artwork)
src/examples  example projects + original SVG artwork
build/        Vite plugins (runtime-as-string, single-file build)
```

The **same runtime code** renders the editor canvas, runs Preview, and is bundled (via esbuild, `virtual:ofs-runtime`) into every exported file. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SCHEMA.md](docs/SCHEMA.md) and [docs/EXTENDING.md](docs/EXTENDING.md).

## Testing

- **Unit** (`tests/unit`): v0.5 — every template builds a valid project with no validator warnings, meaningful element names, guide targets that exist, independent copies with fresh ids (the original never changes), restyles in all four themes, exports and re-imports identically and plays in the runtime; the event template's sample date is always a Saturday noon three to four weeks ahead in the viewer's time zone; every lesson's practice project is valid and its step checks start undone and pass on the real edits; coach state (events since a step started, sticky “Mark as done”, a throwing check never breaks it, completion recorded); lesson progress in localStorage, in memory when storage is blocked, corrupt data ignored; the 3D zoom direction (`zoomedDistance`, button wiring, no `dollyIn/Out`), Puff's artwork, the thumbnail list's padding invariant, focus leaving an outgoing slide, and that the exported runtime contains no coach/lesson/template code. v0.4 — key ids and matching (modifiers, repeat, Ctrl/⌘ refusal, typing targets), link normalisation and rejection of unsafe schemes, page/project/element key rules on the right slide only, precedence over navigation, list-order semantics, “slide opens”/“after a delay” (with cancellation), listener cleanup, Open link (validated at runtime too, `noopener,noreferrer`), schema v4 validation and migration, floaty/weighted physics (tilt and settling, grab-point rotation, inertia, bounds, cancellation, cleanup) and rigid regressions, GLB inspection (external files, Draco/meshopt, truncation, text glTF), model asset import and kind-checking, conditional 3D add-on bundling and round trips, the model element's states/actions/cleanup, Image placeholder insertion/replacement/undo; media edits (sanitising, rotation/flip/crop geometry, trim bounds, library vs element precedence, v2→v3 migration, export/import round trips), crop/trim editor maths, capture lifecycle against injected fake browser APIs (capability detection, format choice, countdown/pause/resume/stop/cancel, permission failures, track release, screen + webcam pairing, screenshots), edited-media rendering and trimmed playback in the runtime, the ported WebM seek-index fixer; schema validation and the v1→v2 migration (with real v0.1 exports in `tests/fixtures/v0.1`), themes (completeness, WCAG contrast, provenance, switching, overrides), serialisation/escaping, export ↔ import round trips, media assets (MIME, GIF animation detection, no re-encoding), charts, tables, CSV, countdown time-zone/DST maths and completion, quiz scoring/retry/reset, interactions, variables, all components in all four themes, store undo/redo and editing operations.
- **End-to-end** (`tests/e2e`): `v05.spec.ts` runs the v0.5 user workflows in the real UI — *A* a new user picks Feature Walkthrough from the gallery, edits the title, uploads a screenshot (and replaces the other copies in one step), previews and exports while the quick-start checklist ticks itself; *B* a beginner does Lesson 1 end to end (spotlighted controls, success checks, preview), the lesson is remembered after a reload and the user's own draft is untouched; *C* Event Announcement: switch style, rename, set the countdown date, export; *D* a blank project never shows guides. Every template is exported, opened **offline from `file://`**, exercised (clickable callouts, agenda links, quiz, number keys and Space steps with a variable, the before/after slider and scrolling story, the present and three wishes, countdown) with zero network requests and no errors, and re-imported. Also: the gallery filter, template Preview (style switching, nothing saved), lessons 2, 3 (export + re-import noticed), 4 and 7, Back/Next/Skip/minimise/restart/exit and keyboard use, and lessons with browser storage blocked. `v05-fixes.spec.ts` checks the 3D **+/−** buttons by measuring how much of the viewer the model covers (Preview and the offline export), Reset view, the first slide's selection ring by pixel colour, and Puff's artwork. `v4.spec.ts` builds or opens each v0.4 feature in the editor, exports it, and checks it **offline from `file://`**: the Image placeholder flow (no file picker on insert; upload, library and in-place replacement, undo), a slide key rule made with the key picker (Preview and export; ignored while typing), Link buttons (opens a new tab at the right address without `window.opener`; a tampered `javascript:` link is never run and is removed on re-import), the technical explainer (keyboard stepping, R/number keys, delayed reveal, floaty tilt-and-settle and weighted rotation measured from the element's transform, project-wide H key) and the 3D explorer, where WebGL rendering is verified by **counting rendered pixels** in screenshots (Chromium's SwiftShader), orbit/zoom/part buttons/reset change the picture without moving the element, and only one GPU context exists per visible viewer. `capture.spec.ts` runs every capture source through the real `getUserMedia`/`getDisplayMedia` → `MediaRecorder` pipeline with Chromium's **fake devices** (the native permission prompt and screen picker are bypassed — see the manual checklist in [docs/CAPTURE.md](docs/CAPTURE.md)): screenshots with crop/rotate, photos, voice with pause/resume and trim, screen recording with cancel, browser “Stop sharing” and offline export, screen + webcam picture-in-picture, denied permissions, and that no camera/microphone/screen track is left running. `edits-export.spec.ts` exports cropped/rotated/trimmed media, opens the file from disk offline, checks crops by **pixel colour**, trims by **playback timing**, media actions within trims, then re-imports and keeps editing. For each example and each new component (video, audio, GIF, chart, table, countdown, quiz) and each of the four themes, the test builds or opens the project, exports through the real UI, opens the downloaded file from disk via `file://` in an **offline** browser context, asserts **zero network requests** and no script errors, exercises the behaviour (media really plays, tooltips, sorting, quiz scoring, countdown ticking…), then re-imports the file and compares the project. Further tests cover editing, undo/redo, the context menu, building interactions, sections, uploads, optimised export, theme switching and v0.1 imports, and draft persistence.

## Known limitations

- Templates and lessons are in English and built in; there is no template marketplace or download (by design). Lesson checks look at what changed in the project, so a step done in an unusual way may need “Skip step” (or “Mark as done” in a template checklist). The quick-start checklist belongs to the session: it is not shown again after a reload. Lesson progress lives in this browser only.
- Capture needs a secure page (https:// or localhost) and desktop-class browser APIs; screen capture is not available on most phones/tablets, and system/tab audio depends on browser and OS (details in [docs/CAPTURE.md](docs/CAPTURE.md)). Recording formats follow the browser (WebM in Chromium/Firefox, MP4 in Safari). Automated capture tests use Chromium's fake devices; real devices and the native screen picker are verified manually.
- Media edits are nondestructive: trimming doesn't reduce the exported size, and the edit tools are deliberately simple (no splitting, effects, transitions or multitrack). Trimmed sounds using the browser's own ("Browser" style) player show the whole timeline but play and seek only the trimmed part.
- Video and audio are embedded as-is (no transcoding). Use browser-friendly formats: H.264 MP4 or VP9 WebM for video, MP3/M4A for audio. Large media makes large files (the export dialog shows the size); about 150 MB per file and ~450 MB per export are the practical limits. Media playback is tested in Chromium; Safari/Firefox support depends on the codec.
- Browsers block sound from starting automatically: autoplay with sound shows a play button instead (muted autoplay works).
- The quiz supports one correct answer per question.

- Desktop-first editor (min. width ~1024 px). Exported webpages **scale down** proportionally on small screens rather than re-flowing into a mobile layout.
- Fonts other than the embedded “Friendly” (Nunito) font use system font stacks, so text can render slightly differently between operating systems.
- Resizing rotated elements works, but alignment/snapping uses unrotated bounding boxes, and resizing only snaps for unrotated elements.
- Only number variables and one condition type (variable comparison); no variable-change triggers. Keyboard shortcuts use Shift/Alt only (Ctrl/⌘ belong to the browser), and same-tab links in the editor's Preview open in a new tab so the editor stays open.
- 3D: binary glTF (GLB) only, with everything embedded; compressed models (Draco, meshopt, KTX2) and separate texture files are refused with an explanation. Built-in model animations are not played. The editor canvas shows a still of the model (Preview to interact). Large or very detailed models make big files and can be slow on older devices. Viewer rendering is verified in Chromium (software WebGL); other browsers rely on their WebGL support.
- Floaty/weighted drag positions are per viewing session (like rigid dragging) and are never saved into the file.
- Drafts live in this browser’s storage only; export to keep a durable copy. Very large images can make files big (use “Optimised”).
- No timelines, collaboration, or custom code (by design).

## License

MIT for the code. Bundled fonts: Nunito, Inter, Space Grotesk and Fraunces (all SIL Open Font License 1.1). All artwork and example media (`src/examples/art*.ts`, `src/templates/art.ts`, `src/examples/media/`, generated by `scripts/make-example-media.py` and `scripts/make-example-model.mjs`) is original. The 3D viewer uses three.js (MIT).
