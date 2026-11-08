/* Cruise Pricing Configurator: the eight steps on the left, a live total on the right, and the full itemized
 * breakdown directly underneath. Every change re-prices immediately. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, date, clear } = CF;

  const drafts = {
    get: (id) => CF.store.get("drafts", {})[id],
    set: (id, cfg) => CF.store.update("drafts", {}, (d) => {
      d[id] = cfg;
      const keys = Object.keys(d);
      if (keys.length > 20) delete d[keys[0]];
    }),
    clear: (id) => CF.store.update("drafts", {}, (d) => { delete d[id]; }),
  };

  CF.pages.configure = {
    title: "Configure pricing",
    nav: "search",
    render(ctx) {
      const ui = CF.ui;
      const s = CF.data.get(ctx.params[0]);
      if (!s) return CF.pages.notfound.render();
      const ship = CF.data.ship(s.shipId);
      ctx.setTitle(`Price ${CF.data.name(s)}`);
      CF.saved.addRecent(s.id);

      // Where the configuration comes from
      let mode = "draft", savedCfg = null;
      let cfg;
      if (ctx.query.cfg) { savedCfg = CF.saved.configs().find((c) => c.id === ctx.query.cfg); if (savedCfg) { cfg = savedCfg.config; mode = "saved"; } }
      if (!cfg && ctx.query.share) { try { cfg = CF.b64.dec(ctx.query.share); mode = "shared"; } catch (e) { ui.toast("That share link couldn't be read, so your trip preferences are used instead.", "warn"); } }
      if (!cfg && ctx.query.cmp) { const it = CF.compare.items().find((x) => x.id === s.id); cfg = it?.config || CF.profile.get(); mode = "compare"; }
      if (!cfg) cfg = drafts.get(s.id) || CF.profile.get();
      cfg = CF.pricing.normalize(cfg);

      let q = CF.pricing.price(s, cfg);
      let lastTotal = q.totals.total, lastDelta = 0;
      const stepsEl = h("div");
      const sideEl = h("aside", { class: "cfg-side", "aria-label": "Live price summary" });
      const bdEl = h("div", { id: "breakdown" });
      const barEl = h("div", { class: "cfg-mobilebar" });

      const onChange = (n) => {
        cfg = CF.pricing.normalize(n);
        q = CF.pricing.price(s, cfg);
        lastDelta = q.totals.total - lastTotal;
        lastTotal = q.totals.total;
        if (mode === "draft" || mode === "shared") drafts.set(s.id, cfg);
        if (mode === "compare") CF.compare.setConfig(s.id, cfg);
        CF.configUI.rerenderKeepFocus(stepsEl, () => CF.configUI.steps(cfg, s, onChange));
        drawSide();
        clear(bdEl).append(ui.breakdown(q));
      };

      function drawSide() {
        const T = q.totals;
        clear(sideEl).append(h("div", { class: "price-box sticky" },
          h("div", { class: "est-label" }, "Estimated vacation total ", ui.badge(ui.quoteSource(q), true)),
          h("div", { class: "est-total big", "aria-live": "polite" }, ui.whole(T.total)),
          lastDelta ? h("div", { class: "delta " + (lastDelta > 0 ? "up" : "down") }, `Last change: ${CF.money.fmt(lastDelta, { whole: true, sign: true })}`) : null,
          h("div", { class: "est-sub" }, `${ui.whole(T.perPerson)} per person · ${ui.whole(T.perNight)} per night`),
          ui.composition(q),
          h("dl", { class: "mini-bd" },
            h("dt", null, "Cruise only"), h("dd", null, ui.whole(T.cruiseOnly)),
            h("dt", null, "Optional extras"), h("dd", null, ui.whole(T.optional)),
            h("dt", null, "Travel"), h("dd", null, ui.whole(T.travel)),
            h("dt", null, "Taxes & fees (in cruise only)"), h("dd", null, ui.whole(T.taxes)),
            h("dt", null, q.payments.pastFinal ? "Due at booking" : "Deposit at booking"), h("dd", null, ui.whole(q.payments.deposit))),
          q.notices.filter((n) => n.level !== "info").map((n) => h("p", { class: "est-warn" }, ui.icon("warn"), n.text)),
          !q.valid ? h("p", { class: "est-warn" }, "This configuration can't be booked as is. Fix the issues above.") : null,
          h("a", { class: "btn ghost block", href: "#breakdown", onClick: (e) => { e.preventDefault(); bdEl.scrollIntoView({ behavior: "smooth" }); } }, "See every line item")));
        clear(barEl).append(h("div", null, h("div", { class: "small muted" }, "Estimated total"), h("strong", null, ui.whole(T.total)), h("span", { class: "small muted" }, ` · ${ui.whole(T.perPerson)}/person`)),
          h("button", { class: "btn primary sm", onClick: () => bdEl.scrollIntoView({ behavior: "smooth" }) }, "Breakdown"));
      }

      const actions = h("div", { class: "toolbar" },
        h("button", { class: "btn primary", onClick: async () => {
          if (savedCfg) { CF.saved.updateConfig(savedCfg.id, { config: cfg, total: q.totals.total }); ui.toast(`Updated "${savedCfg.name}".`, "good"); return; }
          const name = await ui.prompt("Save this configuration", "Name", `${ship.name.replace(" of the Seas", "")} ${date.fmt(s.depart, "short")} · ${CF.data.category(q.rooms[0]?.cat || "BAL").name}`);
          if (!name) return;
          savedCfg = CF.saved.saveConfig(s.id, cfg, name, q.totals.total);
          ui.toast("Saved. Find it in My Saved > Configurations.", "good");
        } }, ui.icon("heart"), savedCfg ? "Update saved" : "Save configuration"),
        h("button", { class: "btn ghost", onClick: () => { if (CF.compare.items().length >= CF.compare.MAX && !CF.compare.has(s.id)) return ui.toast(`Compare holds ${CF.compare.MAX} cruises. Remove one first.`, "warn"); CF.compare.add(s.id, cfg); ui.toast("Added to compare with this exact configuration.", "good"); } }, ui.icon("compare"), "Compare with these choices"),
        h("button", { class: "btn ghost", onClick: () => CF.actions.trackPrice(s, cfg) }, ui.icon("bell"), "Track price"),
        h("details", { class: "menu" }, h("summary", { class: "btn ghost" }, ui.icon("download"), "Export"),
          h("div", { class: "menu-pop" },
            h("button", { class: "menu-item", onClick: () => CF.exporter.quotePdf(s, q) }, ui.icon("download"), "Download PDF breakdown"),
            h("button", { class: "menu-item", onClick: () => CF.exporter.quoteCsv(s, q) }, ui.icon("download"), "Download CSV"),
            h("button", { class: "menu-item", onClick: () => window.print() }, ui.icon("print"), "Print"),
            h("button", { class: "menu-item", onClick: () => CF.exporter.copy(CF.exporter.shareUrl(`#/configure/${s.id}`, cfg)) }, ui.icon("share"), "Copy share link"))),
        h("details", { class: "menu" }, h("summary", { class: "btn ghost" }, "More"),
          h("div", { class: "menu-pop" },
            h("button", { class: "menu-item", onClick: () => { cfg = CF.profile.get(); lastTotal = q.totals.total; drafts.clear(s.id); onChange(cfg); ui.toast("Reset to your trip preferences."); } }, "Reset to my trip preferences"),
            h("button", { class: "menu-item", onClick: async () => {
              if (!(await ui.confirm("Use these travelers and choices as your trip preferences? Search results and new comparisons will use them. Ship-specific picks (restaurants, excursions) are turned into general amounts.", "Use as preferences"))) return;
              const p = CF.clone(cfg);
              p.rooms.forEach((r) => r.guests.forEach((g) => { if (g.exc.mode === "pick") g.exc = { mode: "none", budget: 0, picks: {} }; g.dining.picks = {}; }));
              CF.profile.set(p);
              ui.toast("Trip preferences updated.", "good");
            } }, "Use as my trip preferences"),
            h("a", { class: "menu-item", href: `#/cruise/${s.id}` }, "Back to cruise details"),
            h("a", { class: "menu-item", href: CF.data.line().bookingUrl, target: "_blank", rel: "noopener" }, "Continue to Royal Caribbean ", ui.icon("external")))));

      stepsEl.append(CF.configUI.steps(cfg, s, onChange));
      drawSide();
      bdEl.append(ui.breakdown(q));
      const modeNote = { saved: `Editing saved configuration "${savedCfg?.name}".`, shared: "Opened from a share link. Changes stay in this browser.", compare: "Editing this cruise's configuration in your comparison. Changes apply to the comparison immediately.", draft: "Starts from your trip preferences. Your changes are remembered for this sailing." }[mode];

      return h("div", { class: "page wrap configure" },
        h("div", { class: "cfg-head" },
          h("div", { class: "cfg-thumb", html: CF.art.sailing(s, { w: 320, h: 180 }) }),
          h("div", null,
            h("p", { class: "eyebrow" }, `${ship.name} · ${date.fmt(s.depart, "dow")} – ${date.fmt(s.ret, "short")}`),
            h("h1", null, "Price your vacation: ", CF.data.name(s)),
            h("p", { class: "muted" }, `${s.nights} nights from ${CF.data.port(s.port).name} · ${ui.itinerarySummary(s)}`),
            h("p", { class: "small" }, ui.icon("info"), " ", modeNote))),
        ui.sampleNotice(true),
        actions,
        h("div", { class: "cfg-layout" }, h("div", { class: "cfg-main" }, stepsEl, h("h2", { class: "bd-title" }, "Complete vacation cost breakdown"), bdEl), sideEl),
        barEl);
    },
  };
})();
