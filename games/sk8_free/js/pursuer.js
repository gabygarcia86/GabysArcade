/*
 * The Cop or Karen: this game's Abominable Snowman. They run through everything
 * and speed up forever, so the only question is how long you last.
 */
import { CONFIG, PURSUERS } from "./config.js";
import { circleVsCircle } from "./collision.js";
import { drawCenteredText, textWidth, wrapText } from "./font.js";

const C = CONFIG.chase;
const OUTLINE = "#16161e";
const SKIN = "#eab893";

const rect = (ctx, color, x, y, w, h) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

export class Pursuer {
  constructor() {
    this.type = "cop";
    this.active = false;
    this.reset("cop");
  }

  reset(type) {
    this.type = type;
    this.active = false;
    this.mode = "run"; // run, approach or stand
    this.x = 0;
    this.y = 0;
    this.time = 0;
    this.speed = 0;
    this.anim = 0;
    this.hop = 0;
    this.nextLine = 1;
    this.lineIndex = Math.floor(Math.random() * 3);
    this.bubble = [];
    this.bubbleTime = 0;
  }

  spawn(player, camera) {
    this.active = true;
    this.mode = "run";
    this.x = player.x + (Math.random() < 0.5 ? -1 : 1) * 40;
    this.y = camera.bottomWorld() - 30;
    this.time = 0;
    this.nextLine = 0.7;
  }

  get intensity() {
    return Math.min(1, this.time / 30);
  }

  say(text) {
    const maxChars = 15;
    this.bubble = wrapText(text, maxChars);
    this.bubbleTime = 2.2;
  }

  // Returns true on a new line of dialogue, so the game can play the voice.
  update(dt, player, camera) {
    this.anim += dt * (9 + this.intensity * 7);
    this.bubbleTime = Math.max(0, this.bubbleTime - dt);
    this.hop = Math.max(0, this.hop - dt);
    if (this.mode !== "run") return false;

    this.time += dt;
    this.speed = player.cruise + C.headStart + C.ramp * this.time;
    this.y += this.speed * dt;

    // Getting ahead is allowed, but they never drop off the screen.
    const edge = camera.bottomWorld() + C.leash;
    if (this.y < edge) this.y += (edge - this.y) * (1 - Math.exp(-4 * dt));

    const lateral = C.lateralSpeed + C.lateralRamp * this.time;
    const dx = player.x - this.x;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), lateral * dt);

    this.nextLine -= dt;
    if (this.nextLine > 0) return false;
    this.nextLine = C.dialogueEvery;
    this.lineIndex = (this.lineIndex + 1) % 3;
    this.say(PURSUERS[this.type].lines[this.lineIndex]);
    return true;
  }

  catches(player) {
    return this.mode === "run"
      && player.z < C.catchHeight
      && circleVsCircle(this.x, this.y, C.catchRadius, player.x, player.y, player.radius);
  }

  // Walks to the spot just above the fallen skater and looms over them.
  stepToStandOver(dt, player) {
    const targetX = player.x + 6;
    const targetY = player.y + 30;
    const blend = 1 - Math.exp(-6 * dt);
    this.x += (targetX - this.x) * blend;
    this.y += (targetY - this.y) * blend;
    if (Math.abs(targetY - this.y) < 2) this.mode = "stand";
  }

  draw(ctx, camera) {
    const x = Math.round(camera.sx(this.x));
    const groundY = Math.round(camera.sy(this.y));
    const stride = this.mode === "stand" ? 0 : Math.floor(this.anim) % 2 === 0 ? 1 : -1;
    const bob = this.mode === "stand" ? 0 : Math.abs(stride);
    const hopHeight = this.hop > 0 ? Math.round(Math.sin((this.hop / 0.3) * Math.PI) * 14) : 0;

    rect(ctx, "rgba(0,0,0,0.3)", x - 13, groundY + 2, 26, 6);
    if (this.type === "cop") drawCop(ctx, x, groundY - bob - hopHeight, stride, this.mode === "stand", this.anim);
    else drawKaren(ctx, x, groundY - bob - hopHeight, stride, this.mode === "stand", this.anim);
  }

  drawBubble(ctx, camera, viewWidth, textScale) {
    if (this.bubbleTime <= 0 || !this.bubble.length) return;
    const lineHeight = 9 * textScale;
    let width = 0;
    for (const line of this.bubble) width = Math.max(width, textWidth(line, textScale));
    const boxWidth = width + 10;
    const boxHeight = this.bubble.length * lineHeight + 7;
    const anchorX = camera.sx(this.x);
    const left = Math.round(Math.max(4, Math.min(viewWidth - boxWidth - 4, anchorX - boxWidth / 2)));
    const top = Math.round(Math.max(4, camera.sy(this.y) - 60 - boxHeight));

    rect(ctx, OUTLINE, left - 1, top - 1, boxWidth + 2, boxHeight + 2);
    rect(ctx, "#ffffff", left, top, boxWidth, boxHeight);
    rect(ctx, OUTLINE, Math.round(anchorX) - 2, top + boxHeight + 1, 4, 3);
    rect(ctx, OUTLINE, Math.round(anchorX) - 1, top + boxHeight + 4, 2, 3);
    this.bubble.forEach((line, i) => {
      drawCenteredText(ctx, line, left + boxWidth / 2, top + 4 + i * lineHeight, "#c81e28", textScale);
    });
  }
}

