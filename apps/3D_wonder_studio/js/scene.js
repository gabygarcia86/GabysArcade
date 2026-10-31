// The renderer, lights, floor grid, ground shadow and background.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";

const GRID_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GRID_FRAGMENT = /* glsl */ `
  varying vec3 vWorld;
  uniform vec3 lineColor;
  uniform float fadeRadius;
  float line(vec2 p, float scale) {
    vec2 q = p / scale;
    vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
    return 1.0 - min(min(g.x, g.y), 1.0);
  }
  void main() {
    float d = length(vWorld.xz);
    float fade = 1.0 - smoothstep(fadeRadius * 0.35, fadeRadius, d);
    float minor = line(vWorld.xz, 0.5) * 0.22;
    float major = line(vWorld.xz, 2.5) * 0.6;
    float alpha = max(minor, major) * fade;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(lineColor, alpha);
    #include <colorspace_fragment>
  }
`;

export class StudioScene {
  constructor(canvas, app) {
    this.app = app;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.objectRoot = new THREE.Group();
    this.scene.add(this.objectRoot);

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.62;
    pmrem.dispose();

    this.key = new THREE.DirectionalLight(0xffffff, 2.4);
    this.key.position.set(3.5, 7, 5);
    this.key.castShadow = true;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = 5;
    this.scene.add(this.key, this.key.target);

    const fill = new THREE.DirectionalLight(0x9fc4ff, 0.7);
    fill.position.set(-5, 2.5, 3);
    const rim = new THREE.DirectionalLight(0xc8a0ff, 0.9);
    rim.position.set(-1, 3.5, -6);
    this.scene.add(fill, rim);

    this.groundY = -1.3;
    this._buildFloor();
    this.fitShadow(4);
  }

  _buildFloor() {
    const geometry = new THREE.PlaneGeometry(160, 160);
    geometry.rotateX(-Math.PI / 2);
    this.shadowFloor = new THREE.Mesh(geometry, new THREE.ShadowMaterial({ opacity: 0.32 }));
    this.shadowFloor.receiveShadow = true;
    this.gridMaterial = new THREE.ShaderMaterial({
      vertexShader: GRID_VERTEX,
      fragmentShader: GRID_FRAGMENT,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: { lineColor: { value: new THREE.Color("#3da5ff") }, fadeRadius: { value: 18 } },
    });
    this.grid = new THREE.Mesh(geometry, this.gridMaterial);
    this.floor = new THREE.Group();
    this.floor.add(this.grid, this.shadowFloor);
    this.floor.position.y = this.groundY;
    this.scene.add(this.floor);
  }

  setGroundY(y) {
    this.groundY = y;
    this.floor.position.y = y;
    this.app.requestRender();
  }

  fitShadow(radius) {
    const size = Math.max(3, radius * 1.5);
    const cam = this.key.shadow.camera;
    cam.left = cam.bottom = -size;
    cam.right = cam.top = size;
    cam.near = 0.5;
    cam.far = 40 + size * 2;
    this.key.position.setLength(Math.max(9, size * 3));
    cam.updateProjectionMatrix();
    this.app.requestRender();
  }

  setQuality(quality) {
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
    this.key.shadow.mapSize.setScalar(quality.shadowSize);
    if (this.key.shadow.map) {
      this.key.shadow.map.dispose();
      this.key.shadow.map = null;
    }
    r.shadowMap.needsUpdate = true;
    this.key.castShadow = quality.shadowSize > 0;
    this.app.requestRender();
  }

  /** Paints a soft vertical gradient from the chosen workspace color. */
  setBackground(hex, lightGrid) {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const base = new THREE.Color(hex);
    const top = base.clone().lerp(new THREE.Color("#ffffff"), 0.1);
    const bottom = base.clone().multiplyScalar(0.72);
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, `#${top.getHexString()}`);
    gradient.addColorStop(1, `#${bottom.getHexString()}`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.scene.background?.dispose?.();
    this.scene.background = texture;
    this.gridMaterial.uniforms.lineColor.value.set(lightGrid ? "#5a6fd6" : "#3da5ff");
    this.app.requestRender();
  }

  setGridVisible(on) {
    this.grid.visible = on;
    this.app.requestRender();
  }

  resize(width, height) {
    this.renderer.setSize(width, height, false);
  }
}
