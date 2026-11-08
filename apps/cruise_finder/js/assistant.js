/* AI travel agent engine.
 *
 * A question becomes a structured PLAN (same JSON shape from either engine):
 *   - "Built-in": a local keyword parser (works offline, always available)
 *   - "AI service": the optional server proxy (server/ai-proxy.mjs) asks Claude to fill in the plan
 * The plan is then EXECUTED here against the app's own data and pricing engine, and the answer text is written
 * from those results. The language model never sees or writes prices, so it can't invent a fare, an itinerary
 * or a policy. */
(function () {
  "use strict";
  const CF = window.CF;
  const { date } = CF;

  const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const DEST_WORDS = [
    [/eastern caribbean/, "eastern"], [/western caribbean/, "western"], [/southern caribbean|abc islands|aruba|curacao|curaçao/, "southern"],
    [/coco ?cay|perfect day/, "cococay"], [/bahamas|nassau/, "bahamas"], [/mexic|cozumel|cabo|ensenada|puerto vallarta/, "mexico"],
    [/alaska|glacier/, "alaska"], [/mediterranean|\bmed\b|greek|greece|italy|spain|santorini/, "mediterranean"], [/norway|fjord|baltic|northern europe|scandinavia/, "northern"],
    [/europe/, "europe"], [/\basia\b|singapore|thailand|malaysia/, "asia"], [/australia|sydney|south pacific|new caledonia/, "australia"],
    [/bermuda/, "bermuda"], [/panama/, "panama"], [/transatlantic|atlantic crossing/, "transatlantic"], [/caribbean/, "caribbean"],
  ];
  const PORT_WORDS = [
    [/miami/, ["MIA"]], [/canaveral|orlando/, ["PCV"]], [/lauderdale/, ["FLL"]], [/tampa/, ["TPA"]], [/galveston|texas|houston/, ["GAL"]],
    [/new jersey|cape liberty|bayonne|new york|\bnyc\b/, ["BAY"]], [/baltimore|maryland/, ["BAL"]], [/los angeles|\bla\b|california/, ["LAX"]],
    [/seattle/, ["SEA"]], [/vancouver/, ["YVR"]], [/san juan|puerto rico/, ["SJU"]], [/barcelona/, ["BCN"]], [/\brome\b|civitavecchia/, ["CIV"]],
    [/southampton|england|\buk\b|london/, ["SOU"]], [/copenhagen/, ["CPH"]],
  ];
  const AMBIGUOUS_SHIPS = ["star", "legend", "wonder", "freedom", "liberty", "explorer", "vision"];
  const CATS = [[/virtual balcony/, "VBAL"], [/junior suite|jr\.? suite/, "JS"], [/grand suite/, "GS"], [/owner/, "OWN"], [/loft/, "RLS"], [/suite/, "JS"], [/balcony/, "BAL"], [/ocean ?view|window/, "OV"], [/interior|inside/, "INT"]];
  const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };

  function nextMonthKey(mIndex) {
    const today = date.today();
    let y = +today.slice(0, 4);
    if (mIndex + 1 < +today.slice(5, 7)) y++;
    return `${y}-${String(mIndex + 1).padStart(2, "0")}`;
  }
  const amount = (s) => { const m = s.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)\s*(k)?/i); return m ? Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1)) : null; };

  /* ---------- built-in parser ---------- */
  function parse(text) {
    // "Royal Caribbean" is the cruise line, not a destination.
    const t = " " + text.toLowerCase().replace(/[’']/g, "'").replace(/royal caribbean( international)?('s)?/g, " ") + " ";
    const plan = { intent: "search", destinations: [], departure_ports: [], visits_ports: [], ships: [], ship_classes: [], min_nights: null, max_nights: null, months: [], year: null, max_total: null, max_per_person: null, max_per_night: null, adults: null, children_ages: [], staterooms: null, category: null, limit: 5 };

    for (const [re, id] of DEST_WORDS) if (re.test(t) && !plan.destinations.includes(id)) {
      if (id === "caribbean" && plan.destinations.some((d) => ["eastern", "western", "southern"].includes(d))) continue;
      if (id === "europe" && plan.destinations.some((d) => ["mediterranean", "northern"].includes(d))) continue;
      plan.destinations.push(id);
    }
    if (/(from|departing|leaving|out of|sail(ing)? from)\s+(the state of )?florida/.test(t) || /florida port/.test(t)) plan.departure_ports.push("MIA", "PCV", "FLL", "TPA");
    for (const [re, ids] of PORT_WORDS) if (re.test(t)) plan.departure_ports.push(...ids.filter((x) => !plan.departure_ports.includes(x)));
    // Ports of call named explicitly ("which cruises visit Cozumel")
    if (/visit|stop (at|in)|go(es)? to|call(s)? (at|in)/.test(t)) {
      for (const p of Object.values(CF.DATA.ports)) {
        if (p.home) continue;
        const key = p.name.toLowerCase().split(",")[0].replace("perfect day at ", "");
        if (t.includes(key) && key.length > 3) plan.visits_ports.push(p.id);
      }
      if (plan.visits_ports.includes("COCO")) plan.destinations = plan.destinations.filter((d) => d !== "cococay");
    }

    for (const s of CF.DATA.ships) {
      const base = s.name.toLowerCase().replace(" of the seas", "");
      if (t.includes(s.name.toLowerCase()) || (!AMBIGUOUS_SHIPS.includes(base) && new RegExp(`\\b${base}\\b(?! class)`).test(t))) plan.ships.push(s.id);
    }
    for (const [id, c] of Object.entries(CF.DATA.classes)) if (t.includes(c.name.toLowerCase())) plan.ship_classes.push(id);

    let m;
    if ((m = t.match(/(\d+)\s*[- ]?\s*(?:to|-)\s*(\d+)\s*[- ]?nights?/))) { plan.min_nights = +m[1]; plan.max_nights = +m[2]; }
    else if ((m = t.match(/(\d+)\s*[- ]?(night|day)/))) { const n = +m[1] - (m[2] === "day" ? 1 : 0); plan.min_nights = n; plan.max_nights = n; }
    else if (/\bweek[- ]long\b|\bone week\b|\ba week\b/.test(t)) { plan.min_nights = 7; plan.max_nights = 7; }
    else if (/weekend|short|quick|getaway/.test(t)) { plan.min_nights = 2; plan.max_nights = 5; }
    else if (/two weeks|2 weeks|long cruise|longer/.test(t)) { plan.min_nights = 11; plan.max_nights = 16; }

    MONTHS.forEach((name, i) => { if (new RegExp(`\\b(${name}|${name.slice(0, 3)})\\b`).test(t) && !(name === "may" && /\bmay (i|we|you)\b/.test(t))) plan.months.push(nextMonthKey(i)); });
    const season = { summer: [5, 6, 7], winter: [11, 0, 1], spring: [2, 3, 4], fall: [8, 9, 10], autumn: [8, 9, 10], christmas: [11], holiday: [11] };
    for (const [w, ms] of Object.entries(season)) if (new RegExp(`\\b${w}\\b`).test(t) && !/spring break/.test(t)) ms.forEach((i) => { const k = nextMonthKey(i); if (!plan.months.includes(k)) plan.months.push(k); });
    if (/spring break/.test(t)) plan.months.push(nextMonthKey(2));
    if ((m = t.match(/\b(20\d\d)\b/)) && !plan.months.length) plan.year = +m[1];
    if (plan.year && plan.months.length) plan.months = plan.months.map((k) => `${plan.year}-${k.slice(5)}`);

    const money = t.match(/(under|below|less than|max(imum)?|budget( of)?|up to|no more than|cheaper than)\s*\$?\s*[\d,.]+\s*k?(\s*(per|a|\/)\s*(person|night|pp)|\s*pp|\s*each)?/);
    if (money) {
      const v = amount(money[0].replace(/^[a-z ]+/, ""));
      if (/night/.test(money[0])) plan.max_per_night = v;
      else if (/person|pp|each/.test(money[0])) plan.max_per_person = v;
      else plan.max_total = v;
    }

    if ((m = t.match(/family of (\d+|\w+)/))) { const n = +m[1] || WORDNUM[m[1]] || 4; plan.adults = 2; plan.children_ages = Array.from({ length: Math.max(0, n - 2) }, (_, i) => [10, 7, 5, 12][i % 4]); }
    if ((m = t.match(/(\d+|\w+) adults?/)) && (+m[1] || WORDNUM[m[1]])) plan.adults = +m[1] || WORDNUM[m[1]];
    if ((m = t.match(/(\d+|\w+) (kids?|children|child)/)) && (+m[1] || WORDNUM[m[1]])) { const n = +m[1] || WORDNUM[m[1]]; plan.children_ages = Array.from({ length: n }, (_, i) => [10, 7, 5, 12][i % 4]); plan.adults ||= 2; }
    if (/\b(solo|just me|by myself|alone)\b/.test(t)) plan.adults = 1;
    if (/\bcouple|two of us|2 of us|me and my (wife|husband|partner)\b/.test(t)) plan.adults = 2;
    if ((m = t.match(/(group of|party of) (\d+|\w+)|(\d+) (people|friends|travel+ers)/))) { const n = +(m[2] || m[3]) || WORDNUM[m[2]]; if (n) plan.adults = n; }
    if ((m = t.match(/(\d+|\w+) (staterooms?|cabins?|rooms)/)) && (+m[1] || WORDNUM[m[1]])) plan.staterooms = +m[1] || WORDNUM[m[1]];
    for (const [re, id] of CATS) if (re.test(t)) { plan.category = id; break; }

    if (/^\s*(help|what can you do|hi|hello)\b/.test(t.trim())) plan.intent = "help";
    else if (/compare|versus|\bvs\.?\b/.test(t) && plan.ships.length >= 2) plan.intent = "compare_ships";
    else if (plan.months.length === 2 && /\bor\b/.test(t) && /cheaper|cheapest|less expensive|better/.test(t)) plan.intent = "compare_months";
    else if (/most (stops|ports)|more (stops|ports)/.test(t)) plan.intent = "most_stops";
    else if (/(cheapest|best|lowest) ship/.test(t)) plan.intent = "cheapest_ship";
    else if (/best (overall )?value|best deal|good value/.test(t)) plan.intent = "best_value";
    else if (/cheapest|lowest|least expensive|cheap|budget|deal/.test(t)) plan.intent = "cheapest";
    return plan;
  }

  /* ---------- execute a plan against the data ---------- */
  function travelersFrom(plan, base) {
    const cfg = CF.clone(base);
    if (plan.category) cfg.rooms.forEach((r) => (r.category = plan.category));
    if (plan.adults == null && !plan.children_ages?.length && !plan.staterooms) return { cfg, changed: !!plan.category };
    const ages = [...Array.from({ length: plan.adults || 2 }, () => 35), ...(plan.children_ages || [])];
    const roomsN = Math.max(plan.staterooms || Math.ceil(ages.length / 4), 1);
    const cat = plan.category || cfg.rooms[0].category;
    const rooms = Array.from({ length: roomsN }, () => []);
    // Put adults first across rooms so every room has an adult, then children.
    ages.forEach((a, i) => rooms[i % roomsN].push(a));
    cfg.rooms = rooms.filter((r) => r.length).map((r) => CF.pricing.newRoom(cat, r));
    return { cfg, changed: true };
  }

  function execute(plan) {
    const profile = CF.profile.get();
    const { cfg, changed } = travelersFrom(plan, profile);
    const crit = { ...CF.search.defaults(), dest: plan.destinations || [], ports: plan.departure_ports || [], ships: plan.intent === "compare_ships" ? plan.ships : plan.ships || [], classes: plan.ship_classes || [] };
    if (plan.months?.length) { crit.dateMode = "month"; crit.months = plan.months; }
    else if (plan.year) { crit.dateMode = "year"; crit.year = String(plan.year); }
    const rows = [];
    for (const s of CF.data.all()) {
      if (!CF.search.matches(s, crit)) continue;
      if (plan.min_nights && s.nights < plan.min_nights) continue;
      if (plan.max_nights && s.nights > plan.max_nights) continue;
      if (plan.visits_ports?.length && !plan.visits_ports.every((p) => CF.data.uniquePorts(s).includes(p))) continue;
      const q = CF.pricing.quick(s, cfg);
      if (!q.valid) continue;
      if (plan.max_total && q.totals.total > plan.max_total * 100) continue;
      if (plan.max_per_person && q.totals.perPerson > plan.max_per_person * 100) continue;
      if (plan.max_per_night && q.totals.perNight > plan.max_per_night * 100) continue;
      rows.push({ s, q });
    }
    CF.log.count("assistantQueries");
    return { rows, cfg, travelersChanged: changed, crit };
  }

  /* ---------- write the answer from results ---------- */
  function describePlan(plan, opts = {}) {
    const p = [];
    if (plan.destinations?.length) p.push(plan.destinations.map((d) => CF.data.dest(d)?.name).filter(Boolean).join(" or "));
    if (plan.visits_ports?.length) p.push("visiting " + plan.visits_ports.map((x) => CF.data.port(x)?.name.split(",")[0]).join(" and "));
    if (plan.departure_ports?.length) p.push("from " + plan.departure_ports.map((x) => CF.data.port(x)?.name.split(",")[0]).join(", "));
    if (plan.min_nights && plan.min_nights === plan.max_nights) p.push(`${plan.min_nights} nights`);
    else if (plan.min_nights || plan.max_nights) p.push(`${plan.min_nights || 1}-${plan.max_nights || "any"} nights`);
    if (plan.months?.length && !opts.noMonths) p.push("departing in " + plan.months.map((m) => date.fmt(m, "monthShort")).join(", "));
    if (plan.year) p.push("departing in " + plan.year);
    if (plan.ships?.length && plan.intent !== "compare_ships") p.push("on " + plan.ships.map((s) => CF.data.ship(s)?.name).join(" or "));
    if (plan.ship_classes?.length) p.push(plan.ship_classes.map((c) => CF.DATA.classes[c]?.name).join(" or "));
    if (plan.max_total) p.push(`under ${CF.ui.whole(plan.max_total * 100)} total`);
    if (plan.max_per_person) p.push(`under ${CF.ui.whole(plan.max_per_person * 100)} per person`);
    if (plan.max_per_night) p.push(`under ${CF.ui.whole(plan.max_per_night * 100)} per night`);
    return p.length ? p.join(", ") : "any Royal Caribbean sailing in the data";
  }

  function answer(plan) {
    const ui = CF.ui;
    const W = (c) => ui.whole(c);
    if (plan.intent === "help") return { text: ["I can search sailings, price them with your travelers and choices, compare ships or months, and fill the comparison tool. Try one of the examples below."], cards: [] };
    const { rows, cfg, travelersChanged } = execute(plan);
    const who = `${ui.travelerSummary(cfg)}, ${CF.DATA.categories[cfg.rooms[0].category].name}`;
    const scope = describePlan(plan, { noMonths: plan.intent === "compare_months" });
    const out = { text: [], cards: [], table: null, compareIds: [], cfg: travelersChanged ? cfg : null };
    if (!rows.length) {
      out.text.push(`I couldn't find any sailings matching ${scope} in the data I have.`);
      out.text.push(plan.max_total || plan.max_per_person || plan.max_per_night ? "Every match is over that budget once taxes, gratuities and your choices are added. Try a higher budget, a shorter cruise or an interior stateroom." : "Try a wider date range, another departure port or fewer filters.");
      return out;
    }
    const byTotal = [...rows].sort((a, b) => a.q.totals.total - b.q.totals.total);
    const cheapest = byTotal[0];
    const avg = Math.round(rows.reduce((a, r) => a + r.q.totals.total, 0) / rows.length);
    const line = (r) => `${CF.data.ship(r.s.shipId).name}, ${date.fmt(r.s.depart)} (${CF.data.name(r.s)}): ${W(r.q.totals.total)} total, ${W(r.q.totals.perPerson)} per person`;

    switch (plan.intent) {
      case "compare_ships": {
        const picks = plan.ships.map((id) => byTotal.find((r) => r.s.shipId === id)).filter(Boolean);
        if (picks.length < 2) { out.text.push(`I found sailings for only ${picks.length} of those ships matching ${scope}.`); out.cards = picks.map((r) => r.s.id); break; }
        out.text.push(`Here's the lowest-total sailing on each ship matching ${scope}, priced for ${who}:`);
        const low = Math.min(...picks.map((r) => r.q.totals.total));
        out.table = picks.map((r) => [CF.data.ship(r.s.shipId).name, date.fmt(r.s.depart), `${r.s.nights} nights`, W(r.q.totals.total), r.q.totals.total === low ? "Lowest" : CF.money.fmt(r.q.totals.total - low, { whole: true, sign: true })]);
        const c = picks.find((r) => r.q.totals.total === low);
        out.text.push(`${CF.data.ship(c.s.shipId).name} comes out lower overall. Per night: ${picks.map((r) => `${CF.data.ship(r.s.shipId).name.replace(" of the Seas", "")} ${W(r.q.totals.perNight)}`).join(", ")}. Different lengths and itineraries matter, so check the per-night numbers too.`);
        out.cards = picks.map((r) => r.s.id);
        out.compareIds = out.cards;
        break;
      }
      case "compare_months": {
        const stats = plan.months.map((m) => {
          const rs = rows.filter((r) => date.month(r.s.depart) === m);
          return { m, n: rs.length, min: rs.length ? Math.min(...rs.map((r) => r.q.totals.total)) : null, avg: rs.length ? Math.round(rs.reduce((a, r) => a + r.q.totals.total, 0) / rs.length) : null, best: rs.sort((a, b) => a.q.totals.total - b.q.totals.total)[0] };
        });
        const have = stats.filter((x) => x.n);
        if (have.length < 2) { out.text.push(`I only have sailings for ${have.map((x) => date.fmt(x.m, "month")).join(" and ") || "neither month"} matching ${scope}, so I can't compare them fairly.`); out.cards = have.map((x) => x.best.s.id); break; }
        const [a, b] = have;
        const cheaper = a.avg <= b.avg ? a : b, other = cheaper === a ? b : a;
        out.text.push(`For ${scope} (${who}), ${date.fmt(cheaper.m, "month")} is cheaper on average: ${W(cheaper.avg)} vs ${W(other.avg)}, a difference of ${W(other.avg - cheaper.avg)} per trip.`);
        out.table = stats.map((x) => [date.fmt(x.m, "month"), `${x.n} sailings`, x.min != null ? `Lowest ${W(x.min)}` : "–", x.avg != null ? `Average ${W(x.avg)}` : "–"]);
        if (a.min !== b.min) out.text.push(`The single cheapest sailing is in ${date.fmt((a.min < b.min ? a : b).m, "month")}.`);
        out.cards = have.map((x) => x.best.s.id);
        break;
      }
      case "most_stops": {
        const sorted = [...rows].sort((x, y) => CF.data.uniquePorts(y.s).length - CF.data.uniquePorts(x.s).length || x.q.totals.total - y.q.totals.total);
        const top = sorted.slice(0, plan.limit || 5);
        out.text.push(`The sailings with the most different ports matching ${scope}: the top one visits ${CF.data.uniquePorts(top[0].s).length} ports.`);
        top.forEach((r) => out.text.push(`• ${CF.data.uniquePorts(r.s).length} ports: ${line(r)}`));
        out.cards = top.map((r) => r.s.id);
        break;
      }
      case "cheapest_ship": {
        const byShip = new Map();
        for (const r of byTotal) if (!byShip.has(r.s.shipId)) byShip.set(r.s.shipId, r);
        const top = [...byShip.values()].slice(0, plan.limit || 5);
        out.text.push(`Cheapest ships for ${who} (${scope}), by each ship's lowest complete total:`);
        out.table = top.map((r, i) => [`${i + 1}. ${CF.data.ship(r.s.shipId).name}`, CF.data.cls(r.s.shipId).name, `${r.s.nights} nights, ${date.fmt(r.s.depart, "short")}`, W(r.q.totals.total)]);
        out.text.push("Shorter sailings and older ships usually cost less overall. Compare per-night costs if lengths differ.");
        out.cards = top.map((r) => r.s.id);
        break;
      }
      case "best_value": {
        const scored = rows.map((r) => ({ ...r, v: CF.pricing.valueScore(r.q, r.s) })).sort((x, y) => x.v - y.v).slice(0, plan.limit || 5);
        out.text.push(`Best overall value matching ${scope}, ranked by complete cost per vacation day (total ÷ (nights + ½ × port visits)), priced for ${who}:`);
        scored.forEach((r) => out.text.push(`• ${W(r.v)} per day: ${line(r)}`));
        out.cards = scored.map((r) => r.s.id);
        break;
      }
      default: {
        const top = byTotal.slice(0, plan.limit || 5);
        out.text.push(`I found ${CF.plural(rows.length, "sailing")} matching ${scope}. Priced for ${who}, the lowest estimated total is ${W(cheapest.q.totals.total)}: ${CF.data.ship(cheapest.s.shipId).name} on ${date.fmt(cheapest.s.depart)}. The average is ${W(avg)}.`);
        out.text.push(`Here ${top.length === 1 ? "it is" : `are the ${top.length} lowest`}:`);
        out.cards = top.map((r) => r.s.id);
      }
    }
    out.foot = [];
    if (travelersChanged) out.foot.push(`I priced these for ${ui.travelerSummary(cfg)} as you described, not your saved trip preferences.`);
    if (rows.some((r) => r.q.sample)) out.foot.push("These are sample prices for demonstration, not live Royal Caribbean pricing.");
    out.rows = rows;
    return out;
  }

  /* ---------- optional AI service (plan only) ---------- */
  async function planWithAI(question) {
    const url = (CF.settings.get("aiEndpoint") || "").trim().replace(/\/+$/, "");
    if (!url) throw new Error("No AI service address is set. Add one in Settings.");
    const body = {
      question: question.slice(0, 1000),
      today: date.today(),
      options: {
        destinations: CF.DATA.destinations.map((d) => ({ id: d.id, name: d.name })),
        departure_ports: CF.data.departurePorts().map((p) => ({ id: p.id, name: p.name })),
        ports_of_call: Object.values(CF.DATA.ports).filter((p) => !p.home).map((p) => ({ id: p.id, name: p.name })),
        ships: CF.DATA.ships.map((s) => ({ id: s.id, name: s.name })),
        ship_classes: Object.entries(CF.DATA.classes).map(([id, c]) => ({ id, name: c.name })),
        categories: Object.entries(CF.DATA.categories).map(([id, c]) => ({ id, name: c.name })),
        months_available: date.monthsBetween(date.today(), CF.data.sailings.at(-1)?.depart || date.today()),
      },
    };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 60000);
    try {
      const r = await fetch(url + "/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `The AI service answered with an error (${r.status}).`);
      CF.log.count("aiCalls");
      return sanitizePlan(data.plan);
    } catch (e) {
      CF.log.count("aiErrors");
      if (e.name === "AbortError") throw new Error("The AI service took too long.");
      if (e instanceof TypeError) throw new Error("Couldn't reach the AI service. Check the address in Settings.");
      throw e;
    } finally { clearTimeout(timer); }
  }
  // Never trust model output blindly: keep only known ids and sane numbers.
  function sanitizePlan(p) {
    const base = parse("");
    if (!p || typeof p !== "object") return base;
    const ids = (arr, valid) => (Array.isArray(arr) ? arr.filter((x) => valid(x)) : []);
    const num = (v, lo, hi) => (typeof v === "number" && isFinite(v) && v >= lo && v <= hi ? v : null);
    return {
      intent: ["search", "cheapest", "best_value", "most_stops", "compare_ships", "compare_months", "cheapest_ship", "help"].includes(p.intent) ? p.intent : "search",
      destinations: ids(p.destinations, (x) => CF.data.dest(x)),
      departure_ports: ids(p.departure_ports, (x) => CF.data.port(x)?.home),
      visits_ports: ids(p.visits_ports, (x) => CF.data.port(x) && !CF.data.port(x).home),
      ships: ids(p.ships, (x) => CF.data.ship(x)),
      ship_classes: ids(p.ship_classes, (x) => CF.DATA.classes[x]),
      min_nights: num(p.min_nights, 1, 40), max_nights: num(p.max_nights, 1, 40),
      months: ids(p.months, (x) => /^\d{4}-\d{2}$/.test(x)),
      year: num(p.year, 2020, 2100),
      max_total: num(p.max_total, 1, 1e7), max_per_person: num(p.max_per_person, 1, 1e7), max_per_night: num(p.max_per_night, 1, 1e6),
      adults: num(p.adults, 1, 16), children_ages: Array.isArray(p.children_ages) ? p.children_ages.filter((a) => num(a, 0, 17) != null).slice(0, 12) : [],
      staterooms: num(p.staterooms, 1, 4), category: CF.DATA.categories[p.category] ? p.category : null,
      limit: num(p.limit, 1, 10) || 5,
    };
  }

  async function ask(question) {
    const engine = CF.settings.get("aiEngine");
    let plan, via = "built-in", note = null;
    if (engine === "ai" && CF.settings.get("aiEndpoint")) {
      try { plan = await planWithAI(question); via = "AI service"; }
      catch (e) { note = `${e.message} Used the built-in assistant instead.`; CF.log.error(e, "AI service"); }
    }
    if (!plan) plan = parse(question);
    return { ...answer(plan), plan, via, note };
  }

  CF.assistant = { parse, execute, answer, ask, sanitizePlan, describePlan };
})();
