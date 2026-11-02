import * as THREE from 'three';
import { GIANT_TURKEY, FLYING_TURKEY, SERVING, PLATE } from './config.js';

function standard(color, roughness = 0.5, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}

function shaded(geometry, material, cast = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

// Revolves a list of [radius, height] points around the Y axis.
function lathe(profile, segments = 48) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------- Plates ----------

// The plate model below is built for this radius, then scaled to PLATE.radius.
const PLATE_MODEL_RADIUS = 0.74;
const plateDishGeometry = lathe([
  [0, 0.02], [0.5, 0.022], [0.56, 0.04], [0.7, 0.095], [0.745, 0.1], [0.75, 0.085], [0.6, 0.015], [0, 0.005],
]);
const plateDishMaterial = standard(0xfff4df, 0.28);
const plateRimGeometry = new THREE.TorusGeometry(0.72, 0.022, 10, 64).rotateX(Math.PI / 2);
const plateRimMaterial = standard(0xc9662a, 0.35);
const placematGeometry = new THREE.CircleGeometry(0.98, 48).rotateX(-Math.PI / 2);
const glowGeometry = new THREE.RingGeometry(0.72, 1.0, 48).rotateX(-Math.PI / 2);

// The value painted in the middle of each plate, so its worth is always readable.
function plateLabelTexture(points) {
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#fff4df';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#e8a33d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = points >= 10 ? '#b3261e' : '#9a4a16';
    ctx.font = `800 ${points >= 10 ? 130 : 150}px Fredoka, "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(points), size / 2, size / 2 + 8);
  });
}

function placematTexture(gold) {
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = gold ? '#d9921f' : '#a8481c';
    ctx.fillRect(0, 0, size, size);
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(255, 236, 200, 0.28)';
    for (let i = 0; i < size; i += 28) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
  });
}

/** One dinner plate: dish, painted value, placemat and the glow used for bonuses. */
export class Plate {
  constructor(scene, def) {
    Object.assign(this, def);
    this.slices = []; // landed slices, oldest first
    this.dip = 0; // landing animation, 1 falling to 0
    this.lit = 0;

    this.group = new THREE.Group();
    this.group.position.set(def.x, 0, def.z);
    const plateScale = PLATE.radius / PLATE_MODEL_RADIUS;
    this.group.scale.set(plateScale, 1, plateScale);
    const special = def.points >= 10;

    const mat = new THREE.Mesh(placematGeometry, standard(0xffffff, 0.9, { map: placematTexture(special) }));
    mat.position.y = 0.006;
    mat.receiveShadow = true;
    this.group.add(mat);

    this.dish = new THREE.Group();
    this.dish.add(shaded(plateDishGeometry, plateDishMaterial));
    this.dish.add(shaded(plateRimGeometry, special ? standard(0xd4a017, 0.3) : plateRimMaterial, false));
    const label = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 40).rotateX(-Math.PI / 2),
      standard(0xffffff, 0.3, { map: plateLabelTexture(def.points) }),
    );
    label.position.y = 0.0245;
    label.receiveShadow = true;
    this.dish.add(label);
    this.group.add(this.dish);

    this.glow = new THREE.Mesh(glowGeometry, new THREE.MeshBasicMaterial({
      color: 0xffc94d, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.glow.position.y = 0.012;
    this.group.add(this.glow);
    scene.add(this.group);
  }

  get occupied() {
    return this.slices.length > 0;
  }

  land() {
    this.dip = 1;
    this.lit = 1;
  }

  reset() {
    this.slices.length = 0;
    this.dip = 0;
    this.lit = 0;
    this.dish.position.y = 0;
    this.dish.scale.setScalar(1);
    this.glow.material.opacity = 0;
  }

  update(dt, elapsed, tableComplete) {
    const dip = this.dip;
    this.dish.position.y = -0.012 * dip * Math.cos(dip * 9);
    this.dish.scale.setScalar(1 + 0.05 * Math.sin(dip * Math.PI));
    this.dip = Math.max(0, dip - dt * 2.6);
    this.lit = Math.max(0, this.lit - dt * 1.6);

    // Occupied plates keep a faint ring, so the 0/9 progress can be read off the table.
    const settled = this.occupied ? 0.34 : 0;
    const bonus = tableComplete ? 0.68 + 0.26 * Math.sin(elapsed * 4 + this.z) : 0;
    this.glow.material.opacity = Math.max(settled, this.lit, bonus);
  }
}

// ---------- Sauce bowls ----------

const SAUCES = {
  cranberry: { bowl: 0xf4ead6, band: 0xa61e2c, sauce: 0xa80f26, shine: 0.16 },
  gravy: { bowl: 0xfdf3e0, band: 0x8c5a24, sauce: 0x8a4e1e, shine: 0.22 },
};

function sauceTexture(kind) {
  return canvasTexture(256, (ctx, size) => {
    const gravy = kind === 'gravy';
    ctx.fillStyle = gravy ? '#8f5420' : '#a4122a';
    ctx.fillRect(0, 0, size, size);
    if (gravy) {
      // Lazy swirl of lighter gravy.
      ctx.strokeStyle = 'rgba(214, 150, 80, 0.5)';
      ctx.lineWidth = 9;
      ctx.beginPath();
      for (let a = 0; a < 12; a += 0.1) {
        const r = 8 + a * 8.5;
        const x = size / 2 + Math.cos(a) * r;
        const y = size / 2 + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      // Jellied gloss with darker berry shapes under the surface.
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(${90 + Math.random() * 60}, 8, 30, 0.6)`;
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size, 8 + Math.random() * 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** A serving bowl with a sauce surface that sloshes and ripples when hit. */
export class Bowl {
  constructor(scene, kind, def) {
    Object.assign(this, def);
    this.kind = kind;
    this.slosh = 0;
    this.hits = 0;

    this.group = new THREE.Group();
    this.group.position.set(def.x, 0, def.z);
    const style = SAUCES[kind];
    const { outerRadius: outer, openingRadius: opening, rimHeight: rim, fillHeight: fill } = def;

    this.group.add(shaded(lathe([
      [0, 0], [outer * 0.56, 0], [outer * 0.8, 0.1], [outer * 0.98, rim - 0.05], [outer, rim],
      [opening + 0.02, rim + 0.012], [opening, rim - 0.02], [opening * 0.86, fill - 0.04], [0, fill - 0.06],
    ]), standard(style.bowl, 0.26)));
    const band = shaded(
      new THREE.TorusGeometry(outer * 0.975, 0.024, 10, 64).rotateX(Math.PI / 2),
      standard(style.band, 0.35),
      false,
    );
    band.position.y = rim - 0.09;
    this.group.add(band);

    this.sauce = new THREE.Mesh(
      new THREE.CircleGeometry(opening * 0.98, 48).rotateX(-Math.PI / 2),
      standard(0xffffff, style.shine, { map: sauceTexture(kind) }),
    );
    this.sauce.position.y = fill;
    this.sauce.receiveShadow = true;
    this.group.add(this.sauce);

    if (kind === 'cranberry') {
      // A few whole berries, which only sit near the edge so they don't read as a target.
      const berry = new THREE.SphereGeometry(0.06, 14, 10);
      const berryMaterial = standard(0xd11a36, 0.22);
      for (let i = 0; i < 9; i++) {
        const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
        const distance = opening * (0.55 + Math.random() * 0.3);
        const mesh = new THREE.Mesh(berry, berryMaterial);
        mesh.position.set(Math.cos(angle) * distance, fill + 0.015, Math.sin(angle) * distance);
        this.group.add(mesh);
      }
    }

    this.ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.8, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffe6c4, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.ripple.position.y = fill + 0.01;
    this.group.add(this.ripple);
    scene.add(this.group);
  }

  splash() {
    this.slosh = 1;
    this.hits += 1;
  }

  reset() {
    this.slosh = 0;
    this.hits = 0;
    this.group.rotation.set(0, 0, 0);
    this.group.scale.setScalar(1);
    this.ripple.material.opacity = 0;
  }

  update(dt) {
    const s = this.slosh;
    this.sauce.position.y = this.fillHeight + 0.018 * s * Math.sin(s * 22);
    this.group.rotation.x = 0.035 * s * Math.sin(s * 26);
    this.group.rotation.z = 0.035 * s * Math.cos(s * 22);
    this.group.scale.setScalar(1 + 0.05 * Math.sin(s * Math.PI));
    this.ripple.scale.setScalar(0.2 + (1 - s) * this.openingRadius * 1.05);
    this.ripple.material.opacity = s * 0.75;
    this.slosh = Math.max(0, s - dt * 1.5);
  }
}

// ---------- Giant bouncy turkey ----------

function turkeySkinTexture() {
  return canvasTexture(512, (ctx, size) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#c9782a');
    gradient.addColorStop(0.5, '#a9571c');
    gradient.addColorStop(1, '#7a3a10');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 240; i++) {
      const dark = Math.random() < 0.55;
      ctx.fillStyle = dark
        ? `rgba(92, 40, 10, ${Math.random() * 0.3})`
        : `rgba(240, 170, 80, ${Math.random() * 0.22})`;
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * size, Math.random() * size,
        6 + Math.random() * 28, 4 + Math.random() * 16, Math.random() * 3, 0, Math.PI * 2,
      );
      ctx.fill();
    }
  });
}

