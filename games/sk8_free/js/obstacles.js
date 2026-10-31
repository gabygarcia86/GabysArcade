/*
 * Everything that sits in or wanders through the world. KINDS describes each
 * thing once: hitbox, how high it is (a jump must beat this), what it does and
 * how to draw it. Entities come from a pool and go back when they leave the view.
 *
 * Hitboxes: `r` for circles, `w` and `h` for rectangles.
 * height: 0 means no collision. Above the top jump height means steer around it.
 */
import { CONFIG } from "./config.js";

const OUTLINE = "#20202a";

const rect = (ctx, color, x, y, w, h) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

const shadow = (ctx, x, y, w, h) => rect(ctx, "rgba(0,0,0,0.22)", x - w / 2, y - h / 2, w, h);

const CAR_COLORS = ["#d8382f", "#2f6fd8", "#e8c33c", "#3fae5a", "#e8e8ec", "#8a4fd0"];
const SHIRT_COLORS = ["#e8603c", "#3cb4e8", "#e83c9a", "#7ac943", "#f2c84b", "#9a6fe0"];
const HOUSE_COLORS = ["#e7c9a0", "#a8d0e6", "#f0a6a0", "#c8e6a8", "#f4e3a1"];
const SKIN_COLORS = ["#eab893", "#c98a5e", "#8d5a3a"];

/* ---------- Drawing ---------- */

function drawTree(ctx, x, y) {
  shadow(ctx, x, y + 2, 26, 8);
  rect(ctx, "#6b4423", x - 3, y - 16, 6, 18);
  rect(ctx, OUTLINE, x - 15, y - 42, 30, 27);
  rect(ctx, OUTLINE, x - 11, y - 47, 22, 36);
  rect(ctx, "#2f9e44", x - 14, y - 41, 28, 25);
  rect(ctx, "#2f9e44", x - 10, y - 46, 20, 34);
  rect(ctx, "#51c267", x - 10, y - 42, 11, 9);
  rect(ctx, "#51c267", x + 3, y - 32, 7, 6);
  rect(ctx, "#1f7a33", x - 6, y - 22, 16, 5);
}

function drawBush(ctx, x, y) {
  shadow(ctx, x, y + 3, 26, 7);
  rect(ctx, OUTLINE, x - 13, y - 11, 26, 15);
  rect(ctx, "#2f9e44", x - 12, y - 10, 24, 13);
  rect(ctx, "#51c267", x - 9, y - 9, 8, 5);
  rect(ctx, "#51c267", x + 3, y - 7, 6, 4);
  rect(ctx, "#e83c5a", x - 6, y - 3, 2, 2);
  rect(ctx, "#e83c5a", x + 6, y - 2, 2, 2);
}

function drawBench(ctx, x, y) {
  shadow(ctx, x, y + 6, 40, 6);
  rect(ctx, OUTLINE, x - 19, y - 12, 38, 19);
  rect(ctx, "#a8672e", x - 18, y - 11, 36, 4);
  rect(ctx, "#a8672e", x - 18, y - 6, 36, 3);
  rect(ctx, "#c98843", x - 18, y - 1, 36, 3);
  rect(ctx, "#c98843", x - 18, y + 3, 36, 3);
  rect(ctx, "#3a3a44", x - 16, y + 6, 3, 4);
  rect(ctx, "#3a3a44", x + 13, y + 6, 3, 4);
}

function drawTrash(ctx, x, y) {
  shadow(ctx, x, y + 3, 18, 6);
  rect(ctx, OUTLINE, x - 8, y - 15, 16, 19);
  rect(ctx, "#7c8691", x - 7, y - 11, 14, 14);
  rect(ctx, "#5c6570", x - 3, y - 11, 2, 14);
  rect(ctx, "#5c6570", x + 2, y - 11, 2, 14);
  rect(ctx, "#a4aeb8", x - 9, y - 15, 18, 4);
  rect(ctx, "#a4aeb8", x - 2, y - 18, 4, 3);
}

function drawHydrant(ctx, x, y) {
  shadow(ctx, x, y + 2, 14, 5);
  rect(ctx, OUTLINE, x - 5, y - 14, 10, 17);
  rect(ctx, "#d8282f", x - 4, y - 13, 8, 15);
  rect(ctx, OUTLINE, x - 8, y - 8, 16, 5);
  rect(ctx, "#ee5a5a", x - 7, y - 7, 14, 3);
  rect(ctx, "#ffd23c", x - 2, y - 16, 4, 3);
}

