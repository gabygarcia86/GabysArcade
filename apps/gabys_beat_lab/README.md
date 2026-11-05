# Gaby's Beat Lab

A browser-based music studio for kids, beginners and anyone who wants to make songs. You can build drum beats, write melodies and chords, arrange a song, mix it with real effects, record your voice, and export WAV, MP3 or MIDI. It runs entirely in the browser, with no installs or accounts.

There's no build step and no framework. It's plain HTML, CSS and JavaScript: classic scripts sharing one `GBL` namespace, using the Web Audio API. The one third-party file is the MP3 encoder, which loads only when you export an MP3.

## Features

- **Transport:** Play, Pause, Stop, Record, Loop and Metronome. **PAT** mode loops the current pattern, and **SONG** mode plays the Playlist. Tempo is 40–220 BPM: type it, use the arrows, drag the BPM label, tap it in, or pick a preset (Slow 70, Chill 90, Hip Hop 95, Pop 115, Dance 125, Fast 145). Time signatures are 3/4, 4/4, 5/4, 6/8 and 7/8. The toolbar also has master volume with a meter, a position display, and undo/redo.
- **Channel Rack:** a step sequencer with 16, 32, 48 or 64 steps and three step volumes (right-click or long-press a step). You can paint steps by dragging. Each channel has volume, pan, mute and solo. Patterns can be added, duplicated, renamed, deleted, copied, pasted and cleared, and there's a swing control. The rack also has 12 drum presets and **MAKE ME A BEAT!**. Drop a sound on a channel to replace it, or drop it on the rack to add a new channel.
- **Piano Roll:** draw, select and erase tools. Notes can be moved, resized, multi-selected, copied, cut, pasted, duplicated, Alt-dragged to copy, nudged with the arrow keys and quantized. Snap goes from 1/64 to a bar. There's a velocity lane, zoom, and ghost notes from other channels. It has seven scale presets, **HELP ME MAKE MUSIC** (scale highlighting, snap-to-scale and clickable chord suggestions), and Chords, Melody and Bassline generators.
- **18 synthesized instruments:** Grand Piano, Electric Piano, Synth Piano, Organ, Classic, Retro, Lead, Ambient and Bass Synths, Electric Bass, Synth Bass, Sub Bass, Guitar (Karplus-Strong), Strings, Brass, Bells, Chiptune and 8-bit Retro. Every channel has Volume, Pan, Attack, Release, Cutoff, Reverb and Pitch controls, a preset selector, and an on-screen and computer keyboard (Z–M and Q–U, octave with `[` `]`).
- **Playlist:** tracks of 7 types (Drums, Bass, Melody, Chords, Synth, Vocals, Sound Effects) with mute, solo and routing. You can paint, move, resize, duplicate (Ctrl-drag or Ctrl+D) and delete clips, box-select, zoom, and add section markers. Pattern clips loop when stretched. Audio clips can be trimmed from either edge and have their own volume. Song templates (Intro → Verse → Chorus → Verse → Chorus → Outro, and others) build variations automatically.
- **Mixer:** one insert per channel by default. Each insert has a fader, pan, mute/solo, a level meter, a name, a color and up to 8 effect slots. The Master channel has volume, a 3-band EQ, effect slots and a safety limiter. There are 10 effects, all real Web Audio processing: Reverb, Delay, Echo (ping-pong), Chorus, Phaser, Flanger, Distortion, Compressor, EQ and Filter (with wobble).
- **Browser:** about 90 original synthesized sounds in 10 categories. You can search, preview, view waveforms, favorite, drag into the Channel Rack or Playlist, or add with ＋. There are also tabs for instruments and presets (genres, drum patterns, song structures and patterns).
- **Recording and import:** microphone recording, optionally while the song plays, with latency compensation. Recordings are stored as WAV. You can import WAV, MP3, OGG, M4A, FLAC and AIFF, depending on what the browser can decode. Files can be dropped anywhere.
- **Export:** WAV at 16 or 24-bit, or 32-bit float; MP3 at 128–320 kbps; MIDI type 1 with tempo, time signature, GM programs and drums on channel 10. You can choose the sample rate, the range (song, a pattern repeated N times, or the first N bars) and the reverb tail. A progress bar shows while exporting. Exports run through the same signal chain as live playback, rendered offline.
- **Saving:** Save, Save As, Open, New, Recent Projects and My Projects, all stored in IndexedDB. Projects can also be saved as `.beatlab` JSON files with imported audio embedded, using the File System Access API where available and a download otherwise. Autosave and crash recovery survive a page refresh.
- **Fun and learning:** Beginner Mode (bigger controls, fewer options and a first-song checklist), a guided tour, and Beat Buddy, an offline assistant that turns requests like "make a spooky Halloween soundtrack" into editable music. There's also a Genre Creator (Hip-Hop, EDM, Rock, Pop, Jazz, Lo-Fi, Retro Video Game, Cinematic, Funk, Reggae), a random song generator, 10 Beat Challenges, an Instrument Playground, Beat Lab Pads with a loop recorder, a Soundboard, a 5-theme Visualizer and optional UI sounds.
- **Layouts:** on desktop the panels are resizable and collapsible. Tablet uses a collapsed browser. Phones get one section at a time with a bottom navigation bar.

