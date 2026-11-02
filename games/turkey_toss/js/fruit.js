import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CORNUCOPIA, PHYSICS, TABLE, FLOOR } from './config.js';

// Height above the table that fruit starts falling from, and how wide it spreads. The near
// edge stops short of the camera, where fruit would fill the screen on the way past.
const SPAWN_HEIGHT = 11;
const SPREAD_X = 7.5;
const SPREAD_NEAR_Z = 4;
const SPREAD_FAR_Z = -12;
const RESTITUTION = 0.42;
const ROLL_DRAG = 0.74;
const FADE_SECONDS = 0.3;
const MAX_STEP = 1 / 60;
// Shortest gap between landing sounds, so a shower doesn't turn into a buzz.
const SOUND_GAP_SECONDS = 0.07;

function colored(geometry, hex) {
  const color = new THREE.Color(hex);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function stem() {
  return colored(new THREE.CylinderGeometry(0.05, 0.07, 0.34, 6).translate(0, 1, 0), 0x5a3418);
}

// Each fruit is modeled about one unit across, in one mesh with its colors in the vertices.
function createApple() {
  const body = new THREE.SphereGeometry(1, 16, 12).scale(1, 0.9, 1);
  const leaf = new THREE.SphereGeometry(0.26, 8, 6).scale(1.5, 0.25, 0.7).translate(0.32, 1.05, 0);
  return mergeGeometries([colored(body, 0xd11f2a), stem(), colored(leaf, 0x5f9a30)]);
}

function createOrange() {
  return mergeGeometries([colored(new THREE.SphereGeometry(1, 16, 12), 0xf28c1e)]);
}

function createPear() {
  const profile = [[0, -0.95], [0.62, -0.8], [0.92, -0.32], [0.72, 0.2], [0.42, 0.56], [0.3, 0.82], [0, 0.92]];
  const body = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 14);
  return mergeGeometries([colored(body, 0xc9cc3a), stem()]);
}

function createGrapes() {
  const grapes = [];
  const rows = [[3, 0.42], [3, 0.42], [2, 0.3], [1, 0]];
  rows.forEach(([count, ring], row) => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + row;
      grapes.push(colored(new THREE.SphereGeometry(0.42, 10, 8).translate(
        Math.cos(angle) * ring, 0.62 - row * 0.5, Math.sin(angle) * ring,
      ), 0x6a2a8c));
    }
  });
  return mergeGeometries([...grapes, stem()]);
}

function createBanana() {
  class Arc extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const a = (t - 0.5) * 2.3;
      return target.set(Math.sin(a) * 1.05, -Math.cos(a) * 1.05 + 0.7, 0);
    }
  }
  return mergeGeometries([colored(new THREE.TubeGeometry(new Arc(), 14, 0.3, 8), 0xf2cf3e)]);
}

const KINDS = [
  { create: createApple, size: 0.2 },
  { create: createOrange, size: 0.2 },
  { create: createPear, size: 0.22 },
  { create: createGrapes, size: 0.22 },
  { create: createBanana, size: 0.24 },
];

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const _axis = new THREE.Vector3();
const _spin = new THREE.Quaternion();

/**
 * The fruit shower. It's scenery, so it has its own small simple physics instead of joining
 * the cannon-es world, and it can never touch a slice or change a throw. Each kind of fruit
 * is one instanced mesh, which keeps a full shower to a handful of draw calls.
 */
