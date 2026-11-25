// The seven locations: lighting/weather presets, race courses, scenery, obstacles, ramps,
// collectibles and hidden places. All scenery is generated from code with seeded randomness.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track } from './racing.js';
import { createDepthTexture } from './water.js';
import { P_SMOKE, P_SPRAY, P_FOAM, P_SPARK } from './effects.js';

// ---------------------------------------------------------------- Helpers
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function vnoise(x, z, seed = 0) {
  const h = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), j = Math.floor(z);
  const fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}
const fbm = (x, z, seed) => vnoise(x, z, seed) * 0.55 + vnoise(x * 2.1, z * 2.1, seed + 3) * 0.3 + vnoise(x * 4.3, z * 4.3, seed + 7) * 0.15;

function colorize(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function prep(geo) {
  // mergeGeometries needs matching attributes: keep position/normal/color only.
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k);
  return geo.index ? geo : geo;
}
function merge(list) {
  return mergeGeometries(list.map((g) => prep(g.index ? g : g)), false);
}

const vcMat = (opts = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...opts });

// ---------------------------------------------------------------- Shared prop geometry
function palmGeometry(seed) {
  const r = rng(seed);
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.16, 0.27, 6.5, 7, 8);
  const pos = trunk.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const bend = 0.8 + r() * 0.8;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + 3.25;
    pos.setX(i, pos.getX(i) + Math.pow(y / 6.5, 2) * bend);
    pos.setY(i, y);
    const ring = (Math.floor(y * 3) % 2) ? 0.85 : 1;
    cols[i * 3] = 0.55 * ring; cols[i * 3 + 1] = 0.4 * ring; cols[i * 3 + 2] = 0.26 * ring;
  }
  trunk.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  trunk.computeVertexNormals();
  parts.push(trunk);
  const top = new THREE.Vector3(bend, 6.5, 0);
  for (let k = 0; k < 8; k++) {
    const leaf = new THREE.PlaneGeometry(0.9, 3.6, 1, 5);
    const lp = leaf.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const y = lp.getY(i) + 1.8; // 0..3.6 along leaf
      const t = y / 3.6;
      lp.setX(i, lp.getX(i) * (1 - t * 0.7));
      lp.setY(i, -t * t * 1.6);
      lp.setZ(i, y);
    }
    leaf.computeVertexNormals();
    colorize(leaf, k % 2 ? '#3f9a3a' : '#2f7d34');
    leaf.rotateY((k / 8) * Math.PI * 2 + r() * 0.3);
    leaf.translate(top.x, top.y, top.z);
    parts.push(leaf);
  }
  for (let k = 0; k < 3; k++) {
    const nut = colorize(new THREE.SphereGeometry(0.16, 6, 5), '#6b4a22');
    nut.translate(top.x + Math.cos(k * 2.1) * 0.25, top.y - 0.25, Math.sin(k * 2.1) * 0.25);
    parts.push(nut);
  }
  return merge(parts);
}

function rockGeometry(seed, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const r = rng(seed);
  const o1 = r() * 10, o2 = r() * 10;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 0.75 + 0.45 * vnoise(x * 1.7 + o1, z * 1.7 + y * 1.3 + o2);
    p.setXYZ(i, x * n, y * n, z * n);
  }
  g.computeVertexNormals();
  return g.index ? g.toNonIndexed() : g;
}

