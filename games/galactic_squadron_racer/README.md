# Galactic Squadron Racer

A top-down arcade racing spin-off of [Galactic Squadron](../galactic_squadron/). Pick any ship from the squadron's fleet and race three AI rivals over three laps on ten circuits, from a military base and a desert canyon to a lava world and a championship stadium.

Built with HTML5 Canvas 2D and vanilla JavaScript (ES modules). There is no build step, there are no dependencies and nothing is downloaded: every track, decoration, effect, sound and music loop is generated in code.

## Running locally

ES modules don't load from `file://`, so serve the folder over HTTP. Any static server works:

```bash
# from this folder
python -m http.server 8000
```

Then open `http://localhost:8000/`. All paths are relative, so it also works from the repository root or on GitHub Pages at any URL depth.

## Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Accelerate | W / â†‘ | RT or A | **ACCEL** |
| Brake, then reverse | S / â†“ | LT or B | **BRAKE** |
| Steer | A D / â† â†’ (tap for small corrections) | Left stick | Floating stick, or â—€ â–¶ buttons |
| Boost | Space / Shift | X or RB | **BOOST** (also accelerates) |
| Back on track | R | | âŸ² (appears when you're stuck) |
| Pause | Esc / P | Start | Pause button |
| Mute | M | | Speaker button |

Settings let you limit the keyboard to **WASD + Space** or **arrows + Shift**, pick stick or button steering on touch screens, turn on touch auto-accelerate, and change steering sensitivity.

## Driving

- **Turning** is sharpest at low and medium speed. At top speed the turning circle widens, so brake before tight corners.
- **Sliding:** at speed the tail drifts out a little in hard turns. Hold **brake while steering** to power-slide: grip drops, turning sharpens and the brakes barely slow you down.
- **Drift boost:** keep a slide going and the sparks go blue, then orange, then purple. When the slide ends you get boost energy and a short burst of speed.
- **Boost** drains a tank that refills when you let go. Blue chevron pads give a free kick.
- **Rocket start:** press the throttle while the **1** is showing. Press too early and the engine overheats.
- **Off track** (sand, snow, moss, grating, lavaâ€¦) you lose speed. In lava you're slowed hard and then lifted back onto the track.
- **Checkpoints:** each lap is split into gates that must be passed in order, so cutting corners or reversing over the line never counts.

## Ships

All 18 ships come from Galactic Squadron: the 14 hangar ships, the three enemy fighters (T-Fighter, T-Interceptor, T-Bomber) and the Falcon. Each has six stats from 1 to 10 (Top Speed, Acceleration, Handling, Boost Power, Boost Capacity, Weight / Stability). Every ship's stats add up to 36, so no ship is best at everything. The ship artwork lives in this game's own copies of Galactic Squadron's `js/ships.js` and `js/sprites.js`, so ships can be changed here without affecting the original game. Stats live in `js/shipRoster.js` (`HANGAR` and `EXTRA`), and `deriveHandling()` turns them into physics values. A ship added to `SHIPS` in `js/ships.js` shows up in the hangar automatically with balanced default stats.

The **Probe-Fighter** is not a racer. It patrols sections of every track as a hazard, and its red scanning beam shows where it's heading.

## Tracks

| # | Track | Character | Hazards and features |
| --- | --- | --- | --- |
| 01 | Imperial Circuit | Wide straights, sharp right angles, long sweepers | Probe patrols, a moving barrier, T-Fighter squadrons flying over |
| 02 | Tatooine Dust Run | 5 km straight, narrow canyon, big sweepers | Falling rocks in the canyon, sandstorms with crosswinds, dust patches |
| 03 | Hoth Frozen Circuit | All ice (low grip), tunnels, hairpin | Extra-slick patches, falling ice, probes |
| 04 | Endor Forest Run | Tight and winding between giant trees | Falling logs, probes, critters that scatter |
| 05 | Death Star Speedway | A ring around the reactor, then a technical section | Shock gates (half the track at a time), blast doors |
| 06 | Asteroid Belt Run | Beacon-lit lane with quick direction changes | Asteroids crossing the lane, floating debris |
| 07 | Mustafar Lava Circuit | Elevated platforms, narrow bridges over lava | Erupting vents, lava run-off |
| 08 | Coruscant Skyline | Very fast skyway above a city with depth | Drifting freighters, boost pads, flying traffic |
| 09 | Jakku Ship Graveyard | Sharp corners between crashed starships | Scrap on the straights, falling debris |
| 10 | Galactic Grand Prix | Straights, hairpin, sweepers, technical infield | Barrier, shock gate, two probe patrols, fireworks |

Every hazard warns you before it can hit: gates crackle, vents glow, rocks cast a growing shadow, and asteroids are announced by blinking chevrons.

## Modes

- **Grand Prix:** pick a cup and an AI difficulty, then race the same three rivals on every track. Points go 15 / 12 / 10 / 8. After the first race the grid starts in reverse championship order. Standings follow each race, and a trophy screen with your season summary comes at the end. Cups: Imperial (4 tracks), Outer Rim (3), Inferno (3), Galactic Championship (all 10) and Wildcard (4 random tracks, drawn again every time).
- **Quick Race:** any track, any ship, Easy / Normal / Hard AI.
- **Time Trial:** solo. Your best lap, best three-lap total and a ghost of your best lap are saved per track in `localStorage`. On later runs the ghost races alongside you, and the HUD shows how far ahead or behind you are.

## AI

Each track gets a minimum-curvature racing line. Every AI driver then builds its own speed profile from its ship's turn rate, grip and brakes, so heavy ships really do brake earlier. Drivers steer by pure pursuit, brake for what's coming up, boost on straights and corner exits, steer around hazards they see coming, pull out to overtake, and back off a wall when they're stuck (or respawn if they're lost). There is no rubber-banding. Difficulty changes cornering speed, how closely drivers follow the racing line, boost use, reaction distance and occasional mistakes.

