// Material presets. Every object owns one material, which draws the object's paint layer
// over its base color with a small shader patch.
import * as THREE from "three";

export const PRESETS = {
  clay: { label: "Standard Clay", swatch: "#d9a58a", roughness: 0.78, metalness: 0, sheen: 0.4 },
  plastic: { label: "Shiny Plastic", swatch: "#ff5d8f", roughness: 0.18, metalness: 0, clearcoat: 1 },
  metal: { label: "Metallic", swatch: "#c9d4e4", roughness: 0.26, metalness: 1 },
  rubber: { label: "Rubber", swatch: "#3a3f55", roughness: 0.94, metalness: 0 },
  wood: { label: "Wood", swatch: "#a8723f", roughness: 0.66, metalness: 0, pattern: "wood" },
  stone: { label: "Stone", swatch: "#8f949e", roughness: 0.9, metalness: 0, pattern: "stone" },
  glass: { label: "Glass", swatch: "#9fe6ff", roughness: 0.06, metalness: 0, opacity: 0.36, clearcoat: 1 },
  cartoon: { label: "Cartoon", swatch: "#ffd23f", roughness: 1, metalness: 0, toon: true },
  glow: { label: "Glow", swatch: "#7dff6b", roughness: 0.5, metalness: 0, glow: 1.5 },
};

const clearPaint = new THREE.DataTexture(new Uint8Array(4), 1, 1);
clearPaint.needsUpdate = true;

function ramp() {
  const data = new Uint8Array([90, 170, 255]);
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

const toonRamp = ramp();
const patterns = {};

function noise(size) {
  const data = new Float32Array(size * size);
  for (let octave = 4; octave <= size / 2; octave *= 2) {
    const grid = new Float32Array(octave * octave).map(() => Math.random());
    const cell = size / octave;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = x / cell, fy = y / cell;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        const sx = (fx - ix) ** 2 * (3 - 2 * (fx - ix)), sy = (fy - iy) ** 2 * (3 - 2 * (fy - iy));
        const at = (a, b) => grid[(b % octave) * octave + (a % octave)];
        const top = at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx;
        const low = at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx;
        data[y * size + x] += (top * (1 - sy) + low * sy) * 4 / octave;
      }
    }
  }
  return data;
}

/** Tiling gray grain, multiplied into the object's color. Made once at startup of its use. */
function pattern(kind) {
  if (patterns[kind]) return patterns[kind];
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  const base = noise(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = base[y * size + x];
      let shade;
      if (kind === "wood") {
        const rings = Math.sin((x / size) * Math.PI * 2 * 7 + n * 7);
        shade = 0.74 + 0.2 * rings * rings + (n - 0.5) * 0.18;
      } else {
        shade = 0.62 + n * 0.42;
      }
      const value = Math.max(0, Math.min(255, shade * 255));
      const o = (y * size + x) * 4;
      image.data[o] = image.data[o + 1] = image.data[o + 2] = value;
      image.data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  patterns[kind] = texture;
  return texture;
}

export function patternCanvas(kind) {
  return pattern(kind).image;
}

function patchPaint(material, uniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.paintMap = uniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vPaintUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPaintUv = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vPaintUv;\nuniform sampler2D paintMap;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        vec4 paintLayer = texture2D(paintMap, vPaintUv);
        diffuseColor.rgb = mix(diffuseColor.rgb, paintLayer.rgb, paintLayer.a);`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance *= diffuseColor.rgb;`);
  };
  material.customProgramCacheKey = () => "wonder-paint";
}

/** Makes the material for an object's current color, preset and sliders. */
export function createMaterial(props, paintTexture, doubleSided) {
  const preset = PRESETS[props.preset];
  const color = new THREE.Color(props.color);
  const side = doubleSided ? THREE.DoubleSide : THREE.FrontSide;
  let material;
  if (preset.toon) {
    material = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, side });
  } else {
    material = new THREE.MeshPhysicalMaterial({
      color,
      side,
      roughness: props.roughness,
      metalness: props.metalness,
      clearcoat: preset.clearcoat ?? 0,
      clearcoatRoughness: 0.08,
      sheen: preset.sheen ?? 0,
      sheenRoughness: 0.7,
      sheenColor: 0xffffff,
      emissive: preset.glow ? 0xffffff : 0x000000,
      emissiveIntensity: preset.glow ?? 1,
    });
  }
  if (preset.opacity) {
    material.transparent = true;
    material.opacity = preset.opacity;
  }
  if (preset.pattern) {
    material.map = pattern(preset.pattern);
    if (material.isMeshPhysicalMaterial) {
      material.bumpMap = material.map;
      material.bumpScale = 1.4;
    }
  }
  const uniform = { value: paintTexture ?? clearPaint };
  patchPaint(material, uniform);
  material.userData.paint = uniform;
  return material;
}

export function setMaterialPaint(material, texture) {
  material.userData.paint.value = texture ?? clearPaint;
}
