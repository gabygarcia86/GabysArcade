// Texture painting. A brush is a sphere in 3D: for each triangle under it, the texels of that
// triangle are filled by their distance from the brush center. Working in 3D means strokes
// cross texture seams cleanly, and keeping the pixels in JavaScript means painting needs no
// float render targets, survives a lost WebGL context, and is easy to undo and save.
import * as THREE from "three";
import { setMaterialPaint } from "./materials.js";

const MAX_DABS_PER_FRAME = 10;
const FULL_UPLOAD_ROWS = 256;

export class PaintLayer {
  constructor(size, baseColor, data = null) {
    this.size = size;
    this.data = data ?? new Uint8Array(size * size * 4);
    this.texture = new THREE.DataTexture(this.data, size, size, THREE.RGBAFormat);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
    this.ready = false;
    // A partial upload can't be the first one, or the rest of the texture would stay blank.
    this.texture.onUpdate = () => { this.ready = true; };
    if (!data) this.fillBase(baseColor);
  }

  /** Gives bare texels the object's color, so soft stroke edges fade toward it, not black. */
  fillBase(hex) {
    const [r, g, b] = hexBytes(hex);
    const { data } = this;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    }
    this.upload();
  }

  upload() {
    this.texture.clearUpdateRanges();
    this.texture.needsUpdate = true;
  }

  uploadRows(y0, y1, x0, x1) {
    if (y1 - y0 > FULL_UPLOAD_ROWS || !this.ready) {
      this.upload();
      return;
    }
    for (let y = y0; y <= y1; y++) {
      this.texture.addUpdateRange((y * this.size + x0) * 4, (x1 - x0 + 1) * 4);
    }
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
  }
}

export class PaintEngine {
  constructor(app) {
    this.app = app;
    this.stroke = null;
  }

  get active() {
    return Boolean(this.stroke);
  }

  layerFor(object) {
    if (!object.paint) {
      object.paint = new PaintLayer(this.app.quality.textureSize, object.props.color);
      setMaterialPaint(object.mesh.material, object.paint.texture);
    }
    return object.paint;
  }

  begin(erase, hit, screen, pressure) {
    const { app } = this;
    this.stroke = {
      erase,
      rgb: hexBytes(app.paint.color),
      opacity: app.paint.opacity,
      table: buildFalloff(app.paint.hardness),
      targets: new Map(),
      last: { x: screen.x, y: screen.y },
      pressure,
      queued: hit,
    };
  }

  move(screen, pressure) {
    if (!this.stroke) return;
    this.stroke.target = screen;
    this.stroke.pressure = pressure;
  }

  _target(object) {
    const s = this.stroke;
    let target = s.targets.get(object);
    if (!target) {
      const hadLayer = Boolean(object.paint);
      const layer = this.layerFor(object);
      target = {
        layer,
        hadLayer,
        before: layer.data.slice(),
        mask: new Uint8Array(layer.size * layer.size),
        x0: layer.size, y0: layer.size, x1: -1, y1: -1,
        rx0: 0, ry0: 0, rx1: -1, ry1: -1,
      };
      s.targets.set(object, target);
    }
    return target;
  }

  tick() {
    const s = this.stroke;
    if (!s) return;
    const { pick } = this.app;
    if (s.queued) {
      this._dab(s.queued);
      s.queued = null;
    }
    if (s.target) {
      const dx = s.target.x - s.last.x;
      const dy = s.target.y - s.last.y;
      const distance = Math.hypot(dx, dy);
      const count = Math.min(MAX_DABS_PER_FRAME, Math.max(1, Math.ceil(distance / 5)));
      for (let i = 1; i <= count; i++) {
        const hit = pick.fromScreen({ x: s.last.x + dx * i / count, y: s.last.y + dy * i / count });
        if (hit) this._dab(hit);
      }
      s.last.x = s.target.x;
      s.last.y = s.target.y;
      s.target = null;
    }
    for (const target of s.targets.values()) {
      if (target.ry1 >= target.ry0) {
        target.layer.uploadRows(target.ry0, target.ry1, target.rx0, target.rx1);
        target.rx0 = target.ry0 = 0;
        target.rx1 = target.ry1 = -1;
      }
    }
    this.app.requestRender();
  }