## Project structure

```
galactic_squadron_racer/
  index.html          page shell and all DOM screens
  styles.css          menus, hangar, results, touch controls
  js/
    main.js           bootstrap: settings, wiring, visibility handling
    game.js           flow / state machine, main loop, modes
    config.js         ALL tuning: physics, boost, drift, surfaces, AI, points, cups
    tracks.js         the ten layouts, sections, zones and hazards
    trackGeometry.js  rounded-polygon centerline â†’ sampled arrays, projection, checkpoints
    race.js           one race: grid, countdown, laps, finish, respawn, ghost (no DOM)
    racer.js          racer state, boost tank, drift charge, checkpoint progress
    physics.js        arcade hover-ship physics
    collision.js      walls, racer bumps, hazard hits
    aiRacer.js        racing line, speed profiles, AI driver
    trackHazards.js   probes, barriers, shock gates, rocks, asteroids, debris, vents, sandstorm
    shipRoster.js     the 18 racers and their stats
    ships.js          hangar ship artwork (copied from Galactic Squadron)
    sprites.js        enemy, Falcon and Probe-Fighter artwork, flames (copied from Galactic Squadron)
    shipRender.js     ship drawing: flames, boost, banking, shadow
    scenery.js        environment art: textures, decorations, per-theme settings
    trackRenderer.js  track drawing, decoration placement, backdrops and overhead layers
    raceView.js       race presentation: camera, effects, weather, sounds
    hud.js            HUD and minimap
    camera.js         follow camera with look-ahead, zoom and shake
    particles.js      pooled particles
    audio.js          Web Audio effects, engine, ambience and music
    input.js          keyboard, gamepad and touch
    ui.js             DOM screens, hangar preview, track thumbnails, results, trophy
    grandPrix.js      championship rounds and points
    timeTrial.js      records and ghosts in localStorage
    titleScene.js     animated title backdrop
    gfx.js            drawing helpers
    storage.js        localStorage wrapper that never throws
    utils.js          math helpers (base set copied from Galactic Squadron)
```

The simulation (`race.js` and everything it imports) has no DOM access, so whole races can be simulated headlessly in Node for balancing.

### Adding or editing a track

A layout is a clockwise list of corners `[x, y, radius]`. Each corner is rounded with a circular arc and joined to the next by a straight. Positions along the track (sections, zones, hazards) are given as **u** values: corner index plus a fraction toward the next corner. `new TrackGeometry(def).validate()` reports overlapping corners, corners too tight for the track width, and sections whose walls come too close to each other.

## Testing aids

- `?track=desert` (plus `&mode=timetrial`, `&ship=pod-ship`) jumps straight into a race; add `&autostart` to skip the intro.
- `?autopilot` lets the AI drive your ship.
- `?debug=1` exposes the game as `window.gsr` in the console.

## TODO

- Custom sound
- Theme music
- Update names of enemy racers