// Spheres approximating the roast for physics, as [x, y, z, radius] from its center.
const TURKEY_COLLIDERS = [
  [0, 0.72, 0, 0.8],
  [0, 0.68, 0.62, 0.72],
  [0, 0.68, -0.62, 0.72],
  [0.46, 0.66, 0, 0.66],
  [-0.46, 0.66, 0, 0.66],
  [0.72, 0.42, 0.92, 0.36],
  [-0.72, 0.42, 0.92, 0.36],
];

/** The cartoon roast at the center of the table. A bounce squashes it on a damped spring. */
export class GiantTurkey {
  constructor(scene) {
    const { scale } = GIANT_TURKEY;
    this.colliders = TURKEY_COLLIDERS.map((sphere) => sphere.map((value) => value * scale));
    this.squash = 0;
    this.squashVelocity = 0;

    this.group = new THREE.Group();
    this.group.position.set(GIANT_TURKEY.x, 0, GIANT_TURKEY.z);

    const r = GIANT_TURKEY.platterRadius;
    this.group.add(shaded(lathe([
      [0, 0.03], [r * 0.8, 0.03], [r * 0.92, 0.07], [r, 0.1], [r * 1.01, 0.085], [r * 0.85, 0.01], [0, 0.005],
    ]), standard(0xf7e8cc, 0.3)));
    const platterBand = shaded(
      new THREE.TorusGeometry(r * 0.975, 0.024, 10, 72).rotateX(Math.PI / 2), standard(0xb07a2a, 0.3), false,
    );
    platterBand.position.y = 0.092;
    this.group.add(platterBand);
    this._addGarnish(r);

    this.roast = new THREE.Group();
    this.roast.scale.setScalar(scale);
    this.group.add(this.roast);
    const skin = new THREE.MeshPhysicalMaterial({
      map: turkeySkinTexture(), roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.35,
    });
    const sphere = new THREE.SphereGeometry(1, 36, 26);

    const part = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
      const mesh = shaded(sphere, skin);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.rotation.set(rx, ry, rz);
      this.roast.add(mesh);
      return mesh;
    };

