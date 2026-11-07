# Comic Book Studio

A browser-based comic book maker for kids, beginners, hobbyists and artists. You can plan page layouts, draw, letter speech bubbles and sound effects, design a cover, read the result like a real comic, and export a PDF or images. It runs entirely in the browser, with no installs, accounts or ads.

There's no build step and no framework, matching the rest of Gaby's Arcade. It's plain HTML, CSS and JavaScript: classic scripts sharing one `CBS` namespace and drawing on HTML Canvas. There are no third-party scripts. The PDF writer and ZIP packer are built in. The optional AI proxy in `server/` is the only part with a dependency, and it runs on a server, not in the app.

## Features

- **Projects:** a New Comic wizard sets the title, author, description, cover design and art, page size, orientation, starting page count and starting layout. Page sizes are Standard US Comic Book, Manga (B6), A4, US Letter, Square, Webcomic Strip and Custom (in, cm or mm), in portrait or landscape. Comics are saved in IndexedDB with autosave, and the last comic reopens when you return. My Comics handles open, rename, duplicate, delete and download, and there's a recent list. Save As, plus export and import of `.comic.json` project files, cover everything: pages, layers, drawings and pictures.
- **Panels:** 27 layout templates in six groups (Basic, Grids, Asymmetric, Dynamic diagonal, Action, Manga). You can also save your own custom layouts. The Panel tool draws rectangles, squares, click-to-place polygons and freeform panels. It slices any panel straight or diagonally with a gutter, and it resizes neighbors when you drag the gutter between them. Every panel has its own border width, color, rounded corners and fill. You can edit corner points, split panels and adjust page-wide spacing and margins. Art dropped in a panel is clipped to it.
- **Drawing:** pencil (grainy), ink pen (tapers with pressure, or with speed on a mouse), soft or hard brush, marker (see-through, doesn't darken itself), airbrush (builds up while held) and eraser. Each has size, hardness, opacity and smoothing. Pen pressure comes from Pointer Events. Strokes can be kept inside the panel they start in. There's also a flood fill (it can use line art from all layers), an eyedropper, a color palette with recent colors, a custom picker and the system eyedropper where available. Shift-click draws straight lines.
- **Shapes:** line (with optional arrowhead), rectangle, ellipse, triangle, polygon, custom click-polygon, star, burst, arrow, heart, focus lines and speed lines. Each has fill and stroke colors, line width and solid, dashed or dotted style.
- **Lettering:** speech, thought, whisper, shout, narration, radio, electronic and custom bubbles. Tails can be curved, pointed, thought puffs or lightning; you drag them to aim, then adjust their width, bend and flip. Text wraps to the bubble's shape and the bubble can grow to fit. You can edit text directly on the page, with 14 fonts (10 bundled comic fonts), size, bold, italic, capitals, alignment, line spacing and letter spacing. Text objects add outline, shadow and a background box.
- **Sound effects:** 24 ready-made words and 10 lettering styles. Options cover font, two-color gradient, outline, shadow, 3D extrusion (depth, direction, color), a burst behind the word, slant, letter spacing, and 9 warps: arc up and down, wave, bulge, pinch, grow, shrink, shake and staircase.
- **Images:** import PNG, JPG, WEBP or SVG with the Image tool, by drag and drop, or by pasting. Images can be moved, resized, rotated, flipped and cropped (on the page or with exact numbers). There are opacity and filter controls (brightness, contrast, saturation, grayscale, sepia, hue, blur, invert), 7 filter presets and 4 comic effects (posterize, halftone, comic ink, noir). Clipping to a panel can be changed later, and "fill panel" stretches a picture to cover it.
- **Asset library:** sample art in Characters, Backgrounds, Environments, Props, Vehicles and Effects. There's also a personal library shared by all your comics (rename, recategorize, remove) and a list of the pictures used in the current comic. Click to place, or drag onto a panel.
- **Layers:** Background, Panels, Artwork, Drawing, Effects & Shapes, Speech Bubbles and Lettering. Each can be added, deleted, renamed, duplicated, hidden, locked, faded and reordered by drag and drop. Drawing layers can be merged down, cleared or flipped. Layers can be grouped into folders that hide, lock and fade together.
- **Editing:** select, move, resize (Shift keeps proportions, Alt resizes from the center), rotate (Shift snaps to 15°), marquee select, Alt-drag to duplicate, arrow-key nudge, align and distribute, and arrange order. Smart guides snap to the page, margins, guides and other objects. Rulers in inches, cm or page units, with draggable guides, a grid with snap, and a context menu. Up to 100 steps of undo and redo. Zoom and pan with the mouse wheel, Space-drag, the Hand tool or two-finger pinch.
- **Covers:** 6 cover designs (Classic Superhero, Manga Volume, Modern Minimal, Golden Age Retro, Spooky Horror, Fun for Kids). Title, subtitle, issue, volume, writer, artist, publisher and price come from a details form, so editing a field updates the cover's lettering. The cover art is clipped to the main art panel, and you choose whether the cover is exported.
- **Reading mode:** single pages or two-page spreads (cover on its own), page-turn animation, fullscreen, fit and zoom with drag-to-pan, a page scrubber, keyboard and click navigation, and swipe on touch screens.
- **Export:** PDF of the whole comic or chosen pages, either at the comic's exact size or fitted to US Letter or A4 in portrait, landscape or auto orientation. PNG pages can have transparent backgrounds, JPEG quality is adjustable, and WEBP is supported. Resolution goes from 72 to 600 DPI and you can pick a page range. Several images download as one ZIP. You get a live preview before exporting.
- **Creative assistant:** story concepts, outlines, characters, dialogue, narration, scene descriptions and page-by-page breakdowns. **Build comic pages** turns a breakdown into real pages with panels, captions, bubbles and sound effects, with scene notes on a "Script notes" layer that's never exported. It also has a character maker (species, pose, expression, power, costume, accessories) plus background and panel art generators, with alternate versions, save to library, and insert into the selected panel. Everything works offline through the built-in generators, and each result says whether it came from the built-in generator or the AI service.
- **Learning:** a 7-step spotlight tour, the sample comic *Zara Zoom and the Runaway Robot* (a cover and 3 pages), tooltips, a shortcuts sheet (press `?`), and a large-buttons mode.

## Files

```text
index.html             Page shell; loads the scripts below in order
css/main.css           Fonts, tokens, buttons, inputs, sliders, menus, tooltips, toasts, color picker
css/studio.css         Top bar, toolbox, workspace, rulers, sidebars, layers, page strip, drawers
css/dialogs.css        Dialogs, New Comic wizard, start screen, My Comics, export, layout picker, reader, tour
css/responsive.css     Large-buttons mode, tablet and phone layouts
js/util.js             CBS namespace, h() DOM helper, event bus, colors, geometry, ZIP writer, preferences
js/storage.js          IndexedDB wrapper (projects, meta, library, kv)
js/model.js            Page sizes, fonts, layer types, object factories, document controller (CBS.doc)
js/history.js          Undo/redo: page, document and pixel-rectangle entries
js/lettering.js        Bubble shapes and tails, shape-aware text wrapping, text objects, SFX renderer
js/render.js           Scene renderer shared by the editor, thumbnails, reader and exports; filters & effects
js/raster.js           Drawing layers: brushes, stroke buffer, flood fill, pixel moves
js/layouts.js          Panel templates, polygon slicing, custom layouts
js/gen-art.js          Built-in background painter, character maker and panel composer
js/gen-story.js        Built-in story generator
js/assets.js           Project assets, personal library, sample art, placing images
js/ui.js               Dialogs, menus, tooltips, toasts, color picker, form controls
js/editor.js           Viewport, pointer routing, handles, snapping, rulers & guides, text editing
js/tools.js            The tools (select, move, hand, draw, eraser, shapes, fill, picker, text, bubble, SFX, panel, image)
js/actions.js          Commands: clipboard, arrange, align, pages, layers, context menu
js/properties.js       Right sidebar properties for the page, cover and each object type
js/layers-panel.js     Layers panel
js/pages-panel.js      Page strip, layout picker
js/cover.js            Cover templates, bindings and cover details form
js/projects.js         Save/open/autosave, New Comic wizard, My Comics, start screen, project files
js/export.js           Export dialog, PDF writer, image/ZIP export
js/reader.js           Reading mode
js/library.js          Asset library drawer
js/ai.js               Creative assistant drawer and AI service client
js/tutorial.js         Guided tour
js/sample.js           Builds the sample comic
js/toolbar.js          Top toolbar, menus and toolbox
js/app.js              Startup, keyboard shortcuts, drag & drop, paste, panel layout, settings
assets/fonts/          Bundled fonts with their licenses (SIL OFL 1.1 and Apache 2.0)
server/                Optional AI proxy (Node.js); see below
icon/                  App icons
```

## How it works

- **Units.** Pages use "doc units", 100 per inch, so a US comic page is 663 × 1025. Exports scale this by DPI ÷ 100.
- **One renderer.** `CBS.render.drawPage()` draws a page for the editor, page thumbnails, the reader and every export, so what you see is what you export. The editor keeps two canvases: the page (redrawn only when the document changes) and an overlay for handles, guides and cursors (redrawn on pointer moves).
- **Objects and layers.** Panels, images, bubbles, text, SFX and shapes are vector objects with `x, y, w, h, rot` and live on object layers. Drawing layers hold pixels at 200 DPI. New objects go to the matching layer type, which is created if needed.
- **Strokes.** While you draw, the stroke is painted into a buffer and shown composited over a backup of the layer. That's why marker and opacity strokes don't stack on themselves and the eraser previews live. When the stroke ends, only the changed rectangle is stored for undo.
- **Undo.** Object edits snapshot the page as JSON, page-list edits snapshot the document, and pixel edits store the changed rectangle. The three kinds stay independent because layers refer to their pixels by `rasterId`.
- **Saving.** A project is stored as JSON in IndexedDB, with drawing layers as PNG data URLs and pictures embedded. Autosave runs every 30 seconds after a change and when the tab is hidden. Preferences, custom layouts and tool settings live in `localStorage`.

## The optional AI service

Comic Book Studio is complete without AI. The assistant's **Built-in** mode uses local generators that work offline. The **AI service** mode sends requests to a small proxy you run yourself, so your API key stays on that server and is never sent to the browser.

The proxy (`server/ai-proxy.mjs`) uses the Anthropic API (model `claude-opus-5-5`) with structured JSON output. Its endpoints:

| Endpoint | What it returns |
| --- | --- |
| `GET /health` | `{ ok, provider, model }` |
| `POST /story` | A page-by-page story in the same shape as the built-in generator, so **Build comic pages** works with either |
| `POST /art` | `{ svg }`: an original comic-style vector illustration (character, background or panel) drawn by Claude. The proxy strips scripts, event handlers and external links before returning it |

Run it with Node.js 18+:

```bash
cd apps/comic_book_studio/server
npm install
ANTHROPIC_API_KEY=sk-ant-... node ai-proxy.mjs
```

Then open **Settings › AI service**, enter the proxy's address (for example `http://localhost:8787`), press **Test connection**, and switch the assistant to **AI service**.

| Setting | Default |
| --- | --- |
| `PORT` | `8787` |
| `ALLOWED_ORIGINS` | `https://gabygarcia86.github.io` plus common localhost ports. Requests from other sites get no CORS access |
| `AI_MODEL` | `claude-opus-5-5` |
| `RATE_LIMIT_PER_MIN` | `12` requests per IP per minute |

The proxy turns on server-side refusal fallbacks and returns friendly error messages for refusals, rate limits and bad keys. Because GitHub Pages can't run server code, host the proxy on any Node host or run it on your own computer. AI requests cost money on your Anthropic account, which is why the rate limit and origin allow-list exist.

## Browser support

Comic Book Studio is built for current desktop Chrome, Edge, Firefox and Safari, and works with mouse, touch and pen. Live image filters use canvas `filter`. Browsers without it get a slower pixel-based fallback. WEBP export depends on the browser's encoder. If it's missing, the app says so instead of saving a different format. In private browsing, storage may be blocked. The app warns you, and you can still export project files.
