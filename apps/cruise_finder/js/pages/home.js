/* Home dashboard. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, date } = CF;

  // Seasonal ideas by departure month (1-12).
  const SEASONS = [
    { months: [12], title: "Holiday sailings", text: "Christmas and New Year's at sea. Prices rise over the holidays; see by how much.", dest: [], kind: "night" },
    { months: [1, 2, 3], title: "Winter sun in the Caribbean", text: "Escape the cold with 7-night Caribbean sailings from Florida.", dest: ["caribbean"], kind: "tropical" },
    { months: [3, 4], title: "Spring break getaways", text: "Short Bahamas trips with a day at Perfect Day at CocoCay.", dest: ["bahamas"], kind: "island" },
    { months: [5, 6, 7, 8, 9], title: "Alaska's glacier season", text: "Whales, glaciers and gold-rush towns from Seattle and Vancouver.", dest: ["alaska"], kind: "alaska" },
    { months: [5, 6, 7, 8, 9, 10], title: "Europe in summer", text: "Mediterranean, Greek Isles, Norway and the Baltic.", dest: ["europe"], kind: "mediterranean" },
    { months: [9, 10, 11], title: "Fall value season", text: "September and October usually bring the lowest fares of the year.", dest: ["caribbean", "bahamas"], kind: "tropical" },
  ];

  function quickSearch() {
    const c = CF.search.get();
    const home = CF.settings.homePorts();
    const isHome = home.length && c.ports.length === home.length && home.every((p) => c.ports.includes(p));
    const state = { dest: c.dest[0] || "", port: isHome ? "home" : c.ports[0] || "", month: c.dateMode === "month" ? c.months[0] || "" : "" };
    const months = date.monthsBetween(date.today(), CF.data.sailings.at(-1)?.depart || date.today());
    const travelersBtn = h("button", { type: "button", class: "input travelers-btn", onClick: () => editTravelers(() => { travelersBtn.textContent = CF.ui.travelerSummary(CF.profile.get()); }) }, CF.ui.travelerSummary(CF.profile.get()));
    const go = () => {
      const n = CF.search.defaults();
      if (state.dest) n.dest = [state.dest];
      n.ports = state.port === "home" ? [...home] : state.port ? [state.port] : [];
      if (state.month) { n.dateMode = "month"; n.months = [state.month]; }
      n.sort = c.sort || "total";
      CF.search.set(n);
      CF.router.go("#/search");
    };
    return h("form", { class: "quick-search", onSubmit: (e) => { e.preventDefault(); go(); } },
      CF.ui.field("Where to?", CF.ui.select([{ id: "", label: "Anywhere" }, ...CF.DATA.destinations], state.dest, (v) => (state.dest = v), { id: "qs-dest" })),
      CF.ui.field("Leaving from", CF.ui.select([...(home.length ? [{ id: "home", label: `${CF.settings.homePortsLabel()} (my default)` }] : []), { id: "", label: "Any port" }, ...CF.data.departurePorts().map((p) => ({ id: p.id, label: p.name }))], state.port, (v) => (state.port = v), { id: "qs-port" })),
      CF.ui.field("When", CF.ui.select([{ id: "", label: "Any time" }, ...months.map((m) => ({ id: m, label: date.fmt(m, "month") }))], state.month, (v) => (state.month = v), { id: "qs-month" })),
      CF.ui.field("Travelers", travelersBtn),
      h("button", { class: "btn primary big", type: "submit" }, CF.ui.icon("search"), "Find My Cruise"));
  }

  function editTravelers(done) {
    let p = CF.profile.get();
    CF.ui.modal({
      title: "Who's traveling?",
      body: CF.ui.travelers(p, (n) => { p = n; }, { idPrefix: "mt" }),
      actions: [{ label: "Cancel" }, { label: "Done", primary: true, onClick: () => { CF.profile.set(CF.pricing.normalize(p)); done?.(); } }],
    });
  }
  CF.editTravelers = editTravelers;

  function lowestBy(filterFn, profile) {
    let best = null, count = 0;
    for (const s of CF.data.all()) {
      if (!filterFn(s)) continue;
      count++;
      const q = CF.pricing.quick(s, profile);
      if (q.valid && (!best || q.totals.total < best.q.totals.total)) best = { s, q };
    }
    return { best, count };
  }

  CF.pages.home = {
    title: "",
    render(ctx) {
      const { ui } = CF;
      const profile = CF.profile.get();
      ctx.on("profile", () => ctx.rerender());
      const hero = h("section", { class: "hero" },
        h("div", { class: "hero-art", html: CF.art.scene("hero", { ship: "icon", shipScale: 0.42, shipX: 660, w: 1200, h: 520, horizon: 0.66, sunX: 840, label: "A cruise ship at sunset" }) }),
        h("div", { class: "hero-inner" },
          h("p", { class: "eyebrow" }, "Your personal Royal Caribbean price planner"),
          h("h1", null, "Know what your cruise will really cost before you book."),
          h("p", { class: "hero-sub" }, "Find a sailing, add the drinks, Wi-Fi, gratuities, excursions and flights you'd actually buy, and see one honest total you can compare side by side."),
          quickSearch()));

      const tiles = h("section", { class: "tiles" },
        tile("#/compare", "compare", "Compare cruises", `${CF.compare.items().length} of ${CF.compare.MAX} selected. Same travelers and choices for every cruise.`),
        tile("#/dates", "calendar", "Find the cheapest dates", "See which departure dates cost the least, ranked by complete total."),
        tile("#/assistant", "sparkle", "Ask the travel agent", "\"7-night Caribbean from Florida under $4,000\""),
        tile("#/tracker", "chart", "Track a price", `${CF.tracker.list().length} cruise${CF.tracker.list().length === 1 ? "" : "s"} tracked against your budget.`));

      // Popular destinations with the lowest complete total for the current travelers.
      const popular = ["caribbean", "bahamas", "cococay", "alaska", "mediterranean", "mexico", "northern", "australia"];
      const destGrid = h("div", { class: "dest-grid" }, popular.map((id) => {
        const d = CF.data.dest(id);
        const { best, count } = lowestBy((s) => CF.data.matchesDest(s, id), profile);
        return h("a", { class: "dest-card", href: "#/search", onClick: () => { const n = CF.search.defaults(); n.dest = [id]; n.ports = CF.search.portsFor([id]); CF.search.set(n); } },
          h("div", { class: "dest-art", html: CF.art.dest(id, { w: 400, h: 220 }) }),
          h("div", { class: "dest-body" }, h("h3", null, d.name), h("p", { class: "muted small" }, d.blurb),
            h("p", { class: "dest-price" }, best ? [h("span", { class: "muted small" }, "Complete trip from "), h("strong", null, ui.whole(best.q.totals.total))] : "No sailings in the sample data",
              h("span", { class: "muted small" }, ` · ${CF.plural(count, "sailing")}`))));
      }));

      // Featured deals: sailings with a sample promotion, cheapest per guest per night first.
      const deals = CF.data.all().filter((s) => s.promo && date.diff(date.today(), s.depart) < 240)
        .map((s) => ({ s, q: CF.pricing.quick(s, profile) })).filter((x) => x.q.valid)
        .sort((a, b) => a.q.totals.perPersonPerNight - b.q.totals.perPersonPerNight).slice(0, 4);

      // Seasonal recommendations for the next three months.
      const now = +date.today().slice(5, 7);
      const upcoming = [0, 1, 2, 3].map((i) => ((now - 1 + i) % 12) + 1);
      const seasonal = SEASONS.filter((x) => x.months.some((m) => upcoming.includes(m))).slice(0, 3);
      const seasonGrid = h("div", { class: "season-grid" }, seasonal.map((x) => {
        const months = x.months.map((m) => { const y = m >= now ? +date.today().slice(0, 4) : +date.today().slice(0, 4) + 1; return `${y}-${String(m).padStart(2, "0")}`; });
        return h("a", { class: "season-card", href: "#/search", onClick: () => { const n = CF.search.defaults(); n.dest = x.dest; n.ports = CF.search.portsFor(x.dest); n.dateMode = "month"; n.months = months; CF.search.set(n); } },
          h("div", { class: "season-art", html: CF.art.scene(x.kind, { w: 600, h: 260 }) }),
          h("div", { class: "season-body" }, h("h3", null, x.title), h("p", { class: "muted" }, x.text), h("span", { class: "link" }, "See sailings ", ui.icon("chevron"))));
      }));

      const recent = CF.saved.recent().map((id) => CF.data.get(id)).filter(Boolean).slice(0, 4);
      const favs = CF.saved.favorites().map((id) => CF.data.get(id)).filter(Boolean).slice(0, 4);
      const cards = (list) => h("div", { class: "card-grid" }, list.map((s) => ui.cruiseCard(s, CF.pricing.quick(s, profile), { compact: true })));

      return h("div", { class: "page home" },
        hero,
        h("div", { class: "wrap" },
          ui.sampleNotice(),
          tiles,
          h("section", { class: "section" }, h("div", { class: "section-head" }, h("h2", null, "Popular destinations"), h("p", { class: "muted" }, `Totals for ${ui.travelerSummary(profile)}, using your trip preferences. `, h("a", { href: "#/settings" }, "Change preferences"))), destGrid),
          deals.length ? h("section", { class: "section" }, h("div", { class: "section-head" }, h("h2", null, "Featured deals"), h("p", { class: "muted" }, "Sailings with a sample promotion, ranked by complete cost per guest per night. A lower advertised fare alone never makes a deal.")), cards(deals.map((d) => d.s))) : null,
          h("section", { class: "section" }, h("div", { class: "section-head" }, h("h2", null, "Coming up this season")), seasonGrid),
          recent.length ? h("section", { class: "section" }, h("div", { class: "section-head" }, h("h2", null, "Recently viewed")), cards(recent)) : null,
          favs.length ? h("section", { class: "section" }, h("div", { class: "section-head" }, h("h2", null, "Your saved cruises"), h("a", { href: "#/saved" }, "See all saved")), cards(favs)) : null,
          h("section", { class: "section how" }, h("h2", null, "How the totals work"),
            h("div", { class: "how-grid" },
              how("1", "Advertised fares leave things out", "A \"from $499\" fare is per person, for two people sharing the cheapest room, before taxes, gratuities and anything you'd buy onboard."),
              how("2", "We add everything you choose", "Taxes and fees, daily gratuities, drink and Wi-Fi packages, dining, excursions, insurance, flights, hotels and parking, each on its own line."),
              how("3", "Every number says where it came from", "Sample data, reference rate, estimate or your own entry. Nothing is presented as a live, confirmed price unless it is one.")))));
    },
  };
  function tile(href, ic, title, text) {
    return h("a", { class: "tile", href }, h("span", { class: "tile-icon" }, CF.ui.icon(ic)), h("span", null, h("strong", null, title), h("span", { class: "muted small" }, text)));
  }
  function how(n, t, p) { return h("div", { class: "how-item" }, h("span", { class: "step-num" }, n), h("h3", null, t), h("p", { class: "muted" }, p)); }
})();
