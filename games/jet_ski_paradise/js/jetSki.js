// Procedural jet ski models. Every hull is lofted from cross-sections, so the eight models
// differ in proportions and accessories, and the livery (colour, graphics, decal, racing
// number) is painted into a canvas texture.
import * as THREE from 'three';
import { FINISHES, EXHAUSTS, skiById } from './data.js';

const texCache = new Map();

// ---------------------------------------------------------------- Livery texture
function drawDecal(ctx, id, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.08;
  switch (id) {
    case 'hibiscus':
      for (let i = 0; i < 5; i++) {
        ctx.rotate((Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.28, s * 0.2, s * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, Math.PI * 2); ctx.fill();
      break;
    case 'star':
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? s * 0.2 : s * 0.48;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      break;
    case 'wave':
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, s * 0.1);
      ctx.bezierCurveTo(-s * 0.2, -s * 0.4, s * 0.25, -s * 0.35, s * 0.2, s * 0.05);
      ctx.bezierCurveTo(s * 0.05, -s * 0.12, -s * 0.1, 0, -s * 0.05, s * 0.2);
      ctx.closePath(); ctx.fill();
      break;
    case 'sun':
      ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.fillRect(-s * 0.03, -s * 0.48, s * 0.06, s * 0.2);
      }
      break;
    case 'shark':
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, s * 0.25);
      ctx.quadraticCurveTo(-s * 0.05, -s * 0.05, s * 0.1, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.12, -s * 0.05, s * 0.5, s * 0.25);
      ctx.closePath(); ctx.fill();
      break;
    case 'lightning':
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.5); ctx.lineTo(-s * 0.25, s * 0.05); ctx.lineTo(0, s * 0.05);
      ctx.lineTo(-s * 0.12, s * 0.5); ctx.lineTo(s * 0.28, -s * 0.08); ctx.lineTo(s * 0.03, -s * 0.08);
      ctx.closePath(); ctx.fill();
      break;
    case 'turtle':
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.3, s * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -s * 0.46, s * 0.1, 0, Math.PI * 2); ctx.fill();
      for (const [fx, fy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath(); ctx.ellipse(fx * s * 0.32, fy * s * 0.25, s * 0.14, s * 0.07, fx * fy * 0.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.14, 0, Math.PI * 2); ctx.fill();
      break;
    case 'crown':
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, s * 0.3); ctx.lineTo(-s * 0.45, -s * 0.2); ctx.lineTo(-s * 0.22, s * 0.02);
      ctx.lineTo(0, -s * 0.38); ctx.lineTo(s * 0.22, s * 0.02); ctx.lineTo(s * 0.45, -s * 0.2); ctx.lineTo(s * 0.45, s * 0.3);
      ctx.closePath(); ctx.fill();
      break;
    default:
      break;
  }
  ctx.restore();
}

