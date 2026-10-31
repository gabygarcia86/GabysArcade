// Exports to GLB, glTF, OBJ and STL. Objects are copied into a throwaway scene first: the copy
// has tight geometry, a plain standard material, and paint baked over the base color.
import * as THREE from "three";
import { GLTFExporter } from "three/addons/GLTFExporter.js";
import { OBJExporter } from "three/addons/OBJExporter.js";
import { STLExporter } from "three/addons/STLExporter.js";
import { PRESETS, patternCanvas } from "./materials.js";
import { downloadBlob, safeName } from "./project-manager.js";

export const FORMATS = {
  glb: { label: "GLB", note: "Best for games, Blender and 3D viewers. Colors included.", extension: "glb", type: "model/gltf-binary" },
  gltf: { label: "glTF", note: "Like GLB, but as readable text. Colors included.", extension: "gltf", type: "model/gltf+json" },
  obj: { label: "OBJ", note: "Works almost everywhere. Colors are stored per point.", extension: "obj", type: "text/plain" },
  stl: { label: "STL", note: "For 3D printers. Shape only, no colors.", extension: "stl", type: "model/stl" },
};

/** Draws base color, material grain and paint into one opaque texture canvas. */
function bakeCanvas(object) {
  const { size, data } = object.paint;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = object.props.color;
  ctx.fillRect(0, 0, size, size);
  const kind = PRESETS[object.props.preset].pattern;
  if (kind) {
    const scaled = document.createElement("canvas");
    scaled.width = scaled.height = Math.ceil(size / 3);
    scaled.getContext("2d").drawImage(patternCanvas(kind), 0, 0, scaled.width, scaled.height);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = ctx.createPattern(scaled, "repeat");
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
  }
  const layer = document.createElement("canvas");
  layer.width = layer.height = size;
  layer.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data), size, size), 0, 0);
  ctx.drawImage(layer, 0, 0);
  return canvas;
}

function exportMaterial(object) {
  const { props } = object;
  const preset = PRESETS[props.preset];
  const material = new THREE.MeshStandardMaterial({
    name: `${object.name} material`,
    color: props.color,
    roughness: props.roughness,
    metalness: props.metalness,
    side: object.open ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (preset.opacity) {
    material.transparent = true;
    material.opacity = preset.opacity;
  }
  if (preset.glow) {
    material.emissive.set(props.color);
    material.emissiveIntensity = preset.glow;
  }
  if (object.paint) {
    const texture = new THREE.CanvasTexture(bakeCanvas(object));
    texture.colorSpace = THREE.SRGBColorSpace;
    // Paint rows are stored with v = 0 first, which is already how glTF reads images.
    texture.flipY = false;
    material.map = texture;
    material.color.set(0xffffff);
    if (preset.glow) {
      material.emissive.set(0xffffff);
      material.emissiveMap = texture;
    }
  } else if (preset.pattern) {
    material.map = object.mesh.material.map;
  }
  return material;
}

/** Works out a color for each vertex, since a plain OBJ file can't carry the paint texture. */
function vertexColors(geometry, object) {
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const base = new THREE.Color(object.props.color);
  const uv = geometry.attributes.uv;
  const paint = object.paint;
  const color = new THREE.Color();
  for (let v = 0; v < count; v++) {
    color.copy(base);
    if (paint) {
      const px = Math.min(paint.size - 1, Math.floor(uv.getX(v) * paint.size));
      const py = Math.min(paint.size - 1, Math.floor(uv.getY(v) * paint.size));
      const o = (py * paint.size + px) * 4;
      const alpha = paint.data[o + 3] / 255;
      if (alpha > 0) {
        const painted = new THREE.Color().setRGB(
          paint.data[o] / 255, paint.data[o + 1] / 255, paint.data[o + 2] / 255, THREE.SRGBColorSpace);
        color.lerp(painted, alpha);
      }
    }
    colors.set([color.r, color.g, color.b], v * 3);
  }
  return colors;
}

/** Adds colors to the `v` lines, the widely read "x y z r g b" form. three's exporter skips them. */
function colorObjText(text, palettes) {
  const merged = new Float32Array(palettes.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const palette of palettes) {
    merged.set(palette, offset);
    offset += palette.length;
  }
  let v = 0;
  return text.replace(/^v .*$/gm, (line) => {
    const colored = `${line} ${merged[v].toFixed(4)} ${merged[v + 1].toFixed(4)} ${merged[v + 2].toFixed(4)}`;
    v += 3;
    return colored;
  });
}

function buildExportScene(objects, format, highQuality) {
  const root = new THREE.Scene();
  root.name = "3D Wonder Studio";
  const cleanup = [];
  const palettes = [];
  for (const object of objects) {
    let geometry;
    if (highQuality) {
      const refined = object.sculpt.clone();
      refined.subdivide();
      refined.smoothAll(0.35, 1);
      geometry = refined.toExportGeometry();
      refined.dispose();
    } else {
      geometry = object.sculpt.toExportGeometry();
    }
    if (format === "obj") palettes.push(vertexColors(geometry, object));
    const material = exportMaterial(object);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = object.name;
    mesh.position.copy(object.mesh.position);
    mesh.quaternion.copy(object.mesh.quaternion);
    mesh.scale.copy(object.mesh.scale);
    root.add(mesh);
    cleanup.push(() => {
      geometry.dispose();
      material.dispose();
    });
  }
  root.updateMatrixWorld(true);
  return { root, cleanup, palettes };
}

/** Makes the file for a format. Returns a Blob, so tests can read what a user would get. */
export async function exportModel(objects, format, { highQuality = false } = {}) {
  const info = FORMATS[format];
  const { root, cleanup, palettes } = buildExportScene(objects, format, highQuality);
  try {
    let content;
    if (format === "glb" || format === "gltf") {
      content = await new GLTFExporter().parseAsync(root, { binary: format === "glb" });
      if (format === "gltf") content = JSON.stringify(content);
    } else if (format === "obj") {
      content = colorObjText(new OBJExporter().parse(root), palettes);
    } else {
      content = new STLExporter().parse(root, { binary: true });
    }
    return new Blob([content], { type: info.type });
  } finally {
    cleanup.forEach((fn) => fn());
  }
}

export async function downloadModel(objects, format, name, options) {
  const blob = await exportModel(objects, format, options);
  downloadBlob(blob, `${safeName(name)}.${FORMATS[format].extension}`);
  return blob;
}
