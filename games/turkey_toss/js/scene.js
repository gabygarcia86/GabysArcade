import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TABLE, PLATES, SERVING, PLATE, FLYING_TURKEY } from './config.js';

// Camera framing. The camera sits high behind the serving platter so the back plate and the
// gravy bowl stay visible over the giant turkey.
const CAMERA_POSITION = new THREE.Vector3(0, 8.3, 9.2);
const CAMERA_TARGET = new THREE.Vector3(0, 0, -2.1);
const BASE_VERTICAL_FOV = 50;
const MAX_VERTICAL_FOV = 82;
// World points that must stay on screen whatever the window's shape.
const MUST_SEE = [
  new THREE.Vector3(3.5, 0, PLATES[0].z + PLATE.radius),
  new THREE.Vector3(-3.5, 0, PLATES[0].z + PLATE.radius),
  new THREE.Vector3(3.5, 0, PLATES[6].z),
  new THREE.Vector3(-3.5, 0, PLATES[6].z),
  new THREE.Vector3(0, 0, PLATES[8].z - PLATE.radius),
  new THREE.Vector3(0, 0, SERVING.z + 1.1),
];

export const IS_COARSE_POINTER = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(pointer: coarse)').matches;

// Throws if WebGL is unavailable so main.js can show a friendly message.
export function createRenderer(container) {
  const probe = document.createElement('canvas');
  const hasWebGL = !!(window.WebGLRenderingContext
    && (probe.getContext('webgl2') || probe.getContext('webgl')));
  if (!hasWebGL) {
    throw new Error('WebGL is not available in this browser.');
  }

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

function canvasTexture(canvas, repeatX = 1, repeatY = 1) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeatX !== 1 || repeatY !== 1) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
  }
  return texture;
}

function createWoodTexture(base, dark, planks) {
  const size = 1024;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const plank = size / planks;
  for (let i = 0; i < planks; i++) {
    const shade = Math.random() * 0.14;
    ctx.fillStyle = `rgba(40, 18, 6, ${shade})`;
    ctx.fillRect(i * plank, 0, plank, size);
    for (let g = 0; g < 26; g++) {
      const x = i * plank + Math.random() * plank;
      ctx.strokeStyle = dark;
      ctx.globalAlpha = 0.08 + Math.random() * 0.18;
      ctx.lineWidth = 1 + Math.random() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 10, size * 0.35, x - 12, size * 0.65, x + 4, size);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(30, 12, 4, 0.55)';
    ctx.fillRect(i * plank, 0, 3, size);
  }
  return canvas;
}

function createRunnerTexture() {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#c4531f';
  ctx.fillRect(0, 0, size, size);
  // Harvest plaid.
  const stripes = [
    ['rgba(122, 33, 24, 0.55)', 64, 72],
    ['rgba(245, 190, 88, 0.45)', 14, 256],
    ['rgba(70, 28, 12, 0.34)', 18, 136],
  ];
  for (const [color, width, gap] of stripes) {
    ctx.fillStyle = color;
    for (let p = 0; p < size; p += gap) {
      ctx.fillRect(p, 0, width, size);
      ctx.fillRect(0, p, size, width);
    }
  }
  return canvasTexture(canvas, 2, 9);
}

