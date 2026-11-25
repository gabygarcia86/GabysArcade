// Pooled visual effects: spray/foam/bubble particles, fading wake ribbons, blob shadows,
// rain and lightning. Nothing here allocates inside the frame loop.
import * as THREE from 'three';

// ---------------------------------------------------------------- Particles
const P_VERT = /* glsl */`
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
varying float vDist;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 256.0);
  vAlpha = aAlpha;
  vColor = aColor;
  vDist = -mv.z;
}
`;
const P_FRAG = /* glsl */`
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uLight;
varying float vAlpha;
varying vec3 vColor;
varying float vDist;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if (r > 0.5 || vAlpha <= 0.001) discard;
  float a = vAlpha * smoothstep(0.5, 0.15, r);
  vec3 col = vColor * uLight;
  float f = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
  gl_FragColor = vec4(mix(col, uFogColor, f), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const P_SPRAY = 0, P_FOAM = 1, P_BUBBLE = 2, P_SMOKE = 3, P_SPARK = 4;

export class Particles {
  constructor(max) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.kind = new Uint8Array(max);
    this.free = [];
    for (let i = max - 1; i >= 0; i--) this.free.push(i);
    this.hi = 0;
    const g = new THREE.BufferGeometry();
    const mk = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    this.aPos = mk(this.pos, 3);
    this.aCol = mk(this.col, 3);
    this.aSize = mk(this.size, 1);
    this.aAlpha = mk(this.alpha, 1);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aColor', this.aCol);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aAlpha', this.aAlpha);
    g.setDrawRange(0, 0);
    this.uniforms = {
      uScale: { value: 600 },
      uFogColor: { value: new THREE.Color('#bfe6ff') },
      uFogDensity: { value: 0.0016 },
      uLight: { value: 1 },
    };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: P_VERT, fragmentShader: P_FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, a0, r, g, b, grav = 9.8, drag = 0.6, kind = P_SPRAY) {
    if (!this.free.length) return;
    const i = this.free.pop();
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[k] = r; this.col[k + 1] = g; this.col[k + 2] = b;
    this.life[i] = life; this.maxLife[i] = life;
    this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0;
    this.size[i] = s0; this.alpha[i] = a0;
    this.grav[i] = grav; this.drag[i] = drag; this.kind[i] = kind;
    if (i + 1 > this.hi) this.hi = i + 1;
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] > 0) { this.life[i] = 0; this.alpha[i] = 0; this.free.push(i); }
    }
    this.hi = 0;
    this.mesh.geometry.setDrawRange(0, 0);
  }

  update(dt, waves) {
    let hi = 0;
    for (let i = 0; i < this.hi; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        this.free.push(i);
        continue;
      }
      hi = i + 1;
      const k = i * 3;
      const t = 1 - this.life[i] / this.maxLife[i];
      const kind = this.kind[i];
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[k] *= d; this.vel[k + 2] *= d;
      this.vel[k + 1] = this.vel[k + 1] * d - this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (kind === P_FOAM) {
        // Foam sits on the surface and spreads.
        this.pos[k + 1] = waves.heightAt(this.pos[k], this.pos[k + 2]) + 0.08;
      } else if (kind === P_SPRAY && this.vel[k + 1] < 0 && (i & 3) === 0) {
        const h = waves.heightAt(this.pos[k], this.pos[k + 2]);
        if (this.pos[k + 1] < h) { this.life[i] = Math.min(this.life[i], 0.15); this.vel[k + 1] = 0; }
      }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.alpha[i] = this.a0[i] * (t < 0.1 ? t / 0.1 : 1) * (1 - t * t);
    }
    this.hi = hi;
    const g = this.mesh.geometry;
    g.setDrawRange(0, hi);
    if (hi > 0) {
      this.aPos.needsUpdate = true;
      this.aCol.needsUpdate = true;
      this.aSize.needsUpdate = true;
      this.aAlpha.needsUpdate = true;
    }
  }
}

// ---------------------------------------------------------------- Wake ribbons
const W_VERT = /* glsl */`
attribute float aAlpha;
attribute float aAcross;
attribute float aYoung;
varying float vAlpha;
varying float vAcross;
varying float vYoung;
varying vec3 vWorld;
void main() {
  vAlpha = aAlpha;
  vAcross = aAcross;
  vYoung = aYoung;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const W_FRAG = /* glsl */`
uniform sampler2D uNoise;
uniform vec3 uColor;
uniform float uTime;
varying float vAlpha;
varying float vAcross;
varying float vYoung;
varying vec3 vWorld;
void main() {
  float u = abs(vAcross);
  // Two thin foam lines on the outer edges (the V wake) and a churned trail in the middle.
  float edge = smoothstep(0.7, 0.9, u) * (1.0 - smoothstep(0.9, 1.0, u));
  float centre = (1.0 - smoothstep(0.0, 0.35, u)) * vYoung;
  float n = texture2D(uNoise, vWorld.xz * 0.35 + uTime * 0.02).a;
  float n2 = texture2D(uNoise, vWorld.xz * 0.9 - uTime * 0.05).a;
  float foam = smoothstep(0.42, 0.8, n * 0.55 + n2 * 0.65);
  float a = (edge * 0.7 + centre * 0.5) * vAlpha * foam;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, min(a, 0.8));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class WakeTrail {
  constructor(noiseTex, max = 90) {
    this.max = max;
    this.px = new Float32Array(max);
    this.pz = new Float32Array(max);
    this.nx = new Float32Array(max);
    this.nz = new Float32Array(max);
    this.t = new Float32Array(max);
    this.w0 = new Float32Array(max);
    this.str = new Float32Array(max);
    this.gap = new Uint8Array(max);
    this.head = 0;
    this.count = 0;
    this.life = 3.6;
    const verts = max * 3;
    this.positions = new Float32Array(verts * 3);
    this.alphas = new Float32Array(verts);
    this.young = new Float32Array(verts);
    const across = new Float32Array(verts);
    for (let i = 0; i < max; i++) { across[i * 3] = -1; across[i * 3 + 1] = 0; across[i * 3 + 2] = 1; }
    const idx = [];
    for (let i = 0; i < max - 1; i++) {
      const a = i * 3, b = (i + 1) * 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage);
    this.aYoung = new THREE.BufferAttribute(this.young, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aAlpha', this.aAlpha);
    g.setAttribute('aYoung', this.aYoung);
    g.setAttribute('aAcross', new THREE.BufferAttribute(across, 1));
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    this.uniforms = { uNoise: { value: noiseTex }, uColor: { value: new THREE.Color(0xffffff) }, uTime: { value: 0 } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: W_VERT, fragmentShader: W_FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.lastX = 0;
    this.lastZ = 0;
    this.wasGap = true;
  }

  reset() {
    this.count = 0;
    this.head = 0;
    this.wasGap = true;
    this.mesh.geometry.setDrawRange(0, 0);
  }

  // Called every frame with the stern position. Adds a point every ~1.4 m.
  track(now, x, z, hx, hz, speed, inWater) {
    const dx = x - this.lastX, dz = z - this.lastZ;
    if (!inWater || speed < 2) {
      if (!this.wasGap && this.count) this.gap[(this.head - 1 + this.max) % this.max] = 1;
      this.wasGap = true;
      this.lastX = x; this.lastZ = z;
      return;
    }
    if (dx * dx + dz * dz < 1.9 && !this.wasGap) return;
    const i = this.head;
    this.px[i] = x; this.pz[i] = z;
    this.nx[i] = -hz; this.nz[i] = hx;
    this.t[i] = now;
    this.w0[i] = 0.55;
    this.str[i] = Math.min(1, speed / 22);
    this.gap[i] = 0;
    this.head = (i + 1) % this.max;
    this.count = Math.min(this.max, this.count + 1);
    this.lastX = x; this.lastZ = z;
    this.wasGap = false;
  }

  update(now, waves) {
    this.uniforms.uTime.value = now;
    let n = 0;
    // Newest first: vertex row r corresponds to point (head - 1 - r).
    for (let r = 0; r < this.count; r++) {
      const i = (this.head - 1 - r + this.max) % this.max;
      const age = now - this.t[i];
      if (age > this.life) break;
      const s = this.str[i];
      const w = this.w0[i] + age * (0.7 + 1.2 * s);
      const k = r * 9;
      for (let c = 0; c < 3; c++) {
        const o = (c - 1) * w;
        const x = this.px[i] + this.nx[i] * o, z = this.pz[i] + this.nz[i] * o;
        this.positions[k + c * 3] = x;
        this.positions[k + c * 3 + 1] = waves.heightAt(x, z) + 0.08;
        this.positions[k + c * 3 + 2] = z;
      }
      const fade = Math.pow(1 - age / this.life, 1.4) * (0.35 + 0.65 * s) * (this.gap[i] ? 0 : 1);
      const yg = Math.max(0, 1 - age / 1.6);
      for (let c = 0; c < 3; c++) {
        this.alphas[r * 3 + c] = fade * (r === 0 ? 0 : 1);
        this.young[r * 3 + c] = yg;
      }
      n = r + 1;
    }
    this.count = n;
    this.mesh.geometry.setDrawRange(0, Math.max(0, n - 1) * 12);
    if (n > 1) {
      this.aPos.needsUpdate = true;
      this.aAlpha.needsUpdate = true;
      this.aYoung.needsUpdate = true;
    }
  }
}

// ---------------------------------------------------------------- Blob shadows
let shadowTex = null;
function blobTexture() {
  if (shadowTex) return shadowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.6)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(cv);
  return shadowTex;
}

export function createBlobShadow() {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 3.4),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.6 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

// ---------------------------------------------------------------- Rain
export class Rain {
  constructor(count) {
    this.count = count;
    this.pos = new Float32Array(count * 6);
    this.seed = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.seed[i * 3] = (Math.random() - 0.5) * 70;
      this.seed[i * 3 + 1] = Math.random() * 40;
      this.seed[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    const g = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr);
    this.mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc8d8e8, transparent: true, opacity: 0.35, depthWrite: false }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.amount = 0;
  }

  update(dt, cam, wind = 4) {
    if (this.amount <= 0) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const active = Math.floor(this.count * this.amount);
    this.mesh.geometry.setDrawRange(0, active * 2);
    for (let i = 0; i < active; i++) {
      let y = this.seed[i * 3 + 1] - dt * 26;
      if (y < 0) y += 40;
      this.seed[i * 3 + 1] = y;
      const x = cam.x + this.seed[i * 3];
      const z = cam.z + this.seed[i * 3 + 2];
      const yy = cam.y - 12 + y;
      const k = i * 6;
      this.pos[k] = x; this.pos[k + 1] = yy; this.pos[k + 2] = z;
      this.pos[k + 3] = x - wind * 0.04; this.pos[k + 4] = yy + 0.9; this.pos[k + 5] = z;
    }
    this.attr.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- Lightning
export class Lightning {
  constructor() {
    const g = new THREE.BufferGeometry();
    this.pts = new Float32Array(24 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pts, 3));
    this.mesh = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 1, fog: false }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.timer = 4;
    this.flash = 0;
    this.show = 0;
    this.pendingThunder = -1;
  }

  // Returns true on the frame a strike happens.
  update(dt, cam, enabled) {
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.show -= dt;
    this.mesh.visible = this.show > 0 && (this.show * 20 | 0) % 3 !== 0;
    if (!enabled) return false;
    this.timer -= dt;
    if (this.timer > 0) return false;
    this.timer = 5 + Math.random() * 9;
    const a = Math.random() * Math.PI * 2;
    const d = 500 + Math.random() * 400;
    let x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d, y = 320;
    for (let i = 0; i < 24; i++) {
      this.pts[i * 3] = x; this.pts[i * 3 + 1] = y; this.pts[i * 3 + 2] = z;
      x += (Math.random() - 0.5) * 30; z += (Math.random() - 0.5) * 30; y -= 14;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.show = 0.35;
    this.flash = 1;
    return true;
  }
}
