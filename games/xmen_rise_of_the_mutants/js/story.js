/*
 * Story: an original campaign about the Mutant Nexus, told in comic-book panels.
 * An opening, an intro and an ending for each of the 20 levels, the finale, credits
 * and a post-credits tease. "@hero" lines are spoken by whichever X-Man the player chose.
 */
(function (XM) {
  "use strict";
  const A = XM.Art;
  const U = XM.U;

  const N = (text) => ["narr", text];

  const OPENING = [
    { bg: 7, fx: "meteors", lines: [N("Six weeks ago, a storm of light crossed the sky. No telescope saw it coming."), N("Thousands of glowing shards fell to Earth. Scientists called them meteorites. Cerebro called them something else.")] },
    { bg: 0, fx: "cerebro", lines: [["professorx", "Every shard hums with the same energy. It wakes dormant powers, and it twists the powers already awake."], ["professorx", "I am naming it the Mutant Nexus. And someone is gathering the pieces faster than we can find them."]] },
    { bg: 16, fx: "team", lines: [["cyclops", "Mutants are turning on each other across three continents, Professor. This isn't random."], ["professorx", "No, Scott. Someone is pulling strings. X-Men, it is time to find out who."], N("X-MEN: RISE OF THE MUTANTS")] },
  ];

  // intro/outro per level. `next` is shown on the results screen.
  const LEVEL_STORY = [
    {
      intro: [["professorx", "Cerebro is detecting Nexus surges all over Manhattan. Sentinels have been sighted near the energy."], ["cyclops", "Sentinels in the middle of New York? Somebody reprogrammed them."], ["wolverine", "And somebody's payin' Reavers to pick up the pieces. I can smell 'em from here."], ["@hero"]],
      outro: [["storm", "The Reavers escaped with a fragment, but they left this behind. A shipping crate."], ["beast", "Stamped with a lodestone emblem. An old magnet, of all things. How curious."], ["jubilee", "Hey! You guys left me with, like, fifty robots. I handled it. So... I'm on the team now, right?"], ["cyclops", "Welcome aboard, Jubilee. The crate came from a factory upstate."]],
      next: "Trace the Lodestone shipments to an abandoned factory.",
    },
    {
      intro: [["beast", "This factory was shut down a decade ago. Yet the smokestacks are breathing again."], ["cyclops", "They're building Sentinels here, and feeding them Nexus energy."], ["professorx", "Be careful. I sense a mind in there older than any I have ever touched."], ["@hero"]],
      outro: [["apocalypse", "You fight well, children. Know this: the Nexus is the seed of a new evolution."], ["apocalypse", "Others gather it for petty dreams. I will gather it to become what I was meant to be."], ["jean", "He's gone. Teleported out. But he wasn't the one who built this place."], ["professorx", "Then we keep digging. Mutants are disappearing beneath the city, in the old subway lines."]],
      next: "Investigate the missing mutants in the tunnels below Manhattan.",
    },
    {
      intro: [["storm", "Families say their children went into the tunnels and never came home."], ["professorx", "Several of the missing are mutants whose powers awoke only weeks ago, near Nexus shards."], ["nightcrawler", "Ach, finally! I have been tracking these kidnappers alone for days. Bamf, and here I am!"], ["@hero"]],
      outro: [["nightcrawler", "The cages are open. Everyone is safe, Gott sei Dank."], ["iceman", "One of the kids kept saying 'the pale doctor took the others.' Creepy."], ["nightcrawler", "I know that description. I will come with you, my friends. These people need us."], ["beast", "The trucks were heading to a genetics lab registered to a shell company."]],
      next: "Infiltrate the secret genetics laboratory.",
    },
    {
      intro: [["beast", "Gene-splicing arrays, cloning vats, Nexus containment. This is a monster's laboratory."], ["jean", "The captives' minds are here. Frightened, and... copied?"], ["sinister", "Welcome, welcome! You've saved me the trouble of collecting you."], ["@hero"]],
      outro: [["sinister", "Kill me if you like. This body is only one of many."], ["beast", "His records show payments from the same Lodestone company. Sinister is a customer, not the leader."], ["cyclops", "And a Nexus fragment the size of a car was found in the South American jungle last week."]],
      next: "Protect the research teams in the jungle.",
    },
    {
      intro: [["storm", "Three research camps destroyed. The survivors speak of a beast with a man's laugh."], ["wolverine", "Sabretooth. I'd know that stink anywhere."], ["gambit", "Ah, you X-Men finally showed up. Gambit's been watchin' dis fragment for days, him."], ["@hero"]],
      outro: [["gambit", "Sabretooth was paid to guard dis rock. Same people who once tried to hire me."], ["gambit", "De Lodestone Syndicate. When I saw what dey did to mutants, I walked away. Now I'm walkin' with you."], ["professorx", "Thank you, Remy. Their next target is a crystal mine that has been amplifying mutant powers."]],
      next: "Stop the energy surges in the crystal mines.",
    },
    {
      intro: [["colossus", "I came to help the miners. The crystals began to glow, and the tunnels began to collapse."], ["beast", "Nexus energy is soaking into the crystal. Anyone touching it becomes stronger, and less stable."], ["juggernaut", "Nobody leaves these mines! Juggernaut's never felt this strong!"], ["@hero"]],
      outro: [["colossus", "The mine is stable. The workers are safe. And I will not stand aside any longer."], ["cyclops", "Glad to have you, Piotr. The amplified crystals were shipped to Europe."], ["psylocke", "I'm already there. There's a secret gathering of mutant leaders tonight. Meet me in the old city."]],
      next: "Attend the secret mutant meeting in the City of Shadows.",
    },
    {
      intro: [["psylocke", "The streets are empty. Too empty. Every face I've passed tonight felt... borrowed."], ["jean", "I can't read the crowd. Their minds keep shifting."], ["storm", "This meeting is a trap. Stay together, X-Men."], ["@hero"]],
      outro: [["mystique", "You're all pieces on someone else's board, and you don't even know whose game it is."], ["psylocke", "She's gone. But I read a fragment before she shut me out: a name she fears and serves."], ["psylocke", "The Syndicate answers to someone with very strong ties to metal. I'm coming with you."], ["professorx", "And there is no time to waste. A massive surge has appeared in orbit."]],
      next: "Investigate the orbital research station.",
    },
    {
      intro: [["jean", "I can feel it from here. Something burning. Something I've felt before, in my dreams."], ["storm", "Jean, if this is too much, we can go in without you."], ["jean", "No. If it's calling me, I need to face it."], ["@hero"]],
      outro: [["jean", "It wasn't real. The Nexus copied a cosmic fire and gave it a mind. An echo, wearing a face like mine."], ["beast", "If the Nexus can copy cosmic power, the person who controls it could become anything."], ["cyclops", "Station logs show the Syndicate is draining Nexus energy at an arctic facility."]],
      next: "Shut down the arctic extraction facility.",
    },
    {
      intro: [["iceman", "Finally, a mission in my climate! Wait, why is everything moving?"], ["wolverine", "Somethin' woke up in that ice. Somethin' that shouldn't have."], ["omegared", "Fresh life force. I have been so very cold, waiting for you."], ["@hero"]],
      outro: [["iceman", "Nobody out-cools me. Nobody."], ["beast", "The base transferred dozens of mutants to a detention facility. They call it 'The Vault.'"], ["professorx", "They are to be moved again tomorrow. We must free them tonight."]],
      next: "Break the captured mutants out of the high-security prison.",
    },
    {
      intro: [["cyclops", "Cell blocks, laser grids, guard towers. We free the prisoners before the transfer."], ["nightcrawler", "I will bamf them out as fast as you open the doors!"], ["blob", "Nobody gets past the Blob! This whole prison's my belly's business!"], ["@hero"]],
      outro: [["storm", "Every cell is empty. Every prisoner is free."], ["professorx", "I have watched from Cerebro long enough. From now on, I take the field with you."], ["cyclops", "Professor... welcome to the front line. Our next lead: a desert base extracting Nexus energy."]],
      next: "Destroy the Nexus extraction machines in the desert.",
    },
    {
      intro: [["storm", "Three extraction machines, each pulling raw Nexus energy out of the ground."], ["gambit", "Big machines, big explosions. Gambit likes dis plan."], ["professorx", "Destroy them all. Every hour they run, the energy grows more unstable."], ["@hero"]],
      outro: [["beast", "The machines are scrap. Their blueprints, however, are fascinating and horrifying."], ["beast", "A weapons program fusing Nexus-charged mutant powers with cybernetics."], ["psylocke", "The facility is underground. And I know who guards it."]],
      next: "Infiltrate the cybernetic weapons facility.",
    },
    {
      intro: [["psylocke", "Lady Deathstrike. Steel nails, steel heart. She's here."], ["wolverine", "She and me got history. Let's make it short."], ["cyclops", "Shut down the program. Recover any data about the Nexus itself."], ["@hero"]],
      outro: [["deathstrike", "This is not over. My blades will find you again."], ["beast", "Their data mentions an ancient temple where the Nexus first appeared, thousands of years ago."], ["jean", "If we understand where it came from, maybe we can understand how to stop it."]],
      next: "Search the lost temple for the origin of the Nexus.",
    },
    {
      intro: [["storm", "A temple older than any civilization I know of, hidden under the canopy."], ["professorx", "The walls are inscribed with Nexus energy. Read the tablets and they will speak."], ["@hero"]],
      outro: [["professorx", "The tablets tell it plainly. The Nexus is the shattered core of an ancient engine that once guided evolution."], ["professorx", "It fell to Earth long ago and broke apart. Now its pieces are waking up."], ["cyclops", "And whoever reassembles it controls the future of every mutant alive."], ["beast", "The tablets point to a buried city. Apocalypse's city."]],
      next: "Descend into Apocalypse's ancient city.",
    },
    {
      intro: [["apocalypse", "You read the tablets. Then you know. The Nexus belongs to me. I was its first child."], ["cyclops", "He's empowered his army with fragments. This is his endgame."], ["colossus", "Then we end it first."], ["@hero"]],
      outro: [["apocalypse", "The fragments... gone. Torn from me. Pulled through stone and steel."], ["jean", "Something ripped the Nexus shards right out of his armor. Magnetically."], ["professorx", "The Reavers have taken a whole industrial city and are broadcasting to someone. We must hear it."]],
      next: "Disable the Reaver communication network.",
    },
    {
      intro: [["cyclops", "Three comm towers. Take them down and the Reaver army goes deaf and blind."], ["jubilee", "And then there's a town full of people they don't get to attack. Let's go!"], ["@hero"]],
      outro: [["beast", "The final transmission was to a single recipient. Just a letter: 'M.'"], ["professorx", "I know that signature. I prayed I was wrong."], ["storm", "There's no time. A gateway just tore open where the towers stood. A doorway into the Nexus itself."]],
      next: "Enter the unstable Nexus Dimension.",
    },
    {
      intro: [["nightcrawler", "Up is down, down is sideways. I like it! I think."], ["jean", "Gravity shifts here. Stay alert, everyone."], ["sinister", "Ah, my favorite test subjects. I've been improving myself. Do you like it?"], ["@hero"]],
      outro: [["sinister", "You think I was the mastermind? Please. I was a paying customer."], ["sinister", "Magneto built the Syndicate. Magneto turned you against Apocalypse, against me, against everyone."], ["sinister", "And while you chased me through this dimension, he's gone to visit your home."], ["professorx", "The school! The students are alone!"]],
      next: "Defend Xavier's School.",
    },
    {
      intro: [["storm", "The mansion is burning. Reavers and mercenaries everywhere."], ["jubilee", "Those are my friends in there! Nobody touches my friends!"], ["professorx", "Find the students. Get them out. Nothing else matters."], ["@hero"]],
      outro: [["magneto", "Charles. I am sorry it came to this. Your students were never in danger from me. Only delayed."], ["magneto", "The Nexus will remake Earth's magnetic field. Every mind on Earth will feel it. Mutants will rise, and humanity will kneel."], ["professorx", "Erik... you will not do this. Not while my X-Men stand."]],
      next: "Storm Magneto's floating fortress.",
    },
    {
      intro: [["colossus", "His fortress floats above the clouds, built from a thousand ships."], ["cyclops", "Elite guards, Sentinels he stole, and something huge on the bridge. Stay sharp."], ["@hero"]],
      outro: [["beast", "His guardian is down, and the fortress is losing altitude."], ["jean", "Magneto isn't here. He's already in the Nexus core."], ["professorx", "Then we follow. Into the heart of it."]],
      next: "Reach the core of the Mutant Nexus.",
    },
    {
      intro: [["jean", "The core is screaming. If it destabilizes, it takes half the planet with it."], ["cyclops", "Shut down the nodes. Find Magneto."], ["magneto", "You came all this way to watch the new world begin? How kind."], ["@hero"]],
      outro: [["magneto", "Enough! If you will not stand aside, then I will become the Nexus."], ["storm", "He's absorbing the core. All of it!"], ["professorx", "X-Men, this is our last stand. Everything we have, everything we are."]],
      next: "Stop Magneto at the heart of the Nexus.",
    },
    {
      intro: [["magneto", "I am the Nexus now. Every magnetic line on this planet answers to me."], ["cyclops", "X-Men, together. One more time."], ["wolverine", "Been waitin' all campaign for this."], ["@hero"]],
      outro: [],
      next: "",
    },
  ];

  const FINALE = [
    { bg: 19, fx: "calm", lines: [["magneto", "Why... why does it still listen to you, Charles?"], ["professorx", "Because the Nexus was never meant to rule, Erik. It was meant to help us grow. Together."]] },
    { bg: 18, fx: "release", lines: [N("Jean and Charles reached into the heart of the Nexus and opened it."), N("The energy didn't explode. It spread across the world as a gentle light, calming every power it had twisted."), ["jean", "The fragments are fading. The surges are gone. It's over."]] },
    { bg: 16, fx: "team", lines: [["cyclops", "The school will be rebuilt. The prisoners are home. And Magneto is in custody."], ["magneto", "Your dream won today, Charles. Let us see if it survives tomorrow."], ["professorx", "It will, old friend. Because they will carry it."], N("The X-Men restored peace. For now.")] },
  ];

  const POST_CREDITS = [{ bg: 10, fx: "fragment", lines: [N("Weeks later. A desert, far from anywhere."), N("Something under the sand is still glowing."), ["apocalypse", "Every ending is merely a beginning, children. The Nexus remembers its first son."], N("TO BE CONTINUED...")] }];

  const CREDITS = [
    ["X-MEN: RISE OF THE MUTANTS", "title"],
    ["A fan-made tribute game", "sub"],
    ["", ""],
    ["Game Design, Code & Art", "head"],
    ["Built for Gaby's Arcade", ""],
    ["All art drawn in code with HTML5 Canvas", ""],
    ["All music and sound synthesized with Web Audio", ""],
    ["", ""],
    ["Starring", "head"],
    ["Cyclops • Wolverine • Storm • Jean Grey", ""],
    ["Beast • Gambit • Nightcrawler • Colossus", ""],
    ["Iceman • Psylocke • Jubilee • Professor X", ""],
    ["", ""],
    ["Villains", "head"],
    ["Apocalypse • Mr. Sinister • Sabretooth • Juggernaut • Mystique", ""],
    ["Dark Phoenix • Omega Red • Blob • Lady Deathstrike • Magneto", ""],
    ["", ""],
    ["Original story: The Mutant Nexus", "head"],
    ["", ""],
    ["X-Men and all related characters are trademarks of Marvel.", "small"],
    ["This is a non-commercial fan project and is not affiliated with or endorsed by Marvel.", "small"],
    ["", ""],
    ["Thank you for playing!", "title"],
  ];

  // Who's speaking: X-Men use hero portraits, villains use boss art.
  const VILLAIN_ART = { apocalypse: "apocalypse", sinister: "sinister", sabretooth: "sabretooth", juggernaut: "juggernaut", mystique: "mystique", darkphoenix: "phoenix", omegared: "omegared", blob: "blob", deathstrike: "deathstrike", magneto: "magneto" };
  const VILLAIN_NAMES = { apocalypse: "Apocalypse", sinister: "Mr. Sinister", sabretooth: "Sabretooth", juggernaut: "Juggernaut", mystique: "Mystique", darkphoenix: "Dark Phoenix", omegared: "Omega Red", blob: "Blob", deathstrike: "Lady Deathstrike", magneto: "Magneto" };

  // ---------- Story player (draws on the main canvas) ----------
  class StoryPlayer {
    constructor() {
      this.active = false;
    }

    // panels: [{bg, fx, lines}], opts: {title, subtitle, hero, done}
    play(panels, opts) {
      this.panels = panels;
      this.opts = opts;
      this.pi = 0;
      this.li = 0;
      this.chars = 0;
      this.t = 0;
      this.lineT = 0;
      this.active = true;
      this.titleT = opts.title ? 2.2 : 0;
      this.prepare();
    }

    prepare() {
      const p = this.panels[this.pi];
      this.bg = XM.BG.build(p.bg, XM.Save.data.settings.quality);
      this.panelT = 0;
    }

    line() {
      const p = this.panels[this.pi];
      let l = p.lines[this.li];
      if (l[0] === "@hero") {
        const c = XM.CHAR[this.opts.hero || "cyclops"];
        l = [c.id, l[1] || U.pick(c.quips)];
        p.lines[this.li] = l;
      }
      return l;
    }

    advance() {
      if (!this.active) return;
      if (this.titleT > 0.4) {
        this.titleT = 0.4;
        return;
      }
      const text = this.line()[1];
      if (this.chars < text.length) {
        this.chars = text.length;
        return;
      }
      XM.Audio.sfx("ui");
      this.li++;
      this.chars = 0;
      this.lineT = 0;
      if (this.li >= this.panels[this.pi].lines.length) {
        this.li = 0;
        this.pi++;
        if (this.pi >= this.panels.length) return this.finish();
        this.prepare();
      }
    }

    finish() {
      this.active = false;
      const done = this.opts.done;
      this.opts.done = null;
      if (done) done();
    }

    update(dt) {
      if (!this.active) return;
      this.t += dt;
      this.panelT += dt;
      if (this.titleT > 0) {
        this.titleT -= dt;
        return;
      }
      this.lineT += dt;
      const text = this.line()[1];
      if (this.chars < text.length) {
        const prev = Math.floor(this.chars);
        this.chars = Math.min(text.length, this.chars + dt * 55);
        if (Math.floor(this.chars) !== prev && Math.floor(this.chars) % 3 === 0) XM.Audio.sfx("type");
      }
    }

    draw(ctx) {
      if (!this.active) return;
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      const p = this.panels[this.pi];
      XM.BG.draw(ctx, this.bg, this.t * 30 + this.pi * 400, 0, this.t, vh);
      this.drawFx(ctx, p.fx);
      ctx.fillStyle = "rgba(6,4,14,0.35)";
      ctx.fillRect(0, 0, vw, vh);
      // Comic page frame
      ctx.strokeStyle = "#0a0610";
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, vw - 10, vh - 10);
      ctx.strokeStyle = "#f6c22b";
      ctx.lineWidth = 2;
      ctx.strokeRect(12, 12, vw - 24, vh - 24);

      if (this.titleT > 0) {
        const a = Math.min(1, this.titleT * 2);
        ctx.globalAlpha = a;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, vh / 2 - 90, vw, 180);
        A.burst(ctx, vw / 2, vh / 2 - 10, 160, 14, "#c4161c", this.t * 0.1);
        A.text(ctx, this.opts.title, vw / 2, vh / 2 - 20, 38, "#ffe14a", "center");
        if (this.opts.subtitle) A.text(ctx, this.opts.subtitle, vw / 2, vh / 2 + 28, 18, "#ffffff", "center");
        ctx.globalAlpha = 1;
        return;
      }

      if (this.opts.title) {
        A.box(ctx, 24, 24, Math.min(560, vw - 48), 44, "#f6c22b", true, 4, 3);
        A.text(ctx, this.opts.title, 38, 46, 18, "#1a0a0a", "left", false);
        if (this.opts.subtitle) A.text(ctx, this.opts.subtitle, 38, 80, 13, "#ffffff", "left");
      }

      const [who, text] = this.line();
      const shown = text.slice(0, Math.floor(this.chars));
      const boxW = Math.min(820, vw - 60);
      const boxX = (vw - boxW) / 2;
      const boxY = vh - 190;
      if (who === "narr") {
        A.box(ctx, boxX, boxY + 30, boxW, 120, "#ffe14a", true, 2, 3);
        ctx.font = '700 19px Oxanium, "Trebuchet MS", sans-serif';
        const lines = U.wrap(ctx, shown, boxW - 40);
        lines.forEach((ln, i) => A.text(ctx, ln, boxX + 20, boxY + 60 + i * 26, 19, "#1a0a0a", "left", false, 700));
      } else {
        const isHero = !!XM.CHAR[who];
        const portraitX = boxX + 70;
        const portraitY = boxY - 10;
        const size = 130;
        ctx.save();
        const bob = Math.sin(this.t * 2) * 2;
        if (isHero) {
          const look = XM.Outfits.current(who);
          XM.CharArt.portrait(ctx, who, look, portraitX, portraitY + bob, size, { box: true, t: this.t, power: this.lineT < 0.4 ? 0.5 : 0 });
        } else XM.bossPortrait(ctx, VILLAIN_ART[who] || "magneto", portraitX, portraitY + bob, size);
        ctx.restore();
        const name = isHero ? XM.CHAR[who].name : VILLAIN_NAMES[who] || who;
        A.box(ctx, portraitX - 60, portraitY + size / 2 - 6, 120, 26, isHero ? "#2a4fc4" : "#8a1a2a", true, 3, 2);
        A.text(ctx, name.toUpperCase(), portraitX, portraitY + size / 2 + 7, 13, "#ffffff", "center", false);
        // Speech bubble
        const bx = boxX + 150;
        const bw = boxW - 150;
        A.box(ctx, bx, boxY + 20, bw, 140, "#ffffff", true, 18, 3);
        A.poly(ctx, [bx + 2, boxY + 60, bx - 22, boxY + 70, bx + 2, boxY + 84], "#ffffff", false);
        ctx.strokeStyle = A.OUTLINE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx, boxY + 60);
        ctx.lineTo(bx - 22, boxY + 70);
        ctx.lineTo(bx, boxY + 84);
        ctx.stroke();
        ctx.font = '700 19px Oxanium, "Trebuchet MS", sans-serif';
        const lines = U.wrap(ctx, shown, bw - 40);
        lines.forEach((ln, i) => A.text(ctx, ln, bx + 20, boxY + 50 + i * 26, 19, "#140d1f", "left", false, 700));
      }
      if (this.chars >= text.length && Math.sin(this.t * 6) > 0) A.text(ctx, "▶", boxX + boxW - 24, vh - 34, 16, "#ffe14a", "center");
    }

    drawFx(ctx, fx) {
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      const t = this.t;
      switch (fx) {
        case "meteors":
          for (let i = 0; i < 9; i++) {
            const k = ((t * 0.4 + i * 0.13) % 1);
            const x = vw * (0.1 + ((i * 0.37) % 1) * 0.9) - k * 300;
            const y = -40 + k * (vh * 0.8);
            A.glow(ctx, x, y, 18, "#ff5aff", 0.9);
            ctx.strokeStyle = "rgba(255,150,255,0.6)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 70, y - 60);
            ctx.stroke();
          }
          break;
        case "cerebro":
          ctx.strokeStyle = "rgba(120,200,255,0.25)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.ellipse(vw / 2, vh * 0.4, 60 + i * 50 + ((t * 40) % 50), 20 + i * 18, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        case "team":
        case "calm": {
          const ids = XM.CHARS.map((c) => c.id);
          const n = ids.length;
          ids.forEach((id, i) => {
            const x = vw * 0.08 + (i * vw * 0.84) / (n - 1);
            XM.CharArt.draw(ctx, id, XM.Outfits.current(id), { state: fx === "calm" ? "idle" : "victory", t: t + i * 0.3 }, x, vh * 0.58, i < n / 2 ? 1 : -1, 1.25);
          });
          break;
        }
        case "release":
          for (let i = 0; i < 4; i++) A.glow(ctx, vw / 2, vh * 0.35, 80 + i * 60 + Math.sin(t * 2 + i) * 20, i % 2 ? "#5affff" : "#ffe9a0", 0.3);
          break;
        case "fragment":
          A.glow(ctx, vw * 0.6, vh * 0.62, 40 + Math.sin(t * 3) * 10, "#ff5aff", 0.9);
          A.poly(ctx, [vw * 0.6, vh * 0.62 - 18, vw * 0.6 + 10, vh * 0.62, vw * 0.6, vh * 0.62 + 14, vw * 0.6 - 10, vh * 0.62], "#ffd0ff", true, 2);
          break;
      }
    }
  }

  XM.STORY = { OPENING, LEVELS: LEVEL_STORY, FINALE, POST_CREDITS, CREDITS, VILLAIN_NAMES, VILLAIN_ART };
  XM.StoryPlayer = StoryPlayer;
})(window.XM);
