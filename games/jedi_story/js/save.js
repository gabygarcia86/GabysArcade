/*
 * SaveManager keeps everything in one localStorage record. If storage is blocked
 * (private windows, cleared data) the game still runs, it just won't remember.
 */
(function (J) {
  const KEY = "jediStory.save.v1";

  const defaults = () => ({
    version: 1,
    jedi: null, // Filled in by JediCustomization.
    unlockedLevel: 0, // Highest level index the player can start.
    completed: {}, // levelIndex -> { score, time, enemies, crystals, holocrons, totalHolocrons }
    abilities: [],
    seenOpening: false,
    campaignDone: false,
    options: {
      music: 0.6,
      sfx: 0.8,
      shake: true,
      touch: "auto", // auto | on | off
      difficulty: "knight", // padawan | knight | master
      quality: "high", // high | low
    },
  });

  class SaveManager {
    constructor() {
      this.data = defaults();
      this.load();
    }

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const base = defaults();
        this.data = { ...base, ...parsed, options: { ...base.options, ...(parsed.options || {}) } };
      } catch (error) {
        console.warn("Jedi Story: could not read the save, starting fresh.", error);
      }
    }

    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (error) {
        // Storage is blocked or full. Progress lasts for this session only.
      }
    }

    get options() { return this.data.options; }

    setOption(key, value) {
      this.data.options[key] = value;
      this.save();
    }

    setJedi(jedi) {
      this.data.jedi = jedi;
      this.save();
    }

    isUnlocked(index) { return index <= this.data.unlockedLevel; }
    isCompleted(index) { return !!this.data.completed[index]; }

    unlockAbilities(ids) {
      let changed = false;
      for (const id of ids) {
        if (!this.data.abilities.includes(id)) {
          this.data.abilities.push(id);
          changed = true;
        }
      }
      if (changed) this.save();
      return changed;
    }

    hasAbility(id) { return this.data.abilities.includes(id); }

    // Replays keep the best score, and never move campaign progress backwards.
    completeLevel(index, stats, levelCount) {
      const previous = this.data.completed[index];
      const best = !previous || stats.score >= previous.score;
      this.data.completed[index] = best ? stats : {
        ...previous,
        holocrons: Math.max(previous.holocrons, stats.holocrons),
      };
      if (previous && best) this.data.completed[index].holocrons = Math.max(previous.holocrons, stats.holocrons);
      this.data.unlockedLevel = Math.max(this.data.unlockedLevel, Math.min(index + 1, levelCount - 1));
      if (index === levelCount - 1) this.data.campaignDone = true;
      this.save();
    }

    // Keeps the Jedi and options, and wipes the campaign.
    resetCampaign() {
      const { jedi, options } = this.data;
      this.data = { ...defaults(), jedi, options };
      this.save();
    }

    resetAll() {
      const { options } = this.data;
      this.data = { ...defaults(), options };
      this.save();
    }
  }

  J.SaveManager = SaveManager;
})(window.JEDI);
