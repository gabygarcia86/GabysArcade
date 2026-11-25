/*
 * Drawing code for every character: the Grinch, Whos (adults, kids, guards, marchers),
 * neighborhood dogs and Max. Each function draws at the origin, which is the point
 * where the character's feet touch the ground. Side views are drawn facing right and
 * mirrored for left.
 */
(function (G) {
  "use strict";

  const TAU = Math.PI * 2;
  const Art = (G.Art = G.Art || {});

  // ---------------------------------------------------------------- Shared helpers

  Art.ellipse = (ctx, x, y, rx, ry, fill) => {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  };

  Art.circle = (ctx, x, y, r, fill) => {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  };

  Art.roundRect = (ctx, x, y, w, h, r) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  };

  Art.star = (ctx, x, y, r, rot = 0, points = 5) => {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = rot + (i * Math.PI) / points - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  Art.heart = (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
    ctx.fill();
  };

  Art.shadow = (ctx, rx, ry = rx * 0.32, alpha = 0.22) => {
    Art.ellipse(ctx, 0, 0, rx, ry, `rgba(20, 40, 80, ${alpha})`);
  };

  // A fuzzy ellipse with a zig-zag edge, used for fur.
  Art.fur = (ctx, cx, cy, rx, ry, tufts, jag, fill, stroke) => {
    ctx.beginPath();
    const n = tufts * 2;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const k = i % 2 === 0 ? 1 : 1 - jag / Math.max(rx, ry);
      const px = cx + Math.cos(a) * rx * k;
      const py = cy + Math.sin(a) * ry * k;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };

  function limb(ctx, x1, y1, x2, y2, bend, width, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const mx = (x1 + x2) / 2 + bend;
    const my = (y1 + y2) / 2;
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.stroke();
  }

  function claw(ctx, x, y, angle, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    for (let i = -1; i <= 1; i++) {
      const a = angle + i * 0.45;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- The Grinch

  const FUR = "#5cb531";
  const FUR_DARK = "#367f1d";
  const FUR_LIGHT = "#94d655";
  const HAT = "#e0303a";
  const SACK = "#c23a2b";
  const SACK_DARK = "#8f2419";

  function drawSack(ctx, x, y, R, t, fill, overloaded) {
    // Peeking loot first, so the sack's rim covers the bottoms.
    if (fill > 0.2) {
      const peek = Math.min(1, (fill - 0.2) / 0.6);
      const colors = ["#2f8cff", "#ffd23f", "#ff5fb4", "#4cd964"];
      for (let i = 0; i < 3; i++) {
        const px = x - R * 0.45 + i * R * 0.45;
        const py = y - R * 0.78 - peek * (5 + (i % 2) * 4);
        ctx.fillStyle = colors[i];
        ctx.fillRect(px - 5, py - 5, 10, 10);
        ctx.fillStyle = "#fff6a8";
        ctx.fillRect(px - 1, py - 5, 2, 10);
      }
      if (overloaded) {
        // A candy cane and a tree top sticking out.
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + R * 0.35, y - R * 0.6);
        ctx.lineTo(x + R * 0.5, y - R * 1.35);
        ctx.arc(x + R * 0.5 + 5, y - R * 1.35, 5, Math.PI, 0);
        ctx.stroke();
        ctx.strokeStyle = "#e0303a";
        ctx.lineWidth = 3.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#2e8b3a";
        ctx.beginPath();
        ctx.moveTo(x - R * 0.5, y - R * 1.5);
        ctx.lineTo(x - R * 0.85, y - R * 0.7);
        ctx.lineTo(x - R * 0.15, y - R * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffd23f";
        Art.star(ctx, x - R * 0.5, y - R * 1.5, 4, t);
      }
    }
    // Lumpy sack body.
    ctx.fillStyle = SACK;
    ctx.beginPath();
    const lumps = 7;
    for (let i = 0; i <= lumps * 4; i++) {
      const a = (i / (lumps * 4)) * TAU;
      const wob = 1 + Math.sin(a * lumps + 1.3) * 0.06 + Math.sin(t * 3 + a * 2) * 0.015;
      const px = x + Math.cos(a) * R * wob;
      const py = y + Math.sin(a) * R * 0.9 * wob;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Shading and patch.
    ctx.fillStyle = SACK_DARK;
    ctx.beginPath();
    ctx.ellipse(x + R * 0.15, y + R * 0.35, R * 0.75, R * 0.42, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    Art.ellipse(ctx, x - R * 0.35, y - R * 0.35, R * 0.3, R * 0.18);
    ctx.fill();
    if (R > 18) {
      ctx.fillStyle = "#d9a441";
      ctx.fillRect(x + R * 0.2, y + R * 0.05, R * 0.32, R * 0.28);
      ctx.strokeStyle = "#7a4d12";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + R * 0.2, y + R * 0.05, R * 0.32, R * 0.28);
    }
    // Neck rope.
    ctx.fillStyle = "#e8b04a";
    Art.roundRect(ctx, x - R * 0.35, y - R * 0.88, R * 0.7, 4, 2);
    ctx.fill();
  }

  /*
   * s = { dir, t, phase, speed01, mode: idle|walk|run|sneak,
   *       anim: null|collect|startled|caught|celebrate|laugh|frustrated, animT (0..1),
   *       sack (0..1.4), overloaded, tangled }
   */
  Art.grinch = (ctx, s) => {
    const t = s.t;
    const dir = s.dir || "down";
    const side = dir === "left" || dir === "right";
    const back = dir === "up";
    const moving = s.speed01 > 0.05;
    const ph = s.phase || 0;
    const anim = s.anim;
    const k = s.animT || 0;
    const R = 10 + Math.min(1.45, s.sack || 0) * 21;

    ctx.save();
    Art.shadow(ctx, 18 + R * 0.35, 6.5);
    if (dir === "left") ctx.scale(-1, 1);

    let hop = 0;
    let crouch = 1;
    let lean = 0;
    if (moving) hop = Math.abs(Math.sin(ph)) * (s.mode === "run" ? 6 : s.mode === "sneak" ? 1.5 : 3);
    if (s.mode === "sneak") crouch = 0.84;
    if (side && s.mode === "run") lean = 0.16;
    if (s.overloaded && moving) {
      lean += Math.sin(ph * 0.5) * 0.1;
      crouch *= 0.93;
    }
    if (anim === "startled") hop = Math.sin(Math.PI * Math.min(1, k * 1.4)) * 18;
    if (anim === "celebrate") hop = Math.abs(Math.sin(t * 9)) * 14;
    if (anim === "laugh") lean = Math.sin(t * 22) * 0.05;
    if (anim === "caught") {
      crouch = 0.78;
      lean = Math.sin(t * 6) * 0.12;
    }
    if (anim === "frustrated") hop = Math.abs(Math.sin(t * 16)) * 3;

    ctx.translate(0, -hop);
    ctx.rotate(lean);
    ctx.scale(1, crouch);

    const breathe = moving ? 0 : Math.sin(t * 2.4) * 0.8;

    // Sack behind the body unless seen from the back.
    const sackX = side ? -14 - R * 0.55 : -15 - R * 0.2;
    const sackY = -44 - R * 0.15 + (s.overloaded ? 4 : 0);
    if (!back) drawSack(ctx, sackX, sackY, R, t, s.sack, s.overloaded);

    // Legs.
    const stride = moving ? Math.sin(ph) : 0;
    const legLen = s.mode === "sneak" ? 0.6 : 1;
    if (side) {
      const sw = (s.mode === "run" ? 11 : 7) * stride;
      limb(ctx, -3, -16, -3 - sw, -1 - Math.max(0, -stride) * 3 * legLen, 3, 5, FUR_DARK);
      limb(ctx, 3, -16, 3 + sw, -1 - Math.max(0, stride) * 3 * legLen, 3, 5, FUR);
      Art.ellipse(ctx, -3 - sw + 5, -1 - Math.max(0, -stride) * 3, 7, 3, FUR_DARK);
      Art.ellipse(ctx, 3 + sw + 5, -1 - Math.max(0, stride) * 3, 7, 3, FUR_DARK);
    } else {
      const lift = (s.mode === "run" ? 5 : 3.5) * legLen;
      const ly = -1 - Math.max(0, stride) * lift;
      const ry = -1 - Math.max(0, -stride) * lift;
      const spread = s.overloaded && moving ? 11 + Math.sin(ph * 2) * 2 : 8;
      limb(ctx, -6, -16, -spread, ly, -2, 5, FUR);
      limb(ctx, 6, -16, spread, ry, 2, 5, FUR);
      Art.ellipse(ctx, -spread - 2, ly, 7, 3.2, FUR_DARK);
      Art.ellipse(ctx, spread + 2, ry, 7, 3.2, FUR_DARK);
    }

    // Body.
    const bodyY = -31 + breathe * 0.3;
    Art.fur(ctx, 0, bodyY, side ? 13 : 15, 17 + breathe * 0.4, 13, 2.6, FUR, FUR_DARK);
    if (!back) Art.ellipse(ctx, side ? 4 : 0, bodyY + 3, side ? 7 : 9, 11, FUR_LIGHT);
    else Art.ellipse(ctx, 0, bodyY, 8, 10, "rgba(0,0,0,0.08)");

    // Arms.
    let hl = { x: -17, y: -25 };
    let hr = { x: 17, y: -25 };
    if (moving) {
      const sw = (s.mode === "run" ? 9 : 5) * stride;
      hl = { x: -17, y: -26 - sw };
      hr = { x: 17, y: -26 + sw };
      if (side) {
        hl = { x: -8 - sw, y: -24 };
        hr = { x: 10 + sw, y: -24 };
      }
    } else {
      hl.y += Math.sin(t * 2) * 1;
      hr.y += Math.sin(t * 2 + 1) * 1;
    }
    if (s.mode === "sneak" && !anim) {
      const wig = Math.sin(t * 8) * 1.5;
      hl = side ? { x: 12, y: -46 + wig } : { x: -12, y: -48 + wig };
      hr = side ? { x: 18, y: -42 - wig } : { x: 12, y: -48 - wig };
    }
    if (s.overloaded && !anim && s.mode !== "sneak") {
      // Both hands hold the sack strap over the shoulder.
      hl = side ? { x: -6, y: -46 } : { x: -10, y: -46 };
      hr = side ? { x: 2, y: -44 } : { x: -4, y: -42 };
    }
    if (anim === "collect") {
      const reach = Math.sin(Math.PI * k);
      hr = { x: 18 + reach * 6, y: -36 - reach * 14 };
    } else if (anim === "celebrate") {
      hl = { x: -20, y: -64 + Math.sin(t * 9) * 3 };
      hr = { x: 20, y: -64 - Math.sin(t * 9) * 3 };
    } else if (anim === "startled") {
      hl = { x: -24, y: -54 };
      hr = { x: 24, y: -54 };
    } else if (anim === "caught") {
      hl = { x: -16, y: -18 };
      hr = { x: 16, y: -18 };
    } else if (anim === "laugh") {
      hl = { x: -8, y: -36 };
      hr = { x: 8, y: -36 };
    } else if (anim === "frustrated") {
      hl = { x: -20, y: -58 + Math.sin(t * 20) * 3 };
      hr = { x: 20, y: -58 - Math.sin(t * 20) * 3 };
    }
    const sL = side ? { x: -4, y: -41 } : { x: -12, y: -41 };
    const sR = side ? { x: 5, y: -41 } : { x: 12, y: -41 };
    limb(ctx, sL.x, sL.y, hl.x, hl.y, -3, 4.5, side ? FUR_DARK : FUR);
    limb(ctx, sR.x, sR.y, hr.x, hr.y, 3, 4.5, FUR);
    claw(ctx, hl.x, hl.y, Math.atan2(hl.y - sL.y, hl.x - sL.x), FUR_DARK);
    claw(ctx, hr.x, hr.y, Math.atan2(hr.y - sR.y, hr.x - sR.x), FUR_DARK);

    // Head.
    const headY = -58 + breathe * 0.5;
    const hx = side ? 3 : 0;
    Art.fur(ctx, hx, headY, side ? 14 : 15.5, 13.5, 12, 2.2, FUR, FUR_DARK);
    // Cheek tufts.
    if (!back) {
      ctx.fillStyle = FUR;
      ctx.beginPath();
      ctx.moveTo(hx - 14, headY + 2);
      ctx.lineTo(hx - 20, headY + 5);
      ctx.lineTo(hx - 13, headY + 7);
      ctx.moveTo(hx + 14, headY + 2);
      ctx.lineTo(hx + 20, headY + 5);
      ctx.lineTo(hx + 13, headY + 7);
      ctx.fill();
    }

    if (!back) drawGrinchFace(ctx, hx + (side ? 5 : 0), headY, s, side);

    // Santa hat.
    const sway = Math.sin(t * 3 + ph * 0.5) * 3 + (moving ? -lean * 20 : 0);
    const hatBase = headY - 11;
    ctx.fillStyle = HAT;
    ctx.beginPath();
    ctx.moveTo(hx - 13, hatBase + 1);
    ctx.quadraticCurveTo(hx - 6, hatBase - 22, hx + 6 + sway, hatBase - 24);
    ctx.quadraticCurveTo(hx + 18 + sway, hatBase - 20, hx + 20 + sway, hatBase - 8);
    ctx.quadraticCurveTo(hx + 10, hatBase - 12, hx + 13, hatBase + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.moveTo(hx + 2, hatBase);
    ctx.quadraticCurveTo(hx + 8, hatBase - 14, hx + 16 + sway, hatBase - 12);
    ctx.lineTo(hx + 13, hatBase + 1);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    Art.roundRect(ctx, hx - 15, hatBase - 3, 30, 7, 3.5);
    ctx.fill();
    Art.circle(ctx, hx + 20 + sway, hatBase - 7, 4.5, "#ffffff");

    // Sack in front when walking away from the camera.
    if (back) drawSack(ctx, 3, -46, R, t, s.sack, s.overloaded);

    // Tangled in Christmas lights.
    if (s.tangled) {
      ctx.strokeStyle = "#1f5f2a";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = i * 0.9 + t * 0.5;
        const px = Math.cos(a) * 16;
        const py = -20 - i * 1.7 + Math.sin(a) * 4;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      const cols = ["#ff4d4d", "#ffd23f", "#4cd964", "#5fd0ff"];
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + t * 0.5;
        const on = Math.sin(t * 8 + i) > -0.3;
        ctx.fillStyle = on ? cols[i % 4] : "#555";
        Art.circle(ctx, Math.cos(a) * 16, -22 - i * 4.4 + Math.sin(a) * 4, 2.4);
        ctx.fill();
      }
    }

    // Sweat drops when overloaded or caught.
    if ((s.overloaded && moving) || anim === "caught") {
      ctx.fillStyle = "#8fd8ff";
      const d = (t * 1.6) % 1;
      ctx.globalAlpha = 1 - d;
      ctx.beginPath();
      ctx.ellipse(-16, -70 + d * 12, 2.2, 3.4, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(18, -64 + ((d + 0.5) % 1) * 12, 2, 3, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Stars circling a caught Grinch.
    if (anim === "caught") {
      ctx.fillStyle = "#ffd23f";
      for (let i = 0; i < 4; i++) {
        const a = t * 5 + (i * TAU) / 4;
        Art.star(ctx, Math.cos(a) * 18, -84 + Math.sin(a) * 5, 4.5, t * 4);
      }
    }
    // Steam when frustrated.
    if (anim === "frustrated") {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (let i = 0; i < 2; i++) {
        const d = (t * 2 + i * 0.5) % 1;
        Art.circle(ctx, (i ? 14 : -14) + (i ? d * 6 : -d * 6), -78 - d * 14, 3 + d * 4);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  function drawGrinchFace(ctx, x, y, s, side) {
    const t = s.t;
    const anim = s.anim;
    let expr = "grin";
    if (anim === "startled") expr = "shock";
    else if (anim === "caught") expr = "dizzy";
    else if (anim === "celebrate") expr = "joy";
    else if (anim === "laugh" || anim === "collect") expr = "laugh";
    else if (anim === "frustrated") expr = "mad";
    else if (s.overloaded) expr = "tired";
    else if (s.mode === "sneak") expr = "sneaky";

    const eyeY = y - 2;
    const ex = side ? [x - 2, x + 7] : [x - 6.5, x + 6.5];
    const look = expr === "sneaky" ? Math.sin(t * 3) * 2 : side ? 1.5 : 0;
    const blink = expr !== "shock" && t % 3.7 < 0.12;

    ctx.lineCap = "round";
    // Eyes.
    for (let i = 0; i < 2; i++) {
      const cx = ex[i];
      const rw = side && i === 0 ? 3.4 : 5;
      if (expr === "laugh" || expr === "joy") {
        ctx.strokeStyle = "#1d2a12";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, eyeY + 1.5, rw * 0.8, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        continue;
      }
      if (expr === "dizzy") {
        ctx.strokeStyle = "#1d2a12";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let a = 0; a < TAU * 1.6; a += 0.3) {
          const rr = a * 0.5;
          const px = cx + Math.cos(a + t * 8) * rr;
          const py = eyeY + Math.sin(a + t * 8) * rr;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        continue;
      }
      const big = expr === "shock" ? 1.35 : 1;
      Art.ellipse(ctx, cx, eyeY, rw * big, 4.6 * big, "#fff59a");
      if (blink) {
        ctx.fillStyle = FUR;
        ctx.fillRect(cx - rw - 1, eyeY - 5, rw * 2 + 2, 10);
        continue;
      }
      const pr = expr === "shock" ? 1.4 : 2.3;
      Art.circle(ctx, cx + look + (side ? 1 : 0), eyeY + 0.5, pr, "#c0182c");
      Art.circle(ctx, cx + look + (side ? 1 : 0), eyeY + 0.5, pr * 0.5, "#1d1010");
      if (expr === "tired") {
        ctx.fillStyle = FUR;
        ctx.fillRect(cx - rw - 1, eyeY - 6, rw * 2 + 2, 5.5);
      }
    }
    // Eyebrows.
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    if (expr === "shock") {
      ctx.moveTo(ex[0] - 5, eyeY - 10);
      ctx.lineTo(ex[0] + 4, eyeY - 11);
      ctx.moveTo(ex[1] - 4, eyeY - 11);
      ctx.lineTo(ex[1] + 5, eyeY - 10);
    } else if (expr === "mad") {
      ctx.moveTo(ex[0] - 5, eyeY - 9);
      ctx.lineTo(ex[0] + 5, eyeY - 4);
      ctx.moveTo(ex[1] - 5, eyeY - 4);
      ctx.lineTo(ex[1] + 5, eyeY - 9);
    } else if (expr !== "joy") {
      ctx.moveTo(ex[0] - 5, eyeY - 6);
      ctx.lineTo(ex[0] + 4, eyeY - 7.5);
      ctx.moveTo(ex[1] - 4, eyeY - 8);
      ctx.lineTo(ex[1] + 5, eyeY - 4.5);
    }
    ctx.stroke();
    // Nose.
    Art.ellipse(ctx, side ? x + 12 : x, y + 3, side ? 3 : 2.2, 1.6, FUR_DARK);
    // Mouth.
    const my = y + 7;
    const mx = side ? x + 4 : x;
    ctx.strokeStyle = "#1d2a12";
    ctx.lineWidth = 1.8;
    if (expr === "laugh" || expr === "joy") {
      ctx.fillStyle = "#3a1010";
      ctx.beginPath();
      ctx.moveTo(mx - 9, my - 1);
      ctx.quadraticCurveTo(mx, my + 11, mx + 9, my - 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff7a8a";
      Art.ellipse(ctx, mx, my + 4.5, 3.5, 2);
      ctx.fill();
      ctx.fillStyle = "#fffbe0";
      ctx.fillRect(mx - 6, my - 1, 12, 2);
    } else if (expr === "shock") {
      Art.ellipse(ctx, mx, my + 2, 3.2, 4, "#3a1010");
    } else if (expr === "dizzy" || expr === "tired") {
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const px = mx - 7 + i * 1.75;
        const py = my + 1 + Math.sin(i * 1.6 + t * 6) * 1.4;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (expr === "mad") {
      ctx.beginPath();
      ctx.moveTo(mx - 7, my + 3);
      ctx.quadraticCurveTo(mx, my - 2, mx + 7, my + 3);
      ctx.stroke();
    } else {
      // The famous sly grin: wide, curling up at one side.
      ctx.beginPath();
      ctx.moveTo(mx - 10, my - 3);
      ctx.quadraticCurveTo(mx - 1, my + 5, mx + 10, my - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx + 10, my - 5);
      ctx.lineTo(mx + 12, my - 7);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- Whos

  /*
   * w = { dir, t, phase, speed01, look: { coat, trim, skin, hair, style }, kind: adult|kid|guard|marcher,
   *       mood: calm|sus|alert|happy|dizzy|party, scale }
   */
  Art.who = (ctx, w) => {
    const t = w.t;
    const L = w.look;
    const dir = w.dir || "down";
    const side = dir === "left" || dir === "right";
    const back = dir === "up";
    const moving = w.speed01 > 0.05;
    const ph = w.phase || 0;
    const mood = w.mood || "calm";
    const kid = w.kind === "kid";

    ctx.save();
    const sc = w.scale || (kid ? 0.76 : 1);
    Art.shadow(ctx, 14 * sc, 5 * sc);
    ctx.scale(sc, sc);
    if (dir === "left") ctx.scale(-1, 1);

    let hop = moving ? Math.abs(Math.sin(ph)) * (kid ? 4 : 2.5) : 0;
    if (mood === "alert" && !moving) hop = Math.abs(Math.sin(t * 12)) * 3;
    if (mood === "happy" || mood === "party") hop = Math.abs(Math.sin(t * 7)) * 4;
    let tilt = 0;
    if (mood === "dizzy") tilt = Math.sin(t * 5) * 0.2;
    if (mood === "party") tilt = Math.sin(t * 7) * 0.12;
    ctx.translate(0, -hop);
    ctx.rotate(tilt);

    // Boots.
    const stride = moving ? Math.sin(ph) : 0;
    const boot = L.boot || "#3b2a4a";
    if (side) {
      Art.ellipse(ctx, -2 - stride * 6, -2 - Math.max(0, -stride) * 3, 5.5, 3.2, boot);
      Art.ellipse(ctx, 4 + stride * 6, -2 - Math.max(0, stride) * 3, 5.5, 3.2, boot);
    } else {
      Art.ellipse(ctx, -5, -2 - Math.max(0, stride) * 3, 5, 3.2, boot);
      Art.ellipse(ctx, 5, -2 - Math.max(0, -stride) * 3, 5, 3.2, boot);
    }

    // Coat: a bell shape.
    ctx.fillStyle = L.coat;
    ctx.beginPath();
    ctx.moveTo(-9, -38);
    ctx.quadraticCurveTo(-16, -20, -15, -6);
    ctx.quadraticCurveTo(0, -1, 15, -6);
    ctx.quadraticCurveTo(16, -20, 9, -38);
    ctx.closePath();
    ctx.fill();
    // Hem trim.
    ctx.fillStyle = L.trim;
    ctx.beginPath();
    ctx.moveTo(-15, -8);
    ctx.quadraticCurveTo(0, -3, 15, -8);
    ctx.lineTo(15, -5);
    ctx.quadraticCurveTo(0, 0, -15, -5);
    ctx.closePath();
    ctx.fill();
    if (!back) {
      // Buttons.
      ctx.fillStyle = w.kind === "guard" ? "#ffd23f" : L.trim;
      for (let i = 0; i < 3; i++) Art.circle(ctx, side ? 5 : 0, -30 + i * 7, 1.6);
      ctx.fill();
      if (w.kind === "guard") {
        ctx.fillStyle = "#ffd23f";
        ctx.fillRect(-12, -22, 24, 3);
      }
    }

    // Arms.
    const skin = L.skin;
    let al = { x: -14, y: -20 + stride * 3 };
    let ar = { x: 14, y: -20 - stride * 3 };
    if (side) {
      al = { x: -4 - stride * 6, y: -19 };
      ar = { x: 6 + stride * 6, y: -19 };
    }
    if (mood === "alert") {
      // Pointing and waving.
      ar = side ? { x: 22, y: -36 } : { x: 18, y: -46 + Math.sin(t * 14) * 3 };
      al = side ? { x: -6, y: -20 } : { x: -18, y: -44 - Math.sin(t * 14) * 3 };
    } else if (mood === "sus") {
      ar = side ? { x: 8, y: -40 } : { x: 6, y: -42 }; // hand to chin
    } else if (mood === "happy") {
      al = { x: -16, y: -14 };
      ar = { x: 16, y: -14 };
    } else if (mood === "party") {
      al = { x: -18, y: -46 + Math.sin(t * 7) * 4 };
      ar = { x: 18, y: -46 - Math.sin(t * 7) * 4 };
    } else if (w.kind === "marcher") {
      al = { x: -12, y: -28 };
      ar = { x: 12, y: -28 };
    }
    limb(ctx, side ? -2 : -8, -34, al.x, al.y, -2, 5, L.coat);
    limb(ctx, side ? 3 : 8, -34, ar.x, ar.y, 2, 5, L.coat);
    Art.circle(ctx, al.x, al.y, 3, L.mitt || L.trim);
    Art.circle(ctx, ar.x, ar.y, 3, L.mitt || L.trim);

    // Marching drum.
    if (w.kind === "marcher" && !back) {
      Art.ellipse(ctx, 0, -20, 10, 4, "#f4f4f4");
      ctx.fillStyle = "#d63a3a";
      ctx.fillRect(-10, -20, 20, 9);
      Art.ellipse(ctx, 0, -11, 10, 4, "#b02a2a");
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -8; i <= 8; i += 4) {
        ctx.moveTo(i, -19);
        ctx.lineTo(i + 2, -11);
      }
      ctx.stroke();
    }

    // Scarf.
    ctx.fillStyle = L.scarf || L.trim;
    Art.roundRect(ctx, -10, -41, 20, 6, 3);
    ctx.fill();
    if (!back) {
      ctx.fillRect(side ? -8 : 3, -37, 5, 10 + Math.sin(t * 4) * 1.5);
    }

    // Head.
    const headY = -51;
    const hx = side ? 2 : 0;
    Art.circle(ctx, hx, headY, 11.5, skin);
    if (!back) drawWhoFace(ctx, hx + (side ? 5 : 0), headY, w, side);
    drawWhoHair(ctx, hx, headY, L, t, back, w.kind);

    // Hearts above a happy (distracted) Who.
    if (mood === "happy") {
      ctx.fillStyle = "#ff5f8f";
      const d = (t * 0.9) % 1;
      ctx.globalAlpha = 1 - d;
      Art.heart(ctx, 10, -80 - d * 16, 4);
      ctx.globalAlpha = 1;
    }
    if (mood === "dizzy") {
      ctx.fillStyle = "#ffd23f";
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + (i * TAU) / 3;
        Art.star(ctx, Math.cos(a) * 14, -76 + Math.sin(a) * 4, 3.5, t * 3);
      }
    }
    ctx.restore();
  };

  function drawWhoFace(ctx, x, y, w, side) {
    const mood = w.mood || "calm";
    const t = w.t;
    const ex = side ? [x - 1, x + 5] : [x - 4.2, x + 4.2];
    const ey = y - 1.5;
    const blink = t % 4.3 < 0.12;
    for (let i = 0; i < 2; i++) {
      if (side && i === 0) continue;
      if (mood === "happy" || mood === "party") {
        ctx.strokeStyle = "#2a1a2a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ex[i], ey + 1, 2.4, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else if (mood === "dizzy") {
        ctx.strokeStyle = "#2a1a2a";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(ex[i] - 2, ey - 2);
        ctx.lineTo(ex[i] + 2, ey + 2);
        ctx.moveTo(ex[i] + 2, ey - 2);
        ctx.lineTo(ex[i] - 2, ey + 2);
        ctx.stroke();
      } else if (blink) {
        ctx.fillStyle = "#2a1a2a";
        ctx.fillRect(ex[i] - 2.5, ey, 5, 1.2);
      } else {
        const big = mood === "alert" ? 1.3 : 1;
        Art.ellipse(ctx, ex[i], ey, 2.8 * big, 3.3 * big, "#ffffff");
        Art.circle(ctx, ex[i] + (side ? 1 : 0), ey + 0.4, 1.6, "#2a1a2a");
      }
    }
    if (mood === "sus" || mood === "alert") {
      ctx.strokeStyle = "#2a1a2a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (mood === "sus") {
        ctx.moveTo(ex[0] - 3, ey - 5);
        ctx.lineTo(ex[0] + 2, ey - 6);
        ctx.moveTo(ex[1] - 2, ey - 7.5);
        ctx.lineTo(ex[1] + 3, ey - 5);
      } else {
        ctx.moveTo(ex[0] - 3, ey - 7);
        ctx.lineTo(ex[0] + 3, ey - 4.5);
        ctx.moveTo(ex[1] - 3, ey - 4.5);
        ctx.lineTo(ex[1] + 3, ey - 7);
      }
      ctx.stroke();
    }
    // Cheeks and button nose.
    ctx.fillStyle = "rgba(255, 110, 130, 0.45)";
    if (!side) Art.circle(ctx, x - 7, y + 3, 2.4);
    ctx.fill();
    Art.circle(ctx, x + 7, y + 3, 2.4);
    ctx.fill();
    Art.ellipse(ctx, side ? x + 8 : x, y + 2, 2.6, 2, "#e8836f");
    // Mouth.
    ctx.strokeStyle = "#5a2a2a";
    ctx.lineWidth = 1.4;
    const mx = side ? x + 4 : x;
    if (mood === "alert") {
      Art.ellipse(ctx, mx, y + 6.5, 2.6, 3, "#5a1a1a");
    } else if (mood === "sus") {
      ctx.beginPath();
      ctx.moveTo(mx - 3, y + 6.5);
      ctx.lineTo(mx + 3, y + 5.5);
      ctx.stroke();
    } else if (mood === "dizzy") {
      Art.ellipse(ctx, mx, y + 6.5, 2, 1.6, "#5a1a1a");
    } else {
      ctx.beginPath();
      ctx.arc(mx, y + 4.5, 3, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }

  function drawWhoHair(ctx, x, y, L, t, back, kind) {
    const style = L.style;
    const hair = L.hair;
    if (style === "beehive") {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.moveTo(x - 11, y - 3);
      ctx.quadraticCurveTo(x - 14, y - 26, x - 4, y - 38);
      ctx.quadraticCurveTo(x + 4, y - 46, x + 2, y - 34);
      ctx.quadraticCurveTo(x + 14, y - 24, x + 11, y - 3);
      ctx.quadraticCurveTo(x, y - 10, x - 11, y - 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y - 22, 5, 0, Math.PI * 1.5);
      ctx.stroke();
      Art.circle(ctx, x + 6, y - 32, 3.5, L.trim);
    } else if (style === "tophat") {
      ctx.save();
      ctx.translate(x, y - 9);
      ctx.rotate(-0.12);
      ctx.fillStyle = "#2b2140";
      ctx.fillRect(-9, -26, 18, 26);
      Art.ellipse(ctx, 0, 0, 14, 3.5, "#2b2140");
      ctx.fillStyle = L.trim;
      ctx.fillRect(-9, -7, 18, 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-9, -26, 18, 3);
      ctx.restore();
    } else if (style === "antenna") {
      ctx.strokeStyle = hair;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y - 11);
      for (let i = 0; i <= 12; i++) {
        const k = i / 12;
        ctx.lineTo(x + Math.sin(k * 12 + t * 2) * 5, y - 11 - k * 24);
      }
      ctx.stroke();
      Art.circle(ctx, x + Math.sin(12 + t * 2) * 5, y - 36, 4.5, L.trim);
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(x, y - 4, 11.5, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
    } else if (style === "beanie") {
      ctx.fillStyle = L.trim;
      ctx.beginPath();
      ctx.arc(x, y - 3, 12, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      Art.roundRect(ctx, x - 12.5, y - 5, 25, 5, 2.5);
      ctx.fill();
      ctx.strokeStyle = L.trim;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.quadraticCurveTo(x + 4, y - 22, x + 8 + Math.sin(t * 5) * 2, y - 24);
      ctx.stroke();
      Art.circle(ctx, x + 8 + Math.sin(t * 5) * 2, y - 25, 4, "#ffffff");
    } else if (style === "cap") {
      ctx.fillStyle = "#24407a";
      ctx.fillRect(x - 11, y - 22, 22, 13);
      Art.ellipse(ctx, x, y - 22, 12, 4, "#2d4f94");
      ctx.fillStyle = "#162a55";
      ctx.beginPath();
      ctx.ellipse(x + (back ? 0 : 4), y - 9, 12, 3.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffd23f";
      if (!back) Art.star(ctx, x, y - 15, 4);
    } else if (style === "bow") {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(x, y - 3, 12, Math.PI, 0);
      ctx.fill();
      Art.circle(ctx, x - 11, y - 14, 6, hair);
      Art.circle(ctx, x + 11, y - 14, 6, hair);
      ctx.fillStyle = L.trim;
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x - 8, y - 20);
      ctx.lineTo(x - 8, y - 8);
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x + 8, y - 20);
      ctx.lineTo(x + 8, y - 8);
      ctx.fill();
    } else if (style === "party") {
      ctx.fillStyle = L.trim;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 8);
      ctx.lineTo(x + 2, y - 34);
      ctx.lineTo(x + 9, y - 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 18);
      ctx.lineTo(x + 6, y - 18);
      ctx.lineTo(x + 5, y - 22);
      ctx.lineTo(x - 2, y - 22);
      ctx.fill();
      Art.circle(ctx, x + 2, y - 35, 3.5, "#ffd23f");
    } else if (style === "shako") {
      ctx.fillStyle = "#d63a3a";
      ctx.fillRect(x - 9, y - 30, 18, 22);
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(x - 9, y - 12, 18, 3);
      Art.ellipse(ctx, x, y - 30, 9, 3, "#a82828");
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(x + 2, y - 38 + Math.sin(t * 8) * 1, 3.5, 9, 0.2, 0, TAU);
      ctx.fill();
    } else {
      // Curly mop.
      ctx.fillStyle = hair;
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + (i / 5) * Math.PI;
        Art.circle(ctx, x + Math.cos(a) * 10, y - 2 + Math.sin(a) * 10, 5);
        ctx.fill();
      }
      Art.circle(ctx, x, y - 14, 6, hair);
    }
    if (kind === "kid" && style !== "beanie") {
      Art.circle(ctx, x - 12, y + 2, 3, L.trim);
    }
  }

  // ---------------------------------------------------------------- Dogs and Max

  /*
   * d = { face: 1 (right) | -1 (left), t, phase, speed01, look: { body, spot, ear, collar },
   *       barking, max, mood: happy|tangled|dig|calm }
   */
  Art.dog = (ctx, d) => {
    const t = d.t;
    const L = d.look;
    const moving = d.speed01 > 0.05;
    const ph = d.phase || 0;
    ctx.save();
    Art.shadow(ctx, 18, 5);
    if (d.face < 0) ctx.scale(-1, 1);
    const hop = moving ? Math.abs(Math.sin(ph)) * 3 : d.barking ? Math.abs(Math.sin(t * 18)) * 2 : 0;
    ctx.translate(0, -hop);
    if (d.mood === "dig") ctx.rotate(0.35);
    if (d.mood === "spin") ctx.scale(Math.cos(t * 10) > 0 ? 1 : -1, 1);

    // Legs.
    const sw = moving ? Math.sin(ph) * 5 : 0;
    ctx.strokeStyle = L.body;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    const legs = [
      [-10, sw],
      [-6, -sw],
      [8, -sw],
      [12, sw],
    ];
    for (const [lx, o] of legs) {
      ctx.beginPath();
      ctx.moveTo(lx, -12);
      ctx.lineTo(lx + o, -1);
      ctx.stroke();
    }
    // Tail.
    const wag = Math.sin(t * (d.mood === "happy" || d.max ? 18 : 9)) * 0.6;
    ctx.save();
    ctx.translate(-16, -18);
    ctx.rotate(-0.8 + wag);
    ctx.strokeStyle = L.body;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-4, -6, -2, -12);
    ctx.stroke();
    ctx.restore();
    // Body.
    if (d.max) Art.fur(ctx, 0, -17, 19, 9, 12, 2, L.body);
    else Art.ellipse(ctx, 0, -17, 18, 8.5, L.body);
    if (L.spot) Art.ellipse(ctx, -5, -19, 6, 4, L.spot);
    // Head.
    const hb = d.barking ? Math.sin(t * 18) * 1.5 : 0;
    const hx = 16;
    const hy = -26 + hb;
    if (d.max) Art.fur(ctx, hx, hy, 9, 8.5, 10, 1.6, L.body);
    else Art.circle(ctx, hx, hy, 8.5, L.body);
    Art.ellipse(ctx, hx + 8, hy + 3, 6, 4.2, L.snout || L.body);
    Art.circle(ctx, hx + 13, hy + 1.5, 2.2, "#1d1414");
    // Mouth.
    if (d.barking) {
      ctx.fillStyle = "#5a1a1a";
      ctx.beginPath();
      ctx.moveTo(hx + 5, hy + 5);
      ctx.lineTo(hx + 14, hy + 4);
      ctx.lineTo(hx + 12, hy + 10);
      ctx.closePath();
      ctx.fill();
    } else if (d.mood === "happy" || d.max) {
      ctx.fillStyle = "#ff7a8a";
      Art.ellipse(ctx, hx + 9, hy + 8, 2.4, 3.4);
      ctx.fill();
    }
    // Eye.
    Art.circle(ctx, hx + 3, hy - 2.5, 2.2, "#ffffff");
    Art.circle(ctx, hx + 3.6, hy - 2.3, 1.3, "#1d1414");
    // Ear.
    ctx.fillStyle = L.ear;
    ctx.beginPath();
    ctx.ellipse(hx - 4, hy - 1, 3.6, 8, 0.4 + Math.sin(t * 6) * 0.15, 0, TAU);
    ctx.fill();
    if (d.max) {
      // Max's scruffy tuft and stubby antler tied on with string.
      ctx.fillStyle = L.body;
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 8);
      ctx.lineTo(hx + 1, hy - 14);
      ctx.lineTo(hx + 3, hy - 8);
      ctx.lineTo(hx + 6, hy - 13);
      ctx.lineTo(hx + 7, hy - 7);
      ctx.fill();
    }
    // Collar.
    ctx.fillStyle = L.collar;
    ctx.save();
    ctx.translate(hx - 5, hy + 6);
    ctx.rotate(0.6);
    ctx.fillRect(-2, -6, 4, 12);
    ctx.restore();
    if (d.max) {
      Art.circle(ctx, hx - 3, hy + 10, 2.8, "#ffd23f");
      // Little red scarf tail flapping.
      ctx.fillStyle = "#e0303a";
      ctx.beginPath();
      ctx.moveTo(hx - 6, hy + 6);
      ctx.lineTo(hx - 16, hy + 4 + Math.sin(t * 10) * 3);
      ctx.lineTo(hx - 15, hy + 9 + Math.sin(t * 10) * 3);
      ctx.closePath();
      ctx.fill();
    }
    // Tangled in lights.
    if (d.mood === "tangled") {
      ctx.strokeStyle = "#1f5f2a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const a = i * 1.1 + t;
        const px = -14 + i * 1.6 + Math.cos(a) * 3;
        const py = -18 + Math.sin(a) * 9;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      const cols = ["#ff4d4d", "#ffd23f", "#4cd964", "#5fd0ff"];
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = Math.sin(t * 9 + i) > 0 ? cols[i % 4] : "#666";
        Art.circle(ctx, -14 + i * 4.2, -18 + Math.sin(i * 2.3 + t) * 9, 2.2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  // Small icons for the HUD and menus.
  Art.grinchHead = (ctx, x, y, s, t = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.translate(0, 58);
    Art.fur(ctx, 0, -58, 15.5, 13.5, 12, 2.2, FUR, FUR_DARK);
    drawGrinchFace(ctx, 0, -58, { t, anim: null, mode: "idle" }, false);
    ctx.fillStyle = HAT;
    ctx.beginPath();
    ctx.moveTo(-13, -68);
    ctx.quadraticCurveTo(-6, -91, 6, -93);
    ctx.quadraticCurveTo(18, -89, 20, -77);
    ctx.quadraticCurveTo(10, -81, 13, -68);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    Art.roundRect(ctx, -15, -72, 30, 7, 3.5);
    ctx.fill();
    Art.circle(ctx, 20, -76, 4.5, "#ffffff");
    ctx.restore();
  };

  // Shared looks.
  Art.WHO_LOOKS = [
    { coat: "#e8436a", trim: "#ffffff", skin: "#ffd9b8", hair: "#ff9f1c", style: "beehive", scarf: "#ffd23f" },
    { coat: "#3f7de0", trim: "#ffd23f", skin: "#f5c9a0", hair: "#6b3f1d", style: "tophat", scarf: "#e8436a" },
    { coat: "#8e5bd6", trim: "#5cf2c8", skin: "#ffe0c4", hair: "#d63a8a", style: "antenna", scarf: "#5cf2c8" },
    { coat: "#24a36b", trim: "#ffffff", skin: "#c98f68", hair: "#2a1a10", style: "mop", scarf: "#e0303a" },
    { coat: "#ff8a3c", trim: "#7a2fd6", skin: "#ffd9b8", hair: "#ffe066", style: "bow", scarf: "#7a2fd6" },
    { coat: "#d6334a", trim: "#9df0ff", skin: "#a06a48", hair: "#ffffff", style: "beehive", scarf: "#3fa3e0" },
    { coat: "#2fb6c6", trim: "#ff5fb4", skin: "#f5c9a0", hair: "#9b4dff", style: "antenna", scarf: "#ff5fb4" },
    { coat: "#6a4fd8", trim: "#ffd23f", skin: "#ffe0c4", hair: "#3b2a1a", style: "tophat", scarf: "#4cd964" },
  ];
  Art.KID_LOOKS = [
    { coat: "#ff5f8f", trim: "#4cd964", skin: "#ffd9b8", hair: "#ff9f1c", style: "beanie", scarf: "#ffd23f" },
    { coat: "#3fa3e0", trim: "#ff4d4d", skin: "#c98f68", hair: "#2a1a10", style: "beanie", scarf: "#ffffff" },
    { coat: "#ffd23f", trim: "#8e5bd6", skin: "#ffe0c4", hair: "#6b3f1d", style: "bow", scarf: "#8e5bd6" },
    { coat: "#4cd964", trim: "#e0303a", skin: "#a06a48", hair: "#2a1a10", style: "beanie", scarf: "#e0303a" },
  ];
  Art.GUARD_LOOK = { coat: "#2d4f94", trim: "#ffd23f", skin: "#ffd9b8", hair: "#3b2a1a", style: "cap", scarf: "#d63a3a", boot: "#151020" };
  Art.MARCHER_LOOK = { coat: "#ffffff", trim: "#d63a3a", skin: "#f5c9a0", hair: "#3b2a1a", style: "shako", scarf: "#ffd23f", mitt: "#ffffff" };
  Art.DOG_LOOKS = [
    { body: "#f2f2f2", spot: "#3a3a3a", ear: "#3a3a3a", collar: "#3f7de0", snout: "#ffffff" },
    { body: "#c98a4a", spot: null, ear: "#8a5a2a", collar: "#e0303a", snout: "#e8c79a" },
    { body: "#3a3a44", spot: null, ear: "#22222a", collar: "#ffd23f", snout: "#5a5a66" },
    { body: "#e8d2a8", spot: "#c9a26a", ear: "#c9a26a", collar: "#4cd964", snout: "#f8ecd0" },
  ];
  Art.MAX_LOOK = { body: "#9a6a3c", spot: null, ear: "#6e4523", collar: "#e0303a", snout: "#c9976a" };
})(window.GH);