function drawLamp(ctx, x, y) {
  shadow(ctx, x + 3, y + 1, 10, 4);
  rect(ctx, OUTLINE, x - 2, y - 50, 4, 52);
  rect(ctx, "#5a6470", x - 1, y - 50, 2, 51);
  rect(ctx, OUTLINE, x - 5, y + 0, 10, 3);
  rect(ctx, OUTLINE, x - 3, y - 54, 16, 6);
  rect(ctx, "#ffe89a", x + 2, y - 53, 10, 4);
}

function drawCar(ctx, x, y, e) {
  const color = CAR_COLORS[e.variant % CAR_COLORS.length];
  shadow(ctx, x + 2, y + 3, 40, 68);
  rect(ctx, OUTLINE, x - 19, y - 32, 38, 65);
  rect(ctx, color, x - 18, y - 31, 36, 63);
  // Hood, roof and trunk stripes.
  rect(ctx, "rgba(255,255,255,0.28)", x - 15, y - 29, 8, 58);
  rect(ctx, "#27384d", x - 15, y - 15, 30, 9);
  rect(ctx, "#27384d", x - 15, y + 12, 30, 8);
  rect(ctx, "#27384d", x - 16, y - 6, 3, 18);
  rect(ctx, "#27384d", x + 13, y - 6, 3, 18);
  rect(ctx, "#ffe89a", x - 15, y - 31, 6, 2);
  rect(ctx, "#ffe89a", x + 9, y - 31, 6, 2);
  rect(ctx, "#e03030", x - 15, y + 30, 6, 2);
  rect(ctx, "#e03030", x + 9, y + 30, 6, 2);
  rect(ctx, OUTLINE, x - 21, y - 22, 2, 10);
  rect(ctx, OUTLINE, x + 19, y - 22, 2, 10);
  rect(ctx, OUTLINE, x - 21, y + 13, 2, 10);
  rect(ctx, OUTLINE, x + 19, y + 13, 2, 10);
}

function drawPuddle(ctx, x, y) {
  rect(ctx, "#3f77ad", x - 17, y - 7, 34, 14);
  rect(ctx, "#3f77ad", x - 23, y - 3, 46, 7);
  rect(ctx, "#5f9fd6", x - 15, y - 6, 30, 11);
  rect(ctx, "#5f9fd6", x - 21, y - 2, 42, 5);
  rect(ctx, "#b9dcf5", x - 8, y - 4, 10, 2);
  rect(ctx, "#b9dcf5", x + 7, y + 1, 7, 1);
}

function drawCrack(ctx, x, y) {
  const c = "#2a2a30";
  rect(ctx, c, x - 26, y - 1, 9, 2);
  rect(ctx, c, x - 18, y - 3, 8, 3);
  rect(ctx, c, x - 11, y - 1, 10, 3);
  rect(ctx, c, x - 2, y + 1, 9, 3);
  rect(ctx, c, x + 6, y - 2, 8, 3);
  rect(ctx, c, x + 13, y - 4, 13, 2);
  rect(ctx, c, x - 6, y + 2, 2, 5);
  rect(ctx, c, x + 8, y - 6, 2, 5);
  rect(ctx, "rgba(255,255,255,0.22)", x - 26, y + 1, 18, 1);
}

function drawRamp(ctx, x, y) {
  // A wedge: flat on the ground nearest you, and rising to the lip at the far
  // end. Each slat is narrower and lighter, so it reads as a slope.
  const slats = ["#a8652c", "#b5733a", "#c28347", "#cf9355", "#dca466", "#e8b679", "#f2c98e"];
  shadow(ctx, x, y + 4, 62, 38);
  rect(ctx, OUTLINE, x - 30, y + 12, 60, 8);
  slats.forEach((color, i) => {
    const half = 29 - i;
    const top = y + 12 - i * 5;
    rect(ctx, OUTLINE, x - half - 1, top, half * 2 + 2, 5);
    rect(ctx, color, x - half, top, half * 2, 5);
  });
  rect(ctx, OUTLINE, x - 24, y - 22, 48, 3);
  rect(ctx, "#ffe2a8", x - 22, y - 21, 44, 2);
  // Chevrons point the way up.
  for (let row = 0; row < 2; row++) {
    const tipY = y - 10 + row * 13;
    for (let step = 0; step < 6; step++) {
      rect(ctx, "#ffd23c", x - step * 2 - 2, tipY + step, 4, 2);
      rect(ctx, "#ffd23c", x + step * 2 - 2, tipY + step, 4, 2);
    }
  }
}

