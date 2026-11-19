# Project schema (v1)

Projects are plain JSON. TypeScript definitions: `src/model/types.ts`. Validation: `src/model/validate.ts`.

```jsonc
{
  "schema": "onefile-studio/project",  // required, identifies the format
  "version": 1,                         // schema version; newer versions are rejected, older ones migrated
  "id": "prj_…",
  "kind": "slides" | "page",
  "meta": { "title": "…", "createdAt": "ISO", "updatedAt": "ISO" },
  "settings": {
    "width": 1280,          // slides: logical canvas width; page: content column width (1000)
    "height": 720,          // slides: canvas height; page: default height of new sections
    "transition": "fade" | "slide" | "none",
    "showNavigation": true, // built-in prev/next controls (slides)
    "backdrop": "#1b1834"   // letterbox / page edge colour
  },
  "pages": [ /* Page */ ],
  "variables": [ { "id": "var_…", "name": "Score", "type": "number", "initial": 0 } ],
  "assets": { "as_…": { "id", "name", "mime", "data": "data:image/png;base64,…", "width", "height", "bytes", "hash" } }
}
```

## Page

```jsonc
{
  "id": "pg_…",
  "name": "Intro",
  "background": {
    "paint": { "kind": "solid", "color": "#fff" } | { "kind": "linear", "from": "#…", "to": "#…", "angle": 135 },
    "imageId": "as_…", "imageFit": "cover" | "contain", "imageDim": 0.3   // optional
  },
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
  "drag": { "mode": "rigid" } | null
}
```

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
| `progress` | `source` (`slides`, `scroll`, `variable`), `variableId`, `max`, `style` (`bar`, `ring`), `fill`, `track`, `label`, `labelColor` |

## Interaction

```jsonc
{
  "id": "ix_…",
  "trigger": "click" | "rightclick" | "dblclick" | "hover",
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

## Versioning

`SCHEMA_VERSION` lives in `src/model/types.ts`. When the format changes incompatibly: bump it, add a step to `migrate()` in `validate.ts` that upgrades the previous version, and add a fixture test. Files with a newer version than the editor understands are refused with a clear message.
