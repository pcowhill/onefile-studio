# Capture & media editing (v0.3)

OneFile Studio can capture screenshots, photos and recordings right in the browser and make quick, **nondestructive** adjustments to any picture, video or sound — without leaving the editor.

## Capturing

Open **Media** in the left rail. Under **Upload** (drop files or _Choose files_) you'll find **Capture**:

| Card                | What happens                                                                                                                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screenshot**      | The browser asks which screen, window or tab to share. One frame is taken at the source's full resolution (lossless PNG) after real frames arrive — never the blank first frame — and the share is released immediately.                                                   |
| **Record screen**   | Pick what to share (tick _Share audio_ in Chromium to include its sound), a 3-second countdown (_Start now_ skips it), then record with **Pause / Resume / Stop / Cancel**. The browser's own _Stop sharing_ button ends the take like _Stop_.                             |
| **Record webcam**   | Camera + microphone, with a mirrored self-view. No microphone? It records silently and says so.                                                                                                                                                                            |
| **Webcam photo**    | Live preview and a **Take photo** button. Nothing is saved until you take it.                                                                                                                                                                                              |
| **Record voice**    | Microphone only, with a live level meter.                                                                                                                                                                                                                                  |
| **Screen + webcam** | Records both at once as **two separate videos** (the microphone travels with the webcam video). _Insert both_ places the webcam as a picture-in-picture in the corner of the screen recording; clicking either plays or pauses both. _Insert screen only_ is also offered. |

After capturing, a review step shows the result. From there: **Crop & rotate / Trim & crop / Trim** (a quick edit before adding), **Insert on page**, **Save to library**, or **Retake / Record again**. Captures become ordinary media assets (the same pipeline as uploads), so they can be renamed (right-click → _Rename…_), reused, edited, exported and re-imported.

Image elements also offer **Screenshot** in the inspector ("Use a screenshot" when empty), which replaces that picture with a new capture.

### Formats

Recordings use the first container the browser's `MediaRecorder` supports: WebM (VP9/VP8 + Opus) in Chromium and Firefox, MP4 in Safari. Video-only streams never ask for an audio codec (Firefox otherwise stalls). Video keyframes are requested every second so trims and seeks stay quick, and WebM recordings get a seek index (Cues) added so Firefox can seek them. Every recording is checked to actually play before it is offered; an empty or unplayable recording is reported instead of added.

### Permissions, privacy and cleanup

Capture always goes through the browser's own permission prompts and pickers; nothing is bypassed or remembered by OneFile Studio. Camera, microphone and screen streams are stopped when a take finishes, is cancelled, fails, when the browser stops sharing, when the dialog closes (Esc, ×, backdrop), when the component unmounts and when the page is hidden/unloaded. Live previews are muted, so they never echo.

### Browser support

| Feature                      | Requirement                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| All capture                  | A secure page (`https://` or `localhost`); browsers hide capture APIs elsewhere. The single-file build opened from `file://` usually counts as secure too (Chromium, Firefox). |
| Screenshot, screen recording | `getDisplayMedia` — desktop Chrome, Edge, Firefox and Safari. Not available on most phones/tablets: the cards are disabled with the reason.                                    |
| Recordings                   | `MediaRecorder` — all current desktop browsers.                                                                                                                                |
| System / tab audio           | Depends on browser and OS: Chromium can share tab audio (and system audio on Windows/ChromeOS); Firefox and Safari share none. Recordings without audio say so.                |
| Pause / resume               | Offered only when the recorder supports it.                                                                                                                                    |

Unsupported cards are greyed out with an explanation; the rest of the editor is unaffected.

## Editing media

Edit a file from the **Media** library (the crop/scissors button on a tile, or right-click → _Crop & rotate… / Trim & crop… / Trim…_), from the inspector of an image, video or sound element, or from the canvas right-click menu.

- **Pictures:** drag the crop rectangle and its handles (Free, Original, 16:9, 4:3, 1:1), rotate 90° either way, flip horizontally/vertically. Arrow keys move the crop, Shift+arrows resize it.
- **Videos:** trim the start and end on a simple timeline (drag the purple handles, or focus one and use ←/→, Shift for 1 s) and crop the frame the same way as pictures. Play previews only the selected part.
- **Sounds:** trim the start and end over a waveform.
- **Reset to original** undoes everything; all edits are also part of normal undo/redo.

### Library version vs. one element

Edits are **nondestructive**: the original bytes always stay in the project, and an edit is a small description (`crop`, `rotate`, `flipH/flipV`, `trim`).

- Editing from the **library** changes the _library version_: every use of the file follows it (image and video elements, sounds, galleries, before/after sliders, backgrounds).
- Editing from an **element** that is the only use of the file saves the library version too. When the file is used more than once you choose **Apply to this one** (an override on that element only — the same file can appear several times with different crops or trims, stored once) or **Apply to all uses**. The inspector shows which applies and offers **Use library version** to drop an override.

Cropping an element resizes its box to the new shape (keeping its width), so there are no bars.

### Playback of edited media

Trimmed media start at the trim start, stop exactly at the trim end (firing _video/sound finishes_), loop the segment (not the file), restart to the trim start, and clamp seeking into the segment. Edited videos show a compact themed control bar (play, time within the trim, seek, mute, full screen) because the browser's native controls would show the whole file and be clipped by a crop. Crops are pure CSS/SVG and stay correct at any element size, rotation or slide scale — in the editor, Preview, exported files and re-imported projects alike.

### File size

Because edits are nondestructive, **trimming does not make the exported file smaller**: the whole original is embedded so you can change the edit after re-importing. The Export dialog says so (with an estimate of the bytes outside your trims). To shrink a long recording, trim it in a video editor and import the result. Physical trimming/compression may come in a future release.

## Manual verification checklist

Automated tests drive the real capture pipeline with Chromium's fake devices and bypass the native permission prompt and screen picker (which cannot be automated headless). Before a release, check by hand in desktop Chrome, Firefox and Safari:

1. **Screenshot** of a window and of a tab: the native picker appears; the still is sharp, full-resolution and not black; the sharing indicator disappears right after.
2. **Screen recording** with _Share audio_ on and off; pause/resume; stop via the browser's _Stop sharing_ bar.
3. **Webcam** recording and **photo** with the camera permission first denied (friendly message, _Try again_ after allowing) and then allowed; unplug/disable the microphone (silent recording notice).
4. **Voice** recording: level meter moves; the result plays; trim it.
5. **Screen + webcam**: both previews; insert both; Preview plays them together.
6. Close the dialog mid-recording and confirm the camera light / sharing indicator turns off.
7. Export a project with captured, cropped and trimmed media; open the file offline (airplane mode) in each browser; re-import it and change an edit.