  _dab(hit) {
    const { app } = this;
    const s = this.stroke;
    const object = hit.object;
    const scale = object.meanScale();
    const r = app.paint.radius / scale;
    const local = hit.local;
    for (const m of app.symmetry.mirrors()) {
      this._dabAt(object, r,
        local.x * m[0], local.y * m[1], local.z * m[2],
        local.nx * m[0], local.ny * m[1], local.nz * m[2]);
    }
    s.touched = true;
  }

  _dabAt(object, r, cx, cy, cz, nx, ny, nz) {
    const s = this.stroke;
    const t = this._target(object);
    const { layer, mask, before } = t;
    const { size, data } = layer;
    const mesh = object.sculpt;
    const { pos, uv, idx } = mesh;
    const tris = mesh.queryTris(cx, cy, cz, r, (this._tris ??= []));
    const opacity = s.opacity * (this.app.brush.pressure ? s.pressure : 1);
    const rr = r * r;
    const table = s.table;
    const [pr, pg, pb] = s.rgb;
    let rx0 = size, ry0 = size, rx1 = -1, ry1 = -1;

    for (let i = 0; i < tris.length; i++) {
      const tri = tris[i];
      const a = idx[tri * 3], b = idx[tri * 3 + 1], c = idx[tri * 3 + 2];
      const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
      const bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
      const dx = pos[c * 3], dy = pos[c * 3 + 1], dz = pos[c * 3 + 2];

      // Skip the far side of thin shapes, and triangles entirely outside the brush.
      const fx = (by - ay) * (dz - az) - (bz - az) * (dy - ay);
      const fy = (bz - az) * (dx - ax) - (bx - ax) * (dz - az);
      const fz = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
      if (fx * nx + fy * ny + fz * nz < 0) continue;
      const gx = Math.max(Math.min(ax, bx, dx) - cx, 0, cx - Math.max(ax, bx, dx));
      const gy = Math.max(Math.min(ay, by, dy) - cy, 0, cy - Math.max(ay, by, dy));
      const gz = Math.max(Math.min(az, bz, dz) - cz, 0, cz - Math.max(az, bz, dz));
      if (gx * gx + gy * gy + gz * gz > rr) continue;

      const u0 = uv[a * 2] * size, v0 = uv[a * 2 + 1] * size;
      const u1 = uv[b * 2] * size, v1 = uv[b * 2 + 1] * size;
      const u2 = uv[c * 2] * size, v2 = uv[c * 2 + 1] * size;
      const area = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
      if (Math.abs(area) < 1e-7) continue;
      const inv = 1 / area;

      // Barycentric coordinates are linear across texture space, so step them per texel.
      const w0x = (v1 - v2) * inv, w0y = (u2 - u1) * inv;
      const w1x = (v2 - v0) * inv, w1y = (u0 - u2) * inv;
      const w2x = (v0 - v1) * inv, w2y = (u1 - u0) * inv;

      // Each triangle grows by about a texel so bilinear filtering never meets a gap.
      const e0 = 1.3 * Math.hypot(w0x, w0y);
      const e1 = 1.3 * Math.hypot(w1x, w1y);
      const e2 = 1.3 * Math.hypot(w2x, w2y);

      const minX = Math.max(0, Math.floor(Math.min(u0, u1, u2) - 2));
      const maxX = Math.min(size - 1, Math.ceil(Math.max(u0, u1, u2) + 2));
      const minY = Math.max(0, Math.floor(Math.min(v0, v1, v2) - 2));
      const maxY = Math.min(size - 1, Math.ceil(Math.max(v0, v1, v2) + 2));

      for (let y = minY; y <= maxY; y++) {
        const py = y + 0.5, qx = minX + 0.5;
        let w0 = ((u2 - u1) * (py - v1) - (v2 - v1) * (qx - u1)) * inv;
        let w1 = ((u0 - u2) * (py - v2) - (v0 - v2) * (qx - u2)) * inv;
        let w2 = 1 - w0 - w1;
        for (let x = minX; x <= maxX; x++, w0 += w0x, w1 += w1x, w2 += w2x) {
          if (w0 < -e0 || w1 < -e1 || w2 < -e2) continue;
          const ox = w0 * ax + w1 * bx + w2 * dx - cx;
          const oy = w0 * ay + w1 * by + w2 * dy - cy;
          const oz = w0 * az + w1 * bz + w2 * dz - cz;
          const d2 = ox * ox + oy * oy + oz * oz;
          if (d2 >= rr) continue;
          const coverage = table[d2 / rr * 255 | 0];
          const m = y * size + x;
          if (coverage <= mask[m]) continue;
          mask[m] = coverage;
          // Every write starts from the pre-stroke texel, so overlap can't build up opacity.
          const k = coverage / 255 * opacity;
          const o = m * 4;
          const baseA = before[o + 3] / 255;
          if (s.erase) {
            data[o] = before[o];
            data[o + 1] = before[o + 1];
            data[o + 2] = before[o + 2];
            data[o + 3] = before[o + 3] * (1 - k);
          } else {
            const outA = k + baseA * (1 - k);
            const mix = k / outA;
            data[o] = before[o] + (pr - before[o]) * mix;
            data[o + 1] = before[o + 1] + (pg - before[o + 1]) * mix;
            data[o + 2] = before[o + 2] + (pb - before[o + 2]) * mix;
            data[o + 3] = outA * 255;
          }
          if (x < rx0) rx0 = x;
          if (x > rx1) rx1 = x;
          if (y < ry0) ry0 = y;
          if (y > ry1) ry1 = y;
        }
      }
    }
    if (ry1 < 0) return;
    if (rx0 < t.x0) t.x0 = rx0;
    if (ry0 < t.y0) t.y0 = ry0;
    if (rx1 > t.x1) t.x1 = rx1;
    if (ry1 > t.y1) t.y1 = ry1;
    if (t.ry1 < t.ry0) {
      t.rx0 = rx0; t.ry0 = ry0; t.rx1 = rx1; t.ry1 = ry1;
    } else {
      t.rx0 = Math.min(t.rx0, rx0);
      t.ry0 = Math.min(t.ry0, ry0);
      t.rx1 = Math.max(t.rx1, rx1);
      t.ry1 = Math.max(t.ry1, ry1);
    }
  }