function drawCart(ctx, x, y, e) {
  const wobble = Math.floor(e.anim * 2) % 2;
  shadow(ctx, x, y + 4, 26, 6);
  rect(ctx, "#88909a", x - 13, y - 19, 26, 2);
  rect(ctx, "#88909a", x - 13, y - 8, 26, 2);
  for (let i = -12; i <= 12; i += 4) rect(ctx, "#88909a", x + i, y - 19, 1, 13);
  rect(ctx, OUTLINE, x - 13, y - 6, 26, 2);
  const handle = e.vx > 0 ? -18 : 13;
  rect(ctx, "#e03030", x + handle, y - 22, 5, 2);
  rect(ctx, "#88909a", x + handle + 2, y - 20, 1, 7);
  rect(ctx, OUTLINE, x - 11, y + wobble, 4, 4);
  rect(ctx, OUTLINE, x + 7, y + 1 - wobble, 4, 4);
  rect(ctx, "#f2c84b", x - 6, y - 15, 6, 6);
  rect(ctx, "#3cb4e8", x + 2, y - 13, 5, 4);
}

function drawPerson(ctx, x, y, e, jogger) {
  const shirt = SHIRT_COLORS[e.variant % SHIRT_COLORS.length];
  const skin = SKIN_COLORS[e.variant % SKIN_COLORS.length];
  const step = Math.floor(e.anim) % 2 === 0 ? 2 : -2;
  const facing = e.vx >= 0 ? 1 : -1;
  shadow(ctx, x, y + 1, 14, 4);
  // Side-on, walking across your path.
  rect(ctx, jogger ? skin : "#3c4660", x - 3 + step, y - 8, 3, 8);
  rect(ctx, jogger ? skin : "#3c4660", x + 1 - step, y - 8, 3, 8);
  if (jogger) {
    rect(ctx, "#1f2d4d", x - 4, y - 10, 9, 4);
    rect(ctx, "#ffffff", x - 3 + step, y - 1, 4, 2);
    rect(ctx, "#ffffff", x + 1 - step, y - 1, 4, 2);
  } else {
    rect(ctx, OUTLINE, x - 3 + step, y - 1, 4, 2);
    rect(ctx, OUTLINE, x + 1 - step, y - 1, 4, 2);
  }
  rect(ctx, OUTLINE, x - 5, y - 20, 11, 11);
  rect(ctx, shirt, x - 4, y - 19, 9, 10);
  rect(ctx, skin, x - 1 + step * facing, y - 16, 3, 7);
  rect(ctx, OUTLINE, x - 4, y - 28, 9, 9);
  rect(ctx, skin, x - 3, y - 27, 7, 7);
  rect(ctx, e.variant % 2 ? "#4a2e1a" : "#d0b050", x - 3, y - 28, 7, 3);
  rect(ctx, OUTLINE, x + facing, y - 25, 1, 2);
  if (jogger) rect(ctx, "#e83030", x - 4, y - 26, 9, 1);
}

function drawDog(ctx, x, y, e) {
  const facing = e.vx >= 0 ? 1 : -1;
  const step = Math.floor(e.anim * 1.5) % 2;
  const brown = e.variant % 2 ? "#a86a35" : "#e8d6b8";
  shadow(ctx, x, y + 1, 18, 4);
  rect(ctx, OUTLINE, x - 9, y - 9, 18, 7);
  rect(ctx, brown, x - 8, y - 8, 16, 5);
  rect(ctx, "#6b3f1c", x - 3, y - 8, 5, 3);
  rect(ctx, OUTLINE, x - 7 + step, y - 3, 2, 4);
  rect(ctx, OUTLINE, x - 3 - step, y - 3, 2, 4);
  rect(ctx, OUTLINE, x + 2 + step, y - 3, 2, 4);
  rect(ctx, OUTLINE, x + 6 - step, y - 3, 2, 4);
  const headX = x + facing * 8;
  rect(ctx, OUTLINE, headX - 4, y - 14, 9, 8);
  rect(ctx, brown, headX - 3, y - 13, 7, 6);
  rect(ctx, "#6b3f1c", headX - facing, y - 16, 3, 4);
  rect(ctx, OUTLINE, headX + facing * 2, y - 11, 1, 1);
  rect(ctx, OUTLINE, headX + facing * 4, y - 9, 1, 1);
  const tail = step ? -11 : -13;
  rect(ctx, brown, x - facing * 11 - 1, y + tail, 2, 5);
}

