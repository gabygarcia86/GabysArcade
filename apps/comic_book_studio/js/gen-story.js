/* Built-in story generator (offline). It mixes the user's idea with genre tables to produce a
 * structured story: { title, logline, concept, characters[], outline[], pages[{panels[{scene, caption, dialogue[], sfx}]}] }.
 * The AI service (when configured) returns the same structure, so both feed "Build pages". */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { rng } = CBS;
  const G = (CBS.gen = CBS.gen || {});

  const GENRES = {
    superhero: "Superhero", scifi: "Science fiction", fantasy: "Fantasy", mystery: "Mystery", comedy: "Comedy",
    horror: "Spooky", adventure: "Adventure", everyday: "Everyday life",
  };
  const TONES = { fun: "Fun & silly", epic: "Epic", heartfelt: "Heartfelt", spooky: "Spooky", serious: "Serious" };

  const T = {
    superhero: {
      heroA: ["Blaze", "Echo", "Pixel", "Rocket", "Sprocket", "Comet", "Zephyr", "Glimmer", "Thunder", "Quasar", "Turbo", "Volt"],
      heroB: ["Kid", "Girl", "Guardian", "Ranger", "Spark", "Fox", "Knight", "Jet", "Flash", "Wing"],
      villain: ["Doctor Dread", "the Gloom Baron", "Madame Mayhem", "Professor Paradox", "Count Clutter", "Captain Chaos", "the Static Queen", "Mister Murk"],
      place: ["Neon Harbor", "Skyline City", "Port Brightwater", "Metro Vista", "Gearford"],
      item: ["the Star Engine", "the Moon Crystal", "the city's power core", "the Hero Signal", "a stolen gravity ray"],
      power: ["super speed", "lightning hands", "flight", "force fields", "super strength", "shrinking", "ice blasts"],
      title: ["The Rise of {hero}", "{hero} vs. {villain}", "Lights Out in {place}", "{hero}: Year One", "Signal in the Sky"],
    },
    scifi: {
      heroA: ["Captain", "Pilot", "Commander", "Engineer", "Cadet", "Navigator"],
      heroB: ["Zara Vex", "Rio Starling", "Juno Park", "Milo Quill", "Ada Orbit", "Kai Nebula"],
      villain: ["the Hive Mind", "Admiral Krax", "the Rogue AI ORACLE", "the Void Swarm", "Emperor Zolt"],
      place: ["Starbase Tycho", "the planet Verdis", "the colony ship Hope", "Mars Station 9", "the Kepler Rings"],
      item: ["the last warp core", "an alien star map", "the quantum key", "a message from the future"],
      power: ["a plasma blaster", "a hacking glove", "a jetpack", "a robot companion", "a time-skip watch"],
      title: ["Beyond {place}", "{hero} and the Void", "Signal from {place}", "The {item} Job", "Starfall"],
    },
    fantasy: {
      heroA: ["Sir", "Lady", "Apprentice", "Ranger", "Young"],
      heroB: ["Elowen", "Tamsin", "Bramble", "Oren", "Lyra", "Finn"],
      villain: ["the Shadow Witch", "King Grimmold", "the Frost Wyrm", "the Hollow Knight", "Sorcerer Vex"],
      place: ["the Kingdom of Eldermoor", "Willowmere Village", "the Crystal Peaks", "the Whispering Woods"],
      item: ["the Dragon's Heart gem", "the Moonlit Sword", "the Book of Ever", "the Crown of Dawn"],
      power: ["a talking sword", "fire magic", "the speech of animals", "a cloak of shadows", "healing light"],
      title: ["The Quest for {item}", "{hero} of {place}", "Shadows over {place}", "The Last Spell"],
    },
    mystery: {
      heroA: ["Detective", "Inspector", "Agent", "Young sleuth"],
      heroB: ["Mira Holt", "Sam Archer", "Poppy Lane", "Theo Black", "Ivy Chen"],
      villain: ["the Masked Collector", "the Midnight Thief", "the mysterious Mr. X", "the Puzzle Master"],
      place: ["Foggy Hollow", "the Grand Ravenwood Hotel", "the old museum", "Lantern Street"],
      item: ["the Emerald Owl", "a coded diary", "the missing painting", "a golden key"],
      power: ["a sharp eye", "a magnifying glass", "a loyal dog", "a notebook full of clues"],
      title: ["The Case of {item}", "{hero} Investigates", "Midnight at {place}", "The Vanishing"],
    },
    comedy: {
      heroA: ["Super", "Mega", "Totally Normal", "Not-So-Secret"],
      heroB: ["Noodle", "Pickle", "Waffles", "Biscuit", "Sprinkles", "Gizmo"],
      villain: ["the Sock Goblin", "Baron Von Bedtime", "the Tickle Monster", "Lord Litterbox", "the Homework Machine"],
      place: ["Snackville", "Mrs. Pepper's classroom", "the Wobbly Town fair", "Grandma's attic"],
      item: ["the last slice of pizza", "the Golden Spatula", "the TV remote", "the world's biggest cupcake"],
      power: ["extremely loud sneezes", "talking to sandwiches", "rubber legs", "a cape that's mostly a towel"],
      title: ["{hero} Saves Lunch", "The Great {item} Heist", "Oops! {hero} Did It Again", "Chaos in {place}"],
    },
    horror: {
      heroA: ["Little", "Brave", "Night-owl"],
      heroB: ["Wren", "Casper Moss", "Edie Graves", "Milo Fright", "Luna Bell"],
      villain: ["the Thing Under the Stairs", "the Pale Lady", "the Scarecrow King", "the Shadow Choir"],
      place: ["Hollowmere Manor", "Blackwood Forest", "the abandoned carnival", "Grimsby Lighthouse"],
      item: ["a cursed music box", "a lantern that never goes out", "the old diary", "a silver key"],
      power: ["a flashlight", "a lucky charm", "seeing ghosts", "a very brave dog"],
      title: ["The Secret of {place}", "Don't Open {item}", "Night at {place}", "Whispers"],
    },
    adventure: {
      heroA: ["Captain", "Explorer", "Pilot", "Young"],
      heroB: ["Rosa Reyes", "Jack Tiller", "Nia Storm", "Leo Marsh", "Quinn Drake"],
      villain: ["Black-Hat Morgan", "the Treasure Baron", "Sly Sylvester", "the Iron Captain"],
      place: ["Skull Island", "the Lost Temple of Ix", "the Sky Desert", "the Sunken City"],
      item: ["the Map of Seven Winds", "the Jaguar Idol", "a pirate's compass", "the Sun Stone"],
      power: ["a grappling hook", "a trusty map", "a clever parrot", "a hot-air balloon"],
      title: ["Race to {place}", "{hero} and {item}", "The Lost Map", "Beyond the Horizon"],
    },
    everyday: {
      heroA: ["", "", ""],
      heroB: ["Maya", "Leo", "Priya", "Sam", "Rosie", "Eli"],
      villain: ["a bad day", "the big test", "stage fright", "the new kid's rumor", "a broken bike"],
      place: ["Maple Street", "Riverside School", "the neighborhood park", "the corner bakery"],
      item: ["the school talent show", "a lost puppy", "the science fair volcano", "the big game"],
      power: ["kindness", "a great idea", "best friends", "a never-give-up attitude"],
      title: ["{hero}'s Big Day", "The {item}", "Life on {place}", "Small Wins"],
    },
  };
  const SIDEKICKS = [
    ["Bolt", "a wisecracking robot"], ["Mittens", "a talking cat"], ["Pip", "a nervous little dragon"], ["Dot", "a genius best friend"],
    ["Rex", "a loyal dog"], ["Echo", "a holographic guide"], ["Nana Jo", "a grandma who knows too much"], ["Fizz", "a mischievous sprite"],
  ];
  const PERSONALITY = ["brave but impatient", "clever and curious", "shy but determined", "funny and loyal", "stubborn with a big heart", "cool under pressure"];

  const BEATS = {
    setup: {
      scene: ["Wide shot of {place}. Everything looks peaceful.", "{hero} at home, getting ready for the day.", "Close-up of {hero} looking out over {place}."],
      caption: ["{place}. Just another ordinary day…", "Meet {hero}.", "Nobody suspected what was about to happen."],
      lines: [["{hero}", "Another quiet day in {place}. Maybe too quiet."], ["{side}", "You say that every time, {short}."], ["{hero}", "Today feels different, {side}. I can feel it."]],
    },
    inciting: {
      scene: ["A sudden flash! {villain} appears and grabs {item}.", "Alarm lights flash as {item} goes missing.", "{villain} looms over the city with {item}."],
      caption: ["Then everything changed.", "Without warning…"],
      lines: [["{villain}", "At last! {item} is MINE!"], ["{hero}", "Not on my watch!"], ["{side}", "Uh… what's the plan?"]],
      sfx: ["KRAKOOM!", "ZZZAP!", "BOOM!", "CRASH!"],
    },
    journey: {
      scene: ["{hero} and {side} race across {place}.", "A tense chase through narrow streets.", "{hero} studies a clue by flashlight."],
      caption: ["The trail led deeper than anyone expected.", "Hours later…", "Every clue pointed to one place."],
      lines: [["{hero}", "This way! The trail goes on."], ["{side}", "Why is it always the scary way?"], ["{hero}", "Because that's where {villain} is hiding."]],
      sfx: ["WHOOSH!", "VROOM!", "ZOOM!"],
    },
    obstacle: {
      scene: ["A trap springs! {hero} is surrounded.", "{villain}'s minions block the way.", "The ground crumbles beneath {hero}'s feet."],
      caption: ["It was a trap.", "Things went from bad to worse."],
      lines: [["{villain}", "Did you really think it would be that easy?"], ["{hero}", "Actually… yes?"], ["{side}", "{short}, look out!"]],
      sfx: ["WHAM!", "THWACK!", "CLANG!"],
    },
    twist: {
      scene: ["{hero} discovers the truth about {item}.", "A shocking reveal in the shadows.", "Close-up: {hero}'s eyes go wide."],
      caption: ["But the truth was stranger than anyone imagined.", "And then… the twist."],
      lines: [["{hero}", "Wait… {item} was never the real target!"], ["{villain}", "Clever. But too late!"], ["{side}", "I did NOT see that coming."]],
    },
    climax: {
      scene: ["Big splash panel: {hero} faces {villain} head-on.", "An explosion of light as powers collide.", "{hero} leaps into action, using {power}."],
      caption: ["Everything came down to this moment.", "It was now or never."],
      lines: [["{hero}", "It ends here, {villain}!"], ["{villain}", "NOOOO!"], ["{side}", "GO, {short}!"]],
      sfx: ["KAPOW!", "BAM!", "POW!", "KABOOM!"],
    },
    resolution: {
      scene: ["{place} at sunset, safe again.", "{hero} and {side} share a laugh.", "The crowd cheers for {hero}."],
      caption: ["Peace returned to {place}… for now.", "The end?", "And that's how {hero} saved the day."],
      lines: [["{side}", "We did it!"], ["{hero}", "We did it together."], ["{side}", "So… same time tomorrow?"]],
    },
  };
  const TONE_LINES = {
    fun: [["{side}", "Can we get snacks after this?"], ["{hero}", "Note to self: never trust a talking sandwich."]],
    spooky: [["{hero}", "Did you hear that…?"], ["{side}", "I'd really like to go home now."]],
    heartfelt: [["{hero}", "I couldn't have done this without you."], ["{side}", "That's what friends are for."]],
    epic: [["{hero}", "Whatever happens… we stand together!"]],
    serious: [["{hero}", "Stay focused. Lives depend on this."]],
  };

  function fill(str, ctx) {
    return str.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] != null ? ctx[k] : m));
  }
  function cap(s) { s = String(s || "").trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; }

  function beatPlan(pages) {
    const order = ["setup", "inciting", "journey", "obstacle", "twist", "climax", "resolution"];
    if (pages <= 1) return [["setup", "inciting", "climax", "resolution"]];
    const plan = [];
    for (let i = 0; i < pages; i++) {
      const t = i / (pages - 1);
      if (i === 0) plan.push(["setup", "inciting"]);
      else if (i === pages - 1) plan.push(pages > 2 ? ["climax", "resolution"] : ["climax", "resolution"]);
      else if (t < 0.4) plan.push(["journey", "obstacle"]);
      else if (t < 0.7) plan.push(["obstacle", "twist"]);
      else plan.push(["twist", "climax"]);
    }
    void order;
    return plan;
  }

  function story(opts = {}) {
    const genre = T[opts.genre] ? opts.genre : "superhero";
    const tbl = T[genre];
    const seed = opts.seed || Date.now();
    const R = rng(String(seed) + (opts.idea || ""));
    const pick = (a) => a[Math.floor(R() * a.length)];
    const idea = String(opts.idea || "").trim();
    const named = idea.match(/(?:[Nn]amed|[Cc]alled)\s+([A-Z][\w'-]*(?:\s[A-Z][\w'-]*)?)/);
    let hero = named ? cap(named[1]) : (pick(tbl.heroA) + " " + pick(tbl.heroB)).trim();
    if (opts.hero) hero = opts.hero;
    const short = hero.split(" ").pop();
    const [sideName, sideDesc] = pick(SIDEKICKS);
    const villain = opts.villain || pick(tbl.villain);
    const ctx = { hero, short, side: sideName, villain: cap(villain), place: pick(tbl.place), item: pick(tbl.item), power: pick(tbl.power) };
    // Let the idea override the place or item when it names one.
    const placeM = idea.match(/\b(?:in|on|at)\s+(?:the\s+)?([A-Z][\w-]*(?:\s[A-Z][\w-]*)*)/);
    if (placeM) ctx.place = placeM[1];
    const pages = CBS.clamp(parseInt(opts.pages, 10) || 4, 1, 24);
    const tone = TONES[opts.tone] ? opts.tone : "fun";

    const title = fill(pick(tbl.title), ctx);
    const logline = idea
      ? `${cap(idea.replace(/[.!?]+$/, ""))}. When ${ctx.villain.replace(/^the /, "the ")} goes after ${ctx.item}, ${hero} must use ${ctx.power} to save ${ctx.place}.`
      : `When ${ctx.villain} goes after ${ctx.item}, ${hero} must use ${ctx.power} to save ${ctx.place}.`;
    const concept = [
      `${GENRES[genre]} · ${TONES[tone]} · ${pages} page${pages === 1 ? "" : "s"}`,
      ``,
      `${title}`,
      ``,
      logline,
      ``,
      `${hero} is ${pick(PERSONALITY)}. With ${sideName}, ${sideDesc}, by their side, they face ${ctx.villain} in ${ctx.place}. ` +
      `The story builds from an ordinary day to a big showdown, with a twist about ${ctx.item} along the way.`,
    ].join("\n");

    const characters = [
      { name: hero, role: "Hero", look: `${pick(["red", "blue", "purple", "green", "gold"])} outfit, ${pick(["a flowing cape", "goggles", "a long scarf", "a backpack full of gadgets", "a lucky bracelet"])}`, personality: pick(PERSONALITY), power: ctx.power },
      { name: sideName, role: "Sidekick", look: sideDesc, personality: pick(["chatty", "nervous", "brilliant", "goofy", "loyal"]), power: pick(["comic relief", "gadgets", "a great nose for trouble", "knowing every shortcut"]) },
      { name: cap(villain), role: "Villain", look: pick(["a long dark coat", "a glowing mask", "a towering suit of armor", "a cape full of shadows"]), personality: pick(["dramatic", "cold and clever", "grumpy", "sneaky"]), power: pick(["mind control", "an army of minions", "shadow magic", "giant robots"]) },
    ];

    const plan = beatPlan(pages);
    const outline = [];
    const outPages = plan.map((beats, pi) => {
      const panels = [];
      beats.forEach((beat) => {
        const B = BEATS[beat];
        const n = beat === "climax" ? 2 : 2;
        for (let k = 0; k < n; k++) {
          const lines = [];
          const pool = B.lines.slice();
          if (R() < 0.35 && TONE_LINES[tone]) pool.push(...TONE_LINES[tone]);
          const count = k === 0 ? 1 : 1 + (R() < 0.5 ? 1 : 0);
          for (let i = 0; i < count && pool.length; i++) {
            const [sp, tx] = pool.splice(Math.floor(R() * pool.length), 1)[0];
            const speaker = fill(sp, ctx);
            lines.push({ speaker, text: fill(tx, ctx), type: tx.endsWith("!") && R() < 0.4 ? "shout" : /…\?|\.\.\.|hear that/.test(tx) ? "whisper" : "speech" });
          }
          panels.push({
            scene: fill(pick(B.scene), ctx),
            caption: k === 0 && R() < 0.75 ? fill(pick(B.caption), ctx) : "",
            dialogue: lines,
            sfx: B.sfx && R() < 0.65 ? pick(B.sfx) : "",
            beat,
          });
        }
      });
      outline.push(`Page ${pi + 1}: ${beats.map((b) => b[0].toUpperCase() + b.slice(1)).join(" → ")}. ${panels[0].scene}`);
      return { number: pi + 1, panels };
    });

    return { title, logline, concept, genre, tone, characters, outline, pages: outPages, source: "offline" };
  }

  /* Plain-text views of a story for the assistant's output box. */
  function storyText(s, section) {
    const L = [];
    const dlg = (p) => p.dialogue.map((d) => `   ${d.speaker.toUpperCase()}${d.type && d.type !== "speech" ? ` (${d.type})` : ""}: ${d.text}`);
    switch (section) {
      case "concept": return s.concept || `${s.title}\n\n${s.logline}`;
      case "characters":
        return s.characters.map((c) => `${c.name} · ${c.role}\n   Look: ${c.look}\n   Personality: ${c.personality}\n   Power / skill: ${c.power}`).join("\n\n");
      case "outline": return `${s.title}\n\n` + s.outline.join("\n");
      case "dialogue":
        s.pages.forEach((pg) => { L.push(`PAGE ${pg.number}`); pg.panels.forEach((p, i) => { L.push(` Panel ${i + 1}`); L.push(...dlg(p)); }); L.push(""); });
        return L.join("\n");
      case "narration":
        s.pages.forEach((pg) => pg.panels.forEach((p, i) => { if (p.caption) L.push(`Page ${pg.number}, panel ${i + 1}: ${p.caption}`); }));
        return L.join("\n") || "No narration captions in this version. Try Regenerate.";
      case "scenes":
        s.pages.forEach((pg) => pg.panels.forEach((p, i) => L.push(`Page ${pg.number}, panel ${i + 1}: ${p.scene}`)));
        return L.join("\n");
      default:
        L.push(s.title.toUpperCase(), s.logline, "");
        s.pages.forEach((pg) => {
          L.push(`PAGE ${pg.number}`);
          pg.panels.forEach((p, i) => {
            L.push(` Panel ${i + 1}: ${p.scene}`);
            if (p.caption) L.push(`   CAPTION: ${p.caption}`);
            L.push(...dlg(p));
            if (p.sfx) L.push(`   SFX: ${p.sfx}`);
          });
          L.push("");
        });
        return L.join("\n");
    }
  }

  Object.assign(G, { GENRES, TONES, story, storyText });
})();