  end() {
    const s = this.stroke;
    if (!s) return;
    this.tick();
    this.stroke = null;
    const changes = [];
    for (const [object, t] of s.targets) {
      if (t.y1 < 0) continue;
      changes.push({ object, layer: t.layer, ...cropChange(t) });
    }
    if (!changes.length) return;
    const { app } = this;
    const restore = (key) => {
      for (const change of changes) pasteRect(change.layer, change.rect, change[key]);
      app.requestRender();
    };
    app.history.push({
      label: s.erase ? "Erase" : "Paint",
      bytes: changes.reduce((sum, c) => sum + c.before.byteLength * 2, 0),
      undo: () => restore("before"),
      redo: () => restore("after"),
    });
  }
}

function hexBytes(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [value >> 16 & 255, value >> 8 & 255, value & 255];
}

function buildFalloff(hardness) {
  const table = new Uint8Array(256);
  const edge = Math.min(0.97, hardness);
  for (let i = 0; i < 256; i++) {
    const t = Math.sqrt(i / 255);
    const fade = t <= edge ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * (t - edge) / (1 - edge));
    table[i] = Math.round(fade * 255);
  }
  return table;
}

function cropChange(t) {
  const rect = { x: t.x0, y: t.y0, w: t.x1 - t.x0 + 1, h: t.y1 - t.y0 + 1 };
  const { size, data } = t.layer;
  const before = new Uint8Array(rect.w * rect.h * 4);
  const after = new Uint8Array(rect.w * rect.h * 4);
  for (let row = 0; row < rect.h; row++) {
    const start = ((rect.y + row) * size + rect.x) * 4;
    const end = start + rect.w * 4;
    before.set(t.before.subarray(start, end), row * rect.w * 4);
    after.set(data.subarray(start, end), row * rect.w * 4);
  }
  return { rect, before, after };
}

function pasteRect(layer, rect, pixels) {
  for (let row = 0; row < rect.h; row++) {
    const start = row * rect.w * 4;
    layer.data.set(pixels.subarray(start, start + rect.w * 4), ((rect.y + row) * layer.size + rect.x) * 4);
  }
  layer.upload();
}
