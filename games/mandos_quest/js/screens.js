/* Markup for every menu screen. UIManager shows them and handles their buttons. */
(function (MQ) {
  const D = MQ.DATA;
  const { escapeHtml: esc, formatTime } = MQ.U;

  // Where each planet sits on the galaxy map, in percent.
  // Three rows in a winding route.
  const MAP_POINTS = [
    [10, 15], [30, 15], [50, 15], [70, 15], [90, 15],
    [84, 46], [62, 46], [39, 46], [16, 46],
    [12, 77], [37, 77], [62, 77], [88, 77],
  ];
  const PLANET_COLORS = ["#d99a62", "#a4644f", "#c4562c", "#8f3a24", "#5f8a4a", "#e6c48a", "#4f7a6c", "#1f5f5a", "#3fb8c9", "#c8d8e2", "#6f7cc9", "#4a2a68", "#9a5cc9"];

  const button = (action, label, options = {}) => {
    const { id, kind = "", disabled = false } = options;
    return `<button class="btn ${kind}" type="button" data-action-ui="${action}"${id === undefined ? "" : ` data-id="${esc(id)}"`}${disabled ? " disabled" : ""}>${label}</button>`;
  };

  const header = (title, detail = "") => `
    <header class="screen-head">
      <button class="btn ghost" type="button" data-action-ui="back">&#8592; Back</button>
      <h1>${title}</h1>
      <p>${detail}</p>
    </header>`;

  const puckDots = (owned) =>
    `<span class="pucks" aria-label="${owned.filter(Boolean).length} of 3 Bounty Pucks">${owned.map((on) => `<i class="${on ? "on" : ""}"></i>`).join("")}</span>`;

  const stat = (label, value) => `<div class="stat"><dt>${label}</dt><dd>${value}</dd></div>`;

  const progress = (value, label) => `
    <div class="progress" role="progressbar" aria-label="${label}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100">
      <span style="width:${value}%"></span>
    </div>`;

  function bossLabel(level) {
    if (!level.boss) return "No boss";
    return `${level.boss}${level.miniBoss ? " (mini-boss)" : ""}`;
  }

  function swatches(slot, current, completed, field = "color") {
    const colors = D.COLORS.map((color) => {
      const locked = completed < color.after;
      const title = locked ? `${color.name}: clear Level ${color.after}` : color.name;
      return `<button class="swatch" type="button" style="--c:${color.hex}" data-action-ui="color" data-id="${color.hex}"
        data-slot="${slot}" data-field="${field}" title="${title}" aria-label="${title}"
        aria-pressed="${color.hex === current}" ${locked ? "disabled" : ""}></button>`;
    }).join("");
    const pickerLocked = completed < D.CUSTOM_COLOR_AFTER;
    return `
      <div class="swatches">
        ${colors}
        <label class="picker ${pickerLocked ? "is-locked" : ""}">
          <input type="color" value="${esc(current || "#aeb9c4")}" data-color-slot="${slot}" data-field="${field}" ${pickerLocked ? "disabled" : ""}
            aria-label="Custom color">
          <span>${pickerLocked ? `Custom: Level ${D.CUSTOM_COLOR_AFTER}` : "Custom color"}</span>
        </label>
      </div>`;
  }

  function choices(list, current, action, completed) {
    return `
      <div class="choices">
        ${list.map((item) => {
          const locked = completed < item.after;
          return `<button class="choice" type="button" data-action-ui="${action}" data-id="${item.id}"
            aria-pressed="${item.id === current}" ${locked ? "disabled" : ""}>
            <span>${item.name}</span>${locked ? `<small>Clear Level ${item.after}</small>` : ""}
          </button>`;
        }).join("")}
      </div>`;
  }

  function customizeBody(app, tab) {
    const { completed } = app.save;
    const { look } = app.customization;

    if (tab === "sets") {
      return `
        <h2>Armor sets</h2>
        <p class="muted">A set dresses every slot. You can then mix parts in the other tabs.</p>
        ${choices(D.SETS, look.set, "set", completed)}
        <h2>Paint all armor</h2>
        ${swatches("all", look.chest.color, completed)}`;
    }

    const slot = MQ.Customization.SLOTS.find((s) => s.id === tab);
    let html = `
      <h2>${slot.name} style</h2>
      ${choices(D[slot.list], look[tab].style, "style", completed)}
      <h2>${slot.name} color</h2>
      ${swatches(tab, look[tab].color, completed)}`;

    if (tab === "helmet") {
      html += `
        <h2>Paint scheme</h2>
        ${choices(D.PAINTS, look.helmet.paint, "paint", completed)}
        <h2>Paint scheme color</h2>
        ${swatches("helmet", look.helmet.accent, completed, "accent")}
        <h2>Visor</h2>
        <div class="swatches">
          ${D.VISORS.map((v) => `<button class="swatch" type="button" style="--c:${v.hex}" data-action-ui="color" data-id="${v.hex}"
            data-slot="visor" data-field="color" title="${v.name}" aria-label="${v.name} visor" aria-pressed="${v.hex === look.visor}"></button>`).join("")}
        </div>`;
    } else if (tab === "jetpack" && !app.progression.stats.jetpack) {
      html += `<p class="muted">The jetpack appears in gameplay once you clear Level 6.</p>`;
    }
    return html;
  }

  function scoreForm(entry, label = "Submit score") {
    if (!entry || entry.score < 1) return `<p class="muted">Score some points to enter the leaderboard.</p>`;
    return `
      <form class="score-form" data-score-form>
        <p class="score-line">Campaign score <strong>${entry.score.toLocaleString()}</strong></p>
        <div class="score-row">
          <input name="nickname" type="text" maxlength="${MQ.Leaderboard.NAME_MAX}" autocomplete="off" spellcheck="false"
            placeholder="Your name" aria-label="Name for the leaderboard" value="${esc(MQ.Leaderboard.loadName())}">
          <button class="btn primary" type="submit">${label}</button>
        </div>
        <p class="form-status" role="status"></p>
      </form>`;
  }

  function boardBody(board) {
    if (board.state === "loading") return `<p class="board-message" role="status">Contacting the HoloNet&hellip;</p>`;
    if (board.state === "error") {
      return `<div class="board-message" role="alert"><p>${esc(board.message)}</p>${button("reloadBoard", "Try again")}</div>`;
    }
    if (!board.rows.length) return `<p class="board-message">No scores yet. Be the first hunter on the board.</p>`;

    let highlighted = false;
    return `
      <table class="board">
        <thead><tr><th>#</th><th>Hunter</th><th>Score</th><th>Worlds</th><th>Pucks</th></tr></thead>
        <tbody>
          ${board.rows.map((row, i) => {
            const mine = !highlighted && board.mine && row.name === board.mine.name && row.score === board.mine.score;
            if (mine) highlighted = true;
            return `<tr class="${mine ? "mine" : ""} rank-${i + 1}">
              <td>${i + 1}</td>
              <td>${esc(row.name)}${row.finished ? ' <span class="crown" title="Finished Story Mode">&#9733;</span>' : ""}</td>
              <td>${row.score.toLocaleString()}</td>
              <td>${row.levels}/${D.TOTAL_GROUND}</td>
              <td>${row.pucks}/30</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      <p class="muted center">&#9733; Finished Story Mode</p>`;
  }

  const SCREENS = {
    main(app) {
      const { save, progression } = app;
      return `
        <section class="screen main-menu">
          <a class="arcade-link" href="../../index.html">&#8592; Gaby&rsquo;s Arcade</a>
          <div class="menu-column">
            <h1 class="logo"><span>Mando&rsquo;s</span><strong>Quest</strong><em>The Last Star Map</em></h1>
            <nav class="menu-list" aria-label="Main menu">
              ${button("story", `Story Mode <small>${save.completed ? (progression.allCleared ? "Completed" : `Continue: Level ${progression.nextLevel()}`) : "New adventure"}</small>`, { kind: "primary wide" })}
              ${button("open", "Level Select", { id: "map" })}
              ${button("open", "Customize Character", { id: "customize" })}
              ${button("open", "Weapons", { id: "weapons" })}
              ${button("open", `Bounty Pucks <small>${progression.totalPucks()}/30</small>`, { id: "pucks" })}
              ${button("open", `Leaderboard${save.pendingScore ? " <small>Score to submit</small>" : ""}`, { id: "leaderboard" })}
              ${button("open", "Options", { id: "options" })}
              ${button("open", "Credits", { id: "credits", kind: "full-row" })}
            </nav>
            ${app.saveManager.available ? "" : `<p class="warning">This browser is blocking storage, so progress can't be saved.</p>`}
          </div>
        </section>`;
    },

    map(app, data) {
      const { save, progression } = app;
      const selected = MQ.LEVELS[data.selected - 1];
      const open = progression.isUnlocked(selected.id);
      const done = save.cleared[selected.id - 1];
      const space = selected.mode === "space";
      const best = save.best[selected.id - 1];

      const nodes = MQ.LEVELS.map((level, i) => {
        const unlocked = progression.isUnlocked(level.id);
        const status = save.cleared[i] ? "done" : unlocked ? "open" : "locked";
        const battle = level.mode === "space";
        return `<button class="planet ${status} ${battle ? "space" : level.boss ? "has-boss" : ""}" type="button" data-action-ui="selectLevel" data-id="${level.id}"
          aria-pressed="${level.id === selected.id}" style="--x:${MAP_POINTS[i][0]}%;--y:${MAP_POINTS[i][1]}%;--c:${PLANET_COLORS[i]}">
          <i class="orb">${status === "locked" ? "&#128274;" : level.id}</i>
          <span class="planet-name"><b>${battle ? "Space Battle" : level.planet}</b>${level.title}</span>
          ${battle ? "" : puckDots(save.pucks[i])}
          <span class="sr-only">${status === "done" ? "Completed" : status === "open" ? "Available" : "Locked"}</span>
        </button>`;
      }).join("");

      return `
        <section class="screen panel-screen map-screen">
          ${header("Galaxy Map", `${progression.clearedCount}/${D.TOTAL_LEVELS} levels &middot; ${progression.totalPucks()}/30 pucks &middot; ${progression.percent()}% complete`)}
          <div class="map-layout">
            <div class="galaxy" data-scroll="galaxy">
              <svg class="routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline points="${MAP_POINTS.map((p) => p.join(",")).join(" ")}" />
              </svg>
              ${nodes}
            </div>
            <aside class="level-card">
              <p class="eyebrow">Level ${selected.id} of ${D.TOTAL_LEVELS} &middot; ${space ? "Space Battle" : selected.planet}</p>
              <h2>${selected.title}</h2>
              <p class="muted">${selected.theme}</p>
              <dl class="stats">
                ${stat("Status", done ? "Completed" : open ? "Available" : "Locked")}
                ${stat("Boss", bossLabel(selected))}
                ${space
                  ? stat("Reward", D.REWARDS[selected.id - 1][0].split(/ for the |:/)[0])
                  : stat("Bounty Pucks", `${puckDots(save.pucks[selected.id - 1])} ${progression.levelPucks(selected.id)}/3`)}
                ${stat("Best time", formatTime(best.time))}
                ${stat("Best score", best.score ? best.score.toLocaleString() : "--")}
              </dl>
              ${button("play", open ? `${done ? "Replay" : "Start"} ${space ? "mission" : "level"}` : `Clear Level ${selected.id - 1} to unlock`, { id: selected.id, kind: "primary wide", disabled: !open })}
            </aside>
          </div>
        </section>`;
    },

    customize(app, data) {
      return `
        <section class="screen panel-screen">
          ${header("Customize Character", "Changes save automatically")}
          <div class="customize">
            <div class="preview">
              <canvas data-preview="look" width="360" height="430" aria-label="Preview of your Mandalorian"></canvas>
              <p class="muted center">Drag to turn</p>
            </div>
            <div class="editor">
              <div class="tabs" role="tablist" data-scroll="tabs">
                ${MQ.Customization.SLOTS.map((slot) => `<button class="tab" type="button" role="tab" data-action-ui="tab" data-id="${slot.id}" aria-selected="${slot.id === data.tab}">${slot.name}</button>`).join("")}
              </div>
              <div class="editor-body" data-scroll="editor-${data.tab}">${customizeBody(app, data.tab)}</div>
            </div>
          </div>
        </section>`;
    },

    weapons(app) {
      const { save, progression } = app;
      const cards = D.WEAPONS.map((weapon) => {
        const unlocked = progression.hasWeapon(weapon.id);
        const equipped = save.weapon === weapon.id;
        const requirement = weapon.secret
          ? `Clear all 10 worlds and find all 30 pucks (${progression.groundCleared}/10, ${progression.totalPucks()}/30)`
          : `Clear Level ${weapon.after}`;
        const notes = [];
        if (weapon.id === "blaster" && progression.stats.fastBlaster) notes.push("Faster firing");
        if (weapon.id === "blaster" && progression.stats.twinBlaster) notes.push("Twin bolts");
        if (weapon.ammo) notes.push(`${Math.round(weapon.ammo * progression.stats.ammo)} shots`);
        return `
          <article class="weapon ${unlocked ? "" : "is-locked"} ${equipped ? "is-equipped" : ""} ${weapon.secret ? "is-secret" : ""}">
            <canvas data-preview="weapon" data-id="${weapon.id}" width="220" height="110" aria-hidden="true"></canvas>
            <h2>${weapon.name}</h2>
            <p>${weapon.info}</p>
            <p class="muted">Damage ${Math.round(weapon.damage * progression.stats.damage)}${notes.length ? ` &middot; ${notes.join(" &middot; ")}` : ""}</p>
            ${weapon.secret && unlocked ? `
              <div class="swatches" aria-label="Darksaber color">
                ${D.SABERS.map((s) => `<button class="swatch" type="button" data-action-ui="saber" data-id="${s.id}" title="${s.name}" aria-label="${s.name}"
                  style="--c:${s.id === "classic" ? "linear-gradient(135deg,#000 50%,#fff 50%)" : s.glow}" aria-pressed="${save.saberColor === s.id}"></button>`).join("")}
              </div>` : ""}
            ${unlocked
              ? button("equip", equipped ? "Equipped" : "Equip", { id: weapon.id, kind: equipped ? "selected" : "" })
              : `<p class="lock-note">${requirement}</p>`}
          </article>`;
      }).join("");

      const upgrades = (list) => list.map((u) => `
        <li class="${save.completed >= u.after ? "on" : ""}"><b>${u.name}</b><span>${save.completed >= u.after ? (u.info || "Installed") : `Clear Level ${u.after}`}</span></li>`).join("");

      return `
        <section class="screen panel-screen">
          ${header("Weapons", `Player Level ${save.playerLevel}`)}
          <div class="scroll" data-scroll="weapons">
            <div class="weapon-grid">${cards}</div>
            <div class="upgrade-columns">
              <div><h2>Baby G&rsquo;s Force</h2><ul class="upgrades">${upgrades(D.FORCE_UPGRADES)}</ul></div>
              <div><h2>Jetpack</h2><ul class="upgrades">${upgrades(D.JETPACK_UPGRADES)}</ul></div>
              <div><h2>Gunship</h2><ul class="upgrades">${D.SPACE_STAGES.map((id) => {
                const on = save.cleared[id - 1];
                // Collectibles are on the Bounty Pucks screen.
                return D.REWARDS[id - 1]
                  .filter((reward) => !/collectible|Citadel/.test(reward))
                  .map((reward) => `<li class="${on ? "on" : ""}"><b>${reward.replace(" for the gunship", "")}</b><span>${on ? "Installed" : `Clear Level ${id}`}</span></li>`)
                  .join("");
              }).join("")}</ul></div>
            </div>
          </div>
        </section>`;
    },

    pucks(app) {
      const { save, progression } = app;
      const total = progression.totalPucks();
      return `
        <section class="screen panel-screen">
          ${header("Bounty Pucks", `${total} of 30 collected`)}
          <div class="scroll" data-scroll="pucks">
            <div class="secret-card ${save.darksaber ? "on" : ""}">
              <canvas data-preview="saber" width="300" height="120" aria-hidden="true"></canvas>
              <div>
                <p class="eyebrow">Secret weapon</p>
                <h2>${save.darksaber ? "The Darksaber is yours" : "The Darksaber"}</h2>
                <p>${progression.groundCleared}/10 worlds completed</p>${progress(progression.groundCleared * 10, "Worlds completed")}
                <p>${total}/30 pucks collected</p>${progress(Math.round((total / 30) * 100), "Pucks collected")}
              </div>
            </div>
            <ul class="puck-list">
              ${MQ.LEVELS.filter((level) => level.mode !== "space").map((level) => `
                <li class="${progression.isUnlocked(level.id) ? "" : "is-locked"}">
                  <span><b>${level.id}. ${level.title}</b><small>${level.planet}</small></span>
                  ${puckDots(save.pucks[level.id - 1])}
                  ${button("play", progression.isUnlocked(level.id) ? "Play" : "Locked", { id: level.id, kind: "small", disabled: !progression.isUnlocked(level.id) || app.inLevel })}
                </li>`).join("")}
            </ul>
            <p class="muted center">Some pucks need upgrades from later levels, so come back with new gear.</p>
            <h2 class="relic-heading">Space mission collectibles</h2>
            <ul class="relics">
              ${D.RELICS.map((relic) => {
                const owned = save.relics.includes(relic.id);
                return `<li class="${owned ? "on" : ""}">
                  <canvas data-preview="relic" data-id="${relic.id}" width="84" height="84" aria-hidden="true"></canvas>
                  <span><b>${relic.name}</b><small>${owned ? relic.info : `Clear Level ${relic.after}`}</small></span>
                </li>`;
              }).join("")}
            </ul>
          </div>
        </section>`;
    },

    options(app) {
      const s = app.save.settings;
      const slider = (key, label) => `
        <label class="option"><span>${label}</span>
          <input type="range" min="0" max="100" value="${Math.round(s[key] * 100)}" data-volume="${key}"></label>`;
      const toggle = (key, label) => `
        <label class="option"><span>${label}</span>
          <input class="switch" type="checkbox" data-setting="${key}" ${s[key] ? "checked" : ""}></label>`;
      const select = (key, label, options) => `
        <label class="option"><span>${label}</span>
          <select data-setting="${key}">${options.map(([value, name]) => `<option value="${value}" ${s[key] === value ? "selected" : ""}>${name}</option>`).join("")}</select></label>`;

      return `
        <section class="screen panel-screen">
          ${header("Options")}
          <div class="scroll options" data-scroll="options">
            <div class="option-group">
              <h2>Audio</h2>
              ${slider("master", "Master volume")}${slider("music", "Music")}${slider("sfx", "Sound effects")}${toggle("muted", "Mute everything")}
            </div>
            <div class="option-group">
              <h2>Gameplay</h2>
              ${select("difficulty", "Difficulty", [["story", "Story: less damage, 75% score"], ["standard", "Standard"], ["veteran", "Veteran: more damage, 125% score"]])}
              ${app.inLevel ? `<p class="muted">Difficulty changes apply from the next level you start.</p>` : ""}
              ${toggle("aimAssist", "Aim assist")}${toggle("hints", "Tutorial hints")}
            </div>
            <div class="option-group">
              <h2>Display and controls</h2>
              ${select("effects", "Visual effects", [["high", "High"], ["low", "Low: faster"]])}
              ${toggle("shake", "Screen shake")}
              ${select("touch", "Touch controls", [["auto", "Automatic"], ["on", "Always show"], ["off", "Always hide"]])}
              ${app.canFullscreen ? button("fullscreen", "Toggle fullscreen") : ""}
            </div>
            <div class="option-group">
              <h2>Ground controls</h2>
              <dl class="keys">
                ${[["Move", "A / D or &#8592; / &#8594;"], ["Jump / Jetpack", "Space"], ["Attack", "J"], ["Force Push", "K"], ["Change weapon", "L"], ["Dodge", "Shift or double-tap a direction"], ["Drop through ledge", "S or &#8595;"], ["Pause", "Escape"]].map(([a, b]) => stat(a, b)).join("")}
              </dl>
            </div>
            <div class="option-group">
              <h2>Space controls</h2>
              <dl class="keys">
                ${[["Fly", "WASD or arrow keys"], ["Fire", "J (hold)"], ["Seeker rockets", "K"], ["Install upgrade", "L"], ["Shield", "Shift"], ["Pause", "Escape"]].map(([a, b]) => stat(a, b)).join("")}
              </dl>
            </div>
            ${app.inLevel ? "" : `<div class="option-group danger-zone"><h2>Saved progress</h2>${button("reset", "Reset all progress", { kind: "danger" })}</div>`}
          </div>
        </section>`;
    },

    credits(app, data) {
      return `
        <section class="screen credits">
          <div class="credits-window">
            <div class="credits-roll ${data.ending ? "is-ending" : ""}">
              <h1 class="logo"><span>Mando&rsquo;s</span><strong>Quest</strong><em>The Last Star Map</em></h1>
              <h2>A game from</h2><p>Gaby&rsquo;s Arcade</p>
              <h2>Starring</h2><p>The Mandalorian</p><p>Baby G</p><p>and Moff Gideon</p>
              <h2>Featuring</h2><p>The Mudhorn</p><p>The Nevarro Reptavians</p><p>The Krayt Dragon</p><p>The Mythosaur</p><p>The Imperial Guardian</p><p>The Warden Gunship</p><p>The Orbital Bastion</p><p>Gideon&rsquo;s Command Ship</p>
              <h2>Worlds and space battles</h2>${MQ.LEVELS.map((level) => `<p>${level.planet}: ${level.title}</p>`).join("")}
              <h2>Story, levels, art, animation and code</h2><p>Gaby&rsquo;s Arcade, built with Claude</p>
              <h2>Music and sound</h2><p>Generated live with the Web Audio API</p>
              <h2>Typeface</h2><p>Oxanium, under the SIL Open Font License</p>
              <h2>About this game</h2>
              <p class="legal">An unofficial, non-commercial fan game with an original story, art and audio. Not affiliated with or endorsed by Lucasfilm or Disney. Star Wars, The Mandalorian and related names are trademarks of their owners.</p>
              <h2 class="thanks">Thanks for playing</h2>
            </div>
          </div>
          <div class="credits-actions">${data.ending ? button("afterCredits", "Continue", { kind: "primary" }) : button("back", "Back")}</div>
        </section>`;
    },

    leaderboard(app, data) {
      const pending = app.state === "menu" && app.save.pendingScore;
      return `
        <section class="screen panel-screen narrow">
          ${header("Leaderboard", "Top 10 campaign scores")}
          <div class="scroll" data-scroll="board">
            ${pending ? scoreForm(pending, "Submit finished run") : ""}
            <div data-board>${boardBody(data.board || { state: "loading" })}</div>
          </div>
        </section>`;
    },

    story(app) {
      const finished = app.progression.allCleared;
      const canReplay = app.save.completed > 0 && !finished;
      const next = MQ.LEVELS[app.progression.nextLevel() - 1];
      return `
        <section class="screen dialog-screen">
          <div class="dialog">
            <p class="eyebrow">Story Mode</p>
            <h1>${finished ? "The journey continues" : "Continue your journey"}</h1>
            <p>${finished ? "Play the story again with every weapon, upgrade and collectible you've earned." : `Next up: Level ${next.id}, ${next.title}${next.mode === "space" ? " (space battle)" : ""}.`}</p>
            <div class="button-stack">
              ${button("storyContinue", finished ? "Play from Level 1" : `Continue Level ${next.id}`, { kind: "primary wide" })}
              ${canReplay ? button("storyStart", "Replay from Level 1") : ""}
              ${button("back", "Cancel", { kind: canReplay ? "ghost" : "ghost wide" })}
              ${button("reset", "Reset all progress", { kind: "danger wide" })}
            </div>
          </div>
        </section>`;
    },

    pause(app) {
      const { world, progression } = app;
      const space = world.mode === "space";
      return `
        <section class="screen dialog-screen">
          <div class="dialog">
            <p class="eyebrow">Level ${world.def.id} &middot; ${space ? esc(world.def.title) : `${progression.levelPucks(world.def.id)}/3 pucks`}</p>
            <h1>Paused</h1>
            <div class="button-stack">
              ${button("resume", "Resume", { kind: "primary wide" })}
              ${button("restart", space ? "Restart Mission" : "Restart Level")}
              ${space ? "" : button("open", "Weapon Selection", { id: "weapons" })}
              ${space ? "" : button("open", "Character Customization", { id: "customize" })}
              ${button("open", "Options", { id: "options" })}
              ${button("quit", "Main Menu", { kind: "ghost" })}
            </div>
          </div>
        </section>`;
    },

    complete(app, data) {
      const { result } = data;
      const added = (pattern) => result.rewards.filter((r) => pattern.test(r));
      const weapons = added(/Pistol|Vibroblade|Whistling|Rifle|Heavy Blaster|Flamethrower|Rockets/);
      const upgrades = result.rewards.filter((r) => !weapons.includes(r));
      return `
        <section class="screen panel-screen narrow result">
          <div class="scroll" data-scroll="complete">
            <p class="eyebrow center">Level ${result.level.id} &middot; ${result.level.planet}</p>
            <h1 class="center">Level Completed</h1>
            <p class="conclusion">${result.level.conclusion}</p>
            <dl class="stats result-stats">
              ${stat("Time taken", `${formatTime(Math.max(1, result.time))}${result.newBestTime ? ' <em class="best">Best</em>' : ""}`)}
              ${stat("Enemies defeated", result.kills)}
              ${stat("Bounty Pucks", `${puckDots(app.save.pucks[result.level.id - 1])} ${result.pucks}/3`)}
              ${stat("Score", result.score.toLocaleString())}
              ${stat("Experience", `+${result.xp.toLocaleString()} XP`)}
              ${stat("New weapons", weapons.length ? weapons.join(", ") : "None")}
              ${stat("New upgrades", upgrades.length ? upgrades.join(", ") : "None")}
            </dl>
            <p class="completion">Overall completion <strong>${app.progression.percent()}%</strong></p>
            ${progress(app.progression.percent(), "Overall completion")}
            <div class="button-row">
              ${button("afterComplete", "Continue", { kind: "primary" })}
            </div>
          </div>
        </section>`;
    },

    spaceComplete(app, data) {
      const { result } = data;
      const { level } = result;
      return `
        <section class="screen panel-screen narrow result mission-result" style="--accent:${level.accent}">
          <div class="scroll" data-scroll="complete">
            <p class="eyebrow center">Level ${level.id} &middot; Space Battle</p>
            <h1 class="center">${level.victory}</h1>
            <canvas class="mission-art" data-preview="mission" data-id="${level.id}" width="760" height="190" aria-hidden="true"></canvas>
            <p class="conclusion">${level.conclusion}</p>
            <dl class="stats result-stats mission-stats">
              ${stat("Mission time", `${formatTime(Math.max(1, result.time))}${result.newBestTime ? ' <em class="best">Best</em>' : ""}`)}
              ${stat("Ships destroyed", result.kills)}
              ${stat("Capsules collected", result.capsules)}
              ${stat("Upgrades installed", result.upgrades)}
              ${stat("Lives remaining", `${result.lives}/${D.LIVES}`)}
              ${stat("Score", result.score.toLocaleString())}
              ${stat("Experience", `+${result.xp.toLocaleString()} XP`)}
              ${stat("Mission rewards", result.rewards.length ? result.rewards.join(", ") : "Already earned")}
            </dl>
            <p class="completion">Overall completion <strong>${app.progression.percent()}%</strong></p>
            ${progress(app.progression.percent(), "Overall completion")}
            <div class="button-row">
              ${button("afterComplete", "Continue", { kind: "primary" })}
            </div>
          </div>
        </section>`;
    },

    levelUp(app, data) {
      const { result } = data;
      const { stats } = app.progression;
      const space = result.level.mode === "space";
      const last = result.finale;
      return `
        <section class="screen panel-screen narrow result levelup">
          <div class="scroll" data-scroll="levelup">
            <p class="eyebrow center">${last && result.first ? "Story Mode completed" : "Progression"}</p>
            <h1 class="center">${result.playerLevel > result.oldPlayerLevel ? "Level Up!" : "Rewards"}</h1>
            <p class="level-change">${result.playerLevel > result.oldPlayerLevel ? `${result.oldPlayerLevel} <span>&#8594;</span> ` : ""}${result.playerLevel}</p>
            <ul class="rewards">
              ${result.rewards.map((reward, i) => `<li style="--i:${i}">${reward}</li>`).join("")}
              ${result.saberUnlocked ? `<li class="secret" style="--i:${result.rewards.length}">Secret weapon unlocked: the Darksaber</li>` : ""}
            </ul>
            <dl class="stats">
              ${space ? `
                ${stat("Ship health", stats.ship.maxHp)}
                ${stat("Ship speed", stats.ship.speed)}
                ${stat("Energy Shield", stats.ship.shield)}
                ${stat("Configuration", stats.ship.vanguard ? "Vanguard" : "Standard")}` : `
                ${stat("Maximum health", `${stats.maxHp}${result.hpGain > 0 ? ` <em class="best">+${result.hpGain}</em>` : ""}`)}
                ${stat("Weapon damage", `${Math.round(stats.damage * 100)}%`)}
                ${stat("Damage taken", `${Math.round(stats.armor * 100)}%`)}`}
            </dl>
            <div class="button-row">
              ${last || space ? "" : button("resultCustomize", "Customize")}
              ${button("afterRewards", last ? "Roll Credits" : result.level.id === 6 && result.first && app.progression.nextLevel() === 7 ? "Start Jetpack Tutorial" : "Next Level", { kind: "primary" })}
              ${last ? "" : button("toMenu", "Main Menu", { kind: "ghost" })}
            </div>
          </div>
        </section>`;
    },

    gameOver(app, data) {
      return `
        <section class="screen dialog-screen game-over">
          <div class="dialog">
            <p class="eyebrow">Level ${data.level.id} &middot; ${data.level.title}</p>
            <h1>Game Over</h1>
            ${data.submitted ? `<p class="success">Your score is on the HoloNet.</p>` : scoreForm(data.entry)}
            <div class="button-row">
              ${button("retry", data.level.mode === "space" ? "Retry Mission" : "Retry Level", { kind: "primary" })}
              ${button("open", "Leaderboard", { id: "leaderboard" })}
              ${button("toMenu", "Main Menu", { kind: "ghost" })}
            </div>
          </div>
        </section>`;
    },

    finalScore(app, data) {
      return `
        <section class="screen dialog-screen">
          <div class="dialog">
            <p class="eyebrow">Story Mode completed</p>
            <h1>Mando&rsquo;s Quest</h1>
            <p>The galaxy is safe. Put your name among its greatest hunters.</p>
            <p class="muted">${app.progression.percent()}% complete${app.save.darksaber ? " &middot; Darksaber unlocked" : " &middot; Find all 30 pucks to earn the Darksaber"}</p>
            ${data.submitted ? `<p class="success">Your score is on the HoloNet.</p>` : scoreForm(app.save.pendingScore)}
            <div class="button-row">
              ${button("open", "View Leaderboard", { id: "leaderboard", kind: data.submitted ? "primary" : "" })}
              ${button("toMenu", "Main Menu", { kind: "ghost" })}
            </div>
          </div>
        </section>`;
    },

    confirm(app, data) {
      return `
        <section class="screen dialog-screen">
          <div class="dialog" role="alertdialog" aria-labelledby="confirm-title">
            <h1 id="confirm-title">${data.title}</h1>
            <p>${data.message}</p>
            <div class="button-row">
              ${button("back", "Cancel")}
              ${button("confirm", data.label, { kind: "danger" })}
            </div>
          </div>
        </section>`;
    },
  };

  MQ.Screens = SCREENS;
  MQ.boardBody = boardBody;
})(window.MQ);
