/*
 * The Grinch as a character: which animation he's playing, what he's saying, and how he
 * reacts to what happens. Bigger reactions win over smaller ones, so a huge combo's laugh
 * isn't cut short by a stray bump.
 */
(function (G) {
  "use strict";

  const DUR = {
    idle: 0,
    load: 0.6,
    aim: 0,
    throw: 0.45,
    celebrate: 1.5,
    laugh: 1.9,
    frustrated: 1.5,
    surprised: 1.0,
    disappointed: 2.6,
    dance: 2.3,
    fallback: 2.4,
    hold: 0,
  };
  const PRIORITY = { idle: 0, hold: 0, load: 1, aim: 1, throw: 1, surprised: 2, frustrated: 2, celebrate: 3, dance: 3, laugh: 4, disappointed: 4, fallback: 5 };

  G.QUIPS = {
    title: [
      "CHRISTMAS DECORATIONS? I DON'T THINK SO!",
      "LET'S SEE HOW FESTIVE YOU ARE AFTER THIS!",
      "TIME TO MAKE A LITTLE SNOW!",
      "THAT TREE NEVER STOOD A CHANCE!",
      "ALL THOSE BLINKY LIGHTS... BLECH!",
      "I'VE GOT A SNOWBALL WITH YOUR NAME ON IT, CHRISTMAS!",
    ],
    start: [
      "CHRISTMAS DECORATIONS? I DON'T THINK SO!",
      "LET'S SEE HOW FESTIVE YOU ARE AFTER THIS!",
      "TIME TO MAKE A LITTLE SNOW!",
      "OOH, SO SHINY. SO SMASHABLE.",
      "LOOK AT ALL THAT TINSEL. YUCK!",
    ],
    launch: ["TAKE THAT, CHRISTMAS!", "INCOMING!", "SPECIAL DELIVERY!", "HEH HEH HEH...", "FORE!", "CATCH!"],
    miss: ["BAH! MISSED!", "THAT WAS A WARNING SHOT!", "THE WIND! IT WAS THE WIND!", "I MEANT TO DO THAT.", "GRRRR!", "WHO MOVED THE TARGET?!"],
    laugh: ["HA HA HA HA HA!", "LOOK AT IT ALL FALL!", "MERRY CRASH-MAS!", "BEAUTIFUL! JUST BEAUTIFUL!", "HO HO HO... NOPE!"],
    tree: ["TIMBERRR!", "THAT TREE NEVER STOOD A CHANCE!", "DOWN GOES THE TINSEL!", "NO MORE TWINKLE FOR YOU!"],
    golden: ["SHINY AND SMASHED!", "GOLD! EVEN BETTER!", "OOH, A BONUS SNOWBALL!"],
    fallback: ["I CAN'T BREATHE! HA HA HA!", "OH MY ACHING SIDES!", "TOO... MUCH... FUN!"],
    boom: ["KABOOM!", "WHOA! DID YOU SEE THAT?!", "NOW THAT'S A SNOW DAY!"],
    fail: ["CURSES! FOILED AGAIN!", "THEY'RE STILL SO... FESTIVE!", "BAH, HUMBUG!", "NEXT TIME, CHRISTMAS. NEXT TIME."],
    win: ["CHRISTMAS: CANCELLED!", "NOW THAT'S MY KIND OF HOLIDAY!", "WHAT A MESS. I LOVE IT!", "NOT A SINGLE TWINKLE LEFT!"],
    goal: ["GOAL! BUT WHY STOP NOW?", "THAT'LL DO... OR WILL IT? HEH HEH!"],
    bell: ["DING DONG! NOBODY'S HOME!", "TOO LOUD! TOO JOLLY!"],
    snowman: ["SORRY, FROSTY!", "CHILL OUT, SNOWMAN!"],
    max: ["MAX! WHAT DID YOU DO?!", "GOOD BOY, MAX! GOOD BOY!"],
  };

  class Grinch {
    constructor() {
      this.x = 232;
      this.y = G.HILL_Y;
      this.reset();
    }

    reset() {
      this.anim = "idle";
      this.at = 0;
      this.power = 0;
      this.bubble = null;
      this.lastQuip = {};
    }

    // Starts an animation unless something more important is still playing.
    play(anim, force = false) {
      const cur = this.anim;
      const busy = DUR[cur] > 0 && this.at < DUR[cur];
      if (!force && busy && PRIORITY[anim] < PRIORITY[cur]) return false;
      this.anim = anim;
      this.at = 0;
      return true;
    }

    // Says something in a speech bubble.
    say(text, dur = 2.2) {
      this.bubble = { text, t: 0, dur };
    }

    // Says a random line from a group, avoiding an immediate repeat.
    quip(group, chance = 1, dur) {
      if (Math.random() > chance) return;
      const list = G.QUIPS[group];
      if (!list) return;
      let line = G.pick(list);
      if (list.length > 1 && line === this.lastQuip[group]) line = G.pick(list);
      this.lastQuip[group] = line;
      this.say(line, dur);
    }

    get busy() {
      return DUR[this.anim] > 0 && this.at < DUR[this.anim];
    }

    update(dt, aiming) {
      this.at += dt;
      if (DUR[this.anim] > 0 && this.at >= DUR[this.anim]) {
        this.anim = aiming ? "aim" : "idle";
        this.at = 0;
      }
      if (this.bubble) {
        this.bubble.t += dt;
        if (this.bubble.t > this.bubble.dur) this.bubble = null;
      }
    }

    draw(ctx, time, pouch) {
      G.Art.drawGrinch(ctx, { x: this.x, y: this.y, anim: this.anim, at: this.at, power: this.power, pouch }, time);
    }

    drawBubble(ctx, k = 1) {
      const b = this.bubble;
      if (!b) return;
      const a = Math.min(1, b.t * 6, (b.dur - b.t) * 4);
      const pop = G.easeOutBack(Math.min(1, b.t * 5));
      ctx.save();
      ctx.translate(this.x + 56, this.y - 268);
      ctx.scale(pop * k, pop * k);
      G.Art.bubble(ctx, 0, 0, b.text, a, -16, 44);
      ctx.restore();
    }
  }

  G.Grinch = Grinch;
})(window.GS);