function drawCop(ctx, x, y, stride, standing, anim) {
  const navy = "#1f3f9e";
  const dark = "#11235e";
  // Legs and boots.
  rect(ctx, OUTLINE, x - 9, y - 14, 19, 15 - Math.max(0, stride) * 3);
  rect(ctx, dark, x - 8, y - 14, 7, 11 - stride * 3);
  rect(ctx, dark, x + 2, y - 14, 7, 11 + stride * 3);
  rect(ctx, "#111", x - 9, y - 4 - stride * 3, 9, 4);
  rect(ctx, "#111", x + 1, y - 4 + stride * 3, 9, 4);
  // Shirt, belt, tie and badge.
  rect(ctx, OUTLINE, x - 11, y - 31, 23, 19);
  rect(ctx, navy, x - 10, y - 30, 21, 17);
  rect(ctx, "#111", x - 10, y - 16, 21, 3);
  rect(ctx, "#f2c84b", x - 2, y - 16, 4, 3);
  rect(ctx, dark, x - 1, y - 30, 3, 11);
  rect(ctx, "#f2c84b", x + 4, y - 27, 4, 5);
  // Arms pump as they run, and one points when standing.
  if (standing) {
    rect(ctx, navy, x - 15, y - 29, 5, 11);
    rect(ctx, SKIN, x - 15, y - 18, 5, 3);
    const wave = Math.floor(anim * 0.4) % 2;
    rect(ctx, navy, x + 11, y - 29, 9, 5);
    rect(ctx, SKIN, x + 20, y - 28, 4, 4);
    // Writing up the ticket.
    rect(ctx, "#ffffff", x + 19, y - 34 + wave, 8, 7);
    rect(ctx, "#c81e28", x + 20, y - 32 + wave, 6, 1);
  } else {
    rect(ctx, navy, x - 15, y - 30 + stride * 2, 5, 11);
    rect(ctx, SKIN, x - 15, y - 19 + stride * 2, 5, 3);
    rect(ctx, navy, x + 11, y - 30 - stride * 2, 5, 11);
    rect(ctx, SKIN, x + 11, y - 19 - stride * 2, 5, 3);
    // Whistle in the raised hand.
    rect(ctx, "#d9d9e0", x + 12, y - 16 - stride * 2, 4, 2);
  }
  // Head.
  rect(ctx, OUTLINE, x - 9, y - 44, 19, 14);
  rect(ctx, SKIN, x - 8, y - 43, 17, 12);
  // Sunglasses and furious eyebrows.
  rect(ctx, "#101018", x - 7, y - 40, 7, 4);
  rect(ctx, "#101018", x + 1, y - 40, 7, 4);
  rect(ctx, "#101018", x, y - 39, 1, 1);
  rect(ctx, "#5a3417", x - 7, y - 42, 3, 1);
  rect(ctx, "#5a3417", x - 4, y - 41, 3, 1);
  rect(ctx, "#5a3417", x + 2, y - 41, 3, 1);
  rect(ctx, "#5a3417", x + 5, y - 42, 3, 1);
  // Shouting mouth and mustache.
  rect(ctx, "#5a3417", x - 4, y - 35, 9, 1);
  rect(ctx, "#7a1414", x - 2, y - 34, 5, 2 + (standing ? 0 : Math.abs(stride)));
  // Police hat.
  rect(ctx, OUTLINE, x - 11, y - 52, 23, 9);
  rect(ctx, navy, x - 10, y - 51, 21, 6);
  rect(ctx, "#101018", x - 11, y - 45, 23, 3);
  rect(ctx, "#f2c84b", x - 2, y - 50, 5, 4);
}