function drawPigeon(ctx, x, y, e) {
  if (e.flying) {
    const lift = Math.round(e.z);
    const wings = Math.floor(e.anim * 4) % 2 ? -3 : 1;
    rect(ctx, "rgba(0,0,0,0.15)", x - 3, y, 6, 2);
    rect(ctx, "#7d8796", x - 2, y - 6 - lift, 5, 5);
    rect(ctx, "#4a5668", x - 7, y - 6 - lift + wings, 5, 2);
    rect(ctx, "#4a5668", x + 3, y - 6 - lift + wings, 5, 2);
    return;
  }
  const peck = Math.floor(e.anim * 0.8 + e.variant) % 3 === 0 ? 1 : 0;
  rect(ctx, "#7d8796", x - 4, y - 5, 8, 5);
  rect(ctx, "#4a5668", x - 4, y - 5, 3, 3);
  rect(ctx, "#57a08e", x + 2, y - 8 + peck, 3, 3);
  rect(ctx, "#e8a13c", x + 5, y - 7 + peck, 2, 1);
  rect(ctx, "#e8603c", x - 1, y, 1, 2);
  rect(ctx, "#e8603c", x + 2, y, 1, 2);
}

function drawFlowers(ctx, x, y, e) {
  const colors = ["#ffd23c", "#e83c9a", "#ffffff"];
  for (let i = 0; i < 4; i++) {
    const fx = x + ((i * 11 + e.variant * 5) % 22) - 11;
    const fy = y + ((i * 7 + e.variant * 3) % 12) - 6;
    rect(ctx, "#2f9e44", fx, fy + 1, 1, 3);
    rect(ctx, colors[(i + e.variant) % 3], fx - 1, fy - 1, 3, 3);
  }
}

function drawHouse(ctx, x, y, e) {
  const wall = HOUSE_COLORS[e.variant % HOUSE_COLORS.length];
  const roof = e.variant % 2 ? "#a83c32" : "#4a5a78";
  shadow(ctx, x, y + 2, 112, 10);
  rect(ctx, OUTLINE, x - 50, y - 44, 100, 46);
  rect(ctx, wall, x - 49, y - 43, 98, 44);
  rect(ctx, OUTLINE, x - 55, y - 80, 110, 37);
  rect(ctx, roof, x - 54, y - 79, 108, 35);
  rect(ctx, "rgba(0,0,0,0.16)", x - 54, y - 56, 108, 12);
  rect(ctx, "#8a5a3a", x + 23, y - 80 - 8, 12, 12);
  rect(ctx, OUTLINE, x - 7, y - 26, 15, 27);
  rect(ctx, "#8a4a2a", x - 6, y - 25, 13, 26);
  rect(ctx, "#ffd23c", x + 3, y - 12, 2, 2);
  for (const windowX of [-38, 22]) {
    rect(ctx, OUTLINE, x + windowX, y - 33, 18, 16);
    rect(ctx, "#8fd0f0", x + windowX + 1, y - 32, 16, 14);
    rect(ctx, OUTLINE, x + windowX + 8, y - 32, 1, 14);
  }
}

function drawShop(ctx, x, y, e) {
  const wall = e.variant % 2 ? "#b86a4a" : "#8a93a8";
  const stripeA = e.variant % 3 === 0 ? "#d8282f" : "#2f6fd8";
  shadow(ctx, x, y + 2, 122, 10);
  rect(ctx, OUTLINE, x - 58, y - 96, 116, 98);
  rect(ctx, wall, x - 57, y - 95, 114, 96);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      rect(ctx, "#ffe89a", x - 48 + col * 25, y - 87 + row * 20, 16, 13);
    }
  }
  rect(ctx, "#b8e4f5", x - 50, y - 32, 42, 26);
  rect(ctx, "#b8e4f5", x + 10, y - 32, 40, 26);
  rect(ctx, OUTLINE, x - 7, y - 32, 15, 33);
  for (let i = 0; i < 9; i++) rect(ctx, i % 2 ? "#ffffff" : stripeA, x - 54 + i * 12, y - 42, 12, 8);
}

function drawPine(ctx, x, y) {
  shadow(ctx, x, y + 2, 24, 6);
  rect(ctx, "#6b4423", x - 3, y - 8, 6, 10);
  rect(ctx, "#1f7a33", x - 15, y - 22, 30, 14);
  rect(ctx, "#2f9e44", x - 11, y - 36, 22, 15);
  rect(ctx, "#3fae5a", x - 6, y - 48, 12, 13);
}

