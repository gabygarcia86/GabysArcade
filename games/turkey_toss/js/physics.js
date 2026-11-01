import * as CANNON from 'cannon-es';
import { PHYSICS, TABLE, SLICE, PLATE, GIANT_TURKEY } from './config.js';

// Slices collide with the table and its contents, never with each other.
const GROUP_SLICE = 1;
const GROUP_STATIC = 2;

// What a slice touched during the last step, as bit flags.
export const Surface = Object.freeze({
  TABLE: 1,
  PLATE: 2,
  BOWL: 4,
  TURKEY: 8,
  DECOR: 16,
});

const GROUND = Surface.TABLE | Surface.PLATE | Surface.DECOR;
const BOWL_CATCH_HEIGHT = 0.2;

const _up = new CANNON.Vec3(0, 1, 0);
const _sliceUp = new CANNON.Vec3();
const _level = new CANNON.Quaternion();
const _flat = new CANNON.Quaternion();

/** One thrown slice's rigid body: a flat ring of spheres around a center sphere. */
export class SliceBody {
  constructor(material) {
    this.body = new CANNON.Body({
      mass: 0.2,
      material,
      linearDamping: 0,
      angularDamping: 0.02,
      allowSleep: false,
      collisionFilterGroup: GROUP_SLICE,
      collisionFilterMask: GROUP_STATIC,
    });
    const shape = new CANNON.Sphere(SLICE.colliderRadius);
    const inset = SLICE.colliderRadius;
    this.body.addShape(shape);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.body.addShape(shape, new CANNON.Vec3(
        Math.cos(angle) * (SLICE.radiusX - inset), 0, Math.sin(angle) * (SLICE.radiusZ - inset),
      ));
    }
    this.body.sliceBody = this;
    this.previousPosition = new CANNON.Vec3();
    this.previousQuaternion = new CANNON.Quaternion();
    this.contacts = 0; // Surface flags from the last step
    this.plate = null; // the plate touched in the last step
    this.grounded = false; // has hit the table or a plate since launch
    this.inWorld = false;
  }

  get position() {
    return this.body.position;
  }

  get quaternion() {
    return this.body.quaternion;
  }

  get velocity() {
    return this.body.velocity;
  }

  get angularVelocity() {
    return this.body.angularVelocity;
  }
}

function staticBody(surface, material, x, y, z) {
  const body = new CANNON.Body({
    mass: 0,
    material,
    position: new CANNON.Vec3(x, y, z),
    collisionFilterGroup: GROUP_STATIC,
    collisionFilterMask: GROUP_SLICE,
  });
  body.surface = surface;
  return body;
}

/**
 * The cannon-es world: the table and everything on it as static bodies, plus whichever
 * slices are loose. Slices leave the world once they land, so a full table costs nothing.
 */
