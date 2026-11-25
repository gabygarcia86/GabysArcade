// The ocean: a Gerstner wave model shared by the GPU (water shader) and the CPU (buoyancy),
// plus the water surface mesh, the sky dome and the procedural textures they use.
import * as THREE from 'three';

export const GRAVITY = 9.81;
export const MAX_WAVES = 8;
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- Wave model (CPU side)
export class WaveModel {
  constructor() {
    this.n = MAX_WAVES;
    this.dirX = new Float32Array(MAX_WAVES);
    this.dirZ = new Float32Array(MAX_WAVES);
    this.baseAmp = new Float32Array(MAX_WAVES);
    this.amp = new Float32Array(MAX_WAVES);
    this.k = new Float32Array(MAX_WAVES);
    this.omega = new Float32Array(MAX_WAVES);
    this.baseQ = new Float32Array(MAX_WAVES);
    this.q = new Float32Array(MAX_WAVES);
    this.phase = new Float32Array(MAX_WAVES);
    this.time = 0;
    this.intensity = 1;
    this.targetIntensity = 1;
    this.steepTotal = 1;
    this.uA = Array.from({ length: MAX_WAVES }, () => new THREE.Vector4());
    this.uB = Array.from({ length: MAX_WAVES }, () => new THREE.Vector4());
    this.uEventA = new THREE.Vector4();
    this.uEventB = new THREE.Vector4(1, 0, 9, 80);
    this.uSteep = { value: 1 };
    // A single travelling "mega wave" ridge used for massive wave events.
    this.event = { active: false, x: 0, z: 0, dx: 1, dz: 0, amp: 0, width: 9, halfLen: 90, front: 0, speed: 9, age: 0, life: 0, peak: 4.5 };
    this._d = { x: 0, y: 0, z: 0 };
  }

  // spec: { swellH, swellL, chopH, chopL, windDeg, speed }
  configure(spec, seed = 1) {
    const wind = (spec.windDeg || 0) * Math.PI / 180;
    const sL = spec.swellL, sH = spec.swellH, cL = spec.chopL, cH = spec.chopH;
    const defs = [
      [sL, sH * 0.62, 0.0, 0.8],
      [sL * 0.71, sH * 0.4, 0.42, 0.75],
      [cL, cH * 0.46, -0.62, 0.9],
      [cL * 0.77, cH * 0.33, 0.95, 0.85],
      [cL * 0.57, cH * 0.24, -1.3, 0.8],
      [cL * 0.38, cH * 0.13, 0.28, 0.7],
      [cL * 0.27, cH * 0.085, 1.75, 0.6],
      [cL * 0.19, cH * 0.055, -2.25, 0.5],
    ];
    let rnd = seed * 9301 + 49297;
    const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
    let total = 0;
    for (let i = 0; i < MAX_WAVES; i++) {
      const [L, A, off, steep] = defs[i];
      const k = TAU / Math.max(L, 0.5);
      const ang = wind + off;
      this.dirX[i] = Math.cos(ang);
      this.dirZ[i] = Math.sin(ang);
      this.baseAmp[i] = A;
      this.k[i] = k;
      this.omega[i] = Math.sqrt(GRAVITY * k) * (spec.speed || 1);
      this.baseQ[i] = steep;
      this.phase[i] = rand() * TAU;
      total += k * A * steep;
    }
    this.steepBase = total;
    this.applyIntensity(true);
  }

  // Scales amplitudes for weather; keeps the summed steepness below 0.85 so crests never loop.
  applyIntensity() {
    const I = this.intensity;
    const limit = this.steepBase * I > 0.85 ? 0.85 / (this.steepBase * I) : 1;
    let st = 0;
    for (let i = 0; i < MAX_WAVES; i++) {
      this.amp[i] = this.baseAmp[i] * I;
      this.q[i] = this.baseQ[i] * limit;
      st += this.k[i] * this.amp[i] * this.q[i];
      this.uA[i].set(this.dirX[i], this.dirZ[i], this.amp[i], this.k[i]);
      this.uB[i].set(this.omega[i], this.q[i], this.phase[i], 0);
    }
    this.steepTotal = Math.max(st, 0.05);
    this.uSteep.value = this.steepTotal;
  }

