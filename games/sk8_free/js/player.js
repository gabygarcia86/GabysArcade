/*
 * The skateboarder: steering, speed, jumping, wipeouts, power-ups and drawing.
 * World y grows in the direction of travel, and z is height above the ground.
 */
import { CONFIG } from "./config.js";

const P = CONFIG.player;
const PW = CONFIG.powerups;
const PLAY_HALF = CONFIG.world.playHalf;

const SKIN = "#e8b58a";
const OUTLINE = "#20202a";
const CAP = "#d8282f";
const HELMET = "#1f7fe8";
const SHIRT = "#f6f6f6";
const PANTS = "#2f55c4";
const SHOE = "#22222c";
const DECK = "#d98a2b";

const rect = (ctx, color, x, y, w, h) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

export class Player {
  constructor() {
    this.radius = 7;
    this.reset();
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vx = 0;
    this.vz = 0;
    this.speed = P.startSpeed;
    this.cruise = P.startSpeed;
    this.state = "skate"; // skate, wipeout, recover, tumble or down
    this.timer = 0;
    this.invulnerable = 0;
    this.slip = 0;
    this.landLag = 0;
    this.airBoost = 1;
    this.ollieBuffer = 0;
    this.helmet = false;
    this.soda = 0;
    this.rocket = 0;
    this.energy = 0;
    this.anim = 0;
    this.spin = 0;
    this.board = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, flying: false };
  }

  get airborne() {
    return this.z > 0;
  }

  get controllable() {
    return this.state === "skate";
  }

  // Forward speed right now, including the push you get in the air.
  get groundSpeed() {
    return this.speed * (this.airborne ? this.airBoost : 1);
  }

  get jumpBoost() {
    return this.energy > 0 ? PW.energyJump : 1;
  }

  // Returns "ollie", "land" or null, so the game can play the right sound.
  update(dt, input) {
    this.anim += dt * (2 + this.speed * 0.03);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.slip = Math.max(0, this.slip - dt);
    this.landLag = Math.max(0, this.landLag - dt);
    this.ollieBuffer = Math.max(0, this.ollieBuffer - dt);
    this.soda = Math.max(0, this.soda - dt);
    this.rocket = Math.max(0, this.rocket - dt);
    this.energy = Math.max(0, this.energy - dt);

    let event = null;
    switch (this.state) {
      case "skate": event = this.updateSkating(dt, input); break;
      case "wipeout": this.updateWipeout(dt); break;
      case "recover": this.updateRecover(dt); break;
      default: this.updateTumble(dt);
    }
    this.updateLooseBoard(dt);

    this.y += this.groundSpeed * dt;
    this.x += this.vx * dt;
    if (Math.abs(this.x) > PLAY_HALF) {
      this.x = Math.sign(this.x) * PLAY_HALF;
      this.vx = 0;
    }
    return event;
  }

  updateSkating(dt, input) {
    this.cruise = Math.min(P.cruiseMax, this.cruise + P.cruiseRamp * dt);

    // Easing the sideways speed toward its target gives the slippery feel.
    const grip = this.slip > 0 ? P.puddleGrip : P.grip;
    this.vx += (input.steer * P.steerSpeed - this.vx) * (1 - Math.exp(-grip * dt));

    let target = this.cruise;
    if (input.up) target += P.boost;
    if (input.down) target -= P.brake;
    if (this.soda > 0) target += PW.sodaBoost;
    if (this.rocket > 0) target += PW.rocketBoost;
    target = Math.max(P.minSpeed, target);
    this.speed += (target - this.speed) * (1 - Math.exp(-P.speedResponse * dt));

    if (input.takeOllie()) this.ollieBuffer = 0.13;
    let event = null;
    if (this.ollieBuffer > 0 && !this.airborne && this.landLag === 0) {
      this.ollieBuffer = 0;
      this.vz = P.ollieVelocity * this.jumpBoost;
      this.airBoost = P.ollieAirBoost;
      this.z = 0.01;
      event = "ollie";
    }
    if (this.applyGravity(dt)) event = "land";
    return event;
  }

  applyGravity(dt) {
    if (!this.airborne) return false;
    this.vz -= P.gravity * dt;
    this.z += this.vz * dt;
    if (this.z > 0) return false;
    this.z = 0;
    this.vz = 0;
    this.airBoost = 1;
    this.landLag = P.landingLag;
    return true;
  }

  launchFromRamp() {
    this.vz = P.rampVelocity * this.jumpBoost;
    this.z = 0.01;
    this.airBoost = P.rampAirBoost;
  }

  slipOnPuddle() {
    this.slip = P.slipTime;
    this.vx += (Math.random() < 0.5 ? -1 : 1) * 130;
  }

  hitCrack() {
    this.speed *= P.crackSlowdown;
  }

  wipeout() {
    this.state = "wipeout";
    this.timer = P.wipeoutTime;
    this.z = 0;
    this.vz = 0;
    this.airBoost = 1;
    this.spin = 0;
  }

  updateWipeout(dt) {
    this.timer -= dt;
    this.spin += dt * 14;
    this.speed *= Math.exp(-4.5 * dt);
    this.vx *= Math.exp(-5 * dt);
    if (this.timer <= 0) {
      this.state = "recover";
      this.timer = P.recoverTime;
      this.speed = 0;
    }
  }

  updateRecover(dt) {
    this.timer -= dt;
    this.vx = 0;
    if (this.timer <= 0) {
      this.state = "skate";
      this.speed = this.cruise * 0.45;
      this.invulnerable = P.invulnerableTime;
    }
  }

  // Caught! The board goes one way and the skater goes the other.
  tumble() {
    this.state = "tumble";
    this.timer = 0.9;
    this.z = Math.max(this.z, 8);
    this.vz = 120;
    this.airBoost = 1;
    this.spin = 0;
    const direction = Math.random() < 0.5 ? -1 : 1;
    Object.assign(this.board, {
      x: this.x, y: this.y, z: 8, vx: direction * 150, vy: this.speed + 120, vz: 280, spin: 0, flying: true,
    });
    this.vx = -direction * 50;
  }

  updateTumble(dt) {
    this.timer -= dt;
    if (this.timer > 0) this.spin += dt * 16;
    this.speed *= Math.exp(-3.2 * dt);
    this.vx *= Math.exp(-3.2 * dt);
    this.vz -= P.gravity * dt;
    this.z = Math.max(0, this.z + this.vz * dt);
    if (this.timer <= 0 && this.z === 0) this.state = "down";
  }

  updateLooseBoard(dt) {
    const board = this.board;
    if (!board.flying) return;
    board.x += board.vx * dt;
    board.y += board.vy * dt;
    board.vz -= P.gravity * 0.8 * dt;
    board.z += board.vz * dt;
    board.spin += dt * 20;
    if (board.z <= 0) {
      board.z = 0;
      board.vz = Math.abs(board.vz) * 0.45;
      board.vx *= 0.6;
      board.vy *= 0.6;
      if (board.vz < 40) { board.vz = 0; board.vx = 0; board.vy = 0; board.spin = 0; }
    }
  }

  /* ---------- Drawing ---------- */

  draw(ctx, camera) {
    const x = Math.round(camera.sx(this.x));
    const groundY = Math.round(camera.sy(this.y));
    const y = Math.round(groundY - this.z);

    if (this.board.flying) this.drawLooseBoard(ctx, camera);
    if (this.invulnerable > 0 && Math.floor(this.invulnerable * 12) % 2 === 1) return;

    // The shadow shrinks as the skater climbs, which sells the height.
    const shadow = Math.max(4, 11 - this.z * 0.12) | 0;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(x - shadow, groundY + 12, shadow * 2, 8);

    switch (this.state) {
      case "skate": this.drawSkating(ctx, x, y); break;
      case "wipeout":
      case "tumble": this.drawSpinning(ctx, x, y); break;
      case "recover": this.drawGettingUp(ctx, x, y); break;
      default: this.drawKnockedOut(ctx, x, y);
    }
  }

  drawBoard(ctx, x, y, lean) {
    // Long and wide enough to stick out past the rider on every side.
    rect(ctx, OUTLINE, x - 9 + lean, y - 11, 3, 5);
    rect(ctx, OUTLINE, x + 7 + lean, y - 11, 3, 5);
    rect(ctx, OUTLINE, x - 9 - lean, y + 10, 3, 5);
    rect(ctx, OUTLINE, x + 7 - lean, y + 10, 3, 5);
    rect(ctx, OUTLINE, x - 8, y - 15, 17, 34);
    rect(ctx, OUTLINE, x - 6, y - 17, 13, 38);
    rect(ctx, DECK, x - 7, y - 15, 15, 34);
    rect(ctx, DECK, x - 5, y - 16, 11, 36);
    rect(ctx, "#f2c14e", x - 7, y + 8, 15, 2);
    rect(ctx, "#f2c14e", x - 5, y + 13, 11, 2);
    rect(ctx, "#b5651d", x - 7, y - 15, 2, 34);
  }

  drawSkating(ctx, x, y) {
    const lean = Math.round((this.vx / P.steerSpeed) * 3);
    const inAir = this.airborne;
    const pump = !inAir && Math.floor(this.anim) % 4 === 0 ? 1 : 0;
    const crouch = inAir ? 3 : 0;

    if (this.rocket > 0) {
      const flicker = Math.floor(this.anim * 3) % 2;
      rect(ctx, "#ff8a1f", x - 5, y + 20, 4, 5 + flicker * 3);
      rect(ctx, "#ff8a1f", x + 1, y + 20, 4, 8 - flicker * 3);
      rect(ctx, "#ffd84a", x - 4, y + 20, 2, 3);
      rect(ctx, "#ffd84a", x + 2, y + 20, 2, 4);
    }
    this.drawBoard(ctx, x, y, lean);

    const bodyX = x + lean;
    const bodyY = y + crouch + pump - 3;
    // Shoes and legs.
    const shoe = this.rocket > 0 ? "#ff5a1f" : this.energy > 0 ? "#3ddc6a" : SHOE;
    rect(ctx, shoe, x - 5, y - 2, 4, 5);
    rect(ctx, shoe, x + 2, y - 2, 4, 5);
    rect(ctx, OUTLINE, bodyX - 6, bodyY - 11, 13, 14);
    rect(ctx, PANTS, bodyX - 5, bodyY - 10, 5, 12);
    rect(ctx, PANTS, bodyX + 1, bodyY - 10, 5, 12);
    // T-shirt.
    rect(ctx, OUTLINE, bodyX - 7, bodyY - 22, 15, 14);
    rect(ctx, SHIRT, bodyX - 6, bodyY - 21, 13, 12);
    rect(ctx, "#2ba8c9", bodyX - 6, bodyY - 16, 13, 3);
    // Arms stick out for balance, and go up in the air.
    const armY = inAir ? bodyY - 28 : bodyY - 19 + lean;
    const armHeight = inAir ? 8 : 3;
    rect(ctx, SKIN, bodyX - 12, armY, 6, armHeight);
    const otherArmY = inAir ? bodyY - 28 : bodyY - 19 - lean;
    rect(ctx, SKIN, bodyX + 7, otherArmY, 6, armHeight);
    // Head, seen from behind, with the cap on backwards.
    const headX = bodyX + lean;
    rect(ctx, OUTLINE, headX - 6, bodyY - 32, 13, 11);
    rect(ctx, SKIN, headX - 5, bodyY - 26, 11, 4);
    if (this.helmet) {
      rect(ctx, HELMET, headX - 5, bodyY - 31, 11, 7);
      rect(ctx, "#7fd0ff", headX - 4, bodyY - 30, 3, 2);
      rect(ctx, "#ffd23c", headX - 1, bodyY - 31, 3, 7);
    } else {
      rect(ctx, CAP, headX - 5, bodyY - 31, 11, 6);
      rect(ctx, "#a81c22", headX - 3, bodyY - 25, 7, 3);
    }
  }

  drawSpinning(ctx, x, y) {
    // Quarter-turn steps keep the tumble looking like old sprite frames.
    const steps = Math.floor(this.spin) % 8;
    ctx.save();
    ctx.translate(x, y - 8);
    ctx.rotate(steps * (Math.PI / 4));
    rect(ctx, OUTLINE, -6, -10, 13, 21);
    rect(ctx, SHIRT, -5, -9, 11, 9);
    rect(ctx, PANTS, -5, 0, 11, 8);
    rect(ctx, SKIN, -11, -7, 5, 3);
    rect(ctx, SKIN, 7, -3, 5, 3);
    rect(ctx, SHOE, -5, 8, 4, 4);
    rect(ctx, SHOE, 2, 8, 4, 4);
    rect(ctx, OUTLINE, -5, -17, 11, 8);
    rect(ctx, this.helmet ? HELMET : CAP, -4, -16, 9, 6);
    ctx.restore();
    if (this.state === "wipeout") {
      const slide = Math.round(Math.min(1, this.spin / 6) * 16);
      this.drawFlatBoard(ctx, x + 14 + slide, y + 8 - slide);
    }
  }

  drawFlatBoard(ctx, x, y) {
    rect(ctx, OUTLINE, x - 11, y - 3, 23, 6);
    rect(ctx, DECK, x - 10, y - 2, 21, 4);
    rect(ctx, OUTLINE, x - 7, y + 3, 3, 2);
    rect(ctx, OUTLINE, x + 5, y + 3, 3, 2);
  }

  drawGettingUp(ctx, x, y) {
    const up = this.timer < P.recoverTime / 2;
    this.drawFlatBoard(ctx, x + 6, y + 10);
    const lift = up ? 7 : 0;
    rect(ctx, OUTLINE, x - 8, y - 6 - lift, 17, 13 + lift);
    rect(ctx, PANTS, x - 7, y - 1, 15, 7);
    rect(ctx, SHIRT, x - 7, y - 5 - lift, 15, 5 + lift);
    rect(ctx, OUTLINE, x - 5, y - 16 - lift, 11, 10);
    rect(ctx, SKIN, x - 4, y - 11 - lift, 9, 4);
    rect(ctx, this.helmet ? HELMET : CAP, x - 4, y - 15 - lift, 9, 5);
    this.drawStars(ctx, x, y - 22 - lift);
  }

  drawKnockedOut(ctx, x, y) {
    rect(ctx, OUTLINE, x - 18, y - 5, 37, 11);
    rect(ctx, SKIN, x - 17, y - 4, 7, 9);
    rect(ctx, CAP, x - 17, y - 4, 4, 9);
    rect(ctx, SHIRT, x - 10, y - 4, 13, 9);
    rect(ctx, PANTS, x + 3, y - 4, 12, 9);
    rect(ctx, SHOE, x + 15, y - 4, 3, 4);
    rect(ctx, SHOE, x + 15, y + 1, 3, 4);
    this.drawStars(ctx, x - 13, y - 12);
  }

  drawStars(ctx, x, y) {
    const t = this.anim * 0.6;
    for (let i = 0; i < 3; i++) {
      const angle = t + (i * Math.PI * 2) / 3;
      const color = i === 0 ? "#ffe45c" : "#ffffff";
      const starX = Math.round(x + Math.cos(angle) * 10);
      const starY = Math.round(y + Math.sin(angle) * 3);
      rect(ctx, color, starX - 1, starY, 3, 1);
      rect(ctx, color, starX, starY - 1, 1, 3);
    }
  }

  drawLooseBoard(ctx, camera) {
    const { board } = this;
    const x = Math.round(camera.sx(board.x));
    const groundY = Math.round(camera.sy(board.y));
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x - 8, groundY + 3, 16, 4);
    ctx.save();
    ctx.translate(x, groundY - Math.round(board.z));
    ctx.rotate(Math.floor(board.spin) * (Math.PI / 4));
    this.drawFlatBoard(ctx, 0, 0);
    ctx.restore();
  }
}