export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -PHYSICS.gravity, 0) });
    this.world.solver.iterations = PHYSICS.solverIterations;
    this.world.allowSleep = false;

    this.materials = {
      slice: new CANNON.Material('slice'),
      table: new CANNON.Material('table'),
      plate: new CANNON.Material('plate'),
      bowl: new CANNON.Material('bowl'),
      turkey: new CANNON.Material('turkey'),
      decor: new CANNON.Material('decor'),
    };
    const contact = (material, restitution, friction) => {
      this.world.addContactMaterial(new CANNON.ContactMaterial(this.materials.slice, material, {
        restitution, friction,
      }));
    };
    contact(this.materials.table, PHYSICS.tableRestitution, 0.8);
    contact(this.materials.plate, PHYSICS.plateRestitution, 0.9);
    contact(this.materials.bowl, PHYSICS.bowlRestitution, 0.4);
    contact(this.materials.turkey, GIANT_TURKEY.restitution, 0.3);
    contact(this.materials.decor, PHYSICS.decorRestitution, 0.5);

    const width = TABLE.halfWidth;
    const depth = (TABLE.frontZ - TABLE.backZ) / 2;
    const table = staticBody(Surface.TABLE, this.materials.table, 0, -0.5, (TABLE.frontZ + TABLE.backZ) / 2);
    table.addShape(new CANNON.Box(new CANNON.Vec3(width, 0.5, depth)));
    this.world.addBody(table);
  }

  addPlate(plate) {
    const height = PLATE.surfaceY;
    const body = staticBody(Surface.PLATE, this.materials.plate, plate.x, height / 2, plate.z);
    body.addShape(new CANNON.Cylinder(PLATE.radius, PLATE.radius, height, 18));
    body.plate = plate;
    this.world.addBody(body);
  }

  // The bowl is two rings of spheres around a low core, with no lid, so a slice can
  // drop in through the opening but glances off the rim and outer wall.
  addBowl(bowl) {
    const body = staticBody(Surface.BOWL, this.materials.bowl, bowl.x, 0, bowl.z);
    const rimRadius = 0.09;
    const rim = new CANNON.Sphere(rimRadius);
    const wall = new CANNON.Sphere(0.16);
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const r = (bowl.outerRadius + bowl.openingRadius) / 2;
      body.addShape(rim, new CANNON.Vec3(c * r, bowl.rimHeight - rimRadius * 0.4, s * r));
      body.addShape(wall, new CANNON.Vec3(c * bowl.outerRadius * 0.8, 0.16, s * bowl.outerRadius * 0.8));
    }
    body.addShape(
      new CANNON.Cylinder(bowl.openingRadius * 0.9, bowl.openingRadius * 0.7, bowl.fillHeight, 14),
      new CANNON.Vec3(0, bowl.fillHeight / 2, 0),
    );
    this.world.addBody(body);
  }

  /** `spheres` are [x, y, z, radius] relative to the turkey. */
  addGiantTurkey(spheres) {
    const { x, z, platterRadius } = GIANT_TURKEY;
    const platter = staticBody(Surface.DECOR, this.materials.decor, x, 0.04, z);
    platter.addShape(new CANNON.Cylinder(platterRadius, platterRadius, 0.08, 20));
    this.world.addBody(platter);

    const body = staticBody(Surface.TURKEY, this.materials.turkey, x, 0, z);
    for (const [sx, sy, sz, radius] of spheres) {
      body.addShape(new CANNON.Sphere(radius), new CANNON.Vec3(sx, sy, sz));
    }
    this.world.addBody(body);
  }

  addDecorSphere(x, y, z, radius) {
    const body = staticBody(Surface.DECOR, this.materials.decor, x, y, z);
    body.addShape(new CANNON.Sphere(radius));
    this.world.addBody(body);
  }

  createSliceBody() {
    return new SliceBody(this.materials.slice);
  }

  launch(slice, position, quaternion, velocity, angularVelocity) {
    const { body } = slice;
    body.position.set(position.x, position.y, position.z);
    body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    body.velocity.set(velocity.x, velocity.y, velocity.z);
    body.angularVelocity.set(angularVelocity.x, angularVelocity.y, angularVelocity.z);
    body.force.setZero();
    body.torque.setZero();
    slice.previousPosition.copy(body.position);
    slice.previousQuaternion.copy(body.quaternion);
    slice.contacts = 0;
    slice.plate = null;
    slice.grounded = false;
    if (!slice.inWorld) {
      this.world.addBody(body);
      slice.inWorld = true;
    }
  }

  remove(slice) {
    if (!slice.inWorld) return;
    this.world.removeBody(slice.body);
    slice.inWorld = false;
  }

  /** Advances one fixed step, then records what every slice touched and applies grip. */
  step(dt) {
    const { bodies } = this.world;
    for (const body of bodies) {
      const slice = body.sliceBody;
      if (!slice) continue;
      slice.previousPosition.copy(body.position);
      slice.previousQuaternion.copy(body.quaternion);
      slice.contacts = 0;
      slice.plate = null;
    }

    this.world.step(dt);

    for (const contact of this.world.contacts) {
      const slice = contact.bi.sliceBody || contact.bj.sliceBody;
      const other = contact.bi.sliceBody ? contact.bj : contact.bi;
      if (!slice || !other.surface) continue;
      slice.contacts |= other.surface;
      if (other.plate) slice.plate = other.plate;
    }
    for (const body of bodies) {
      if (body.sliceBody) this._applyGrip(body.sliceBody, dt);
    }
  }

  // A real slice is limp and sticks where it lands. Friction alone would let a fast throw
  // skid straight across a plate, so ground contact bleeds speed and lays the slice flat.
  _applyGrip(slice, dt) {
    if ((slice.contacts & GROUND) === 0) return;
    const { velocity, angularVelocity } = slice;
    const grip = slice.grounded ? PHYSICS.contactGrip : PHYSICS.impactGrip;
    velocity.x *= grip;
    velocity.z *= grip;
    angularVelocity.scale(PHYSICS.contactGrip, angularVelocity);
    slice.grounded = true;
    layFlat(slice.quaternion, Math.min(1, 10 * dt));
  }
}

