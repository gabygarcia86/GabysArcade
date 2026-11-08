/* Find Cruises: filters on the left, live results on the right. Nothing reloads; criteria persist. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, date, clear } = CF;
  const PAGE = 20;

  CF.pages.search = {
    title: "Find Cruises",
    render(ctx) {
      const ui = CF.ui;
      let c = CF.search.get();
      let shown = PAGE;
      const resultsEl = h("div", { class: "results", "aria-live": "polite" });
      const filtersEl = h("aside", { class: "filters", "aria-label": "Search filters" });
      const prefsEl = h("div", { class: "prefs-bar" });

      const update = (patch, redrawFilters = true) => {
        c = { ...c, ...patch };
        CF.search.set(c);
        shown = PAGE;
        if (redrawFilters) CF.configUI.rerenderKeepFocus(filtersEl, buildFilters);
        drawResults();
      };

      function buildFilters() {
        const ports = CF.data.departurePorts();
        const months = date.monthsBetween(date.today(), CF.data.sailings.at(-1)?.depart || date.today());
        const years = [...new Set(CF.data.sailings.map((s) => s.depart.slice(0, 4)))];
        const group = (title, ...body) => h("details", { class: "filter-group", open: true, id: "fg-" + title.toLowerCase().replace(/\W+/g, "-") }, h("summary", null, title), h("div", { class: "fg-body" }, body));
        const dateInputs = {
          any: null,
          exact: ui.field("Departure date", h("input", { class: "input", type: "date", id: "f-date", value: c.date, min: date.today(), onChange: (e) => update({ date: e.target.value }) })),
          flex: [ui.field("Around this date", h("input", { class: "input", type: "date", id: "f-flexdate", value: c.date, min: date.today(), onChange: (e) => update({ date: e.target.value }) })),
            ui.field("Days before or after", ui.select([3, 7, 14, 21, 30].map((d) => ({ id: d, label: `± ${d} days` })), c.flex, (v) => update({ flex: +v }), { id: "f-flex" }))],
          month: ui.chips(months.map((m) => ({ id: m, label: date.fmt(m, "monthShort") })), c.months, (v) => update({ months: v }), "Months"),
          range: [ui.field("From", h("input", { class: "input", type: "date", id: "f-from", value: c.from, onChange: (e) => update({ from: e.target.value }) })),
            ui.field("To", h("input", { class: "input", type: "date", id: "f-to", value: c.to, onChange: (e) => update({ to: e.target.value }) }))],
          year: ui.select([{ id: "", label: "Choose a year" }, ...years.map((y) => ({ id: y, label: y }))], c.year, (v) => update({ year: v }), { id: "f-year", "aria-label": "Year" }),
        };
        return h("div", null,
          h("div", { class: "filters-head" }, h("h2", null, "Filters"), h("button", { class: "btn ghost sm", onClick: () => update({ ...CF.search.defaults(), sort: c.sort }) }, "Reset")),
          group("Destination", ui.chips(CF.DATA.destinations.map((d) => ({ id: d.id, label: d.name })), c.dest, (v) => update({ dest: v }), "Destinations")),
          group("Departure port",
            ui.chips(ports.map((p) => ({ id: p.id, label: p.name.replace(", Florida", ", FL").replace(", California", ", CA").replace(", Washington", ", WA").replace(", Texas", ", TX").replace(", New Jersey", ", NJ").replace(", Maryland", ", MD") })), c.ports, (v) => update({ ports: v }), "Departure ports"),
            h("button", { type: "button", class: "link-btn", onClick: () => update({ ports: ports.filter((p) => p.state === "FL").map((p) => p.id) }) }, "All Florida ports")),
          group("Travel dates",
            ui.select([{ id: "any", label: "Any time" }, { id: "exact", label: "Exact departure date" }, { id: "flex", label: "Flexible around a date" }, { id: "month", label: "Pick months" }, { id: "range", label: "Date range" }, { id: "year", label: "A whole year" }], c.dateMode, (v) => update({ dateMode: v }), { id: "f-datemode", "aria-label": "Date search type" }),
            dateInputs[c.dateMode]),
          group("Cruise length", ui.chips(CF.search.DURATIONS.map((d) => ({ id: d.id, label: d.label })), c.durations, (v) => update({ durations: v }), "Cruise length")),
          group("Ship",
            ui.select(CF.search.SHIP_PRESETS, c.shipPreset, (v) => update({ shipPreset: v }), { id: "f-preset", "aria-label": "Ship preset" }),
            h("p", { class: "field-label" }, "Ship class"),
            ui.chips(Object.entries(CF.DATA.classes).map(([id, k]) => ({ id, label: k.name.replace(" Class", "") })), c.classes, (v) => update({ classes: v }), "Ship classes"),
            h("details", { class: "ship-list", id: "fg-ships", open: c.ships.length ? true : undefined }, h("summary", null, `Specific ships${c.ships.length ? ` (${c.ships.length})` : ""}`),
              h("div", { class: "checks" }, [...CF.DATA.ships].sort((a, b) => b.year - a.year).map((s) => h("label", { class: "check" },
                h("input", { type: "checkbox", id: "f-ship-" + s.id, checked: c.ships.includes(s.id) || undefined, onChange: (e) => update({ ships: e.target.checked ? [...c.ships, s.id] : c.ships.filter((x) => x !== s.id) }) }),
                `${s.name} (${s.year})`))))),
          group("Budget",
            h("p", { class: "muted small" }, "Uses your complete estimated total, not the advertised fare."),
            ui.field("Maximum total vacation cost", ui.moneyInput(c.maxTotal, (v) => update({ maxTotal: v }), { id: "f-maxtotal" })),
            ui.field("Maximum per person", ui.moneyInput(c.maxPP, (v) => update({ maxPP: v }), { id: "f-maxpp" })),
            ui.field("Maximum per night", ui.moneyInput(c.maxPerNight, (v) => update({ maxPerNight: v }), { id: "f-maxnight" }))));
      }

      function drawPrefs() {
        const p = CF.profile.get();
        clear(prefsEl).append(
          h("div", null, h("strong", null, "Totals assume: "), CF.configUI.summary(p)),
          h("div", { class: "prefs-actions" },
            h("button", { class: "btn ghost sm", onClick: () => CF.editTravelers(() => { drawPrefs(); drawResults(); }) }, ui.icon("user"), "Travelers"),
            ui.select(Object.entries(CF.DATA.categories).map(([id, d]) => ({ id, label: d.name })), p.rooms[0].category, (v) => { const n = CF.profile.get(); n.rooms.forEach((r) => (r.category = v)); CF.profile.set(n); drawPrefs(); drawResults(); }, { id: "f-cat", "aria-label": "Stateroom category for totals" }),
            h("a", { class: "btn ghost sm", href: "#/settings" }, ui.icon("settings"), "All trip preferences")));
      }

      function drawResults() {
        const profile = CF.profile.get();
        const { results, overBudget, ms } = CF.search.run(c, profile);
        clear(resultsEl);
        resultsEl.append(h("div", { class: "results-head" },
          h("div", null, h("h2", null, `${results.length.toLocaleString()} sailing${results.length === 1 ? "" : "s"}`), h("p", { class: "muted small" }, CF.search.describe(c), ` · ${ms} ms`),
            overBudget ? h("p", { class: "small warn-text" }, ui.icon("info"), ` ${overBudget} more match your filters but are over budget.`) : null),
          h("label", { class: "sort" }, h("span", { class: "small muted" }, "Sort by"),
            ui.select(CF.search.SORTS.map((s) => ({ id: s.id, label: s.label, disabled: s.disabled })), c.sort, (v) => update({ sort: v }, false), { id: "f-sort" }))));
        if (!results.length) {
          resultsEl.append(ui.empty("No sailings match", overBudget ? "Everything that matches is over your budget. Try raising it or changing travelers and choices." : "Try fewer filters, other dates or another departure port.", h("button", { class: "btn primary", onClick: () => update({ ...CF.search.defaults(), sort: c.sort }) }, "Clear filters")));
          return;
        }
        const list = h("div", { class: "card-list" }, results.slice(0, shown).map(({ s, q }) => ui.cruiseCard(s, q)));
        resultsEl.append(list);
        if (results.length > shown) resultsEl.append(h("div", { class: "more" }, h("button", { class: "btn ghost", onClick: () => { shown += PAGE; const extra = results.slice(shown - PAGE, shown); extra.forEach(({ s, q }) => list.append(ui.cruiseCard(s, q))); if (results.length <= shown) resultsEl.lastChild.remove(); else resultsEl.lastChild.firstChild.textContent = `Show more (${results.length - shown} left)`; } }, `Show more (${results.length - shown} left)`)));
      }

      ctx.on("compare", () => {});
      filtersEl.append(buildFilters());
      drawPrefs();
      drawResults();
      const toggle = h("button", { class: "btn ghost filters-toggle", "aria-expanded": "false", onClick: (e) => { const open = document.body.classList.toggle("filters-open"); e.currentTarget.setAttribute("aria-expanded", String(open)); } }, ui.icon("list"), "Filters");
      return h("div", { class: "page wrap search-page" },
        h("div", { class: "page-head" }, h("h1", null, "Find your cruise"), ui.sampleNotice(true)),
        prefsEl,
        toggle,
        h("div", { class: "search-layout" }, filtersEl, resultsEl));
    },
  };
})();
