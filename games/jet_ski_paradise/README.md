# Jet Ski Paradise

**Ride the waves. Own the ocean.**

A 3D jet ski racing and freestyle stunt game built with Three.js and plain JavaScript modules. It covers championship racing against AI rivals, time trials with ghost replays, a freestyle stunt arena with combos, free-roam exploration, and full rider and jet ski customization. It plays with a keyboard or a touch screen.

There's no build step. Everything (models, textures, water, sky, music and sound effects) is generated in code, so the only external dependency is Three.js, loaded from a pinned CDN build.

## Play locally

From the repository root:

```bash
python -m http.server 8000
```

Open <http://localhost:8000/> and enter through the Coming Soon card. Opening the game's URL directly sends you back to the arcade until you've entered the PIN. The game uses ES modules and loads Three.js from `cdn.jsdelivr.net`, so it must be served over http(s) with an internet connection. Opening `index.html` as a file won't work.

To publish the game, remove `Coming Soon - ` from the `<title>` in `index.html`.

## Publish on GitHub Pages

The game is a folder of static files, so it publishes along with the rest of the arcade:

1. Commit and push to `main`.
2. In the repository on GitHub, **Settings → Pages** should show **Deploy from a branch** with `main` and `/ (root)`.
3. After a minute or two the game is live at `https://<user>.github.io/GabysArcade/games/jet_ski_paradise/`.

To host it on its own, copy this folder into any repository that has Pages turned on. The only paths outside the folder are the shared fonts (`../../assets/fonts/`) and the Coming Soon guard script. If those are missing, the game falls back to system fonts and skips the guard.

## Set up the leaderboard

Do this once:

1. Open the Supabase project's **SQL Editor** and choose **New query**.
2. Paste all of [`leaderboard.sql`](leaderboard.sql) and choose **Run**.
3. Open **Leaderboard** from the game's main menu. It should say that there are no scores yet.

Scores are stored in the `jet_ski_paradise_scores` table. The project URL and publishable key are in `js/leaderboard.js`. The key is meant to be public, and the SQL limits visitors to reading the board and adding scores. Scores are calculated in the browser, so the SQL rejects impossible scores, but a determined cheat could still post a believable fake. To delete entries, use the commented queries at the bottom of the SQL file.

The leaderboard ranks **Stunt Showdown** scores (2 minutes of freestyle in the Stunt Arena). When a Showdown ends, the results screen asks for a name, submits the score and shows the top 10 with your entry highlighted. The main menu's **Leaderboard** button shows the same top 10.

## Game modes

| Mode | What it is |
| --- | --- |
| Championship (Play) | Three cups of 3-lap races against 5 AI rivals. Points per race are 10, 8, 6, 4, 2 and 1. A podium finish earns a trophy and unlocks the next cup. Each cup ends with a boss race (Captain Riptide, then Kai "Tsunami" Makoa). Progress is saved between races. |
| Quick Race | Any unlocked course, 1 to 5 laps, any weather, Easy, Medium or Hard. |
| Time Trial | 3 laps alone against the clock and your best run's ghost. Gold, silver and bronze medals. |
| Freestyle | **Stunt Showdown** (2 minutes, online leaderboard), **Endless Practice** and six **Stunt Challenges**. |
| Free Ride | Explore any unlocked location with no timer. Find golden shells and hidden places. |

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Accelerate | W / ↑ | GAS |
| Brake / reverse | S / ↓ | BRAKE |
| Steer | A D / ← → | ◀ ▶ (or tilt steering) |
| Boost | Shift | BOOST |
| Jump / Pro trick modifier | Space | JUMP (hold in the air) |
| Backflip / Frontflip | Q / E | BACK FLIP / FRONT FLIP |
| Barrel roll left / right | Z / X | ROLL buttons |
| 360 Spin / Superman | R / F | 360 SPIN / SUPERMAN |
| No-Hander / One-Hander | C / V | NO HAND / ONE HAND |
| Camera | T | |
| Pause | Esc / P | Pause button |

Keys can be remapped in **Settings**. In the air, accelerate tilts the nose down and brake tilts it up. Holding Space (or JUMP) while starting a backflip, barrel roll or Superman turns it into a Double Backflip, Double Barrel Roll or Superman Backflip.

The game goes full screen on the first tap and when a race starts (turn this off in **Settings**). iPhones don't let web pages go full screen. There, **Share → Add to Home Screen** opens the game without the browser bar using `manifest.json`. In portrait, gameplay pauses behind a "turn your device sideways" message.

## Tricks and scoring

| Trick | Points |
| --- | --- |
| One-Hander | 300 |
| No-Hander | 400 |
| 360 Spin | 450 |
| Backflip / Frontflip | 500 |
| Barrel Roll | 600 |
| Superman | 700 |
| Double Backflip | 1,200 |
| Double Barrel Roll | 1,400 |
| Superman Backflip | 1,500 |

