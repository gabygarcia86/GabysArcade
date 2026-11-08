/* Search engine: filters and sorts sailings, pricing each one with the user's trip preferences.
 * Budget filters use the configured estimated total, never the advertised starting fare. */
(function () {
  "use strict";
  const CF = window.CF;
  const { date } = CF;

  const DURATIONS = [
    { id: "3-4", label: "3-4 nights", min: 3, max: 4 },
    { id: "5-6", label: "5-6 nights", min: 5, max: 6 },
    { id: "7", label: "7 nights", min: 7, max: 7 },
    { id: "8-10", label: "8-10 nights", min: 8, max: 10 },
    { id: "11-14", label: "11-14 nights", min: 11, max: 14 },
    { id: "15+", label: "15+ nights", min: 15, max: 99 },
  ];
  const SORTS = [
    { id: "total", label: "Lowest total price" },
    { id: "pp", label: "Lowest price per person" },
    { id: "night", label: "Lowest price per night" },
    { id: "shortest", label: "Shortest cruise" },
    { id: "longest", label: "Longest cruise" },
    { id: "date", label: "Departure date" },
    { id: "newest", label: "Newest ships" },
    { id: "rated", label: "Highest rated (no reliable rating data yet)", disabled: true },
  ];
  const SHIP_PRESETS = [
    { id: "any", label: "Any ship" },
    { id: "newest", label: "Newest ships (2021 and later)" },
    { id: "largest", label: "Largest ships (Icon and Oasis class)" },
  ];

  const defaults = () => ({ v: 3, dest: [], ports: [...CF.settings.homePorts()], dateMode: "any", date: "", flex: 7, months: [], from: "", to: "", year: "", durations: [], ships: [], classes: [], shipPreset: "any", maxTotal: 0, maxPP: 0, maxPerNight: 0, sort: "total" });

  function matches(s, c) {
    if (c.dest.length && !c.dest.some((d) => CF.data.matchesDest(s, d))) return false;
    if (c.ports.length && !c.ports.includes(s.port)) return false;
    if (c.durations.length && !c.durations.some((id) => { const d = DURATIONS.find((x) => x.id === id); return d && s.nights >= d.min && s.nights <= d.max; })) return false;
    const ship = CF.data.ship(s.shipId);
    if (c.ships.length && !c.ships.includes(s.shipId)) return false;
    if (c.classes.length && !c.classes.includes(ship.cls)) return false;
    if (c.shipPreset === "newest" && ship.year < 2021) return false;
    if (c.shipPreset === "largest" && !["icon", "oasis"].includes(ship.cls)) return false;
    switch (c.dateMode) {
      case "exact": if (c.date && s.depart !== c.date) return false; break;
      case "flex": if (c.date && Math.abs(date.diff(c.date, s.depart)) > (+c.flex || 0)) return false; break;
      case "month": if (c.months.length && !c.months.includes(date.month(s.depart))) return false; break;
      case "range": if ((c.from && s.depart < c.from) || (c.to && s.depart > c.to)) return false; break;
      case "year": if (c.year && s.depart.slice(0, 4) !== String(c.year)) return false; break;
    }
    return true;
  }

  const SORTERS = {
    total: (a, b) => a.q.totals.total - b.q.totals.total,
    pp: (a, b) => a.q.totals.perPerson - b.q.totals.perPerson,
    night: (a, b) => a.q.totals.perNight - b.q.totals.perNight,
    shortest: (a, b) => a.s.nights - b.s.nights || a.q.totals.total - b.q.totals.total,
    longest: (a, b) => b.s.nights - a.s.nights || a.q.totals.total - b.q.totals.total,
    date: (a, b) => (a.s.depart < b.s.depart ? -1 : a.s.depart > b.s.depart ? 1 : a.q.totals.total - b.q.totals.total),
    newest: (a, b) => CF.data.ship(b.s.shipId).year - CF.data.ship(a.s.shipId).year || (a.s.depart < b.s.depart ? -1 : 1),
  };

  function run(criteria, profile) {
    const c = { ...defaults(), ...criteria };
    const t0 = performance.now();
    const matched = [];
    for (const s of CF.data.all()) {
      if (!matches(s, c)) continue;
      const q = CF.pricing.quick(s, profile);
      if (!q.valid) continue;
      matched.push({ s, q });
    }
    const results = matched.filter(({ q }) =>
      (!c.maxTotal || q.totals.total <= c.maxTotal) && (!c.maxPP || q.totals.perPerson <= c.maxPP) && (!c.maxPerNight || q.totals.perNight <= c.maxPerNight));
    results.sort(SORTERS[c.sort] || SORTERS.total);
    CF.log.count("searches");
    return { results, matched: matched.length, overBudget: matched.length - results.length, ms: Math.round(performance.now() - t0) };
  }

  function describe(c) {
    const parts = [];
    if (c.dest.length) parts.push(c.dest.map((d) => CF.data.dest(d)?.name).join(" or "));
    if (c.ports.length) parts.push("from " + c.ports.map((p) => CF.data.port(p)?.name.split(",")[0]).join(" or "));
    if (c.durations.length) parts.push(c.durations.map((d) => DURATIONS.find((x) => x.id === d)?.label).join(" or "));
    if (c.dateMode === "exact" && c.date) parts.push("on " + date.fmt(c.date));
    if (c.dateMode === "flex" && c.date) parts.push(`within ${c.flex} days of ${date.fmt(c.date)}`);
    if (c.dateMode === "month" && c.months.length) parts.push("in " + c.months.map((m) => date.fmt(m, "monthShort")).join(", "));
    if (c.dateMode === "range" && (c.from || c.to)) parts.push(`between ${c.from ? date.fmt(c.from) : "now"} and ${c.to ? date.fmt(c.to) : "any time"}`);
    if (c.dateMode === "year" && c.year) parts.push("in " + c.year);
    if (c.ships.length) parts.push("on " + c.ships.map((s) => CF.data.ship(s).name).join(" or "));
    if (c.classes.length) parts.push(c.classes.map((k) => CF.DATA.classes[k].name).join(" or "));
    if (c.shipPreset !== "any") parts.push(SHIP_PRESETS.find((p) => p.id === c.shipPreset).label.toLowerCase());
    if (c.maxTotal) parts.push(`total under ${CF.money.fmt(c.maxTotal, { whole: true })}`);
    if (c.maxPP) parts.push(`under ${CF.money.fmt(c.maxPP, { whole: true })} per person`);
    if (c.maxPerNight) parts.push(`under ${CF.money.fmt(c.maxPerNight, { whole: true })} per night`);
    return parts.length ? parts.join(" · ") : "All sailings";
  }

  CF.search = {
    DURATIONS, SORTS, SHIP_PRESETS, defaults, matches, run, describe,
    get: () => {
      const saved = CF.store.get("search", {});
      // Searches saved before the current default ports start from the default ports once.
      if (saved.v !== 3) { delete saved.ports; saved.v = 3; }
      return { ...defaults(), ...saved };
    },
    // Default ports for a destination link: the user's default ports if any sailing there leaves from them, else any port.
    portsFor(destIds) {
      const home = CF.settings.homePorts();
      if (!home.length) return [];
      const ok = CF.data.sailings.some((s) => home.includes(s.port) && (!destIds.length || destIds.some((d) => CF.data.matchesDest(s, d))));
      return ok ? [...home] : [];
    },
    set: (c) => CF.store.set("search", c),
  };
})();