function drawGraphic(ctx, id, W, H, main, second) {
  ctx.fillStyle = main;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = second;
  ctx.strokeStyle = second;
  // Texture layout: x runs stern (0) to bow (W); y runs around the hull, left side top half, right side bottom half.
  const band = (y0, y1) => ctx.fillRect(0, y0 * H, W, (y1 - y0) * H);
  switch (id) {
    case 'stripes':
      band(0.2, 0.26); band(0.3, 0.33); band(0.67, 0.7); band(0.74, 0.8);
      band(0.47, 0.53);
      break;
    case 'split':
      band(0.28, 0.5); band(0.5, 0.72);
      break;
    case 'waves':
      for (const flip of [0, 1]) {
        ctx.beginPath();
        const base = flip ? 0.72 : 0.28;
        ctx.moveTo(0, base * H);
        for (let x = 0; x <= W; x += 8) ctx.lineTo(x, (base + (flip ? -1 : 1) * (0.06 + 0.05 * Math.sin(x / 42))) * H);
        ctx.lineTo(W, flip ? H : 0); ctx.lineTo(0, flip ? H : 0);
        ctx.closePath(); ctx.fill();
      }
      break;
    case 'flames':
      for (const flip of [0, 1]) {
        for (let i = 0; i < 9; i++) {
          const y = (flip ? 0.75 : 0.25) * H;
          const len = W * (0.25 + 0.35 * ((i * 37) % 10) / 10);
          const off = (i - 4) * H * 0.022;
          ctx.beginPath();
          ctx.moveTo(W, y + off - H * 0.03);
          ctx.quadraticCurveTo(W - len * 0.5, y + off - H * 0.06, W - len, y + off + (i % 2 ? 1 : -1) * H * 0.02);
          ctx.quadraticCurveTo(W - len * 0.55, y + off + H * 0.02, W, y + off + H * 0.03);
          ctx.fill();
        }
      }
      break;
    case 'tribal':
      ctx.lineWidth = H * 0.025;
      ctx.lineCap = 'round';
      for (const flip of [0, 1]) {
        const y = (flip ? 0.74 : 0.26) * H;
        for (let i = 0; i < 6; i++) {
          const x = W * (0.12 + i * 0.15);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.bezierCurveTo(x + 40, y - 30, x + 80, y + 30, x + 120, y);
          ctx.stroke();
          ctx.beginPath(); ctx.arc(x + 60, y + (i % 2 ? 18 : -18), H * 0.018, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    case 'lightning':
      ctx.lineWidth = H * 0.03;
      ctx.lineJoin = 'miter';
      for (const flip of [0, 1]) {
        const y = (flip ? 0.75 : 0.25) * H;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= W; x += 60) ctx.lineTo(x, y + ((x / 60) % 2 ? -1 : 1) * H * 0.05);
        ctx.stroke();
      }
      break;
    case 'checker': {
      const s = H * 0.045;
      for (const y0 of [0.22, 0.68]) {
        for (let r = 0; r < 2; r++) {
          for (let x = 0; x < W; x += s * 2) ctx.fillRect(x + (r ? s : 0), y0 * H + r * s, s, s);
        }
      }
      break;
    }
    default:
      break;
  }
}

export function liveryTexture(c) {
  const key = [c.main, c.secondary, c.graphic, c.decal, c.number].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  drawGraphic(ctx, c.graphic, W, H, c.main, c.secondary);
  // Deck centre stripe area left plain; decals on each side panel.
  const contrast = c.decalColor || (luminance(c.main) > 0.55 ? c.secondary : '#ffffff');
  // Canvas top half = right side (appears upside down), bottom half = left side (appears mirrored).
  for (const y of [0.22, 0.78]) {
    if (c.decal && c.decal !== 'none') drawDecal(ctx, c.decal, W * 0.62, H * y, H * 0.16, contrast);
    // Racing number in a roundel near the bow.
    const nx = W * 0.82, ny = H * y;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(nx, ny, H * 0.075, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.font = `bold ${Math.round(H * 0.095)}px Oxanium, Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(nx, ny);
    if (y > 0.5) ctx.scale(-1, 1);
    else ctx.scale(1, -1);
    ctx.fillText(String(c.number ?? 7), 0, H * 0.005);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (texCache.size > 40) {
    const first = texCache.keys().next().value;
    texCache.get(first).dispose();
    texCache.delete(first);
  }
  texCache.set(key, tex);
  return tex;
}

function luminance(hex) {
  const c = new THREE.Color(hex);
  return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
}

// ---------------------------------------------------------------- Hull loft
// Cross-section profile (one side), from the deck centreline down to the keel.
// Each entry: [x fraction of half-width, y fraction between keel (0) and deck (1)], side first.
const UPPER = [[1.0, 0.52], [0.96, 0.72], [0.78, 0.9], [0.45, 0.98], [0, 1]];
const LOWER = [[1.0, 0.52], [0.98, 0.36], [0.82, 0.22], [0.5, 0.1], [0, 0]];

function stationAt(t, shape) {
  // t: 0 stern -> 1 bow. Returns half-width, deck height, keel height, z.
  const len = shape.len;
  const z = -len / 2 + t * len;
  const bow = Math.max(0, (t - (1 - shape.nose)) / shape.nose);
  const width = shape.width / 2 * (t < 0.08 ? 0.93 + t : 1) * (1 - Math.pow(bow, 1.8) * 0.94);
  const keel = -0.28 + Math.pow(bow, 1.6) * shape.rake;
  const deckBase = 0.12 + shape.deck * 0.35;
  const deck = deckBase + Math.sin(Math.min(1, bow * 1.1) * Math.PI * 0.5) * -0.02 + (t > 0.55 && t < 0.85 ? 0.06 * Math.sin((t - 0.55) / 0.3 * Math.PI) : 0);
  return { width: Math.max(width, 0.015), deck, keel, z };
}

function loftPart(shape, profile, stations, vRange, flip) {
  const n = profile.length;
  const ringCount = n * 2 - 1; // left side -> centre -> right side
  const pos = [];
  const uv = [];
  for (let s = 0; s <= stations; s++) {
    const t = s / stations;
    const st = stationAt(t, shape);
    for (let k = 0; k < ringCount; k++) {
      const left = k < n;
      const p = left ? profile[k] : profile[2 * n - 2 - k];
      const side = left ? 1 : -1;
      const x = p[0] * st.width * side;
      const y = st.keel + (st.deck - st.keel) * p[1];
      pos.push(x, y, st.z);
      // Around-hull v: left side maps into the upper half of the texture, right into the lower.
      const f = k / (ringCount - 1);
      uv.push(t, vRange[0] + (vRange[1] - vRange[0]) * f);
    }
  }
  const idx = [];
  for (let s = 0; s < stations; s++) {
    for (let k = 0; k < ringCount - 1; k++) {
      const a = s * ringCount + k;
      const b = a + ringCount;
      if (flip) idx.push(a, b, a + 1, a + 1, b, b + 1);
      else idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function transomGeometry(shape) {
  const st = stationAt(0, shape);
  const pts = [];
  for (const p of [...UPPER.slice().reverse(), ...LOWER.slice(1)]) pts.push(new THREE.Vector2(p[0] * st.width, st.keel + (st.deck - st.keel) * p[1]));
  const outline = [...pts, ...pts.slice().reverse().map((v) => new THREE.Vector2(-v.x, v.y))];
  const g = new THREE.ShapeGeometry(new THREE.Shape(outline));
  g.rotateY(Math.PI);
  g.translate(0, 0, st.z + 0.002);
  return g;
}

// ---------------------------------------------------------------- Materials
function paintMaterial(color, finishId, map) {
  const f = FINISHES.find((x) => x.id === finishId) || FINISHES[0];
  const params = { color: map ? 0xffffff : color, map: map || null, roughness: f.rough, metalness: f.metal };
  if (f.clearcoat) { params.clearcoat = 1; params.clearcoatRoughness = 0.08; }
  if (f.emissive) { params.emissive = new THREE.Color(color); params.emissiveIntensity = f.emissive; if (map) params.emissiveMap = map; }
  return new THREE.MeshPhysicalMaterial(params);
}

const shared = {};
function sharedMat(name, make) {
  if (!shared[name]) shared[name] = make();
  return shared[name];
}

// ---------------------------------------------------------------- Model
export class JetSkiModel {
  // custom: { main, secondary, seat, handlebar, graphic, decal, exhaust, finish, number }
  constructor(skiId, custom, opts = {}) {
    this.def = skiById(skiId);
    this.custom = { ...this.def.colors, number: 7, ...custom };
    this.group = new THREE.Group(); // positioned by physics
    this.trickPivot = new THREE.Group(); // tricks rotate this
    this.group.add(this.trickPivot);
    this.body = new THREE.Group();
    this.trickPivot.add(this.body);
    this.lowDetail = !!opts.lowDetail;
    this.materials = [];
    this.build();
  }

  build() {
    const shape = this.def.shape;
    const c = this.custom;
    const stations = this.lowDetail ? 10 : 26;
    const livery = liveryTexture(c);
    const mainMat = paintMaterial(c.main, c.finish, livery);
    const secMat = paintMaterial(c.secondary, c.finish === 'neon' ? 'gloss' : c.finish, null);
    const seatMat = new THREE.MeshStandardMaterial({ color: c.seat, roughness: 0.75, metalness: 0 });
    const barMat = new THREE.MeshStandardMaterial({ color: c.handlebar, roughness: 0.35, metalness: 0.5 });
    const ex = EXHAUSTS.find((e) => e.id === c.exhaust) || EXHAUSTS[0];
    const exMat = new THREE.MeshStandardMaterial({ color: ex.color, roughness: ex.rough, metalness: ex.metal });
    const black = sharedMat('black', () => new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.8 }));
    const mat = sharedMat('mat', () => new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.95 }));
    const glass = sharedMat('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.45 }));
    this.materials.push(mainMat, secMat, seatMat, barMat, exMat);
    this.mainMat = mainMat;

    const add = (geo, m, cast = true) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      this.body.add(mesh);
      return mesh;
    };

    add(loftPart(shape, UPPER, stations, [0, 1]), mainMat);
    add(loftPart(shape, LOWER, stations, [0, 1], true), secMat);
    add(transomGeometry(shape), secMat);

    const st0 = stationAt(0.5, shape);
    const deckY = st0.deck;
    const L = shape.len;

    // Footwells: dark grippy mats either side of the seat.
    for (const s of [1, -1]) {
      const fw = add(new THREE.BoxGeometry(0.2, 0.03, L * 0.4), mat, false);
      fw.position.set(s * (shape.width * 0.5 - 0.17), deckY - 0.03, -0.1);
    }

    // Seat(s).
    const seatLen = 0.55 + 0.33 * shape.seats;
    const seat = add(new THREE.CapsuleGeometry(0.2, seatLen, 4, this.lowDetail ? 6 : 12), seatMat);
    seat.rotation.x = Math.PI / 2;
    seat.scale.set(1.3, 1, 0.55);
    seat.position.set(0, deckY + 0.13, -0.32 - (shape.seats - 1) * 0.12);
    this.seatTop = new THREE.Vector3(0, deckY + 0.25, -0.15);

    // Engine cowl / hood in front of the handlebars.
    const cowlGeo = shape.cowl === 'angular'
      ? new THREE.CylinderGeometry(0.2, 0.36, 0.5, 6, 1)
      : new THREE.SphereGeometry(0.36, this.lowDetail ? 8 : 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const cowl = add(cowlGeo, mainMat);
    if (shape.cowl === 'angular') { cowl.rotation.x = Math.PI / 2 - 0.25; cowl.scale.set(1.15, 1, 0.5); cowl.position.set(0, deckY + 0.13, L * 0.2); }
    else { cowl.scale.set(1.15, 0.55, 1.8); cowl.position.set(0, deckY - 0.02, L * 0.2); }

    // Windscreen.
    const ws = add(new THREE.PlaneGeometry(0.46, 0.2), glass, false);
    ws.position.set(0, deckY + 0.26, L * 0.12);
    ws.rotation.x = -0.9;

    // Handlebars on a column; the group turns with steering input.
    this.bars = new THREE.Group();
    this.bars.position.set(0, deckY + 0.24, L * 0.07);
    this.body.add(this.bars);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 8), barMat);
    col.rotation.x = 0.5;
    col.position.set(0, 0.05, -0.02);
    this.bars.add(col);
    const barW = shape.bars === 'race' ? 0.78 : shape.bars === 'sport' ? 0.72 : 0.68;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, barW, 8), barMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.18, -0.08);
    this.bars.add(bar);
    for (const s of [1, -1]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.13, 8), black);
      grip.rotation.z = Math.PI / 2;
      grip.position.set(s * (barW / 2 - 0.04), 0.18, -0.08);
      this.bars.add(grip);
    }
    if (shape.bars !== 'touring') {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.06), black);
      pad.position.set(0, 0.2, -0.08);
      this.bars.add(pad);
    }
    // Where the rider's hands go (in body space).
    this.gripL = new THREE.Vector3(barW / 2 - 0.05, deckY + 0.42, L * 0.07 - 0.08);
    this.gripR = new THREE.Vector3(-(barW / 2 - 0.05), deckY + 0.42, L * 0.07 - 0.08);

    // Jet nozzle / exhaust at the stern.
    const stern = stationAt(0, shape);
    const nozzle = add(new THREE.CylinderGeometry(0.1, 0.13, 0.26, this.lowDetail ? 6 : 14), exMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, stern.keel + 0.14, stern.z - 0.08);
    const pipe = add(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 10), exMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(shape.width * 0.28, stern.keel + 0.32, stern.z - 0.04);
    this.nozzleLocal = new THREE.Vector3(0, stern.keel + 0.14, stern.z - 0.25);

    // Rear boarding step / platform.
    const step = add(new THREE.BoxGeometry(shape.width * 0.75, 0.04, 0.2), black);
    step.position.set(0, stern.keel + 0.38, stern.z - 0.02);

    if (!this.lowDetail) {
      if (shape.sponsons) {
        for (const s of [1, -1]) {
          const sp = add(new THREE.BoxGeometry(0.05, 0.1, 0.5), secMat);
          sp.position.set(s * (shape.width * 0.5 + 0.02), -0.06, -L * 0.3);
        }
      }
      if (shape.fins) {
        for (const s of [1, -1]) {
          const fin = add(new THREE.BoxGeometry(0.03, 0.18, 0.32), secMat);
          fin.position.set(s * shape.width * 0.33, deckY + 0.08, -L * 0.42);
          fin.rotation.z = s * 0.25;
        }
      }
      if (shape.wing) {
        const wing = add(new THREE.BoxGeometry(shape.width * 0.85, 0.03, 0.18), secMat);
        wing.position.set(0, deckY + 0.3, -L * 0.47);
        for (const s of [1, -1]) {
          const post = add(new THREE.BoxGeometry(0.03, 0.18, 0.06), black);
          post.position.set(s * shape.width * 0.3, deckY + 0.2, -L * 0.46);
        }
      }
      if (shape.vents) {
        for (const s of [1, -1]) {
          for (let i = 0; i < 3; i++) {
            const v = add(new THREE.BoxGeometry(0.015, 0.035, 0.16), black, false);
            v.position.set(s * (shape.width * 0.47), deckY - 0.12 - i * 0.05, L * 0.2);
          }
        }
      }
      // Bow light strip.
      const light = add(new THREE.BoxGeometry(0.28, 0.03, 0.03), sharedMat('light', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 0.8 })), false);
      light.position.set(0, stationAt(0.86, shape).deck - 0.02, L * 0.36);
    }
  }

  setSteer(v) {
    this.bars.rotation.y = -v * 0.4;
  }

  dispose() {
    this.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of this.materials) m.dispose();
  }
}

// Simplified far-away model for AI riders (level of detail).
export function buildSkiLOD(skiId, custom) {
  const near = new JetSkiModel(skiId, custom);
  const far = new JetSkiModel(skiId, custom, { lowDetail: true });
  return { near, far };
}
