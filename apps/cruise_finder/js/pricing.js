/* Pricing engine: turns (sailing, configuration) into a complete, itemized vacation estimate.
 * Pure functions with no DOM, so search, the configurator, comparisons, the price tracker, exports and the assistant
 * all share one set of numbers.
 *
 * Rules this file guarantees:
 *  - Integer cents throughout. Percentages round once per line.
 *  - Taxes and fees are one line per stateroom, computed once. Fares never include them, so nothing is counted twice.
 *  - Every line carries a source: sample | reference | estimate | user | override | manual.
 *  - Mandatory charges (fare, taxes, gratuities) are kept apart from optional purchases and travel costs.
 *  - Anything not priced is listed in notIncluded, so a missing cost is visible instead of silently $0. */
(function () {
  "use strict";
  const CF = window.CF;
  const D = CF.DATA;
  const { money, date } = CF;

  const BUCKETS = [
    { id: "fare", label: "Cruise fare", kind: "mandatory" },
    { id: "taxes", label: "Taxes, fees & port expenses", kind: "mandatory" },
    { id: "gratuities", label: "Gratuities", kind: "mandatory" },
    { id: "beverage", label: "Beverage packages", kind: "optional" },
    { id: "internet", label: "Internet", kind: "optional" },
    { id: "dining", label: "Specialty dining", kind: "optional" },
    { id: "excursions", label: "Shore excursions", kind: "optional" },
    { id: "insurance", label: "Travel insurance", kind: "optional" },
    { id: "transfers", label: "Airport transfers", kind: "optional" },
    { id: "onboard", label: "Spa & onboard spending", kind: "optional" },
    { id: "flights", label: "Flights", kind: "travel" },
    { id: "hotel", label: "Hotels", kind: "travel" },
    { id: "transport", label: "Parking & transportation", kind: "travel" },
    { id: "otherTravel", label: "Other travel costs", kind: "travel" },
  ];
  const BUCKET = Object.fromEntries(BUCKETS.map((b) => [b.id, b]));

  const SOURCE_LABEL = {
    sample: "Sample data",
    reference: "Reference rate",
    estimate: "Estimate",
    user: "Your estimate",
    override: "Admin override",
    manual: "Imported data",
    included: "Included",
  };

  /* ---------- configuration shape ---------- */
  const newGuest = (age = 35) => ({ age, bev: "none", dining: { pkg: "none", dinners: 0, picks: {} }, exc: { mode: "none", budget: 0, picks: {} } });
  const newRoom = (category = "BAL", ages = [35, 35]) => ({
    category,
    room: { mode: "gty", deck: "any", location: "any", connecting: false, accessible: false },
    internet: { plan: "none", devices: 2 },
    guests: ages.map((a) => newGuest(a)),
  });
  function defaultConfig() {
    return {
      v: 1,
      rooms: [newRoom("BAL", [35, 35])],
      mainDining: "trad-early",
      gratuities: "prepaid",
      extras: { insurance: { mode: "none", pct: null, amount: 0 }, transfers: { mode: "none", amount: 0 }, spa: 0, onboard: 0, other: 0 },
      travel: { flights: { perPerson: 0, people: 0 }, hotelBefore: { nights: 0, rate: 0 }, hotelAfter: { nights: 0, rate: 0 }, parking: { perDay: 0 }, portTransport: 0, rentalCar: 0, other: 0 },
    };
  }
  // Fill in anything missing (old saves, share links, hand-edited JSON) so the engine never sees undefined.
  function normalize(cfg) {
    const d = defaultConfig();
    const c = CF.clone(cfg || {});
    c.v = 1;
    c.rooms = Array.isArray(c.rooms) && c.rooms.length ? c.rooms : d.rooms;
    c.rooms = c.rooms.slice(0, 4).map((r) => {
      const nr = { ...newRoom(r.category || "BAL", []), ...r };
      nr.category = D.categories[nr.category] ? nr.category : "BAL";
      nr.room = { ...newRoom().room, ...(r.room || {}) };
      nr.internet = { ...newRoom().internet, ...(r.internet || {}) };
      nr.guests = (Array.isArray(r.guests) && r.guests.length ? r.guests : [newGuest(35)]).slice(0, 8).map((g) => {
        const ng = { ...newGuest(), ...g };
        ng.age = CF.clamp(Math.round(Number(g.age ?? 35)), 0, 120);
        ng.dining = { ...newGuest().dining, ...(g.dining || {}) };
        ng.exc = { ...newGuest().exc, ...(g.exc || {}) };
        if (!D.beverage[ng.bev]) ng.bev = "none";
        return ng;
      });
      return nr;
    });
    c.mainDining = c.mainDining || d.mainDining;
    c.gratuities = c.gratuities === "onboard" ? "onboard" : "prepaid";
    c.extras = { ...d.extras, ...(c.extras || {}) };
    c.extras.insurance = { ...d.extras.insurance, ...(c.extras.insurance || {}) };
    c.extras.transfers = { ...d.extras.transfers, ...(c.extras.transfers || {}) };
    c.travel = { ...d.travel, ...(c.travel || {}) };
    for (const k of ["flights", "hotelBefore", "hotelAfter", "parking"]) c.travel[k] = { ...d.travel[k], ...(c.travel[k] || {}) };
    return c;
  }
  const guestCount = (cfg) => cfg.rooms.reduce((a, r) => a + r.guests.length, 0);
  const ageBand = (age) => (age < 2 ? "infant" : age < 18 ? "child" : "adult");

  /* ---------- categories ---------- */
  function offered(s) { return Object.keys(s.fares).sort((a, b) => D.categories[a].order - D.categories[b].order); }
  // The requested category, or the nearest available one (prefer an upgrade). Never silently: callers show `substituted`.
  function resolveCategory(s, want) {
    const f = s.fares[want];
    if (f && f.avail) return { cat: want, substituted: false };
    const order = offered(s).filter((c) => s.fares[c].avail);
    if (!order.length) return { cat: null, substituted: true, reason: "Every stateroom category is sold out in this data." };
    const wantOrder = D.categories[want].order;
    const up = order.find((c) => D.categories[c].order > wantOrder);
    const down = [...order].reverse().find((c) => D.categories[c].order < wantOrder);
    const cat = up || down;
    const why = !f ? `${D.categories[want].name} isn't offered on this ship` : `${D.categories[want].name} is sold out`;
    return { cat, substituted: true, reason: `${why}, so this estimate uses ${D.categories[cat].name}.` };
  }

  /* ---------- the engine ---------- */
  function price(sailingIn, cfgIn, opts = {}) {
    const cfg = normalize(cfgIn);
    let s = sailingIn;
    if (opts.snapshot != null && s.history?.[opts.snapshot]) {
      const m = s.history[opts.snapshot].m;
      s = CF.clone(s);
      for (const f of Object.values(s.fares)) f.pp = Math.round(f.pp * m);
    }
    const R = CF.data.rates();
    const pkg = CF.data.packageRates(s);
    const ship = CF.data.ship(s.shipId);
    const nights = s.nights;
    const lines = [];
    const notices = [];
    const included = [];
    const roomsOut = [];
    const fareSource = (f) => (f.override ? "override" : s.source === "manual" ? "manual" : "sample");
    const add = (bucket, label, cents, source, extra = {}) => {
      if (!cents && !extra.keepZero) return;
      lines.push({ bucket, kind: BUCKET[bucket].kind, label, cents: Math.round(cents), source, ...extra });
    };
    const svc = (c) => c + money.pct(c, R.serviceChargePct);
    const portCalls = CF.data.portCalls(s);
    const portDays = portCalls.length;
    let valid = true;

    cfg.rooms.forEach((room, ri) => {
      const rlabel = cfg.rooms.length > 1 ? `Stateroom ${ri + 1}` : "Stateroom";
      const res = resolveCategory(s, room.category);
      if (!res.cat) { valid = false; notices.push({ level: "error", text: `${rlabel}: ${res.reason}` }); return; }
      if (res.substituted) notices.push({ level: "warn", text: `${rlabel}: ${res.reason}`, key: "substituted" });
      const cat = res.cat, catDef = D.categories[cat], f = s.fares[cat];
      const guests = room.guests;
      const n = guests.length;
      roomsOut.push({ index: ri, cat, catName: catDef.name, requested: room.category, substituted: res.substituted, guests: n });

      // Occupancy and age rules
      if (n > catDef.maxOcc) { valid = false; notices.push({ level: "error", text: `${rlabel}: ${catDef.name} holds up to ${catDef.maxOcc} guests. Move guests to another stateroom.` }); }
      if (!guests.some((g) => g.age >= 21)) notices.push({ level: "warn", text: `${rlabel}: ${D.rules.adultPerRoom}` });
      if (guests.some((g) => g.age < 1)) notices.push({ level: "info", text: D.rules.infantAge });

      // Fare: guests 1 and 2 pay the double-occupancy fare; guests 3+ pay the additional-guest rate by age.
      let pp = f.pp;
      let gtyNote = "";
      if (room.room.mode === "gty" && f.gty) { pp -= money.pct(pp, f.gty); gtyNote = ` Guarantee fare: ${f.gty}% below the choose-your-room fare.`; }
      const ordered = [...guests].sort((a, b) => b.age - a.age);
      let fareTotal = 0;
      const parts = [];
      if (n === 1) {
        fareTotal = pp * 2;
        parts.push(`1 guest at 200% single occupancy (${money.fmt(pp, { currency: "USD" })} × 2)`);
      } else {
        fareTotal = pp * 2;
        parts.push(`2 guests × ${money.fmt(pp, { currency: "USD" })}`);
        const extraGuests = ordered.slice(2);
        const byBand = {};
        for (const g of extraGuests) byBand[ageBand(g.age)] = (byBand[ageBand(g.age)] || 0) + 1;
        for (const [band, count] of Object.entries(byBand)) {
          const each = money.mul(pp, s.addl[band]);
          fareTotal += each * count;
          parts.push(`${count} additional ${band}${count > 1 ? "s" : ""} × ${money.fmt(each, { currency: "USD" })}`);
        }
      }
      add("fare", `${rlabel} - ${catDef.name} cruise fare`, fareTotal, fareSource(f), { detail: parts.join(", ") + "." + gtyNote + " Per-person fares assume double occupancy.", room: ri });

      if (s.promo) {
        const off = s.promo.type === "pct12" ? -money.pct(pp * 2, s.promo.pct) : -Math.min(s.promo.amount, fareTotal);
        add("fare", s.promo.label, off, "sample", { detail: "Applied to the cruise fare only. Taxes and gratuities are unaffected.", room: ri, discount: true });
      }

      // Taxes, fees and port expenses: per guest, every age, once per stateroom.
      if (s.taxesUnknown) notices.push({ level: "warn", text: "Taxes and fees weren't provided for this imported sailing, so they're missing from the total." });
      add("taxes", `${rlabel} - taxes, fees & port expenses`, s.taxPP * n, s.taxOverride ? "override" : s.source === "manual" ? "manual" : "sample", { detail: `${n} × ${money.fmt(s.taxPP, { currency: "USD" })} per guest`, room: ri });

      // Gratuities
      const gRate = catDef.suite ? R.gratuitySuite : R.gratuityStd;
      const gGuests = R.gratuityKids ? n : guests.filter((g) => g.age >= 18).length;
      add("gratuities", `${rlabel} - ${cfg.gratuities === "prepaid" ? "prepaid" : "daily"} gratuities`, gRate * gGuests * nights, CF.data.ratesOverridden().includes(catDef.suite ? "gratuitySuite" : "gratuityStd") ? "override" : "reference",
        { detail: `${gGuests} guest${gGuests > 1 ? "s" : ""} × ${nights} nights × ${money.fmt(gRate, { currency: "USD" })}${catDef.suite ? " (suite rate)" : ""}. ${cfg.gratuities === "prepaid" ? "Paid with your booking." : "Charged to your onboard account each day."}`, room: ri, timing: cfg.gratuities === "prepaid" ? "final" : "onboard" });

      // Beverage packages, with the Deluxe all-adults rule.
      const wantsDeluxe = guests.some((g) => g.bev === "deluxe" && g.age >= 21);
      const bevCounts = {};
      guests.forEach((g, gi) => {
        let b = g.bev;
        if (b === "deluxe" && g.age < 21) {
          notices.push({ level: "warn", text: `${rlabel}, guest ${gi + 1} (age ${g.age}): ${D.rules.deluxeAge} Not included.` });
          b = "none";
        }
        if (wantsDeluxe && g.age >= 21 && b !== "deluxe") {
          b = "deluxe";
          notices.push({ level: "info", text: `${rlabel}, guest ${gi + 1}: Deluxe Beverage Package added. ${D.rules.deluxeAllAdults}`, key: "deluxeRule" });
        }
        if (b !== "none") bevCounts[b] = (bevCounts[b] || 0) + 1;
      });
      for (const [b, count] of Object.entries(bevCounts)) {
        const daily = pkg[b];
        add("beverage", `${rlabel} - ${D.beverage[b].name}`, svc(daily * nights * count), "sample", {
          detail: `${count} guest${count > 1 ? "s" : ""} × ${nights} days × ${money.fmt(daily, { currency: "USD" })}/day + ${R.serviceChargePct}% service charge. ${D.rules.packageWholeCruise}`,
          room: ri, timing: "precruise",
        });
      }

      // Internet: per stateroom plan.
      if (room.internet.plan !== "none") {
        const devices = room.internet.plan === "one" ? 1 : CF.clamp(room.internet.devices || 2, 2, 4);
        const rate = devices === 1 ? pkg.internetOne : pkg.internetMulti;
        add("internet", `${rlabel} - internet, ${devices} device${devices > 1 ? "s" : ""}`, rate * devices * nights, CF.data.ratesOverridden().includes(devices === 1 ? "internetOne" : "internetMulti") ? "override" : "reference", {
          detail: `${devices} device${devices > 1 ? "s" : ""} × ${nights} days × ${money.fmt(rate, { currency: "USD" })} per device per day`, room: ri, timing: "precruise",
        });
      }

      // Specialty dining per guest.
      let udpN = 0, d3N = 0, dinnerCents = 0, dinnerCount = 0, picksCents = 0, picksCount = 0;
      const shipRestaurants = CF.data.cls(s.shipId).restaurants;
      guests.forEach((g) => {
        if (g.dining.pkg === "udp") udpN++;
        else if (g.dining.pkg === "3night") {
          if (nights < 4) notices.push({ level: "warn", text: `${rlabel}: the 3-night dining package needs a sailing of 4+ nights. Not included.` });
          else d3N++;
        }
        if (g.dining.pkg === "none") {
          const dinners = CF.clamp(+g.dining.dinners || 0, 0, nights);
          dinnerCount += dinners;
          dinnerCents += dinners * pkg.specialtyAvg;
          for (const [rid, count] of Object.entries(g.dining.picks || {})) {
            if (!count || !shipRestaurants.includes(rid) || D.restaurants[rid].included) continue;
            picksCount += count;
            picksCents += D.restaurants[rid].price * count;
          }
        }
      });
      if (udpN) add("dining", `${rlabel} - Unlimited Dining Package`, svc(pkg.udp * nights * udpN), "sample", { detail: `${udpN} guest${udpN > 1 ? "s" : ""} × ${nights} days × ${money.fmt(pkg.udp, { currency: "USD" })}/day + ${R.serviceChargePct}% service charge`, room: ri, timing: "precruise" });
      if (d3N) add("dining", `${rlabel} - 3-night specialty dining package`, svc(pkg.dining3 * d3N), "sample", { detail: `${d3N} × ${money.fmt(pkg.dining3, { currency: "USD" })} + ${R.serviceChargePct}% service charge`, room: ri, timing: "precruise" });
      if (dinnerCents) add("dining", `${rlabel} - specialty dinners (à la carte)`, svc(dinnerCents), "sample", { detail: `${dinnerCount} dinner${dinnerCount > 1 ? "s" : ""} at this ship's average specialty price, ${money.fmt(pkg.specialtyAvg, { currency: "USD" })}, + ${R.serviceChargePct}% service charge`, room: ri, timing: "onboard" });
      if (picksCents) add("dining", `${rlabel} - chosen specialty restaurants`, svc(picksCents), "sample", { detail: `${picksCount} cover${picksCount > 1 ? "s" : ""} + ${R.serviceChargePct}% service charge. Children's prices may be lower; check onboard.`, room: ri, timing: "precruise" });

      // Shore excursions per guest.
      let excBudget = 0, excBudgetGuests = 0, excPick = 0, excPickN = 0;
      guests.forEach((g, gi) => {
        if (g.exc.mode === "budget" && g.exc.budget > 0) { excBudget += g.exc.budget * portDays; excBudgetGuests++; }
        if (g.exc.mode === "pick") {
          for (const [day, exId] of Object.entries(g.exc.picks || {})) {
            const call = portCalls.find((p) => String(p.day) === String(day));
            if (!call) continue;
            const ex = (D.excursionTemplates[call.port.type] || []).find((e) => e.id === exId);
            if (!ex) continue;
            if (ex.adultsOnly && g.age < 18) { notices.push({ level: "warn", text: `${rlabel}, guest ${gi + 1}: "${ex.name}" at ${call.name} is adults only. Not included.` }); continue; }
            excPick += g.age < 12 && ex.child ? ex.child : ex.adult;
            excPickN++;
          }
        }
      });
      if (excPick) add("excursions", `${rlabel} - chosen shore excursions`, excPick, "sample", { detail: `${excPickN} excursion ticket${excPickN > 1 ? "s" : ""} at sample prices`, room: ri, timing: "precruise" });
      if (excBudget) add("excursions", `${rlabel} - excursion budget`, excBudget, "user", { detail: `${excBudgetGuests} guest${excBudgetGuests > 1 ? "s" : ""} × ${portDays} port days at your budget`, room: ri, timing: "precruise" });

      // Requests (no cost)
      const reqs = [];
      if (room.room.mode === "choose") reqs.push("choose my stateroom");
      if (room.room.deck !== "any") reqs.push(`${room.room.deck} deck`);
      if (room.room.location !== "any") reqs.push(`${room.room.location} of ship`);
      if (room.room.connecting) reqs.push("connecting rooms");
      if (room.room.accessible) reqs.push("accessible stateroom");
      if (reqs.length) notices.push({ level: "info", text: `${rlabel} requests: ${reqs.join(", ")}. ${D.rules.requests}`, key: "requests" });
    });

    const guestsN = guestCount(cfg);
    const fareTaxes = lines.filter((l) => l.bucket === "fare" || l.bucket === "taxes").reduce((a, l) => a + l.cents, 0);

    // Insurance
    const ins = cfg.extras.insurance;
    if (ins.mode === "estimate") {
      const pct = ins.pct ?? R.insurancePct;
      add("insurance", "Travel insurance (estimate)", money.pct(fareTaxes, pct), "estimate", { detail: `${pct}% of cruise fare and taxes. Real quotes depend on age, state and coverage.`, timing: "final" });
    } else if (ins.mode === "manual") add("insurance", "Travel insurance", ins.amount, "user", { detail: "Amount you entered", timing: "final" });

    // Transfers
    const tr = cfg.extras.transfers;
    if (tr.mode === "estimate") add("transfers", "Airport transfers, round trip", R.transferEach * 2 * guestsN, "reference", { detail: `${guestsN} guests × 2 transfers × ${money.fmt(R.transferEach, { currency: "USD" })}`, timing: "final" });
    else if (tr.mode === "manual") add("transfers", "Airport transfers", tr.amount, "user", { detail: "Amount you entered", timing: "final" });

    add("onboard", "Spa treatments", cfg.extras.spa, "user", { detail: "Amount you entered", timing: "onboard" });
    add("onboard", "Other onboard spending", cfg.extras.onboard, "user", { detail: "Shops, photos, arcade, extra drinks. Amount you entered", timing: "onboard" });
    add("onboard", "Other extras", cfg.extras.other, "user", { detail: "Amount you entered", timing: "onboard" });

    // Travel
    const T = cfg.travel;
    const flyers = T.flights.people > 0 ? T.flights.people : guestsN;
    add("flights", "Flights", T.flights.perPerson * flyers, "user", { detail: `${flyers} traveler${flyers > 1 ? "s" : ""} × ${money.fmt(T.flights.perPerson, { currency: "USD" })}`, timing: "separate" });
    const rooms = cfg.rooms.length;
    add("hotel", "Hotel before the cruise", T.hotelBefore.nights * T.hotelBefore.rate * rooms, "user", { detail: `${T.hotelBefore.nights} night${T.hotelBefore.nights > 1 ? "s" : ""} × ${rooms} room${rooms > 1 ? "s" : ""} × ${money.fmt(T.hotelBefore.rate, { currency: "USD" })}`, timing: "separate" });
    add("hotel", "Hotel after the cruise", T.hotelAfter.nights * T.hotelAfter.rate * rooms, "user", { detail: `${T.hotelAfter.nights} night${T.hotelAfter.nights > 1 ? "s" : ""} × ${rooms} room${rooms > 1 ? "s" : ""} × ${money.fmt(T.hotelAfter.rate, { currency: "USD" })}`, timing: "separate" });
    add("transport", "Port parking", T.parking.perDay * (nights + 1), "user", { detail: `${nights + 1} days × ${money.fmt(T.parking.perDay, { currency: "USD" })}`, timing: "separate" });
    add("transport", "Transportation to the port", T.portTransport, "user", { detail: "Amount you entered", timing: "separate" });
    add("transport", "Rental car", T.rentalCar, "user", { detail: "Amount you entered", timing: "separate" });
    add("otherTravel", "Other travel expenses", T.other, "user", { detail: "Amount you entered", timing: "separate" });

    // Default timings
    for (const l of lines) if (!l.timing) l.timing = l.bucket === "fare" || l.bucket === "taxes" ? "final" : "precruise";

    // Totals
    const buckets = Object.fromEntries(BUCKETS.map((b) => [b.id, 0]));
    for (const l of lines) buckets[l.bucket] += l.cents;
    const sumKind = (k) => lines.filter((l) => l.kind === k).reduce((a, l) => a + l.cents, 0);
    const total = lines.reduce((a, l) => a + l.cents, 0);
    const mandatory = sumKind("mandatory");
    const totals = {
      total,
      cruiseOnly: mandatory,
      mandatory,
      optional: sumKind("optional"),
      travel: sumKind("travel"),
      taxes: buckets.taxes,
      fare: buckets.fare,
      guests: guestsN,
      nights,
      perPerson: guestsN ? Math.round(total / guestsN) : 0,
      perNight: nights ? Math.round(total / nights) : 0,
      perPersonPerNight: guestsN && nights ? Math.round(total / guestsN / nights) : 0,
      cruiseOnlyPerPerson: guestsN ? Math.round(mandatory / guestsN) : 0,
    };

    // Payment schedule (sample terms)
    const anySuite = roomsOut.some((r) => ["GS", "OWN", "RLS"].includes(r.cat));
    const depositPP = anySuite ? R.depositSuite : nights <= 5 ? R.depositShort : R.depositLong;
    const finalDays = nights <= 4 ? R.finalDaysShort : R.finalDaysLong;
    const finalDate = date.add(s.depart, -finalDays);
    const bookingTotal = lines.filter((l) => l.timing === "final").reduce((a, l) => a + l.cents, 0);
    const pastFinal = date.today() >= finalDate;
    const deposit = pastFinal ? bookingTotal : Math.min(bookingTotal, depositPP * guestsN);
    const payments = {
      deposit,
      depositPP,
      pastFinal,
      finalDate,
      bookingTotal,
      dueByFinal: bookingTotal - deposit,
      precruise: lines.filter((l) => l.timing === "precruise").reduce((a, l) => a + l.cents, 0),
      onboard: lines.filter((l) => l.timing === "onboard").reduce((a, l) => a + l.cents, 0),
      separate: lines.filter((l) => l.timing === "separate").reduce((a, l) => a + l.cents, 0),
    };

    // What's included at no extra charge, and what isn't priced at all.
    const md = { "trad-early": "Main Dining Room, traditional early seating", "trad-late": "Main Dining Room, traditional late seating", mytime: "My Time Dining (flexible times)" }[cfg.mainDining] || "Main Dining Room";
    included.push(md, "Windjammer buffet and casual eateries", "Water, basic coffee, tea, lemonade and iced tea", "Pools, shows and most activities", "Kids clubs (ages 3-17)");
    if (cfg.mainDining === "mytime" && cfg.gratuities !== "prepaid") notices.push({ level: "info", text: D.rules.myTime });
    const notIncluded = [];
    if (!buckets.beverage) notIncluded.push("Drinks beyond the included basics (no beverage package selected)");
    if (!buckets.internet) notIncluded.push("Internet (no plan selected)");
    if (!buckets.excursions) notIncluded.push("Shore excursions");
    if (!buckets.insurance) notIncluded.push("Travel insurance");
    if (!buckets.flights) notIncluded.push("Flights");
    if (!buckets.hotel) notIncluded.push("Hotels before or after the cruise");
    if (!buckets.transport && !buckets.transfers) notIncluded.push("Getting to the port (parking, transfers, rideshare)");
    if (!buckets.onboard) notIncluded.push("Onboard spending (spa, shops, photos, arcade)");

    const sources = [...new Set(lines.map((l) => l.source))];
    return {
      sailingId: s.id,
      valid,
      lines,
      buckets,
      totals,
      payments,
      notices: dedupe(notices),
      included,
      notIncluded,
      rooms: roomsOut,
      substituted: roomsOut.some((r) => r.substituted),
      sources,
      sample: s.source === "sample",
      pricedAt: s.overriddenAt ? new Date(s.overriddenAt).toISOString().slice(0, 10) : s.pricedAt,
      snapshot: opts.snapshot ?? null,
      config: cfg,
    };
  }
  function dedupe(list) { const seen = new Set(); return list.filter((n) => (seen.has(n.text) ? false : seen.add(n.text))); }

  /* ---------- cache for list views (search, dates, assistant) ---------- */
  // Keyed on the configuration (hashed once per object). Admin override changes call clearCache().
  let cache = new Map();
  let cacheKey = "", lastCfg = null, lastCfgKey = "";
  function quick(s, cfg) {
    if (cfg !== lastCfg) { lastCfg = cfg; lastCfgKey = String(CF.hashStr(JSON.stringify(cfg))); }
    const key = lastCfgKey;
    if (key !== cacheKey) { cache = new Map(); cacheKey = key; }
    let q = cache.get(s.id);
    if (!q) { q = price(s, cfg); cache.set(s.id, q); }
    return q;
  }

  // "Best value" score shown in comparisons, with its formula spelled out in the UI:
  // estimated total ÷ (nights + ½ × port visits). Lower is better. Port days count half a "bonus day".
  const valueScore = (q, s) => Math.round(q.totals.total / (s.nights + 0.5 * CF.data.portCalls(s).length));

  CF.pricing = {
    BUCKETS, BUCKET, SOURCE_LABEL,
    defaultConfig, normalize, newGuest, newRoom, guestCount, ageBand,
    offered, resolveCategory, price, quick, valueScore,
    clearCache() { cache = new Map(); cacheKey = ""; lastCfg = null; },
  };
})();
