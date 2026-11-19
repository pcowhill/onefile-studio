# Project schema (v2)

Projects are plain JSON. TypeScript definitions: `src/model/types.ts`. Validation: `src/model/validate.ts`.

```jsonc
{
  "schema": "onefile-studio/project",  // required, identifies the format
  "version": 2,                         // schema version; newer versions are rejected, older ones migrated
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
  "assets": { "as_…": { "id", "name", "mime", "data": "data:<mime>;base64,…", "width", "height", "bytes", "hash", "duration"?, "animated"? } }
}
```

Assets are always embedded base64 `data:` URLs. Accepted MIME types: images (`png`, `jpeg`, `gif`, `webp`, `svg+xml`, `avif`, `bmp`), video (`video/mp4`, `video/webm`, `video/ogg`) and audio (`audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/mp4`, `audio/aac`, `audio/webm`, `audio/flac`). `duration` (seconds) is set for media, `animated: true` marks animated GIFs (never re-encoded). Asset references are kind-checked on import: an image prop can only point at an image, a video element at a video, and so on.

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
  "elements": [ /* SceneElement, back to front */ ]
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
  "drag": { "mode": "rigid" } | null,
  "role": "heading",                 // v2: theme style slot (see below)
  "themed": ["color", "font", "weight", "letterSpacing", "background", "radius"]   // v2
}
```

### Themes and provenance (v2)

Props always hold **resolved values** — the runtime and exported files never look anything up in a theme, so a file can never change appearance on its own. `themed` lists the prop keys that *follow* the project theme; every key not listed is an explicit author choice. When the theme changes, the editor rewrites only the themed keys (with the values `src/model/theme/mappers.ts` derives from the theme tokens for the element's `type` + `role`). Editing a prop in the inspector removes it from `themed`; "Reset to theme" adds it back. Customisation is never inferred by comparing values with a theme.

Roles: text `heading`, `subheading`, `body`, `caption`, `kicker`, `label`, `display`, `displaySub`, `score`, `quote`; shape `tone0`–`tone5`, `accent`, `card`, `soft`, `line`; button/navButton `primary`, `secondary`, `hero`, `heroGhost`; progress `onHero`. Other types have one implicit role.

Element types and their props (defaults in each `src/runtime/elements/*.ts`):

| type | props |
| --- | --- |
| `text` | `text` (supports `{Variable name}` tokens), `font`, `size`, `weight`, `color`, `align`, `valign`, `lineHeight`, `italic`, `letterSpacing`, `background`, `padding`, `radius`, `shadow` |
| `image` | `assetId`, `fit`, `radius`, `borderWidth`, `borderColor`, `shadow`, `alt` |
| `shape` | `shape` (`rect`, `ellipse`, `triangle`, `diamond`, `star`, `heart`, `hexagon`, `blob`), `fill` (Paint), `stroke`, `strokeWidth`, `radius`, `shadow`, `opacity` |
| `arrow` | `color`, `width`, `start`/`end` (`{x,y}` normalised to the box), `bend` (-1..1), `head`, `tail`, `dashed` |
| `button` | `label`, `variant`, `color`, `size`, `radius`, `icon`, `iconSide`, `font`, `shadow` |
| `navButton` | button props + `target` (`next`, `prev`, `first`, `last` or a page id) |
| `beforeAfter` | `before`, `after` (asset ids), `position`, `orientation`, `handle`, `accent`, `showLabels`, `beforeLabel`, `afterLabel`, `radius`, `shadow` |
| `gallery` | `images` (asset ids), `loop`, `transition`, `advanceOnClick`, `controls`, `fit`, `radius`, `shadow`, `autoplay` (s), `background` |
| `scrollText` | `title`, `text` (mini-markdown: blank line, `- `, `# `, `**bold**`), `font`, `size`, `color`, `background`, `accent`, `padding`, `radius`, `borderWidth`, `borderColor`, `lineHeight`, `fadeEdges`, `shadow` |
| `progress` | `source` (`slides`, `scroll`, `variable`), `variableId`, `max`, `style` (`bar`, `ring`), `fill`, `track`, `label`, `labelColor`, `font` (v2) |
| `video` (v2) | `assetId` (video), `posterId` (image), `fit`, `controls`, `autoplay`, `loop`, `muted`, `frame` (`none`, `border`, `browser`), `radius`, `shadow`, `background`, `accent`, `borderColor`, `alt` |
| `audio` (v2) | `assetId` (audio), `title`, `style` (`player`, `compact`, `native`), `autoplay`, `loop`, `volume` (0–100), `font`, `accent`, `background`, `color`, `borderColor`, `radius`, `shadow` |
| `chart` (v2) | `chartType` (`bar`, `line`), `title`, `labels` (string[]), `series` ([{ `name`, `values`: number[] }]), `palette` (colours), `preset` (`clean`, `soft`, `bold`), `showLegend`, `legendToggle`, `showValues`, `showGrid`, `xLabel`, `yLabel`, `valuePrefix`, `valueSuffix`, `font`, `textColor`, `mutedColor`, `gridColor`, `background`, `radius`, `shadow` |
| `table` (v2) | `rows` (string[][]; row 0 is the header when `headerRow`), `headerRow`, `columnAlign` (`auto`, `left`, `center`, `right` per column), `preset` (`lined`, `boxed`, `minimal`), `striped`, `hoverHighlight`, `sortable`, `size`, `font`, `textColor`, `headerBg`, `headerText`, `stripe`, `borderColor`, `background`, `accent`, `radius`, `shadow` |
| `countdown` (v2) | `target` (ISO-8601 UTC instant), `timezone` (IANA), `repeat` (`none`, `daily`, `weekly`), `holdMinutes`, `showDays`/`showHours`/`showMinutes`/`showSeconds`, `style` (`cards`, `digital`, `inline`), `showLabels`, `title`, `doneText`, `font`, `labelFont`, `color`, `accent`, `cardBg`, `cardText`, `labelColor`, `radius`, `shadow` |
| `quiz` (v2) | `question`, `choices` (2–10 strings), `correct` (index), `layout` (`list`, `grid`, `pills`), `showLetters`, `feedbackCorrect`, `feedbackIncorrect`, `allowRetry`, `revealAnswer`, `scoreVariable` (variable id), `points`, `firstTryOnly`, `font`, `headingFont`, `color`, `background`, `accent`, `choiceBg`, `borderColor`, `success`, `danger`, `radius`, `shadow` |

Shadows: `none`, `subtle`, `soft`, `lifted`, `glow`. Fonts: `rounded` (Nunito), `modern` (Inter), `grotesk` (Space Grotesk), `elegant` (Fraunces) — embedded, OFL — plus system stacks `sans`, `serif`, `mono`, `hand`.

## Interaction

```jsonc
{
  "id": "ix_…",
  "trigger": "click" | "rightclick" | "dblclick" | "hover"
           | "quizCorrect" | "quizIncorrect" | "quizAnswered"   // quiz only (v2)
           | "countdownDone"                                    // countdown only (v2)
           | "mediaEnded",                                      // video/audio only (v2)
  "conditions": [ { "id", "type": "variable", "variableId": "var_…", "op": "eq|neq|lt|lte|gt|gte", "value": 10 } ],  // all must pass
  "actions": [ { "id", "type": "…", "params": { … } } ]   // run in order
}
```

Interactions with the same trigger on one element run in list order; each checks its conditions when it starts.

| action `type` | params |
| --- | --- |
| `show`, `hide`, `toggle` | `target` (element id or `@self`), `effect` (`none`, `fade`, `pop`, `slide`) |
| `navigate` | `page` (`next`, `prev`, `first`, `last` or page id) |
| `varAdd`, `varSubtract` | `variable`, `amount` |
| `varSet` | `variable`, `value` |
| `varReset` | `variable` (or `@all`) |
| `gallery` | `target`, `direction` (`next`, `prev`, `first`) |
| `animate` | `target`, `preset` (`pop`, `bounce`, `shake`, `wiggle`, `pulse`, `spin`), optional `duration`, `wait` |
| `wait` | `seconds` |
| `mediaPlay`, `mediaPause`, `mediaRestart` (v2) | `target` (a video or audio element) |
| `quizReset` (v2) | `target` (a quiz; works for quizzes on other slides too) |

`countdownDone` fires once per playback session (also when the countdown is already over when it is shown), and once per occurrence for repeating countdowns.

## Versioning

`SCHEMA_VERSION` lives in `src/model/types.ts`. When the format changes incompatibly: bump it, add a step to `migrate()` in `validate.ts` that upgrades the previous version, and add a fixture test. Files with a newer version than the editor understands are refused with a clear message.

### v1 → v2

`migrate()` sets `settings.theme = "playful"` (the original look) and `backdropThemed = false`. Elements and backgrounds get no `themed` keys, so **every v1 value is treated as an explicit choice** and nothing changes appearance — not even after switching theme. Authors can opt in with "Restyle everything" in the theme dialog, which infers sensible roles (e.g. large text on a dark slide → `display`). New props introduced in v2 (e.g. `progress.font`) are filled with defaults that match v1 rendering. Real v0.1 exports live in `tests/fixtures/v0.1/` and are covered by unit and e2e tests. Exported files embed their own runtime, so historical exports keep working exactly as they were.