function drawFlamingo(ctx, x, y) {
  rect(ctx, "#4a5668", x - 1, y - 12, 1, 12);
  rect(ctx, "#4a5668", x + 3, y - 12, 1, 12);
  rect(ctx, "#ff6fae", x - 4, y - 19, 12, 8);
  rect(ctx, "#ff6fae", x + 6, y - 28, 3, 11);
  rect(ctx, "#ff6fae", x + 7, y - 31, 6, 4);
  rect(ctx, "#20202a", x + 12, y - 29, 3, 2);
}

function drawMailbox(ctx, x, y) {
  rect(ctx, "#6b4423", x - 1, y - 12, 3, 13);
  rect(ctx, OUTLINE, x - 8, y - 21, 16, 10);
  rect(ctx, "#2f6fd8", x - 7, y - 20, 14, 8);
  rect(ctx, "#e03030", x + 6, y - 24, 2, 7);
}

const bubbleRadius = (e) => 16 + Math.floor(e.anim * 0.7) % 3;

// Every power-up floats inside a pulsing bubble in its own color.
function drawBubble(ctx, x, y, e, glow, ring) {
  const r = bubbleRadius(e);
  rect(ctx, glow, x - r + 5, y - r, r * 2 - 10, r * 2);
  rect(ctx, glow, x - r, y - r + 5, r * 2, r * 2 - 10);

  rect(ctx, ring, x - r + 5, y - r - 1, r * 2 - 10, 1);
  rect(ctx, ring, x - r + 5, y + r, r * 2 - 10, 1);
  rect(ctx, ring, x - r - 1, y - r + 5, 1, r * 2 - 10);
  rect(ctx, ring, x + r, y - r + 5, 1, r * 2 - 10);
  for (const [cornerX, cornerY] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    rect(ctx, ring, x + cornerX * (r - 3) - 1, y + cornerY * (r - 3) - 1, 3, 3);
  }
}

// Sparkles orbit the bubble and twinkle as they go.
function drawSparkles(ctx, x, y, e) {
  const r = bubbleRadius(e);
  for (let i = 0; i < 3; i++) {
    const angle = e.anim * 0.45 + (i * Math.PI * 2) / 3;
    const sparkX = Math.round(x + Math.cos(angle) * (r + 4));
    const sparkY = Math.round(y + Math.sin(angle) * (r + 4));
    const size = (Math.floor(e.anim) + i) % 2 ? 2 : 1;
    rect(ctx, "#ffffff", sparkX - size, sparkY, size * 2 + 1, 1);
    rect(ctx, "#ffffff", sparkX, sparkY - size, 1, size * 2 + 1);
  }
}

function drawHelmetPickup(ctx, x, y) {
  // Dome.
  rect(ctx, OUTLINE, x - 7, y - 11, 14, 2);
  rect(ctx, OUTLINE, x - 10, y - 9, 20, 3);
  rect(ctx, OUTLINE, x - 11, y - 6, 22, 11);
  rect(ctx, "#1f7fe8", x - 6, y - 10, 12, 2);
  rect(ctx, "#1f7fe8", x - 9, y - 8, 18, 2);
  rect(ctx, "#1f7fe8", x - 10, y - 6, 20, 8);
  rect(ctx, "#7fd0ff", x - 8, y - 8, 5, 2);
  rect(ctx, "#7fd0ff", x - 9, y - 6, 2, 4);
  // Brim and chin strap.
  rect(ctx, "#0d3f8a", x - 10, y + 2, 20, 2);
  rect(ctx, OUTLINE, x - 7, y + 5, 2, 3);
  rect(ctx, OUTLINE, x + 5, y + 5, 2, 3);
  rect(ctx, OUTLINE, x - 7, y + 7, 14, 1);
  rect(ctx, "#ffd23c", x - 2, y + 6, 4, 3);
  // Gold star on the front.
  rect(ctx, "#ffd23c", x - 1, y - 8, 2, 3);
  rect(ctx, "#ffd23c", x - 5, y - 5, 10, 2);
  rect(ctx, "#ffd23c", x - 3, y - 3, 6, 2);
  rect(ctx, "#ffd23c", x - 4, y - 1, 3, 2);
  rect(ctx, "#ffd23c", x + 1, y - 1, 3, 2);
}

