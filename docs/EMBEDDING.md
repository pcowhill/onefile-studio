# Hosting and embedding the editor

OneFile Studio's editor is one self-contained file, `dist/index.html` (the same file is `dist-site/studio/index.html` on the website). Since v0.7 it **sizes itself to the element it is mounted in** — `<div id="root">` — instead of assuming it owns the whole browser window.

## 1. On its own page (standalone)

Serve or open `dist/index.html` as it is. `#root` is the whole window, so the editor fills it: toolbar on top, panels and canvas below, every panel scrolling on its own, no page scrollbar.

## 2. Inside a larger page (header / editor / footer)

A child element can't know how much height is left over after arbitrary siblings — **the host page decides how big `#root` is**, and the editor fills exactly that box. The simplest way is a flex column:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My site — OneFile Studio</title>
    <style>
      html,
      body {
        height: 100%;
        margin: 0;
      }

      .app-shell {
        height: 100dvh; /* the whole window… */
        display: flex;
        flex-direction: column; /* …split into header / editor / footer */
      }
      .header,
      .footer {
        flex: 0 0 auto;
      } /* any height, may change at any time */

      #root {
        flex: 1 1 auto; /* the editor gets whatever is left */
        min-height: 0; /* allow it to be smaller than its content (it scrolls inside) */
        min-width: 0;
      }
    </style>
    <!-- …the editor's <style> and <script> from dist/index.html go here (see below)… -->
  </head>
  <body>
    <div class="app-shell">
      <header class="header">My header</header>
      <div id="root"></div>
      <footer class="footer">My footer</footer>
    </div>
  </body>
</html>
```

**How to make it:** copy `dist/index.html`, keep everything in its `<head>` (the editor's inlined styles and script), add your CSS from above, and put your header and footer around `<div id="root"></div>` inside a `.app-shell` wrapper. Nothing else needs to change. A CSS grid works just as well:

```css
.app-shell {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
}
#root {
  min-height: 0;
}
```

**What the editor guarantees**

- It fills `#root` exactly (`height: 100%` of it) and never uses viewport units for its layout, so it never reaches under your footer or adds a page scrollbar.
- Its toolbar stays visible; the left panel, inspector, start screen and canvas scroll **inside** the editor.
- When `#root` changes size — the window is resized, your header grows, a sidebar opens — the editor re-lays itself out and re-fits the slide to the canvas (a `ResizeObserver`, no reload).
- Its page-level defaults (`html`, `body` and `#root` at 100 % height, no body margin, the light lavender background) use `:where()`, i.e. zero specificity: any rule of yours overrides them.

**Minimum constraints**

- `#root` must have a **definite height**: a flex/grid item as above, or an explicit height (`height: 600px`, `height: calc(100dvh - 120px)` …). If its height depends on its content, the editor has nothing to fill and falls back to a minimum of 360 px.
- The editor is desktop-first: its layout needs about **1024 px of width**; narrower roots scroll sideways.
- Keep the element id `root`: the editor mounts into `#root`, and there can be only one editor per page.

**Things that intentionally cover the whole window,** even when embedded: Preview, template preview, dialogs (Export, Theme, Templates, Learn, capture, media editing), menus, toasts, the file drop zone and the lesson coach when it is not docked. They are overlays, like any modal on a web page.

**Other limitations of embedding directly into another page**

- The editor's stylesheet is global CSS: besides the `:where()` defaults it defines CSS custom properties on `:root` (`--bg`, `--ink`, `--brand`, …), a `box-sizing: border-box` reset, and light base rules for `button`, `input`, `select`, `textarea`, `code`, `kbd` and `:focus-visible`. Element classes are prefixed (`ed-`, `st-`, `co-`, `ofs-`). If your page relies on the same custom property names or on different base styles, embed the editor in an `<iframe>` instead.
- Drafts are stored in the browser per origin (IndexedDB and `localStorage` keys starting with `ofs:`): two copies of the editor on the same origin share their drafts.
- Keyboard shortcuts (undo, duplicate, arrows, Delete …) listen on the document while a project is open, as on the standalone page. They ignore text fields, but a host page with its own document-level shortcuts may want to use an `<iframe>`.

## 3. In an iframe

Fully isolated from your page's styles and scripts:

```html
<iframe src="studio/index.html" title="OneFile Studio" style="width: 100%; height: 100%; border: 0"></iframe>
```

Give the iframe a size like any element (for example as the middle row of the flex column above). File downloads (Export) work from an iframe on the same origin; for capture (screenshots, camera, microphone) add `allow="camera; microphone; display-capture"`.

The behaviour above is covered by `tests/e2e/embedding.spec.ts`: a host page with a fixed header and footer at several window sizes and pixel ratios (start screen and an open project; the editor stays between them with no page scrolling; panels scroll inside), header/footer heights changed at runtime, a grid host, and the standalone page.