export class FruitShower {
  constructor(scene, audio, obstacles) {
    this.audio = audio;
    this.obstacles = obstacles; // [x, y, z, radius] spheres to bounce off
    this.lastSound = 0;
    this.time = 0;
    this.next = 0;
    this.live = 0;

    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 });
    const perKind = Math.ceil(CORNUCOPIA.fruitPoolSize / KINDS.length);
    this.meshes = KINDS.map(({ create }) => {
      const mesh = new THREE.InstancedMesh(create(), material, perKind);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.visible = false;
      for (let i = 0; i < perKind; i++) mesh.setMatrixAt(i, _hidden);
      scene.add(mesh);
      return mesh;
    });

    this.fruit = [];
    for (let kind = 0; kind < KINDS.length; kind++) {
      for (let index = 0; index < perKind; index++) {
        this.fruit.push({
          kind,
          index,
          active: false,
          delay: 0,
          landed: false,
          linger: 0,
          fade: 0,
          position: new THREE.Vector3(),
          velocity: new THREE.Vector3(),
          quaternion: new THREE.Quaternion(),
          spinAxis: new THREE.Vector3(),
          spinSpeed: 0,
        });
      }
    }
    // Shuffled, so one shower mixes every kind instead of using up the apples first.
    for (let i = this.fruit.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.fruit[i], this.fruit[j]] = [this.fruit[j], this.fruit[i]];
    }
  }

  // Instances still cost triangles while hidden, so the meshes only draw during a shower.
  _setVisible(visible) {
    for (const mesh of this.meshes) mesh.visible = visible;
  }

  rain() {
    this._setVisible(true);
    for (let i = 0; i < CORNUCOPIA.fruitPerHit; i++) {
      const fruit = this.fruit[this.next];
      this.next = (this.next + 1) % this.fruit.length;
      if (!fruit.active) this.live += 1;
      fruit.active = true;
      fruit.delay = Math.random() * CORNUCOPIA.spreadSeconds;
      fruit.landed = false;
      fruit.linger = 0;
      fruit.fade = 0;
      fruit.position.set(
        (Math.random() * 2 - 1) * SPREAD_X,
        SPAWN_HEIGHT + Math.random() * 2,
        SPREAD_FAR_Z + Math.random() * (SPREAD_NEAR_Z - SPREAD_FAR_Z),
      );
      fruit.velocity.set((Math.random() - 0.5) * 1.6, -3 - Math.random() * 3, (Math.random() - 0.5) * 1.6);
      fruit.spinAxis.randomDirection();
      fruit.spinSpeed = 3 + Math.random() * 7;
      fruit.quaternion.random();
    }
  }

  clear() {
    for (const fruit of this.fruit) {
      fruit.active = false;
      this.meshes[fruit.kind].setMatrixAt(fruit.index, _hidden);
    }
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
    this.live = 0;
    this._setVisible(false);
  }

  _land(fruit) {
    if (this.time - this.lastSound < SOUND_GAP_SECONDS) return;
    this.lastSound = this.time;
    if (fruit.position.y > FLOOR.y + 1) this.audio.play('fruit');
  }

  _bounceOffGround(fruit, radius, wasAbove) {
    const { position, velocity } = fruit;
    const overTable = Math.abs(position.x) < TABLE.halfWidth && position.z < TABLE.frontZ && position.z > TABLE.backZ;
    const ground = (overTable && wasAbove ? 0 : FLOOR.y) + radius;
    if (position.y > ground) return;
    position.y = ground;
    if (velocity.y < -1.2) {
      this._land(fruit);
      velocity.y *= -RESTITUTION;
      fruit.spinSpeed *= 0.8;
    } else {
      velocity.y = 0;
      fruit.landed = true;
    }
    velocity.x *= ROLL_DRAG;
    velocity.z *= ROLL_DRAG;
  }

  _bounceOffObstacles(fruit, radius) {
    const { position, velocity } = fruit;
    for (const [x, y, z, obstacleRadius] of this.obstacles) {
      const dx = position.x - x;
      const dy = position.y - y;
      const dz = position.z - z;
      const reach = obstacleRadius + radius;
      const distanceSq = dx * dx + dy * dy + dz * dz;
      if (distanceSq >= reach * reach || distanceSq === 0) continue;
      const distance = Math.sqrt(distanceSq);
      const nx = dx / distance;
      const ny = dy / distance;
      const nz = dz / distance;
      position.set(x + nx * reach, y + ny * reach, z + nz * reach);
      const inward = velocity.x * nx + velocity.y * ny + velocity.z * nz;
      if (inward < 0) {
        velocity.addScaledVector(_axis.set(nx, ny, nz), -(1 + RESTITUTION) * inward);
        if (inward < -1.2) this._land(fruit);
      }
    }
  }

  _step(fruit, h) {
    const radius = KINDS[fruit.kind].size;
    if (fruit.delay > 0) {
      fruit.delay -= h;
      return;
    }
    if (fruit.landed) {
      fruit.linger += h;
      if (fruit.linger > CORNUCOPIA.lingerSeconds) fruit.fade += h / FADE_SECONDS;
      if (fruit.fade >= 1) {
        fruit.active = false;
        this.live -= 1;
      }
      return;
    }
    const wasAbove = fruit.position.y >= radius - 0.02;
    fruit.velocity.y -= PHYSICS.gravity * h;
    fruit.position.addScaledVector(fruit.velocity, h);
    this._bounceOffObstacles(fruit, radius);
    this._bounceOffGround(fruit, radius, wasAbove);
    _spin.setFromAxisAngle(fruit.spinAxis, fruit.spinSpeed * h);
    fruit.quaternion.premultiply(_spin);
  }

  update(dt) {
    if (this.live === 0) return;
    this.time += dt;
    const steps = Math.max(1, Math.ceil(dt / MAX_STEP));
    const h = dt / steps;
    for (const fruit of this.fruit) {
      if (!fruit.active) continue;
      for (let i = 0; i < steps && fruit.active; i++) this._step(fruit, h);
      const mesh = this.meshes[fruit.kind];
      if (!fruit.active || fruit.delay > 0) {
        mesh.setMatrixAt(fruit.index, _hidden);
      } else {
        _scale.setScalar(KINDS[fruit.kind].size * (1 - Math.min(1, fruit.fade)));
        _position.copy(fruit.position);
        _matrix.compose(_position, fruit.quaternion, _scale);
        mesh.setMatrixAt(fruit.index, _matrix);
      }
    }
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
    if (this.live === 0) this._setVisible(false);
  }
}
