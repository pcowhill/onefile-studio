# Project schema (v5)

Projects are plain JSON. TypeScript definitions: `src/model/types.ts`. Validation: `src/model/validate.ts`.

```jsonc
{
  "schema": "onefile-studio/project",  // required, identifies the format
  "version": 5,                         // schema version; newer versions are rejected, older ones migrated
  "id": "prj_…",
  "kind": "slides" | "page",
  "meta": { "title": "…", "createdAt": "ISO", "updatedAt": "ISO" },
  "settings": {
    "width": 1280,          // slides: logical canvas width; page: content column width (1000)
    "height": 720,          // slides: canvas height; page: default height of new sections
    "transition": "fade" | "slide" | "none",
    "showNavigation": true, // built-in prev/next controls (slides)
    "backdrop": "#1b1834",  // letterbox / page edge colour
    "theme": "playful" | "professional" | "technical" | "editorial",   // v2
    "backdropThemed": true  // v2: backdrop follows the theme (false = author's choice)
  },
  "pages": [ /* Page */ ],
  "variables": [ { "id": "var_…", "name": "Score", "type": "number", "initial": 0 } ],
  "assets": { "as_…": { "id", "name", "mime", "data": "data:<mime>;base64,…", "width", "height", "bytes", "hash", "duration"?, "animated"?, "edit"? } },
  "interactions": [ /* Interaction — v4, project-wide keyboard shortcuts (trigger "key" only) */ ]   // optional
}
```

Assets are always embedded base64 `data:` URLs. Accepted MIME types: images (`png`, `jpeg`, `gif`, `webp`, `svg+xml`, `avif`, `bmp`), video (`video/mp4`, `video/webm`, `video/ogg`), audio (`audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/mp4`, `audio/aac`, `audio/webm`, `audio/flac`) and, from v4, 3D models (`model/gltf-binary`, i.e. GLB; the header is checked on import, the full structure on upload — see _3D models_ below). `duration` (seconds) is set for media, `animated: true` marks animated GIFs (never re-encoded). `edit` (v3) is the media library's nondestructive edit of the file — see _Media edits_ below. Asset references are kind-checked on import: an image prop can only point at an image, a video element at a video, and so on.

## Page

```jsonc
{
  "id": "pg_…",
  "name": "Intro",
  "background": {
    "paint": { "kind": "solid", "color": "#fff" } | { "kind": "linear", "from": "#…", "to": "#…", "angle": 135 },
    "imageId": "as_…", "imageFit": "cover" | "contain", "imageDim": 0.3   // optional
  },
  "role": "hero",         // v2: theme background slot: base | alt | hero | dark | accent
  "themed": true,         // v2: paint follows the theme (false/absent = author's choice)
  "height": 560,          // sections (kind = page) only
  "elements": [ /* SceneElement, back to front */ ],
  "interactions": [ /* Interaction — v4, page-level: triggers "key", "pageStart", "pageTimer" */ ]   // optional
}
```

## SceneElement

```jsonc
{
  "id": "el_…", "type": "text", "name": "Text 1",
  "x": 100, "y": 100, "w": 240, "h": 120, "rotation": 0,   // logical px, page-local
  "hidden": false,     // hidden at start of playback (ghosted in the editor)
  "locked": false,
  "props": { … },      // type-specific, see below
  "interactions": [ /* Interaction */ ],
  "entrance": { "preset": "fadeIn", "duration": 600, "delay": 0, "direction": "up" } | null,
  "drag": { "mode": "rigid" | "floaty" | "weighted", "amount"?: 0.5, "settle"?: 0.5 } | null,   // v4: physics modes and their feel (0..1)
  "role": "heading",                 // v2: theme style slot (see below)
  "themed": ["color", "font", "weight", "letterSpacing", "background", "radius"]   // v2
}
```

### Themes and provenance (v2)