Points are banked when you land. Tricks in the same jump, or in jumps chained within 2.6 seconds of landing, build a combo: 2 tricks is x2, up to x5 for 5 or more. A level landing adds a 250-point Perfect Landing bonus. Flying through a pink ring doubles the next landing. Landing mid-trick, or badly tilted, is a wipeout and loses the combo. Landing tricks also refills boost.

## Locations

| Location | Water | Highlights |
| --- | --- | --- |
| Paradise Bay | Tropical lagoon | Resort island, huts, dock, shipwreck cove |
| Coral Island | Tropical lagoon | Coloured reefs, tiny islands, Pirate's Passage |
| Sunset Coast | Open ocean | Cliffs, sea stacks, lighthouse, sea cave |
| Volcano Island | Open ocean | Smoking volcano, lava streams, narrow rock passages, Lava Falls |
| Jungle River | River with current | Narrow banks, bridges, waterfalls, floating logs, temple ruins |
| Stormbreaker Ocean | Storm coast | Huge waves, rain, lightning, mega waves |
| Stunt Arena | Freestyle venue | Ramps, the giant Skyline Ramp, multiplier rings, grandstands |

Paradise Bay, Coral Island and Sunset Coast start unlocked. The other three unlock with a Paradise Cup podium, or for 2,000 coins each in **Courses**. Each location hides 5 golden shells and 2 secret places.

## Progression

- **Paradise Coins** come from races (more on Hard), tricks, stunt scores, challenges, records, medals, trophies, shells, discoveries and achievements.
- Spend them on **8 jet skis**, **5 upgrades per ski** (engine, steering, acceleration, stability, boost tank), paint finishes, graphics, decals, exhausts, and rider clothing and gear.
- 24 achievements and a player statistics page.
- Everything saves to `localStorage` on this device. **Settings → Reset all progress** clears it.

## How the water works

`js/water.js` sums eight Gerstner waves (two long swells, three medium chop waves, three short ripples), set per location and scaled by the weather. The same wave data drives the GPU water shader (vertex displacement, per-pixel normals, Fresnel reflections of a captured sky cube map, sun glitter, crest, shore and wake foam, seabed tinting) and the CPU height lookup that the physics uses. Mega wave events add a travelling ridge to both.

`js/physics.js` samples the water under four hull points (front-left, front-right, rear-left, rear-right) at a fixed 120 Hz timestep. Each point adds a buoyancy spring and damping force and a torque, so the hull pitches, rolls and bounces on the waves. Hydrodynamic drag, thrust (only while the jet is in the water), speed-dependent steering, banking, a softer arcade gravity in the air, and landing stabilization give the ride its feel. Rendering interpolates between physics steps.

## Graphics settings

**Auto** picks Low on phones, Medium on tablets and High on desktops. **Low** uses vertex-lit water, no shadows, fewer particles and a lower resolution. **Medium** adds per-pixel water normals, shadows and more particles. **High** adds full ripple detail, larger shadow maps, a full particle budget and denser scenery. **Settings** can also show the frame rate.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page shell, HUD and touch controls, import map for Three.js |
| `css/main.css` | Base styles, loading screen, HUD |
| `css/menus.css` | Menus, panels, cards, garage and character screens |
| `css/mobile.css` | Touch controls and small-screen layouts |
| `js/main.js` | Renderer, lighting and weather, frame loop, full screen, switching screens |
| `js/game.js` | Game sessions for every mode, jet ski entities, chase camera, scoring, results |
| `js/physics.js` | Rigid body with four-point buoyancy, handling, collisions |
| `js/water.js` | Gerstner wave model, water shader, sky shader, procedural textures |
| `js/jetSki.js` | Procedural jet ski models and livery textures |
| `js/rider.js` | Procedural rider with IK arms and legs and pose animation |
| `js/tricks.js` | Trick execution and combo scoring |
| `js/racing.js` | Spline tracks, checkpoints, laps, standings, ghost recording |
| `js/ai.js` | AI racers |
| `js/environments.js` | The seven locations, lighting presets, scenery and collectibles |
| `js/customization.js` | 3D showroom, Character and Garage screens |
| `js/effects.js` | Pooled particles, wake trails, blob shadows, rain and lightning |
| `js/audio.js` | Synthesized engine, sound effects and music (Web Audio API) |
| `js/input.js` | Rebindable keyboard, multitouch buttons and tilt steering |
| `js/ui.js` | Menus, setup screens, HUD updates, results, settings |
| `js/saveData.js` | Saved progress in `localStorage` |
| `js/leaderboard.js` | Supabase REST client for the online top 10 |
| `js/data.js` | Jet skis, items, tricks, cups, rivals, achievements and challenges |
| `leaderboard.sql` | One-time Supabase setup for the leaderboard |
| `manifest.json` | Home-screen install for full-screen play on phones |
| `icon/` | Favicon and thumbnails |
