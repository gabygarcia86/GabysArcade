/* The eight configuration steps, shared by the Configure page (for one sailing) and the Trip preferences editor
 * (sailing = null: generic choices that apply to every cruise, so comparisons stay fair).
 * Every control has a stable id so the page can re-render and put keyboard focus back where it was. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, money } = CF;
  const D = CF.DATA;

  function steps(cfg, s, onChange) {
    const ui = CF.ui;
    const set = (fn) => { const n = CF.clone(cfg); fn(n); onChange(n); };
    const pkg = s ? CF.data.packageRates(s) : null;
    const R = CF.data.rates();
    const fmt = (c) => money.fmt(c);
    const gLabel = (ri, gi, g) => `${cfg.rooms.length > 1 ? `Room ${ri + 1}, ` : ""}Guest ${gi + 1} (${g.age < 2 ? "infant" : "age " + g.age})`;
    const step = (n, title, help, ...body) => h("section", { class: "step", id: "step-" + n, "aria-labelledby": "step-h-" + n },
      h("div", { class: "step-head" }, h("span", { class: "step-num" }, n), h("div", null, h("h2", { id: "step-h-" + n }, title), help ? h("p", { class: "muted small" }, help) : null)),
      h("div", { class: "step-body" }, body));
    const rule = (text) => h("p", { class: "rule-note" }, ui.icon("info"), h("span", null, text));
    const out = h("div", { class: "steps" });

    /* 1. Stateroom category + travelers */
    out.append(step(1, "Choose your stateroom", s ? "Per-person fares assume two guests sharing. Prices update the total instantly." : "Pick the category you'd usually book. If a ship doesn't offer it or it's sold out, the app uses the nearest category and tells you.",
      cfg.rooms.map((room, ri) => h("div", { class: "room-block" },
        cfg.rooms.length > 1 ? h("h3", null, `Stateroom ${ri + 1}`) : null,
        h("div", { class: "cat-grid", role: "radiogroup", "aria-label": `Stateroom ${ri + 1} category` },
          (s ? CF.pricing.offered(s) : Object.keys(D.categories)).map((cat) => {
            const def = D.categories[cat];
            const f = s?.fares[cat];
            const on = room.category === cat;
            const out = s && !f.avail;
            return h("button", { type: "button", id: `c-r${ri}-cat-${cat}`, class: "cat-card" + (on ? " on" : "") + (out ? " soldout" : ""), role: "radio", "aria-checked": String(on), disabled: out || undefined,
              onClick: () => set((n) => { n.rooms[ri].category = cat; }) },
              h("span", { class: "cat-name" }, def.name),
              s ? h("span", { class: "cat-price" }, out ? "Sold out" : [ui.whole(f.pp), h("small", null, " pp")]) : null,
              s && f.few && !out ? h("span", { class: "pill warn" }, "Few left") : null,
              s && f.override ? ui.badge("override", true) : null,
              h("span", { class: "cat-desc" }, def.desc),
              h("span", { class: "cat-meta" }, `Up to ${def.maxOcc} guests · ${def.sqft} sq ft`));
          })))),
      h("h3", null, "Who's traveling"),
      ui.travelers(cfg, (n) => onChange(n), { noPresets: false })));

    /* 2. Stateroom options */
    out.append(step(2, "Stateroom options", D.rules.noInventory,
      cfg.rooms.map((room, ri) => {
        const f = s?.fares[room.category];
        return h("div", { class: "room-block" },
          cfg.rooms.length > 1 ? h("h3", null, `Stateroom ${ri + 1} · ${D.categories[room.category].name}`) : null,
          ui.segmented([
            { id: "gty", label: `Guarantee${f?.gty ? ` (save ${f.gty}%)` : ""}` },
            { id: "choose", label: "Choose my stateroom" },
          ], room.room.mode, (v) => set((n) => { n.rooms[ri].room.mode = v; }), `Stateroom ${ri + 1} assignment`),
          h("p", { class: "muted small" }, room.room.mode === "gty" ? "Royal Caribbean assigns a stateroom in this category (or better) before you sail. Sometimes cheaper; you can't pick the location." : "You'd pick an exact stateroom when booking. Without live inventory the app can't show which ones are free, so these are noted as requests."),
          h("div", { class: "grid-3" },
            ui.field("Deck preference", ui.select([{ id: "any", label: "No preference" }, { id: "low", label: "Lower deck (less motion)" }, { id: "mid", label: "Middle decks" }, { id: "high", label: "Higher deck (closer to pools)" }], room.room.deck, (v) => set((n) => { n.rooms[ri].room.deck = v; }), { id: `c-r${ri}-deck` })),
            ui.field("Location", ui.select([{ id: "any", label: "No preference" }, { id: "forward", label: "Forward" }, { id: "mid", label: "Midship (least motion)" }, { id: "aft", label: "Aft" }], room.room.location, (v) => set((n) => { n.rooms[ri].room.location = v; }), { id: `c-r${ri}-loc` })),
            h("div", { class: "checks" },
              cfg.rooms.length > 1 ? h("label", { class: "check" }, h("input", { type: "checkbox", id: `c-r${ri}-conn`, checked: room.room.connecting || undefined, onChange: (e) => set((n) => { n.rooms[ri].room.connecting = e.target.checked; }) }), "Connecting to another stateroom") : null,
              h("label", { class: "check" }, h("input", { type: "checkbox", id: `c-r${ri}-acc`, checked: room.room.accessible || undefined, onChange: (e) => set((n) => { n.rooms[ri].room.accessible = e.target.checked; }) }), "Accessible stateroom"))),
          h("p", { class: "muted small" }, `Maximum occupancy for ${D.categories[room.category].name}: ${D.categories[room.category].maxOcc} guests.`));
      })));

    /* 3. Dining */
    const restaurants = s ? CF.data.cls(s.shipId).restaurants.map((id) => ({ id, ...D.restaurants[id] })) : [];
    out.append(step(3, "Dining", "Main dining and casual venues are included. Specialty restaurants and dining packages cost extra.",
      h("div", { class: "included-row" }, h("span", { class: "pill good" }, ui.icon("check"), "Included"),
        ui.segmented([{ id: "trad-early", label: "Traditional, early" }, { id: "trad-late", label: "Traditional, late" }, { id: "mytime", label: "My Time Dining" }], cfg.mainDining, (v) => set((n) => { n.mainDining = v; }), "Main dining time")),
      cfg.mainDining === "mytime" ? rule(D.rules.myTime) : null,
      s ? h("div", { class: "rest-lists" },
        h("div", null, h("h4", null, "Included on ", CF.data.ship(s.shipId).name), h("ul", { class: "plain" }, restaurants.filter((r) => r.included).map((r) => h("li", null, h("strong", null, r.name), " · ", h("span", { class: "muted" }, r.desc))))),
        h("div", null, h("h4", null, "Specialty (extra cost, sample prices)"), h("ul", { class: "plain" }, restaurants.filter((r) => !r.included).map((r) => h("li", null, h("strong", null, r.name), ` · ${fmt(r.price)} pp · `, h("span", { class: "muted" }, r.desc)))))) : null,
      h("div", { class: "guest-table" },
        cfg.rooms.flatMap((room, ri) => room.guests.map((g, gi) => h("div", { class: "guest-row" },
          h("div", { class: "guest-name" }, gLabel(ri, gi, g)),
          ui.select([
            { id: "none", label: "No dining package" },
            { id: "udp", label: `Unlimited Dining Package${pkg ? ` · ${fmt(pkg.udp)}/day` : ""}` },
            { id: "3night", label: `3-night dining package${pkg ? ` · ${fmt(pkg.dining3)}` : ""}`, disabled: s && s.nights < 4 },
          ], g.dining.pkg, (v) => set((n) => { n.rooms[ri].guests[gi].dining.pkg = v; }), { id: `c-r${ri}-g${gi}-dpkg`, "aria-label": `${gLabel(ri, gi, g)} dining package` }),
          g.dining.pkg === "none" ? h("label", { class: "inline" }, h("span", { class: "small muted" }, "Specialty dinners"),
            ui.numberInput(g.dining.dinners, (v) => set((n) => { n.rooms[ri].guests[gi].dining.dinners = v; }), { min: 0, max: 30, id: `c-r${ri}-g${gi}-dinners`, "aria-label": `${gLabel(ri, gi, g)} number of specialty dinners` }),
            h("span", { class: "small muted" }, pkg ? `at ~${fmt(pkg.specialtyAvg)} avg` : "at the ship's average price")) : h("span", { class: "small muted" }, "Plus 18% service charge"),
          s && g.dining.pkg === "none" ? h("details", { class: "picks", id: `c-r${ri}-g${gi}-picks`, open: Object.values(g.dining.picks || {}).some(Boolean) || undefined },
            h("summary", null, "Or choose specific restaurants"),
            h("div", { class: "pick-grid" }, restaurants.filter((r) => !r.included).map((r) => h("label", { class: "inline" },
              h("span", { class: "small" }, `${r.name} (${fmt(r.price)})`),
              ui.numberInput(g.dining.picks?.[r.id] || 0, (v) => set((n) => { n.rooms[ri].guests[gi].dining.picks = { ...(n.rooms[ri].guests[gi].dining.picks || {}), [r.id]: v }; }), { min: 0, max: 10, id: `c-r${ri}-g${gi}-pick-${r.id}`, "aria-label": `${gLabel(ri, gi, g)} visits to ${r.name}` }))))) : null)))),
      rule(D.rules.packageWholeCruise)));

    /* 4. Beverage packages */
    const bevOpt = (g, id) => {
      const def = D.beverage[id];
      const blocked = id === "deluxe" && g.age < 21;
      return { id, label: `${def.name}${pkg && id !== "none" ? ` · ${fmt(pkg[id])}/day` : ""}${blocked ? " (21+ only)" : ""}`, disabled: blocked };
    };
    out.append(step(4, "Beverage packages", "Optional. Prices are per guest per day, for every day of the cruise, plus an 18% service charge.",
      h("div", { class: "bev-cards" }, ["soda", "refresh", "deluxe"].map((id) => h("div", { class: "mini-card" }, h("strong", null, D.beverage[id].name), pkg ? h("div", { class: "price-line" }, `${fmt(pkg[id])} per day`, h("small", null, ` (${fmt(money.pct(pkg[id] * (s?.nights || 7), R.serviceChargePct) + pkg[id] * (s?.nights || 7))} for ${s?.nights || 7} days incl. service)`)) : h("div", { class: "muted small" }, "Price varies by ship and sailing"), h("p", { class: "small muted" }, D.beverage[id].desc)))),
      h("div", { class: "quick-row" },
        h("button", { type: "button", class: "btn ghost sm", onClick: () => set((n) => n.rooms.forEach((r) => r.guests.forEach((g) => { if (g.age >= 21) g.bev = "deluxe"; }))) }, "Deluxe for every guest 21+"),
        h("button", { type: "button", class: "btn ghost sm", onClick: () => set((n) => n.rooms.forEach((r) => r.guests.forEach((g) => { if (g.age < 21 && g.age >= 2) g.bev = "refresh"; }))) }, "Refreshment for guests under 21"),
        h("button", { type: "button", class: "btn ghost sm", onClick: () => set((n) => n.rooms.forEach((r) => r.guests.forEach((g) => { g.bev = "none"; }))) }, "No packages")),
      h("div", { class: "guest-table" }, cfg.rooms.flatMap((room, ri) => room.guests.map((g, gi) => h("div", { class: "guest-row" },
        h("div", { class: "guest-name" }, gLabel(ri, gi, g)),
        ui.select(["none", "soda", "refresh", "deluxe"].map((id) => bevOpt(g, id)), g.bev, (v) => set((n) => { n.rooms[ri].guests[gi].bev = v; }), { id: `c-r${ri}-g${gi}-bev`, "aria-label": `${gLabel(ri, gi, g)} beverage package` }))))),
      rule(D.rules.deluxeAllAdults), rule(D.rules.deluxeAge)));

    /* 5. Internet */
    out.append(step(5, "Internet", "Optional. Plans are bought per device, per day, for the whole cruise.",
      cfg.rooms.map((room, ri) => h("div", { class: "room-block" },
        cfg.rooms.length > 1 ? h("h3", null, `Stateroom ${ri + 1}`) : null,
        ui.segmented([
          { id: "none", label: "No internet" },
          { id: "one", label: `One device${pkg ? ` · ${fmt(pkg.internetOne)}/day` : ""}` },
          { id: "multi", label: `Multi-device${pkg ? ` · ${fmt(pkg.internetMulti)}/device/day` : ""}` },
        ], room.internet.plan, (v) => set((n) => { n.rooms[ri].internet.plan = v; }), `Stateroom ${ri + 1} internet`),
        room.internet.plan === "multi" ? ui.field("Devices", ui.select([2, 3, 4].map((d) => ({ id: d, label: `${d} devices` })), room.internet.devices, (v) => set((n) => { n.rooms[ri].internet.devices = +v; }), { id: `c-r${ri}-devices` }), "Share devices across guests in this stateroom. Add more staterooms' plans separately.") : null)),
      h("p", { class: "muted small" }, `Reference rates: ${fmt(R.internetOne)} per day for one device, ${fmt(R.internetMulti)} per device per day on multi-device plans. Royal Caribbean often discounts these before sailing.`)));

    /* 6. Gratuities */
    const gStd = R.gratuityStd, gSuite = R.gratuitySuite;
    out.append(step(6, "Gratuities", D.rules.gratuities,
      ui.segmented([{ id: "prepaid", label: "Prepay with my booking" }, { id: "onboard", label: "Charge onboard daily" }], cfg.gratuities, (v) => set((n) => { n.gratuities = v; }), "Gratuities"),
      h("p", { class: "small" }, `Reference rates: ${fmt(gStd)} per guest per night (${fmt(gSuite)} in suites)${R.gratuityKids ? ", charged for every guest including children" : ""}. They're always included in your total either way.`)));

    /* 7. Optional extras */
    const calls = s ? CF.data.portCalls(s) : [];
    out.append(step(7, "Optional extras", "Shore excursions, insurance, transfers, spa and spending money. Leave anything at zero to skip it; skipped items are listed under \"Not in this estimate\".",
      h("h3", null, "Shore excursions"),
      h("div", { class: "guest-table" }, cfg.rooms.flatMap((room, ri) => room.guests.map((g, gi) => h("div", { class: "guest-row wrap" },
        h("div", { class: "guest-name" }, gLabel(ri, gi, g)),
        ui.select([{ id: "none", label: "No excursions" }, { id: "budget", label: "Budget per port day" }, ...(s ? [{ id: "pick", label: "Choose excursions" }] : [])], g.exc.mode === "pick" && !s ? "budget" : g.exc.mode, (v) => set((n) => { n.rooms[ri].guests[gi].exc.mode = v; }), { id: `c-r${ri}-g${gi}-exc`, "aria-label": `${gLabel(ri, gi, g)} excursions` }),
        g.exc.mode === "budget" || (g.exc.mode === "pick" && !s) ? h("label", { class: "inline" }, ui.moneyInput(g.exc.budget, (v) => set((n) => { n.rooms[ri].guests[gi].exc.budget = v; n.rooms[ri].guests[gi].exc.mode = "budget"; }), { id: `c-r${ri}-g${gi}-excb`, "aria-label": `${gLabel(ri, gi, g)} excursion budget per port day` }), h("span", { class: "small muted" }, s ? `× ${calls.length} port days` : "per port day")) : null,
        g.exc.mode === "pick" && s ? h("div", { class: "exc-picks" }, calls.map((c) => {
          const opts = D.excursionTemplates[c.port.type] || [];
          return h("label", { class: "inline" }, h("span", { class: "small" }, `Day ${c.day}: ${c.name.split(",")[0]}`),
            ui.select([{ id: "", label: "None" }, ...opts.map((e) => ({ id: e.id, label: `${e.name} · ${fmt(g.age < 12 && e.child ? e.child : e.adult)}${e.adultsOnly ? " (adults only)" : ""}`, disabled: e.adultsOnly && g.age < 18 }))], g.exc.picks?.[c.day] || "", (v) => set((n) => { n.rooms[ri].guests[gi].exc.picks = { ...(n.rooms[ri].guests[gi].exc.picks || {}), [c.day]: v }; }), { id: `c-r${ri}-g${gi}-x${c.day}`, "aria-label": `${gLabel(ri, gi, g)} excursion on day ${c.day}` }));
        })) : null)))),
      s ? h("p", { class: "muted small" }, "Excursion names and prices are generic samples by port type, not Royal Caribbean's actual tours. Children under 12 use the child price.") : null,
      h("div", { class: "grid-2" },
        h("div", null, h("h3", null, "Travel insurance"),
          ui.segmented([{ id: "none", label: "None" }, { id: "estimate", label: "Estimate it" }, { id: "manual", label: "I have a quote" }], cfg.extras.insurance.mode, (v) => set((n) => { n.extras.insurance.mode = v; }), "Travel insurance"),
          cfg.extras.insurance.mode === "estimate" ? ui.field("Percent of cruise fare and taxes", ui.numberInput(cfg.extras.insurance.pct ?? R.insurancePct, (v) => set((n) => { n.extras.insurance.pct = v; }), { min: 1, max: 20, id: "c-ins-pct" }), "Policies commonly cost 5-10% of the trip.") : null,
          cfg.extras.insurance.mode === "manual" ? ui.field("Quoted amount", ui.moneyInput(cfg.extras.insurance.amount, (v) => set((n) => { n.extras.insurance.amount = v; }), { id: "c-ins-amt" })) : null),
        h("div", null, h("h3", null, "Airport transfers"),
          ui.segmented([{ id: "none", label: "None" }, { id: "estimate", label: `Estimate (${fmt(R.transferEach)} each way pp)` }, { id: "manual", label: "Enter amount" }], cfg.extras.transfers.mode, (v) => set((n) => { n.extras.transfers.mode = v; }), "Airport transfers"),
          cfg.extras.transfers.mode === "manual" ? ui.field("Transfer cost (total)", ui.moneyInput(cfg.extras.transfers.amount, (v) => set((n) => { n.extras.transfers.amount = v; }), { id: "c-tr-amt" })) : null)),
      h("div", { class: "grid-3" },
        ui.field("Spa treatments", ui.moneyInput(cfg.extras.spa, (v) => set((n) => { n.extras.spa = v; }), { id: "c-spa" }), "Total for your group"),
        ui.field("Onboard spending", ui.moneyInput(cfg.extras.onboard, (v) => set((n) => { n.extras.onboard = v; }), { id: "c-onboard" }), "Shops, photos, arcade, extra drinks"),
        ui.field("Other extras", ui.moneyInput(cfg.extras.other, (v) => set((n) => { n.extras.other = v; }), { id: "c-other" })))));

    /* 8. Transportation and travel */
    const T = cfg.travel;
    out.append(step(8, "Getting there and back", "Add your own estimates. Live airfare and hotel prices aren't connected, so these amounts are labelled \"Your estimate\".",
      h("div", { class: "grid-3" },
        ui.field("Flights, per person (round trip)", ui.moneyInput(T.flights.perPerson, (v) => set((n) => { n.travel.flights.perPerson = v; }), { id: "c-fl" })),
        ui.field("Travelers flying", ui.numberInput(T.flights.people, (v) => set((n) => { n.travel.flights.people = v; }), { min: 0, max: 32, id: "c-fl-n" }), "0 = everyone"),
        ui.field("Airport or port parking, per day", ui.moneyInput(T.parking.perDay, (v) => set((n) => { n.travel.parking.perDay = v; }), { id: "c-park" }), s ? `× ${s.nights + 1} days` : "× nights + 1")),
      h("div", { class: "grid-3" },
        ui.field("Hotel before: nights", ui.numberInput(T.hotelBefore.nights, (v) => set((n) => { n.travel.hotelBefore.nights = v; }), { min: 0, max: 14, id: "c-hb-n" })),
        ui.field("Hotel before: rate per room per night", ui.moneyInput(T.hotelBefore.rate, (v) => set((n) => { n.travel.hotelBefore.rate = v; }), { id: "c-hb-r" }), `× ${CF.plural(cfg.rooms.length, "room")}`),
        ui.field("Transportation to the port", ui.moneyInput(T.portTransport, (v) => set((n) => { n.travel.portTransport = v; }), { id: "c-pt" }), "Rideshare, shuttle, gas, tolls")),
      h("div", { class: "grid-3" },
        ui.field("Hotel after: nights", ui.numberInput(T.hotelAfter.nights, (v) => set((n) => { n.travel.hotelAfter.nights = v; }), { min: 0, max: 14, id: "c-ha-n" })),
        ui.field("Hotel after: rate per room per night", ui.moneyInput(T.hotelAfter.rate, (v) => set((n) => { n.travel.hotelAfter.rate = v; }), { id: "c-ha-r" })),
        ui.field("Rental car", ui.moneyInput(T.rentalCar, (v) => set((n) => { n.travel.rentalCar = v; }), { id: "c-car" }))),
      ui.field("Other travel expenses", ui.moneyInput(T.other, (v) => set((n) => { n.travel.other = v; }), { id: "c-tother" }), "Passports, pet care, luggage fees, anything else")));

    return out;
  }

  // Short text describing a configuration, for summaries and comparison headers.
  function summary(cfg) {
    const g = cfg.rooms.flatMap((r) => r.guests);
    const bev = g.filter((x) => x.bev !== "none").length;
    const parts = [CF.ui.travelerSummary(cfg), [...new Set(cfg.rooms.map((r) => D.categories[r.category].name))].join(" + ")];
    parts.push(bev ? `${bev} beverage package${bev > 1 ? "s" : ""}` : "no drink packages");
    parts.push(cfg.rooms.some((r) => r.internet.plan !== "none") ? "internet" : "no internet");
    parts.push(cfg.gratuities === "prepaid" ? "prepaid gratuities" : "gratuities onboard");
    const travel = cfg.travel.flights.perPerson || cfg.travel.hotelBefore.nights || cfg.travel.parking.perDay || cfg.travel.portTransport;
    if (travel) parts.push("travel costs included");
    return parts.join(" · ");
  }

  // Re-render a container and return focus to the control that had it.
  function rerenderKeepFocus(container, build) {
    const id = document.activeElement?.id;
    const openDetails = [...container.querySelectorAll("details[id]")].filter((d) => d.open).map((d) => d.id);
    CF.clear(container).append(build());
    openDetails.forEach((did) => { const d = document.getElementById(did); if (d) d.open = true; });
    if (id) { const el = document.getElementById(id); if (el) el.focus({ preventScroll: true }); }
  }

  CF.configUI = { steps, summary, rerenderKeepFocus };
})();