  setIntensity(v, instant = false) {
    this.targetIntensity = v;
    if (instant) { this.intensity = v; this.applyIntensity(); }
  }

  startEvent(x, z, dirAngle, opts = {}) {
    const e = this.event;
    e.active = true;
    e.x = x; e.z = z;
    e.dx = Math.cos(dirAngle); e.dz = Math.sin(dirAngle);
    e.peak = opts.amp || 4.5;
    e.width = opts.width || 10;
    e.halfLen = opts.halfLen || 90;
    e.speed = opts.speed || 8;
    e.front = opts.start != null ? opts.start : -120;
    e.life = opts.life || 30;
    e.age = 0;
  }

  update(dt) {
    this.time += dt;
    if (Math.abs(this.intensity - this.targetIntensity) > 0.002) {
      this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, dt * 0.35);
      this.applyIntensity();
    }
    const e = this.event;
    if (e.active) {
      e.age += dt;
      e.front += e.speed * dt;
      const fadeIn = Math.min(1, e.age / 3);
      const fadeOut = Math.min(1, (e.life - e.age) / 3);
      e.amp = e.peak * Math.max(0, Math.min(fadeIn, fadeOut));
      if (e.age >= e.life) { e.active = false; e.amp = 0; }
    }
    this.uEventA.set(e.x, e.z, e.front, e.active ? e.amp : 0);
    this.uEventB.set(e.dx, e.dz, e.width, e.halfLen);
  }

  eventHeight(x, z) {
    const e = this.event;
    if (!e.active || e.amp <= 0) return 0;
    const ox = x - e.x, oz = z - e.z;
    const s = ox * e.dx + oz * e.dz;
    const l = Math.abs(-ox * e.dz + oz * e.dx);
    const rel = s - e.front;
    const w = rel > 0 ? e.width * 0.75 : e.width * 1.5;
    const a = e.halfLen * 0.55;
    let lat = 1;
    if (l > a) { const t = Math.min(1, (l - a) / (e.halfLen - a)); lat = 1 - t * t * (3 - 2 * t); }
    return e.amp * Math.exp(-(rel * rel) / (w * w)) * lat;
  }

  // Gerstner displacement of the undisplaced point (x0, z0).
  displace(x0, z0, out) {
    const t = this.time;
    let dx = 0, dy = 0, dz = 0;
    for (let i = 0; i < MAX_WAVES; i++) {
      const A = this.amp[i];
      const f = this.k[i] * (this.dirX[i] * x0 + this.dirZ[i] * z0) - this.omega[i] * t + this.phase[i];
      const c = Math.cos(f);
      const qa = this.q[i] * A * c;
      dx += qa * this.dirX[i];
      dz += qa * this.dirZ[i];
      dy += A * Math.sin(f);
    }
    out.x = dx; out.y = dy; out.z = dz;
    return out;
  }

  // Water height at world (x, z). Gerstner waves move points sideways, so we search for the
  // undisplaced point that lands at (x, z) with a few fixed-point iterations.
  heightAt(x, z) {
    const d = this._d;
    let x0 = x, z0 = z;
    for (let it = 0; it < 3; it++) {
      this.displace(x0, z0, d);
      x0 = x - d.x;
      z0 = z - d.z;
    }
    this.displace(x0, z0, d);
    return d.y + this.eventHeight(x, z);
  }

  // Surface normal by finite differences (used for spray direction and the wave-launch helper).
  normalAt(x, z, out) {
    const e = 0.6;
    const h = this.heightAt(x, z);
    const hx = this.heightAt(x + e, z);
    const hz = this.heightAt(x, z + e);
    out.set(-(hx - h) / e, 1, -(hz - h) / e).normalize();
    return out;
  }
}

// ---------------------------------------------------------------- Procedural textures
function tileableField(size, terms, seed) {
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const comps = [];
  for (let i = 0; i < terms; i++) {
    const fx = Math.floor(rand() * 18) - 9;
    const fy = Math.floor(rand() * 18) - 9;
    if (!fx && !fy) continue;
    const mag = Math.hypot(fx, fy);
    comps.push([fx, fy, 1 / Math.pow(mag, 1.3), rand() * TAU]);
  }
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const [fx, fy, a, p] of comps) v += a * Math.sin(TAU * (fx * x + fy * y) / size + p);
      h[y * size + x] = v;
    }
  }
  return h;
}