    part(0, 0.72, 0, 1.14, 0.78, 1.38); // body
    part(0.44, 0.93, 0.34, 0.66, 0.54, 0.86); // breast
    part(-0.44, 0.93, 0.34, 0.66, 0.54, 0.86);
    part(1.04, 0.72, -0.28, 0.2, 0.3, 0.62, 0, 0.1, 0.25); // wings
    part(-1.04, 0.72, -0.28, 0.2, 0.3, 0.62, 0, -0.1, -0.25);
    part(0, 0.62, -1.3, 0.3, 0.22, 0.2); // tail

    // Drumsticks point back toward the player, the way a carved-ready roast sits.
    const bone = standard(0xfff5e1, 0.45);
    const shaft = new THREE.CylinderGeometry(0.075, 0.095, 0.36, 14);
    const knob = new THREE.SphereGeometry(0.1, 14, 10);
    for (const side of [1, -1]) {
      part(side * 0.8, 0.52, 0.64, 0.42, 0.4, 0.66, 0, side * 0.32, 0);
      const stem = shaded(shaft, bone);
      stem.position.set(side * 0.96, 0.66, 1.34);
      stem.rotation.set(1.28, 0, side * 0.26);
      this.roast.add(stem);
      for (const offset of [-0.07, 0.07]) {
        const end = shaded(knob, bone);
        end.position.set(side * 1.02 + offset, 0.74, 1.54);
        this.roast.add(end);
      }
    }
    scene.add(this.group);
  }

  _addGarnish(platterRadius) {
    const leaf = new THREE.SphereGeometry(0.15, 12, 8);
    const greens = [standard(0x4f7f2b, 0.7), standard(0x6c9a36, 0.7)];
    const orange = new THREE.CylinderGeometry(0.17, 0.17, 0.05, 20);
    const orangeMaterial = standard(0xf28c1e, 0.45);
    const ring = platterRadius * 0.86;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const garnish = i % 4 === 0
        ? shaded(orange, orangeMaterial, false)
        : shaded(leaf, greens[i % 2], false);
      garnish.position.set(Math.cos(angle) * ring, 0.09, Math.sin(angle) * ring);
      if (i % 4 !== 0) garnish.scale.set(1.1, 0.45, 1);
      this.group.add(garnish);
    }
  }

  bounce() {
    this.squashVelocity = 8;
  }

  reset() {
    this.squash = 0;
    this.squashVelocity = 0;
    this.roast.scale.setScalar(GIANT_TURKEY.scale);
  }

  update(dt, elapsed) {
    // Damped spring, stepped in small slices so a slow frame can't make it blow up.
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.squashVelocity += (-190 * this.squash - 9 * this.squashVelocity) * h;
      this.squash += this.squashVelocity * h;
    }
    const idle = 0.008 * Math.sin(elapsed * 2.2);
    const y = 1 - Math.max(-0.45, Math.min(0.45, this.squash)) + idle;
    const wide = 1 / Math.sqrt(Math.max(0.5, y));
    this.roast.scale.set(wide, y, wide).multiplyScalar(GIANT_TURKEY.scale);
  }
}