function drawKaren(ctx, x, y, stride, standing, anim) {
  const blazer = "#b0408f";
  const hair = "#f0d060";
  const hairDark = "#c8a432";
  // Legs and sensible heels.
  rect(ctx, SKIN, x - 6, y - 12, 4, 10 - stride * 2);
  rect(ctx, SKIN, x + 3, y - 12, 4, 10 + stride * 2);
  rect(ctx, "#c81e28", x - 7, y - 3 - stride * 2, 6, 3);
  rect(ctx, "#c81e28", x + 2, y - 3 + stride * 2, 6, 3);
  // Skirt and big-shouldered blazer.
  rect(ctx, OUTLINE, x - 11, y - 18, 23, 7);
  rect(ctx, "#6d2a8c", x - 10, y - 18, 21, 6);
  rect(ctx, OUTLINE, x - 13, y - 34, 27, 18);
  rect(ctx, blazer, x - 12, y - 33, 25, 16);
  rect(ctx, "#ffffff", x - 2, y - 33, 5, 9);
  rect(ctx, "#f2c84b", x - 2, y - 27, 5, 1);

  if (standing) {
    // Phone to the ear: the manager is on the line.
    rect(ctx, blazer, x + 13, y - 33, 5, 8);
    rect(ctx, SKIN, x + 13, y - 42, 4, 9);
    rect(ctx, "#101018", x + 14, y - 49, 4, 11);
    // Finger wag.
    const wag = Math.floor(anim * 0.5) % 2 === 0 ? -1 : 1;
    rect(ctx, blazer, x - 19, y - 32, 7, 5);
    rect(ctx, SKIN, x - 22, y - 34, 4, 6);
    rect(ctx, SKIN, x - 22 + wag, y - 39, 2, 5);
  } else {
    // Phone held high, giant purse swinging.
    rect(ctx, blazer, x + 14, y - 41 - stride, 5, 12);
    rect(ctx, SKIN, x + 14, y - 45 - stride, 5, 4);
    rect(ctx, "#101018", x + 14, y - 53 - stride, 5, 9);
    rect(ctx, "#59c7e8", x + 15, y - 52 - stride, 3, 6);
    rect(ctx, blazer, x - 18, y - 33, 5, 10);
    rect(ctx, SKIN, x - 18, y - 23, 5, 3);
    const swing = stride * 4;
    rect(ctx, "#8a5a2b", x - 19 + swing, y - 21, 2, 4);
    rect(ctx, OUTLINE, x - 25 + swing, y - 18, 14, 11);
    rect(ctx, "#a86f35", x - 24 + swing, y - 17, 12, 9);
    rect(ctx, "#f2c84b", x - 19 + swing, y - 14, 3, 2);
  }

  // A huge head under The Haircut: short at one side, sharp at the other.
  rect(ctx, OUTLINE, x - 13, y - 56, 27, 11);
  rect(ctx, OUTLINE, x - 17, y - 50, 8, 11);
  rect(ctx, OUTLINE, x + 11, y - 50, 5, 7);
  rect(ctx, hair, x - 12, y - 55, 25, 10);
  rect(ctx, hair, x - 16, y - 49, 7, 9);
  rect(ctx, hair, x + 11, y - 49, 4, 5);
  rect(ctx, hairDark, x - 14, y - 44, 4, 2);
  rect(ctx, hairDark, x - 8, y - 54, 11, 2);
  rect(ctx, OUTLINE, x - 10, y - 47, 21, 14);
  rect(ctx, SKIN, x - 9, y - 47, 19, 13);
  rect(ctx, hair, x - 9, y - 47, 12, 3);
  // Enormous sunglasses, angled in fury.
  rect(ctx, "#101018", x - 9, y - 43, 9, 6);
  rect(ctx, "#101018", x + 1, y - 43, 9, 6);
  rect(ctx, "#101018", x - 1, y - 42, 2, 2);
  rect(ctx, "#49496a", x - 8, y - 42, 3, 1);
  rect(ctx, "#49496a", x + 2, y - 42, 3, 1);
  // Red lipstick, mid-complaint.
  rect(ctx, "#c81e28", x - 3, y - 36, 7, 2);
  if (!standing || Math.floor(anim * 0.6) % 2 === 0) rect(ctx, "#5a1010", x - 2, y - 35, 5, 1);
}

// Draws a pursuer on a small canvas for the menu's picker.
export function drawPursuerPortrait(ctx, type, width, height) {
  ctx.clearRect(0, 0, width, height);
  const draw = type === "cop" ? drawCop : drawKaren;
  draw(ctx, Math.round(width / 2), height - 2, 0, false, 0);
}
