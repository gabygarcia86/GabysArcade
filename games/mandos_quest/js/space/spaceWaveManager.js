/*
 * Waves. A space level's script(b) uses the builder below to lay events on a timeline,
 * and the manager plays them back as the stage scrolls.
 */
(function (MQ) {
  const S = MQ.SPACE;
  const { rng, clamp } = MQ.U;
  const { cos, sin } = Math;
  const TAU = MQ.TAU;
  const SPAWN_X = MQ.VW + 70;
  const { top: TOP, bottom: BOTTOM } = S.FIELD;

  class SpaceScript {
    constructor(def) {
      this.events = [];
      this.time = 0;
      this.random = rng(4100 + def.id * 37);
      this.groups = 0;
      def.script(this);
      this.events.sort((a, b) => a.at - b.at || a.order - b.order);
      this.length = this.time;
    }

    add(type, data = {}, delay = 0) {
      this.events.push({ ...data, type, at: this.time + delay, order: this.events.length });
    }

    wait(seconds) {
      this.time += seconds;
    }

    speed(value) {
      this.add("speed", { value });
    }

    banner(text) {
      this.add("banner", { text });
    }

    say(who, text) {
      this.add("say", { who, text });
    }

    hint(text, touch) {
      this.add("hint", { text, touch });
    }

    health(y = 360) {
      this.add("pickup", { kind: MQ.SpacePowerUps.HEALTH, y });
    }

    capsule(y = 360) {
      this.add("pickup", { kind: MQ.SpacePowerUps.CAPSULE, y });
    }

    /*
     * shape: row (horizontal), column (vertical), diagonal, vee, circle, swarm, retreat,
     * dive or loop (attacks from behind). options: n, y, gap, capsule, move, speed, amp, step, vy.
     */
    wave(kind, shape, options = {}) {
      const { n = 5, y = 360, gap = 0.34, capsule = false, step = 85 } = options;
      const middle = (n - 1) / 2;
      const carrier = capsule ? Math.floor(middle) : -1;

      for (let i = 0; i < n; i++) {
        const e = { move: "line", speed: options.speed, capsule: i === carrier };
        let x = SPAWN_X;
        let ey = y;
        let delay = 0;

        switch (shape) {
          case "row":
            e.move = options.move || "sine";
            e.amp = options.amp ?? 55;
            delay = i * gap;
            break;
          case "column":
            e.move = options.move || "line";
            e.amp = options.amp ?? 35;
            ey = y + (i - middle) * step;
            break;
          case "diagonal":
            e.move = "diagonal";
            e.vy = options.vy ?? 55;
            ey = y + (i - middle) * step * 0.75;
            delay = i * gap;
            break;
          case "vee":
            e.move = options.move || "line";
            e.amp = options.amp ?? 30;
            ey = y + (i - middle) * step * 0.8;
            x += Math.abs(i - middle) * 70;
            break;
          case "circle": {
            const radius = options.amp ?? 105;
            e.move = "circle";
            e.offset = (i / n) * TAU;
            e.amp = radius;
            e.anchor = SPAWN_X + radius;
            x = e.anchor + cos(e.offset) * radius;
            ey = y + sin(e.offset) * radius;
            break;
          }
          case "swarm":
            e.move = "swarm";
            e.offset = i * 1.3;
            ey = y + (this.random() - 0.5) * 300;
            delay = i * gap * 0.6;
            break;
          case "retreat":
            e.move = "retreat";
            e.stopX = 900 + (i % 3) * 120;
            e.hold = options.hold ?? 4;
            e.offset = (i - middle) * 110;
            ey = y + (i - middle) * 120;
            delay = i * gap;
            break;
          case "dive":
            e.move = "dive";
            e.stopX = 980 - (i % 3) * 70;
            ey = y + (i - middle) * step;
            delay = i * gap;
            break;
          case "loop":
            e.move = "loop";
            e.stopX = 74 + (i % 2) * 40;
            e.hold = options.hold ?? 3.2;
            ey = (i % 2 === 0) === y < 400 ? 122 : 606;
            delay = i * gap;
            break;
          default:
            throw new Error(`Unknown formation "${shape}"`);
        }
        this.add("enemy", { kind, x, y: clamp(ey, 106, 620), options: e }, delay);
      }
    }

    // A named ship that stops the timeline until it's destroyed or leaves.
    elite(kind, name, options = {}) {
      const { y = 340, hold = 26, generators = 0 } = options;
      this.add("elite", {
        kind, name, y, generators,
        group: ++this.groups,
        options: { move: "station", stopX: options.stopX ?? 990, hold, amp: options.amp ?? 70, boss: name, hp: options.hp },
      });
      this.time += 0.1;
    }

    // A lone defense platform, behind generators if given.
    platform(y, options = {}) {
      const { generators = 0, hold = 10 } = options;
      this.add("elite", {
        kind: "platform", y, generators, passing: true,
        group: ++this.groups,
        options: { move: "station", stopX: options.stopX ?? 940, hold, amp: options.amp ?? 40 },
      });
    }

    rocks(seconds, options = {}) {
      const { every = 0.7, min = 22, max = 58, style = "stone", from = 120, to = 610 } = options;
      for (let t = 0; t < seconds; t += every * this.random.range(0.7, 1.3)) {
        const radius = this.random.range(min, max);
        this.add("rock", {
          radius,
          y: this.random.range(from, to),
          options: { vy: this.random.range(-26, 26), drift: this.random.range(0, 60), spin: this.random.range(-0.9, 0.9), style },
        }, t);
      }
    }

    /*
     * A run of solid ground along the bottom or top edge. turrets and generators are positions
     * along it from 0 to 1. Generators shield the turrets on the same run.
     */
    surface(side, seconds, height, options = {}) {
      const { style = "crust", turrets = [], generators = [] } = options;
      this.add("surface", { side, seconds, height, style, turrets, generators, group: generators.length ? ++this.groups : 0 });
    }

    // Two structures with an opening between them.
    opening(y, size, options = {}) {
      this.add("opening", { y, size, width: options.width ?? 120, style: options.style || "station" });
    }

    wreck(y, options = {}) {
      this.add("wreck", { y, width: options.width ?? 260, height: options.height ?? 86 });
    }

    arm(y, options = {}) {
      this.add("arm", { y, length: options.length ?? 120, spin: options.spin ?? 0.9, angle: options.angle ?? 1.2 });
    }

    barrier(y, gap, options = {}) {
      this.add("barrier", { y, gap, amp: options.amp ?? 0, freq: options.freq ?? 1.4 });
    }

    // A beam across the whole field that drops when its emitter is shot.
    gate(y, hp = 70) {
      this.add("gate", { y, hp });
    }

    // at is where it hits across the screen, reach how far it extends.
    strike(at, options = {}) {
      this.add("strike", {
        x: at,
        reach: options.reach ?? 300,
        width: options.width ?? 90,
        warn: options.warn ?? 1.25,
        style: options.style || "eruption",
        fromTop: !!options.fromTop,
      });
    }

    boss() {
      this.add("boss");
    }
  }

  const RUN = {
    speed: (w, e) => (w.targetSpeed = e.value),
    banner: (w, e) => w.banner(e.text),
    say: (w, e) => w.say(e.who, e.text),
    hint: (w, e) => w.hint(e.text, e.touch),
    pickup: (w, e) => w.powerUps.drop(e.kind, MQ.VW + 30, e.y),
    boss: (w) => w.approachBoss(),
    rock: (w, e) => w.obstacles.rock(MQ.VW + e.radius + 20, e.y, e.radius, e.options),
    wreck: (w, e) => w.obstacles.block(MQ.VW + 20, e.y - e.height / 2, e.width, e.height, "wreck"),
    arm: (w, e) => w.obstacles.arm(MQ.VW + e.length + 20, e.y, e.length, e.spin, e.angle),
    barrier: (w, e) => w.obstacles.barrier(MQ.VW + 30, e.y, e.gap, e.amp, e.freq),
    gate: (w, e) => w.obstacles.gate(MQ.VW + 40, e.y, e.hp),

    enemy(w, e) {
      const enemy = w.enemies.spawn(e.kind, e.x, e.y, e.options);
      if (!enemy || enemy.move !== "circle") return;
      enemy.anchor = e.options.anchor;
      enemy.baseY = e.y - sin(e.options.offset) * e.options.amp;
    },

    elite(w, e, waves) {
      const ship = w.enemies.spawn(e.kind, MQ.VW + 180, e.y, e.options);
      if (!ship) return;
      if (e.generators) {
        ship.group = e.group;
        for (let i = 0; i < e.generators; i++) {
          w.enemies.spawn("generator", ship.x, ship.y, {
            move: "orbit", parent: ship, group: e.group,
            amp: ship.rx + 62, freq: 0.8, offset: (i / e.generators) * TAU,
          });
        }
      }
      if (e.passing) return;
      waves.hold = ship;
      waves.holdSerial = ship.serial;
      w.eliteArrived(ship);
    },

    surface(w, e) {
      const length = e.seconds * w.targetSpeed;
      const top = e.side === "top";
      const y = top ? TOP - 4 : BOTTOM - e.height;
      const x = MQ.VW + 20;
      const block = w.obstacles.block(x, y, length, e.height + 4, e.style);
      if (!block) return;
      block.fromTop = top;
      const mount = (kind, at) => {
        const { ry } = S.ENEMIES[kind];
        w.enemies.spawn(kind, x + length * at, top ? TOP + e.height + ry - 4 : y - ry + 4, { move: "surface", ceiling: top, group: e.group });
      };
      for (const at of e.turrets) mount("turret", at);
      for (const at of e.generators) mount("generator", at);
    },

    opening(w, e) {
      const x = MQ.VW + 20;
      const upper = e.y - e.size / 2;
      const lower = e.y + e.size / 2;
      if (upper > TOP) {
        const block = w.obstacles.block(x, TOP - 4, e.width, upper - TOP + 4, e.style);
        if (block) block.fromTop = true;
      }
      if (lower < BOTTOM) w.obstacles.block(x, lower, e.width, BOTTOM - lower + 4, e.style);
    },

    strike(w, e) {
      const edge = e.fromTop ? TOP + e.reach : BOTTOM - e.reach;
      w.obstacles.strike(e.x, edge, e.width, e.warn, e.style, e.fromTop, false);
    },
  };

  class SpaceWaveManager {
    constructor(world, def) {
      this.world = world;
      const script = new SpaceScript(def);
      this.events = script.events;
      this.length = script.length;
      this.index = 0;
      this.clock = 0;
      this.hold = null;
      this.holdSerial = 0;
    }

    get holding() {
      return !!this.hold?.active && this.hold.serial === this.holdSerial;
    }

    get progress() {
      return Math.min(1, this.clock / this.length);
    }

    update(dt) {
      if (this.holding) return;
      if (this.hold) {
        this.hold = null;
        this.world.eliteGone();
      }
      this.clock += dt;
      while (this.index < this.events.length && this.events[this.index].at <= this.clock) {
        const event = this.events[this.index++];
        RUN[event.type](this.world, event, this);
        if (this.hold) break;
      }
    }
  }

  MQ.SpaceScript = SpaceScript;
  MQ.SpaceWaveManager = SpaceWaveManager;
})(window.MQ);