Props always hold **resolved values** — the runtime and exported files never look anything up in a theme, so a file can never change appearance on its own. `themed` lists the prop keys that _follow_ the project theme; every key not listed is an explicit author choice. When the theme changes, the editor rewrites only the themed keys (with the values `src/model/theme/mappers.ts` derives from the theme tokens for the element's `type` + `role`). Editing a prop in the inspector removes it from `themed`; "Reset to theme" adds it back. Customisation is never inferred by comparing values with a theme.

Roles: text `heading`, `subheading`, `body`, `caption`, `kicker`, `label`, `display`, `displaySub`, `score`, `quote`; shape `tone0`–`tone5`, `accent`, `card`, `soft`, `line`; button/navButton `primary`, `secondary`, `hero`, `heroGhost`; progress `onHero`. Other types have one implicit role.

Element types and their props (defaults in each `src/runtime/elements/*.ts`):

| type             | props                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`           | `text` (supports `{Variable name}` tokens), `font`, `size`, `weight`, `color`, `align`, `valign`, `lineHeight`, `italic`, `letterSpacing`, `background`, `padding`, `radius`, `shadow`                                                                                                                                                                                |
| `image`          | `assetId`, `fit`, `radius`, `borderWidth`, `borderColor`, `shadow`, `alt`, `edit` (v3)                                                                                                                                                                                                                                                                                |
| `shape`          | `shape` (`rect`, `ellipse`, `triangle`, `diamond`, `star`, `heart`, `hexagon`, `blob`), `fill` (Paint), `stroke`, `strokeWidth`, `radius`, `shadow`, `opacity`                                                                                                                                                                                                        |
| `arrow`          | `color`, `width`, `start`/`end` (`{x,y}` normalised to the box), `bend` (-1..1), `head`, `tail`, `dashed`                                                                                                                                                                                                                                                             |
| `button`         | `label`, `variant`, `color`, `size`, `radius`, `icon`, `iconSide`, `font`, `shadow`                                                                                                                                                                                                                                                                                   |
| `navButton`      | button props + `target` (`next`, `prev`, `first`, `last` or a page id)                                                                                                                                                                                                                                                                                                |
| `beforeAfter`    | `before`, `after` (asset ids), `position`, `orientation`, `handle`, `accent`, `showLabels`, `beforeLabel`, `afterLabel`, `radius`, `shadow`                                                                                                                                                                                                                           |
| `gallery`        | `images` (asset ids), `loop`, `transition`, `advanceOnClick`, `controls`, `fit`, `radius`, `shadow`, `autoplay` (s), `background`                                                                                                                                                                                                                                     |
| `scrollText`     | `title`, `text` (mini-markdown: blank line, `- `, `# `, `**bold**`), `font`, `size`, `color`, `background`, `accent`, `padding`, `radius`, `borderWidth`, `borderColor`, `lineHeight`, `fadeEdges`, `shadow`                                                                                                                                                          |
| `progress`       | `source` (`slides`, `scroll`, `variable`), `variableId`, `max`, `style` (`bar`, `ring`), `fill`, `track`, `label`, `labelColor`, `font` (v2)                                                                                                                                                                                                                          |
| `video` (v2)     | `assetId` (video), `posterId` (image), `fit`, `controls`, `autoplay`, `loop`, `muted`, `frame` (`none`, `border`, `browser`), `radius`, `shadow`, `background`, `accent`, `borderColor`, `alt`, `edit` (v3: crop/trim)                                                                                                                                                |
| `audio` (v2)     | `assetId` (audio), `title`, `style` (`player`, `compact`, `native`), `autoplay`, `loop`, `volume` (0–100), `font`, `accent`, `background`, `color`, `borderColor`, `radius`, `shadow`, `edit` (v3: trim)                                                                                                                                                              |
| `chart` (v2)     | `chartType` (`bar`, `line`), `title`, `labels` (string[]), `series` ([{ `name`, `values`: number[] }]), `palette` (colours), `preset` (`clean`, `soft`, `bold`), `showLegend`, `legendToggle`, `showValues`, `showGrid`, `xLabel`, `yLabel`, `valuePrefix`, `valueSuffix`, `font`, `textColor`, `mutedColor`, `gridColor`, `background`, `radius`, `shadow`           |
| `table` (v2)     | `rows` (string[][]; row 0 is the header when `headerRow`), `headerRow`, `columnAlign` (`auto`, `left`, `center`, `right` per column), `preset` (`lined`, `boxed`, `minimal`), `striped`, `hoverHighlight`, `sortable`, `size`, `font`, `textColor`, `headerBg`, `headerText`, `stripe`, `borderColor`, `background`, `accent`, `radius`, `shadow`                     |
| `countdown` (v2) | `target` (ISO-8601 UTC instant), `timezone` (IANA), `repeat` (`none`, `daily`, `weekly`), `holdMinutes`, `showDays`/`showHours`/`showMinutes`/`showSeconds`, `style` (`cards`, `digital`, `inline`), `showLabels`, `title`, `doneText`, `font`, `labelFont`, `color`, `accent`, `cardBg`, `cardText`, `labelColor`, `radius`, `shadow`                                |
| `model` (v4)     | `assetId` (GLB model), `alt`, `lighting` (`studio`, `soft`, `dramatic`), `backdrop` (`gradient`, `solid`, `none`), `background`, `accent`, `autoRotate`, `rotateSpeed` (0.2–3), `allowRotate`, `allowZoom`, `allowPan`, `controls` (reset/zoom/fullscreen overlay), `groundShadow`, `yaw`/`pitch` (starting view, degrees), `zoom` (0.4–2.5), `radius`, `shadow`      |
| `quiz` (v2)      | `question`, `choices` (2–10 strings), `correct` (index), `layout` (`list`, `grid`, `pills`), `showLetters`, `feedbackCorrect`, `feedbackIncorrect`, `allowRetry`, `revealAnswer`, `scoreVariable` (variable id), `points`, `firstTryOnly`, `font`, `headingFont`, `color`, `background`, `accent`, `choiceBg`, `borderColor`, `success`, `danger`, `radius`, `shadow` |

Shadows: `none`, `subtle`, `soft`, `lifted`, `glow`. Fonts: `rounded` (Nunito), `modern` (Inter), `grotesk` (Space Grotesk), `elegant` (Fraunces) — embedded, OFL — plus system stacks `sans`, `serif`, `mono`, `hand`.

## Interaction

```jsonc
{
  "id": "ix_…",
  "trigger": "click" | "rightclick" | "dblclick" | "hover"
           | "quizCorrect" | "quizIncorrect" | "quizAnswered"   // quiz only (v2)
           | "countdownDone"                                    // countdown only (v2)
           | "mediaEnded"                                       // video/audio only (v2)
           | "key"                                              // v4: elements, pages and the project
           | "pageStart" | "pageTimer",                         // v4: pages only
  "options": { "key": "Space", "shift": true, "alt": false, "repeat": false } | { "seconds": 3 },   // v4, trigger settings
  "conditions": [ { "id", "type": "variable", "variableId": "var_…", "op": "eq|neq|lt|lte|gt|gte", "value": 10 } ],  // all must pass
  "actions": [ { "id", "type": "…", "params": { … }, "together"?: true } ]   // steps, in order (v5: see below)
}
```

Interactions with the same trigger on one element run in list order; each checks its conditions when it starts.

### Steps and Together groups (v5)

`actions` is one flat, ordered list. An action with `"together": true` **starts together with the action before it**, so the list reads as a sequence of _steps_ (`toSteps()` in `src/model/actionSteps.ts`):

```jsonc
"actions": [
  { "id": "ac_1", "type": "show", "params": { "target": "el_a", "effect": "pop" } },
  { "id": "ac_2", "type": "show", "params": { "target": "el_b", "effect": "pop" }, "together": true },
  { "id": "ac_3", "type": "show", "params": { "target": "el_c", "effect": "pop" }, "together": true },
  { "id": "ac_4", "type": "wait", "params": { "seconds": 0.5 } },
  { "id": "ac_5", "type": "show", "params": { "target": "el_done", "effect": "fade" } }
]
// → steps: [ac_1 + ac_2 + ac_3] → [ac_4] → [ac_5]
```

Semantics (`runInteraction()` in `src/runtime/actions.ts`):

- Steps run one after another: a step starts when **every** action of the previous step has finished ("Then" / "After these finish").
- The actions of one step are all **started at once, in list order, in the same task** (nothing is awaited while starting them), so their animations begin in the same frame and a link in the group still counts as opened by the viewer's click.
- When an action counts as _finished_: `show`/`hide`/`toggle` with an effect — when the effect ends (instantly without one); `wait` — when the time is up (so a Wait inside a group makes the group last at least that long); `animate` — immediately, unless its `wait` param is true (then when the animation ends; the editor calls this “and wait until it ends”); every other action — immediately.
- Errors: a failing action is logged and skipped; the rest of its group and the following steps still run (the same policy as before v5).
- Conflicts are deterministic: actions in a group start top to bottom, so synchronous effects apply in list order and **the lower action has the last word** (e.g. `varSet` after `varAdd`; `hide` after `show` of the same element ends hidden). The editor points such groups out. `navigate` happens as soon as it starts; to let the rest of a group finish first, put it in its own step after the group.
- Re-triggering while a run is in progress starts another, independent run (as before). When the player is destroyed (Preview closed, project closed), the remaining steps of running interactions are skipped; actions on elements of a slide that was left simply have nothing to act on.

Validation keeps `together` only when it is the boolean `true`, never on the first kept action (nothing to join; e.g. after an unsupported first action was dropped), and **only in v5+ files**: a `together` key in an older file is ignored, so an older project never starts running actions in parallel.

| action `type`                                                                                            | params                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `show`, `hide`, `toggle`                                                                                 | `target` (element id or `@self`), `effect` (`none`, `fade`, `pop`, `slide`)                                                                                                                    |
| `navigate`                                                                                               | `page` (`next`, `prev`, `first`, `last` or page id)                                                                                                                                            |
| `varAdd`, `varSubtract`                                                                                  | `variable`, `amount`                                                                                                                                                                           |
| `varSet`                                                                                                 | `variable`, `value`                                                                                                                                                                            |
| `varReset`                                                                                               | `variable` (or `@all`)                                                                                                                                                                         |
| `gallery`                                                                                                | `target`, `direction` (`next`, `prev`, `first`)                                                                                                                                                |
| `animate`                                                                                                | `target`, `preset` (`pop`, `bounce`, `shake`, `wiggle`, `pulse`, `spin`), optional `duration`, `wait`                                                                                          |
| `wait`                                                                                                   | `seconds`                                                                                                                                                                                      |
| `mediaPlay`, `mediaPause`, `mediaRestart` (v2), `mediaToggle` (v3: play when paused, pause when playing) | `target` (a video or audio element)                                                                                                                                                            |
| `quizReset` (v2)                                                                                         | `target` (a quiz; works for quizzes on other slides too)                                                                                                                                       |
| `openLink` (v4)                                                                                          | `url` (http, https, mailto or tel — anything else is removed on import and refused at playback), `newTab` (default true; opens with `noopener,noreferrer`), optional `label` (accessible name) |
| `modelView` (v4)                                                                                         | `target` (a 3D model), `view` (`reset`, `front`, `back`, `left`, `right`, `top`)                                                                                                               |
| `modelSpin` (v4)                                                                                         | `target` (a 3D model), `mode` (`toggle`, `start`, `stop`)                                                                                                                                      |

### Triggers with options and owners (v4)

Interactions live on elements (`element.interactions`), on a page (`page.interactions`) or on the project (`project.interactions`). Which triggers each owner may use is part of the trigger definition (`owners` in `src/runtime/triggers.ts`); the validator drops anything else with a warning.

- **`key`** — `options.key` is a key id: a lowercase letter (`"k"`), a digit (`"1"`), a named key (`Space`, `Enter`, `Escape`, `ArrowLeft`/`Right`/`Up`/`Down`, `Backspace`, `Delete`, `Home`, `End`, `PageUp`, `PageDown`) or one of `+ - = ? / . , * [ ]`; `""` = not chosen yet (never fires). `shift`/`alt` must match exactly (Shift is ignored for punctuation, which needs Shift on some layouts); Ctrl/⌘ combinations never match. Auto-repeat is ignored unless `repeat` is true. Element and page keys run only while their slide/section is the current one; project keys run everywhere. A matching rule consumes the key, so it takes precedence over built-in slide navigation. Keys typed into fields, sliders and similar controls are ignored, and Enter/Space on a keyboard-focused button keep activating it.
- **`pageStart`** — each time the slide is shown / the section becomes the current one.
- **`pageTimer`** — `options.seconds` (0–600) after the page becomes current; cancelled when leaving, restarted on the next visit.

Interactions on one owner with the same trigger _and the same options_ (e.g. two rules for →) run in list order, each checking its conditions when it starts.

`countdownDone` fires once per playback session (also when the countdown is already over when it is shown), and once per occurrence for repeating countdowns.

## Media edits (v3)

Edits never change embedded bytes; they describe how to show them (`src/model/mediaEdit.ts`):

```jsonc
{
  "crop": { "x": 0.1, "y": 0, "w": 0.5, "h": 0.8 }, // images & videos: normalised 0..1 rectangle of the picture AS DISPLAYED (after rotate/flips)
  "rotate": 90, // images: 0 | 90 | 180 | 270, clockwise, applied first
  "flipH": true,
  "flipV": false, // images: mirror the rotated picture
  "trim": { "start": 1.5, "end": 9.25 }, // videos & sounds: seconds into the original file
}
```

- `asset.edit` is the **library version**: every use of the file follows it (image/video/audio elements, gallery images, before/after images, page backgrounds). Absent = the original.
- `props.edit` on `image`, `video` and `audio` elements is that element's **own edit**: `null` follows the library version; an object overrides it — `{}` means "show the original here". One file can therefore appear several times with different crops/trims while its bytes are stored once.
- Validation keeps only what a kind supports (images: crop/rotate/flips; videos: crop/trim; sounds: trim), clamps crops into the picture (min 2 % per side), orders trims (min 0.1 s, within the duration) and drops identity edits. Crops are normalised, so "Optimised" exports that downsize images keep them valid.
- Runtime: edited pictures render as an inline SVG (viewBox = crop, `preserveAspectRatio` = cover/contain, orientation matrix on the original bitmap); cropped videos use a container-query viewport; trimmed media play only their segment (start, end, segment looping, seek clamping, `mediaEnded` at the trim end). Exports embed the whole original.

## 3D models (v4)

A model asset is a binary glTF 2.0 file embedded as `data:model/gltf-binary;base64,…`. On upload `inspectGlb()` (`src/model/glb.ts`) rejects text glTF, external or data-URI buffers, external textures, multiple buffers, truncated data and required extensions that need decoders (Draco, meshopt, KTX2/Basis); optional unknown extensions are ignored. Embedded textures (PNG/JPEG/WebP/AVIF in the binary chunk) are supported. Model elements are rendered by the 3D add-on, which exports include only when at least one model element shows a model.

## Versioning

`SCHEMA_VERSION` lives in `src/model/types.ts`. When the format changes incompatibly: bump it, add a step to `migrate()` in `validate.ts` that upgrades the previous version, and add a fixture test. Files with a newer version than the editor understands are refused with a clear message.

### v4 → v5 (v0.7)

Additive only: `action.together` (Together steps, above). v4 and older files have no such flags, so every action stays its own step and runs exactly as before; `migrate()` only bumps the version (and the validator ignores stray `together` keys in pre-v5 files). The Play-animation `wait` param keeps its meaning. v0.6 editors refuse v5 exports with the "newer version" message (they would otherwise run the groups one after another); the exported files themselves embed their own runtime and play anywhere.

### v0.5 (no schema change)

v0.5 adds templates and lessons without changing the format: templates are ordinary v4 projects (see _Templates_ in [ARCHITECTURE.md](ARCHITECTURE.md)), and the quick-start guide and lesson state live only in the editor (lesson progress in `localStorage`), never in project files. v0.4 editors open v0.5 exports, and every older file opens unchanged.

### v3 → v4

Additive only: page/project `interactions`, `interaction.options`, the `key`/`pageStart`/`pageTimer` triggers, the `openLink`/`modelView`/`modelSpin` actions, `floaty`/`weighted` drag modes with `amount`/`settle`, GLB assets and the `model` element. v3 files need no changes and look identical. v0.3 editors refuse v4 exports with the "newer version" message; the exported files themselves keep working anywhere.

### v2 → v3

No data changes: v2 files have no edits. Elements get `edit: null` from the registry defaults (follow the library), assets no `edit`. Exports from v0.3 are refused by v0.2 editors with the "newer version" message (they would otherwise drop the edits); the exported files themselves embed their own runtime and play anywhere.

### v1 → v2

`migrate()` sets `settings.theme = "playful"` (the original look) and `backdropThemed = false`. Elements and backgrounds get no `themed` keys, so **every v1 value is treated as an explicit choice** and nothing changes appearance — not even after switching theme. Authors can opt in with "Restyle everything" in the theme dialog, which infers sensible roles (e.g. large text on a dark slide → `display`). New props introduced in v2 (e.g. `progress.font`) are filled with defaults that match v1 rendering. Real v0.1 exports live in `tests/fixtures/v0.1/` and are covered by unit and e2e tests. Exported files embed their own runtime, so historical exports keep working exactly as they were.
