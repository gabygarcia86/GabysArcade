/*
 * Achievements: checked after kills, level clears, unlocks and upgrades. New ones pop a
 * toast and are saved with the time they were earned.
 */
(function (XM) {
  "use strict";

  const xTotal = (d) => d.levels.reduce((n, l) => n + l.x.filter(Boolean).length, 0);

  const LIST = [
    { id: "first_mission", name: "First Mission", desc: "Complete Level 1.", test: (d) => d.levels[0].cleared },
    { id: "mutant_hunter", name: "Mutant Hunter", desc: "Defeat 100 enemies.", test: (d) => d.stats.kills >= 100 },
    { id: "sentinel_slayer", name: "Sentinel Slayer", desc: "Defeat 50 Sentinels.", test: (d) => d.stats.sentinelKills >= 50 },
    { id: "boss_crusher", name: "Boss Crusher", desc: "Defeat 5 different bosses.", test: (d) => d.stats.bosses.length >= 5 },
    { id: "x_marks", name: "X Marks the Spot", desc: "Collect all 3 X symbols in a level.", test: (d) => d.levels.some((l) => l.x.every(Boolean)) },
    { id: "treasure_hunter", name: "Treasure Hunter", desc: "Collect 100 Mutant Energy Orbs.", test: (d) => d.stats.orbs >= 100 },
    { id: "fashion_mutant", name: "Fashion Mutant", desc: "Unlock 10 outfits.", test: () => XM.Outfits.total() - XM.CHARS.length >= 10 },
    { id: "team_player", name: "Team Player", desc: "Play as 6 different X-Men.", test: (d) => d.stats.played.length >= 6 },
    { id: "legendary", name: "Legendary Mutant", desc: "Reach hero level 30.", test: (d) => Object.values(d.chars).some((c) => c.level >= 30) },
    { id: "ultimate_xmen", name: "Ultimate X-Men", desc: "Complete all 20 levels.", test: (d) => d.levels.every((l) => l.cleared) },
    { id: "combo_king", name: "Combo King", desc: "Reach a 50-hit combo.", test: (d) => d.stats.maxCombo >= 50 },
    { id: "untouchable", name: "Untouchable", desc: "Clear a level without taking damage.", test: (d) => d.stats.noDamageClears >= 1 },
    { id: "secret_seeker", name: "Secret Seeker", desc: "Discover 10 secret rooms.", test: (d) => d.levels.reduce((n, l) => n + l.secrets, 0) >= 10 },
    { id: "full_power", name: "Full Power", desc: "Max out any upgrade.", test: (d) => Object.values(d.chars).some((c) => Object.values(c.upgrades).some((r) => r >= 5)) },
    { id: "speed_demon", name: "Speed Demon", desc: "Beat the par time in 5 levels.", test: (d) => d.stats.fastClears >= 5 },
    { id: "wipeout", name: "Total Wipeout", desc: "Defeat 5 enemies with one Ultimate.", test: (d) => d.stats.ultMultiKill >= 5 },
    { id: "three_stars", name: "Star Student", desc: "Earn 3 stars in 10 levels.", test: (d) => d.levels.filter((l) => l.stars >= 3).length >= 10 },
    { id: "completionist", name: "Cerebro's Chosen", desc: "Find all 60 X symbols.", test: (d) => xTotal(d) >= 60 },
  ];

  const Achievements = {
    LIST,
    queue: [],
    check() {
      const d = XM.Save.data;
      const fresh = [];
      for (const a of LIST) {
        if (d.achievements[a.id]) continue;
        let ok = false;
        try {
          ok = a.test(d);
        } catch (error) {
          ok = false;
        }
        if (ok) {
          d.achievements[a.id] = Date.now();
          fresh.push(a);
          this.queue.push({ title: "Achievement Unlocked", text: a.name, sub: a.desc, kind: "ach" });
        }
      }
      if (fresh.length) {
        XM.Save.write();
        XM.Audio.sfx("achievement");
      }
      return fresh;
    },
    count() {
      return LIST.filter((a) => XM.Save.data.achievements[a.id]).length;
    },
  };

  XM.Achievements = Achievements;
})(window.XM);
