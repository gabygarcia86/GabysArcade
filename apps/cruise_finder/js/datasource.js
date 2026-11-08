/* Data layer. Everything the UI knows about sailings comes through CF.data.
 *
 * Source priority (highest first), matching the project brief:
 *   1. Official Royal Caribbean API          - not available publicly; shown as "not connected"
 *   2. Authorized booking/inventory provider - would be wired up server-side (keys never reach the browser)
 *   3. Licensed cruise data service          - same
 *   4. Manually maintained data              - JSON imported in Admin, stored in this browser
 *   5. Built-in sample data                  - generated below, always labelled "Sample"
 * Admin price overrides sit on top of whichever source supplied a sailing and are labelled "Override".
 *
 * Sailings carry `line` so other cruise lines could be added as further providers later. */
(function () {
  "use strict";
  const CF = window.CF;
  const D = CF.DATA;
  const { date, rng, money } = CF;

  const SAMPLE_DATASET = "2026-11-07"; // version stamp of the sample data set
  const pad = (n) => String(n).padStart(2, "0");

  /* ---------- sample price model (all made up, deterministic per sailing) ---------- */
  const CLASS_BASE = { icon: 26000, oasis: 20000, quantumUltra: 18000, quantum: 16500, freedom: 14000, voyager: 13000, radiance: 13000, vision: 11500 };
  const DEST_F = { bahamas: 1.08, eastern: 1, western: 0.95, southern: 1.05, mexico: 0.9, bermuda: 1.1, alaska: 1.3, panama: 0.95, mediterranean: 1.35, northern: 1.3, transatlantic: 0.55, asia: 0.8, australia: 1 };
  const MONTH_F = [0.95, 1.02, 1.18, 1.05, 0.95, 1.12, 1.22, 1.08, 0.85, 0.9, 0.92, 1];
  const CAT_MULT = { INT: 1, VBAL: 1.1, OV: 1.22, BAL: 1.5, JS: 2.4, GS: 3.7, OWN: 5.6, RLS: 9 };
  const SOLD_OUT = { INT: 0.07, VBAL: 0.1, OV: 0.08, BAL: 0.06, JS: 0.12, GS: 0.15, OWN: 0.2, RLS: 0.3 };
  const PKG_CLASS_F = { icon: 1.25, oasis: 1.15, quantumUltra: 1.1, quantum: 1.08, freedom: 1.02, voyager: 1, radiance: 0.98, vision: 0.95 };

  function thanksgiving(y) { let d = `${y}-11-01`; let n = 0; while (true) { if (date.dow(d) === 4 && ++n === 4) return d; d = date.add(d, 1); } }
  function overlaps(a1, a2, b1, b2) { return a1 <= b2 && b1 <= a2; }
  const fare99 = (c) => Math.max(9900, Math.round(c / 1000) * 1000 - 100); // $..9 style whole-dollar fares
  const rate99 = (c) => Math.max(99, Math.round(c / 100) * 100 - 1);

  function categoriesFor(shipId) {
    const cls = D.classes[D.shipById[shipId].cls];
    return Object.keys(D.categories).filter((k) => (k === "VBAL" ? cls.vbal : k === "RLS" ? cls.suites.includes("RLS") : true));
  }

  function makeSailing(shipId, it, dep, today) {
    const r = rng(shipId + dep);
    const ship = D.shipById[shipId];
    const ret = date.add(dep, it.nights);
    const y = +dep.slice(0, 4);
    let f = CLASS_BASE[ship.cls] * (1 + (ship.year - 2012) * 0.006);
    f *= DEST_F[it.dest[0]] ?? 1;
    f *= MONTH_F[+dep.slice(5, 7) - 1];
    if (overlaps(dep, ret, `${y}-12-22`, `${y + 1}-01-02`) || overlaps(dep, ret, `${y - 1}-12-22`, `${y}-01-02`)) f *= 1.45;
    const tg = thanksgiving(y);
    if (overlaps(dep, ret, date.add(tg, -1), date.add(tg, 1))) f *= 1.2;
    f *= it.nights <= 3 ? 1.18 : it.nights === 4 ? 1.1 : it.nights === 5 ? 1.04 : it.nights >= 12 ? 0.88 : 1;
    if (date.diff(today, dep) < 45) f *= 0.9; // sample "last-minute" softening
    f *= 0.88 + r() * 0.24;
    const fares = {};
    for (const cat of categoriesFor(shipId)) {
      const pp = fare99(f * it.nights * CAT_MULT[cat] * (0.94 + r() * 0.12));
      const avail = r() > SOLD_OUT[cat];
      fares[cat] = {
        pp,
        avail,
        few: avail && r() < 0.15,
        gty: avail && ["INT", "VBAL", "OV", "BAL"].includes(cat) && r() < 0.6 ? 1 + Math.floor(r() * 4) : 0, // guarantee savings, %
      };
    }
    let promo = null;
    const pr = r();
    if (pr < 0.2) promo = { type: "pct12", pct: 20 + 5 * Math.floor(r() * 4), label: "" };
    else if (pr < 0.35) promo = { type: "room", amount: (5 + 5 * Math.floor(r() * 3)) * 1000, label: "" };
    if (promo) promo.label = promo.type === "pct12" ? `Sample promotion: ${promo.pct}% off guests 1 & 2` : `Sample instant savings: ${money.fmt(promo.amount, { currency: "USD", whole: true })} per stateroom`;
    // Eight weekly snapshots ending today. m = multiplier on fares at that snapshot; the last one is current.
    const history = [];
    let m = 1;
    for (let i = 7; i >= 0; i--) {
      history.unshift({ date: date.add(SAMPLE_DATASET, -7 * (7 - i)), m: Math.round(m * 1000) / 1000 });
      m *= 1 + (r() - 0.45) * 0.07;
    }
    return {
      id: `${shipId}-${dep}`,
      line: "rci",
      shipId,
      itId: it.id,
      depart: dep,
      ret,
      nights: it.nights,
      port: it.days[0],
      endPort: it.days[it.days.length - 1],
      dest: it.dest,
      fares,
      addl: { adult: 0.42 + Math.round(r() * 8) / 100, child: 0.3 + Math.round(r() * 10) / 100, infant: 0.18 },
      taxPP: Math.round(it.taxPP * (0.95 + r() * 0.1)),
      promo,
      history,
      pkgF: 0.92 + Math.round(r() * 18) / 100,
      source: "sample",
      pricedAt: SAMPLE_DATASET,
    };
  }

  function generate(today) {
    const start = date.add(today, 3), end = date.add(today, 400);
    const out = [];
    const y0 = +today.slice(0, 4) - 1, y1 = +end.slice(0, 4);
    for (const d of D.deployments) {
      const blocks = [];
      if (d.months[0] === 1 && d.months[1] === 12) blocks.push([date.add(start, -21), date.add(end, 30)]);
      else for (let y = y0; y <= y1; y++) {
        const [m1, m2] = d.months;
        blocks.push([`${y}-${pad(m1)}-01`, date.endOfMonth(`${m2 < m1 ? y + 1 : y}-${pad(m2)}`)]);
      }
      for (const [bStart, bEnd] of blocks) {
        let dep = bStart;
        while (date.dow(dep) !== d.dow) dep = date.add(dep, 1);
        for (let i = 0; ; i++) {
          const it = D.itineraries[d.cycle[i % d.cycle.length]];
          const ret = date.add(dep, it.nights);
          if (ret > bEnd) break;
          const md = dep.slice(5);
          const skipped = (d.skip || []).length === 2 && md >= `${pad(d.skip[0][0])}-${pad(d.skip[0][1])}` && md <= `${pad(d.skip[1][0])}-${pad(d.skip[1][1])}`;
          if (dep >= start && dep <= end && !skipped) out.push(makeSailing(d.ship, it, dep, today));
          dep = ret;
        }
      }
    }
    for (const o of D.oneOffs) {
      for (let y = y0; y <= y1; y++) {
        const dep = `${y}-${pad(o.month)}-${pad(o.day)}`;
        if (dep >= start && dep <= end) out.push(makeSailing(o.ship, D.itineraries[o.it], dep, today));
      }
    }
    // A ship can't be in two places: drop any sailing that overlaps an earlier one on the same ship.
    out.sort((a, b) => (a.shipId === b.shipId ? (a.depart < b.depart ? -1 : 1) : a.shipId < b.shipId ? -1 : 1));
    const clean = [];
    for (const s of out) {
      const prev = clean[clean.length - 1];
      if (prev && prev.shipId === s.shipId && s.depart < prev.ret) continue;
      clean.push(s);
    }
    return clean.sort((a, b) => (a.depart < b.depart ? -1 : a.depart > b.depart ? 1 : a.shipId < b.shipId ? -1 : 1));
  }

  /* ---------- manual data import (source 4) ---------- */
  // Accepts { sailings: [{ shipId, itId, depart, fares: {INT: 649, BAL: 1099, ...} (dollars per person, double occupancy),
  //   taxes: 165 (dollars per person), sold_out?: ["JS"], pricedAt?: "YYYY-MM-DD" }] }
  function parseManual(json) {
    const rows = Array.isArray(json) ? json : json?.sailings;
    if (!Array.isArray(rows)) throw new Error('Expected a JSON object with a "sailings" list.');
    const out = [], problems = [];
    rows.forEach((row, i) => {
      const where = `Row ${i + 1}`;
      if (!D.shipById[row.shipId]) return problems.push(`${where}: unknown shipId "${row.shipId}"`);
      const it = D.itineraries[row.itId];
      if (!it) return problems.push(`${where}: unknown itId "${row.itId}"`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.depart || "")) return problems.push(`${where}: depart must be YYYY-MM-DD`);
      const fares = {};
      for (const [cat, dollars] of Object.entries(row.fares || {})) {
        if (!D.categories[cat]) { problems.push(`${where}: unknown category "${cat}"`); continue; }
        const pp = money.dollars(dollars);
        if (!(pp > 0)) { problems.push(`${where}: fare for ${cat} must be a positive number`); continue; }
        fares[cat] = { pp, avail: !(row.sold_out || []).includes(cat), few: false, gty: 0 };
      }
      if (!Object.keys(fares).length) return problems.push(`${where}: no valid fares`);
      out.push({
        id: `${row.shipId}-${row.depart}`, line: "rci", shipId: row.shipId, itId: it.id, depart: row.depart, ret: date.add(row.depart, it.nights),
        nights: it.nights, port: it.days[0], endPort: it.days[it.days.length - 1], dest: it.dest, fares,
        addl: { adult: 0.45, child: 0.35, infant: 0.18 }, taxPP: money.dollars(row.taxes || 0), taxesUnknown: !row.taxes,
        promo: null, history: [{ date: row.pricedAt || date.today(), m: 1 }], pkgF: 1, source: "manual", pricedAt: row.pricedAt || date.today(),
      });
    });
    return { sailings: out, problems };
  }

  // Admin overrides, cached in memory and dropped whenever they change.
  let ovCache = null;
  const ov = () => ovCache || (ovCache = CF.store.get("overrides", {}));
  CF.bus.on("store:overrides", () => { ovCache = null; CF.pricing?.clearCache(); });

  /* ---------- public API ---------- */
  const data = {
    SAMPLE_DATASET,
    sailings: [],
    byId: new Map(),
    generatedAt: 0,
    init() {
      D.shipById = Object.fromEntries(D.ships.map((s) => [s.id, s]));
      const t0 = performance.now();
      const sample = generate(date.today());
      const manual = CF.store.get("manualData", null);
      const merged = new Map(sample.map((s) => [s.id, s]));
      if (manual?.sailings) for (const s of manual.sailings) merged.set(s.id, s);
      data.sailings = [...merged.values()].filter((s) => s.depart >= date.today()).sort((a, b) => (a.depart < b.depart ? -1 : a.depart > b.depart ? 1 : 0));
      data.byId = new Map(data.sailings.map((s) => [s.id, s]));
      data.generatedAt = Date.now();
      data.loadMs = Math.round(performance.now() - t0);
      CF.pricing?.clearCache();
    },
    // A sailing with Admin overrides applied. Returns undefined for unknown ids.
    get(id) {
      const base = data.byId.get(id);
      if (!base) return undefined;
      const o = ov();
      const fo = o.fares?.[id], to = o.taxes?.[id];
      if (!fo && to == null) return base;
      const s = CF.clone(base);
      if (fo) for (const [cat, v] of Object.entries(fo)) {
        if (!s.fares[cat]) continue;
        if (v.pp != null) s.fares[cat].pp = v.pp;
        if (v.avail != null) s.fares[cat].avail = v.avail;
        s.fares[cat].override = true;
      }
      if (to != null) { s.taxPP = to; s.taxOverride = true; s.taxesUnknown = false; }
      s.overriddenAt = o.updated?.[id];
      return s;
    },
    all() { return data.sailings.map((s) => data.get(s.id)); },
    ship: (id) => D.shipById[id],
    cls: (shipId) => D.classes[D.shipById[shipId]?.cls],
    port: (id) => D.ports[id],
    it: (id) => D.itineraries[id],
    dest: (id) => D.destinations.find((d) => d.id === id),
    category: (id) => D.categories[id],
    categoriesFor,
    line: () => D.line,
    name(s) { const it = D.itineraries[s.itId]; return `${it.nights}-Night ${it.label}`; },
    // Reference rates with Admin overrides on top.
    overrides: ov,
    rates() { return { ...D.referenceRates, ...(ov().rates || {}) }; },
    ratesOverridden() { return Object.keys(ov().rates || {}); },
    fxRate(cur) { const o = ov().fx || {}; return o[cur] || D.currencies.rates[cur] || 1; },
    currencies: () => Object.keys(D.currencies.rates),
    // Per-sailing package prices (cents). Sample estimates derived from reference rates.
    packageRates(s) {
      const R = data.rates();
      const ship = D.shipById[s.shipId];
      const short = s.nights <= 4 ? 1.08 : 1;
      const deluxe = rate99(R.deluxeBase * PKG_CLASS_F[ship.cls] * short * s.pkgF);
      const specialty = D.classes[ship.cls].restaurants.filter((r) => !D.restaurants[r].included);
      return {
        deluxe,
        refresh: rate99(deluxe * D.beverage.refresh.factor),
        soda: Math.max(1399, rate99(deluxe * D.beverage.soda.factor)),
        udp: rate99(R.udpBase * (0.8 + Math.min(specialty.length, 9) * 0.03) * s.pkgF),
        dining3: R.dining3,
        internetOne: R.internetOne,
        internetMulti: R.internetMulti,
        specialtyAvg: Math.round(specialty.filter((r) => r !== "rockets").reduce((a, r) => a + D.restaurants[r].price, 0) / Math.max(1, specialty.filter((r) => r !== "rockets").length)),
      };
    },
    // Day-by-day schedule with typical (sample) times.
    timeline(s) {
      const it = D.itineraries[s.itId];
      return it.days.map((pid, i) => {
        const d = date.add(s.depart, i);
        const last = i === it.days.length - 1;
        if (pid === "sea") return { day: i + 1, date: d, id: "sea", name: "At sea", kind: "sea", activity: "Sea day" };
        const p = D.ports[pid];
        const overnight = (it.overnight || []).includes(pid);
        const prevSame = i > 0 && it.days[i - 1] === pid;
        const nextSame = it.days[i + 1] === pid;
        let kind = i === 0 ? "embark" : last ? "disembark" : p.scenic ? "scenic" : p.type === "private" ? "private" : "port";
        let arrive = "", depart = "", activity;
        if (kind === "embark") { depart = "4:00 PM"; activity = "Departure"; }
        else if (kind === "disembark") { arrive = "6:00 AM"; activity = it.oneWay ? "Arrival (one-way)" : "Arrival"; }
        else if (kind === "scenic") { activity = "Scenic cruising"; }
        else {
          activity = kind === "private" ? "Private destination" : "Port visit";
          arrive = prevSame ? "" : pid === "VIC" ? "6:00 PM" : kind === "private" ? "7:00 AM" : "8:00 AM";
          depart = nextSame ? "" : pid === "VIC" ? "11:59 PM" : "5:00 PM";
          if (overnight) activity = prevSame ? "Port visit (overnight, day 2)" : "Port visit (overnight)";
        }
        return { day: i + 1, date: d, id: pid, name: p.name, kind, arrive, depart, activity, port: p };
      });
    },
    portCalls(s) { return data.timeline(s).filter((d) => d.kind === "port" || d.kind === "private"); },
    uniquePorts(s) { return [...new Set(data.portCalls(s).map((d) => d.id))]; },
    seaDays(s) { return data.timeline(s).filter((d) => d.kind === "sea").length; },
    matchesDest(s, destId) {
      const kids = D.destUmbrella[destId];
      return kids ? s.dest.some((d) => kids.includes(d)) : s.dest.includes(destId);
    },
    departurePorts() { return Object.values(D.ports).filter((p) => p.home); },
    // The cheapest advertised-style price: lowest available per-person fare, double occupancy, before taxes.
    fromPrice(s) {
      let best = null;
      for (const [cat, f] of Object.entries(s.fares)) if (f.avail && (!best || f.pp < best.pp)) best = { cat, pp: f.pp };
      return best;
    },
    sources() {
      const manual = CF.store.get("manualData", null);
      const sampleCount = data.sailings.filter((s) => s.source === "sample").length;
      return [
        { id: "rci-api", name: "Royal Caribbean official API", priority: 1, status: "Not available", tone: "muted", note: "Royal Caribbean doesn't publish a public API for fares and stateroom inventory. Access needs an authorized travel-partner agreement." },
        { id: "partner", name: "Authorized booking or inventory provider", priority: 2, status: "Not configured", tone: "muted", note: "Connect it on a server you control. Its credentials stay on that server; the browser only receives prices." },
        { id: "licensed", name: "Licensed cruise data service", priority: 3, status: "Not configured", tone: "muted", note: "Same server-side pattern as above." },
        { id: "manual", name: "Manually maintained data (JSON import)", priority: 4, status: manual?.sailings?.length ? "Active" : "Empty", tone: manual?.sailings?.length ? "good" : "muted", count: manual?.sailings?.length || 0, updated: manual?.importedAt, note: "Sailings you import in Admin. Stored in this browser only." },
        { id: "sample", name: "Built-in sample data", priority: 5, status: "Active", tone: "warn", count: sampleCount, updated: data.generatedAt, note: `Made-up schedules and prices for demonstration (data set ${SAMPLE_DATASET}). Not real availability or pricing.` },
      ];
    },
    importManual(json) {
      const { sailings, problems } = parseManual(json);
      if (sailings.length) CF.store.set("manualData", { importedAt: Date.now(), sailings });
      data.init();
      return { count: sailings.length, problems };
    },
    clearManual() { CF.store.remove("manualData"); data.init(); },
    exportSailings(list) {
      return {
        note: "Exported from Cruise Finder. Fares are dollars per person, double occupancy, before taxes.",
        sailings: list.map((s) => ({ shipId: s.shipId, itId: s.itId, depart: s.depart, fares: Object.fromEntries(Object.entries(s.fares).map(([k, f]) => [k, f.pp / 100])), sold_out: Object.entries(s.fares).filter(([, f]) => !f.avail).map(([k]) => k), taxes: s.taxPP / 100, source: s.source, pricedAt: s.pricedAt })),
      };
    },
  };
  CF.data = data;
})();