// ---------- Flying turkey ----------

export const FlightPhase = Object.freeze({
  WAITING: 'waiting',
  INCOMING: 'incoming',
  FLYING: 'flying',
  HIT: 'hit',
  GONE: 'gone',
});

/** The live cartoon turkey that crosses above the table once per round. */
export class FlyingTurkey {
  constructor(scene) {
    this.group = new THREE.Group();
    this.model = new THREE.Group();
    this.group.add(this.model);
    this.group.visible = false;
    scene.add(this.group);
    this._build();
    this.position = this.group.position;
    this.reset();
  }

  _build() {
    const sphere = new THREE.SphereGeometry(1, 24, 18);
    const body = standard(0x7a4522, 0.65);
    const piece = (material, x, y, z, sx, sy, sz, parent = this.model) => {
      const mesh = new THREE.Mesh(sphere, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Modeled facing +X, with the fan at -X.
    piece(body, 0, 0, 0, 0.62, 0.5, 0.48);
    piece(standard(0x5c3318, 0.7), 0.12, -0.1, 0, 0.45, 0.32, 0.36);
    piece(standard(0xa8562a, 0.6), 0.62, 0.3, 0, 0.1, 0.34, 0.1).rotation.z = -0.55;
    piece(standard(0xd9b08c, 0.55), 0.84, 0.58, 0, 0.17, 0.17, 0.16);
    piece(standard(0xd11a2a, 0.45), 0.92, 0.42, 0, 0.06, 0.13, 0.06);
    piece(standard(0x18120e, 0.2), 0.94, 0.64, 0.12, 0.033, 0.033, 0.033);
    piece(standard(0x18120e, 0.2), 0.94, 0.64, -0.12, 0.033, 0.033, 0.033);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 10), standard(0xf2b02c, 0.45));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(1.06, 0.56, 0);
    this.model.add(beak);

    // Tail fan: bands of colored feathers.
    const feather = new THREE.SphereGeometry(1, 12, 10);
    const colors = [0xb3261e, 0xe2841f, 0xf2c14e];
    for (let band = 0; band < colors.length; band++) {
      const material = standard(colors[band], 0.6);
      const count = 9;
      for (let i = 0; i < count; i++) {
        // Fans out from the rump, tilted up from straight behind the bird.
        const angle = ((i / (count - 1)) - 0.5) * 2.5 + 0.55;
        const length = 0.92 - band * 0.2;
        const mesh = new THREE.Mesh(feather, material);
        mesh.scale.set(0.15, length * 0.5, 0.03);
        mesh.position.set(-0.4 - Math.cos(angle) * length * 0.5, 0.1 + Math.sin(angle) * length * 0.5, band * 0.03);
        mesh.rotation.z = Math.PI / 2 - angle;
        this.model.add(mesh);
      }
    }

    this.wings = [1, -1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.05, 0.16, side * 0.42);
      piece(standard(0x5c3318, 0.7), 0, 0, side * 0.34, 0.3, 0.05, 0.36, pivot);
      piece(standard(0xb3622a, 0.6), -0.04, -0.01, side * 0.52, 0.2, 0.04, 0.2, pivot);
      this.model.add(pivot);
      return { pivot, side };
    });
  }

  reset() {
    this.phase = FlightPhase.WAITING;
    this.group.visible = false;
    this.group.rotation.set(0, 0, 0);
    this.model.rotation.set(0, 0, 0);
    this.progress = 0;
    this.direction = 1;
    this.halfSpan = 10;
    this.spinOut = 0;
  }

  /** Starts a crossing that begins and ends just off screen. */
  takeOff(direction, halfSpan) {
    this.phase = FlightPhase.FLYING;
    this.direction = direction;
    this.halfSpan = halfSpan;
    this.progress = 0;
    this.group.visible = true;
    // Model faces +X; turn it to face along the flight.
    this.model.rotation.y = direction > 0 ? 0 : Math.PI;
    this._place();
  }

  get hittable() {
    return this.phase === FlightPhase.FLYING;
  }

  markHit() {
    this.phase = FlightPhase.HIT;
    this.spinOut = 0;
  }

  _place() {
    const t = this.progress;
    const curve = Math.sin(t * Math.PI);
    this.group.position.set(
      this.direction * (t * 2 - 1) * this.halfSpan,
      FLYING_TURKEY.height + curve * FLYING_TURKEY.curveHeight,
      FLYING_TURKEY.z - curve * FLYING_TURKEY.curveDepth,
    );
  }

  update(dt, elapsed) {
    if (!this.group.visible) return;
    const flap = Math.sin(elapsed * 26);
    for (const { pivot, side } of this.wings) pivot.rotation.x = side * (flap * 0.72 + 0.1);

    if (this.phase === FlightPhase.HIT) {
      // Comic exit: rockets up and away in a spin.
      this.spinOut += dt;
      this.group.rotation.z += dt * 13;
      this.group.position.x += this.direction * dt * 9;
      this.group.position.y += dt * (5 + this.spinOut * 8);
      if (this.spinOut > 1.4) this.group.visible = false;
      return;
    }
    this.progress += dt / FLYING_TURKEY.flightSeconds;
    if (this.progress >= 1) {
      this.phase = FlightPhase.GONE;
      this.group.visible = false;
      return;
    }
    this._place();
    this.group.position.y += flap * 0.04;
  }
}