function drawSodaPickup(ctx, x, y, e) {
  rect(ctx, OUTLINE, x - 7, y - 11, 14, 22);
  rect(ctx, "#d8dee6", x - 6, y - 10, 12, 3);
  rect(ctx, "#8a93a0", x - 2, y - 10, 4, 1);
  rect(ctx, "#e0262e", x - 6, y - 7, 12, 15);
  rect(ctx, "#ff7a70", x - 5, y - 7, 2, 15);
  // White swoosh across the label.
  rect(ctx, "#ffffff", x - 6, y - 3, 7, 2);
  rect(ctx, "#ffffff", x - 2, y - 1, 8, 2);
  rect(ctx, "#ffffff", x + 2, y + 1, 4, 1);
  rect(ctx, "#d8dee6", x - 6, y + 8, 12, 2);
  // Fizz rises off the top of the can.
  for (let i = 0; i < 3; i++) {
    const rise = (Math.floor(e.anim * 0.8) + i * 2) % 6;
    rect(ctx, "#ffffff", x - 4 + i * 4, y - 12 - rise, 2, 2);
  }
}

function drawWheelPickup(ctx, x, y, e) {
  rect(ctx, OUTLINE, x - 7, y - 11, 14, 22);
  rect(ctx, OUTLINE, x - 11, y - 7, 22, 14);
  rect(ctx, OUTLINE, x - 9, y - 9, 18, 18);
  rect(ctx, "#ffc61a", x - 6, y - 10, 12, 20);
  rect(ctx, "#ffc61a", x - 10, y - 6, 20, 12);
  rect(ctx, "#ffc61a", x - 8, y - 8, 16, 16);
  rect(ctx, "#fff0a0", x - 6, y - 9, 5, 2);
  rect(ctx, "#fff0a0", x - 8, y - 7, 2, 4);
  rect(ctx, "#d9920a", x + 1, y + 7, 6, 2);
  rect(ctx, "#d9920a", x + 6, y + 2, 2, 5);
  // Notches step around the rim, so the wheel looks like it's spinning.
  const turn = Math.floor(e.anim * 0.8) * (Math.PI / 4);
  for (let i = 0; i < 4; i++) {
    const angle = turn + (i * Math.PI) / 2;
    const notchX = Math.round(x + Math.cos(angle) * 7);
    const notchY = Math.round(y + Math.sin(angle) * 7);
    rect(ctx, "#b87a08", notchX - 1, notchY - 1, 2, 2);
  }
  // Silver bearing.
  rect(ctx, OUTLINE, x - 4, y - 4, 8, 8);
  rect(ctx, "#e8edf2", x - 3, y - 3, 6, 6);
  rect(ctx, OUTLINE, x - 1, y - 1, 2, 2);
}

function drawRocketPickup(ctx, centerX, y, e) {
  const x = centerX + 3;
  const flicker = Math.floor(e.anim) % 2;
  // Flames blast out of the heel.
  rect(ctx, "#ff8a1f", x - 18 + flicker * 2, y - 3, 7, 3);
  rect(ctx, "#ff8a1f", x - 17 - flicker, y + 1, 6, 3);
  rect(ctx, "#ffd84a", x - 14, y - 2, 3, 2);
  rect(ctx, "#ffd84a", x - 14 + flicker, y + 1, 3, 2);
  rect(ctx, "#8a93a0", x - 11, y - 4, 3, 9);
  // High-top sneaker.
  rect(ctx, OUTLINE, x - 9, y - 10, 11, 14);
  rect(ctx, OUTLINE, x - 9, y - 2, 20, 7);
  rect(ctx, OUTLINE, x - 10, y + 3, 22, 6);
  rect(ctx, "#ff5a1f", x - 8, y - 9, 9, 12);
  rect(ctx, "#ff5a1f", x - 8, y - 1, 18, 5);
  rect(ctx, "#ffd84a", x - 8, y - 9, 9, 2);
  rect(ctx, "#ffd84a", x - 6, y - 4, 5, 2);
  rect(ctx, "#ffd84a", x - 4, y - 2, 5, 2);
  rect(ctx, "#ffffff", x + 3, y, 1, 3);
  rect(ctx, "#ffffff", x + 6, y, 1, 3);
  rect(ctx, "#ffffff", x - 9, y + 4, 20, 3);
}

