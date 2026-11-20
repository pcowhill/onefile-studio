# Promotional videos (v0.6)

The landing page's main product video and the six showcase clips are generated from the **real application** by scripts in `video/`. Nothing is recorded by hand, nothing is mocked: every frame of app footage comes from the built editor (`dist-site/studio/`) or from genuine exported OneFiles opened from disk in an offline browser.

```bash
npm run video          # build:site → capture → render (about 20 minutes, mostly the 3D scene)
# or step by step:
npm run build:site
npm run video:capture                    # all scenes
npm run video:capture -- hero event-play # just some scenes
npm run video:render                     # all storyboards
npm run video:render -- hero             # just one
```

Outputs (committed, served by the site):

| File | What |
| --- | --- |
| `site/public/media/hero.mp4` · `.webp` · `.vtt` | main video (~43 s, 1920×1080), poster, captions |
| `site/public/media/showcase/<id>.mp4` · `.webp` | one ~15 s looping clip (1280×720) and poster per showcase |
| `site/public/media/templates/<id>.webp` | 640×360 pictures of five templates (from the gallery's own Preview) |

Raw footage lives in `video/.cache/` (git-ignored, ~300 MB): it is reproducible, so it is not committed.

## Requirements

- Node 22.18+ (the scripts are TypeScript run directly by Node's type stripping — no build step).
- Chromium for Playwright (pre-installed in this environment; elsewhere `npx playwright install chromium`).
- **FFmpeg** with libx264 and libwebp on the `PATH` (tested with 6.1). Encoding uses H.264 High, `yuv420p`, `+faststart`, no audio — plays in every current browser.
- No GPU is needed. Tested on a 4-core Linux container.

## How it works

### 1. Capture (`video/capture.ts`, `video/scenes/*`)

Each scene is a Playwright script that drives the real UI the way a person would, using the same `data-testid`s as the end-to-end tests:

- **Viewport** 1440×810 CSS px at device scale 4/3, so frames are exactly **1920×1080** and the editor's text is large enough to read.
- **Real-time capture** uses the Chrome DevTools screencast (`Page.startScreencast`, JPEG q92): a frame arrives whenever the page repaints, with its timestamp. The footage keeps true timing (animations, typing, transitions) at 25–60 fps.
- **Virtual-time capture** is used for the 3D explorer, because software WebGL renders far below real time: `page.clock.install()` freezes the page clock (including `requestAnimationFrame`), and the scene advances it exactly 1/30 s at a time and screenshots each frame (`VirtualHand`). The result is smooth 30 fps footage however slow the machine.
- A visible **pointer** (headless browsers draw none) is injected as a fixed, `pointer-events: none` element outside `<body>`; it follows the real mouse events and shows a ring on each press. Pointer movement is eased along a slight arc, with short pauses — no jittery robot moves.
- Scenes drop **named marks** (`rec.mark('exportDialog')`) so storyboards cut by meaning rather than by hard-coded seconds; re-capturing on a faster or slower machine keeps the edit intact.
- Showcase footage opens `dist-site/showcase/<id>.html` **from disk via file:// with the network off**, and the editor via `studio/?open=<id>` — exactly what the landing page's “Try it” and “Open in editor” do.
- The event's weekly countdown would read “Doors are open” on Friday evenings, so recordings pin the page clock to a Tuesday afternoon and let it run (`pinClock`): the countdown in the footage is genuinely ticking.

| Scene | Footage |
| --- | --- |
| `hero` | a project built from a blank slide (title, theme background, heading, star dragged and resized, *when clicked → spin*, live theme switching), Preview, Export → Download; then the downloaded `Launch-Party.html` opened offline from disk |
| `<showcase>-play` | the exported OneFile responding: Puff's score and win banner, the before/after slider and journal, orbiting the rover and flying the camera to parts, stepping the diagram with → / Space and dragging, the video/chart tooltips/sortable table, the countdown and RSVP |
| `<showcase>-edit` | the same project in the editor with the element (or slide) that makes it interactive selected and its inspector open |
| `templates` | thumbnails of five templates, played in the template gallery's Preview |

### 2. Compose and encode (`video/render.ts`, `video/compositor/`, `video/storyboards.ts`)

A storyboard is data: shots (`clip` of a recording from a mark at a speed, with an optional camera — centre + zoom keyframes — and a frame style: full-bleed, app window, or a browser window with an address bar and “Offline” badge), captions, an opening headline, the step rail (Create · Interact · Export · Share), a “one file” graphic and the closing card.

The **compositor** is an HTML page (`video/compositor/index.html` + `compositor.ts`, bundled with esbuild) that lays out the storyboard at any time *t* as a pure function of *t* — no CSS animations or transitions — and picks for every clip the newest captured frame at or before the source time. `render.ts` steps *t* at 30 fps, screenshots each frame (JPEG q94) and pipes it into FFmpeg; clips are scaled to 1280×720 with Lanczos. The poster is a frame of the finished video (WebP), and the main video's WebVTT captions are generated from the same caption data.

Fonts are the product's own (Nunito, Inter, Fraunces from `@fontsource-variable`). Graphics are original SVG. Speeds above 1× are used to keep the pace up; footage is cut and sped up but never staged or simulated, and every caption describes what the footage really shows.

## Changing the videos

- **Edit the cut**: change `video/storyboards.ts` and re-render (`npm run video:render -- hero`). Renders take ~1 minute per clip and ~3.5 minutes for the main video.
- **Change what happens on screen**: edit the scene in `video/scenes/`, re-capture only that scene, then re-render.
- **Chapters**: the main video's chapter times live in `video/chapters.ts`; the landing page's chapter buttons must match (a unit test checks).
- The committed outputs are verified by `tests/unit/siteMedia.test.ts` (MP4 boxes: H.264 High, size, duration, fast start; posters; captions; template thumbnails) and by the landing-page end-to-end test, which plays the videos in Chromium and checks they decode to real pictures.