// ---------- Serving platter ----------

const PLATTER_SLICES = 6;

/** The platter in front of the player. Its fan of spare slices empties as the supply runs out. */
export class ServingPlatter {
  constructor(scene, pool) {
    this.group = new THREE.Group();
    this.group.position.set(SERVING.x, 0, SERVING.z);
    const r = 0.98;
    this.group.add(shaded(lathe([
      [0, 0.04], [r * 0.72, 0.045], [r * 0.9, 0.09], [r, 0.11], [r * 1.01, 0.09], [r * 0.8, 0.01], [0, 0.005],
    ]), standard(0xf7e8cc, 0.3)));
    const band = shaded(
      new THREE.TorusGeometry(r * 0.97, 0.02, 10, 60).rotateX(Math.PI / 2), standard(0xc9662a, 0.35), false,
    );
    band.position.y = 0.1;
    this.group.add(band);

    this.spares = [];
    for (let i = 0; i < PLATTER_SLICES; i++) {
      const mesh = pool.createMesh();
      const angle = (i / PLATTER_SLICES) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 0.46, 0.09 + i * 0.006, Math.sin(angle) * 0.46);
      mesh.rotation.y = -angle;
      mesh.morphTargetInfluences[0] = 0.25;
      this.group.add(mesh);
      this.spares.push(mesh);
    }
    scene.add(this.group);
  }

  /** `remaining` includes the slice being thrown, which sits in the middle. */
  setCount(remaining) {
    this.spares.forEach((mesh, i) => {
      mesh.visible = i < remaining - 1;
    });
  }
}
