/*
 * JediCustomization: the species, outfits and saber options, plus a validated
 * record of the player's choices. The art that uses these is in characters.js.
 */
(function (J) {
  const SPECIES = [
    { id: "human", name: "Human",
      skins: [["Fair", "#f0c9a8"], ["Tan", "#d9a578"], ["Bronze", "#a9754c"], ["Deep", "#6e4630"]],
      patterns: ["Short Cut", "Padawan Braid", "Long Hair", "Shaved + Beard"], hair: true },
    { id: "twilek", name: "Twi'lek",
      skins: [["Azure", "#4f93d8"], ["Jade", "#54b77e"], ["Rose", "#e07f9e"], ["Crimson", "#c6463f"]],
      patterns: ["Plain Lekku", "Striped Lekku", "Spotted Lekku"], hair: false },
    { id: "togruta", name: "Togruta",
      skins: [["Ember", "#d9632e"], ["Crimson", "#b53a2c"], ["Amber", "#e39a33"], ["Dusk", "#8f4a77"]],
      patterns: ["Blue Montrals", "White Montrals", "Dark Montrals"], hair: false },
    { id: "zabrak", name: "Zabrak",
      skins: [["Pale", "#e9c9a4"], ["Sand", "#c99a68"], ["Rust", "#b6512f"], ["Ash", "#8a8a90"]],
      patterns: ["Clean", "Tribal Lines", "Crown Tattoo"], hair: false },
    { id: "rodian", name: "Rodian",
      skins: [["Emerald", "#3fa257"], ["Teal", "#2f9b92"], ["Moss", "#7a9a3c"], ["Slate", "#58708a"]],
      patterns: ["Black Eyes", "Violet Eyes", "Amber Eyes"], hair: false },
    { id: "mirialan", name: "Mirialan",
      skins: [["Olive", "#a6b86a"], ["Sage", "#88a877"], ["Citrine", "#c9c060"], ["Fern", "#6f9a58"]],
      patterns: ["Diamond Tattoos", "Chin Lines", "Cheek Marks"], hair: true },
    { id: "nautolan", name: "Nautolan",
      skins: [["Kelp", "#3f9a68"], ["Lagoon", "#2f8aa8"], ["Coral", "#c0604e"], ["Violet", "#7a5ab0"]],
      patterns: ["Smooth Tendrils", "Banded Tendrils", "Pale Tips"], hair: false },
    { id: "keldor", name: "Kel Dor",
      skins: [["Copper", "#c87a3c"], ["Scarlet", "#b4432e"], ["Umber", "#8a5a38"], ["Gold", "#d3a03a"]],
      patterns: ["Steel Mask", "Brass Mask", "Black Mask"], hair: false },
    { id: "pantoran", name: "Pantoran",
      skins: [["Sky", "#7fb6e6"], ["Ice", "#a8d0ea"], ["Cobalt", "#5a8ad0"], ["Periwinkle", "#8f9ae0"]],
      patterns: ["Gold Chevrons", "Gold Chin Bars", "Silver Marks"], hair: true },
    { id: "miraluka", name: "Miraluka",
      skins: [["Porcelain", "#f3dcc8"], ["Honey", "#d7ab7c"], ["Umber", "#90603f"], ["Ashen", "#c8c0bc"]],
      patterns: ["Linen Wrap", "Dark Wrap", "Gold Wrap"], hair: true },
  ];

  const HAIR = [
    ["Brown", "#5b3a22"], ["Black", "#1d1a20"], ["Auburn", "#8c3b1e"], ["Blonde", "#d9b45a"],
    ["Silver", "#c6ccd6"], ["Teal", "#2f8a8e"],
  ];

  const OUTFITS = [
    { id: "padawan", name: "Padawan Tunic" },
    { id: "knight", name: "Knight Cloak" },
    { id: "consular", name: "Consular Robe" },
    { id: "guardian", name: "Guardian Armor" },
    { id: "shadow", name: "Shadow Hood" },
  ];

  const PALETTES = [
    { name: "Temple Classic", tunic: "#e4d7bd", tabard: "#b79a70", belt: "#5b3d24", pants: "#c9b693", boots: "#3b2a1c", cloak: "#6a4a2e" },
    { name: "Knight Brown", tunic: "#7a5636", tabard: "#4e3622", belt: "#2a1c10", pants: "#5f4530", boots: "#21170f", cloak: "#3a281a" },
    { name: "Midnight", tunic: "#2c3244", tabard: "#191d2b", belt: "#0c0e16", pants: "#21263a", boots: "#0b0c12", cloak: "#141826" },
    { name: "Deep Sea", tunic: "#2f6a92", tabard: "#1e4a6c", belt: "#123147", pants: "#265a7d", boots: "#0e2332", cloak: "#163a55" },
    { name: "Forest Watch", tunic: "#5f7a4a", tabard: "#3f5534", belt: "#2a3a22", pants: "#4a6039", boots: "#1e2818", cloak: "#2f4228" },
    { name: "Sand Walker", tunic: "#d6b078", tabard: "#b18348", belt: "#6b4a22", pants: "#bd965f", boots: "#54391c", cloak: "#9a7040" },
    { name: "Ivory Gold", tunic: "#f3efe4", tabard: "#d9b65c", belt: "#a07f32", pants: "#e3dccb", boots: "#6b5428", cloak: "#c9c1ab" },
    { name: "Crimson Order", tunic: "#7c2a2a", tabard: "#511a1a", belt: "#2a0e0e", pants: "#5e2020", boots: "#1f0b0b", cloak: "#3e1414" },
  ];

  const SABER_TYPES = [{ id: "single", name: "Single Blade" }, { id: "double", name: "Double Blade" }];

  class JediCustomization {
    static defaults() {
      return { name: "Jedi", species: 0, skin: 0, pattern: 1, hair: 0, outfit: 0, palette: 0, saber: "blue", saberType: "single" };
    }

    // Repairs a saved record, so an old or edited save can't crash the art code.
    static normalize(record) {
      const j = { ...JediCustomization.defaults(), ...(record || {}) };
      const within = (value, length) => (Number.isInteger(value) && value >= 0 && value < length ? value : 0);
      j.species = within(j.species, SPECIES.length);
      const species = SPECIES[j.species];
      j.skin = within(j.skin, species.skins.length);
      j.pattern = within(j.pattern, species.patterns.length);
      j.hair = within(j.hair, HAIR.length);
      j.outfit = within(j.outfit, OUTFITS.length);
      j.palette = within(j.palette, PALETTES.length);
      if (!J.Lightsaber.COLORS[j.saber]) j.saber = "blue";
      if (j.saberType !== "double") j.saberType = "single";
      j.name = JediCustomization.cleanName(j.name);
      return j;
    }

    static cleanName(name) {
      const cleaned = String(name || "").replace(/\s+/g, " ").trim().slice(0, 14);
      return cleaned || "Jedi";
    }
  }

  JediCustomization.SPECIES = SPECIES;
  JediCustomization.HAIR = HAIR;
  JediCustomization.OUTFITS = OUTFITS;
  JediCustomization.PALETTES = PALETTES;
  JediCustomization.SABER_TYPES = SABER_TYPES;

  J.JediCustomization = JediCustomization;
})(window.JEDI);
