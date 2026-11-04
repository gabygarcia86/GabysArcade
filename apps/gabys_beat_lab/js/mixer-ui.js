/* Mixer view: inserts with faders, pan, mute/solo, meters and effect slots, plus the master channel. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h, clear, bus, uid } = GBL;
  const M = GBL.model;
  const S = M.state;
  const FX = GBL.effects;

  let root, strips, meters = [];

  function build(el) {
    root = el;
    strips = h("div", { class: "mixer-strips" });
    root.append(h("div", { class: "editor-tools" },
      h("button", { class: "btn small", tip: "Add an empty mixer insert", onclick: () => { M.addInsert("Insert " + (S.project.mixer.inserts.length + 1), GBL.pick(GBL.PALETTE)); M.changed("mixer"); } }, "➕ Insert"),
      h("span", { class: "hint" }, "Each instrument plays through its own insert. Add effects in the slots, then turn the knobs!")), strips);
    bus.on("project:loaded", render);
    bus.on("change", (s) => { if (s !== "live" && s !== "mixer-live") render(); });
    bus.on("frame", drawMeters);
    render();
  }

  function usedBy(ins) {
    const p = S.project;
    return p.channels.filter((c) => c.insert === ins.id).map((c) => c.name).concat(p.tracks.filter((t) => t.insert === ins.id).map((t) => "🔊 " + t.name));
  }

  function fxSlots(list, owner) {
    const box = h("div", { class: "fx-slots" });
    list.forEach((f, i) => {
      const d = FX.DEFS[f.type];
      const power = h("button", { class: "fx-power" + (f.on ? " on" : ""), tip: f.on ? "Turn this effect off" : "Turn this effect on", "aria-label": "Toggle " + d.name, "aria-pressed": String(f.on) }, "⏻");
      power.onclick = () => { f.on = !f.on; M.changed("mixer"); };
      const name = h("button", { class: "fx-name", style: { "--c": d.color }, tip: d.tip + " Click to adjust." }, d.icon + " " + d.name);
      name.onclick = () => editFx(f, owner);
      const more = h("button", { class: "fx-more", "aria-label": d.name + " options", tip: "Move or remove" }, "⋯");
      more.onclick = (e) => GBL.ui.menu(e.currentTarget, [
        { label: "Move up", icon: "⬆️", disabled: i === 0, onClick: () => { list.splice(i, 1); list.splice(i - 1, 0, f); M.changed("mixer"); } },
        { label: "Move down", icon: "⬇️", disabled: i === list.length - 1, onClick: () => { list.splice(i, 1); list.splice(i + 1, 0, f); M.changed("mixer"); } },
        { label: "Reset to default", icon: "↺", onClick: () => { f.params = FX.defaults(f.type); M.changed("mixer"); } },
        { label: "Remove", icon: "🗑️", onClick: () => { list.splice(i, 1); M.changed("mixer"); } },
      ]);
      box.append(h("div", { class: "fx-slot" + (f.on ? "" : " bypassed") }, power, name, more));
    });
    if (list.length < 8) {
      const add = h("button", { class: "fx-add", tip: "Add an audio effect" }, "＋ Effect");
      add.onclick = (e) => GBL.ui.menu(e.currentTarget, FX.ORDER.map((t) => ({ label: FX.DEFS[t].name, icon: FX.DEFS[t].icon, tip: FX.DEFS[t].tip, onClick: () => { const f = M.newFx(t); list.push(f); M.changed("mixer"); editFx(f, owner); } })));
      box.append(add);
    }
    return box;
  }

  function editFx(f, owner) {
    const d = FX.DEFS[f.type];
    const body = h("div", { class: "fx-editor", style: { "--c": d.color } }, h("p", { class: "fx-tip" }, d.tip));
    const knobs = h("div", { class: "knob-row" });
    for (const q of d.params) {
      if (q.type === "choice") {
        const sel = h("select", { "aria-label": q.name }, q.options.map((o, i) => h("option", { value: i, selected: Math.round(f.params[q.id]) === i }, o)));
        sel.onchange = () => { f.params[q.id] = +sel.value; M.changed("mixer-live"); };
        knobs.append(h("label", { class: "choice-param" }, h("span", {}, q.name), sel));
      } else {
        knobs.append(GBL.ui.knob({
          label: q.name, min: q.min, max: q.max, step: q.step, value: f.params[q.id], def: q.def, log: q.log || (q.unit === "Hz" && q.max / q.min > 20), size: 52, color: d.color,
          fmt: q.fmt || ((v) => (q.unit === "Hz" ? (v >= 1000 ? (v / 1000).toFixed(1) + "k" : Math.round(v)) + " Hz" : q.unit === "s" ? (v < 1 ? Math.round(v * 1000) + " ms" : v.toFixed(1) + " s") : (Math.round(v * 10) / 10) + (q.unit ? " " + q.unit : ""))),
          onInput: (v) => { f.params[q.id] = v; M.changed("mixer-live", false); },
          onChange: () => M.changed("mixer-live"),
        }));
      }
    }
    body.append(knobs);
    const onB = h("label", { class: "check" }, h("input", { type: "checkbox", checked: f.on, onchange: (e) => { f.on = e.target.checked; M.changed("mixer"); } }), " Effect on");
    body.append(onB, h("p", { class: "hint" }, "On: " + owner + ". Play your song while you turn the knobs to hear the change."));
    GBL.ui.modal({ title: d.name, icon: d.icon, body });
  }

  function strip(ins, isMaster) {
    const p = S.project;
    const meter = h("canvas", { class: "meter", width: 10, height: 120, "aria-hidden": "true" });
    const fad = GBL.ui.fader({ value: ins.vol, max: 1.25, def: isMaster ? 0.85 : 0.8, label: (isMaster ? "Master" : ins.name) + " volume",
      onInput: (v) => { ins.vol = v; M.changed("mixer-live", false); }, onChange: () => M.changed("mixer-live") });
    const kids = [];
    if (!isMaster) {
      const pan = GBL.ui.knob({ label: "Pan", min: -1, max: 1, value: ins.pan, def: 0, bipolar: true, size: 32, color: "var(--cyan)", fmt: (v) => (Math.abs(v) < 0.02 ? "C" : v < 0 ? "L" + Math.round(-v * 100) : "R" + Math.round(v * 100)),
        onInput: (v) => { ins.pan = v; M.changed("mixer-live", false); }, onChange: () => M.changed("mixer-live") });
      kids.push(pan);
    } else {
      const eq = h("div", { class: "master-eq" });
      for (const [k, label] of [["low", "Bass"], ["mid", "Mid"], ["high", "Treble"]]) {
        eq.append(GBL.ui.knob({ label, min: -12, max: 12, step: 0.5, value: ins.eq[k], def: 0, bipolar: true, size: 30, color: "var(--green)", fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(1) + " dB",
          onInput: (v) => { ins.eq[k] = v; M.changed("mixer-live", false); }, onChange: () => M.changed("mixer-live") }));
      }
      kids.push(h("div", { class: "eq-label" }, "Master EQ"), eq);
    }
    const name = h("button", { class: "strip-name", style: { "--c": ins.color || "#a855f7" }, tip: isMaster ? "Everything plays through the Master" : "Click to rename" }, isMaster ? "MASTER" : ins.name);
    if (!isMaster) name.onclick = () => GBL.ui.prompt("Rename insert", ins.name).then((n) => { if (n && n.trim()) { ins.name = n.trim(); M.changed("mixer"); } });
    const ms = isMaster ? null : h("div", { class: "strip-ms" },
      h("button", { class: "mini-btn" + (ins.mute ? " on mute" : ""), tip: "Mute", "aria-pressed": String(!!ins.mute), "aria-label": "Mute " + ins.name, onclick: () => { ins.mute = !ins.mute; M.changed("mixer"); } }, "M"),
      h("button", { class: "mini-btn" + (ins.solo ? " on" : ""), tip: "Solo", "aria-pressed": String(!!ins.solo), "aria-label": "Solo " + ins.name, onclick: () => { ins.solo = !ins.solo; M.changed("mixer"); } }, "S"));
    const users = isMaster ? [] : usedBy(ins);
    const el = h("div", { class: "strip" + (isMaster ? " master" : ""), style: { "--c": ins.color || "#a855f7" } },
      name,
      h("div", { class: "strip-users", tip: users.join(", ") || "Nothing is routed here yet" }, isMaster ? "All channels" : users.length ? users.join(", ") : "(empty)"),
      fxSlots(isMaster ? p.mixer.master.fx : ins.fx, isMaster ? "Master" : ins.name),
      kids,
      h("div", { class: "strip-fader" }, fad, meter),
      ms,
      !isMaster && !users.length ? h("button", { class: "mini-btn del", tip: "Delete this empty insert", "aria-label": "Delete " + ins.name, onclick: () => { p.mixer.inserts = p.mixer.inserts.filter((i) => i !== ins); M.changed("mixer"); } }, "🗑") : null);
    meters.push({ canvas: meter, id: isMaster ? "master" : ins.id, peak: 0 });
    return el;
  }

  function render() {
    if (!root || !S.project) return;
    clear(strips);
    meters = [];
    const p = S.project;
    strips.append(strip(p.mixer.master, true));
    for (const ins of p.mixer.inserts) strips.append(strip(ins, false));
  }

  function drawMeters() {
    if (!root || !root.offsetParent) return;
    const eng = GBL.audio.engine;
    if (!eng.graph) return;
    for (const m of meters) {
      const an = m.id === "master" ? eng.graph.analyser : (eng.graph.inserts.get(m.id) || {}).analyser;
      const lvl = eng.level(an);
      m.peak = Math.max(lvl, m.peak * 0.92);
      const c = m.canvas, ctx = c.getContext("2d");
      const H = c.height, W = c.width;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, 0, W, H);
      const db = 20 * Math.log10(Math.max(1e-5, m.peak));
      const n = Math.max(0, Math.min(1, (db + 48) / 48));
      const g = ctx.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, "#22c55e"); g.addColorStop(0.7, "#facc15"); g.addColorStop(1, "#ef4444");
      ctx.fillStyle = g;
      ctx.fillRect(0, H - n * H, W, n * H);
    }
  }

  GBL.mixerUI = { build, render, editFx };
})();