function drawEnergyPickup(ctx, x, y, e) {
  rect(ctx, OUTLINE, x - 6, y - 12, 12, 24);
  rect(ctx, "#d8dee6", x - 5, y - 11, 10, 2);
  rect(ctx, "#16b85a", x - 5, y - 9, 10, 18);
  rect(ctx, "#6ff0a0", x - 5, y - 9, 2, 18);
  rect(ctx, "#d8dee6", x - 5, y + 9, 10, 2);
  // Lightning bolt on the label.
  rect(ctx, "#ffe45c", x, y - 7, 3, 2);
  rect(ctx, "#ffe45c", x - 1, y - 5, 3, 2);
  rect(ctx, "#ffe45c", x - 3, y - 3, 7, 2);
  rect(ctx, "#ffe45c", x, y - 1, 3, 2);
  rect(ctx, "#ffe45c", x - 1, y + 1, 3, 2);
  rect(ctx, "#ffe45c", x - 2, y + 3, 2, 3);
  // Electricity crackles down each side, swapping sides as it flickers.
  const side = Math.floor(e.anim) % 2 ? 1 : -1;
  const arc = "#d8ffe4";
  rect(ctx, arc, x + side * 9, y - 8, 1, 4);
  rect(ctx, arc, x + side * 11, y - 5, 1, 5);
  rect(ctx, arc, x + side * 9, y, 1, 4);
  rect(ctx, arc, x + side * 11, y + 3, 1, 4);
  rect(ctx, arc, x + side * 10, y - 5, 1, 1);
  rect(ctx, arc, x + side * 10, y, 1, 1);
  rect(ctx, arc, x + side * 10, y + 3, 1, 1);
}

const PICKUP_LOOKS = {
  helmet: { glow: "rgba(90,200,255,0.24)", ring: "#c8f4ff", art: drawHelmetPickup },
  soda: { glow: "rgba(255,80,80,0.24)", ring: "#ffd0cc", art: drawSodaPickup },
  wheel: { glow: "rgba(255,210,60,0.28)", ring: "#fff2b0", art: drawWheelPickup },
  rocket: { glow: "rgba(255,140,40,0.26)", ring: "#ffd9a8", art: drawRocketPickup },
  energy: { glow: "rgba(80,240,130,0.24)", ring: "#caffd9", art: drawEnergyPickup },
};

function drawCollectible(ctx, x, y, e) {
  const bob = Math.round(Math.sin(e.anim * 0.5) * 2);
  const center = y - 12 + bob;
  const look = PICKUP_LOOKS[e.kind.id];
  rect(ctx, "rgba(0,0,0,0.22)", x - 8, y + 6, 16, 3);
  drawBubble(ctx, x, center, e, look.glow, look.ring);
  look.art(ctx, x, center, e);
  drawSparkles(ctx, x, center, e);
}

/* ---------- Kinds ---------- */

const TALL = 1000; // Taller than any jump.

export const KINDS = {
  // Stationary obstacles.
  tree: { id: "tree", r: 10, height: TALL, solid: true, debris: "#2f9e44", draw: drawTree },
  bush: { id: "bush", r: 11, height: 12, solid: true, debris: "#51c267", draw: drawBush },
  bench: { id: "bench", w: 38, h: 14, height: 11, solid: true, debris: "#a8672e", draw: drawBench },
  trash: { id: "trash", r: 8, height: 13, solid: true, debris: "#7c8691", draw: drawTrash },
  hydrant: { id: "hydrant", r: 6, height: 10, solid: true, debris: "#7fb6e6", draw: drawHydrant },
  lamp: { id: "lamp", r: 4, height: TALL, solid: true, debris: "#5a6470", draw: drawLamp },
  car: { id: "car", w: 38, h: 64, height: 32, solid: true, debris: "#c8d0d8", draw: drawCar },
  // Ground effects.
  puddle: { id: "puddle", w: 40, h: 12, height: 0, flat: true, draw: drawPuddle },
  crack: { id: "crack", w: 46, h: 8, height: 0, flat: true, draw: drawCrack },
  ramp: { id: "ramp", w: 56, h: 36, height: 0, flat: true, draw: drawRamp },
  flowers: { id: "flowers", r: 0, height: 0, flat: true, decor: true, draw: drawFlowers },
  // Things that move.
  ped: {
    id: "ped", r: 7, height: 16, solid: true, mover: true, speed: 44, animRate: 7, person: true, debris: "#e8603c",
    draw: (ctx, x, y, e) => drawPerson(ctx, x, y, e, false),
  },
  jogger: {
    id: "jogger", r: 7, height: 16, solid: true, mover: true, speed: 105, animRate: 13, person: true, debris: "#3cb4e8",
    draw: (ctx, x, y, e) => drawPerson(ctx, x, y, e, true),
  },
  cart: { id: "cart", w: 26, h: 12, height: 12, solid: true, mover: true, speed: 125, animRate: 9, debris: "#88909a", draw: drawCart },
  dog: { id: "dog", r: 8, height: 9, solid: true, mover: true, speed: 78, animRate: 10, debris: "#a86a35", draw: drawDog },
  pigeon: { id: "pigeon", r: 4, height: 0, mover: true, speed: 0, animRate: 4, draw: drawPigeon },
  // Collectibles.
  soda: { id: "soda", r: 14, height: 0, collectible: true, draw: drawCollectible },
  wheel: { id: "wheel", r: 14, height: 0, collectible: true, draw: drawCollectible },
  helmet: { id: "helmet", r: 14, height: 0, collectible: true, draw: drawCollectible },
  rocket: { id: "rocket", r: 14, height: 0, collectible: true, draw: drawCollectible },
  energy: { id: "energy", r: 14, height: 0, collectible: true, draw: drawCollectible },
  // Background scenery beyond the fences.
  house: { id: "house", r: 0, height: 0, decor: true, draw: drawHouse },
  shop: { id: "shop", r: 0, height: 0, decor: true, draw: drawShop },
  pine: { id: "pine", r: 0, height: 0, decor: true, draw: drawPine },
  flamingo: { id: "flamingo", r: 0, height: 0, decor: true, draw: drawFlamingo },
  mailbox: { id: "mailbox", r: 0, height: 0, decor: true, draw: drawMailbox },
};

