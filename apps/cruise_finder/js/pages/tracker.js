/* Price Tracker: re-prices saved configurations against the latest data and compares with earlier checks. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, date } = CF;

  function check(t) {
    const s = CF.data.get(t.sailingId);
    if (!s) return null;
    const q = CF.pricing.price(s, t.config);
    CF.tracker.update(t.id, (x) => {
      const last = x.checks[x.checks.length - 1];
      if (last && last.total === q.totals.total) last.at = Date.now();
      else x.checks.push({ at: Date.now(), total: q.totals.total });
      x.checks = x.checks.slice(-60);
    });
    return q;
  }

  CF.pages.tracker = {
    title: "Price Tracker",
    render(ctx) {
      const ui = CF.ui;
      const list = CF.tracker.list();
      const head = h("div", { class: "page-head" }, h("h1", null, "Price tracker"),
        h("p", { class: "muted" }, "Each tracked cruise keeps its exact travelers, stateroom and packages, so a price change is a real change, not a different configuration."),
        h("p", { class: "notice info" }, ui.icon("info"), h("span", null, "Prices are re-checked when you open this page or press Check now. The app has no server, so it can't email you; alerts appear while the app is open. The sample data doesn't change by itself: try an Admin price override to see tracking react.")));
      if (!list.length) return h("div", { class: "page wrap tracker" }, head, ui.empty("You're not tracking any cruises", "Open a cruise and choose Track price, or use Track price on the Configure page.", h("a", { class: "btn primary", href: "#/search" }, "Find a cruise")));

      const rows = list.map((t) => {
        const s = CF.data.get(t.sailingId);
        if (!s) return h("div", { class: "card pad track-card" }, h("p", null, "This sailing departed or left the data."), h("button", { class: "btn ghost sm", onClick: () => { CF.tracker.remove(t.id); ctx.rerender(); } }, "Remove"));
        const q = check(t);
        const fresh = CF.tracker.list().find((x) => x.id === t.id);
        const checks = fresh.checks;
        const first = checks[0].total, prev = checks.length > 1 ? checks[checks.length - 2].total : first, cur = q.totals.total;
        const diff = cur - prev, pct = prev ? (diff / prev) * 100 : 0;
        const sinceStart = cur - first;
        // Sample price history for this sailing (the data set's weekly snapshots), priced with the same configuration.
        const hist = (s.history || []).map((hpt, i) => ({ label: date.fmt(hpt.date), v: CF.pricing.price(s, fresh.config, { snapshot: i }).totals.total }));
        const below = t.target && cur <= t.target;
        return h("article", { class: "card pad track-card" + (below ? " hit" : "") },
          h("div", { class: "track-head" },
            h("div", null, h("h2", null, h("a", { href: `#/cruise/${s.id}` }, `${CF.data.ship(s.shipId).name} · ${date.fmt(s.depart)}`)), h("p", { class: "muted small" }, CF.data.name(s), " · ", CF.configUI.summary(CF.pricing.normalize(fresh.config)))),
            below ? ui.pill("At or below target", "good", "bell") : null),
          h("div", { class: "track-stats" },
            ui.stat("Current estimate", ui.whole(cur), h("span", null, ui.badge(ui.quoteSource(q), true))),
            ui.stat("Previous check", ui.whole(prev), date.fmtTime(checks.length > 1 ? checks[checks.length - 2].at : checks[0].at)),
            ui.stat("Change", diff ? h("span", { class: diff > 0 ? "up" : "down" }, `${CF.money.fmt(diff, { whole: true, sign: true })} (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)`) : "No change", sinceStart ? `${CF.money.fmt(sinceStart, { whole: true, sign: true })} since you started tracking` : "Same as when you started"),
            ui.stat("Last checked", date.fmtTime(checks[checks.length - 1].at), `Tracking since ${date.fmt(new Date(t.created).toISOString().slice(0, 10))}`)),
          h("div", { class: "track-row" },
            h("div", null, h("div", { class: "small muted" }, "Sample price history (weekly snapshots in the data set)"), ui.sparkline(hist, { label: `Sample price history for this configuration` })),
            h("div", { class: "track-target" },
              ui.field("Notify me when the total is at or below", ui.moneyInput(t.target, (v) => { CF.tracker.update(t.id, (x) => { x.target = v; }); ctx.rerender(); }, { id: `trk-${t.id}` })),
              t.target ? h("p", { class: "small " + (below ? "good-text" : "muted") }, below ? `${ui.whole(t.target - cur)} under your target.` : `${ui.whole(cur - t.target)} above your target.`) : null)),
          h("div", { class: "toolbar" },
            h("a", { class: "btn ghost sm", href: `#/configure/${s.id}?share=${CF.b64.enc(fresh.config)}` }, "Open configuration"),
            h("button", { class: "btn ghost sm", onClick: async () => { if (await ui.confirm("Stop tracking this cruise?", "Stop", true)) { CF.tracker.remove(t.id); ctx.rerender(); } } }, ui.icon("trash"), "Stop tracking")));
      });
      return h("div", { class: "page wrap tracker" }, head,
        h("div", { class: "toolbar" },
          h("button", { class: "btn primary", onClick: () => { ctx.rerender(); ui.toast("All tracked prices re-checked.", "good"); } }, ui.icon("bell"), "Check now"),
          "Notification" in window ? h("button", { class: "btn ghost", onClick: async () => {
            const p = await Notification.requestPermission();
            CF.settings.set("notify", p === "granted");
            ui.toast(p === "granted" ? "Browser notifications on (while the app is open)." : "Notifications weren't allowed.", p === "granted" ? "good" : "warn");
          } }, "Allow browser notifications") : null),
        rows);
    },
  };
})();
