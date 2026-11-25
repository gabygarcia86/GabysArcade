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

  // The silly bits he does when clicked on the title screen (poses in art/grinch.js).
  // Each event fires once at `t` seconds: fart/puff make a green cloud of that size (fart
  // also plays `sound`, default "fart"), sound/power play an effect, say shows a bubble (a
  // list picks one line), text floats a word up, snow kicks up snow, shake shakes the view.
  const toots = (times, start = 0.8, step = 0.12) => times.map((t, i) => ({ t, puff: 0.35, sound: "toot", power: start + i * step, text: "♪" }));
  G.SILLY = {
    rocket: {
      dur: 2.6,
      events: [
        { t: 0.5, fart: 2, text: "PHHRRRT!", shake: 6 },
        { t: 0.62, puff: 0.8 },
        { t: 0.65, say: ["WHEEEEEE!", "JET-POWERED GRINCH!", "TO THE MOON!"], dur: 1.6 },
        { t: 0.74, puff: 0.7 },
        { t: 0.86, puff: 0.6 },
        { t: 0.98, puff: 0.5 },
        { t: 1.9, sound: "thump", snow: true, shake: 5 },
      ],
    },
    waft: {
      dur: 3.0,
      events: [
        { t: 0.35, fart: 1.2, text: "PFFFT!" },
        { t: 1.0, say: ["A LITTLE GIFT FOR CHRISTMAS!", "SMELL THAT, CHRISTMAS!", "EAU DE GRINCH!"], dur: 2 },
        { t: 1.3, sound: "swing" },
        { t: 1.7, sound: "swing" },
        { t: 2.2, sound: "laugh" },
      ],
    },
    trumpet: {
      dur: 3.2,
      events: [
        ...toots([0.5, 0.8, 1.1, 1.25, 1.4, 1.9], 0.9, 0.15),
        { t: 2.4, fart: 2, text: "BRAAAP!", shake: 7 },
        { t: 2.55, say: ["THAT ONE WAS FOR YOU, CHRISTMAS!", "AND AN ENCORE!", "THANK YOU, THANK YOU!"], dur: 1.8 },
      ],
    },
    spin: {
      dur: 2.8,
      events: [
        { t: 0.3, fart: 1.6, text: "FRRRRT!", shake: 4 },
        { t: 0.35, sound: "whoa" },
        { t: 0.55, puff: 0.6 },
        { t: 0.8, puff: 0.5 },
        { t: 1.05, puff: 0.4 },
        { t: 1.3, puff: 0.3 },
        { t: 2.0, say: ["WHICH WAY IS CHRISTMAS?", "MAKE THE ROOM STOP...", "WOOOOZY!"], dur: 1.6 },
      ],
    },
    hatpop: {
      dur: 2.8,
      events: [
        { t: 0.2, sound: "grr" },
        { t: 0.6, fart: 2, text: "KA-POOT!", shake: 8 },
        { t: 0.62, sound: "boing" },
        { t: 2.0, sound: "thump", power: 0.5 },
        { t: 2.1, say: ["BLEW MY HAT RIGHT OFF!", "NOW THAT WAS A BIG ONE!"], dur: 1.8 },
      ],
    },
    blame: {
      dur: 3.2,
      events: [
        { t: 0.3, puff: 0.5, sound: "toot", power: 0.5, text: "pfft..." },
        { t: 0.35, sound: "whoa" },
        { t: 1.6, say: ["IT WAS THE SNOWMAN!", "MAX DID IT!", "DON'T LOOK AT ME!", "WHOEVER SMELT IT DEALT IT!"], dur: 1.8 },
        { t: 2.4, sound: "heh" },
      ],
    },
    drum: {
      dur: 3.0,
      events: [
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ t: n * 0.18, sound: "thump", power: n % 2 ? 0.7 : 1 })),
        { t: 1.9, fart: 1.4, text: "BA-DUM-PFFT!", shake: 3 },
        { t: 2.15, say: ["I'M HERE ALL WEEK!", "THANK YOU, WHOVILLE!"], dur: 1.6 },
      ],
    },
    faint: {
      dur: 3.4,
      events: [
        { t: 0.3, fart: 1.3, text: "PFFFT!" },
        { t: 0.6, sound: "sniff" },
        { t: 1.0, say: ["PEE-YOO! WHO DID THAT?!", "OH NO. OH NO NO NO.", "EVEN I CAN'T TAKE IT!"], dur: 1.8 },
        { t: 1.8, sound: "slide" },
        { t: 2.05, sound: "thump", snow: true, shake: 4 },
        { t: 3.0, sound: "hmph" },
      ],
    },
    balloon: {
      dur: 3.2,
      events: [
        { t: 0.15, sound: "inflate", power: 0.8 },
        { t: 0.5, sound: "inflate", power: 1.1 },
        { t: 0.85, sound: "inflate", power: 1.4 },
        { t: 1.2, fart: 1.8, sound: "fartLong", text: "PFFFFFFFFT!", shake: 5 },
        ...[1.35, 1.5, 1.65, 1.8, 1.95, 2.1, 2.25].map((t) => ({ t, puff: 0.55 })),
        { t: 2.6, sound: "thump", snow: true, shake: 4 },
        { t: 2.7, say: ["I FEEL... DEFLATED.", "WELL THAT LET THE AIR OUT."], dur: 1.6 },
      ],
    },
    moonwalk: {
      dur: 3.2,
      events: [
        ...toots([0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1], 0.6, 0.18),
        { t: 2.45, sound: "boing" },
        { t: 2.7, fart: 1, text: "TA-DAAA!" },
        { t: 2.75, say: ["SMOOTH... AND SMELLY!", "HEE HEE! OW!", "THE GRINCH-WALK!"], dur: 1.6 },
      ],
    },

    // ---- The ones that aren't about farts. (sneeze: a spray of snow from his nose.)
    sneeze: {
      dur: 3.0,
      events: [
        { t: 0.1, say: "AH...", dur: 0.45 },
        { t: 0.6, say: "AHH...", dur: 0.4 },
        { t: 1.0, say: "AHHHH...", dur: 0.3 },
        { t: 1.3, sneeze: 1.6, sound: "achoo", text: "ACHOO!!", shake: 7 },
        { t: 1.9, sound: "sniff" },
        { t: 2.2, say: ["EXCUSE ME!", "I'M ALLERGIC TO CHRISTMAS!", "BLESS ME! NOBODY ELSE WILL."], dur: 1.6 },
      ],
    },
    juggle: {
      dur: 3.2,
      events: [
        { t: 0.2, say: ["WATCH THIS!", "BEHOLD MY TALENT!"], dur: 1.4 },
        { t: 2.0, sound: "swing" },
        { t: 2.5, sound: "bonk", text: "BONK!", color: "#ffffff", shake: 3 },
        { t: 2.95, sound: "thump", power: 0.4, snow: true },
        { t: 2.7, say: ["OW! MY NOGGIN!", "WHO THREW THAT?!", "I'M OKAY!"], dur: 1.5 },
      ],
    },
    slip: {
      dur: 3.2,
      events: [
        { t: 0.3, sound: "whoa", text: "WHOOPS!", color: "#bfe8ff" },
        { t: 0.8, sound: "thump", snow: true, shake: 6, text: "OOF!", color: "#ffffff" },
        { t: 2.5, say: ["I MEANT TO DO THAT.", "WHO PUT ICE HERE?!", "NOBODY SAW THAT."], dur: 1.6 },
      ],
    },
    chicken: {
      dur: 3.4,
      events: [
        ...[0.2, 0.7, 1.2, 1.7].map((t) => ({ t, sound: "bawk", text: "BAWK!", color: "#ffffff" })),
        { t: 2.3, sound: "grr" },
        { t: 2.55, sound: "poof", text: "plop!", color: "#ffffff" },
        { t: 2.85, say: ["...I DIDN'T KNOW I COULD DO THAT.", "...WELL, THAT'S NEW.", "BREAKFAST!"], dur: 1.8 },
      ],
    },
    hiccup: {
      dur: 3.2,
      events: [
        ...[0.3, 0.9, 1.5].map((t) => ({ t, sound: "hic", text: "HIC!", color: "#ffffff" })),
        { t: 1.9, say: "HOLD... MY... BREATH...", dur: 0.75 },
        { t: 2.6, sound: "hic", power: 1.6, text: "HIC!!!", color: "#ffffff", shake: 4 },
        { t: 2.85, say: ["OH, COME ON!", "THEY'RE BACK!"], dur: 1.2 },
      ],
    },
    flex: {
      dur: 3.4,
      events: [
        { t: 0.3, say: ["GRINCH-ERCISE!", "FEEL THE BURN!", "LOOK AT THESE GUNS!"], dur: 1.2 },
        { t: 1.1, sound: "kiss", text: "MWAH!", color: "#ff9ac0" },
        { t: 2.0, sound: "crack", text: "CRACK!", color: "#ffffff", shake: 3 },
        { t: 2.2, say: ["OW! MY BACK!", "I THINK I PULLED SOMETHING."], dur: 1.6 },
      ],
    },
    ballet: {
      dur: 3.6,
      events: [
        { t: 0.2, sound: "twinkle" },
        { t: 0.4, say: ["I AM A SNOWFLAKE!", "SO GRACEFUL!", "PIROUETTE!"], dur: 1.4 },
        { t: 1.9, sound: "twinkle" },
        { t: 2.5, sound: "thump", power: 0.5 },
        { t: 2.55, sound: "whoa" },
        { t: 3.0, say: ["MERCI, MERCI!", "HOLD YOUR APPLAUSE."], dur: 1.2 },
      ],
    },
    sing: {
      dur: 3.6,
      events: [
        { t: 0.15, say: ["♪ FA LA LA LA... BLAH! ♪", "♪ DECK THE HALLS WITH SNOWBALLS ♪", "♪ LA LA LAAAAA ♪"], dur: 2.2 },
        { t: 0.2, sound: "sing", power: 1.0, text: "♪", color: "#ffffff" },
        { t: 0.75, sound: "sing", power: 1.12, text: "♫", color: "#ffffff" },
        { t: 1.3, sound: "sing", power: 1.26, text: "♪", color: "#ffffff" },
        { t: 1.85, sound: "sing", power: 1.6, text: "♫", color: "#ffffff" },
        { t: 2.4, sound: "squeak", text: "*SQUEAK*", color: "#ffffff" },
        { t: 2.95, sound: "hmph" },
        { t: 3.0, say: ["AHEM. I'M A LITTLE HOARSE.", "...NOBODY HEARD THAT."], dur: 1.4 },
      ],
    },
    itch: {
      dur: 3.2,
      events: [
        ...[0.1, 0.4, 0.7, 1.1, 1.4, 1.7].map((t) => ({ t, sound: "scratch" })),
        { t: 0.3, say: ["FLEAS! IT'S FLEAS!", "WHO PUT TINSEL IN MY FUR?!", "ITCHY! ITCHY!"], dur: 1.5 },
        ...[1.98, 2.14, 2.3, 2.45, 2.61].map((t) => ({ t, sound: "thump", power: 0.5 })),
        { t: 2.75, say: ["AHHH... THAT'S THE SPOT.", "MUCH BETTER."], dur: 1.4 },
      ],
    },
    karate: {
      dur: 3.4,
      events: [
        { t: 0.3, sound: "swing", text: "HI-YAH!", color: "#ffd23f" },
        { t: 0.8, sound: "swing", text: "WA-TAH!", color: "#ffd23f" },
        { t: 1.3, sound: "swing", text: "HYAAA!", color: "#ffd23f" },
        { t: 1.75, sound: "swing" },
        { t: 2.4, sound: "thump", power: 0.4 },
        { t: 2.5, say: ["FEAR MY SNOW-FU!", "BLACK BELT IN HUMBUG!", "HI-YAH, CHRISTMAS!"], dur: 1.6 },
      ],
    },
  };
  for (const name in G.SILLY) {
    DUR[name] = G.SILLY[name].dur;
    PRIORITY[name] = 1;
  }

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
      // What he goes back to when an animation finishes ("hold" on the title screen).
      this.rest = "idle";
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

    // Starts a random silly bit, working through all of them before any repeats.
    silly() {
      if (!this.sillyBag || !this.sillyBag.length) {
        this.sillyBag = G.shuffle(Object.keys(G.SILLY));
        if (this.sillyBag[0] === this.anim && this.sillyBag.length > 1) this.sillyBag.push(this.sillyBag.shift());
      }
      const name = this.sillyBag.shift();
      this.play(name, true);
      this.bubble = null;
      return name;
    }

    get isSilly() {
      return !!G.SILLY[this.anim];
    }

    update(dt, aiming) {
      const before = this.at;
      this.at += dt;
      const bit = G.SILLY[this.anim];
      if (bit && this.onSilly) {
        for (const ev of bit.events) if (ev.t > before && ev.t <= this.at) this.onSilly(ev);
      }
      if (DUR[this.anim] > 0 && this.at >= DUR[this.anim]) {
        this.anim = aiming ? "aim" : this.rest;
        this.at = 0;
      }
      if (this.bubble) {
        this.bubble.t += dt;
        if (this.bubble.t > this.bubble.dur) this.bubble = null;
      }
    }

    draw(ctx, time, pouch) {
      G.Art.drawGrinch(ctx, this.look(pouch), time);
    }

    // What the art code needs to draw (or locate) him.
    look(pouch) {
      return { x: this.x, y: this.y, anim: this.anim, at: this.at, power: this.power, rest: this.rest, pouch };
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