const OFFSTAGE = CONFIG.world.playHalf + 30;

/* ---------- Pool ---------- */

export class EntityPool {
  constructor() {
    this.free = [];
    this.active = [];
  }

  // Reuses a retired entity when there is one, and only builds new ones at first.
  spawn(kind, x, y) {
    const e = this.free.pop() ?? {};
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.z = 0;
    e.vx = 0;
    e.vy = 0;
    e.anim = Math.random() * 10;
    e.variant = Math.floor(Math.random() * 60);
    e.handled = false;  // Scored or hit already.
    e.knocked = false;  // Bowled over by the player.
    e.flying = false;   // Pigeons only.
    e.thinkTime = 0.3;
    e.remove = false;
    this.active.push(e);
    return e;
  }

  // Drops anything flagged, or anything behind `cutoffY`, back into the pool.
  sweep(cutoffY) {
    const { active, free } = this;
    let kept = 0;
    for (let i = 0; i < active.length; i++) {
      const e = active[i];
      if (e.remove || e.y < cutoffY) free.push(e);
      else active[kept++] = e;
    }
    active.length = kept;
  }

  clear() {
    this.sweep(Infinity);
  }
}

/* ---------- Movement ---------- */

export function updateEntity(e, dt, player, audio) {
  const { kind } = e;
  if (!kind.mover) {
    if (kind.collectible) e.anim += dt * 10;
    return;
  }
  e.anim += dt * kind.animRate;

  if (kind === KINDS.pigeon) {
    updatePigeon(e, dt, player, audio);
    return;
  }
  if (e.knocked) {
    e.vx *= Math.exp(-4 * dt);
    e.x += e.vx * dt;
    return;
  }
  if (kind === KINDS.dog) {
    updateDog(e, dt, player, audio);
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (Math.abs(e.x) > OFFSTAGE) e.remove = true;
}

// Dogs change their mind constantly, and bark when you get close.
function updateDog(e, dt, player, audio) {
  e.thinkTime -= dt;
  if (e.thinkTime <= 0) {
    e.thinkTime = 0.35 + Math.random() * 0.9;
    const angle = Math.random() * Math.PI * 2;
    e.vx = Math.cos(angle) * KINDS.dog.speed;
    e.vy = Math.sin(angle) * KINDS.dog.speed * 0.5;
  }
  const dx = player.x - e.x;
  const dy = e.y - player.y;
  if (dy > 0 && dy < 130 && Math.abs(dx) < 130) audio.bark();
}

function updatePigeon(e, dt, player, audio) {
  if (e.flying) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.z += 62 * dt;
    if (e.z > 160) e.remove = true;
    return;
  }
  const dx = e.x - player.x;
  const dy = e.y - player.y;
  if (dx * dx + dy * dy < 92 * 92) {
    e.flying = true;
    const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.3;
    e.vx = Math.cos(angle) * 110;
    e.vy = player.speed + Math.sin(angle) * 110;
    audio.flap();
  }
}

/* ---------- Drawing ---------- */

export function drawEntity(ctx, e, camera) {
  const x = Math.round(camera.sx(e.x));
  const y = Math.round(camera.sy(e.y));
  if (e.knocked) {
    // Whoever got flattened lies down and thinks about what happened.
    ctx.save();
    ctx.translate(x, y - 3);
    ctx.rotate(Math.PI / 2);
    e.kind.draw(ctx, 0, 0, e);
    ctx.restore();
    return;
  }
  e.kind.draw(ctx, x, y, e);
}