function jungleTreeGeometry(seed) {
  const r = rng(seed);
  const trunk = colorize(new THREE.CylinderGeometry(0.25, 0.4, 9, 6), '#5a4030');
  trunk.translate(0, 4.5, 0);
  const parts = [trunk];
  for (let k = 0; k < 4; k++) {
    const c = colorize(new THREE.IcosahedronGeometry(2.4 + r() * 1.4, 0), ['#2e6b2a', '#3b7f2f', '#25592a', '#4b8a35'][k]);
    c.translate((r() - 0.5) * 3, 8.5 + r() * 2.5, (r() - 0.5) * 3);
    parts.push(c);
  }
  return merge(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}

function buoyGeometry() {
  const body = new THREE.CylinderGeometry(0.45, 0.6, 1.2, 10);
  body.translate(0, 0.3, 0);
  const cone = new THREE.ConeGeometry(0.45, 0.8, 10);
  cone.translate(0, 1.3, 0);
  const band = new THREE.CylinderGeometry(0.47, 0.47, 0.18, 10);
  band.translate(0, 0.65, 0);
  const all = [body, cone, band].map((g) => g.toNonIndexed());
  // White band stays white; the rest takes the instance colour (vertex colour 1 = tint).
  colorize(all[0], '#ffffff'); colorize(all[1], '#ffffff'); colorize(all[2], '#222222');
  return merge(all);
}

function instanced(geo, material, count) {
  const m = new THREE.InstancedMesh(geo, material, count);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- Lighting presets
export const LIGHTING = {
  day: { skyTop: '#2a78d6', horizon: '#bfe8ff', ground: '#1b6a8c', sunElev: 52, sunAz: 35, sunColor: '#fff3dc', sunI: 2.7, hemiSky: '#cfe9ff', hemiGround: '#2a6a7a', hemiI: 1.05, fog: '#c2e6fa', fogD: 0.0013, clouds: 0.3, cloudColor: '#ffffff', cloudShade: '#a9bdd2', night: 0, waveMul: 1, rain: 0, lightning: false, exposure: 0.85, spec: 1, sunSize: 0.0009 },
  sunset: { skyTop: '#33468e', horizon: '#ff9a5a', ground: '#4a3a5a', sunElev: 7, sunAz: -65, sunColor: '#ffb070', sunI: 2.3, hemiSky: '#ffb38a', hemiGround: '#3a3050', hemiI: 0.8, fog: '#eea27a', fogD: 0.0016, clouds: 0.42, cloudColor: '#ffc49a', cloudShade: '#8a5a7a', night: 0, waveMul: 1.05, rain: 0, lightning: false, exposure: 0.9, spec: 1.4, sunSize: 0.0014 },
  night: { skyTop: '#040817', horizon: '#18284a', ground: '#0a1426', sunElev: 38, sunAz: 120, sunColor: '#a8bce8', sunI: 0.55, hemiSky: '#3d4f80', hemiGround: '#0a1020', hemiI: 0.55, fog: '#0e1930', fogD: 0.0021, clouds: 0.2, cloudColor: '#2a3550', cloudShade: '#121a2c', night: 1, waveMul: 1, rain: 0, lightning: false, exposure: 1.15, spec: 0.8, sunSize: 0.0012 },
  rain: { skyTop: '#5b6b7a', horizon: '#9aa8b4', ground: '#3a4a56', sunElev: 40, sunAz: 40, sunColor: '#c8d0d8', sunI: 0.9, hemiSky: '#a8b6c4', hemiGround: '#3a4a50', hemiI: 0.95, fog: '#8a98a6', fogD: 0.0033, clouds: 0.85, cloudColor: '#8d99a6', cloudShade: '#55606c', night: 0, waveMul: 1.25, rain: 0.6, lightning: false, exposure: 0.95, spec: 0.3, sunSize: 0 },
  storm: { skyTop: '#262c34', horizon: '#56616c', ground: '#1e262e', sunElev: 30, sunAz: 40, sunColor: '#a0a8b0', sunI: 0.65, hemiSky: '#6a7684', hemiGround: '#1a2228', hemiI: 0.75, fog: '#47525d', fogD: 0.004, clouds: 0.95, cloudColor: '#5a636e', cloudShade: '#252b33', night: 0, waveMul: 1.6, rain: 1, lightning: true, exposure: 1.0, spec: 0.25, sunSize: 0 },
};

// ---------------------------------------------------------------- Environment definitions
export const ENVIRONMENTS = {
  paradise: {
    id: 'paradise', name: 'Paradise Bay', water: 'Tropical Lagoon', weather: 'day', seed: 11,
    desc: 'Turquoise water, palm-lined beaches and gentle waves around a sleepy island resort.',
    waves: { swellH: 0.4, swellL: 58, chopH: 0.3, chopL: 13, windDeg: 25 },
    colors: { deep: '#0b5f88', shallow: '#2fe0d2', foam: '#ffffff', reefA: '#3fb8a8', reefB: '#f0d9a0' },
    course: { pts: [[0, -250], [170, -235], [290, -140], [300, 10], [220, 120], [230, 230], [110, 300], [-60, 270], [-150, 170], [-280, 150], [-320, 10], [-250, -130], [-130, -200]], length: 1350, hw: 26 },
    ramps: [{ s: 0.3, lat: 0.35 }, { s: 0.72, lat: -0.35 }],
    mega: null,
    places: [{ id: 'paradise-lagoon', name: 'Secret Lagoon' }, { id: 'paradise-wreck', name: 'Shipwreck Cove' }],
  },
  volcano: {
    id: 'volcano', name: 'Volcano Island', water: 'Open Ocean', weather: 'day', seed: 23,
    desc: 'Black rock, lava glow and powerful swells. Thread narrow passages under a smoking volcano.',
    waves: { swellH: 1.1, swellL: 70, chopH: 0.4, chopL: 15, windDeg: 200 },
    colors: { deep: '#0b3b5a', shallow: '#2a8f8f', foam: '#f4f4f4', reefA: '#3a3a3a', reefB: '#5a4a40' },
    tint: { horizon: '#ffbf8a', fog: '#e6b59a' },
    course: { pts: [[0, -300], [210, -230], [310, -60], [250, 90], [320, 220], [160, 320], [0, 250], [-170, 330], [-320, 200], [-260, 40], [-330, -120], [-200, -250]], length: 1500, hw: 22 },
    ramps: [{ s: 0.55, lat: 0.3 }],
    mega: { every: [26, 40], amp: 3.8 },
    places: [{ id: 'volcano-falls', name: 'Lava Falls' }, { id: 'volcano-arch', name: 'Obsidian Arch' }],
  },
  sunset: {
    id: 'sunset', name: 'Sunset Coast', water: 'Open Ocean', weather: 'sunset', seed: 37,
    desc: 'Golden light, rolling waves and towering coastal cliffs with a lighthouse on the point.',
    waves: { swellH: 0.85, swellL: 66, chopH: 0.35, chopL: 14, windDeg: 100 },
    colors: { deep: '#0d3f66', shallow: '#3fb7b5', foam: '#fff4e8', reefA: '#c07a50', reefB: '#e0b080' },
    course: { pts: [[-400, 0], [-250, -120], [0, -160], [250, -110], [420, 0], [380, 150], [200, 210], [0, 180], [-200, 230], [-380, 150]], length: 1450, hw: 28 },
    ramps: [{ s: 0.18, lat: -0.3 }, { s: 0.62, lat: 0.3 }],
    mega: { every: [30, 45], amp: 3.4 },
    places: [{ id: 'sunset-light', name: 'Lighthouse Point' }, { id: 'sunset-cave', name: 'Sea Cave' }],
  },
  jungle: {
    id: 'jungle', name: 'Jungle River', water: 'Jungle River', weather: 'day', seed: 41,
    desc: 'A narrow, flowing river through dense jungle. Duck under bridges and dodge floating logs.',
    waves: { swellH: 0.12, swellL: 40, chopH: 0.16, chopL: 9, windDeg: 0 },
    colors: { deep: '#1f4f45', shallow: '#6f9a58', foam: '#eef2e0', reefA: '#4a6a3a', reefB: '#7a6a4a' },
    tint: { horizon: '#d8f0d0', fog: '#bcd8b8' },
    course: { pts: [[0, -300], [150, -280], [200, -170], [120, -90], [200, 0], [330, 40], [330, 170], [200, 220], [100, 320], [-60, 300], [-120, 190], [-260, 200], [-330, 90], [-250, -20], [-300, -150], [-180, -250]], length: 1400, hw: 15 },
    ramps: [{ s: 0.4, lat: 0 }],
    mega: null,
    river: true,
    places: [{ id: 'jungle-temple', name: 'Temple Ruins' }, { id: 'jungle-falls', name: 'Hidden Falls' }],
  },
  storm: {
    id: 'storm', name: 'Stormbreaker Ocean', water: 'Storm Coast', weather: 'storm', seed: 53,
    desc: 'Dark skies, lightning and huge rough waves. Only the brave race out here.',
    waves: { swellH: 1.3, swellL: 62, chopH: 0.6, chopL: 14, windDeg: 300 },
    colors: { deep: '#123241', shallow: '#3d7a7a', foam: '#e8eef2', reefA: '#3a4a4a', reefB: '#5a6a6a' },
    course: { pts: [[0, -350], [300, -280], [400, -50], [300, 200], [80, 330], [-200, 300], [-380, 120], [-380, -150], [-220, -320]], length: 1600, hw: 32 },
    ramps: [],
    mega: { every: [18, 28], amp: 4.4 },
    places: [{ id: 'storm-eye', name: 'Eye of the Storm' }, { id: 'storm-light', name: 'Lost Lighthouse' }],
  },
  coral: {
    id: 'coral', name: 'Coral Island', water: 'Tropical Lagoon', weather: 'day', seed: 67,
    desc: 'Bright blue water over colourful reefs, with tiny islands and hidden passages.',
    waves: { swellH: 0.3, swellL: 52, chopH: 0.26, chopL: 12, windDeg: 60 },
    colors: { deep: '#0a6fa0', shallow: '#3ff0e0', foam: '#ffffff', reefA: '#ff6f91', reefB: '#ffc94a' },
    course: { pts: [[0, -280], [200, -260], [300, -120], [220, -20], [300, 100], [250, 250], [80, 280], [-20, 170], [-140, 280], [-290, 220], [-300, 40], [-200, -60], [-260, -200], [-130, -270]], length: 1300, hw: 24 },
    ramps: [{ s: 0.45, lat: 0.3 }],
    mega: null,
    reef: true,
    places: [{ id: 'coral-turtle', name: 'Turtle Reef' }, { id: 'coral-pirate', name: "Pirate's Passage" }],
  },
  arena: {
    id: 'arena', name: 'Stunt Arena', water: 'Stunt Arena', weather: 'day', seed: 79, arena: true,
    desc: 'A floating freestyle park with ramps, multiplier rings and giant wave launches.',
    waves: { swellH: 0.55, swellL: 46, chopH: 0.3, chopL: 12, windDeg: 140 },
    colors: { deep: '#0a5c8a', shallow: '#33d6d0', foam: '#ffffff', reefA: '#3fb8a8', reefB: '#f0d9a0' },
    mega: { every: [16, 24], amp: 4.6 },
    places: [{ id: 'arena-sky', name: 'Skyline Ramp' }, { id: 'arena-vip', name: 'VIP Barge' }],
  },
};
export const RACE_ENVS = ['paradise', 'coral', 'sunset', 'volcano', 'jungle', 'storm'];
export const ALL_ENVS = [...RACE_ENVS, 'arena'];

// ---------------------------------------------------------------- Builder
export class Environment {
  constructor(id, ctx) {
    this.def = ENVIRONMENTS[id];
    this.ctx = ctx; // { waves, physics, particles, quality }
    this.group = new THREE.Group();
    this.floating = []; // { obj, x, z, off, phase, collider }
    this.updaters = [];
    this.shells = [];
    this.places = [];
    this.rings = [];
    this.gates = [];
    this.disposables = [];
    this.islands = [];
    this.reefSeed = this.def.seed;
    this.rand = rng(this.def.seed);
    this.time = 0;
    this.q = ctx.quality;
    this.density = this.q === 'high' ? 1 : this.q === 'medium' ? 0.7 : 0.4;
    this.build();
  }

  add(obj) {
    this.group.add(obj);
    obj.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine) {
        this.disposables.push(o.geometry);
        if (Array.isArray(o.material)) this.disposables.push(...o.material); else this.disposables.push(o.material);
      }
    });
    return obj;
  }

  build() {
    const d = this.def;
    const phys = this.ctx.physics;
    phys.clear();
    if (d.course) {
      this.track = new Track(d.course.pts, d.course.hw, d.course.length);
      const t = this.track;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, cx = 0, cz = 0;
      for (let i = 0; i < t.n; i++) {
        minX = Math.min(minX, t.x[i]); maxX = Math.max(maxX, t.x[i]);
        minZ = Math.min(minZ, t.z[i]); maxZ = Math.max(maxZ, t.z[i]);
        cx += t.x[i]; cz += t.z[i];
      }
      this.bbox = { minX, maxX, minZ, maxZ };
      this.center = { x: cx / t.n, z: cz / t.n };
      this.radius = Math.max(maxX - minX, maxZ - minZ) * 0.5 + 230;
      this.spawn = { x: t.x[0], z: t.z[0], yaw: Math.atan2(t.tx[0], t.tz[0]) };
    } else {
      this.bbox = { minX: -240, maxX: 240, minZ: -240, maxZ: 240 };
      this.center = { x: 0, z: 0 };
      this.radius = 235;
      this.spawn = { x: 0, z: -150, yaw: 0 };
    }

    // Course ramps first so the scenery builders can hide shells above them.
    if (this.track) {
      for (const r of d.ramps || []) {
        const i = this.track.indexAt(r.s * this.track.length);
        const p = this.track.offsetPoint(i, r.lat * this.track.halfWidth, { x: 0, z: 0 });
        this.addRamp(p.x, p.z, Math.atan2(this.track.tx[i], this.track.tz[i]), 12, 7, 2.6);
      }
    }
    const builders = { paradise: 'buildParadise', volcano: 'buildVolcano', sunset: 'buildSunset', jungle: 'buildJungle', storm: 'buildStorm', coral: 'buildCoral', arena: 'buildArena' };
    this[builders[d.id]]();
    if (this.track) {
      this.buildCourseMarkers();
      this.buildObstacles();
    }
    this.buildShells();

    // Physical boundary.
    if (!d.river && !this.boundaryFn) {
      const cx = this.center.x, cz = this.center.z, R = this.radius;
      phys.boundary = (b) => {
        const dx = b.pos.x - cx, dz = b.pos.z - cz;
        const dist = Math.hypot(dx, dz);
        if (dist > R) {
          const nx = dx / dist, nz = dz / dist;
          b.pos.x = cx + nx * R; b.pos.z = cz + nz * R;
          const vn = b.vel.x * nx + b.vel.z * nz;
          if (vn > 0) { b.vel.x -= 1.5 * vn * nx; b.vel.z -= 1.5 * vn * nz; }
        }
      };
    } else if (this.boundaryFn) {
      phys.boundary = this.boundaryFn;
    }

    // Seabed / shallows map for the water shader.
    const size = this.q === 'high' ? 512 : this.q === 'medium' ? 384 : 256;
    const span = Math.max(this.bbox.maxX - this.bbox.minX, this.bbox.maxZ - this.bbox.minZ) + 700;
    this.depthRect = { x0: this.center.x - span / 2, z0: this.center.z - span / 2, size: span };
    this.depthTex = createDepthTexture(this.depthRect, (x, z) => this.seabed(x, z), size);
  }

  // [shallowness, reef]
  seabed(x, z) {
    let s = 0;
    for (const isl of this.islands) {
      const dx = x - isl.x, dz = z - isl.z;
      const d = Math.sqrt(dx * dx + dz * dz) - isl.r;
      const reach = isl.shelf ?? isl.r * 0.45 + 22;
      if (d < reach) s = Math.max(s, 1 - Math.max(0, d) / reach);
    }
    if (this.seabedExtra) s = Math.max(s, this.seabedExtra(x, z));
    let reef = 0;
    if (this.def.reef) {
      const n = fbm(x * 0.012, z * 0.012, this.reefSeed);
      reef = smooth(0.48, 0.62, n) * 0.95;
      s = Math.max(s, reef * 0.55);
    } else if (s > 0.3) {
      reef = smooth(0.55, 0.7, fbm(x * 0.03, z * 0.03, this.reefSeed)) * s * 0.6;
    }
    return [s, reef];
  }

  // ---------------------------------------------------------------- Common pieces
  island(x, z, r, h, opts = {}) {
    const sand = new THREE.Color(opts.sand || '#f0dcaa');
    const grass = new THREE.Color(opts.grass || '#4fa64a');
    const rock = new THREE.Color(opts.rock || '#7a7266');
    const pts = [
      new THREE.Vector2(r * 1.35, -3), new THREE.Vector2(r * 1.08, -0.6), new THREE.Vector2(r, 0.25),
      new THREE.Vector2(r * 0.86, 0.8), new THREE.Vector2(r * 0.74, 1.6),
      new THREE.Vector2(r * 0.55, h * 0.55 + 1.6), new THREE.Vector2(r * 0.28, h * 0.92 + 1.6), new THREE.Vector2(0.01, h + 1.6),
    ];
    const seg = this.q === 'low' ? 20 : 36;
    const g = new THREE.LatheGeometry(pts, seg);
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const ph = this.rand() * 10;
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const a = Math.atan2(vz, vx);
      const k = 1 + 0.1 * Math.sin(a * 3 + ph) + 0.05 * Math.sin(a * 7 + ph * 2);
      p.setXYZ(i, vx * k, vy + (vy > 2 ? (vnoise(vx * 0.1 + ph, vz * 0.1) - 0.5) * h * 0.25 : 0), vz * k);
      const yy = p.getY(i);
      if (yy < 1.3) tmp.copy(sand);
      else if (opts.rocky && yy > h * 0.6) tmp.copy(rock);
      else tmp.copy(grass).multiplyScalar(0.85 + 0.3 * vnoise(vx * 0.2, vz * 0.2, 5));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, vcMat({ flatShading: this.q !== 'high' }));
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = true;
    mesh.castShadow = this.q === 'high';
    this.add(mesh);
    this.ctx.physics.addCircle(x, z, r * 0.96, { kind: 'island' });
    const isl = { x, z, r, h, shelf: opts.shelf };
    this.islands.push(isl);
    return isl;
  }

  palms(list) {
    if (!list.length) return;
    const geos = [palmGeometry(1), palmGeometry(2)];
    const m = vcMat({ side: THREE.DoubleSide });
    const halves = [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)];
    const dummy = new THREE.Object3D();
    halves.forEach((arr, k) => {
      if (!arr.length) return;
      const im = instanced(geos[k], m, arr.length);
      arr.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      this.add(im);
    });
  }

  palmsOnIsland(isl, count) {
    const list = [];
    for (let i = 0; i < count; i++) {
      const a = this.rand() * Math.PI * 2;
      const rr = isl.r * (0.45 + this.rand() * 0.4);
      list.push({ x: isl.x + Math.cos(a) * rr, y: 1.2 + (rr < isl.r * 0.6 ? isl.h * 0.25 : 0), z: isl.z + Math.sin(a) * rr, rot: this.rand() * 6.28, s: 0.8 + this.rand() * 0.5 });
    }
    return list;
  }

  rocks(list, color = '#6f6a63', solid = true) {
    if (!list.length) return;
    const geo = colorize(rockGeometry(this.def.seed, this.q === 'low' ? 0 : 1), color);
    const im = instanced(geo, vcMat({ flatShading: true, roughness: 0.95 }), list.length);
    const dummy = new THREE.Object3D();
    list.forEach((r, i) => {
      dummy.position.set(r.x, r.y ?? 0, r.z);
      dummy.rotation.set(this.rand(), this.rand() * 6, this.rand());
      dummy.scale.set(r.s * (r.sx || 1), r.s * (r.sy || 1), r.s * (r.sz || 1));
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (solid && r.s > 1.2) this.ctx.physics.addCircle(r.x, r.z, r.s * (r.sx || 1) * 0.85, { kind: 'rock', top: (r.y ?? 0) + r.s * (r.sy || 1) * 0.8 });
    });
    this.add(im);
  }

  // Scatter islands away from the course.
  scatterIslands(count, rMin, rMax, opts = {}) {
    const t = this.track;
    const out = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 60) {
      const x = this.center.x + (this.rand() - 0.5) * (this.radius * 2 - 60);
      const z = this.center.z + (this.rand() - 0.5) * (this.radius * 2 - 60);
      const r = rMin + this.rand() * (rMax - rMin);
      if (Math.hypot(x - this.center.x, z - this.center.z) > this.radius - r - 20) continue;
      if (t && t.distanceTo(x, z) < r * 1.15 + t.halfWidth + (opts.margin ?? 16)) continue;
      if (this.islands.some((i) => Math.hypot(i.x - x, i.z - z) < i.r + r + 18)) continue;
      out.push(this.island(x, z, r, opts.h ? opts.h * (0.6 + this.rand() * 0.8) : r * 0.25, opts));
    }
    return out;
  }

  // Largest island that fits inside the loop.
  innerIsland(scale = 0.75, opts = {}) {
    const t = this.track;
    let cx = this.center.x, cz = this.center.z;
    let min = Infinity;
    for (let i = 0; i < t.n; i += 3) min = Math.min(min, Math.hypot(t.x[i] - cx, t.z[i] - cz));
    const r = Math.max(20, (min - t.halfWidth - 20) * scale);
    return this.island(cx, cz, r, opts.h ?? r * 0.25, opts);
  }

  hut(x, z, rot, y = 1.2) {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 3), new THREE.MeshStandardMaterial({ color: '#c8a070', roughness: 0.9 }));
    walls.position.y = 1.1;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.2, 4), new THREE.MeshStandardMaterial({ color: '#d9b86a', roughness: 1 }));
    roof.position.y = 3.2;
    roof.rotation.y = Math.PI / 4;
    for (const m of [walls, roof]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    g.position.set(x, y, z);
    g.rotation.y = rot;
    this.add(g);
  }

  dock(x, z, rot, len = 30) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#9a7350', roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, len), wood);
    deck.position.set(0, 1.4, len / 2);
    deck.castShadow = true; deck.receiveShadow = true;
    g.add(deck);
    const postGeo = new THREE.CylinderGeometry(0.18, 0.18, 4, 6);
    for (let i = 0; i <= len; i += 5) {
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(postGeo, wood);
        p.position.set(s * 1.4, -0.3, i);
        g.add(p);
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.add(g);
    for (let i = 0; i <= len; i += 3) {
      this.ctx.physics.addCircle(x + Math.sin(rot) * i, z + Math.cos(rot) * i, 1.8, { kind: 'dock', top: 1.6 });
    }
    return g;
  }

  lighthouse(x, z, y, scale = 1) {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(2.2, 3.4, 22, 16, 6);
    const p = geo.attributes.position;
    const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const band = Math.floor((p.getY(i) + 11) / 3.7) % 2;
      const c = new THREE.Color(band ? '#d8342c' : '#f6f2ea');
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const tower = new THREE.Mesh(geo, vcMat());
    tower.position.y = 11;
    tower.castShadow = true;
    g.add(tower);
    const lampMat = new THREE.MeshStandardMaterial({ color: '#fff6c8', emissive: '#ffe58a', emissiveIntensity: 2 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.4, 12), lampMat);
    lamp.position.y = 23.2;
    g.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 12), new THREE.MeshStandardMaterial({ color: '#2a2a2a' }));
    cap.position.y = 25.6;
    g.add(cap);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    beam.rotation.z = Math.PI / 2;
    beam.position.set(30, 0, 0);
    const beamPivot = new THREE.Group();
    beamPivot.position.y = 23.2;
    beamPivot.add(beam);
    g.add(beamPivot);
    g.position.set(x, y, z);
    g.scale.setScalar(scale);
    this.add(g);
    this.updaters.push((dt) => { beamPivot.rotation.y += dt * 0.8; beam.visible = this.ctx.lighting?.night > 0 || this.ctx.lighting?.sunI < 1; });
    return g;
  }

  waterfall(x, y, z, rot, height, width) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){
          float x = floor(vUv.x * 24.0);
          float streak = fract(vUv.y * 3.0 + uTime * (1.2 + h(vec2(x, 1.0)) * 0.8) + h(vec2(x, 2.0)));
          vec3 c = mix(vec3(0.55,0.8,0.9), vec3(1.0), smoothstep(0.4, 1.0, streak));
          float a = 0.75 * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
          gl_FragColor = vec4(c, a);
          #include <colorspace_fragment>
        }`,
    });
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 1, 1), mat);
    fall.position.set(x, y + height / 2 - 0.5, z);
    fall.rotation.y = rot;
    this.add(fall);
    const px = x, pz = z;
    const fx = Math.sin(rot), fz = Math.cos(rot);
    let acc = 0;
    this.updaters.push((dt) => {
      mat.uniforms.uTime.value = -this.time;
      acc += dt * width * 3 * this.density;
      while (acc > 1) {
        acc -= 1;
        const o = (Math.random() - 0.5) * width;
        this.ctx.particles.emit(px + fz * o + fx * 1.5, y + 0.5, pz - fx * o + fz * 1.5,
          fx * 2 + (Math.random() - 0.5) * 2, 2 + Math.random() * 3, fz * 2 + (Math.random() - 0.5) * 2,
          1.4, 1.5, 4.5, 0.55, 1, 1, 1, 4, 0.8, P_SPRAY);
      }
    });
  }

  addRamp(x, z, yaw, len, width, height, color = '#ffd23f') {
    this.ctx.physics.addRamp(x, z, yaw, len, width, height);
    const base = -0.7;
    const seg = 10;
    const pos = [], col = [], idx = [];
    const c1 = new THREE.Color(color), c2 = new THREE.Color('#1b1f27'), side = new THREE.Color('#e8eef5');
    const push = (px, py, pz, c) => { pos.push(px, py, pz); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
    // Top surface.
    const top = [];
    for (let i = 0; i <= seg; i++) {
      const u = (i / seg) * len;
      const h = base + (height - base) * Math.pow(i / seg, 1.35);
      const c = (i % 2) ? c1 : c2;
      top.push([push(-width / 2, h, u, c), push(width / 2, h, u, c), h, u]);
    }
    for (let i = 0; i < seg; i++) {
      const a = top[i], b = top[i + 1];
      idx.push(a[0], b[0], a[1], a[1], b[0], b[1]);
    }
    // Sides and back.
    for (const sx of [-1, 1]) {
      const ring = [];
      for (let i = 0; i <= seg; i++) {
        const [, , h, u] = top[i];
        ring.push([push(sx * width / 2, h, u, side), push(sx * width / 2, base - 0.3, u, side)]);
      }
      for (let i = 0; i < seg; i++) {
        const a = ring[i], b = ring[i + 1];
        if (sx > 0) idx.push(a[0], a[1], b[0], b[0], a[1], b[1]);
        else idx.push(a[0], b[0], a[1], b[0], b[1], a[1]);
      }
    }
    const bl = push(-width / 2, height, len, side), br = push(width / 2, height, len, side);
    const bl2 = push(-width / 2, base - 0.3, len, side), br2 = push(width / 2, base - 0.3, len, side);
    idx.push(bl, br, bl2, br, br2, bl2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, vcMat({ roughness: 0.6, side: THREE.DoubleSide }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const grp = new THREE.Group();
    grp.add(mesh);
    // Floats.
    const fm = new THREE.MeshStandardMaterial({ color: '#f04a3a', roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, len, 10), fm);
      f.rotation.x = Math.PI / 2;
      f.position.set(sx * (width / 2 + 0.3), -0.3, len / 2);
      grp.add(f);
    }
    grp.position.set(x, 0, z);
    grp.rotation.y = yaw;
    this.add(grp);
    return { x, z, yaw, len, height, top: { x: x + Math.sin(yaw) * len, z: z + Math.cos(yaw) * len } };
  }

  ring(x, y, z, yaw, r = 4) {
    const mat = new THREE.MeshStandardMaterial({ color: '#ff3fa4', emissive: '#ff3fa4', emissiveIntensity: 0.9, roughness: 0.4 });
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.35, 10, 32), mat);
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    this.add(m);
    const ring = { x, y, z, r, mesh: m, mat, nx: Math.sin(yaw), nz: Math.cos(yaw), cool: 0 };
    this.rings.push(ring);
    return ring;
  }

  place(id, x, z, r = 40) {
    const def = this.def.places.find((p) => p.id === id);
    this.places.push({ id, name: def ? def.name : id, x, z, r });
  }

  floatObj(obj, x, z, off, collider) {
    obj.position.set(x, 0, z);
    this.add(obj);
    this.floating.push({ obj, x, z, off, phase: this.rand() * 6.28, collider, rx: obj.rotation.x, rz: obj.rotation.z });
  }

  // ---------------------------------------------------------------- Course markers
  buildCourseMarkers() {
    const t = this.track;
    const hw = t.halfWidth;
    const geo = buoyGeometry();
    const mat = vcMat({ roughness: 0.5 });
    const spacing = this.q === 'low' ? 40 : 28;
    const items = [];
    for (let s = 0; s < t.length; s += spacing) {
      const i = t.indexAt(s);
      for (const side of [1, -1]) {
        const p = t.offsetPoint(i, side * (hw + 3), { x: 0, z: 0 });
        items.push({ x: p.x, z: p.z, c: (Math.round(s / spacing) + (side > 0 ? 0 : 1)) % 2 ? '#ff4d2e' : '#ffd23f' });
      }
    }
    const im = instanced(geo, mat, items.length);
    const col = new THREE.Color();
    items.forEach((it, k) => { im.setColorAt(k, col.set(it.c)); });
    im.instanceColor.needsUpdate = true;
    this.add(im);
    this.buoys = { im, items, dummy: new THREE.Object3D() };
    for (const it of items) this.ctx.physics.addCircle(it.x, it.z, 0.55, { kind: 'buoy', top: 1.4, float: true, bounce: 0.6 });

    // Checkpoint gates (pylons) and the start/finish arch.
    const count = Math.max(6, Math.min(12, Math.round(t.length / 150)));
    for (let k = 0; k < count; k++) {
      const i = t.indexAt((k / count) * t.length);
      const glow = new THREE.MeshStandardMaterial({ color: k === 0 ? '#ffffff' : '#18d6ff', emissive: k === 0 ? '#ffffff' : '#18d6ff', emissiveIntensity: 0.15, roughness: 0.5 });
      const g = new THREE.Group();
      const yaw = Math.atan2(t.tx[i], t.tz[i]);
      for (const side of [1, -1]) {
        const p = t.offsetPoint(i, side * (hw + 1), { x: 0, z: 0 });
        const pylon = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6, 12), glow);
        pylon.position.set(p.x, 2.8, p.z);
        pylon.castShadow = true;
        g.add(pylon);
        this.ctx.physics.addCircle(p.x, p.z, 1.1, { kind: 'pylon', top: 6, bounce: 0.5 });
      }
      if (k === 0) {
        // Inflatable start/finish arch with a checkered banner.
        const arch = new THREE.Mesh(new THREE.TorusGeometry(hw + 1, 1.0, 10, 40, Math.PI), new THREE.MeshStandardMaterial({ color: '#ff3b3b', roughness: 0.5 }));
        const c = t.offsetPoint(i, 0, { x: 0, z: 0 });
        arch.position.set(c.x, 0, c.z);
        arch.rotation.y = yaw;
        arch.scale.set(1, 0.45, 1);
        g.add(arch);
        const cv = document.createElement('canvas');
        cv.width = 512; cv.height = 64;
        const cg = cv.getContext('2d');
        for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) { cg.fillStyle = (x + y) % 2 ? '#111' : '#fff'; cg.fillRect(x * 16, y * 16, 16, 16); }
        cg.fillStyle = '#ffd23f'; cg.fillRect(176, 8, 160, 48);
        cg.fillStyle = '#111'; cg.font = 'bold 34px Oxanium, Arial'; cg.textAlign = 'center'; cg.fillText('FINISH', 256, 45);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(hw * 1.2, 2.4), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
        banner.position.set(c.x, (hw + 1) * 0.45 - 1.5, c.z);
        banner.rotation.y = yaw + Math.PI; // faces racers as they approach
        g.add(banner);
      }
      this.add(g);
      this.gates.push({ group: g, mat: glow, i });
    }
  }

  buildObstacles() {
    const t = this.track;
    const r = this.rand;
    const n = this.def.river ? 16 : 12;
    const logMat = new THREE.MeshStandardMaterial({ color: '#7a5532', roughness: 0.95 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: '#2f6fb0', roughness: 0.6 });
    const crateMat = new THREE.MeshStandardMaterial({ color: '#b88a4a', roughness: 0.9 });
    const rampS = (this.def.ramps || []).map((rp) => rp.s * t.length);
    for (let k = 0; k < n; k++) {
      const s = 160 + (k / n) * (t.length - 220) + (r() - 0.5) * 40;
      if (rampS.some((rs) => Math.abs(rs - s) < 50)) continue;
      const i = t.indexAt(s);
      const lat = (r() - 0.5) * 1.5 * t.halfWidth;
      const p = t.offsetPoint(i, lat, { x: 0, z: 0 });
      const kind = this.def.river ? (r() < 0.65 ? 'log' : 'crate') : ['log', 'barrel', 'crate', 'barrel'][k % 4];
      let obj, col;
      if (kind === 'log') {
        obj = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 4.5, 8), logMat);
        obj.rotation.z = Math.PI / 2;
        obj.rotation.y = r() * Math.PI;
        const g = new THREE.Group(); g.add(obj); obj = g;
        col = this.ctx.physics.addCircle(p.x, p.z, 1.7, { kind: 'log', top: 0.5, float: true, bounce: 0.4 });
      } else if (kind === 'barrel') {
        obj = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 10), barrelMat);
        col = this.ctx.physics.addCircle(p.x, p.z, 0.7, { kind: 'barrel', top: 0.8, float: true, bounce: 0.6 });
      } else {
        obj = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), crateMat);
        col = this.ctx.physics.addCircle(p.x, p.z, 0.9, { kind: 'crate', top: 0.7, float: true, bounce: 0.5 });
      }
      obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.floatObj(obj, p.x, p.z, 0.05, col);
    }
  }

  buildShells() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.15 + 0.7 * (i / 10));
      const rr = i % 2 ? 0.9 : 1;
      shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 });
    geo.center();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffd84a', emissive: '#ffb300', emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.25 });
    const glow = new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.25, depthWrite: false });
    // Exactly five shells per location: top up with spots just off the racing line if needed.
    const spots = (this.shellSpots || []).filter(Boolean).slice(0, 5);
    const t = this.track;
    for (let k = 0; spots.length < 5; k++) {
      if (t) {
        const i = t.indexAt(((k * 0.23 + 0.1) % 1) * t.length);
        const p = t.offsetPoint(i, (k % 2 ? 1 : -1) * (t.halfWidth + 6), { x: 0, z: 0 });
        spots.push({ x: p.x, y: 1.5, z: p.z });
      } else {
        spots.push({ x: Math.cos(k) * 160, y: 1.5, z: Math.sin(k) * 160 });
      }
    }
    spots.forEach((sp, k) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(geo, mat);
      m.scale.setScalar(1.3);
      g.add(m);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(1.9, 12, 8), glow);
      g.add(halo);
      g.position.set(sp.x, sp.y ?? 1.5, sp.z);
      this.add(g);
      this.shells.push({ id: `${this.def.id}-${k}`, x: sp.x, y: sp.y ?? 1.5, z: sp.z, obj: g, air: (sp.y ?? 1.5) > 3 });
    });
  }

  // Shell next to an island, on the side facing away from the course centre.
  shellBehind(isl, extra = 7, y = 1.5) {
    const dx = isl.x - this.center.x, dz = isl.z - this.center.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: isl.x + (dx / d) * (isl.r + extra), y, z: isl.z + (dz / d) * (isl.r + extra) };
  }

  // ---------------------------------------------------------------- Locations
  buildParadise() {
    const main = this.innerIsland(0.72, { h: 14 });
    const palms = this.palmsOnIsland(main, Math.round(46 * this.density));
    const extra = this.scatterIslands(9, 12, 30, { h: 6 });
    for (const i of extra) palms.push(...this.palmsOnIsland(i, Math.round(i.r * 0.35 * this.density) + 1));
    this.palms(palms);
    for (let k = 0; k < 5; k++) {
      const a = k * 0.5 + 0.4;
      this.hut(main.x + Math.cos(a) * main.r * 0.7, main.z + Math.sin(a) * main.r * 0.7, -a, 1.2);
    }
    this.dock(main.x + main.r * 0.95, main.z, Math.PI / 2, 28);
    const rocks = [];
    for (const i of extra) for (let k = 0; k < 3; k++) { const a = this.rand() * 6.28; rocks.push({ x: i.x + Math.cos(a) * i.r, z: i.z + Math.sin(a) * i.r, s: 1 + this.rand() * 2 }); }
    this.rocks(rocks, '#8a8378');
    // Shipwreck in a cove behind the far islands.
    const far = extra.slice().sort((a, b) => Math.hypot(b.x - this.center.x, b.z - this.center.z) - Math.hypot(a.x - this.center.x, a.z - this.center.z))[0] || main;
    const wreckP = this.shellBehind(far, 16, 0);
    this.shipwreck(wreckP.x, wreckP.z);
    this.place('paradise-wreck', wreckP.x, wreckP.z);
    const lagoon = this.shellBehind(main, -main.r * 0.2, 0);
    this.place('paradise-lagoon', main.x, main.z, main.r + 30);
    void lagoon;
    this.shellSpots = [
      this.shellBehind(main, 8), wreckP && { x: wreckP.x + 8, y: 1.5, z: wreckP.z + 8 },
      ...extra.slice(0, 2).map((i) => this.shellBehind(i)),
      this.rampShellSpot(0),
    ].filter(Boolean);
  }

  rampShellSpot(k) {
    const r = this.ctx.physics.ramps[k];
    if (!r) return null;
    return { x: r.x + r.fx * (r.len + 14), y: r.height + 4.5, z: r.z + r.fz * (r.len + 14) };
  }

  shipwreck(x, z) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#5a3e2a', roughness: 1 });
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(3, 2.2, 18, 10, 1, true, 0, Math.PI), wood);
    hull.rotation.set(Math.PI / 2, 0, Math.PI / 2 + 0.4);
    hull.position.y = 0.5;
    g.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 12, 6), wood);
    mast.position.set(0, 5, 2);
    mast.rotation.z = 0.5;
    g.add(mast);
    g.position.set(x, 0, z);
    g.rotation.y = this.rand() * 6;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.add(g);
    this.ctx.physics.addCircle(x, z, 5, { kind: 'rock', top: 4 });
  }

  buildCoral() {
    const isles = this.scatterIslands(16, 8, 22, { h: 5, margin: 10 });
    const inner = this.innerIsland(0.5, { h: 8 });
    const palms = this.palmsOnIsland(inner, Math.round(20 * this.density));
    for (const i of isles) palms.push(...this.palmsOnIsland(i, Math.round(i.r * 0.3 * this.density) + 1));
    this.palms(palms);
    // Reef rocks poking out of the shallows.
    const rocks = [];
    for (let k = 0; k < 40 * this.density; k++) {
      const x = this.center.x + (this.rand() - 0.5) * this.radius * 1.8;
      const z = this.center.z + (this.rand() - 0.5) * this.radius * 1.8;
      if (this.track.distanceTo(x, z) < this.track.halfWidth + 8) continue;
      rocks.push({ x, z, y: -0.5, s: 0.8 + this.rand() * 1.6, sy: 0.6 });
    }
    this.rocks(rocks, '#e7a5a0');
    // Pirate's passage: a narrow channel between two islands, with treasure shells.
    const [a, b] = isles;
    if (a && b) {
      this.place('coral-pirate', (a.x + b.x) / 2, (a.z + b.z) / 2);
      this.place('coral-turtle', isles[2] ? isles[2].x : inner.x, isles[2] ? isles[2].z : inner.z, 45);
    } else {
      this.place('coral-pirate', inner.x + 60, inner.z);
      this.place('coral-turtle', inner.x - 60, inner.z);
    }
    this.shellSpots = [
      this.shellBehind(inner, 6), ...isles.slice(0, 3).map((i) => this.shellBehind(i)), this.rampShellSpot(0),
    ].filter(Boolean);
  }

  buildSunset() {
    const t = this.track;
    const coastZ = this.bbox.maxZ + t.halfWidth + 45;
    const coast = (x) => coastZ + 26 * Math.sin(x / 90) + 12 * Math.sin(x / 37 + 1);
    this.coastLine = coast;
    const W = this.radius * 2 + 400, D = 260;
    const seg = this.q === 'low' ? 90 : 160;
    const g = new THREE.PlaneGeometry(W, D, seg, 40);
    g.rotateX(-Math.PI / 2);
    g.translate(this.center.x, 0, coastZ + D / 2 - 40);
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const rock = new THREE.Color('#a8694a'), grass = new THREE.Color('#6d8f3a'), sand = new THREE.Color('#e8c58e');
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const dz = z - coast(x);
      let h;
      if (dz < 0) h = -6 + dz * 0.05;
      else h = Math.pow(Math.min(1, dz / 16), 0.6) * (34 + 16 * fbm(x * 0.01, z * 0.01, 3)) + (dz > 16 ? fbm(x * 0.03, z * 0.03, 9) * 6 : 0);
      p.setY(i, h);
      if (h < 1.5) c.copy(sand);
      else if (dz < 20) c.copy(rock).multiplyScalar(0.8 + 0.4 * vnoise(x * 0.2, h * 0.3));
      else c.copy(grass).multiplyScalar(0.85 + 0.3 * vnoise(x * 0.05, z * 0.05));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const cliffs = new THREE.Mesh(g, vcMat({ flatShading: true }));
    cliffs.receiveShadow = true;
    this.add(cliffs);
    this.seabedExtra = (x, z) => Math.max(0, 1 - (coast(x) - z) / 45);
    const R = this.radius, cx = this.center.x, cz = this.center.z;
    this.boundaryFn = (b) => {
      const lim = coast(b.pos.x) - 3;
      if (b.pos.z > lim) { b.pos.z = lim; if (b.vel.z > 0) b.vel.z *= -0.5; }
      const dx = b.pos.x - cx, dz = b.pos.z - cz, dist = Math.hypot(dx, dz);
      if (dist > R) { b.pos.x = cx + dx / dist * R; b.pos.z = cz + dz / dist * R; const vn = (b.vel.x * dx + b.vel.z * dz) / dist; if (vn > 0) { b.vel.x -= 1.5 * vn * dx / dist; b.vel.z -= 1.5 * vn * dz / dist; } }
    };
    // Sea stacks.
    const stacks = [];
    for (let k = 0; k < 26; k++) {
      const x = cx + (this.rand() - 0.5) * R * 1.8;
      const z = cz + (this.rand() - 0.5) * R * 1.8;
      if (z > coast(x) - 10 || t.distanceTo(x, z) < t.halfWidth + 14) continue;
      stacks.push({ x, z, y: 2, s: 3 + this.rand() * 4, sy: 2.5 + this.rand() * 2 });
    }
    this.rocks(stacks, '#9a6448');
    for (const s of stacks) this.islands.push({ x: s.x, z: s.z, r: s.s, shelf: 14 });
    const lx = cx + R * 0.35;
    const light = this.lighthouse(lx, coast(lx) + 22, 36);
    void light;
    this.place('sunset-light', lx, coast(lx) - 20);
    const caveX = cx - R * 0.4;
    const cave = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 10, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#1a1210', side: THREE.BackSide }));
    cave.position.set(caveX, 0, coast(caveX) + 2);
    cave.rotation.y = Math.PI;
    this.add(cave);
    this.place('sunset-cave', caveX, coast(caveX) - 12, 30);
    const isles = this.scatterIslands(4, 10, 20, { h: 5, rocky: true, grass: '#7a8f3a' });
    this.palms(isles.flatMap((i) => this.palmsOnIsland(i, Math.round(4 * this.density) + 1)));
    this.shellSpots = [
      { x: caveX, y: 1.5, z: coast(caveX) - 4 }, { x: lx + 8, y: 1.5, z: coast(lx) - 8 },
      ...stacks.slice(0, 2).map((s) => ({ x: s.x + s.s + 4, y: 1.5, z: s.z })), this.rampShellSpot(1),
    ].filter(Boolean);
  }

  buildVolcano() {
    const t = this.track;
    let min = Infinity;
    for (let i = 0; i < t.n; i += 3) min = Math.min(min, Math.hypot(t.x[i] - this.center.x, t.z[i] - this.center.z));
    const R = Math.max(40, min - t.halfWidth - 18);
    const H = R * 1.15;
    const pts = [];
    for (let k = 0; k <= 14; k++) {
      const u = k / 14;
      pts.push(new THREE.Vector2(R * 1.25 * (1 - u) + R * 0.14 * u, -3 + Math.pow(u, 1.4) * (H + 3)));
    }
    pts.push(new THREE.Vector2(R * 0.1, H - 6));
    const g = new THREE.LatheGeometry(pts, this.q === 'low' ? 24 : 48);
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + 0.08 * Math.sin(a * 5) + 0.06 * (vnoise(x * 0.05, z * 0.05) - 0.5) * 2;
      p.setXYZ(i, x * k, y + (vnoise(x * 0.04, z * 0.04, 2) - 0.5) * 6 * (y > 2 ? 1 : 0), z * k);
      c.set(y < 1.2 ? '#2a2624' : '#3b3532').multiplyScalar(0.8 + 0.4 * vnoise(x * 0.1, y * 0.1));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const volcano = new THREE.Mesh(g, vcMat({ flatShading: true }));
    volcano.position.set(this.center.x, 0, this.center.z);
    volcano.receiveShadow = true;
    this.add(volcano);
    this.ctx.physics.addCircle(this.center.x, this.center.z, R * 1.08, { kind: 'island' });
    this.islands.push({ x: this.center.x, z: this.center.z, r: R * 1.1, shelf: 30 });
    // Lava streams.
    const lavaMat = new THREE.MeshStandardMaterial({ color: '#ff5a1a', emissive: '#ff4a10', emissiveIntensity: 2.2, roughness: 0.6 });
    this.lavaMat = lavaMat;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + this.rand();
      const curvePts = [];
      for (let s = 0; s <= 8; s++) {
        const u = s / 8;
        const rr = R * (0.12 + u * 0.9);
        const y = H * Math.pow(1 - u, 1.2) - 1;
        curvePts.push(new THREE.Vector3(this.center.x + Math.cos(a + u * 0.4) * rr, y + 0.6, this.center.z + Math.sin(a + u * 0.4) * rr));
      }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), 24, 1.6, 6), lavaMat);
      this.add(tube);
    }
    const glow = new THREE.PointLight('#ff6a2a', 3, R * 2.5, 1.2);
    glow.position.set(this.center.x, H + 6, this.center.z);
    this.group.add(glow);
    let acc = 0;
    this.updaters.push((dt) => {
      lavaMat.emissiveIntensity = 2 + Math.sin(this.time * 2) * 0.5;
      acc += dt * 14 * this.density;
      while (acc > 1) {
        acc -= 1;
        this.ctx.particles.emit(this.center.x + (Math.random() - 0.5) * R * 0.2, H - 2, this.center.z + (Math.random() - 0.5) * R * 0.2,
          (Math.random() - 0.5) * 2 + 2, 6 + Math.random() * 4, (Math.random() - 0.5) * 2, 9, 12, 40, 0.5, 0.22, 0.2, 0.2, -0.3, 0.15, P_SMOKE);
        if (Math.random() < 0.15) this.ctx.particles.emit(this.center.x, H - 3, this.center.z, (Math.random() - 0.5) * 16, 18 + Math.random() * 10, (Math.random() - 0.5) * 16, 2.5, 1.5, 0.8, 1, 1, 0.45, 0.1, 9.8, 0.1, P_SPARK);
      }
    });
    // Narrow passages: rock pillars squeezing the course.
    const pillars = [];
    for (const s of [0.12, 0.38, 0.62, 0.86]) {
      const i = t.indexAt(s * t.length);
      for (const side of [1, -1]) {
        const pt = t.offsetPoint(i, side * (t.halfWidth * 0.62 + 6), { x: 0, z: 0 });
        pillars.push({ x: pt.x, z: pt.z, y: 3, s: 5, sy: 2.4 });
      }
    }
    const outer = [];
    for (let k = 0; k < 30; k++) {
      const x = this.center.x + (this.rand() - 0.5) * this.radius * 1.9;
      const z = this.center.z + (this.rand() - 0.5) * this.radius * 1.9;
      if (t.distanceTo(x, z) < t.halfWidth + 16 || Math.hypot(x - this.center.x, z - this.center.z) < R * 1.3) continue;
      outer.push({ x, z, y: 1, s: 3 + this.rand() * 6, sy: 1.2 + this.rand() * 1.5 });
    }
    this.rocks([...pillars, ...outer], '#2f2b29');
    for (const o of outer) this.islands.push({ x: o.x, z: o.z, r: o.s, shelf: 10 });
    // Waterfalls from the volcano flank (Lava Falls) and an arch.
    const wa = 0.7;
    const wx = this.center.x + Math.cos(wa) * R * 1.0, wz = this.center.z + Math.sin(wa) * R * 1.0;
    this.waterfall(wx, 0, wz, -wa + Math.PI / 2, 24, 10);
    this.place('volcano-falls', wx + Math.cos(wa) * 20, wz + Math.sin(wa) * 20);
    const archA = outer[0] || { x: this.center.x + this.radius * 0.7, z: this.center.z };
    const arch = new THREE.Mesh(new THREE.TorusGeometry(10, 2.6, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: '#25211f', roughness: 1, flatShading: true }));
    arch.position.set(archA.x + 20, 0, archA.z);
    this.add(arch);
    this.ctx.physics.addCircle(archA.x + 10, archA.z, 2.6, { kind: 'rock' });
    this.ctx.physics.addCircle(archA.x + 30, archA.z, 2.6, { kind: 'rock' });
    this.place('volcano-arch', archA.x + 20, archA.z);
    this.shellSpots = [
      { x: archA.x + 20, y: 2, z: archA.z }, { x: wx + Math.cos(wa) * 6, y: 1.5, z: wz + Math.sin(wa) * 6 },
      ...outer.slice(1, 3).map((o) => ({ x: o.x + o.s + 4, y: 1.5, z: o.z })), this.rampShellSpot(0),
    ].filter(Boolean);
  }

  buildJungle() {
    const t = this.track;
    const hw = t.halfWidth;
    const span = this.radius * 2 + 200;
    const seg = this.q === 'low' ? 110 : this.q === 'medium' ? 150 : 200;
    const g = new THREE.PlaneGeometry(span, span, seg, seg);
    g.rotateX(-Math.PI / 2);
    g.translate(this.center.x, 0, this.center.z);
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const mud = new THREE.Color('#7a6044'), green = new THREE.Color('#3f7a2e'), dark = new THREE.Color('#2a5520');
    const c = new THREE.Color();
    let hint = -1;
    const land = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      hint = t.nearest(x, z, hint);
      const d = Math.hypot(t.x[hint] - x, t.z[hint] - z);
      let h;
      if (d < hw + 1) h = -4;
      else if (d < hw + 9) h = -4 + smooth(hw + 1, hw + 9, d) * 6.5;
      else h = 2.5 + fbm(x * 0.02, z * 0.02, 4) * 6 + smooth(hw + 9, hw + 40, d) * 3;
      p.setY(i, h);
      if (h < 1.5) c.copy(mud);
      else c.copy(green).lerp(dark, fbm(x * 0.05, z * 0.05, 1));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      if (d > hw + 14 && (i % 7) === 0) land.push([x, h, z, d]);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, vcMat({ flatShading: this.q !== 'high' }));
    ground.receiveShadow = true;
    this.add(ground);
    // Trees.
    const treeCount = Math.round(520 * this.density);
    const geo = jungleTreeGeometry(3);
    const im = instanced(geo, vcMat({ flatShading: true }), Math.min(treeCount, land.length));
    const dummy = new THREE.Object3D();
    const palms = [];
    for (let k = 0; k < im.count; k++) {
      const [x, h, z, d] = land[Math.floor(this.rand() * land.length)];
      dummy.position.set(x + (this.rand() - 0.5) * 6, h - 0.5, z + (this.rand() - 0.5) * 6);
      dummy.rotation.y = this.rand() * 6.28;
      dummy.scale.setScalar(0.7 + this.rand() * 0.7 + (d > hw + 50 ? 0.4 : 0));
      dummy.updateMatrix();
      im.setMatrixAt(k, dummy.matrix);
      if (d < hw + 30 && this.rand() < 0.2) palms.push({ x: x + 3, y: h - 0.3, z: z + 3, rot: this.rand() * 6, s: 0.9 });
    }
    im.castShadow = this.q !== 'low';
    this.add(im);
    this.palms(palms);
    // River banks are solid; the current flows along the course.
    this.boundaryFn = (b) => {
      const i = t.nearest(b.pos.x, b.pos.z, b._ri ?? -1);
      b._ri = i;
      const lat = t.lateral(b.pos.x, b.pos.z, i);
      const lim = hw + 2.5;
      if (Math.abs(lat) > lim) {
        const s = Math.sign(lat);
        const nx = t.tz[i] * s, nz = -t.tx[i] * s;
        const pen = Math.abs(lat) - lim;
        b.pos.x -= nx * pen; b.pos.z -= nz * pen;
        const vn = b.vel.x * nx + b.vel.z * nz;
        if (vn > 0) {
          b.vel.x -= 1.4 * vn * nx; b.vel.z -= 1.4 * vn * nz;
          if (vn > 4 && (!b.events.hit || vn > b.events.hit.speed)) b.events.hit = { speed: vn, kind: 'bank' };
        }
      }
    };
    let ch = -1;
    this.ctx.physics.currentFn = (x, z, out) => {
      ch = t.nearest(x, z, ch);
      out.x = t.tx[ch] * 2.2; out.z = t.tz[ch] * 2.2;
      return out;
    };
    this.seabedExtra = (x, z) => {
      const d = t.distanceTo(x, z);
      return 0.35 + smooth(hw - 6, hw + 2, d) * 0.45;
    };
    // Bridges.
    const wood = new THREE.MeshStandardMaterial({ color: '#8a6440', roughness: 0.9 });
    const rope = new THREE.MeshStandardMaterial({ color: '#c8b080', roughness: 1 });
    for (const s of [0.22, 0.58, 0.83]) {
      const i = t.indexAt(s * t.length);
      const br = new THREE.Group();
      const len = hw * 2 + 14;
      for (let k = 0; k < 16; k++) {
        const u = k / 15 - 0.5;
        const plank = new THREE.Mesh(new THREE.BoxGeometry(len / 15, 0.25, 3), wood);
        plank.position.set(u * len, 8 - Math.cos(u * Math.PI) * 2.5 + 2.5, 0);
        plank.castShadow = true;
        br.add(plank);
      }
      for (const side of [-1.5, 1.5]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.12), rope);
        r.position.set(0, 10, side);
        br.add(r);
      }
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 12, 6), wood);
        post.position.set(sx * len / 2, 4, 0);
        br.add(post);
      }
      br.position.set(t.x[i], 0, t.z[i]);
      br.rotation.y = Math.atan2(t.tx[i], t.tz[i]) + Math.PI / 2;
      this.add(br);
    }
    // Waterfalls into the river.
    const falls = [];
    for (const s of [0.33, 0.7]) {
      const i = t.indexAt(s * t.length);
      const side = s < 0.5 ? 1 : -1;
      const pt = t.offsetPoint(i, side * (hw + 3), { x: 0, z: 0 });
      const cliff = new THREE.Mesh(new THREE.BoxGeometry(18, 16, 10), new THREE.MeshStandardMaterial({ color: '#5e584e', roughness: 1, flatShading: true }));
      const out = t.offsetPoint(i, side * (hw + 9), { x: 0, z: 0 });
      cliff.position.set(out.x, 6, out.z);
      cliff.rotation.y = Math.atan2(t.tx[i], t.tz[i]);
      this.add(cliff);
      const rot = Math.atan2(t.tx[i], t.tz[i]) + Math.PI / 2 * side;
      this.waterfall(pt.x, -0.5, pt.z, rot + Math.PI / 2, 14.5, 9);
      falls.push(pt);
    }
    this.place('jungle-falls', falls[1].x, falls[1].z, 30);
    // Temple ruins on a bank.
    const ti = t.indexAt(0.08 * t.length);
    const tp = t.offsetPoint(ti, -(hw + 20), { x: 0, z: 0 });
    const stone = new THREE.MeshStandardMaterial({ color: '#8c8a78', roughness: 1, flatShading: true });
    const temple = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(18 - k * 4, 3, 18 - k * 4), stone);
      step.position.y = 2 + k * 3;
      temple.add(step);
    }
    for (let k = 0; k < 6; k++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 7, 8), stone);
      col.position.set(-10 + k * 4, 3, 12);
      col.rotation.z = (this.rand() - 0.5) * 0.3;
      temple.add(col);
    }
    temple.position.set(tp.x, 0, tp.z);
    temple.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.add(temple);
    this.place('jungle-temple', tp.x, tp.z, 45);
    const sp = (s, lat, y = 1.5) => { const i = t.indexAt(s * t.length); const q = t.offsetPoint(i, lat, { x: 0, z: 0 }); return { x: q.x, y, z: q.z }; };
    this.shellSpots = [
      { x: falls[0].x, y: 1.5, z: falls[0].z }, sp(0.22, 0, 2), sp(0.5, hw * 0.8), sp(0.92, -hw * 0.8), this.rampShellSpot(0),
    ].filter(Boolean);
  }

  buildStorm() {
    const t = this.track;
    const rocks = [];
    for (let k = 0; k < 24; k++) {
      const x = this.center.x + (this.rand() - 0.5) * this.radius * 1.9;
      const z = this.center.z + (this.rand() - 0.5) * this.radius * 1.9;
      if (t.distanceTo(x, z) < t.halfWidth + 18) continue;
      rocks.push({ x, z, y: 1, s: 4 + this.rand() * 7, sy: 1.6 + this.rand() * 1.5 });
    }
    this.rocks(rocks, '#3c4246');
    for (const r of rocks) this.islands.push({ x: r.x, z: r.z, r: r.s, shelf: 12 });
    const li = rocks[0] || { x: this.center.x + 200, z: this.center.z };
    const isl = this.island(li.x + 40, li.z + 40, 16, 6, { rocky: true, grass: '#4a5a46', sand: '#7a7a70' });
    this.lighthouse(isl.x, isl.z, 2.5);
    this.place('storm-light', isl.x, isl.z, isl.r + 35);
    this.place('storm-eye', this.center.x, this.center.z, 50);
    // Big floating markers in the middle of the loop.
    const inner = this.innerIsland(0.35, { h: 4, rocky: true, grass: '#4a5a46', sand: '#6a6a62' });
    this.shellSpots = [
      { x: this.center.x + inner.r + 10, y: 1.5, z: this.center.z }, this.shellBehind(isl, 8),
      ...rocks.slice(1, 3).map((r) => ({ x: r.x + r.s + 5, y: 1.5, z: r.z })),
      { x: this.center.x - inner.r - 10, y: 1.5, z: this.center.z },
    ];
  }

  buildArena() {
    const R = this.radius - 10;
    // Ring of buoys marking the arena.
    const geo = buoyGeometry();
    const n = 72;
    const im = instanced(geo, vcMat({ roughness: 0.5 }), n);
    const col = new THREE.Color();
    const items = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      items.push({ x: Math.cos(a) * R, z: Math.sin(a) * R });
      im.setColorAt(k, col.set(k % 2 ? '#ff3fa4' : '#18d6ff'));
    }
    im.instanceColor.needsUpdate = true;
    this.add(im);
    this.buoys = { im, items, dummy: new THREE.Object3D() };
    // Ramps: an outer ring of kickers and two big launchers.
    const ramps = [];
    // The giant Skyline Ramp launches across the middle of the arena (5-second airtime territory).
    ramps.push(this.addRamp(0, -100, 0, 26, 10, 9, '#ff3fa4'));
    ramps.push(this.addRamp(60, 40, Math.PI, 18, 9, 4.6, '#ff3fa4'));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const x = Math.cos(a) * 130, z = Math.sin(a) * 130;
      ramps.push(this.addRamp(x, z, a + Math.PI, 12, 7, 2.6 + (k % 2) * 0.8, k % 2 ? '#18d6ff' : '#ffd23f'));
    }
    // Multiplier rings floating beyond ramp lips.
    for (const r of ramps) {
      const dx = Math.sin(r.yaw), dz = Math.cos(r.yaw);
      this.ring(r.top.x + dx * 12, r.height + 5.5, r.top.z + dz * 12, r.yaw, 4.5);
    }
    // Grandstand barges.
    const seatMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 });
    const bargeMat = new THREE.MeshStandardMaterial({ color: '#2b3340', roughness: 0.8 });
    const crowdCols = ['#ff4d2e', '#ffd23f', '#18d6ff', '#9dd31f', '#ff3fa4', '#ffffff'];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const g = new THREE.Group();
      const barge = new THREE.Mesh(new THREE.BoxGeometry(40, 2, 12), bargeMat);
      barge.position.y = 0.5;
      g.add(barge);
      for (let row = 0; row < 4; row++) {
        const tier = new THREE.Mesh(new THREE.BoxGeometry(38, 1, 2.4), seatMat);
        tier.position.set(0, 2 + row * 1.2, -3 + row * 2.2);
        g.add(tier);
      }
      const crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.3, 0.6, 2, 6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 60);
      const d = new THREE.Object3D();
      for (let i = 0; i < 60; i++) {
        const row = i % 4;
        d.position.set(-18 + (i * 0.6) % 36 + this.rand() * 0.5, 3.1 + row * 1.2, -3 + row * 2.2);
        d.updateMatrix();
        crowd.setMatrixAt(i, d.matrix);
        crowd.setColorAt(i, col.set(crowdCols[(i * 7) % crowdCols.length]));
      }
      g.add(crowd);
      const flagM = new THREE.MeshStandardMaterial({ color: crowdCols[k], side: THREE.DoubleSide });
      for (const sx of [-18, 18]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 12, 6), seatMat);
        pole.position.set(sx, 7, 5);
        g.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), flagM);
        flag.position.set(sx + 1.5, 12, 5);
        g.add(flag);
      }
      g.position.set(Math.cos(a) * (R + 30), 0, Math.sin(a) * (R + 30));
      g.rotation.y = -a - Math.PI / 2;
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.add(g);
      this.updaters.push(() => { g.position.y = this.ctx.waves.heightAt(g.position.x, g.position.z) * 0.4; });
      if (k === 0) this.place('arena-vip', g.position.x * 0.85, g.position.z * 0.85, 30);
    }
    this.place('arena-sky', 0, -60, 24);
    const isl = [];
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + 0.5;
      isl.push(this.island(Math.cos(a) * 330, Math.sin(a) * 330, 26, 7));
    }
    this.palms(isl.flatMap((i) => this.palmsOnIsland(i, Math.round(10 * this.density) + 2)));
    this.shellSpots = [
      { x: 0, y: 24, z: 0 }, { x: 60, y: 9, z: 10 }, this.rampShellSpot(2), this.rampShellSpot(5),
      { x: Math.cos(Math.PI / 4) * (R - 12), y: 1.5, z: Math.sin(Math.PI / 4) * (R - 12) },
    ].filter(Boolean);
  }

  // ---------------------------------------------------------------- Per-frame
  update(dt, cam) {
    this.time += dt;
    const waves = this.ctx.waves;
    for (const f of this.floating) {
      const h = waves.heightAt(f.x, f.z);
      f.obj.position.y = h + f.off;
      f.obj.rotation.x = f.rx + Math.sin(this.time * 1.3 + f.phase) * 0.12;
      f.obj.rotation.z = f.rz + Math.cos(this.time * 1.1 + f.phase) * 0.12;
      if (f.collider) f.collider.y = h;
    }
    if (this.buoys) {
      const { im, items, dummy } = this.buoys;
      const cx = cam.x, cz = cam.z;
      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        const near = (it.x - cx) * (it.x - cx) + (it.z - cz) * (it.z - cz) < 260 * 260;
        const h = near ? waves.heightAt(it.x, it.z) : 0;
        dummy.position.set(it.x, h - 0.2, it.z);
        dummy.rotation.set(Math.sin(this.time * 1.7 + k) * 0.12, 0, Math.cos(this.time * 1.3 + k) * 0.12);
        dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    }
    for (const s of this.shells) {
      if (s.taken) continue;
      s.obj.rotation.y += dt * 2;
      s.obj.position.y = s.y + Math.sin(this.time * 2 + s.x) * 0.25 + (s.air ? 0 : Math.max(0, waves.heightAt(s.x, s.z)));
    }
    for (const r of this.rings) {
      r.cool = Math.max(0, r.cool - dt);
      r.mat.emissiveIntensity = r.cool > 0 ? 2.5 : 0.8 + Math.sin(this.time * 4) * 0.3;
    }
    for (const u of this.updaters) u(dt);
  }

  highlightGate(k) {
    this.gates.forEach((g, i) => { g.mat.emissiveIntensity = i === k ? 1.4 + Math.sin(this.time * 6) * 0.4 : 0.15; });
  }

  dispose() {
    for (const d of this.disposables) d.dispose && d.dispose();
    if (this.depthTex) this.depthTex = null; // the water owns and disposes it
    this.group.removeFromParent();
  }
}