// RGB = tileable normal map for small ripples, A = foam breakup noise.
export function createWaterNormalTexture(size = 256) {
  const h = tileableField(size, 70, 1234);
  const f = tileableField(size, 50, 987);
  let fmin = Infinity, fmax = -Infinity;
  for (const v of f) { fmin = Math.min(fmin, v); fmax = Math.max(fmax, v); }
  const data = new Uint8Array(size * size * 4);
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const l = h[y * size + ((x - 1 + size) % size)];
      const r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x];
      const d = h[((y + 1) % size) * size + x];
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      data[i * 4] = (nx * 0.5 + 0.5) * 255;
      data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255;
      data[i * 4 + 2] = (nz * 0.5 + 0.5) * 255;
      data[i * 4 + 3] = ((f[i] - fmin) / (fmax - fmin)) * 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Seabed map: R = how shallow (0 deep, 1 beach), G = coral reef tint. fn(x, z) -> [shallow, reef].
export function createDepthTexture(rect, fn, size) {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    const z = rect.z0 + (j + 0.5) / size * rect.size;
    for (let i = 0; i < size; i++) {
      const x = rect.x0 + (i + 0.5) / size * rect.size;
      const [s, r] = fn(x, z);
      const k = (j * size + i) * 4;
      data[k] = Math.max(0, Math.min(1, s)) * 255;
      data[k + 1] = Math.max(0, Math.min(1, r)) * 255;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- Water surface
const WATER_VERT = /* glsl */`
uniform vec4 uWaveA[${MAX_WAVES}];
uniform vec4 uWaveB[${MAX_WAVES}];
uniform float uTime;
uniform vec4 uEventA;
uniform vec4 uEventB;
varying vec3 vWorld;
varying vec2 vP0;
varying vec3 vN;
varying float vCrest;
varying float vEvent;
varying float vFade;

float eventHeight(vec2 p) {
  if (uEventA.w <= 0.0) return 0.0;
  vec2 d = p - uEventA.xy;
  float s = dot(d, uEventB.xy);
  float l = abs(-d.x * uEventB.y + d.y * uEventB.x);
  float rel = s - uEventA.z;
  float w = rel > 0.0 ? uEventB.z * 0.75 : uEventB.z * 1.5;
  float lat = 1.0 - smoothstep(uEventB.w * 0.55, uEventB.w, l);
  return uEventA.w * exp(-rel * rel / (w * w)) * lat;
}

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 p0 = wp.xz;
  float dist = length(p0 - cameraPosition.xz);
  float fade = 1.0 - smoothstep(260.0, 640.0, dist);
  vec3 disp = vec3(0.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  float crest = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    vec4 a = uWaveA[i];
    vec4 b = uWaveB[i];
    float A = a.z * (i < 2 ? 1.0 : fade);
    float f = a.w * dot(a.xy, p0) - b.x * uTime + b.z;
    float c = cos(f);
    float s = sin(f);
    disp.x += b.y * A * a.x * c;
    disp.z += b.y * A * a.y * c;
    disp.y += A * s;
    float wa = a.w * A;
    n.x -= a.x * wa * c;
    n.z -= a.y * wa * c;
    n.y -= b.y * wa * s;
    crest += b.y * wa * s;
  }
  float ev = eventHeight(p0);
  if (uEventA.w > 0.0) {
    n.x -= (eventHeight(p0 + vec2(0.6, 0.0)) - ev) / 0.6;
    n.z -= (eventHeight(p0 + vec2(0.0, 0.6)) - ev) / 0.6;
  }
  disp.y += ev;
  wp.xyz += disp;
  vWorld = wp.xyz;
  vP0 = p0;
  vN = normalize(n);
  vCrest = crest;
  vEvent = ev;
  vFade = fade;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WATER_FRAG = /* glsl */`
uniform vec4 uWaveA[${MAX_WAVES}];
uniform vec4 uWaveB[${MAX_WAVES}];
uniform float uTime;
uniform vec4 uEventA;
uniform float uSteep;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uReefA;
uniform vec3 uReefB;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform samplerCube uEnvMap;
uniform float uUseEnv;
uniform sampler2D uNormalMap;
uniform sampler2D uDepthMap;
uniform vec4 uDepthRect;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uRain;
uniform float uFlash;
uniform float uSpec;
varying vec3 vWorld;
varying vec2 vP0;
varying vec3 vN;
varying float vCrest;
varying float vEvent;
varying float vFade;
uniform vec4 uEventB;

float eventHeight(vec2 p) {
  vec2 d = p - uEventA.xy;
  float s = dot(d, uEventB.xy);
  float l = abs(-d.x * uEventB.y + d.y * uEventB.x);
  float rel = s - uEventA.z;
  float w = rel > 0.0 ? uEventB.z * 0.75 : uEventB.z * 1.5;
  float lat = 1.0 - smoothstep(uEventB.w * 0.55, uEventB.w, l);
  return uEventA.w * exp(-rel * rel / (w * w)) * lat;
}

vec3 skyColor(vec3 r) {
  if (uUseEnv > 0.5) return textureCube(uEnvMap, r).rgb;
  float h = clamp(r.y, 0.0, 1.0);
  return mix(uSkyHorizon, uSkyTop, pow(h, 0.5));
}

void main() {
  vec3 N = vN;
  float crest = vCrest;
#ifdef PIXEL_NORMALS
  vec3 n = vec3(0.0, 1.0, 0.0);
  crest = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    vec4 a = uWaveA[i];
    vec4 b = uWaveB[i];
    float A = a.z * (i < 2 ? 1.0 : vFade);
    float f = a.w * dot(a.xy, vP0) - b.x * uTime + b.z;
    float c = cos(f);
    float s = sin(f);
    float wa = a.w * A;
    n.x -= a.x * wa * c;
    n.z -= a.y * wa * c;
    n.y -= b.y * wa * s;
    crest += b.y * wa * s;
  }
  if (uEventA.w > 0.0) {
    float ev0 = eventHeight(vP0);
    n.x -= (eventHeight(vP0 + vec2(0.5, 0.0)) - ev0) / 0.5;
    n.z -= (eventHeight(vP0 + vec2(0.0, 0.5)) - ev0) / 0.5;
  }
  N = normalize(n);
#endif
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;

  // Two scrolling normal-map layers for ripples (plus fast drops when it rains).
  vec2 uv1 = vWorld.xz * 0.045 + uTime * vec2(0.013, 0.009);
  vec2 uv2 = vWorld.xz * 0.115 + uTime * vec2(-0.011, 0.017);
  vec4 t1 = texture2D(uNormalMap, uv1);
  vec4 t2 = texture2D(uNormalMap, uv2);
  vec2 rip = (t1.xy - 0.5) * 1.1 + (t2.xy - 0.5) * 0.8;
#ifdef DETAIL3
  vec4 t3 = texture2D(uNormalMap, vWorld.xz * 0.32 + uTime * vec2(0.03, -0.024));
  rip += (t3.xy - 0.5) * (0.45 + uRain * 1.4);
#endif
  float detail = mix(0.55, 0.12, smoothstep(30.0, 380.0, dist));
  N = normalize(N + vec3(rip.x, 0.0, rip.y) * detail);

  // Seabed: shallow water near islands and reefs turns turquoise.
  vec2 duv = (vWorld.xz - uDepthRect.xy) / uDepthRect.z;
  vec4 dm = uDepthRect.w > 0.5 && duv.x > 0.0 && duv.y > 0.0 && duv.x < 1.0 && duv.y < 1.0
    ? texture2D(uDepthMap, duv) : vec4(0.0);
  float shallow = dm.r;
  float reef = dm.g;

  float facing = max(dot(N, V), 0.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 refl = skyColor(R);

  vec3 body = mix(uDeep, uShallow, smoothstep(0.0, 1.0, shallow) * 0.92);
  vec3 reefCol = mix(uReefA, uReefB, t1.a);
  body = mix(body, reefCol, reef * (1.0 - shallow * 0.6) * 0.75);
  // Light scattering through wave crests.
  float hgt = clamp((vWorld.y + 0.6) * 0.35, 0.0, 1.0);
  vec3 sunH = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-4);
  float sss = pow(max(dot(V, -sunH), 0.0), 3.0) * hgt;
  body += uShallow * (0.18 * hgt + 0.55 * sss) * (0.4 + 0.6 * uSunColor.g);
  body *= 0.55 + 0.45 * max(uSunDir.y, 0.15) + uFlash * 0.6;

  vec3 col = mix(body, refl, fresnel);
  // Sun glitter.
  float sd = max(dot(R, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 700.0) * 9.0 + pow(sd, 60.0) * 0.35) * uSpec * step(0.0, uSunDir.y);

  // Foam: steep crests, the mega wave ridge and the shoreline.
  float foamN = t2.a * 0.6 + t1.a * 0.4;
  float cf = smoothstep(0.5, 0.95, crest / uSteep + foamN * 0.35 - 0.15);
  float ef = smoothstep(0.55, 0.95, vEvent / max(uEventA.w, 0.01)) * step(0.01, uEventA.w) * (0.4 + foamN);
  float sf = smoothstep(0.78, 0.97, shallow) * (0.55 + 0.45 * sin(shallow * 46.0 - uTime * 1.6 + foamN * 6.0));
  sf += smoothstep(0.93, 1.0, shallow);
  float foam = clamp(cf * 0.8 + ef + sf * foamN * 1.6, 0.0, 1.0);
  col = mix(col, uFoam * (0.65 + 0.35 * max(uSunDir.y, 0.2)) + uFlash * 0.3, foam * 0.85);

  float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// A big plane whose vertices bunch up near the middle; it follows the camera.
function createWaterGeometry(n) {
  const half = 1100;
  const a = 0.32 * n;
  const b = half - a;
  const coords = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * 2 - 1;
    coords[i] = a * u + b * u * u * u;
  }
  const pos = new Float32Array((n + 1) * (n + 1) * 3);
  let p = 0;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      pos[p++] = coords[i];
      pos[p++] = 0;
      pos[p++] = coords[j];
    }
  }
  const idx = new Uint32Array(n * n * 6);
  let k = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const v = j * (n + 1) + i;
      idx[k++] = v; idx[k++] = v + n + 1; idx[k++] = v + 1;
      idx[k++] = v + 1; idx[k++] = v + n + 1; idx[k++] = v + n + 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}

