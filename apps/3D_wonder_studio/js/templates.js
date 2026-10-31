// Starter templates and fun parts. All of them are real geometry built from the same shape
// generators as the primitives, so every piece can be sculpted and painted.
import * as THREE from "three";

const WHITE = "#f7f8ff";
const BLACK = "#15131f";

const ball = (name, size, pos, color, extra = {}) => ({ name, shape: "sphere", size, pos, color, ...extra });
const piece = (shape, name, size, pos, rot, color, extra = {}) => ({ name, shape, size, pos, rot, color, ...extra });
const hose = (name, points, radii, color, extra = {}) => ({
  name, shape: "tube", params: { points, radii, flatten: extra.flatten }, color, ...extra,
});

/** Returns a part and its twin on the other side of the X axis. */
function pair(part) {
  const twin = { ...part };
  if (part.pos) twin.pos = [-part.pos[0], part.pos[1], part.pos[2]];
  if (part.rot) twin.rot = [part.rot[0], -part.rot[1], -part.rot[2]];
  if (part.params?.points) {
    twin.params = { ...part.params, points: part.params.points.map(([x, y, z]) => [-x, y, z]) };
  }
  return [part, twin];
}

/** A white eyeball with a pupil and a shine, looking along +Z. */
function eye(x, y, z, r, pupilColor = BLACK) {
  const yaw = Math.atan2(x, z + r * 2);
  const reach = r * 0.74;
  const px = x + Math.sin(yaw) * reach;
  const pz = z + Math.cos(yaw) * reach;
  return [
    ball("Eye", r, [x, y, z], WHITE, { preset: "plastic", detail: 2 }),
    ball("Pupil", r * 0.46, [px, y + r * 0.04, pz], pupilColor, { preset: "plastic", detail: 3 }),
    ball("Eye shine", r * 0.14, [px + r * 0.14, y + r * 0.24, pz + r * 0.34], "#ffffff", { preset: "glow", detail: 4 }),
  ];
}

function smoothProfile(points, steps = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, "centripetal");
  return curve.getPoints(steps).map((p, i) => [i === 0 || i === steps ? 0 : Math.max(0, p.x), p.y]);
}