// Eases a quaternion toward lying flat, either face up, keeping its heading.
export function layFlat(quaternion, amount) {
  quaternion.vmult(_up, _sliceUp);
  if (_sliceUp.y < 0) _sliceUp.negate(_sliceUp);
  _level.setFromVectors(_sliceUp, _up);
  _level.mult(quaternion, _flat);
  quaternion.slerp(_flat, amount, quaternion);
  quaternion.normalize();
}

/**
 * Predicts the throw arc with the same fixed timestep and integrator as cannon-es, so the
 * aiming preview matches the real flight. Writes up to maxPoints samples (one every
 * sampleInterval seconds) into outPoints and returns how many were written. Stops at the
 * table.
 */
export function simulateTrajectory(start, velocity, outPoints, maxPoints, sampleInterval, maxTime) {
  const dt = PHYSICS.fixedTimestep;
  let x = start.x;
  let y = start.y;
  let z = start.z;
  let vy = velocity.y;
  let written = 0;
  let nextSample = sampleInterval;
  for (let time = 0; time < maxTime && written < maxPoints; time += dt) {
    vy -= PHYSICS.gravity * dt;
    x += velocity.x * dt;
    y += vy * dt;
    z += velocity.z * dt;
    if (y < 0.06 && vy < 0) {
      outPoints[written].set(x, 0.06, z);
      return written + 1;
    }
    if (time + dt >= nextSample) {
      outPoints[written].set(x, y, z);
      written++;
      nextSample += sampleInterval;
    }
  }
  return written;
}

/**
 * True if a slice's center dropped through the bowl's opening this step. The test sits a
 * little above the rim, because otherwise the ends of a tumbling slice clip the rim first
 * and bounce out throws that were plainly going in.
 */
export function enteredBowl(previous, current, bowl) {
  const rim = bowl.rimHeight + BOWL_CATCH_HEIGHT;
  if (previous.y <= rim || current.y > rim) return false;
  const t = (previous.y - rim) / (previous.y - current.y);
  const x = previous.x + (current.x - previous.x) * t;
  const z = previous.z + (current.z - previous.z) * t;
  return Math.hypot(x - bowl.x, z - bowl.z) <= bowl.openingRadius - 0.08;
}

/** Closest distance from point p to the segment a-b. Used so fast slices can't skip a target. */
export function segmentDistance(a, b, p) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const lengthSq = abx * abx + aby * aby + abz * abz;
  const t = lengthSq > 0
    ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / lengthSq))
    : 0;
  return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y, a.z + abz * t - p.z);
}

/**
 * Velocity for a slice leaving the giant turkey. The hit point sets the direction, then the
 * throw is steered toward the nearest plate that way, with some scatter, so bounces reliably
 * threaten a plate without always landing on it.
 */
export function bounceVelocity(position, incoming, plates, random = Math.random) {
  const cfg = GIANT_TURKEY;
  const normalX = position.x - cfg.x;
  const normalZ = position.z - cfg.z;
  let headingX = normalX + incoming.x * 0.08;
  let headingZ = normalZ + incoming.z * 0.08;
  const length = Math.hypot(headingX, headingZ);
  if (length > 1e-4) {
    headingX /= length;
    headingZ /= length;
  } else {
    const angle = random() * Math.PI * 2;
    headingX = Math.cos(angle);
    headingZ = Math.sin(angle);
  }

  const up = cfg.minUpSpeed + random() * (cfg.maxUpSpeed - cfg.minUpSpeed);
  const height = Math.max(0, position.y - PLATE.surfaceY);
  const flightTime = (up + Math.sqrt(up * up + 2 * PHYSICS.gravity * height)) / PHYSICS.gravity;

  let best = null;
  let bestCos = Math.cos((cfg.assistConeDegrees * Math.PI) / 180);
  for (const plate of plates) {
    const dx = plate.x - position.x;
    const dz = plate.z - position.z;
    const distance = Math.hypot(dx, dz);
    const cosine = (dx * headingX + dz * headingZ) / distance;
    if (cosine > bestCos) {
      bestCos = cosine;
      best = plate;
    }
  }

  let x = headingX * cfg.horizontalSpeed;
  let z = headingZ * cfg.horizontalSpeed;
  if (best) {
    const angle = random() * Math.PI * 2;
    const scatter = Math.sqrt(random()) * PLATE.radius * cfg.assistScatter;
    const targetX = (best.x + Math.cos(angle) * scatter - position.x) / flightTime;
    const targetZ = (best.z + Math.sin(angle) * scatter - position.z) / flightTime;
    x += (targetX - x) * cfg.plateAssist;
    z += (targetZ - z) * cfg.plateAssist;
  }
  return { x, y: up, z };
}
