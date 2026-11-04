# Gaby's Animation Studio

A kid-friendly, frame-by-frame animation maker that runs entirely in the browser. Kids draw each frame, flip through them with onion skinning, add stickers, text, effects and sounds, then export a GIF, video, PNG frames or a sprite sheet.

There's no build step, no framework and no outside libraries. It's plain HTML, CSS and JavaScript (classic scripts sharing one `GAS` namespace), so it also runs when `index.html` is opened straight from disk.

## Features

- **Drawing:** pencil, six brush styles (soft, ink, crayon, spray, fancy/calligraphy, rainbow), eraser, fill bucket with tolerance and anti-aliased edges, color picker, line tool, and eight shapes (outline, filled, or both). Size goes from 1 to 100 px, with opacity, edge softness and line smoothing. Pens are pressure-sensitive.
- **Colors:** 42-color palette, rainbow picker, HEX input, recent colors and favorites (favorites are kept in `localStorage`).
- **Frames:** add a blank frame or a copy of the current one, then delete, move, copy/paste, clear, drag-to-reorder, and set per-frame timing (×1 to ×8).
- **Playback:** play, pause, stop and step, at 1 to 30 fps, with loop and 0.5×/1×/2× preview speed, plus a big-screen preview.
- **Onion skin:** up to 3 frames before (pink) and 3 after (blue), with adjustable opacity and an optional tint.
- **Layers:** each frame has a drawing layer and an object layer. The background has a fill (color, gradient, checkers, grid or lined paper, or a picture) and a paintable background layer, both shared by all frames. Any single frame can have its own fill or its own painted background instead.
- **Objects:** 76 original SVG stickers in 11 categories, imported pictures, editable text in 8 fonts, and 10 cartoon effects. Objects can be moved, resized, rotated, flipped, made see-through, duplicated, reordered and copied to the next frame.
- **Selection:** drag a box around part of a drawing to lift it out, then move, resize or rotate it before dropping it back. Copy, cut and paste work too.
- **Sounds:** 19 sounds synthesized in code (`js/audio.js`, so no audio files are involved). WAV, MP3 and OGG files can also be imported. Each frame can have one sound with its own volume.
- **Templates:** 10 starter animations, built in code as fully editable projects.
- **Help:** a first-time tutorial, four animation guides, a keyboard shortcuts list and tooltips.
- **Saving:** `.gabyanim` project files (Save, Save As, Open) and autosave to IndexedDB. The welcome screen offers to continue the last project, and My Projects lists everything saved on the device.
- **Export:** animated GIF (custom encoder running in a Web Worker), WebM video with sound (MP4 on Safari), PNG frames as one ZIP or separate files, and sprite sheets.
- **Undo/redo:** covers strokes, fills, shapes, object changes, text and color edits, frame operations, backgrounds and canvas resizing. Pixel changes store only the rectangle that changed.

## Files

```text
index.html              Page shell; loads the scripts below in order
css/main.css            Base styles, controls, dialogs, welcome screen, export window
css/toolbar.css         Top bar, tool rail, side panel, stage
css/timeline.css        Timeline
css/responsive.css      Tablet and phone layouts
js/util.js              GAS namespace, DOM helper h(), event bus, canvas/color/file helpers
js/model.js             Project / frame / layer data model and editor state
js/undo-redo.js         History
js/icons.js             Line icons
js/stickers.js          Sticker artwork (SVG)
js/effects.js           Cartoon effects drawn with code
js/render.js            Draws backgrounds, objects and whole frames (shared by editor, playback, export)
js/canvas.js            Editor view: stacked canvases, zoom, pan, pinch, pointer routing
js/onion-skin.js        Onion skin
js/drawing-tools.js     Brush engine, shapes, flood fill, color picker tool
js/selection.js         Object selection, transform handles, floating pixel selection, clipboard
js/colors.js            Color panel
js/audio.js             Sound synthesis, playback, audio import
js/animation-engine.js  Player and editor playback
js/storage.js           IndexedDB wrapper
js/project-manager.js   .gabyanim format, open/save, autosave
js/gif-encoder.js       GIF encoder (median-cut palette, dithering, LZW), runs in a worker
js/zip.js               Store-only ZIP writer
js/export-manager.js    Export window and all export formats
js/templates.js         Starter animations
js/ui.js                Tooltips, toasts, dialogs, form controls, popovers, confetti
js/panels.js            Tool rail and side panels
js/timeline.js          Timeline
js/screens.js           Top bar, welcome, templates, projects, settings, help, tutorial, preview
js/keyboard-shortcuts.js
js/app.js               Frame operations, canvas resize, backgrounds, picture import, startup
assets/fonts/           Fredoka, Bangers, Pacifico, Patrick Hand, Permanent Marker (+ licenses)
icon/                   App icons
```

Every module is an IIFE that attaches to `window.GAS`. Modules mostly talk through `GAS.bus` events: `dirty`, `frame-changed`, `frames-changed`, `frame-selected`, `selection-changed`, `tool-changed`, `history-applied`, `project-loaded` and so on.

## The `.gabyanim` format

A JSON file:

```jsonc
{
  "format": "gabyanim", "version": 1,
  "id": "...", "name": "My Animation", "width": 640, "height": 480,
  "fps": 8, "loop": true, "speed": 1, "onion": { ... },
  "background": { "fill": { "type": "gradient", ... }, "layer": "data:image/png;base64,..." },
  "frames": [{
    "id": "...", "hold": 1, "bgFill": null, "hasOwnBackground": false,
    "layers": { "drawing": "data:image/png;base64,...", "background": null },
    "objects": [{ "type": "sticker", "key": "animals/cat", "x": 0, "y": 0, "w": 100, "h": 100, "rot": 0, ... }],
    "sound": { "ref": "builtin:boing", "volume": 1 }
  }],
  "assets": { "images": { "<id>": "data:image/..." }, "audio": { "<id>": { "name": "...", "dataURL": "data:audio/..." } } }
}
```

Empty layers are saved as `null`. Imported pictures and sounds are embedded as base64, so one file holds everything. Autosave stores the same structure in IndexedDB, with PNG `Blob`s in place of data URLs.

## Running it

Any static server works. From the repository root:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/apps/gabys_animation_studio/>. Double-clicking `index.html` also works. The one difference is that browsers block web workers on `file://` pages, so the GIF encoder falls back to running on the main thread.

## Browser support

Built for current Chrome, Edge, Firefox and Safari:

- **Video export:** uses `MediaRecorder` with `canvas.captureStream()`. It records WebM in Chrome, Edge and Firefox, and MP4 in Safari. Recording happens in real time, so the tab must stay open.
- **Save:** uses the File System Access API where it exists (Chrome and Edge), so later saves overwrite the same file. Other browsers download a new file each time.
- **Everything else:** standard Canvas 2D, Pointer Events, IndexedDB and Web Audio.

## Privacy

There are no accounts, ads, analytics or network requests at runtime. Fonts and all artwork are bundled. Projects stay in the browser's IndexedDB until the user exports or saves a file.

## Credits

All stickers, effects, templates, icons and sounds are original to this app. Fonts: Fredoka, Bangers, Pacifico and Patrick Hand are under the SIL Open Font License 1.1, and Permanent Marker is under the Apache License 2.0. License texts are in `assets/fonts/`.
