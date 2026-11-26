/*
 * Outfits: 10 per hero, 120 in all. Each outfit is a palette plus layer flags the
 * character art understands (cape, coat, armor, tactical gear, battle damage, auras...).
 * Outfits are cosmetic only and never change stats.
 *
 * Unlock rules:
 *   clvl N       hero reaches level N          clears N    clear N levels as this hero
 *   level N      clear story level N           boss id     defeat that boss
 *   xtotal N     find N X symbols in all       xlevels N   find all 3 X symbols in N levels
 *   combo N      reach an N-hit combo          nodamage N  clear N levels without damage
 *   stars N      earn 3 stars in N levels      fast N      beat the par time N times
 *   ultmulti N   defeat N enemies with one Ultimate
 *   kills N      defeat N enemies              finished    complete the campaign
 */
(function (XM) {
  "use strict";

  const CATEGORIES = ["Classic Team", "Retro Comic", "Modern Tactical", "Stealth", "Armored", "Alternate Colors", "Battle-Damaged", "Special Mission", "Legendary Hero", "Ultimate Costume"];

  const BASE = {
    cyclops: { skin: "#f1c19b", hair: "#6b3f22", suit: "#2a4fc4", suit2: "#1d348a", accent: "#f2c230", trim: "#f2c230", boots: "#1d348a", gloves: "#f2c230", belt: "#f2c230", mask: "#1d348a", eye: "#ff2a2a", visor: "#c9a227", glow: "#ff3b3b", coat: "#d7e1ec", cape: "#1d348a" },
    wolverine: { skin: "#e8b48e", hair: "#2a1c14", suit: "#f2c12e", suit2: "#1f43a8", accent: "#1f43a8", trim: "#1a1a1a", boots: "#1f43a8", gloves: "#1f43a8", belt: "#c4161c", mask: "#f2c12e", fin: "#1a1a1a", eye: "#ffffff", claws: "#dfe4ea", glow: "#ffe27a", coat: "#4b3621" },
    storm: { skin: "#6b4630", hair: "#f4f4f8", suit: "#1b1b22", suit2: "#2a2a35", accent: "#d9dbe6", trim: "#c9a227", boots: "#1b1b22", gloves: "#1b1b22", belt: "#c9a227", mask: "#1b1b22", eye: "#ffffff", cape: "#1b1b22", capeIn: "#c9ccd8", glow: "#bfe8ff", coat: "#121212" },
    jean: { skin: "#f3c9a8", hair: "#c8361e", suit: "#2a9a52", suit2: "#e0b840", accent: "#e0b840", trim: "#e0b840", boots: "#e0b840", gloves: "#e0b840", belt: "#e0b840", mask: "#2a9a52", eye: "#3a7a4a", glow: "#ff8a3d", cape: "#d42a1c", coat: "#e8ecf4" },
    beast: { skin: "#3550c8", hair: "#2a3a9a", suit: "#1a1a1a", suit2: "#2a2a2a", accent: "#f2c230", trim: "#f2c230", boots: "#3550c8", gloves: "#3550c8", belt: "#f2c230", mask: "#3550c8", eye: "#ffe680", glow: "#8fb0ff", coat: "#f4f4f4" },
    gambit: { skin: "#efc29e", hair: "#6b4a2a", suit: "#2b2b33", suit2: "#c2307a", accent: "#3a63c9", trim: "#9aa0ab", boots: "#3a63c9", gloves: "#3a63c9", belt: "#2b2b33", mask: "#c2307a", eye: "#ff2030", coat: "#7a4a22", coatIn: "#4e2f15", glow: "#ff4fb3", staff: "#9aa0ab" },
    nightcrawler: { skin: "#2a3a8a", hair: "#161a40", suit: "#1a1a1a", suit2: "#c0262c", accent: "#c0262c", trim: "#c0262c", boots: "#ececec", gloves: "#ececec", belt: "#1a1a1a", mask: "#1a1a1a", eye: "#ffe14a", glow: "#7a4cff", coat: "#151515" },
    colossus: { skin: "#c8d0da", hair: "#1e1a17", suit: "#c4161c", suit2: "#f2c230", accent: "#f2c230", trim: "#f2c230", boots: "#c4161c", gloves: "#c8d0da", belt: "#1a1a1a", mask: "#c4161c", eye: "#5a7aa0", glow: "#bfe6ff", coat: "#e8e2d2" },
    iceman: { skin: "#a9e4ff", hair: "#d8f4ff", suit: "#7fc8f0", suit2: "#d8f4ff", accent: "#ffffff", trim: "#ffffff", boots: "#7fc8f0", gloves: "#a9e4ff", belt: "#7fc8f0", mask: "#a9e4ff", eye: "#ffffff", glow: "#bff0ff", coat: "#e0452a" },
    psylocke: { skin: "#f2c7a8", hair: "#5b2bb0", suit: "#2a3ec2", suit2: "#6b2fc0", accent: "#d4202a", trim: "#d4202a", boots: "#2a3ec2", gloves: "#2a3ec2", belt: "#d4202a", mask: "#1a1a1a", eye: "#6a3ad0", glow: "#ff4fe0", coat: "#1a1a1a" },
    jubilee: { skin: "#f2cfa6", hair: "#151515", suit: "#d2337a", suit2: "#3a6ee0", accent: "#ff5a9a", trim: "#e0a91a", boots: "#2a2a2a", gloves: "#e8e8e8", belt: "#3a6ee0", mask: "#ff5a9a", eye: "#3a2a1a", coat: "#ffcf26", coatIn: "#e0a91a", glow: "#ff7ad9" },
    professorx: { skin: "#f1c7a5", hair: "#f1c7a5", suit: "#2b3a5a", suit2: "#e8e8ef", accent: "#6b1a2a", trim: "#c9a227", boots: "#1a1a1a", gloves: "#f1c7a5", belt: "#1a1a1a", mask: "#2b3a5a", eye: "#3a5a8a", chair: "#d8b13a", chair2: "#5a6070", glow: "#7fd0ff", coat: "#e8ecf4" },
  };

  const BASE_FLAGS = {
    cyclops: { cowl: true, straps: true, belt: true },
    wolverine: { cowl: true, fins: true, belt: true, claws: true },
    storm: { cape: true, tiara: true, belt: true, longHair: true },
    jean: { longHair: true, belt: true, sash: false },
    beast: { fur: true, shorts: true, belt: true },
    gambit: { coat: true, headpiece: true, staff: true },
    nightcrawler: { tail: true, ears: true, belt: false },
    colossus: { steel: true, sleeveless: true, belt: true },
    iceman: { iceForm: true, belt: false },
    psylocke: { sash: true, longHair: true },
    jubilee: { coat: true, glasses: true, belt: true },
    professorx: { chair: true, tie: true },
  };

  // [name, palette changes, flag changes]
  const O = (name, pal, flags) => ({ name, pal: pal || {}, flags: flags || {} });

  const DESIGNS = {
    cyclops: [
      O("X-Team Classic"),
      O("Silver Age Cadet", { suit: "#2349b8", suit2: "#f0c63a", mask: "#f0c63a", gloves: "#f0c63a", boots: "#f0c63a" }, { trunks: true, straps: false }),
      O("Strike Team Tactical", { suit: "#2a2f3a", suit2: "#3b4352", accent: "#2f6fe0", gloves: "#1a1d24", boots: "#1a1d24", belt: "#2f6fe0" }, { tactical: true, cowl: false }),
      O("Night Ops", { suit: "#111522", suit2: "#1b2133", accent: "#2a3350", gloves: "#0c0f18", boots: "#0c0f18", mask: "#111522", belt: "#1b2133" }, { stealth: true }),
      O("Optic Assault Armor", { suit: "#1d348a", trim: "#b8c2d6", accent: "#e0b020" }, { armor: true }),
      O("Crimson Leader", { suit: "#8a1c22", suit2: "#4a0f12", mask: "#4a0f12", boots: "#4a0f12" }),
      O("Battle-Worn Blue", { suit: "#24439f", suit2: "#18296b" }, { damaged: true }),
      O("Arctic Recon", { suit: "#e8eef6", suit2: "#9fb3c8", accent: "#2a4fc4", coat: "#cfd9e6", boots: "#5a6a80", gloves: "#5a6a80" }, { jacket: true, scarf: true, cowl: false }),
      O("Legendary Commander", { suit: "#0f1f5c", suit2: "#0a1440", accent: "#ffd54a", trim: "#ffd54a", gloves: "#ffd54a", cape: "#0a1440" }, { aura: true, cape: true }),
      O("Prism Ultimate", { suit: "#141414", suit2: "#2a2a2a", accent: "#ff2a2a", mask: "#141414", gloves: "#ff2a2a", glow: "#ff4040" }, { ultimate: true }),
    ],
    wolverine: [
      O("Classic Yellow & Blue"),
      O("Brown Bruiser", { suit: "#a06a2c", suit2: "#4a2e17", accent: "#4a2e17", mask: "#a06a2c", gloves: "#4a2e17", boots: "#4a2e17", belt: "#4a2e17" }, { trunks: true }),
      O("Wilderness Tracker", { suit: "#3c4a3a", suit2: "#2a3328", coat: "#4b3621", boots: "#2b2016", gloves: "#2b2016", belt: "#3a2a1a" }, { jacket: true, tactical: true, cowl: false, fins: false }),
      O("Shadow Claw", { suit: "#151515", suit2: "#262626", accent: "#262626", mask: "#151515", fin: "#3a3a3a", gloves: "#0c0c0c", boots: "#0c0c0c", glow: "#c8d8ff" }, { stealth: true }),
      O("Adamantium Plate", { suit: "#d0a12a", suit2: "#273a7a", trim: "#c9ced6" }, { armor: true }),
      O("Patch Grey", { suit: "#666d78", suit2: "#2f333a", accent: "#2f333a", mask: "#666d78", gloves: "#2f333a", boots: "#2f333a" }),
      O("Healing Scars", { suit: "#d8ab28", suit2: "#1a3888" }, { damaged: true }),
      O("Weapon Program Escapee", { suit: "#4a4e55", suit2: "#33363c", boots: "#33363c", belt: "#33363c" }, { sleeveless: true, cowl: false, fins: false, harness: true }),
      O("Legendary Ronin", { suit: "#1a1a1a", suit2: "#8a1a1a", accent: "#d4af37", mask: "#1a1a1a", fin: "#8a1a1a", gloves: "#8a1a1a", boots: "#8a1a1a" }, { aura: true, scarf: true }),
      O("Berserker Ultimate", { suit: "#2a0a0a", suit2: "#5a1010", accent: "#ff3a1a", mask: "#2a0a0a", fin: "#ff3a1a", glow: "#ff5a2a" }, { ultimate: true }),
    ],
    storm: [
      O("Weather Goddess"),
      O("Wind Rider Retro", { suit: "#f2f2f5", suit2: "#dcdce6", cape: "#f2f2f5", capeIn: "#c9a227", boots: "#f2f2f5", gloves: "#f2f2f5" }, { trunks: false }),
      O("Desert Tactical", { suit: "#6e5a3a", suit2: "#4a3c26", boots: "#3a2e1c", gloves: "#3a2e1c" }, { tactical: true, cape: false }),
      O("Midnight Tempest", { suit: "#0d0d14", suit2: "#16161f", cape: "#0d0d14", capeIn: "#1d2a40", glow: "#7fd4ff" }, { stealth: true }),
      O("Storm Armor", { suit: "#22232c", trim: "#c9ccd8", accent: "#c9ccd8" }, { armor: true }),
      O("Sapphire Skies", { suit: "#1d3f8a", suit2: "#16306b", cape: "#1d3f8a", capeIn: "#e6c35c", boots: "#1d3f8a", gloves: "#1d3f8a" }),
      O("Eye of the Hurricane", {}, { damaged: true }),
      O("Street Rebel", { suit: "#1a1a1a", coat: "#121212", boots: "#121212" }, { mohawk: true, cape: false, jacket: true, longHair: false, tiara: false }),
      O("Legendary Sky Queen", { suit: "#f4f4f8", suit2: "#e0e0ea", cape: "#f4f4f8", capeIn: "#e0b84a", accent: "#e0b84a", boots: "#e0b84a" }, { aura: true }),
      O("Lightning Incarnate", { suit: "#0b1030", suit2: "#121a44", cape: "#0b1030", capeIn: "#3a8aff", glow: "#9fe6ff" }, { ultimate: true }),
    ],
    jean: [
      O("Telepath Green"),
      O("Founding Class", { suit: "#2449a8", suit2: "#f0c63a" }, { trunks: true }),
      O("Tactical Telepath", { suit: "#2d2f36", suit2: "#3fc07a", accent: "#3fc07a", boots: "#1c1e23", gloves: "#1c1e23" }, { tactical: true }),
      O("Psi-Shadow", { suit: "#0e1712", suit2: "#14241b", accent: "#1d3a28", boots: "#0b120e", gloves: "#0b120e", glow: "#5dff9a" }, { stealth: true }),
      O("Telekinetic Armor", { trim: "#d8dde6" }, { armor: true }),
      O("Midnight Blue", { suit: "#1e2f6e", suit2: "#e0b840" }),
      O("Survivor", {}, { damaged: true }),
      O("Cosmic Explorer", { suit: "#e8ecf4", suit2: "#2a9a52", accent: "#2a9a52", boots: "#9aa6b8", gloves: "#9aa6b8" }, { spaceSuit: true }),
      O("Phoenix Rising", { suit: "#d42a1c", suit2: "#f2c230", accent: "#f2c230", boots: "#f2c230", gloves: "#f2c230" }, { aura: true, sash: true, phoenix: true }),
      O("White Phoenix", { suit: "#f8f6f0", suit2: "#f5c542", accent: "#f5c542", boots: "#f5c542", gloves: "#f5c542", glow: "#ffd86b" }, { ultimate: true, sash: true, phoenix: true }),
    ],
    beast: [
      O("Blue Fur Classic"),
      O("Original Recruit", { skin: "#f0c49c", hair: "#5a3a1a", suit: "#2449a8", suit2: "#f2c230", boots: "#f2c230", gloves: "#f2c230" }, { fur: false, shorts: false, trunks: true }),
      O("Field Medic Tactical", { suit: "#3a4a3a", suit2: "#2c382c" }, { tactical: true, vest: true }),
      O("Midnight Prowler", { skin: "#1b2560", hair: "#121a48", suit: "#0e0e14", glow: "#6fb8ff" }, { stealth: true }),
      O("Gorilla Plate Armor", { trim: "#b8c0cc" }, { armor: true }),
      O("Silverback Grey", { skin: "#8d93a6", hair: "#6a7084" }),
      O("Brawler's Scars", {}, { damaged: true }),
      O("Professor McCoy", { coat: "#f4f4f4", suit: "#3a3a4a" }, { labcoat: true, glasses: true }),
      O("Legendary Feral King", { skin: "#1f2d8f", hair: "#16206a", suit: "#3a0f0f", accent: "#e3b341", belt: "#e3b341" }, { aura: true }),
      O("Primal Ultimate", { skin: "#30107a", hair: "#200a55", suit: "#0a0614", glow: "#b48cff" }, { ultimate: true }),
    ],
    gambit: [
      O("Cajun Classic"),
      O("Thieves' Guild", { coat: "#3c2a1a", coatIn: "#2a1c10", suit2: "#6a2a7a", mask: "#6a2a7a" }, { trunks: true }),
      O("Bayou Tactical", { coat: "#3c3a30", suit: "#2a2c26", suit2: "#4a4c40", mask: "#2a2c26" }, { coat: false, jacket: true, tactical: true }),
      O("Midnight Hustler", { coat: "#111114", coatIn: "#2a0a1a", suit: "#0c0c10", suit2: "#1c1c24", mask: "#1c1c24", glow: "#ff4fb3" }, { stealth: true }),
      O("Kinetic Plate", { suit2: "#8a8f9a", trim: "#c4c9d2" }, { armor: true }),
      O("Royal Flush", { coat: "#5a0f2a", coatIn: "#3a0818", suit2: "#e0b840", mask: "#e0b840" }),
      O("Busted Flush", {}, { damaged: true }),
      O("Casino Night", { coat: "#1a1a1a", coatIn: "#8a0f1a", suit: "#1a1a1a", suit2: "#f2f2f2", boots: "#111", gloves: "#111" }, { headpiece: false, tie: true }),
      O("Legendary King of Hearts", { coat: "#7a0f1a", coatIn: "#4a0810", accent: "#d4af37", suit2: "#d4af37", mask: "#7a0f1a" }, { aura: true }),
      O("Ace of Ultimates", { coat: "#160a1a", coatIn: "#3a0a3a", suit: "#0a0a0f", suit2: "#ff3fd0", mask: "#3a0a3a", glow: "#ff3fd0" }, { ultimate: true }),
    ],
    nightcrawler: [
      O("Circus Classic"),
      O("Big Top Retro", { suit: "#b51e2e", suit2: "#f2c230", accent: "#f2c230" }, { trunks: true }),
      O("Swashbuckler", { suit: "#2a2a35", suit2: "#5a1a1a", accent: "#c0262c" }, { tactical: true, scarf: true }),
      O("Shadow Bamf", { suit: "#090910", suit2: "#14141c", gloves: "#2a2a35", boots: "#2a2a35", glow: "#ff3b3b" }, { stealth: true }),
      O("Acrobat Plate", { trim: "#b8bfcb" }, { armor: true }),
      O("Royal Purple", { suit: "#3a1a5a", suit2: "#f2c230", accent: "#f2c230" }),
      O("Torn Circus Tights", {}, { damaged: true }),
      O("Pilgrim's Robe", { coat: "#151515", suit2: "#2a2a2a" }, { robe: true }),
      O("Legendary Pirate Prince", { suit: "#5a0f0f", suit2: "#d4af37", accent: "#d4af37" }, { aura: true, scarf: true }),
      O("Brimstone Ultimate", { suit: "#1a0606", suit2: "#ff5a1a", skin: "#1a2260", glow: "#ff5a1a" }, { ultimate: true }),
    ],
    colossus: [
      O("Red & Gold Steel"),
      O("First Class Steel", { suit: "#c4161c", suit2: "#1d1d1d", accent: "#1d1d1d", boots: "#1d1d1d" }, { trunks: true }),
      O("Siberian Tactical", { suit: "#3a4535", suit2: "#2a3326", boots: "#1e241a", belt: "#2a3326" }, { tactical: true, sleeveless: false }),
      O("Dark Steel", { skin: "#4a4f58", suit: "#121214", suit2: "#1e1e22", boots: "#121214", glow: "#59c3ff" }, { stealth: true }),
      O("Heavy Armor", { trim: "#8a919c" }, { armor: true, sleeveless: false }),
      O("Blue Steel", { suit: "#1f3f9e", suit2: "#c4c9d4", accent: "#c4c9d4", boots: "#1f3f9e" }),
      O("Dented Steel", {}, { damaged: true }),
      O("Artist's Smock", { coat: "#e8e2d2", suit: "#6a5a4a", suit2: "#4a3a2a" }, { smock: true }),
      O("Legendary Golden Titan", { skin: "#e6c36a", suit: "#7a0f12", suit2: "#c9a227", accent: "#c9a227" }, { aura: true }),
      O("Living Diamond", { skin: "#bfefff", suit: "#1a2a4a", suit2: "#9ff0ff", glow: "#9ff0ff" }, { ultimate: true }),
    ],
    iceman: [
      O("Ice Form"),
      O("Snowman Retro", { skin: "#f4f8fb", hair: "#ffffff", eye: "#1a1a1a" }, { snowman: true, iceForm: false }),
      O("Cold Front Tactical", { suit: "#2b3a4a", suit2: "#1e2a36", boots: "#1e2a36", belt: "#1e2a36", gloves: "#a9e4ff" }, { tactical: true, suitOver: true }),
      O("Black Ice", { skin: "#2a4a6a", hair: "#3a6a8a", suit: "#1a2a3a", glow: "#7fe0ff" }, { stealth: true }),
      O("Glacier Armor", { trim: "#e8fbff" }, { armor: true }),
      O("Arctic Teal", { skin: "#7ff0d8", hair: "#c8fff2" }),
      O("Cracked Ice", {}, { damaged: true }),
      O("Ski Patrol", { coat: "#e0452a", suit: "#2a3a4a", boots: "#2a3a4a" }, { jacket: true, goggles: true, scarf: true }),
      O("Legendary Frost King", { skin: "#d6f6ff", hair: "#ffffff", accent: "#e0f8ff", trim: "#bfe8ff" }, { aura: true, crown: true }),
      O("Omega Frost", { skin: "#e8ffff", hair: "#ffffff", glow: "#9fffff" }, { ultimate: true }),
    ],
    psylocke: [
      O("Psi-Ninja Classic"),
      O("Lionheart Retro", { suit: "#e8e8e8", suit2: "#1f2a6b", accent: "#c4161c", boots: "#1f2a6b", gloves: "#1f2a6b" }, { trunks: true, sash: false }),
      O("Covert Tactical", { suit: "#22262e", suit2: "#6b2fc0", accent: "#6b2fc0", boots: "#16191f", gloves: "#16191f" }, { tactical: true }),
      O("Shadow Blade", { suit: "#0d0a14", suit2: "#1a1428", accent: "#2a1a3a", boots: "#0d0a14", gloves: "#0d0a14", glow: "#d03fff" }, { stealth: true }),
      O("Crimson Armor", { suit: "#5a0f1a", suit2: "#3a0a12", trim: "#c4c9d2" }, { armor: true }),
      O("Violet Storm", { suit: "#5b1a9a", suit2: "#3a0f6a", accent: "#f2c230", boots: "#5b1a9a", gloves: "#5b1a9a" }),
      O("Torn Silk", {}, { damaged: true }),
      O("Kunoichi Mission", { suit: "#1a1a1a", suit2: "#2a2a2a", accent: "#d4202a", mask: "#1a1a1a" }, { faceMask: true, scarf: true }),
      O("Legendary Lotus", { suit: "#f2f2f8", suit2: "#e0e0ea", accent: "#d4af37", boots: "#d4af37", gloves: "#f2f2f8" }, { aura: true }),
      O("Psionic Ultimate", { suit: "#1a0630", suit2: "#2a0a4a", accent: "#ff5af0", hair: "#ff5af0", glow: "#ff5af0" }, { ultimate: true }),
    ],
    jubilee: [
      O("Mall Rat Classic"),
      O("Retro Recruit", { suit: "#2449a8", suit2: "#f2c230", boots: "#f2c230", gloves: "#f2c230" }, { coat: false, trunks: true }),
      O("Street Tactical", { coat: "#3a4a3a", coatIn: "#2a362a", suit: "#2a2e36", suit2: "#3a4048" }, { tactical: true }),
      O("Neon Night", { coat: "#111114", coatIn: "#ff4fe0", suit: "#121212", suit2: "#1e1e24", glow: "#ff4fe0" }, { stealth: true }),
      O("Sparkplate Armor", { trim: "#d4d8e0" }, { armor: true }),
      O("Mint Splash", { coat: "#3fe0b0", coatIn: "#2ab890", suit: "#f25a9a" }),
      O("Scorched Coat", {}, { damaged: true }),
      O("Skate Rally", { coat: "#ff6a2a", suit: "#2a9ad6", suit2: "#2a2a2a" }, { coat: false, jacket: true, helmet: true }),
      O("Legendary Starburst", { coat: "#ffffff", coatIn: "#d4af37", accent: "#d4af37", suit: "#d4af37" }, { aura: true }),
      O("Supernova", { coat: "#1a0a2a", coatIn: "#ffd23f", suit: "#2a0a3a", glow: "#ffd23f" }, { ultimate: true }),
    ],
    professorx: [
      O("Headmaster's Suit"),
      O("Founding Era Tweed", { suit: "#6b5a3a", accent: "#2a4a2a", chair: "#9a9aa2", chair2: "#4a4a52" }, { tie: true }),
      O("Field Tactical", { suit: "#2a2f38", suit2: "#3a404a", chair: "#3a4048", chair2: "#22262c" }, { tactical: true, tie: false }),
      O("Astral Shadow", { suit: "#0e0e18", suit2: "#1a1a28", chair: "#202028", chair2: "#121218", glow: "#c07fff" }, { stealth: true }),
      O("Cerebro Armor", { trim: "#c8ccd6", chair: "#8a929e" }, { armor: true, helmet: true }),
      O("Royal Purple", { suit: "#3a1a5a", accent: "#c9a227", chair: "#c9a227" }),
      O("Weathered Scholar", { suit: "#3a3a44" }, { damaged: true }),
      O("Interstellar Envoy", { suit: "#e8ecf4", suit2: "#3a63c9", accent: "#3a63c9", chair: "#e8ecf4", chair2: "#3a63c9" }, { cape: true, tie: false }),
      O("Legendary Dreamer", { suit: "#f4f4f8", suit2: "#e8e8ef", accent: "#d4af37", chair: "#f2d36a" }, { aura: true }),
      O("Astral Ultimate", { suit: "#0a1a3a", suit2: "#14284a", accent: "#9fe8ff", chair: "#1a2a4a", chair2: "#0a1424", glow: "#9fe8ff" }, { ultimate: true }),
    ],
  };

  const U_ = (t, v) => ({ t, v });
  // Unlock rules for outfits 1-9 of each hero (outfit 0 is always available).
  const UNLOCKS = {
    cyclops: [U_("clvl", 3), U_("level", 2), U_("xtotal", 6), U_("boss", "apocalypse"), U_("clvl", 8), U_("combo", 30), U_("xlevels", 4), U_("clvl", 18), U_("clvl", 26)],
    wolverine: [U_("clvl", 3), U_("clears", 2), U_("kills", 150), U_("boss", "sabretooth"), U_("clvl", 8), U_("nodamage", 1), U_("xlevels", 3), U_("clvl", 18), U_("finished")],
    storm: [U_("clvl", 3), U_("level", 3), U_("xtotal", 9), U_("boss", "darkphoenix"), U_("clvl", 8), U_("stars", 3), U_("xlevels", 5), U_("clvl", 18), U_("clvl", 26)],
    jean: [U_("clvl", 3), U_("level", 4), U_("xtotal", 12), U_("boss", "sinister"), U_("clvl", 9), U_("ultmulti", 5), U_("xlevels", 4), U_("boss", "darkphoenix"), U_("finished")],
    beast: [U_("clvl", 3), U_("level", 4), U_("clears", 3), U_("boss", "sinister"), U_("clvl", 8), U_("combo", 40), U_("xlevels", 3), U_("clvl", 18), U_("clvl", 26)],
    gambit: [U_("clvl", 3), U_("clears", 2), U_("xtotal", 15), U_("boss", "mystique"), U_("clvl", 8), U_("fast", 2), U_("xlevels", 5), U_("clvl", 18), U_("clvl", 26)],
    nightcrawler: [U_("clvl", 3), U_("clears", 2), U_("xtotal", 9), U_("boss", "omegared"), U_("clvl", 8), U_("nodamage", 2), U_("xlevels", 4), U_("clvl", 18), U_("finished")],
    colossus: [U_("clvl", 3), U_("clears", 2), U_("kills", 250), U_("boss", "juggernaut"), U_("clvl", 8), U_("combo", 30), U_("xlevels", 4), U_("clvl", 20), U_("clvl", 26)],
    iceman: [U_("clvl", 3), U_("level", 2), U_("xtotal", 9), U_("boss", "omegared"), U_("clvl", 8), U_("ultmulti", 4), U_("xlevels", 3), U_("clvl", 18), U_("clvl", 26)],
    psylocke: [U_("clvl", 3), U_("clears", 2), U_("xtotal", 15), U_("boss", "deathstrike"), U_("clvl", 8), U_("combo", 50), U_("xlevels", 6), U_("clvl", 20), U_("finished")],
    jubilee: [U_("clvl", 3), U_("clears", 2), U_("xtotal", 12), U_("boss", "blob"), U_("clvl", 8), U_("stars", 4), U_("xlevels", 5), U_("clvl", 18), U_("clvl", 26)],
    professorx: [U_("clvl", 3), U_("clears", 2), U_("xtotal", 18), U_("boss", "magneto"), U_("clvl", 8), U_("ultmulti", 6), U_("xlevels", 6), U_("clvl", 20), U_("finished")],
  };

  const BOSS_NAMES = { apocalypse: "Apocalypse", sinister: "Mr. Sinister", sabretooth: "Sabretooth", juggernaut: "Juggernaut", mystique: "Mystique", darkphoenix: "Dark Phoenix", omegared: "Omega Red", blob: "Blob", deathstrike: "Lady Deathstrike", magneto: "Magneto" };

  const OUTFITS = {};
  for (const id of Object.keys(DESIGNS)) {
    OUTFITS[id] = DESIGNS[id].map((d, i) => ({
      index: i,
      name: d.name,
      category: CATEGORIES[i],
      pal: Object.assign({}, BASE[id], d.pal),
      flags: Object.assign({}, BASE_FLAGS[id], d.flags),
      unlock: i === 0 ? { t: "start" } : UNLOCKS[id][i - 1],
      rare: i >= 8,
    }));
  }

  const Outfits = {
    CATEGORIES,
    BOSS_NAMES,
    list: (charId) => OUTFITS[charId],
    get(charId, index) {
      const list = OUTFITS[charId];
      return list[index] || list[0];
    },
    current(charId) {
      return this.get(charId, XM.Save.char(charId).outfit);
    },
    isUnlocked(charId, index) {
      return XM.Save.char(charId).outfits.includes(index);
    },
    describe(u) {
      switch (u.t) {
        case "start": return "Available from the start";
        case "clvl": return `Reach hero level ${u.v}`;
        case "level": return `Clear Level ${u.v}`;
        case "clears": return `Clear ${u.v} levels as this hero`;
        case "boss": return `Defeat ${BOSS_NAMES[u.v]}`;
        case "xtotal": return `Find ${u.v} X symbols in total`;
        case "xlevels": return `Find all 3 X symbols in ${u.v} levels`;
        case "combo": return `Reach a ${u.v}-hit combo`;
        case "nodamage": return u.v === 1 ? "Clear a level without taking damage" : `Clear ${u.v} levels without taking damage`;
        case "stars": return `Earn 3 stars in ${u.v} levels`;
        case "fast": return `Beat the par time in ${u.v} levels`;
        case "ultmulti": return `Defeat ${u.v} enemies with one Ultimate`;
        case "kills": return `Defeat ${u.v} enemies`;
        case "finished": return "Complete the campaign";
      }
      return "";
    },
    // Progress toward a rule as [current, needed].
    progress(charId, u) {
      const d = XM.Save.data;
      const s = d.stats;
      const c = d.chars[charId];
      const xTotal = d.levels.reduce((n, l) => n + l.x.filter(Boolean).length, 0);
      const xLevels = d.levels.filter((l) => l.x.every(Boolean)).length;
      switch (u.t) {
        case "start": return [1, 1];
        case "clvl": return [c.level, u.v];
        case "level": return [d.levels[u.v - 1].cleared ? 1 : 0, 1];
        case "clears": return [c.played, u.v];
        case "boss": return [s.bosses.includes(u.v) ? 1 : 0, 1];
        case "xtotal": return [xTotal, u.v];
        case "xlevels": return [xLevels, u.v];
        case "combo": return [s.maxCombo, u.v];
        case "nodamage": return [s.noDamageClears, u.v];
        case "stars": return [d.levels.filter((l) => l.stars >= 3).length, u.v];
        case "fast": return [s.fastClears, u.v];
        case "ultmulti": return [s.ultMultiKill, u.v];
        case "kills": return [s.kills, u.v];
        case "finished": return [d.campaign.finished ? 1 : 0, 1];
      }
      return [0, 1];
    },
    // Unlocks every outfit whose rule is now met. Returns [{charId, index, outfit}].
    checkAll() {
      const fresh = [];
      for (const c of XM.CHARS) {
        const save = XM.Save.char(c.id);
        OUTFITS[c.id].forEach((o, i) => {
          if (save.outfits.includes(i)) return;
          const [have, need] = this.progress(c.id, o.unlock);
          if (have >= need) {
            save.outfits.push(i);
            save.newOutfits.push(i);
            fresh.push({ charId: c.id, index: i, outfit: o });
          }
        });
      }
      return fresh;
    },
    total() {
      return XM.CHARS.reduce((n, c) => n + XM.Save.char(c.id).outfits.length, 0);
    },
    equip(charId, index) {
      if (!this.isUnlocked(charId, index)) return false;
      const save = XM.Save.char(charId);
      save.outfit = index;
      save.newOutfits = save.newOutfits.filter((n) => n !== index);
      XM.Save.write();
      return true;
    },
  };

  XM.OUTFITS = OUTFITS;
  XM.Outfits = Outfits;
})(window.XM);