export class Water {
  constructor(waves, quality) {
    this.waves = waves;
    this.normalTex = createWaterNormalTexture(256);
    this.emptyDepth = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
    this.emptyDepth.needsUpdate = true;
    this.uniforms = {
      uWaveA: { value: waves.uA },
      uWaveB: { value: waves.uB },
      uTime: { value: 0 },
      uEventA: { value: waves.uEventA },
      uEventB: { value: waves.uEventB },
      uSteep: waves.uSteep,
      uSunDir: { value: new THREE.Vector3(0.3, 0.6, 0.2).normalize() },
      uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
      uDeep: { value: new THREE.Color('#0a4a6e') },
      uShallow: { value: new THREE.Color('#2ad4d0') },
      uFoam: { value: new THREE.Color('#ffffff') },
      uReefA: { value: new THREE.Color('#ff7a8a') },
      uReefB: { value: new THREE.Color('#ffc861') },
      uSkyTop: { value: new THREE.Color('#2d7fd3') },
      uSkyHorizon: { value: new THREE.Color('#bfe6ff') },
      uEnvMap: { value: null },
      uUseEnv: { value: 0 },
      uNormalMap: { value: this.normalTex },
      uDepthMap: { value: this.emptyDepth },
      uDepthRect: { value: new THREE.Vector4(0, 0, 1, 0) },
      uFogColor: { value: new THREE.Color('#bfe6ff') },
      uFogDensity: { value: 0.0016 },
      uRain: { value: 0 },
      uFlash: { value: 0 },
      uSpec: { value: 1 },
    };
    this.mesh = null;
    this.setQuality(quality);
  }

