/*
 * Random events that shake up a heist every 13 to 19 seconds or so: Christmas Light
 * Chaos, a giant rolling snowball, Max finding a stash, a Who party, a falling tree and a
 * rare golden present. Each level lists the events it can have.
 */
(function (G) {
  "use strict";

  class Events {
    constructor(game) {
      this.game = game;
      this.nextT = game.L.id === 1 ? 18 : G.rand(11, 15);
      this.last = null;
    }

    update(dt) {
      const g = this.game;
      if (g.state !== "play" || g.timeLeft < 7) return;
      this.nextT -= dt;
      if (this.nextT > 0) return;
      this.nextT = Math.max(9, G.rand(13, 19) - g.L.id * 0.35);
      const options = g.L.events.filter((e) => e !== this.last);
      G.shuffle(options);
      for (const type of options) {
        if (this.trigger(type)) {
          this.last = type;
          return;
        }
      }
    }

    trigger(type) {
      const g = this.game;
      const p = g.player;
      switch (type) {
        case "lights":
          if (p.stun > 0) return false;
          p.tangledT = 3.5;
          g.audio.play("jingleShort");
          g.banner("CHRISTMAS LIGHT CHAOS!", "Tangled in lights! You're slowed down.", "#4cd964");
          g.grinchReact("frustrated", "BAH! TANGLED!");
          return true;
        case "snowball":
          g.hazards.spawnSnowball();
          g.banner("SNOWBALL ATTACK!", "A giant snowball is rolling in. Dodge it!", "#5fd0ff");
          return true;
        case "maxfind":
          if (g.max.active) return false;
          g.max.appear("find");
          return true;
        case "party":
          if (!g.spawnParty()) return false;
          g.audio.play("party");
          g.banner("WHO PARTY!", "A crowd of Whos just showed up nearby!", "#ff7ad9");
          return true;
        case "treefall":
          if (!g.hazards.fallTree()) return false;
          g.audio.play("event");
          g.banner("CHRISTMAS TREE COLLAPSE!", "TIMBER! A tree is falling over!", "#27a35a");
          return true;
        case "golden": {
          const w = g.world;
          for (let k = 0; k < 40; k++) {
            const a = Math.random() * G.TAU;
            const d = G.rand(380, 820);
            const x = p.x + Math.cos(a) * d;
            const y = p.y + Math.sin(a) * d;
            if (w.isFree(x, y, 20, 8) && !w.zoneAt(w.belts, x, y)) {
              const it = g.loot.add("golden", x, y, { life: 16, pop: true });
              g.addMarker(it, "GOLD", "#ffd23f", 16);
              g.audio.play("golden");
              g.banner("GOLDEN PRESENT!", "A rare golden present appeared. Grab it fast!", "#ffd23f");
              return true;
            }
          }
          return false;
        }
      }
      return false;
    }
  }

  G.Events = Events;
})(window.GH);