## Files

```text
index.html              Page shell; loads the scripts below in order
css/main.css            Tokens, buttons, inputs, dialogs, menus, knobs, faders, splash
css/studio.css          Toolbar, layout, browser, channel rack, piano roll, playlist, mixer, instrument panel
css/fun.css             Welcome, assistant, challenges, playgrounds, pads, soundboard, visualizer, tour, guide
css/responsive.css      Beginner Mode, tablet and phone layouts
js/util.js              GBL namespace, h() DOM helper, event bus, misc helpers
js/theory.js            Notes, scales, chords, progressions
js/instruments.js       Synth voice engine and the 18 instruments (InstrumentManager)
js/sounds.js            Built-in sample recipes rendered offline into buffers (SampleLibrary)
js/effects.js           The 10 audio effects (EffectsProcessor)
js/model.js             Project data model and undo/redo history
js/audio-engine.js      Graph (channels → inserts → master), look-ahead scheduler, offline render
js/storage.js           IndexedDB wrapper
js/project-manager.js   .beatlab format, save/open, autosave, recovery, audio assets
js/export.js            WAV/MP3/MIDI encoders and the export window (ExportManager)
js/generator.js         Beats, chords, melodies, basslines, genres, song templates, Beat Buddy (MusicGenerator)
js/ui.js                Settings, tooltips, toasts, dialogs, menus, knobs, faders, confetti
js/toolbar.js           Top toolbar
js/browser.js           Sample browser
js/channel-rack.js      Step sequencer
js/piano-roll.js        Piano roll editor
js/playlist.js          Playlist arranger
js/mixer-ui.js          Mixer view and effect editor
js/inspector.js         Instrument panel and on-screen keyboard
js/recorder.js          Microphone recording and audio import
js/fun.js               Playgrounds, challenges, assistant window, tour, guide, dialogs
js/app.js               Layout, keyboard shortcuts, frame loop, startup
libs/lame.min.js        lamejs 1.2.1 MP3 encoder (LGPL, see libs/LICENSE-lamejs.txt)
assets/fonts/           Fredoka (SIL Open Font License)
icon/                   App icons
```

## How the audio works

- Time is measured in steps (16th notes). `audio.collect()` turns the project into note events for any time window. The live scheduler and the offline export both use it, so what you hear is what you export.
- Live playback uses a 120 ms look-ahead scheduler on the audio clock, driven by a Web Worker timer so background tabs keep time. The UI only reads the playhead position.
- A `Graph` is built per context. Each channel runs voice → filter (Cutoff) → gain → pan → mixer insert, with a reverb send. Each insert runs effects → pan → fader → mute → master. The master runs effects → EQ → volume → limiter → output. Changes are applied with `graph.sync(project)`, which only rebuilds an effect chain when its effects change, and disposes of removed nodes.
- Every built-in sound is synthesized. Samples are rendered once into AudioBuffers, so there are no audio files to license.

## Notes

- Recording needs microphone permission and a secure page (https or localhost).
- Imported audio is stored in IndexedDB and embedded in `.beatlab` files. Songs saved in one browser can be reopened in another from the `.beatlab` file.
- Beat Buddy is rule-based and runs offline. It doesn't call an online AI service.
