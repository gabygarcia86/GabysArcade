import * as THREE from 'three';
import { SLICE } from './config.js';

const RINGS = 5;
const SEGMENTS = 22;
const BEND_DEPTH = 0.15;

// Paints a slice from above: creamy meat with soft grain, and roasted skin along one edge,
// which is what makes it read as carved turkey rather than a biscuit.
function createSliceTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const meat = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size * 0.5);
  meat.addColorStop(0, '#fbe6c4');
  meat.addColorStop(0.7, '#f5d2a2');
  meat.addColorStop(0.9, '#e6b47a');
  meat.addColorStop(1, '#cf9558');
  ctx.fillStyle = meat;
  ctx.fillRect(0, 0, size, size);

  // Grain runs along the slice's long axis.
  for (let i = 0; i < 46; i++) {
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(190, 118, 62, ${0.12 + Math.random() * 0.2})`;
    ctx.lineWidth = 1 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(size * 0.12, y);
    ctx.bezierCurveTo(size * 0.35, y + 8, size * 0.65, y - 8, size * 0.88, y + (Math.random() - 0.5) * 10);
    ctx.stroke();
  }

  const skin = ctx.createLinearGradient(0, size, 0, size * 0.62);
  skin.addColorStop(0, '#7a3c12');
  skin.addColorStop(0.5, '#b4661f');
  skin.addColorStop(1, 'rgba(214, 150, 80, 0)');
  ctx.fillStyle = skin;
  ctx.fillRect(0, size * 0.62, size, size * 0.38);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * A slice as two domed surfaces joined at a rounded edge. Rings of inner vertices give it
 * something to bend with: the single morph target curls the ends down, or up with a
 * negative influence, which is what makes it look floppy rather than like a stiff disc.
 */
function buildSliceGeometry() {
  const { radiusX, radiusZ, thickness } = SLICE;
  const phase = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28];
  const outline = (angle) => 1
    + 0.08 * Math.sin(2 * angle + phase[0])
    + 0.05 * Math.sin(3 * angle + phase[1])
    + 0.03 * Math.sin(5 * angle + phase[2]);

  const positions = [];
  const uvs = [];
  const indices = [];
  const ringStart = (side, ring) => (ring === 0 ? side : side + 1 + (ring - 1) * SEGMENTS);
  const surfaceHeight = (r) => (thickness / 2) * Math.sqrt(Math.max(0, 1 - r ** 4));

  for (const sign of [1, -1]) {
    positions.push(0, sign * thickness / 2, 0);
    uvs.push(0.5, 0.5);
    for (let ring = 1; ring <= RINGS; ring++) {
      const r = ring / RINGS;
      for (let segment = 0; segment < SEGMENTS; segment++) {
        const angle = (segment / SEGMENTS) * Math.PI * 2;
        const reach = r * outline(angle);
        positions.push(Math.cos(angle) * reach * radiusX, sign * surfaceHeight(r), Math.sin(angle) * reach * radiusZ);
        uvs.push(0.5 + Math.cos(angle) * r * 0.5, 0.5 + Math.sin(angle) * r * 0.5);
      }
    }
  }

  const sideSize = 1 + RINGS * SEGMENTS;
  for (const side of [0, sideSize]) {
    const flip = side !== 0;
    const triangle = (a, b, c) => (flip ? indices.push(a, c, b) : indices.push(a, b, c));
    for (let segment = 0; segment < SEGMENTS; segment++) {
      const next = (segment + 1) % SEGMENTS;
      triangle(side, ringStart(side, 1) + next, ringStart(side, 1) + segment);
      for (let ring = 1; ring < RINGS; ring++) {
        const a = ringStart(side, ring) + segment;
        const b = ringStart(side, ring) + next;
        const c = ringStart(side, ring + 1) + segment;
        const d = ringStart(side, ring + 1) + next;
        triangle(a, b, c);
        triangle(b, d, c);
      }
    }
  }
  // Both outer rings sit at y = 0, so the two sides meet there without any stitching.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const flat = geometry.attributes.position;
  const bentPositions = new Float32Array(flat.array);
  const offsets = new Float32Array(flat.count * 3);
  for (let i = 0; i < flat.count; i++) {
    const x = flat.getX(i) / radiusX;
    const offset = -BEND_DEPTH * x * x;
    bentPositions[i * 3 + 1] += offset;
    offsets[i * 3 + 1] = offset;
  }
  const bent = geometry.clone();
  bent.setAttribute('position', new THREE.BufferAttribute(bentPositions, 3));
  bent.computeVertexNormals();
  const normalOffsets = new Float32Array(flat.count * 3);
  for (let i = 0; i < normalOffsets.length; i++) {
    normalOffsets[i] = bent.attributes.normal.array[i] - geometry.attributes.normal.array[i];
  }
  geometry.morphAttributes.position = [new THREE.BufferAttribute(offsets, 3)];
  geometry.morphAttributes.normal = [new THREE.BufferAttribute(normalOffsets, 3)];
  geometry.morphTargetsRelative = true;
  bent.dispose();
  return geometry;
}

/** Fixed pool of slice meshes. All of them share one texture and a few geometries. */
export class SlicePool {
  constructor(scene) {
    this.material = new THREE.MeshStandardMaterial({
      map: createSliceTexture(),
      roughness: 0.62,
      metalness: 0,
    });
    this.geometries = Array.from({ length: SLICE.variantCount }, buildSliceGeometry);
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
    mesh.morphTargetInfluences[0] = 0;
    return mesh;
  }

  release(mesh) {
    mesh.visible = false;
    this.free.push(mesh);
  }
}