  setQuality(quality) {
    const n = quality === 'high' ? 250 : quality === 'medium' ? 180 : 120;
    const defines = {};
    if (quality !== 'low') defines.PIXEL_NORMALS = 1;
    if (quality === 'high') defines.DETAIL3 = 1;
    const material = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: this.uniforms,
      defines,
    });
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh.geometry = createWaterGeometry(n);
      this.mesh.material = material;
    } else {
      this.mesh = new THREE.Mesh(createWaterGeometry(n), material);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = -1;
    }
  }

  setDepthMap(tex, rect) {
    if (this.uniforms.uDepthMap.value && this.uniforms.uDepthMap.value !== this.emptyDepth) {
      this.uniforms.uDepthMap.value.dispose();
    }
    this.uniforms.uDepthMap.value = tex || this.emptyDepth;
    if (rect) this.uniforms.uDepthRect.value.set(rect.x0, rect.z0, rect.size, 1);
    else this.uniforms.uDepthRect.value.set(0, 0, 1, 0);
  }

  update(camera) {
    this.uniforms.uTime.value = this.waves.time;
    // Snap to a 2 m grid so the dense centre stays under the camera without jitter.
    this.mesh.position.set(Math.round(camera.position.x / 2) * 2, 0, Math.round(camera.position.z / 2) * 2);
  }
}

