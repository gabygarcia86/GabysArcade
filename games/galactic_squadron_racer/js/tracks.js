/**
 * The ten circuits. Each layout is a clockwise polygon of rounded corners
 * ([x, y, radius] — see trackGeometry.js), with optional sections that change
 * the width, run-off and look of a stretch (canyon, tunnel, bridge …). All
 * positions along a track (sections, zones, hazards) are "u" values: corner
 * index plus a fraction toward the next corner.
 *
 *  surface   racing surface (track or ice)
 *  offroad   the run-off between the track edge and the wall
 *  zones     on-track patches: ice, dust, boost pads
 *  hazards   moving or timed obstacles (trackHazards.js)
 *  theme     key into scenery.js for the art, ambient sound and particles
 */

export const TRACKS = [
  /* ------------------------------------------------------------------ 01 */
  {
    id: 'imperial',
    num: 1,
    name: 'Imperial Circuit',
    theme: 'imperial',
    difficulty: 1,
    desc: 'A military installation the size of a city. Wide straights, sharp right angles and two long sweepers past the hangars.',
    halfWidth: 180,
    runoff: 120,
    surface: 'track',
    offroad: 'grating',
    start: 0.3,
    points: [
      [0, 0, 300],        // A  start straight
      [5040, 0, 260],     // B  sharp right
      [5040, 1680, 1000], // C  sweeper
      [3600, 3600, 1000], // D  sweeper
      [1920, 3600, 260],  // E  sharp right
      [1920, 2400, 260],  // F  chicane left
      [720, 2400, 260],   // G  chicane right
    ],
    sections: [],
    zones: [
      { type: 'boost', at: 2.45, lat: 0, len: 120 },
    ],
    hazards: [
      { type: 'probe', from: 4.15, to: 4.9 },
      { type: 'probe', from: 6.2, to: 6.75 },
      { type: 'barrier', at: 0.72, width: 110, speed: 0.55, phase: 0 },
    ],
    music: 'imperial',
  },

  /* ------------------------------------------------------------------ 02 */
  {
    id: 'desert',
    num: 2,
    name: 'Tatooine Dust Run',
    theme: 'desert',
    difficulty: 2,
    desc: 'Twin-sun desert flats and a narrow canyon. Flat out on the long straight, then thread the rock walls.',
    halfWidth: 170,
    runoff: 130,
    surface: 'track',
    offroad: 'sand',
    start: 0.25,
    points: [
      [0, 0, 700],        // A
      [5000, 0, 900],     // B  long straight into the sweeper
      [6200, 1400, 600],  // C
      [5800, 2800, 450],  // D  canyon entry
      [4600, 3000, 400],  // E
      [3600, 2500, 400],  // F
      [2600, 3000, 450],  // G  canyon exit
      [1400, 3000, 800],  // H
      [-600, 2200, 900],  // I  big sweeper home
    ],
    sections: [
      { from: 3.1, to: 6.1, w: 112, ro: 18, kind: 'canyon', fade: 260 },
    ],
    zones: [
      { type: 'dust', from: 0.55, to: 0.75, lat: -80, width: 140 },
      { type: 'dust', from: 7.3, to: 7.55, lat: 70, width: 150 },
    ],
    hazards: [
      { type: 'rocks', from: 3.4, to: 5.8, every: 3.2 },
      { type: 'sandstorm', from: 0.35, to: 0.95, cycle: 18, duration: 7 },
      { type: 'probe', from: 7.2, to: 7.9 },
    ],
    music: 'desert',
  },

  /* ------------------------------------------------------------------ 03 */
  {
    id: 'ice',
    num: 3,
    name: 'Hoth Frozen Circuit',
    theme: 'ice',
    difficulty: 3,
    desc: 'Packed ice everywhere: less grip, longer slides. Two tight ice tunnels and a hairpin over a frozen lake.',
    halfWidth: 175,
    runoff: 130,
    surface: 'ice',
    offroad: 'snow',
    start: 0.3,
    points: [
      [0, 0, 500],        // A
      [3800, 0, 350],     // B
      [3800, 1500, 300],  // C  tunnel
      [2800, 1500, 300],  // D  tunnel
      [2800, 2600, 400],  // E
      [4600, 2600, 350],  // F  hairpin
      [4600, 3600, 350],  // G
      [0, 3600, 500],     // H  long frozen straight
    ],
    sections: [
      { from: 1.55, to: 3.35, w: 118, ro: 10, kind: 'tunnel', fade: 200 },
      { from: 6.45, to: 6.9, w: 125, ro: 10, kind: 'tunnel', fade: 200 },
    ],
    zones: [
      { type: 'slick', from: 0.6, to: 0.72, lat: 60, width: 170 },
      { type: 'slick', from: 4.3, to: 4.55, lat: -40, width: 200 },
      { type: 'slick', from: 6.2, to: 6.32, lat: 0, width: 220 },
      { type: 'slick', from: 7.4, to: 7.6, lat: -60, width: 180 },
    ],
    hazards: [
      { type: 'probe', from: 0.45, to: 0.85 },
      { type: 'probe', from: 4.25, to: 4.75 },
      { type: 'rocks', from: 7.15, to: 7.85, every: 4.2, look: 'ice' },
    ],
    music: 'ice',
  },

  /* ------------------------------------------------------------------ 04 */
  {
    id: 'forest',
    num: 4,
    name: 'Endor Forest Run',
    theme: 'forest',
    difficulty: 3,
    desc: 'Tight, winding trails between giant trees. Short straights, narrow gaps and a lot of bark.',
    halfWidth: 128,
    runoff: 55,
    surface: 'track',
    offroad: 'moss',
    start: 0.35,
    points: [
      [0, 0, 350],        // A
      [1800, 0, 300],     // B
      [2400, 700, 280],   // C
      [1900, 1400, 280],  // D
      [2600, 2100, 300],  // E
      [3600, 1800, 300],  // F
      [4000, 2800, 320],  // G
      [3000, 3500, 300],  // H
      [2000, 3000, 280],  // I
      [1100, 3600, 300],  // J
      [200, 2900, 300],   // K
      [700, 2000, 260],   // L
      [-200, 1300, 300],  // M
    ],
    sections: [
      { from: 2.2, to: 3.6, w: 100, ro: 40, kind: 'narrow' },
      { from: 8.3, to: 9.6, w: 100, ro: 40, kind: 'narrow' },
    ],
    zones: [],
    hazards: [
      { type: 'rocks', from: 5.2, to: 6.8, every: 3.8, look: 'log' },
      { type: 'probe', from: 10.2, to: 11.7 },
    ],
    music: 'forest',
  },

  /* ------------------------------------------------------------------ 05 */
  {
    id: 'station',
    num: 5,
    name: 'Death Star Speedway',
    theme: 'station',
    difficulty: 4,
    desc: 'Inside a battle station: a huge ring around the main reactor, then a tight technical section of shock gates and blast doors.',
    halfWidth: 150,
    runoff: 80,
    surface: 'track',
    offroad: 'grating',
    start: 0.3,
    points: [
      [-600, 99, 260],     // A  (corner into the long straight)
      [3797, 99, 1150],    // B  reactor ring
      [4501, 803, 1150],   // C
      [4501, 1797, 1150],  // D
      [3797, 2501, 1150],  // E
      [1600, 2501, 240],   // F  technical section
      [1600, 3300, 240],   // G
      [400, 3300, 240],    // H
      [400, 1900, 260],    // I
      [-600, 1900, 260],   // J
    ],
    sections: [],
    landmarks: [{ kind: 'reactor', x: 3300, y: 1300, r: 820 }], // the main reactor, inside the ring
    zones: [
      { type: 'boost', at: 0.62, lat: 0, len: 120 },
    ],
    hazards: [
      { type: 'electric', at: 5.5, period: 4.6 },
      { type: 'electric', at: 7.45, period: 5.2, offset: 1.8 },
      { type: 'barrier', at: 0.8, width: 120, speed: 0.6, phase: 0.5, look: 'door' },
      { type: 'barrier', at: 6.5, width: 100, speed: 0.75, phase: 1.6, look: 'door' },
      { type: 'probe', from: 2.2, to: 3.6 },
    ],
    music: 'station',
  },

  /* ------------------------------------------------------------------ 06 */
  {
    id: 'asteroid',
    num: 6,
    name: 'Asteroid Belt Run',
    theme: 'asteroid',
    difficulty: 4,
    desc: 'A beacon-lit lane through drifting rock. Quick direction changes, and asteroids that cross the lane without asking.',
    halfWidth: 140,
    runoff: 90,
    surface: 'track',
    offroad: 'field',
    start: 0.35,
    points: [
      [0, 0, 400],        // A
      [2000, -300, 350],  // B
      [3200, 500, 350],   // C
      [4400, -200, 400],  // D
      [5600, 600, 450],   // E
      [5400, 2000, 400],  // F
      [4000, 2400, 350],  // G
      [3000, 1700, 350],  // H
      [1800, 2500, 380],  // I
      [400, 2100, 400],   // J
      [-600, 1000, 450],  // K
    ],
    sections: [],
    zones: [],
    hazards: [
      { type: 'asteroids', at: [1.5, 3.5, 5.5, 7.5, 9.5], every: 5.5 },
      { type: 'probe', from: 6.2, to: 6.9 },
      { type: 'debris', at: [2.55, 8.55], count: 2 },
    ],
    music: 'asteroid',
  },

  /* ------------------------------------------------------------------ 07 */
  {
    id: 'lava',
    num: 7,
    name: 'Mustafar Lava Circuit',
    theme: 'lava',
    difficulty: 5,
    desc: 'Elevated platforms over rivers of lava. Narrow bridges, tight corners and vents that erupt without much warning.',
    halfWidth: 140,
    runoff: 110,
    surface: 'track',
    offroad: 'lava',
    start: 0.3,
    points: [
      [-400, 0, 300],     // A
      [2600, 0, 260],     // B
      [2600, 1200, 240],  // C  bridge
      [1200, 1200, 240],  // D
      [1200, 2200, 260],  // E  long bridge
      [3400, 2200, 300],  // F
      [3400, 3300, 300],  // G
      [-400, 3300, 350],  // H
      [-400, 1500, 260],  // I
      [400, 1500, 220],   // J  bridge chicane
      [400, 700, 220],    // K
      [-400, 700, 250],   // L
    ],
    sections: [
      { from: 2.25, to: 2.75, w: 96, ro: 110, kind: 'bridge', fade: 160 },
      { from: 4.2, to: 4.8, w: 100, ro: 110, kind: 'bridge', fade: 160 },
      { from: 9.25, to: 9.75, w: 100, ro: 110, kind: 'bridge', fade: 160 },
    ],
    zones: [],
    hazards: [
      { type: 'vents', at: [[0.6, -60], [0.75, 70], [5.55, 0], [6.4, -70], [6.6, 60], [7.5, 0]] },
      { type: 'probe', from: 7.2, to: 7.9 },
    ],
    music: 'lava',
  },

  /* ------------------------------------------------------------------ 08 */
  {
    id: 'city',
    num: 8,
    name: 'Coruscant Skyline',
    theme: 'city',
    difficulty: 2,
    desc: 'An elevated skyway kilometers above the city floor. Very fast, very wide, and long corners you can take flat out.',
    halfWidth: 175,
    runoff: 70,
    surface: 'track',
    offroad: 'hover',
    start: 0.2,
    points: [
      [0, 0, 900],        // A
      [4500, 0, 1200],    // B
      [6500, 2000, 1000], // C
      [5500, 4000, 700],  // D
      [3500, 3200, 600],  // E
      [2000, 4200, 800],  // F
      [-400, 3600, 1000], // G
      [-1200, 1500, 900], // H
    ],
    sections: [],
    zones: [
      { type: 'boost', at: 0.6, lat: -70, len: 120 },
      { type: 'boost', at: 5.5, lat: 60, len: 120 },
    ],
    hazards: [
      { type: 'barrier', at: 3.5, width: 120, speed: 0.5, phase: 0, look: 'traffic' },
      { type: 'probe', from: 6.2, to: 6.8 },
    ],
    music: 'city',
  },

  /* ------------------------------------------------------------------ 09 */
  {
    id: 'graveyard',
    num: 9,
    name: 'Jakku Ship Graveyard',
    theme: 'graveyard',
    difficulty: 4,
    desc: 'A desert littered with fallen starships. Sharp corners, tight gaps between wrecks and scrap strewn across the straights.',
    halfWidth: 145,
    runoff: 60,
    surface: 'track',
    offroad: 'scrap',
    start: 0.18,
    points: [
      [-600, 0, 300],     // A
      [3000, 0, 250],     // B
      [3000, 1000, 250],  // C
      [4200, 1000, 260],  // D
      [4200, 2600, 280],  // E
      [2600, 2600, 240],  // F  narrow passage
      [2600, 1900, 240],  // G
      [1200, 1900, 240],  // H
      [1200, 3200, 260],  // I
      [-600, 3200, 300],  // J
    ],
    sections: [
      { from: 4.6, to: 6.5, w: 105, ro: 30, kind: 'narrow' },
    ],
    zones: [
      { type: 'dust', from: 8.3, to: 8.55, lat: 0, width: 200 },
    ],
    hazards: [
      { type: 'debris', at: [0.45, 0.62, 0.8, 8.4, 8.7], count: 1 },
      { type: 'rocks', from: 3.3, to: 3.8, every: 4.5, look: 'scrap' },
      { type: 'probe', from: 6.6, to: 7.6 },
    ],
    music: 'graveyard',
  },

  /* ------------------------------------------------------------------ 10 */
  {
    id: 'grandprix',
    num: 10,
    name: 'Galactic Grand Prix',
    theme: 'grandprix',
    difficulty: 5,
    desc: 'The championship stadium. A full-throttle main straight, a hairpin, fast sweepers and a technical infield under the lights.',
    halfWidth: 165,
    runoff: 85,
    surface: 'track',
    offroad: 'grating',
    start: 0.25,
    points: [
      [-600, 0, 400],     // A
      [4600, 0, 300],     // B  hairpin
      [4600, 700, 300],   // C
      [2800, 700, 550],   // D
      [2800, 2000, 600],  // E
      [4800, 2000, 400],  // F
      [4800, 3200, 400],  // G
      [3600, 3200, 220],  // H  technical infield
      [3600, 2700, 220],  // I
      [2600, 2700, 220],  // J
      [2600, 3600, 300],  // K
      [600, 3600, 700],   // L  sweeper
      [600, 1600, 500],   // M
      [-600, 1600, 450],  // N
    ],
    sections: [
      { from: 7.0, to: 9.6, w: 128, ro: 60, kind: 'technical' },
    ],
    zones: [
      { type: 'boost', at: 0.55, lat: -60, len: 120 },
      { type: 'boost', at: 4.5, lat: 0, len: 120 },
      { type: 'boost', at: 11.5, lat: 60, len: 120 },
    ],
    hazards: [
      { type: 'barrier', at: 2.5, width: 110, speed: 0.6, phase: 0 },
      { type: 'electric', at: 8.5, period: 4.8 },
      { type: 'probe', from: 5.3, to: 5.85 },
      { type: 'probe', from: 12.2, to: 12.8 },
    ],
    music: 'grandprix',
  },
];

export function getTrack(id) {
  return TRACKS.find((t) => t.id === id) || TRACKS[0];
}
