/*
 * Menus: every DOM screen. Each screen renders HTML into #ui, and buttons use
 * data-act attributes handled in one place. Animated hero previews are small
 * canvases redrawn every frame while visible.
 */
(function (XM) {
  "use strict";
  const U = XM.U;
  const esc = U.escape;

  const PREVIEW_STATES = [
    { state: "idle", dur: 1.6 },
    { state: "run", dur: 1.4 },
    { state: "attack", kind: "basic", dur: 0.9 },
    { state: "jump", dur: 0.7 },
    { state: "special", kind: "special", dur: 1.0 },
    { state: "ultimate", kind: "ultimate", dur: 1.2 },
    { state: "hurt", dur: 0.5 },
    { state: "victory", dur: 1.8 },
  ];
  const KIND_BY_CHAR = {
    cyclops: ["punch", "visor", "visor"],
    wolverine: ["slash", "slash", "slash"],
    storm: ["blast", "rise", "rise"],
    jean: ["blast", "wave", "rise"],
    beast: ["slash", "heavy", "slam"],
    gambit: ["throw", "throw", "throw"],
    nightcrawler: ["slash", "slash", "slash"],
    colossus: ["punch", "slam", "slam"],
    iceman: ["blast", "wave", "rise"],
    psylocke: ["slash", "throw", "spin"],
    jubilee: ["blast", "wave", "rise"],
    professorx: ["temple", "temple", "temple"],
  };

  const stars = (n) => `<span class="stars">${[0, 1, 2].map((i) => `<i class="${i < n ? "on" : ""}">★</i>`).join("")}</span>`;
  const xIcons = (arr) => `<span class="xicons">${arr.map((v) => `<i class="${v ? "on" : ""}">X</i>`).join("")}</span>`;

  class Menus {
    constructor(app) {
      this.app = app;
      this.root = document.getElementById("ui");
      this.previews = [];
      this.current = null;
      this.data = {};
      this.stack = [];
      this.t = 0;
      this.root.addEventListener("click", (e) => {
        const el = e.target.closest("[data-act]");
        if (!el && this.current === "main" && !e.target.closest("a, button, input")) return this.app.menuClick(e.clientX, e.clientY);
        if (!el || el.disabled) return;
        e.preventDefault();
        this.act(el.dataset.act, el.dataset, el);
      });
      // A pointer cursor over the heroes on the main menu.
      this.root.addEventListener("pointermove", (e) => {
        if (this.current !== "main" || e.pointerType === "touch") return;
        const over = !e.target.closest("a, button, input") && this.app.menuPoint(e.clientX, e.clientY);
        this.root.style.cursor = over ? "pointer" : "";
      });
      this.root.addEventListener("input", (e) => {
        const el = e.target;
        if (el.dataset.setting) this.app.setSetting(el.dataset.setting, el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value);
        if (el.type === "range" && el.nextElementSibling && el.nextElementSibling.tagName === "B") el.nextElementSibling.textContent = `${Math.round(Number(el.value) * 100)}%`;
      });
      this.root.addEventListener("change", (e) => {
        const el = e.target;
        if (el.dataset.setting && (el.tagName === "SELECT" || el.type === "checkbox")) this.app.setSetting(el.dataset.setting, el.type === "checkbox" ? el.checked : el.value);
      });
    }

    get visible() {
      return !this.root.hidden;
    }

    hide() {
      this.root.hidden = true;
      this.root.innerHTML = "";
      this.previews = [];
      this.current = null;
    }

    show(name, data = {}, push = true) {
      // A new lineup of heroes every time the main menu comes back.
      if (name === "main" && this.current !== "main" && this.app.antics) this.app.antics.shuffleLineup();
      if (push && this.current && this.current !== name) this.stack.push({ name: this.current, data: this.data });
      this.current = name;
      this.data = data;
      this.previews = [];
      this.root.hidden = false;
      this.root.className = `screen-${name}`;
      this.root.innerHTML = this[`render_${name}`](data);
      this.root.scrollTop = 0;
      this.bindPreviews();
      const first = this.root.querySelector("[autofocus]") || this.root.querySelector(".btn.primary") || this.root.querySelector(".btn");
      if (first && !XM.Input.usingTouch) first.focus({ preventScroll: true });
      if (this[`after_${name}`]) this[`after_${name}`](data);
    }

    refresh() {
      if (!this.current) return;
      const y = this.root.querySelector(".scroll") ? this.root.querySelector(".scroll").scrollTop : 0;
      this.show(this.current, this.data, false);
      const s = this.root.querySelector(".scroll");
      if (s) s.scrollTop = y;
    }

    back() {
      if (this.current === "pause" || this.current === "info") return this.app.resume();
      const prev = this.stack.pop();
      if (prev) this.show(prev.name, prev.data, false);
      else this.show("main", {}, false);
    }

    resetTo(name, data) {
      this.stack = [];
      this.current = null;
      this.show(name, data, false);
    }

    // ---------- previews ----------
    bindPreviews() {
      this.root.querySelectorAll("canvas[data-preview]").forEach((c) => {
        const ctx = c.getContext("2d");
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const w = c.width;
        const h = c.height;
        c.width = w * ratio;
        c.height = h * ratio;
        c.style.width = w + "px";
        c.style.height = h + "px";
        this.previews.push({ c, ctx, w, h, ratio, id: c.dataset.preview, outfit: c.dataset.outfit, mode: c.dataset.mode || "still", scale: Number(c.dataset.scale || 2), locked: c.dataset.locked === "1" });
      });
    }

    tick(dt) {
      this.t += dt;
      for (const p of this.previews) {
        const ctx = p.ctx;
        ctx.setTransform(p.ratio, 0, 0, p.ratio, 0, 0);
        ctx.clearRect(0, 0, p.w, p.h);
        const outfitIndex = p.outfit !== undefined ? Number(p.outfit) : XM.Save.char(p.id).outfit;
        const look = XM.Outfits.get(p.id, outfitIndex);
        let an;
        if (p.mode === "cycle") {
          const total = PREVIEW_STATES.reduce((n, s) => n + s.dur, 0);
          let k = this.t % total;
          let st = PREVIEW_STATES[0];
          for (const s of PREVIEW_STATES) {
            if (k < s.dur) {
              st = s;
              break;
            }
            k -= s.dur;
          }
          const kinds = KIND_BY_CHAR[p.id];
          const kind = st.kind === "basic" ? kinds[0] : st.kind === "special" ? kinds[1] : st.kind === "ultimate" ? kinds[2] : null;
          an = { state: st.state, t: k, phase: this.t * 12, kind, prog: (k / st.dur) % 1, combo: Math.floor(k / 0.3) % 3, power: st.state === "ultimate" ? 1 : 0, speed: st.state === "run" ? 260 : 0 };
          p.label = st.state;
        } else an = { state: "idle", t: this.t, phase: 0 };
        if (p.locked) ctx.globalAlpha = 1;
        const ch = XM.CHAR[p.id];
        const scale = p.scale * (ch.size.h > 66 ? 0.88 : 1);
        if (p.locked) {
          ctx.filter = "brightness(0)";
        }
        XM.CharArt.draw(ctx, p.id, look, an, p.w / 2, p.h - 12, 1, scale);
        ctx.filter = "none";
        ctx.globalAlpha = 1;
      }
      const lab = this.root.querySelector("[data-anim-label]");
      const cyc = this.previews.find((p) => p.mode === "cycle");
      if (lab && cyc && cyc.label) lab.textContent = cyc.label.toUpperCase();
    }

    // ---------- actions ----------
    act(act, ds, el) {
      const app = this.app;
      const S = XM.Save.data;
      if (act !== "noop") XM.Audio.sfx(act === "back" ? "uiBack" : "ui");
      switch (act) {
        case "back":
          return this.back();
        case "newGame":
          if (S.campaign.started) {
            return this.show("confirm", {
              title: "Start a new campaign?",
              text: "Story progress, scores and collected X symbols will be erased. Hero levels, outfits, upgrades, achievements and settings are kept.",
              ok: "Start over",
              onOk: () => app.newGame(),
            });
          }
          return app.newGame();
        case "continue":
          return app.continueGame();
        case "levels":
          return this.show("levels");
        case "chars":
          return this.show("chars", { mode: "browse", sel: S.selected });
        case "outfits":
          return this.show("outfits", { id: ds.id || S.selected });
        case "upgrades":
          return this.show("upgrades", { id: ds.id || S.selected });
        case "database":
          return this.show("database", { tab: "heroes" });
        case "dbTab":
          return this.show("database", { tab: ds.tab, sel: ds.sel }, false);
        case "leaderboard":
          return this.show("leaderboard", {});
        case "achievements":
          return this.show("achievements");
        case "settings":
          return this.show("settings", { tab: "audio" });
        case "setTab":
          return this.show("settings", { tab: ds.tab }, false);
        case "credits":
          return app.playCredits(false);
        case "pickLevel": {
          const i = Number(ds.level);
          if (i + 1 > S.campaign.unlocked) return XM.Audio.sfx("denied");
          return this.show("chars", { mode: "play", level: i, sel: S.selected });
        }
        case "selChar": {
          this.data.sel = ds.id;
          if (S.chars[ds.id].unlocked) S.selected = ds.id;
          return this.refresh();
        }
        case "outfitPrev":
        case "outfitNext": {
          const id = ds.id;
          const list = XM.Save.char(id).outfits.slice().sort((a, b) => a - b);
          const cur = list.indexOf(XM.Save.char(id).outfit);
          const next = list[(cur + (act === "outfitNext" ? 1 : -1) + list.length) % list.length];
          XM.Outfits.equip(id, next);
          return this.refresh();
        }
        case "equip":
          if (XM.Outfits.equip(this.data.id, Number(ds.i))) XM.Audio.sfx("confirm");
          else XM.Audio.sfx("denied");
          return this.refresh();
        case "viewOutfit":
          this.data.view = Number(ds.i);
          return this.refresh();
        case "charSwitch": {
          const ids = XM.CHARS.map((c) => c.id);
          const i = ids.indexOf(this.data.id);
          this.data.id = ids[(i + Number(ds.dir) + ids.length) % ids.length];
          this.data.view = undefined;
          return this.refresh();
        }
        case "buy":
          if (XM.Progress.buy(this.data.id, ds.key)) {
            XM.Audio.sfx("levelup");
            XM.Achievements.check();
          } else XM.Audio.sfx("denied");
          return this.refresh();
        case "refund":
          return this.show("confirm", { title: "Refund upgrade points?", text: "All of this hero's upgrades are removed and every point is returned so you can spend them again.", ok: "Refund", onOk: () => { XM.Progress.refund(this.data.id); this.back(); } });
        case "startMission": {
          const id = this.data.sel;
          if (!S.chars[id].unlocked) return XM.Audio.sfx("denied");
          S.selected = id;
          XM.Save.write();
          return app.launch(this.data.level, id);
        }
        case "resume":
          return app.resume();
        case "restart":
          return this.show("confirm", { title: "Restart this level?", text: "Progress in this attempt is lost.", ok: "Restart", onOk: () => app.restartLevel() });
        case "quit":
          return this.show("confirm", { title: "Quit to the main menu?", text: "Progress in this attempt is lost. Hero XP from this attempt is not saved.", ok: "Quit", onOk: () => app.quitToMenu() });
        case "info":
          return this.show("info", {});
        case "pauseSettings":
          return this.show("settings", { tab: "audio", inGame: true });
        case "confirmOk": {
          const fn = this.data.onOk;
          this.stack.pop();
          if (fn) fn();
          return;
        }
        case "nextMission":
          return app.nextMission();
        case "replay":
          return app.launch(this.data.res.index, this.data.res.charId);
        case "retry":
          return app.launch(this.data.levelIndex, this.data.charId);
        case "toMenu":
          return app.toMenu();
        case "submitScore":
          return this.submitScore();
        case "boardFromOver":
          return this.show("leaderboard", { mine: this.data.submitted });
        case "fullscreen":
          return app.toggleFullscreen();
        case "rebind":
          return this.rebind(ds.action, Number(ds.slot), el);
        case "resetKeys":
          S.settings.keys = XM.Save.defaultKeys();
          XM.Save.write();
          return this.refresh();
        case "editTouch":
          return app.editTouch();
        case "resetTouch":
          XM.Input.resetLayout();
          return XM.Audio.sfx("confirm");
        case "deleteSave":
          return this.show("confirm", {
            title: "Delete all saved data?",
            text: "Every hero level, outfit, upgrade, score, X symbol and achievement is erased from this browser. Settings are kept. This can't be undone.",
            ok: "Delete everything",
            danger: true,
            onOk: () => app.resetSave(),
          });
        case "watchIntro":
          return app.playOpening(() => app.toMenu());
      }
    }

    rebind(action, slot, el) {
      el.textContent = "Press a key…";
      el.classList.add("listening");
      XM.Input.capture((code) => {
        const keys = XM.Save.data.settings.keys;
        if (code) {
          // A key can only do one thing: remove it from any other action.
          for (const a of Object.keys(keys)) keys[a] = keys[a].map((c) => (c === code ? "" : c));
          keys[action][slot] = code;
          XM.Save.write();
        }
        this.refresh();
      });
    }

    async submitScore() {
      const input = this.root.querySelector("#lb-name");
      const status = this.root.querySelector("#lb-status");
      const btn = this.root.querySelector('[data-act="submitScore"]');
      const name = XM.Leaderboard.cleanName(input ? input.value : "");
      if (!name) {
        status.textContent = "Type a name first.";
        return;
      }
      btn.disabled = true;
      status.textContent = "Sending…";
      try {
        const entry = this.data.entry;
        await XM.Leaderboard.submit({ name, ...entry });
        XM.Leaderboard.saveName(name);
        this.data.submitted = { name, score: entry.score };
        if (this.data.pending) {
          XM.Save.data.pendingScore = null;
          XM.Save.write();
        }
        XM.Audio.sfx("confirm");
        this.show("leaderboard", { mine: this.data.submitted, from: this.current });
      } catch (error) {
        btn.disabled = false;
        status.textContent = XM.Leaderboard.explain(error);
        XM.Audio.sfx("denied");
      }
    }

    after_leaderboard(data) {
      const box = this.root.querySelector("#lb-table");
      if (!box) return;
      XM.Leaderboard.top(10)
        .then((rows) => {
          if (!this.root.contains(box)) return;
          if (!rows.length) {
            box.innerHTML = `<p class="muted center">No scores yet. Be the first X-Man on the board!</p>`;
            return;
          }
          let marked = false;
          box.innerHTML = `<table class="board"><thead><tr><th>#</th><th>Name</th><th>Score</th><th>Levels</th><th>X</th><th>Hero</th></tr></thead><tbody>${rows
            .map((r, i) => {
              const mine = !marked && data.mine && r.name === data.mine.name && r.score === data.mine.score;
              if (mine) marked = true;
              return `<tr class="${mine ? "mine" : ""} ${i < 3 ? "top" + (i + 1) : ""}"><td>${i + 1}</td><td>${esc(r.name)}${r.finished ? ' <span class="badge">★</span>' : ""}</td><td>${U.fmt(r.score)}</td><td>${r.levels}/20</td><td>${r.xSymbols}</td><td>${esc(r.hero)}</td></tr>`;
            })
            .join("")}</tbody></table>${data.mine && !marked ? `<p class="muted center">Your score: ${U.fmt(data.mine.score)} (not in the top 10 yet)</p>` : ""}`;
        })
        .catch((error) => {
          if (this.root.contains(box)) box.innerHTML = `<p class="err center">${esc(XM.Leaderboard.explain(error))}</p>`;
        });
    }

    // ---------- screens ----------
    header(title, sub, backLabel = "Back") {
      return `<header class="bar"><button class="btn ghost" data-act="back" aria-label="${backLabel}">◀ ${backLabel}</button><h2>${title}</h2>${sub ? `<span class="sub">${sub}</span>` : "<span></span>"}</header>`;
    }

    render_splash() {
      return `<div class="splash" data-act="noop"><div class="logo"><span class="x">X</span><div><h1>X-MEN</h1><h3>RISE OF THE MUTANTS</h3></div></div><p class="blink">${XM.Input.usingTouch ? "Tap to start" : "Press any key or click to start"}</p><p class="muted small">Plays in full screen. Headphones recommended.</p></div>`;
    }

    render_main() {
      const S = XM.Save.data;
      const started = S.campaign.started;
      const done = S.levels.filter((l) => l.cleared).length;
      const next = Math.min(20, S.campaign.unlocked);
      return `<div class="main-menu">
        <div class="logo big"><span class="x">X</span><div><h1>X-MEN</h1><h3>RISE OF THE MUTANTS</h3></div></div>
        <nav class="menu-list">
          ${started ? `<button class="btn primary" data-act="continue">Continue <small>Level ${next}: ${esc(XM.LEVELS[next - 1].name)}</small></button>` : ""}
          <button class="btn ${started ? "" : "primary"}" data-act="newGame">New Game</button>
          <button class="btn" data-act="levels">Level Select <small>${done}/20 cleared</small></button>
          <button class="btn" data-act="chars">Character Selection</button>
          <div class="row2">
            <button class="btn" data-act="outfits">Outfits</button>
            <button class="btn" data-act="upgrades">Upgrades</button>
          </div>
          <div class="row2">
            <button class="btn" data-act="database">Database</button>
            <button class="btn" data-act="leaderboard">Leaderboard</button>
          </div>
          <div class="row2">
            <button class="btn" data-act="achievements">Achievements <small>${XM.Achievements.count()}/${XM.Achievements.LIST.length}</small></button>
            <button class="btn" data-act="settings">Settings</button>
          </div>
          <div class="row2">
            <button class="btn ghost" data-act="credits">Credits</button>
            <a class="btn ghost arcade-link" href="../../index.html" aria-label="Back to Gaby's Arcade">◀ Gaby's Arcade</a>
          </div>
        </nav>
        <p class="disclaimer">A non-commercial fan game. X-Men is a trademark of Marvel.</p>
      </div>`;
    }

    render_confirm(d) {
      return `<div class="modal"><div class="panel narrow"><h2>${esc(d.title)}</h2><p>${esc(d.text)}</p><div class="actions"><button class="btn" data-act="back">Cancel</button><button class="btn ${d.danger ? "danger" : "primary"}" data-act="confirmOk">${esc(d.ok)}</button></div></div></div>`;
    }

    render_levels() {
      const S = XM.Save.data;
      const cards = XM.LEVELS.map((L, i) => {
        const s = S.levels[i];
        const locked = i + 1 > S.campaign.unlocked;
        const boss = L.boss ? XM.BOSSES[L.boss] : null;
        return `<button class="lvl-card ${locked ? "locked" : ""} ${s.cleared ? "cleared" : ""}" data-act="pickLevel" data-level="${i}" style="--theme:${XM.THEMES[L.theme].sky[1]}" ${locked ? 'aria-disabled="true"' : ""}>
          <span class="num">${i + 1}</span>
          <span class="name">${locked ? "LOCKED" : esc(L.name)}</span>
          <span class="loc">${locked ? `Clear Level ${i} to unlock` : esc(L.location)}</span>
          ${boss && !locked ? `<span class="boss-tag">BOSS: ${esc(boss.name)}</span>` : ""}
          ${L.objective && !locked ? `<span class="obj-tag">${esc(L.objective.label)}</span>` : ""}
          <span class="meta">${s.cleared ? stars(s.stars) : locked ? "" : '<span class="new">NEW</span>'} ${xIcons(s.x)}</span>
          ${s.cleared ? `<span class="best">Best ${U.fmt(s.best)} • Orbs ${s.orbs}/${s.orbsTotal} • Secrets ${s.secrets}/${s.secretsTotal}${s.bestTime ? " • " + U.time(s.bestTime) : ""}</span>` : ""}
        </button>`;
      }).join("");
      return `${this.header("Level Select", "Replay any unlocked level to find missing X symbols")}<div class="scroll"><div class="lvl-grid">${cards}</div></div>`;
    }

    render_chars(d) {
      const S = XM.Save.data;
      const sel = XM.CHAR[d.sel] || XM.CHARS[0];
      const ss = S.chars[sel.id];
      const unlocked = ss.unlocked;
      const outfit = XM.Outfits.current(sel.id);
      const grid = XM.CHARS.map((c) => {
        const cs = S.chars[c.id];
        return `<button class="char-tile ${c.id === sel.id ? "sel" : ""} ${cs.unlocked ? "" : "locked"}" data-act="selChar" data-id="${c.id}" style="--c:${c.color}">
          <canvas data-preview="${c.id}" data-scale="1.05" data-locked="${cs.unlocked ? 0 : 1}" width="74" height="84"></canvas>
          <span>${cs.unlocked ? esc(c.name) : "???"}</span>${cs.unlocked ? `<b>LV ${cs.level}</b>` : ""}${cs.newOutfits.length ? '<i class="dot"></i>' : ""}
        </button>`;
      }).join("");
      const bars = XM.charRatings(sel)
        .map(([k, v]) => `<div class="stat"><span>${k}</span><div class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? "on" : ""}"></i>`).join("")}</div></div>`)
        .join("");
      const need = XM.Progress.xpToNext(ss.level);
      const play = d.mode === "play";
      const L = play ? XM.LEVELS[d.level] : null;
      return `${this.header(play ? `Choose your X-Man` : "Character Selection", play ? `Level ${d.level + 1}: ${esc(L.name)}` : "")}
      <div class="chars-layout">
        <div class="char-grid">${grid}</div>
        <div class="char-detail panel" style="--c:${sel.color}">
          ${unlocked ? `
          <div class="preview-wrap"><canvas data-preview="${sel.id}" data-mode="cycle" data-scale="2.4" width="220" height="220"></canvas><span class="anim-label" data-anim-label></span>
          <div class="outfit-switch"><button class="btn small" data-act="outfitPrev" data-id="${sel.id}" aria-label="Previous outfit">◀</button><span>${esc(outfit.name)}<small>${outfit.category}</small></span><button class="btn small" data-act="outfitNext" data-id="${sel.id}" aria-label="Next outfit">▶</button></div></div>
          <div class="info">
            <h2>${esc(sel.name)} <small>${esc(sel.role)}</small></h2>
            <p class="lvl">Level ${ss.level}${ss.level < 30 ? ` • XP ${U.fmt(ss.xp)}/${U.fmt(need)}` : " • MAX"}${ss.points ? ` • <b class="pts">${ss.points} upgrade point${ss.points > 1 ? "s" : ""}</b>` : ""}</p>
            <div class="xpbar"><i style="width:${ss.level >= 30 ? 100 : (ss.xp / need) * 100}%"></i></div>
            <p>${esc(sel.desc)}</p>
            ${sel.traitDesc ? `<p class="trait">${esc(sel.traitDesc)}</p>` : ""}
            <div class="stats">${bars}</div>
            <ul class="abil">
              <li><b>Basic:</b> ${esc(sel.attacks.basic.name)} <span>${esc(sel.attacks.basic.desc)}</span></li>
              <li><b>Special:</b> ${esc(sel.attacks.special.name)} <span>${esc(sel.attacks.special.desc)} (${sel.stats.cost} X-Energy)</span></li>
              <li><b>Ultimate:</b> ${esc(sel.attacks.ultimate.name)} <span>${esc(sel.attacks.ultimate.desc)}</span></li>
            </ul>
          </div>` : `<div class="info locked-info"><h2>???</h2><p>This X-Man joins the team after Level ${sel.joinsAfter}.</p></div>`}
          <div class="actions">
            ${unlocked ? `<button class="btn" data-act="outfits" data-id="${sel.id}">Outfits${ss.newOutfits.length ? " •" : ""}</button><button class="btn" data-act="upgrades" data-id="${sel.id}">Upgrades${ss.points ? ` (${ss.points})` : ""}</button>` : ""}
            ${play ? `<button class="btn primary" data-act="startMission" ${unlocked ? "" : "disabled"}>Start Mission ▶</button>` : ""}
          </div>
        </div>
      </div>`;
    }

    render_outfits(d) {
      const id = d.id;
      const c = XM.CHAR[id];
      const cs = XM.Save.char(id);
      if (!cs.unlocked) {
        return `${this.header("Outfits")}<div class="panel narrow center"><p>${esc(c.name)} hasn't joined the team yet.</p><div class="actions"><button class="btn" data-act="charSwitch" data-dir="1">Next hero ▶</button></div></div>`;
      }
      const view = d.view !== undefined ? d.view : cs.outfit;
      const list = XM.Outfits.list(id);
      const v = list[view];
      const vUnlocked = XM.Outfits.isUnlocked(id, view);
      const [have, need] = XM.Outfits.progress(id, v.unlock);
      const cards = list.map((o, i) => {
        const un = XM.Outfits.isUnlocked(id, i);
        const isNew = cs.newOutfits.includes(i);
        return `<button class="outfit-card ${un ? "" : "locked"} ${i === cs.outfit ? "equipped" : ""} ${i === view ? "sel" : ""} ${o.rare ? "rare" : ""}" data-act="viewOutfit" data-i="${i}">
          <canvas data-preview="${id}" data-outfit="${i}" data-scale="1.15" data-locked="${un ? 0 : 1}" width="80" height="92"></canvas>
          <span class="nm">${esc(o.name)}</span><small>${o.category}</small>${isNew ? '<i class="new">NEW</i>' : ""}${i === cs.outfit ? '<i class="eq">EQUIPPED</i>' : ""}
        </button>`;
      }).join("");
      return `${this.header("Outfit Customization", `${XM.Outfits.total()}/120 outfits unlocked`)}
      <div class="outfit-layout">
        <div class="panel outfit-preview" style="--c:${c.color}">
          <div class="hero-switch"><button class="btn small" data-act="charSwitch" data-dir="-1" aria-label="Previous hero">◀</button><h2>${esc(c.name)}</h2><button class="btn small" data-act="charSwitch" data-dir="1" aria-label="Next hero">▶</button></div>
          <canvas data-preview="${id}" data-outfit="${view}" data-mode="cycle" data-scale="2.4" data-locked="${vUnlocked ? 0 : 1}" width="220" height="220"></canvas>
          <h3>${esc(v.name)}${v.rare ? ' <span class="badge">RARE</span>' : ""}</h3>
          <p class="muted">${v.category}</p>
          ${vUnlocked ? (view === cs.outfit ? `<p class="ok">Equipped</p>` : `<button class="btn primary" data-act="equip" data-i="${view}">Equip</button>`) : `<p class="lockreason">🔒 ${esc(XM.Outfits.describe(v.unlock))}</p><div class="xpbar"><i style="width:${Math.min(100, (have / need) * 100)}%"></i></div><p class="muted small">${Math.min(have, need)} / ${need}</p>`}
          <p class="muted small">Outfits are cosmetic and never change stats.</p>
        </div>
        <div class="scroll"><div class="outfit-grid">${cards}</div></div>
      </div>`;
    }

    after_outfits(d) {
      const cs = XM.Save.char(d.id);
      if (cs.unlocked && d.view !== undefined && cs.newOutfits.includes(d.view)) {
        cs.newOutfits = cs.newOutfits.filter((n) => n !== d.view);
        XM.Save.write();
      }
    }

    render_upgrades(d) {
      const id = d.id;
      const c = XM.CHAR[id];
      const cs = XM.Save.char(id);
      const st = XM.Progress.stats(id);
      const need = XM.Progress.xpToNext(cs.level);
      const rows = XM.Progress.UPGRADES.map((u) => {
        const r = cs.upgrades[u.key];
        const price = XM.Progress.cost(r);
        const can = cs.unlocked && r < 5 && cs.points >= price;
        return `<div class="upg-row"><div><b>${esc(u.name)}</b><small>${esc(u.desc)}</small></div><div class="pips">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < r ? "on" : ""}"></i>`).join("")}</div><button class="btn small ${can ? "primary" : ""}" data-act="buy" data-key="${u.key}" ${can ? "" : "disabled"}>${r >= 5 ? "MAX" : `+ (${price} pt${price > 1 ? "s" : ""})`}</button></div>`;
      }).join("");
      const passives = c.passives.map((p) => `<li class="${cs.level >= p.lvl ? "on" : ""}"><b>Lv ${p.lvl} • ${esc(p.name)}</b><span>${esc(p.desc)}</span></li>`).join("");
      return `${this.header("Character Upgrades")}
      <div class="upg-layout">
        <div class="panel" style="--c:${c.color}">
          <div class="hero-switch"><button class="btn small" data-act="charSwitch" data-dir="-1" aria-label="Previous hero">◀</button><h2>${esc(c.name)}</h2><button class="btn small" data-act="charSwitch" data-dir="1" aria-label="Next hero">▶</button></div>
          ${cs.unlocked ? `
          <canvas data-preview="${id}" data-scale="2" width="160" height="160"></canvas>
          <p class="lvl">Level ${cs.level}/30 ${cs.level < 30 ? `• XP ${U.fmt(cs.xp)}/${U.fmt(need)}` : ""}</p>
          <div class="xpbar"><i style="width:${cs.level >= 30 ? 100 : (cs.xp / need) * 100}%"></i></div>
          <p class="pts big">${cs.points} upgrade point${cs.points === 1 ? "" : "s"}</p>
          <div class="final-stats">
            <span>Health <b>${st.maxHp}</b></span><span>Attack <b>${st.atk.toFixed(1)}</b></span><span>Special ×<b>${st.sp.toFixed(2)}</b></span><span>Ultimate ×<b>${st.ult.toFixed(2)}</b></span>
            <span>X-Energy <b>${st.maxEnergy}</b></span><span>Recharge <b>${st.regen.toFixed(1)}/s</b></span><span>Speed <b>${Math.round(st.spd)}</b></span><span>Defense <b>${Math.round(st.def * 100)}%</b></span>
          </div>
          <button class="btn ghost small" data-act="refund">Refund points</button>` : `<p>${esc(c.name)} joins after Level ${c.joinsAfter}.</p>`}
        </div>
        <div class="scroll">
          <div class="panel"><h3>Upgrade Tree</h3><p class="muted small">Earn points by leveling up (+1 per level, +2 every 5th level) and from Rare Upgrade Cores hidden in secret rooms.</p>${rows}</div>
          <div class="panel"><h3>Passive Abilities</h3><ul class="passives">${passives}</ul></div>
        </div>
      </div>`;
    }

    render_database(d) {
      const S = XM.Save.data;
      const tab = d.tab || "heroes";
      const tabs = [["heroes", "Heroes"], ["villains", "Villains"], ["enemies", "Enemies"], ["gallery", "Gallery"]]
        .map(([k, n]) => `<button class="tab ${k === tab ? "on" : ""}" data-act="dbTab" data-tab="${k}">${n}</button>`)
        .join("");
      let body = "";
      if (tab === "heroes") {
        body = XM.CHARS.map((c) => {
          const cs = S.chars[c.id];
          return `<div class="db-card ${cs.unlocked ? "" : "locked"}" style="--c:${c.color}"><canvas data-preview="${c.id}" data-scale="1.3" data-locked="${cs.unlocked ? 0 : 1}" width="90" height="100"></canvas><div><h3>${cs.unlocked ? esc(c.name) : "Unknown Mutant"}</h3>${cs.unlocked ? `<small>${esc(c.real)} • ${esc(c.role)}</small><p>${esc(c.desc)}</p><p class="muted small">${esc(c.attacks.basic.name)} • ${esc(c.attacks.special.name)} • ${esc(c.attacks.ultimate.name)}</p>` : `<p class="muted">Joins after Level ${c.joinsAfter}.</p>`}</div></div>`;
        }).join("");
      } else if (tab === "villains") {
        const seen = S.seen.bosses;
        const list = ["apocalypse", "sinister", "sabretooth", "juggernaut", "mystique", "darkphoenix", "omegared", "blob", "deathstrike", "guardian", "magneto"];
        const info = {
          apocalypse: "An ancient mutant who believes only the strongest deserve to survive. He claims the Nexus as his birthright.",
          sinister: "A brilliant, amoral geneticist obsessed with perfecting mutant DNA. He sees the Nexus as the ultimate experiment.",
          sabretooth: "A savage hunter with a healing factor and a cruel streak. He guards whatever pays best.",
          juggernaut: "Once he starts moving, nothing can stop him. The mine crystals made him stronger than ever.",
          mystique: "A shapeshifter who can wear any face. Her loyalties are always her own... almost.",
          darkphoenix: "A Nexus echo of a cosmic fire, wearing a familiar face. It burns with borrowed power.",
          omegared: "A life-draining warrior with carbonadium coils, woken from the ice by the Syndicate.",
          blob: "The immovable warden of the mutant prison. Bullets and fists sink into him harmlessly.",
          deathstrike: "A cybernetic assassin with adamantium nails and a code of honor all her own.",
          guardian: "The Lodestone Colossus: a giant magnetic construct built to guard Magneto's fortress.",
          magneto: "Master of magnetism and founder of the Lodestone Syndicate. He means to remake the world for mutantkind.",
        };
        body = list.map((id) => {
          const def = id === "guardian" ? XM.BOSSES.guardian : XM.BOSSES[id];
          const known = seen.includes(id);
          const beaten = S.stats.bosses.includes(id);
          return `<div class="db-card ${known ? "" : "locked"}"><canvas data-boss="${def.art}" width="100" height="100"></canvas><div><h3>${known ? esc(def.name) : "??????"}</h3>${known ? `<small>${esc(def.title)}${beaten ? " • DEFEATED" : ""}</small><p>${esc(info[id])}</p>` : `<p class="muted">Encounter this villain to unlock the file.</p>`}</div></div>`;
        }).join("");
      } else if (tab === "enemies") {
        const seen = S.seen.enemies;
        body = Object.entries(XM.ENEMY_TYPES)
          .filter(([, t]) => !t.prop)
          .map(([id, t]) => `<div class="db-mini ${seen.includes(id) ? "" : "locked"}"><b>${seen.includes(id) ? esc(t.name) : "???"}</b>${seen.includes(id) ? `<small>HP ${t.hp} • ${t.beh}${t.sentinel ? " • Sentinel" : ""}</small>` : ""}</div>`)
          .join("");
        body = `<div class="db-minis">${body}</div>`;
      } else {
        body = XM.LEVELS.map((L, i) => {
          const got = S.art.includes(i);
          const hero = XM.CHARS[i % 12].id;
          return `<div class="art-card ${got ? "" : "locked"}" style="--theme:${XM.THEMES[L.theme].sky[1]}">${got ? `<canvas data-preview="${hero}" data-outfit="${Math.min(9, Math.floor(i / 2))}" data-scale="1.6" width="110" height="120"></canvas><b>Concept Art #${i + 1}</b><small>${esc(L.name)}</small>` : `<span class="q">?</span><small>Find all 3 X symbols in Level ${i + 1}</small>`}</div>`;
        }).join("");
        body = `<div class="art-grid">${body}</div>`;
      }
      return `${this.header("Character Database")}<div class="tabs">${tabs}</div><div class="scroll"><div class="db-list">${body}</div></div>`;
    }

    after_database() {
      this.root.querySelectorAll("canvas[data-boss]").forEach((c) => {
        const ctx = c.getContext("2d");
        XM.bossPortrait(ctx, c.dataset.boss, c.width / 2, c.height / 2, c.width);
        if (c.closest(".locked")) {
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.globalCompositeOperation = "source-over";
        }
      });
    }

    render_pause() {
      return `<div class="modal"><div class="panel narrow pause"><h2>Paused</h2><nav class="menu-list">
        <button class="btn primary" data-act="resume">Resume</button>
        <button class="btn" data-act="info">Character Info</button>
        <button class="btn" data-act="pauseSettings">Settings</button>
        <button class="btn" data-act="restart">Restart Level</button>
        <button class="btn danger" data-act="quit">Quit to Menu</button></nav></div></div>`;
    }

    render_info() {
      const w = this.app.world;
      const id = w ? w.player.id : XM.Save.data.selected;
      const c = XM.CHAR[id];
      const st = XM.Progress.stats(id);
      const cs = XM.Save.char(id);
      const k = XM.Save.data.settings.keys;
      const kn = (a) => k[a].filter(Boolean).map((x) => XM.Input.keyName(x)).join(" / ") || "—";
      const passives = XM.Progress.passives(id);
      return `<div class="modal"><div class="panel info-panel" style="--c:${c.color}">
        <h2>${esc(c.name)} <small>Level ${cs.level}</small></h2>
        <div class="info-cols">
          <div>
            <h3>Stats</h3>
            <div class="final-stats"><span>Health <b>${st.maxHp}</b></span><span>Attack <b>${st.atk.toFixed(1)}</b></span><span>X-Energy <b>${st.maxEnergy}</b></span><span>Special cost <b>${st.cost}</b></span><span>Speed <b>${Math.round(st.spd)}</b></span><span>Defense <b>${Math.round(st.def * 100)}%</b></span></div>
            <h3>Abilities</h3>
            <ul class="abil"><li><b>${esc(c.attacks.basic.name)}</b> <span>${esc(c.attacks.basic.desc)}</span></li><li><b>${esc(c.attacks.special.name)}</b> <span>${esc(c.attacks.special.desc)}</span></li><li><b>${esc(c.attacks.ultimate.name)}</b> <span>${esc(c.attacks.ultimate.desc)}</span></li></ul>
            <h3>Passives</h3><ul class="passives">${passives.length ? passives.map((p) => `<li class="on"><b>${esc(p.name)}</b><span>${esc(p.desc)}</span></li>`).join("") : '<li>None yet: the first unlocks at level 5.</li>'}${c.traitDesc ? `<li class="on"><b>Trait</b><span>${esc(c.traitDesc)}</span></li>` : ""}</ul>
          </div>
          <div>
            <h3>Controls</h3>
            <table class="keys">${XM.Input.ACTIONS.map((a) => `<tr><td>${XM.Input.LABELS[a]}</td><td>${kn(a)}</td></tr>`).join("")}</table>
            ${c.move === "levitate" ? '<p class="trait">Hold Jump to levitate. Hold Down + Jump to drop through ledges.</p>' : c.move === "glide" ? '<p class="trait">Double jump, then hold Jump to glide.</p>' : c.dj ? '<p class="trait">Press Jump in mid-air to double jump.</p>' : ""}
          </div>
        </div>
        <div class="actions"><button class="btn primary" data-act="resume">Resume</button></div></div></div>`;
    }

    render_results(d) {
      const r = d.res;
      const s = r.stats;
      const L = r.level;
      const rows = [
        ["Enemies defeated", s.kills],
        ["Energy orbs", `${s.orbs}/${s.orbsTotal}`],
        ["X symbols", `${s.x.filter(Boolean).length}/3`],
        ["Secret areas", `${s.secrets}/${s.secretsTotal}`],
        ["Time", `${U.time(s.time)} (par ${U.time(r.par)})`],
        ["Damage taken", Math.round(s.damage)],
      ];
      const bonus = [
        ["Mission score", s.score],
        ["Time bonus", r.timeBonus],
        ["Health bonus", r.healthBonus],
        r.noDamage ? ["Untouchable bonus", 5000] : null,
        r.xAllBonus ? ["All 3 X symbols", r.xAllBonus] : null,
        r.bossBonus ? ["Boss battle", r.bossBonus] : null,
      ].filter(Boolean);
      const c = XM.CHAR[r.charId];
      const ups = d.levelUps;
      return `<div class="results">
        <h1>MISSION COMPLETE</h1><h3>Level ${L.number}: ${esc(L.name)}</h3>
        <div class="res-cols">
          <div class="panel">
            <div class="big-stars">${stars(r.stars)}</div>
            <table class="tally">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</table>
            <table class="tally">${bonus.map(([a, b]) => `<tr><td>${a}</td><td>+${U.fmt(b)}</td></tr>`).join("")}<tr class="total"><td>Final score</td><td>${U.fmt(r.total)}</td></tr></table>
            ${d.newBest ? '<p class="ok">New best score!</p>' : ""}
          </div>
          <div class="panel" style="--c:${c.color}">
            <canvas data-preview="${c.id}" data-mode="cycle" data-scale="1.8" width="150" height="150"></canvas>
            <h3>${esc(c.name)} +${U.fmt(r.xp)} XP</h3>
            <p class="lvl">Level ${d.levelAfter}${ups.levels.length ? ` <b class="ok">LEVEL UP! (+${ups.points} upgrade point${ups.points > 1 ? "s" : ""})</b>` : ""}</p>
            <div class="xpbar"><i style="width:${d.levelAfter >= 30 ? 100 : (XM.Save.char(c.id).xp / XM.Progress.xpToNext(d.levelAfter)) * 100}%"></i></div>
            ${d.rare ? '<p class="rare">Rare Upgrade Core: +1 upgrade point</p>' : ""}
            ${d.newPassives.map((p) => `<p class="ok">New passive: ${esc(p.name)}</p>`).join("")}
            ${d.unlocks.map((u) => `<p class="unlock">${u}</p>`).join("")}
          </div>
        </div>
        ${d.next ? `<p class="next"><b>Next mission:</b> ${esc(d.next)}</p>` : ""}
        <div class="actions wrap">
          ${d.hasNext ? '<button class="btn primary" data-act="nextMission">Next Mission ▶</button>' : ""}
          <button class="btn" data-act="outfits" data-id="${c.id}">Outfits</button>
          <button class="btn" data-act="upgrades" data-id="${c.id}">Upgrades</button>
          <button class="btn" data-act="replay">Replay</button>
          <button class="btn" data-act="levels">Level Select</button>
          <button class="btn ghost" data-act="toMenu">Main Menu</button>
        </div></div>`;
    }

    render_gameover(d) {
      const name = XM.Leaderboard.loadName();
      return `<div class="modal"><div class="panel narrow gameover">
        <h1>GAME OVER</h1>
        <p>Level ${d.levelIndex + 1}: ${esc(XM.LEVELS[d.levelIndex].name)}</p>
        <p class="score">${U.fmt(d.runScore)} <small>points this run</small></p>
        <div class="submit-box">
          <p>Campaign score for the leaderboard: <b>${U.fmt(d.entry.score)}</b><br><small class="muted">Best score from every level + 2,500 per X symbol + this run</small></p>
          ${d.submitted ? `<p class="ok">Submitted as ${esc(d.submitted.name)}!</p>` : d.entry.score <= 0 ? `<p class="muted">Score some points to get on the leaderboard!</p>` : `<label for="lb-name">Your name</label>
          <div class="row2 tight"><input id="lb-name" maxlength="16" autocomplete="nickname" value="${esc(name)}" placeholder="Name"><button class="btn primary" data-act="submitScore">Submit</button></div>
          <p id="lb-status" class="muted small" role="status"></p>`}
        </div>
        <nav class="menu-list">
          <button class="btn" data-act="boardFromOver">View Leaderboard</button>
          <button class="btn primary" data-act="retry">Try Again</button>
          <button class="btn ghost" data-act="toMenu">Main Menu</button>
        </nav></div></div>`;
    }

    render_finalscore(d) {
      const name = XM.Leaderboard.loadName();
      return `<div class="modal"><div class="panel narrow gameover">
        <h1>CAMPAIGN COMPLETE!</h1>
        <p>The X-Men have saved the world from the Mutant Nexus.</p>
        <p class="score">${U.fmt(d.entry.score)} <small>campaign score</small></p>
        <div class="submit-box">
          ${d.submitted ? `<p class="ok">Submitted as ${esc(d.submitted.name)}!</p>` : `<label for="lb-name">Add your name to the leaderboard</label>
          <div class="row2 tight"><input id="lb-name" maxlength="16" autocomplete="nickname" value="${esc(name)}" placeholder="Name"><button class="btn primary" data-act="submitScore">Submit</button></div>
          <p id="lb-status" class="muted small" role="status"></p>`}
        </div>
        <nav class="menu-list"><button class="btn" data-act="boardFromOver">View Leaderboard</button><button class="btn ghost" data-act="toMenu">Main Menu</button></nav></div></div>`;
    }

    render_leaderboard(d) {
      const pending = XM.Save.data.pendingScore;
      return `${this.header("Leaderboard", "Top 10 campaign scores")}
      <div class="scroll"><div class="panel board-panel">
        <div id="lb-table"><p class="muted center">Loading…</p></div>
        ${pending && !d.mine ? `<div class="submit-box"><p>You have an unsubmitted campaign score: <b>${U.fmt(pending.score)}</b></p><button class="btn primary" data-act="submitPending">Submit it</button></div>` : ""}
        <p class="muted small center">A campaign score is the best score from each level plus 2,500 for every X symbol found. Submit from the Game Over screen or after finishing the campaign.</p>
      </div></div>`;
    }

    render_achievements() {
      const got = XM.Save.data.achievements;
      return `${this.header("Achievements", `${XM.Achievements.count()}/${XM.Achievements.LIST.length}`)}<div class="scroll"><div class="ach-grid">${XM.Achievements.LIST.map((a) => `<div class="ach ${got[a.id] ? "on" : ""}"><span class="ico">${got[a.id] ? "★" : "🔒"}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div></div>`).join("")}</div></div>`;
    }

    render_settings(d) {
      const s = XM.Save.data.settings;
      const tab = d.tab || "audio";
      const tabs = [["audio", "Audio"], ["video", "Display"], ["controls", "Controls"], ["touch", "Touch"], ["data", "Data"]].map(([k, n]) => `<button class="tab ${k === tab ? "on" : ""}" data-act="setTab" data-tab="${k}">${n}</button>`).join("");
      const range = (key, label, val) => `<label class="setting"><span>${label}</span><input type="range" min="0" max="1" step="0.05" value="${val}" data-setting="${key}"><b>${Math.round(val * 100)}%</b></label>`;
      const check = (key, label, val) => `<label class="setting check"><span>${label}</span><input type="checkbox" data-setting="${key}" ${val ? "checked" : ""}></label>`;
      let body = "";
      if (tab === "audio") {
        body = range("master", "Master volume", s.master) + range("music", "Music volume", s.music) + range("sfx", "Sound effects volume", s.sfx) + `<p class="muted small">Custom music and sound effects can be added in the audio folder. See audio/README.txt.</p>`;
      } else if (tab === "video") {
        body = `<label class="setting"><span>Full screen</span><button class="btn small" data-act="fullscreen">${document.fullscreenElement ? "Exit full screen" : "Enter full screen"}</button></label>
          <label class="setting"><span>Graphics quality</span><select data-setting="quality">${["high", "medium", "low"].map((q) => `<option value="${q}" ${s.quality === q ? "selected" : ""}>${q[0].toUpperCase() + q.slice(1)}</option>`).join("")}</select></label>
          ${check("shake", "Screen shake", s.shake)}${check("pauseOnBlur", "Pause when the game loses focus", s.pauseOnBlur)}${check("showFps", "Show frame rate", s.showFps)}`;
      } else if (tab === "controls") {
        const k = s.keys;
        body = `<p class="muted small">Click a key slot, then press the new key. Esc cancels.</p><table class="keys rebind">${XM.Input.ACTIONS.map((a) => `<tr><td>${XM.Input.LABELS[a]}</td>${[0, 1].map((i) => `<td><button class="btn small key" data-act="rebind" data-action="${a}" data-slot="${i}">${XM.Input.keyName(k[a][i])}</button></td>`).join("")}</tr>`).join("")}</table>
          <p class="muted small">Gamepads work too: A jump, X attack, Y special, RB/RT ultimate, B dodge, LB interact, Start pause.</p>
          <button class="btn" data-act="resetKeys">Reset to defaults</button>`;
      } else if (tab === "touch") {
        body = `<label class="setting"><span>Button size</span><input type="range" min="0.7" max="1.4" step="0.05" value="${s.touch.size}" data-setting="touchSize"><b>${Math.round(s.touch.size * 100)}%</b></label>
          <label class="setting"><span>Button opacity</span><input type="range" min="0.25" max="1" step="0.05" value="${s.touch.opacity}" data-setting="touchOpacity"><b>${Math.round(s.touch.opacity * 100)}%</b></label>
          ${check("touchForce", "Always show touch controls", s.touch.forceShow)}
          <div class="actions"><button class="btn" data-act="editTouch">Move controls…</button><button class="btn ghost" data-act="resetTouch">Reset layout</button></div>`;
      } else {
        body = `<p>Progress saves automatically in this browser after levels, level-ups, unlocks, upgrades and setting changes.</p>
          <div class="actions"><button class="btn" data-act="watchIntro">Watch the opening again</button><button class="btn danger" data-act="deleteSave">Delete saved data…</button></div>`;
      }
      return `${this.header("Settings")}<div class="tabs">${tabs}</div><div class="scroll"><div class="panel settings">${body}</div></div>`;
    }

    render_touchEdit() {
      return `<div class="touch-edit-bar"><p>Drag the controls where you like them.</p><div class="actions"><button class="btn ghost" data-act="touchCancel">Cancel</button><button class="btn" data-act="touchReset">Reset</button><button class="btn primary" data-act="touchSave">Save</button></div></div>`;
    }

    render_credits() {
      return `<div class="credits-skip"><button class="btn ghost" data-act="skipCredits">Skip ▶</button></div>`;
    }
  }

  // Pending score submission and touch editing are routed through act().
  const baseAct = Menus.prototype.act;
  Menus.prototype.act = function (act, ds, el) {
    const app = this.app;
    switch (act) {
      case "submitPending": {
        const pending = XM.Save.data.pendingScore;
        if (pending) this.show("finalscore", { entry: pending, pending: true });
        return;
      }
      case "touchSave":
        XM.Input.endEdit(true);
        return app.endTouchEdit();
      case "touchCancel":
        XM.Input.endEdit(false);
        return app.endTouchEdit();
      case "touchReset":
        XM.Input.resetLayout();
        XM.Input.editLayout = {};
        XM.Input.applyLayout();
        return;
      case "skipCredits":
        return app.skipCredits();
    }
    return baseAct.call(this, act, ds, el);
  };

  XM.Menus = Menus;
})(window.XM);
