/* Find the Cheapest Dates: every matching departure ranked by the complete configured total, shown as a
 * calendar and a table. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, date, clear } = CF;

  const DEFAULT = { v: 2, dest: "caribbean", port: "home", duration: "7", category: "BAL", from: "", to: "" };

  CF.pages.dates = {
    title: "Cheapest Dates",
    render(ctx) {
      const ui = CF.ui;
      const lastDep = CF.data.sailings.at(-1)?.depart || date.today();
      const months = date.monthsBetween(date.today(), lastDep);
      let f = { ...DEFAULT, from: months[0], to: months[Math.min(2, months.length - 1)], ...CF.store.get("datesForm", {}) };
      if (f.v !== 2) { f.port = "home"; f.v = 2; } // forms saved before default ports existed
      const home = CF.settings.homePorts();
      if (f.port === "home" && !home.length) f.port = "";
      if (!months.includes(f.from)) f.from = months[0];
      if (!months.includes(f.to) || f.to < f.from) f.to = months[Math.min(months.indexOf(f.from) + 2, months.length - 1)];
      const formEl = h("div", { class: "dates-form card pad" });
      const outEl = h("div", { "aria-live": "polite" });
      const set = (patch) => { f = { ...f, ...patch }; if (f.to < f.from) f.to = f.from; CF.store.set("datesForm", f); CF.configUI.rerenderKeepFocus(formEl, form); run(); };

      function form() {
        return h("div", { class: "grid-form" },
          ui.field("Destination", ui.select([{ id: "", label: "Anywhere" }, ...CF.DATA.destinations], f.dest, (v) => set({ dest: v }), { id: "d-dest" })),
          ui.field("Departure port", ui.select([...(home.length ? [{ id: "home", label: `${CF.settings.homePortsLabel()} (my default)` }] : []), { id: "", label: "Any port" }, ...CF.data.departurePorts().map((p) => ({ id: p.id, label: p.name }))], f.port, (v) => set({ port: v }), { id: "d-port" })),
          ui.field("Cruise length", ui.select([{ id: "", label: "Any length" }, ...CF.search.DURATIONS.map((d) => ({ id: d.id, label: d.label }))], f.duration, (v) => set({ duration: v }), { id: "d-dur" })),
          ui.field("Stateroom", ui.select(Object.entries(CF.DATA.categories).map(([id, d]) => ({ id, label: d.name })), f.category, (v) => set({ category: v }), { id: "d-cat" })),
          ui.field("From month", ui.select(months.map((m) => ({ id: m, label: date.fmt(m, "month") })), f.from, (v) => set({ from: v }), { id: "d-from" })),
          ui.field("To month", ui.select(months.filter((m) => m >= f.from).map((m) => ({ id: m, label: date.fmt(m, "month") })), f.to, (v) => set({ to: v }), { id: "d-to" })),
          ui.field("Travelers", h("button", { type: "button", class: "input travelers-btn", id: "d-trav", onClick: () => CF.editTravelers(() => { CF.configUI.rerenderKeepFocus(formEl, form); run(); }) }, ui.travelerSummary(CF.profile.get()))));
      }

      function run() {
        const profile = CF.clone(CF.profile.get());
        profile.rooms.forEach((r) => (r.category = f.category));
        const c = { ...CF.search.defaults(), dest: f.dest ? [f.dest] : [], ports: f.port === "home" ? [...home] : f.port ? [f.port] : [], durations: f.duration ? [f.duration] : [], dateMode: "range", from: f.from + "-01", to: date.endOfMonth(f.to), sort: "date" };
        const { results } = CF.search.run(c, profile);
        clear(outEl);
        if (!results.length) { outEl.append(ui.empty("No sailings found", "Try another month range, any departure port or any length.")); return; }
        // Cheapest sailing per departure date
        const byDate = new Map();
        for (const r of results) { const cur = byDate.get(r.s.depart); if (!cur || r.q.totals.total < cur.q.totals.total) byDate.set(r.s.depart, { ...r, count: (cur?.count || 0) + 1 }); else cur.count++; }
        const days = [...byDate.values()];
        const sorted = [...days].sort((a, b) => a.q.totals.total - b.q.totals.total);
        const low = sorted[0].q.totals.total;
        const q1 = sorted[Math.floor(sorted.length * 0.25)].q.totals.total, q2 = sorted[Math.floor(sorted.length * 0.5)].q.totals.total, q3 = sorted[Math.floor(sorted.length * 0.75)].q.totals.total;
        const tier = (t) => (t <= q1 ? 1 : t <= q2 ? 2 : t <= q3 ? 3 : 4);
        const subs = results.filter((r) => r.q.substituted).length;

        const best = sorted[0];
        outEl.append(h("div", { class: "best-banner" },
          h("div", null, h("div", { class: "hl-label" }, "Lowest estimated total"), h("div", { class: "hl-value" }, ui.whole(low)),
            h("div", null, `${date.fmt(best.s.depart, "long")} on ${CF.data.ship(best.s.shipId).name}`), h("div", { class: "muted small" }, `${CF.data.name(best.s)} · ${ui.whole(best.q.totals.perPerson)} per person`)),
          h("div", { class: "banner-actions" }, h("a", { class: "btn primary", href: `#/configure/${best.s.id}` }, "Configure this one"), ui.compareButton(best.s.id))),
          h("p", { class: "muted small" }, `${CF.plural(results.length, "sailing")} on ${CF.plural(days.length, "departure date")}. Ranked by complete estimated total for ${CF.configUI.summary(profile)}, not by cruise fare.`,
            subs ? ` ${subs} sailing${subs > 1 ? "s use" : " uses"} a different category because ${CF.DATA.categories[f.category].name} isn't available there.` : ""));

        // Calendar
        const cal = h("div", { class: "cal-wrap" });
        for (const m of date.monthsBetween(f.from, f.to)) {
          const first = m + "-01";
          const lead = date.dow(first);
          const last = +date.endOfMonth(m).slice(8);
          const cells = [];
          for (let i = 0; i < lead; i++) cells.push(h("div", { class: "cal-cell blank", "aria-hidden": "true" }));
          for (let d = 1; d <= last; d++) {
            const iso = `${m}-${String(d).padStart(2, "0")}`;
            const r = byDate.get(iso);
            cells.push(r
              ? h("a", { class: `cal-cell has t${tier(r.q.totals.total)}${r.q.totals.total === low ? " lowest" : ""}`, href: `#/cruise/${r.s.id}`, "data-tip": `${date.fmt(iso, "dow")}: ${ui.whole(r.q.totals.total)} on ${CF.data.ship(r.s.shipId).name}${r.count > 1 ? ` (cheapest of ${r.count})` : ""}`, "aria-label": `${date.fmt(iso, "long")}, ${ui.whole(r.q.totals.total)} on ${CF.data.ship(r.s.shipId).name}` },
                h("span", { class: "cal-day" }, d), h("span", { class: "cal-price" }, ui.whole(r.q.totals.total)), r.q.totals.total === low ? h("span", { class: "cal-flag" }, "Lowest") : null)
              : h("div", { class: "cal-cell" }, h("span", { class: "cal-day" }, d)));
          }
          cal.append(h("div", { class: "cal-month" }, h("h3", null, date.fmt(m, "month")),
            h("div", { class: "cal-grid" }, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => h("div", { class: "cal-dow" }, d)), cells)));
        }
        outEl.append(h("section", { class: "section" }, h("div", { class: "section-head" }, h("h2", null, "Calendar"),
          h("div", { class: "legend" }, h("span", { class: "small muted" }, "Stronger blue = higher total:"), [1, 2, 3, 4].map((t) => h("span", { class: `sw cal-t t${t}` }))), ), cal));

        // Table
        outEl.append(h("section", { class: "section" }, h("h2", null, "All departure dates"),
          h("div", { class: "table-wrap" }, h("table", { class: "data" },
            h("thead", null, h("tr", null, h("th", null, "Departure date"), h("th", null, "Ship"), h("th", { class: "num" }, "Nights"), h("th", { class: "num" }, "Estimated total"), h("th", { class: "num" }, "Vs. lowest"), h("th", null, ""))),
            h("tbody", null, days.map((r) => h("tr", { class: r.q.totals.total === low ? "best-row" : "" },
              h("td", null, date.fmt(r.s.depart, "dow")), h("td", null, CF.data.ship(r.s.shipId).name, r.count > 1 ? h("span", { class: "muted small" }, ` (+${r.count - 1} other)`) : null),
              h("td", { class: "num" }, r.s.nights),
              h("td", { class: "num" }, h("strong", null, ui.whole(r.q.totals.total)), r.q.totals.total === low ? [" ", ui.pill("Lowest", "best")] : null),
              h("td", { class: "num" }, r.q.totals.total === low ? "–" : CF.money.fmt(r.q.totals.total - low, { whole: true, sign: true })),
              h("td", null, h("a", { href: `#/configure/${r.s.id}` }, "Configure")))))))));
      }

      formEl.append(form());
      run();
      return h("div", { class: "page wrap dates" },
        h("div", { class: "page-head" }, h("h1", null, "Find the cheapest dates"), h("p", { class: "muted" }, "Pick where, how long and who's going. Every matching departure is priced with your full configuration, so the cheapest date is the one that's cheapest overall."), ui.sampleNotice(true)),
        formEl, outEl);
    },
  };
})();