export const TEMPLATES = {
  ball: {
    label: "Ball of Clay",
    hint: "Start from one soft ball",
    parts: () => [ball("Ball of clay", 1, [0, 0, 0], "#7ed957", { detail: 4 })],
  },

  snowman: {
    label: "Snowman",
    hint: "Three balls and a carrot",
    parts: () => [
      ball("Bottom snowball", 0.86, [0, -0.55, 0], WHITE, { detail: 1.6 }),
      ball("Middle snowball", 0.62, [0, 0.62, 0], WHITE, { detail: 1.6 }),
      ball("Head", 0.45, [0, 1.48, 0], WHITE, { detail: 2.5 }),
      piece("cone", "Carrot nose", [0.08, 0.2, 0.08], [0, 1.5, 0.56], [90, 0, 0], "#ff8a1f", { detail: 2 }),
      ...pair(ball("Coal eye", 0.052, [0.16, 1.62, 0.4], BLACK, { preset: "rubber" })),
      ball("Coal button", 0.064, [0, 0.82, 0.6], BLACK, { preset: "rubber" }),
      ball("Coal button", 0.064, [0, 0.54, 0.62], BLACK, { preset: "rubber" }),
      ball("Coal button", 0.064, [0, 0.26, 0.54], BLACK, { preset: "rubber" }),
      ...[-2, -1, 0, 1, 2].map((i) => ball("Coal smile", 0.03,
        [i * 0.085, 1.33 + Math.abs(i) * 0.024, 0.426 - Math.abs(i) * 0.012], BLACK, { preset: "rubber" })),
      piece("cylinder", "Hat brim", [0.68, 0.03, 0.68], [0, 1.86, 0], [0, 0, 0], BLACK, { preset: "rubber" }),
      piece("cylinder", "Hat top", [0.42, 0.22, 0.42], [0, 2.1, 0], [0, 0, 0], BLACK, { preset: "rubber" }),
      piece("cylinder", "Hat band", [0.43, 0.05, 0.43], [0, 1.96, 0], [0, 0, 0], "#e63757", { preset: "plastic" }),
      piece("torus", "Scarf", [0.37, 0.28, 0.37], [0, 1.1, 0], [0, 0, 0], "#e63757", { params: { tube: 0.3 }, detail: 2 }),
      hose("Scarf end", [[0.2, 1.06, 0.34], [0.27, 0.8, 0.5], [0.3, 0.52, 0.56]], [0.09, 0.085, 0.08], "#e63757", { flatten: 0.5 }),
      ...pair(hose("Stick arm", [[0.55, 0.78, 0], [0.95, 1.02, 0.05], [1.3, 1.34, 0.05]], [0.042, 0.035, 0.022], "#6d4a2b", { preset: "wood" })),
      ...pair(hose("Stick finger", [[1.08, 1.13, 0.05], [1.2, 1.1, 0.1], [1.34, 1.06, 0.1]], [0.026, 0.02, 0.012], "#6d4a2b", { preset: "wood" })),
    ],
  },

  head: {
    label: "Cartoon Head",
    hint: "A friendly face to change",
    parts: () => [
      ball("Head", [1, 1.1, 0.96], [0, 0, 0], "#ffc9a3", { detail: 3 }),
      ...pair(ball("Ear", [0.2, 0.3, 0.13], [1, 0.05, -0.05], "#ffb78f", { rot: [0, 18, -8] })),
      ...pair(ball("Cheek", [0.2, 0.15, 0.08], [0.56, -0.26, 0.72], "#ff9d93")),
      ...eye(0.36, 0.26, 0.74, 0.24),
      ...eye(-0.36, 0.26, 0.74, 0.24),
      ball("Nose", [0.17, 0.15, 0.18], [0, -0.06, 0.96], "#ffa97d", { detail: 2 }),
      hose("Smile", [[-0.42, -0.42, 0.74], [-0.2, -0.6, 0.85], [0, -0.66, 0.88], [0.2, -0.6, 0.85], [0.42, -0.42, 0.74]],
        [0.03, 0.045, 0.05, 0.045, 0.03], "#b3324a", { preset: "rubber" }),
      ...pair(hose("Eyebrow", [[0.18, 0.62, 0.86], [0.36, 0.7, 0.8], [0.56, 0.62, 0.68]], [0.03, 0.05, 0.025], "#5b3a22")),
      ...[-0.62, -0.32, 0, 0.32, 0.62].map((x, i) => hose("Hair tuft",
        [[x * 0.9, 0.86 - Math.abs(x) * 0.24, 0.1], [x * 1.05, 1.22 - Math.abs(x) * 0.22, 0.14], [x * 1.38 + 0.08, 1.42 - Math.abs(x) * 0.28, 0.02]],
        [0.26, 0.17, 0.02], ["#ff7a59", "#ff5d3f"][i % 2])),
    ],
  },

  monster: {
    label: "Monster",
    hint: "One big eye, lots of teeth",
    parts: () => {
      const green = "#7bd832";
      return [
        ball("Body", [1.15, 1.02, 1], [0, 0, 0], green, { detail: 2.6 }),
        ball("Belly spot", [0.2, 0.15, 0.08], [0.72, -0.42, 0.6], "#5fb921", { rot: [0, 40, 0] }),
        ball("Back spot", [0.17, 0.13, 0.08], [-0.82, 0.32, 0.55], "#5fb921", { rot: [0, -50, 0] }),
        ...eye(0, 0.34, 0.66, 0.46, "#2c7fe0"),
        ball("Mouth", [0.62, 0.24, 0.16], [0, -0.42, 0.84], "#541428", { preset: "rubber", detail: 2 }),
        ball("Tongue", [0.26, 0.09, 0.1], [0.05, -0.53, 0.92], "#ff6b8b", { detail: 2 }),
        ...[-0.42, -0.14, 0.14, 0.42].map((x) => piece("cone", "Tooth", [0.075, 0.12, 0.06],
          [x, -0.26 - Math.abs(x) * 0.12, 0.96 - Math.abs(x) * 0.24], [172, 0, 0], WHITE, { preset: "plastic" })),
        ...[[-0.72, 0.72, 16, 22], [-0.3, 0.98, 6, 10], [0.14, 1.03, -2, -4], [0.56, 0.86, 10, -18]].flatMap(([x, y, tilt, roll]) => [
          piece("cone", "Horn", [0.17, 0.27, 0.17], [x, y + 0.08, -0.08], [tilt - 12, 0, roll], "#8d43ef", { preset: "plastic" }),
        ]),
        ...pair(hose("Arm", [[0.95, -0.1, 0.25], [1.38, -0.32, 0.42], [1.62, 0.02, 0.62]], [0.2, 0.15, 0.17], green)),
        ...pair(ball("Hand", [0.24, 0.2, 0.2], [1.64, 0.1, 0.66], green)),
        ...[-0.14, 0.06, 0.24].flatMap((o) => pair(piece("cone", "Claw", [0.05, 0.08, 0.05], [1.72 + o * 0.5, 0.3, 0.66 + o], [0, 0, -12], "#8d43ef"))),
        ...pair(piece("capsule", "Leg", [0.3, 0.26, 0.3], [0.52, -1.02, 0.14], [0, 0, 0], green)),
        ...pair(ball("Foot", [0.34, 0.15, 0.42], [0.54, -1.28, 0.32], green)),
        ...[-0.14, 0, 0.14].flatMap((o) => pair(ball("Toenail", 0.07, [0.54 + o, -1.27, 0.7 - Math.abs(o) * 0.4], WHITE, { preset: "plastic" }))),
      ];
    },
  },

  alien: {
    label: "Alien",
    hint: "Hello from outer space",
    parts: () => {
      const skin = "#59e6c2";
      const taper = (x, y, z) => {
        const k = 0.5 + 0.56 * THREE.MathUtils.smoothstep(y, -1.1, 0.6);
        return [x * k, y, z * k];
      };
      return [
        ball("Big head", [1, 1.12, 0.9], [0, 0.74, 0], skin, { deform: taper, detail: 3 }),
        ...pair(ball("Big eye", [0.27, 0.42, 0.13], [0.42, 0.72, 0.68], BLACK, { rot: [-6, 26, -22], preset: "plastic" })),
        ...pair(ball("Eye shine", [0.06, 0.09, 0.03], [0.34, 0.88, 0.8], "#ffffff", { rot: [-6, 26, -22], preset: "glow" })),
        ...pair(ball("Nose hole", [0.022, 0.03, 0.02], [0.05, 0.28, 0.73], "#2aa58a")),
        hose("Little smile", [[-0.15, 0.03, 0.56], [0, -0.01, 0.61], [0.15, 0.03, 0.56]], [0.012, 0.018, 0.012], "#14795f"),
        piece("capsule", "Neck", [0.15, 0.22, 0.15], [0, -0.42, 0], [0, 0, 0], skin),
        piece("capsule", "Body", [0.46, 0.46, 0.34], [0, -1.02, 0], [0, 0, 0], "#b16dff", { preset: "plastic" }),
        ...pair(hose("Arm", [[0.34, -0.72, 0], [0.68, -0.92, 0.1], [0.76, -1.26, 0.2]], [0.075, 0.06, 0.055], skin)),
        ...pair(ball("Hand", 0.1, [0.78, -1.36, 0.22], skin)),
        ...pair(hose("Leg", [[0.2, -1.4, 0], [0.24, -1.72, 0.02], [0.26, -1.96, 0.04]], [0.11, 0.09, 0.08], skin)),
        ...pair(ball("Foot", [0.15, 0.08, 0.22], [0.27, -2.02, 0.12], "#b16dff", { preset: "plastic" })),
        ...pair(hose("Antenna", [[0.34, 1.68, 0], [0.5, 2.06, 0.05], [0.72, 2.3, 0.06]], [0.035, 0.025, 0.02], skin)),
        ...pair(ball("Antenna light", 0.11, [0.76, 2.36, 0.06], "#ffe14d", { preset: "glow" })),
      ];
    },
  },

  robot: {
    label: "Robot",
    hint: "Beep boop! Shiny and square",
    parts: () => {
      const steel = "#a9bbd0";
      const blue = "#2d8cff";
      const metal = { preset: "metal" };
      return [
        piece("rounded", "Robot head", [0.74, 0.6, 0.66], [0, 1.06, 0], [0, 0, 0], steel, { ...metal, detail: 2 }),
        ...pair(piece("cylinder", "Glowing eye", [0.21, 0.04, 0.21], [0.29, 1.14, 0.57], [90, 0, 0], "#62f6ff", { preset: "glow", detail: 3 })),
        ...[-2, -1, 0, 1, 2].map((i) => piece("rounded", "Mouth slot", [0.045, 0.1, 0.03], [i * 0.11, 0.8, 0.57], [0, 0, 0], "#1a2333", { preset: "rubber" })),
        piece("cylinder", "Antenna", [0.04, 0.2, 0.04], [0, 1.74, 0], [0, 0, 0], steel, metal),
        ball("Antenna light", 0.11, [0, 2.0, 0], "#ff5d8f", { preset: "glow" }),
        ...pair(piece("cylinder", "Ear bolt", [0.12, 0.08, 0.12], [0.68, 1.08, 0], [0, 0, 90], blue, metal)),
        piece("cylinder", "Neck", [0.2, 0.1, 0.2], [0, 0.56, 0], [0, 0, 0], "#5d6c84", metal),
        piece("rounded", "Body", [0.98, 0.84, 0.72], [0, -0.28, 0], [0, 0, 0], blue, { preset: "plastic", detail: 2 }),
        piece("rounded", "Chest panel", [0.56, 0.42, 0.04], [0, -0.16, 0.62], [0, 0, 0], "#e8f1ff", { preset: "plastic" }),
        ...["#ff5d8f", "#ffd23f", "#7dff6b"].map((c, i) => ball("Button", 0.075, [-0.24 + i * 0.24, -0.04, 0.67], c, { preset: "glow" })),
        piece("rounded", "Screen line", [0.42, 0.045, 0.02], [0, -0.3, 0.66], [0, 0, 0], "#1a2333", { preset: "rubber" }),
        ...pair(ball("Shoulder", 0.21, [1.0, 0.2, 0], steel, metal)),
        ...pair(hose("Arm", [[1.04, 0.1, 0], [1.2, -0.3, 0.05], [1.24, -0.72, 0.16]], [0.12, 0.11, 0.1], "#7b8ca6", metal)),
        ...pair(piece("torus", "Claw hand", [0.17, 0.17, 0.17], [1.25, -0.94, 0.2], [90, 0, 0], steel, { ...metal, params: { tube: 0.3 } })),
        ...pair(piece("cylinder", "Leg", [0.25, 0.3, 0.25], [0.42, -1.22, 0], [0, 0, 0], "#7b8ca6", metal)),
        ...pair(piece("rounded", "Foot", [0.4, 0.17, 0.56], [0.44, -1.62, 0.13], [0, 0, 0], steel, metal)),
      ];
    },
  },

  dinosaur: {
    label: "Dinosaur",
    hint: "A little dino with big plates",
    parts: () => {
      const skin = "#3fbf6f";
      const body = [[-2.3, -0.5, 0], [-1.7, -0.16, 0], [-1.05, 0.08, 0], [-0.3, 0.22, 0], [0.4, 0.34, 0], [0.86, 0.78, 0], [1.1, 1.28, 0]];
      const plates = [[-1.32, 0.34, 0.2], [-0.84, 0.56, 0.3], [-0.3, 0.76, 0.36], [0.22, 0.84, 0.32], [0.62, 1.12, 0.22], [0.82, 1.48, 0.16]];
      return [
        hose("Body and tail", body, [0.03, 0.15, 0.36, 0.58, 0.54, 0.3, 0.27], skin, { detail: 2.5 }),
        ball("Head", [0.42, 0.33, 0.33], [1.32, 1.44, 0], skin, { detail: 2.4 }),
        ball("Snout", [0.33, 0.21, 0.26], [1.68, 1.34, 0], "#54d184", { detail: 2 }),
        hose("Mouth line", [[1.35, 1.27, 0.25], [1.72, 1.24, 0.24], [1.96, 1.32, 0]], [0.012, 0.016, 0.01], "#165f34"),
        hose("Mouth line", [[1.35, 1.27, -0.25], [1.72, 1.24, -0.24], [1.96, 1.32, 0]], [0.012, 0.016, 0.01], "#165f34"),
        ...[0.24, -0.24].flatMap((z) => [
          ball("Eye", 0.095, [1.36, 1.58, z], WHITE, { preset: "plastic" }),
          ball("Pupil", 0.05, [1.42, 1.6, z * 1.28], BLACK, { preset: "plastic" }),
          ball("Nostril", 0.02, [1.92, 1.42, z * 0.32], "#165f34"),
        ]),
        ...plates.map(([x, y, s], i) => piece("cone", "Back plate", [s * 0.72, s * 0.8, 0.05],
          [x, y + s * 0.26, 0], [0, 0, -(i - 2.2) * 12], "#ff9d2e", { preset: "plastic" })),
        ...[[-0.5, 1], [-0.5, -1], [0.42, 1], [0.42, -1]].flatMap(([x, side]) => [
          piece("capsule", "Leg", [0.25, 0.32, 0.25], [x, -0.42, side * 0.34], [0, 0, 0], skin),
          ball("Foot", [0.32, 0.12, 0.2], [x + 0.08, -0.82, side * 0.34], "#2fa45b"),
        ]),
        ...[0.34, -0.34].map((z) => hose("Tiny arm", [[0.72, 0.5, z * 0.8], [0.98, 0.3, z], [1.12, 0.36, z]], [0.07, 0.05, 0.04], skin)),
      ];
    },
  },

  animal: {
    label: "Animal Head",
    hint: "A cuddly bear face",
    parts: () => {
      const fur = "#b77a45";
      return [
        ball("Head", [1, 0.94, 0.92], [0, 0, 0], fur, { detail: 3 }),
        ...pair(ball("Ear", [0.36, 0.36, 0.2], [0.76, 0.82, -0.1], fur)),
        ...pair(ball("Inner ear", [0.23, 0.23, 0.1], [0.77, 0.81, 0.04], "#f2b7a5")),
        ball("Muzzle", [0.5, 0.4, 0.38], [0, -0.26, 0.76], "#ecd2ac", { detail: 2 }),
        ball("Nose", [0.18, 0.13, 0.12], [0, -0.05, 1.1], BLACK, { preset: "plastic" }),
        hose("Mouth", [[0, -0.2, 1.11], [0, -0.32, 1.1], [0, -0.4, 1.07]], [0.018, 0.018, 0.016], BLACK),
        hose("Smile", [[-0.28, -0.42, 0.98], [-0.13, -0.5, 1.05], [0, -0.42, 1.08], [0.13, -0.5, 1.05], [0.28, -0.42, 0.98]],
          [0.014, 0.02, 0.02, 0.02, 0.014], BLACK),
        ...eye(0.36, 0.22, 0.74, 0.14),
        ...eye(-0.36, 0.22, 0.74, 0.14),
        ...pair(ball("Eyebrow", [0.13, 0.04, 0.05], [0.37, 0.46, 0.76], "#7c4d26", { rot: [0, 0, 10] })),
      ];
    },
  },

  spaceship: {
    label: "Spaceship",
    hint: "Ready for takeoff",
    parts: () => {
      const hull = smoothProfile([[0, -1.25], [0.52, -1.22], [0.72, -0.5], [0.72, 0.3], [0.5, 1.1], [0.2, 1.72], [0, 2.02]]);
      const finShape = (x, y, z) => [x + Math.max(0, -y) * 0.75, y, z];
      return [
        { name: "Rocket hull", shape: "lathe", params: { profile: hull }, color: "#eef2fb", preset: "plastic", detail: 3 },
        piece("cone", "Nose tip", [0.3, 0.34, 0.3], [0, 1.76, 0], [0, 0, 0], "#ff4d5e", { preset: "plastic" }),
        piece("torus", "Window ring", [0.34, 0.34, 0.2], [0, 0.56, 0.62], [90, 0, 0], "#ff4d5e", { preset: "metal", params: { tube: 0.2 } }),
        ball("Cockpit window", [0.31, 0.31, 0.15], [0, 0.56, 0.62], "#7be3ff", { preset: "glass" }),
        ...eye(0, 0.56, 0.54, 0.13),
        piece("torus", "Hull stripe", [0.75, 0.75, 0.75], [0, -0.42, 0], [0, 0, 0], "#ff4d5e", { preset: "plastic", params: { tube: 0.04 } }),
        ...pair(piece("rounded", "Wing", [0.56, 0.62, 0.075], [1.02, -0.8, 0], [0, 0, 0], "#ff4d5e", { preset: "plastic", deform: finShape, detail: 2 })),
        piece("rounded", "Tail fin", [0.075, 0.5, 0.42], [0, -0.82, 0.86], [0, 0, 0], "#ff4d5e", { preset: "plastic" }),
        piece("cylinder", "Engine", [0.4, 0.14, 0.4], [0, -1.33, 0], [0, 0, 0], "#5d6c84", { preset: "metal" }),
        piece("cone", "Engine flame", [0.32, 0.5, 0.32], [0, -1.88, 0], [180, 0, 0], "#ffb02e", { preset: "glow" }),
        ...pair(ball("Side light", 0.075, [0.66, 0.02, 0.3], "#7dff6b", { preset: "glow" })),
      ];
    },
  },

  creature: {
    label: "Fantasy Creature",
    hint: "A tiny friendly dragon",
    parts: () => {
      const scales = "#a35cff";
      const belly = "#ffd98a";
      const wing = (x, y, z) => {
        const out = Math.abs(x);
        return [x, y + out * out * 0.34 - Math.sin(x * 8) * 0.06 * out, z + out * 0.3];
      };
      return [
        hose("Body and tail", [[-2.1, -0.68, -0.4], [-1.5, -0.86, -0.3], [-0.8, -0.72, -0.16], [-0.2, -0.4, 0], [0.24, 0.12, 0.08], [0.42, 0.8, 0.12]],
          [0.03, 0.12, 0.26, 0.56, 0.47, 0.25], scales, { detail: 2.4 }),
        ball("Tummy", [0.33, 0.5, 0.2], [0.34, -0.3, 0.36], belly, { rot: [12, 18, -22] }),
        piece("cone", "Tail spade", [0.27, 0.34, 0.05], [-2.24, -0.6, -0.42], [0, 0, 62], "#ff5da8", { preset: "plastic" }),
        ball("Head", [0.5, 0.42, 0.44], [0.54, 1.12, 0.2], scales, { detail: 2.6 }),
        ball("Snout", [0.31, 0.2, 0.3], [0.68, 0.96, 0.54], "#bb85ff", { detail: 2 }),
        ...pair(ball("Nostril", 0.025, [0.1, 1.06, 0.8], "#4d2a8a")).map((p) => ({ ...p, pos: [p.pos[0] + 0.68, p.pos[1], p.pos[2]] })),
        ...[[0.38, 1.26, 0.56], [0.86, 1.2, 0.54]].flatMap(([x, y, z]) => [
          ball("Eye", 0.13, [x, y, z], WHITE, { preset: "plastic" }),
          ball("Pupil", 0.07, [x + 0.02, y + 0.01, z + 0.1], "#6a2ad9", { preset: "plastic" }),
          ball("Eye shine", 0.024, [x + 0.05, y + 0.05, z + 0.16], "#ffffff", { preset: "glow" }),
        ]),
        hose("Horn", [[0.3, 1.46, 0.08], [0.2, 1.74, -0.06], [0.1, 1.96, -0.26]], [0.09, 0.055, 0.01], "#ffd23f", { preset: "plastic" }),
        hose("Horn", [[0.8, 1.44, 0.08], [0.9, 1.72, -0.06], [1.02, 1.94, -0.26]], [0.09, 0.055, 0.01], "#ffd23f", { preset: "plastic" }),
        hose("Ear fin", [[0.04, 1.2, 0.08], [-0.2, 1.3, -0.02], [-0.4, 1.46, -0.1]], [0.1, 0.07, 0.01], "#ff5da8", { flatten: 0.35 }),
        hose("Ear fin", [[1.04, 1.18, 0.08], [1.28, 1.28, -0.02], [1.46, 1.44, -0.1]], [0.1, 0.07, 0.01], "#ff5da8", { flatten: 0.35 }),
        ball("Left wing", [0.86, 0.52, 0.04], [-0.76, 0.42, -0.42], "#ff5da8", { deform: wing, rot: [0, 18, 8], detail: 2 }),
        ball("Right wing", [0.86, 0.52, 0.04], [1.26, 0.42, -0.42], "#ff5da8", { deform: wing, rot: [0, -18, -8], detail: 2 }),
        ...[[-0.62, -1], [0.34, -1], [-0.14, 1], [0.66, 1]].flatMap(([x, side]) => [
          piece("capsule", "Leg", [0.2, 0.25, 0.2], [x, -0.96, side * 0.26], [0, 0, 0], scales),
          ball("Foot", [0.24, 0.1, 0.27], [x + 0.03, -1.3, side * 0.26 + 0.08], belly),
        ]),
        ...[-0.9, -0.3, 0].map((x, i) => piece("cone", "Back spike", [0.1, 0.14, 0.1],
          [x * 1.4, -0.42 + i * 0.32, -0.34], [-14, 0, 18], "#ffd23f", { preset: "plastic" })),
      ];
    },
  },
};