function createWallTexture() {
  const width = 2048;
  const height = 900;
  const { canvas, ctx } = makeCanvas(width, height);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#7a3a1b');
  gradient.addColorStop(1, '#a9592a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Soft wallpaper stripes.
  for (let x = 0; x < width; x += 80) {
    ctx.fillStyle = 'rgba(255, 214, 150, 0.05)';
    ctx.fillRect(x, 0, 40, height);
  }

  // Two windows looking out on autumn trees at sunset.
  for (const win of [{ x: 240, y: 190, w: 480, h: 470 }, { x: 1330, y: 190, w: 480, h: 470 }]) {
    const sky = ctx.createLinearGradient(0, win.y, 0, win.y + win.h);
    sky.addColorStop(0, '#f6a54c');
    sky.addColorStop(0.7, '#ffd98a');
    sky.addColorStop(1, '#ffe9b8');
    ctx.fillStyle = sky;
    ctx.fillRect(win.x, win.y, win.w, win.h);
    const colors = ['#d9531e', '#e8891f', '#c23a1c', '#efb52d'];
    ctx.save();
    ctx.beginPath();
    ctx.rect(win.x, win.y, win.w, win.h);
    ctx.clip();
    ctx.fillStyle = '#8c5a2a';
    ctx.fillRect(win.x, win.y + win.h - 62, win.w, 62);
    for (let i = 0; i < 7; i++) {
      const cx = win.x + 30 + i * (win.w / 6.5);
      const cy = win.y + win.h - 150 - Math.random() * 60;
      ctx.fillStyle = '#5a3418';
      ctx.fillRect(cx - 7, cy, 14, 140);
      for (let b = 0; b < 16; b++) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.beginPath();
        ctx.arc(cx + (Math.random() - 0.5) * 100, cy + (Math.random() - 0.5) * 90, 20 + Math.random() * 24, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = '#f3e4c8';
    ctx.lineWidth = 20;
    ctx.strokeRect(win.x, win.y, win.w, win.h);
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(win.x + win.w / 2, win.y);
    ctx.lineTo(win.x + win.w / 2, win.y + win.h);
    ctx.moveTo(win.x, win.y + win.h / 2);
    ctx.lineTo(win.x + win.w, win.y + win.h / 2);
    ctx.stroke();
  }

  // "Happy Thanksgiving" bunting across the top of the wall.
  const letters = 'HAPPY THANKSGIVING';
  const flagWidth = 96;
  const startX = (width - letters.length * flagWidth) / 2;
  ctx.strokeStyle = 'rgba(255, 233, 184, 0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(startX - 40, 40);
  ctx.quadraticCurveTo(width / 2, 130, startX + letters.length * flagWidth + 40, 40);
  ctx.stroke();
  ctx.font = '700 50px Fredoka, "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const flags = ['#b3261e', '#e8891f', '#f2c14e'];
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] === ' ') continue;
    const t = (i + 0.5) / letters.length;
    const x = startX + i * flagWidth + flagWidth / 2;
    const sag = 40 + 4 * t * (1 - t) * 45;
    ctx.fillStyle = flags[i % flags.length];
    ctx.beginPath();
    ctx.moveTo(x - flagWidth / 2 + 4, sag);
    ctx.lineTo(x + flagWidth / 2 - 4, sag);
    ctx.lineTo(x, sag + 112);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = i % flags.length === 2 ? '#6a2c12' : '#fff5e1';
    ctx.fillText(letters[i], x, sag + 40);
  }
  return canvasTexture(canvas);
}

function createLeafGeometry() {
  // Five soft lobes, longest at the tip, built flat and laid on the table.
  const shape = new THREE.Shape();
  const points = 60;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const lobes = Math.abs(Math.cos(angle * 2.5));
    const r = (0.42 + 0.58 * lobes ** 1.6) * (0.74 + 0.26 * Math.cos(angle));
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

// Rug under the table, with a border that frames it against the floorboards.
function createRugTexture() {
  const { canvas, ctx } = makeCanvas(512, 512);
  ctx.fillStyle = '#7a2a18';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#e8a33d';
  ctx.lineWidth = 12;
  ctx.strokeRect(22, 22, 468, 468);
  ctx.lineWidth = 4;
  ctx.strokeRect(46, 46, 420, 420);
  return canvasTexture(canvas);
}

function createPumpkin(color, radius) {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(1, 40, 24);
  // Ribs: push the surface in and out around the Y axis.
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const angle = Math.atan2(vertex.z, vertex.x);
    const rib = 1 + 0.07 * Math.abs(Math.cos(angle * 5));
    position.setXYZ(i, vertex.x * rib, vertex.y * 0.8 * (1 - 0.12 * vertex.y * vertex.y), vertex.z * rib);
  }
  geometry.computeVertexNormals();
  const body = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
  body.scale.setScalar(radius);
  body.position.y = radius * 0.76;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.09, radius * 0.16, radius * 0.42, 8),
    new THREE.MeshStandardMaterial({ color: 0x5f7a2a, roughness: 0.7 }),
  );
  stem.position.y = radius * 1.56;
  stem.rotation.z = 0.2;
  stem.castShadow = true;
  group.add(stem);
  return group;
}

// A horn of plenty: a curled wicker tube with fruit spilling out of its mouth.
function createCornucopia() {
  const group = new THREE.Group();
  class HornCurve extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const a = t * 1.9;
      return target.set(Math.cos(a) * (0.22 + 1.1 * t) - 0.3, 0.52 + 0.46 * Math.sin(t * 2.6) * (1 - t), Math.sin(a) * 0.5 * t);
    }
  }
  const curve = new HornCurve();
  const segments = 60;
  const sides = 18;
  const geometry = new THREE.TubeGeometry(curve, segments, 1, sides, false);
  // Taper the tube from a point to a wide mouth.
  const position = geometry.attributes.position;
  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  for (let ring = 0; ring <= segments; ring++) {
    const t = ring / segments;
    curve.getPoint(t, center);
    const radius = 0.03 + 0.52 * t ** 1.5;
    for (let side = 0; side <= sides; side++) {
      const i = ring * (sides + 1) + side;
      vertex.fromBufferAttribute(position, i).sub(center).multiplyScalar(radius).add(center);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
  }
  geometry.computeVertexNormals();
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#c98a3a';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(90, 48, 14, 0.75)';
  ctx.lineWidth = 7;
  for (let i = -256; i < 512; i += 34) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.moveTo(i + 256, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
  }
  const horn = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: canvasTexture(canvas, 7, 2), roughness: 0.7, side: THREE.DoubleSide,
  }));
  horn.castShadow = true;
  group.add(horn);

  const mouth = curve.getPoint(1);
  const fruit = [
    [0xd9301e, 0.2, 0.05, 0.1, 0.2],
    [0xf2a01e, 0.2, -0.2, 0.12, -0.1],
    [0x7a2f8c, 0.14, 0.3, -0.14, 0.26],
    [0xe7c12b, 0.17, -0.02, -0.22, 0.32],
    [0x6c9a36, 0.13, 0.3, 0.18, -0.2],
  ];
  for (const [color, radius, x, y, z] of fruit) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 18, 14),
      new THREE.MeshStandardMaterial({ color, roughness: 0.35 }),
    );
    mesh.position.set(mouth.x + x, mouth.y + y, mouth.z + z);
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

