/*
 * Hero progression: XP and levels (cap 30), upgrade points, the 10-stat upgrade tree,
 * passives unlocked by level, and the final combat stats a hero takes into a level.
 */
(function (XM) {
  "use strict";
  const MAX_LEVEL = 30;
  const MAX_RANK = 5;

  const UPGRADES = [
    { key: "health", name: "Health", desc: "+8% maximum health per rank", per: 0.08 },
    { key: "attack", name: "Basic Attack Damage", desc: "+6% basic attack damage per rank", per: 0.06 },
    { key: "special", name: "Special Ability Damage", desc: "+8% Special damage per rank", per: 0.08 },
    { key: "energy", name: "X-Energy Capacity", desc: "+8% maximum X-Energy per rank", per: 0.08 },
    { key: "recharge", name: "Energy Recharge Speed", desc: "+12% X-Energy recharge per rank", per: 0.12 },
    { key: "ultimate", name: "Ultimate Attack Damage", desc: "+8% Ultimate damage per rank", per: 0.08 },
    { key: "charge", name: "Ultimate Charge Efficiency", desc: "+10% Ultimate charge gained per rank", per: 0.1 },
    { key: "speed", name: "Movement Speed", desc: "+3% movement speed per rank", per: 0.03 },
    { key: "defense", name: "Defense", desc: "Block 2.5% more damage per rank", per: 0.025 },
    { key: "dodge", name: "Dodge Recovery", desc: "Dodge again 10% sooner per rank", per: 0.1 },
  ];

  const Progress = {
    MAX_LEVEL,
    MAX_RANK,
    UPGRADES,
    // XP needed to go from level L to L+1. About 53,000 XP in total to reach 30.
    xpToNext(L) {
      return Math.round(60 + 40 * L + 4 * L * L);
    },
    // Ranks 1-3 cost 1 point, ranks 4-5 cost 2.
    cost(rank) {
      return rank < 3 ? 1 : 2;
    },
    // Adds XP and handles level-ups. Returns {levels: [newLevel...], points}.
    addXP(charId, amount) {
      const s = XM.Save.char(charId);
      const out = { levels: [], points: 0, xp: Math.floor(amount) };
      if (s.level >= MAX_LEVEL) return out;
      s.xp += Math.floor(amount);
      while (s.level < MAX_LEVEL && s.xp >= this.xpToNext(s.level)) {
        s.xp -= this.xpToNext(s.level);
        s.level++;
        const pts = s.level % 5 === 0 ? 2 : 1;
        s.points += pts;
        out.points += pts;
        out.levels.push(s.level);
      }
      if (s.level >= MAX_LEVEL) s.xp = 0;
      return out;
    },
    buy(charId, key) {
      const s = XM.Save.char(charId);
      const rank = s.upgrades[key];
      if (rank >= MAX_RANK) return false;
      const price = this.cost(rank);
      if (s.points < price) return false;
      s.points -= price;
      s.upgrades[key] = rank + 1;
      XM.Save.write();
      return true;
    },
    // Upgrade points can be refunded so players can try other builds.
    refund(charId) {
      const s = XM.Save.char(charId);
      for (const u of UPGRADES) {
        for (let r = 0; r < s.upgrades[u.key]; r++) s.points += this.cost(r);
        s.upgrades[u.key] = 0;
      }
      XM.Save.write();
    },
    passives(charId) {
      const lvl = XM.Save.char(charId).level;
      return XM.CHAR[charId].passives.filter((p) => p.lvl <= lvl);
    },
    // Everything the Player needs, with level growth, upgrades, traits and passives applied.
    stats(charId) {
      const c = XM.CHAR[charId];
      const s = XM.Save.char(charId);
      const L = s.level - 1;
      const up = (k) => 1 + s.upgrades[k] * UPGRADES.find((u) => u.key === k).per;
      const fx = { regen: 0, crit: 0, energyOnHit: 0, ultOnKill: 0, armor: 0, comboDmg: 0, orbMagnet: 0, dodgeIframes: 0, secondWind: 0, specialDiscount: 0, ultStart: 0, moveSpeed: 0, lifesteal: 0, knockImmune: false };
      if (c.trait) for (const [k, v] of Object.entries(c.trait)) fx[k] = typeof v === "boolean" ? v : fx[k] + v;
      for (const p of this.passives(charId)) fx[p.effect] = Math.max(fx[p.effect], 0) + p.value;
      const b = c.stats;
      return {
        maxHp: Math.round(b.hp * (1 + 0.035 * L) * up("health")),
        atk: b.atk * (1 + 0.03 * L) * up("attack"),
        sp: b.sp * (1 + 0.03 * L) * up("special"),
        ult: b.ult * (1 + 0.03 * L) * up("ultimate"),
        maxEnergy: Math.round(b.energy * (1 + 0.015 * L) * up("energy")),
        regen: b.regen * up("recharge"),
        spd: b.spd * up("speed") * (1 + fx.moveSpeed),
        jump: b.jump,
        def: Math.min(0.5, b.def + s.upgrades.defense * 0.025 + fx.armor),
        dodgeCd: 0.75 * (1 - s.upgrades.dodge * 0.1),
        ultGain: up("charge"),
        cost: Math.round(b.cost * (1 - fx.specialDiscount)),
        fx,
      };
    },
  };

  XM.Progress = Progress;
})(window.XM);
