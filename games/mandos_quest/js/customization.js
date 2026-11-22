/* The Mandalorian's look: validation, unlock rules and editing. */
(function (MQ) {
  const D = MQ.DATA;
  const HEX = /^#[0-9a-f]{6}$/i;
  const PLATES = ["chest", "shoulders", "gauntlets", "legs"];

  // Each tab of the customization screen.
  const SLOTS = [
    { id: "sets", name: "Armor Sets" },
    { id: "helmet", name: "Helmet", list: "HELMETS" },
    { id: "chest", name: "Chest", list: "SETS" },
    { id: "shoulders", name: "Shoulders", list: "SETS" },
    { id: "gauntlets", name: "Gauntlets", list: "SETS" },
    { id: "legs", name: "Legs", list: "SETS" },
    { id: "cape", name: "Cape", list: "CAPES" },
    { id: "jetpack", name: "Jetpack", list: "PACKS" },
  ];

  function lookFromSet(set, previous) {
    const look = {
      set: set.id,
      visor: previous?.visor || D.VISORS[0].hex,
      helmet: {
        style: set.helmet,
        color: set.color,
        paint: previous?.helmet.paint || "solid",
        accent: set.trim,
      },
      cape: { style: set.cape, color: set.cloth },
      jetpack: { style: set.pack, color: set.color },
    };
    for (const slot of PLATES) look[slot] = { style: set.id, color: set.color };
    return look;
  }

  class Customization {
    constructor(saveManager) {
      this.saveManager = saveManager;
      this.load();
    }

    get completed() {
      return this.saveManager.data.completed;
    }

    unlocked(item) {
      return this.completed >= item.after;
    }

    load() {
      const raw = this.saveManager.data.look;
      const look = lookFromSet(D.SETS[0]);
      const valid = (list, id, fallback) => {
        const item = list.find((entry) => entry.id === id);
        return item && this.unlocked(item) ? id : fallback;
      };
      const color = (value, fallback) => (HEX.test(value) ? value : fallback);

      if (raw) {
        look.set = valid(D.SETS, raw.set, look.set);
        look.visor = color(raw.visor, look.visor);
        for (const slot of SLOTS) {
          if (!slot.list) continue;
          const target = look[slot.id];
          target.style = valid(D[slot.list], raw[slot.id]?.style, target.style);
          target.color = color(raw[slot.id]?.color, target.color);
        }
        look.helmet.paint = valid(D.PAINTS, raw.helmet?.paint, look.helmet.paint);
        look.helmet.accent = color(raw.helmet?.accent, look.helmet.accent);
      }
      this.look = look;
      this.saveManager.data.look = look;
    }

    commit() {
      this.saveManager.data.look = this.look;
      this.saveManager.write();
    }

    applySet(id) {
      const set = D.set(id);
      if (!this.unlocked(set)) return;
      this.look = lookFromSet(set, this.look);
      this.commit();
    }

    setStyle(slotId, id) {
      const slot = SLOTS.find((s) => s.id === slotId);
      const item = slot?.list && D[slot.list].find((entry) => entry.id === id);
      if (!item || !this.unlocked(item)) return;
      this.look[slotId].style = id;
      this.commit();
    }

    setColor(slotId, hex, field = "color") {
      if (!HEX.test(hex)) return;
      if (slotId === "all") {
        for (const slot of ["helmet", "jetpack", ...PLATES]) this.look[slot].color = hex;
      } else if (slotId === "visor") {
        this.look.visor = hex;
      } else {
        this.look[slotId][field] = hex;
      }
      this.commit();
    }

    setPaint(id) {
      const paint = D.PAINTS.find((entry) => entry.id === id);
      if (!paint || !this.unlocked(paint)) return;
      this.look.helmet.paint = id;
      this.commit();
    }
  }

  Customization.SLOTS = SLOTS;
  Customization.fromSet = (id) => lookFromSet(D.set(id));
  MQ.Customization = Customization;
})(window.MQ);