// Fun parts are placed on a surface. Their +Y axis points out of the surface.
export const FUN_PARTS = {
  eye: {
    label: "Googly Eye",
    parts: () => [
      ball("Googly eye", 0.2, [0, 0.1, 0], WHITE, { preset: "plastic", detail: 3 }),
      ball("Pupil", 0.095, [0.02, 0.27, 0.03], BLACK, { preset: "plastic", detail: 4 }),
    ],
  },
  horn: {
    label: "Horn",
    parts: () => [hose("Horn", [[0, -0.04, 0], [0, 0.2, 0.03], [0, 0.42, 0.12]], [0.11, 0.07, 0.008], "#a24bff", { preset: "plastic", detail: 3 })],
  },
  ear: {
    label: "Round Ear",
    parts: () => [
      ball("Ear", [0.16, 0.26, 0.08], [0, 0.16, 0], "#ffa8c5", { detail: 3 }),
      ball("Inner ear", [0.1, 0.17, 0.05], [0, 0.17, 0.05], "#ff6f9f", { detail: 3 }),
    ],
  },
  nose: {
    label: "Silly Nose",
    parts: () => [ball("Nose", [0.14, 0.12, 0.14], [0, 0.07, 0], "#ff5d6c", { preset: "plastic", detail: 4 })],
  },
  tooth: {
    label: "Tooth",
    parts: () => [piece("cone", "Tooth", [0.075, 0.12, 0.05], [0, 0.08, 0], [0, 0, 0], WHITE, { preset: "plastic", detail: 4 })],
  },
  spike: {
    label: "Spike",
    parts: () => [piece("cone", "Spike", [0.09, 0.18, 0.09], [0, 0.11, 0], [0, 0, 0], "#ff9d2e", { preset: "plastic", detail: 4 })],
  },
  antenna: {
    label: "Antenna",
    parts: () => [
      hose("Antenna", [[0, -0.03, 0], [0.03, 0.2, 0], [0.09, 0.42, 0.02]], [0.024, 0.018, 0.014], "#59e6c2", { detail: 3 }),
      ball("Antenna ball", 0.075, [0.1, 0.46, 0.02], "#ffe14d", { preset: "glow", detail: 4 }),
    ],
  },
  smile: {
    label: "Big Smile",
    parts: () => [hose("Smile", [[-0.26, 0.02, -0.08], [-0.14, 0.03, 0.05], [0, 0.03, 0.1], [0.14, 0.03, 0.05], [0.26, 0.02, -0.08]],
      [0.016, 0.034, 0.042, 0.034, 0.016], "#541428", { detail: 4 })],
  },
};