export class GameScene {
  constructor(renderer, container) {
    this.renderer = renderer;
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x4a2412);

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(BASE_VERTICAL_FOV, 1, 0.1, 80);
    this.viewportWidth = 1;
    this.viewportHeight = 1;
    this.onResize = null;
    // Sphere colliders for the decorations, read by Game when it builds the physics world.
    this.decorColliders = [];

    this._buildLights();
    this._buildRoom();
    this._buildDecorations();
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(container);
    }
    window.addEventListener('resize', () => this.resize());
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xffe6c0, 0x5a2e16, 0.6));

    const key = new THREE.DirectionalLight(0xfff0d6, 2.1);
    key.position.set(-4.5, 13, 5);
    key.target.position.set(0, 0, -2);
    key.castShadow = true;
    const shadowSize = IS_COARSE_POINTER ? 1024 : 2048;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 11;
    key.shadow.camera.bottom = -11;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 34;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    this.scene.add(key, key.target);

    // Warm sunset glow from the windows.
    const fill = new THREE.DirectionalLight(0xffa35c, 0.8);
    fill.position.set(3, 4, -11);
    this.scene.add(fill);
  }

  _buildRoom() {
    const { halfWidth, frontZ, backZ } = TABLE;
    const length = frontZ - backZ;
    const centerZ = (frontZ + backZ) / 2;

    const floorTexture = canvasTexture(createWoodTexture('#6b3a1e', '#2c1408', 8), 3, 4);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.7 }),
    );
    floor.position.set(0, -3.2, -2);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(64, 15.8),
      new THREE.MeshStandardMaterial({ map: createWallTexture(), roughness: 0.85 }),
    );
    wall.position.set(0, 4.6, -14.5);
    this.scene.add(wall);

    const topTexture = canvasTexture(createWoodTexture('#a0622c', '#3f1d09', 7), 1, 2);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(halfWidth * 2, 0.26, length),
      [
        new THREE.MeshStandardMaterial({ color: 0x7a4620, roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: 0x7a4620, roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.42 }),
        new THREE.MeshStandardMaterial({ color: 0x5a3216, roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: 0x7a4620, roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: 0x7a4620, roughness: 0.6 }),
      ],
    );
    top.position.set(0, -0.13, centerZ);
    top.receiveShadow = true;
    top.castShadow = true;
    this.scene.add(top);

    const legGeometry = new THREE.CylinderGeometry(0.2, 0.13, 3, 14);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x6a3a1a, roughness: 0.6 });
    for (const x of [-1, 1]) {
      for (const z of [frontZ - 0.7, backZ + 0.7]) {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(x * (halfWidth - 0.5), -1.7, z);
        leg.castShadow = true;
        this.scene.add(leg);
      }
    }

    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 25).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: createRugTexture(), roughness: 0.95 }),
    );
    rug.position.set(0, -3.19, centerZ);
    rug.receiveShadow = true;
    this.scene.add(rug);

    this._buildChairs();

    // Plaid runner down the middle of the table.
    const runner = new THREE.Mesh(
      new THREE.PlaneGeometry(2.7, length - 0.5).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: createRunnerTexture(), roughness: 0.9 }),
    );
    runner.position.set(0, 0.004, centerZ);
    runner.receiveShadow = true;
    this.scene.add(runner);
  }

  // Three chairs along each long side, as two instanced meshes.
  _buildChairs() {
    const material = new THREE.MeshStandardMaterial({ color: 0x6a3a1a, roughness: 0.55 });
    const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.16, 1.6), material, 6);
    const backs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 2.3, 1.6), material, 6);
    const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1.75, 0.14), material, 24);
    const matrix = new THREE.Matrix4();
    let index = 0;
    for (const side of [-1, 1]) {
      for (const z of [2.2, -2.1, -6.4]) {
        const x = side * 5.1;
        seats.setMatrixAt(index, matrix.makeTranslation(x, -1.4, z));
        backs.setMatrixAt(index, matrix.makeTranslation(x + side * 0.72, -0.3, z));
        let corner = 0;
        for (const lx of [-0.66, 0.66]) {
          for (const lz of [-0.72, 0.72]) {
            legs.setMatrixAt(index * 4 + corner, matrix.makeTranslation(x + lx, -2.32, z + lz));
            corner += 1;
          }
        }
        index += 1;
      }
    }
    for (const mesh of [seats, backs, legs]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  _buildDecorations() {
    const pumpkins = [
      [0xe8761e, 0.42, -3.28, 3.9],
      [0xf09a2c, 0.3, -2.62, 4.45],
      [0xe8761e, 0.46, 3.22, -8.25],
      [0xf2c25a, 0.3, 2.45, -8.75],
      [0xd9651a, 0.32, 3.38, 3.7],
    ];
    for (const [color, radius, x, z] of pumpkins) {
      const pumpkin = createPumpkin(color, radius);
      pumpkin.position.set(x, 0, z);
      pumpkin.rotation.y = x * 2;
      this.scene.add(pumpkin);
      this.decorColliders.push([x, radius * 0.76, z, radius * 0.85]);
    }

    const cornucopia = createCornucopia();
    cornucopia.position.set(-2.55, 0, -8.5);
    cornucopia.rotation.y = 0.25;
    cornucopia.scale.setScalar(1.15);
    this.scene.add(cornucopia);
    this.decorColliders.push([-2.75, 0.5, -8.5, 0.55]);

    // Fallen leaves, one draw call for all of them.
    const leafColors = [0xd9531e, 0xe8891f, 0xc23a1c, 0xefb52d, 0xa8481c];
    const leaves = new THREE.InstancedMesh(
      createLeafGeometry(),
      new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }),
      30,
    );
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    for (let i = 0; i < leaves.count; i++) {
      // The outer strip of the table, clear of every plate.
      const side = i % 2 === 0 ? 1 : -1;
      position.set(
        side * (i % 3 === 0 ? 1.5 : 3.55) + (Math.random() - 0.5) * 0.3,
        0.012 + (i % 5) * 0.001,
        i % 3 === 0 ? 2.2 + Math.random() * 2.6 : TABLE.backZ + 0.4 + Math.random() * (TABLE.frontZ - TABLE.backZ - 0.8),
      );
      euler.set((Math.random() - 0.5) * 0.12, Math.random() * 6.28, (Math.random() - 0.5) * 0.12);
      rotation.setFromEuler(euler);
      scale.setScalar(0.13 + Math.random() * 0.12);
      matrix.compose(position, rotation, scale);
      leaves.setMatrixAt(i, matrix);
      leaves.setColorAt(i, color.setHex(leafColors[i % leafColors.length]));
    }
    leaves.receiveShadow = true;
    this.scene.add(leaves);
  }

  /** Half the visible width at the flying turkey's depth, so it starts just off screen. */
  flyingTurkeySpan() {
    const distance = this.camera.position.distanceTo(_flightPoint.set(0, FLYING_TURKEY.height, FLYING_TURKEY.z));
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * distance;
    return halfHeight * this.camera.aspect + 1.8;
  }

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, IS_COARSE_POINTER ? 1.75 : 2);
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);

    this.camera.aspect = width / height;
    this.camera.position.copy(CAMERA_POSITION);
    this.camera.lookAt(CAMERA_TARGET);
    this.camera.updateMatrixWorld();

    // Widen the field of view just enough to fit the table, then pull back if that isn't
    // enough, which only happens on very narrow portrait screens.
    let tangent = Math.tan(THREE.MathUtils.degToRad(BASE_VERTICAL_FOV / 2));
    for (const point of MUST_SEE) {
      _local.copy(point).applyMatrix4(this.camera.matrixWorldInverse);
      const depth = -_local.z;
      tangent = Math.max(tangent, Math.abs(_local.y) / depth, Math.abs(_local.x) / depth / this.camera.aspect);
    }
    const maxTangent = Math.tan(THREE.MathUtils.degToRad(MAX_VERTICAL_FOV / 2));
    if (tangent > maxTangent) {
      const back = _offset.copy(CAMERA_POSITION).sub(CAMERA_TARGET).multiplyScalar(tangent / maxTangent - 1);
      this.camera.position.add(back);
      tangent = maxTangent;
    }
    this.camera.fov = THREE.MathUtils.radToDeg(Math.atan(tangent)) * 2 * 1.03;
    this.camera.updateProjectionMatrix();
    if (this.onResize) this.onResize(width, height, pixelRatio);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

const _local = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _flightPoint = new THREE.Vector3();
