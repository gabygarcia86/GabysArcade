import * as THREE from 'three';
import { SLICE } from './config.js';

const SEGMENTS = 20;

// Drumstick outline from the bone tip (-x) to the meaty end (+x), as [x, radius] in
// fractions of SLICE.radiusX. The leg is turned around this axis, then flattened a little
// so it lies on a plate the way a real one does.
const PROFILE = [
  [-1.0, 0], [-0.985, 0.09], [-0.94, 0.15], [-0.87, 0.155], [-0.81, 0.11], [-0.77, 0.085],
  [-0.6, 0.075], [-0.47, 0.082],
  [-0.42, 0.13], [-0.33, 0.18], [-0.17, 0.26], [0.05, 0.335], [0.3, 0.38], [0.55, 0.385],
  [0.75, 0.34], [0.88, 0.26], [0.96, 0.15], [1.0, 0],
];
// Where the bare bone ends and the meat begins, as a fraction of the leg's length.
const BONE_FRACTION = (-0.45 + 1) / 2;
const MAX_RADIUS = Math.max(...PROFILE.map(([, r]) => r));
const _seam = new THREE.Vector3();

// Paints the leg unrolled: v runs from the bone tip (bottom) to the meaty end (top) and u
// runs around it. Golden roasted skin with darker crisp patches, and a clean bone.
function createLegTexture() {
  const width = 128;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const boneTop = height * (1 - BONE_FRACTION);

  const skin = ctx.createLinearGradient(0, boneTop, 0, 0);
  skin.addColorStop(0, '#d9913f');
  skin.addColorStop(0.35, '#c4702a');
  skin.addColorStop(0.8, '#a9561c');
  skin.addColorStop(1, '#7c3a12');
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, width, boneTop);

  // Blotches are drawn three times, shifted by a full width, so they wrap around the seam.
  const blotch = (x, y, rx, ry, color) => {
    ctx.fillStyle = color;
    for (const shift of [-width, 0, width]) {
      ctx.beginPath();
      ctx.ellipse(x + shift, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  for (let i = 0; i < 26; i++) {
    blotch(Math.random() * width, Math.random() * boneTop * 0.95, 6 + Math.random() * 14, 4 + Math.random() * 9,
      `rgba(105, 45, 12, ${0.12 + Math.random() * 0.18})`);
  }
  for (let i = 0; i < 18; i++) {
    blotch(Math.random() * width, Math.random() * boneTop * 0.9, 4 + Math.random() * 9, 2 + Math.random() * 5,
      `rgba(255, 214, 140, ${0.15 + Math.random() * 0.2})`);
  }
  for (let i = 0; i < 140; i++) {
    blotch(Math.random() * width, Math.random() * boneTop, 0.8 + Math.random() * 1.4, 0.8 + Math.random() * 1.2,
      `rgba(90, 38, 10, ${0.25 + Math.random() * 0.35})`);
  }

  const bone = ctx.createLinearGradient(0, boneTop, 0, height);
  bone.addColorStop(0, '#ead8b4');
  bone.addColorStop(0.6, '#f6ecd6');
  bone.addColorStop(1, '#e3cfa6');
  ctx.fillStyle = bone;
  ctx.fillRect(0, boneTop, width, height - boneTop);

  // A ragged, darker rim where the skin pulls back from the bone.
  ctx.fillStyle = '#8a4415';
  ctx.beginPath();
  ctx.moveTo(0, boneTop - 4);
  for (let x = 0; x <= width; x += 8) {
    ctx.lineTo(x, boneTop + 2 + Math.random() * 7);
    ctx.lineTo(x + 4, boneTop - 1 + Math.random() * 3);
  }
  ctx.lineTo(width, boneTop - 4);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

/**
 * A drumstick lying along x, centred on the physics body so it spans the same length as
 * the collision shape. Each variant gets a slightly different lumpy outline on the meat.
 */
function buildLegGeometry() {
  const length = SLICE.radiusX;
  const flatten = (SLICE.thickness / 2) / (MAX_RADIUS * length);
  const phase = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28];
  const lump = (angle, along) => 1 + 0.07 * Math.sin(2 * angle + phase[0] + along * 2)
    + 0.04 * Math.sin(3 * angle + phase[1])
    + 0.03 * Math.sin(along * 9 + phase[2]);

  const positions = [];
  const uvs = [];
  const indices = [];
  const columns = SEGMENTS + 1; // the seam column is duplicated so u can run 0 to 1
  PROFILE.forEach(([along, radius], ring) => {
    const meat = along > -0.45 ? 1 : 0;
    for (let segment = 0; segment <= SEGMENTS; segment++) {
      const angle = (segment / SEGMENTS) * Math.PI * 2;
      const r = radius * length * (meat ? lump(angle, along) : 1);
      positions.push(along * length, Math.cos(angle) * r * flatten, Math.sin(angle) * r);
      uvs.push(segment / SEGMENTS, (along + 1) / 2);
    }
    if (ring === 0) return;
    for (let segment = 0; segment < SEGMENTS; segment++) {
      const a = (ring - 1) * columns + segment;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // The duplicated seam vertices each only see one side; give both the shared normal.
  const normals = geometry.attributes.normal;
  const n = new THREE.Vector3();
  for (let ring = 0; ring < PROFILE.length; ring++) {
    const first = ring * columns;
    const last = first + SEGMENTS;
    n.fromBufferAttribute(normals, first).add(_seam.fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, n.x, n.y, n.z);
    normals.setXYZ(last, n.x, n.y, n.z);
  }
  return geometry;
}

/** Fixed pool of turkey-leg meshes. All of them share one texture and a few geometries. */
export class SlicePool {
  constructor(scene) {
    this.material = new THREE.MeshStandardMaterial({
      map: createLegTexture(),
      roughness: 0.48,
      metalness: 0,
    });
    this.geometries = Array.from({ length: SLICE.variantCount }, buildLegGeometry);
    this.free = [];
    this.all = [];
    for (let i = 0; i < SLICE.poolSize; i++) {
      const mesh = this.createMesh();
      mesh.visible = false;
      scene.add(mesh);
      this.all.push(mesh);
      this.free.push(mesh);
    }
  }

  createMesh() {
    const geometry = this.geometries[Math.floor(Math.random() * this.geometries.length)];
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  acquire() {
    const mesh = this.free.pop();
    if (!mesh) return null;
    mesh.visible = true;
    mesh.scale.setScalar(1);
    return mesh;
  }

  release(mesh) {
    mesh.visible = false;
    this.free.push(mesh);
  }
}