// ---------------------------------------------------------------- Sky dome
const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

const SKY_FRAG = /* glsl */`
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uCloudColor;
uniform vec3 uCloudShade;
uniform float uCloud;
uniform float uTime;
uniform float uNight;
uniform float uFlash;
uniform float uSunSize;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < OCTAVES; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uGround, smoothstep(0.0, -0.1, h));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 6.0) * 0.18 + pow(sd, 48.0) * 0.45);
  col += uSunColor * smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.5, sd) * (3.0 - uNight * 1.6);

  if (uNight > 0.0 && h > 0.0) {
    vec2 c = floor(vec2(atan(d.z, d.x) * 260.0, h * 420.0));
    float st = step(0.9965, hash(c)) * (0.6 + 0.4 * sin(uTime * 3.0 + hash(c + 3.0) * 20.0));
    col += vec3(st) * uNight * smoothstep(0.02, 0.3, h) * (1.0 - uCloud);
  }

  if (h > -0.02) {
    vec2 uv = d.xz / (max(h, 0.0) + 0.14) * 0.85 + uTime * vec2(0.008, 0.003);
    float n = fbm(uv * 1.3);
    float cov = smoothstep(1.0 - uCloud * 0.95, 1.25 - uCloud * 0.75, n);
    float lit = fbm(uv * 1.3 + uSunDir.xz * 0.25);
    vec3 cc = mix(uCloudColor, uCloudShade, clamp((lit - n) * 3.0 + 0.45, 0.0, 1.0));
    cc += uSunColor * pow(sd, 10.0) * 0.6;
    col = mix(col, cc, cov * smoothstep(-0.02, 0.1, h) * 0.95);
    col += uFlash * vec3(0.55, 0.6, 0.85) * (0.25 + cov);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Sky {
  constructor(quality) {
    this.uniforms = {
      uTop: { value: new THREE.Color('#2d7fd3') },
      uHorizon: { value: new THREE.Color('#bfe6ff') },
      uGround: { value: new THREE.Color('#1a5c80') },
      uSunDir: { value: new THREE.Vector3(0.3, 0.6, 0.2).normalize() },
      uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
      uCloudColor: { value: new THREE.Color('#ffffff') },
      uCloudShade: { value: new THREE.Color('#9fb4c8') },
      uCloud: { value: 0.35 },
      uTime: { value: 0 },
      uNight: { value: 0 },
      uFlash: { value: 0 },
      uSunSize: { value: 0.0009 },
    };
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 40, 20), null);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -2;
    this.setQuality(quality);
  }

  setQuality(quality) {
    if (this.mesh.material) this.mesh.material.dispose();
    this.mesh.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      defines: { OCTAVES: quality === 'low' ? 3 : quality === 'medium' ? 4 : 5 },
    });
  }
}
