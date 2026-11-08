/* Cruise details: ship, itinerary (timeline or map), ports, fares and other dates. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, date, clear } = CF;

  // Shared actions: add to a wish list, track a price.
  function addToList(sailingId) {
    const lists = CF.saved.lists();
    const body = h("div", { class: "list-picker" },
      lists.length ? lists.map((l) => h("label", { class: "check" }, h("input", { type: "checkbox", checked: l.items.includes(sailingId) || undefined, onChange: () => CF.saved.toggleInList(l.id, sailingId) }), `${l.name} (${l.items.length})`)) : h("p", { class: "muted" }, "You don't have any wish lists yet."),
      h("button", { class: "btn ghost sm", onClick: async () => { const name = await CF.ui.prompt("New wish list", "List name", "Summer ideas"); if (name) { const l = CF.saved.createList(name); CF.saved.toggleInList(l.id, sailingId); m.close(); CF.ui.toast(`Added to "${name}".`, "good"); } } }, CF.ui.icon("plus"), "New list"));
    const m = CF.ui.modal({ title: "Add to a wish list", body, actions: [{ label: "Done", primary: true }] });
  }
  function trackPrice(s, config) {
    const q = CF.pricing.price(s, config);
    let target = Math.round(q.totals.total * 0.9 / 10000) * 10000;
    CF.ui.modal({
      title: "Track this price",
      body: h("div", null,
        h("p", null, `Current estimated total: `, h("strong", null, CF.ui.whole(q.totals.total)), ` for ${CF.configUI.summary(q.config)}.`),
        h("p", { class: "muted small" }, "The tracker re-prices this exact configuration (same travelers, stateroom and packages) so changes are meaningful. Alerts show when you open the app; there's no server to email you."),
        CF.ui.field("Alert me when the total is at or below", CF.ui.moneyInput(target, (v) => (target = v)))),
      actions: [{ label: "Cancel" }, { label: "Start tracking", primary: true, onClick: () => { CF.tracker.add(s.id, q.config, target, q.totals.total); CF.ui.toast("Tracking started. See it in Price Tracker.", "good"); } }],
    });
  }
  CF.actions = { addToList, trackPrice };

  CF.pages.cruise = {
    title: "Cruise details",
    nav: "search",
    render(ctx) {
      const ui = CF.ui;
      const s = CF.data.get(ctx.params[0]);
      if (!s) return CF.pages.notfound.render();
      CF.saved.addRecent(s.id);
      const ship = CF.data.ship(s.shipId), cls = CF.data.cls(s.shipId), it = CF.data.it(s.itId);
      ctx.setTitle(`${CF.data.name(s)} on ${ship.name}`);
      const profile = CF.profile.get();
      const q = CF.pricing.price(s, profile);
      const from = CF.data.fromPrice(s);
      const timeline = CF.data.timeline(s);
      const ports = [...new Map(CF.data.portCalls(s).map((d) => [d.id, d.port])).values()];

      // Itinerary: timeline or map
      const itinBody = h("div", { class: "itin-body" });
      let view = "timeline";
      const drawItin = () => {
        clear(itinBody);
        if (view === "timeline") {
          itinBody.append(h("table", { class: "timeline" },
            h("thead", null, h("tr", null, h("th", null, "Day"), h("th", null, "Date"), h("th", null, "Location"), h("th", null, "Activity"), h("th", null, "Arrive"), h("th", null, "Depart"))),
            h("tbody", null, timeline.map((d) => h("tr", { class: "k-" + d.kind },
              h("td", null, h("span", { class: "day-dot" }, d.day)), h("td", null, date.fmt(d.date, "dow")),
              h("td", null, h("strong", null, d.name)), h("td", null, d.activity), h("td", null, d.arrive || "–"), h("td", null, d.depart || "–"))))),
            h("p", { class: "muted small" }, "Times are typical sample times. Royal Caribbean publishes exact times with your booking and may change them."));
        } else CF.map.render(itinBody, s);
      };
      const viewToggle = h("div", { class: "view-toggle" });
      const drawToggle = () => clear(viewToggle).append(ui.segmented([{ id: "timeline", label: "Timeline" }, { id: "map", label: "Map" }], view, (v) => { view = v; drawToggle(); drawItin(); }, "Itinerary view"));
      drawToggle();
      drawItin();

      const otherDates = CF.data.all().filter((x) => x.itId === s.itId && x.shipId === s.shipId && x.id !== s.id).slice(0, 12).map((x) => ({ x, q: CF.pricing.quick(x, profile) })).filter((r) => r.q.valid);
      const minOther = Math.min(q.totals.total, ...otherDates.map((r) => r.q.totals.total));
      const restaurants = cls.restaurants.map((id) => ({ id, ...CF.DATA.restaurants[id] }));
      const list = (items) => h("ul", { class: "plain bullets" }, items.map((t) => h("li", null, t)));

      return h("div", { class: "page detail" },
        h("section", { class: "detail-hero" },
          h("div", { class: "detail-art", html: CF.art.sailing(s, { w: 1200, h: 460, shipScale: 0.58 }) }),
          h("div", { class: "wrap detail-head" },
            h("div", null,
              h("p", { class: "eyebrow" }, `${ship.name} · ${cls.name}`),
              h("h1", null, CF.data.name(s)),
              h("p", { class: "detail-meta" }, `${date.fmt(s.depart, "long")} – ${date.fmt(s.ret, "long")} · ${it.oneWay ? `${CF.data.port(s.port).name} to ${CF.data.port(s.endPort).name}` : `Round trip from ${CF.data.port(s.port).name}`}`),
              h("p", { class: "detail-meta" }, `${s.nights} nights · ${ports.length} ports · ${CF.data.seaDays(s)} sea days`, s.promo ? [" · ", ui.pill(s.promo.label, "promo", "tag")] : null)),
            h("div", { class: "detail-actions" },
              h("a", { class: "btn primary big", href: `#/configure/${s.id}` }, "Configure pricing"),
              ui.compareButton(s.id), ui.favButton(s.id),
              h("button", { class: "btn ghost", onClick: () => addToList(s.id) }, ui.icon("list"), "Wish list"),
              h("button", { class: "btn ghost", onClick: () => trackPrice(s, profile) }, ui.icon("bell"), "Track price")))),
        h("div", { class: "wrap detail-layout" },
          h("div", { class: "detail-main" },
            ui.sampleNotice(true),
            h("section", { class: "section" }, h("div", { class: "section-head" }, h("h2", null, "Itinerary"), viewToggle), itinBody),
            h("section", { class: "section" }, h("h2", null, "Ports of call"),
              h("div", { class: "port-grid" }, ports.map((p) => h("div", { class: "port-card" }, h("div", { class: "port-art", html: CF.art.port(p, { w: 400, h: 200 }) }), h("div", { class: "port-body" }, h("h3", null, p.name), h("p", { class: "muted small" }, p.desc)))))),
            h("section", { class: "section" }, h("h2", null, `About ${ship.name}`),
              h("p", { class: "muted" }, cls.tagline),
              h("div", { class: "spec-grid" },
                ui.stat("Introduced", ship.year, ship.refurb ? `Refreshed ${ship.refurb}` : null),
                ui.stat("Guests", ship.guests.toLocaleString(), "double occupancy, approx."),
                ui.stat("Gross tonnage", ship.gt.toLocaleString(), "approx."),
                ui.stat("Crew", "~" + cls.crew.toLocaleString(), "approx."),
                ui.stat("Decks", cls.decks, "guest decks, approx."),
                ui.stat("Length", `${cls.lengthFt.toLocaleString()} ft`, "approx.")),
              h("p", { class: "muted small" }, "Ship facts are approximate figures from public sources. Venues vary by ship and change over time; check Royal Caribbean for the current list."),
              h("div", { class: "grid-2" },
                h("div", null, h("h3", null, "Dining"),
                  h("h4", null, "Included"), list(restaurants.filter((r) => r.included).map((r) => `${r.name}: ${r.desc}`)),
                  h("h4", null, "Specialty (extra cost, sample prices)"), list(restaurants.filter((r) => !r.included).map((r) => `${r.name}: ${ui.fmt(r.price)} pp. ${r.desc}`))),
                h("div", null,
                  h("h3", null, "Entertainment"), list(cls.entertainment),
                  h("h3", null, "Pools"), list(cls.pools),
                  h("h3", null, "Activities"), list(cls.activities),
                  h("h3", null, "Amenities"), list(cls.amenities)))),
            h("section", { class: "section" }, h("h2", null, "Staterooms and fares"),
              h("div", { class: "table-wrap" }, h("table", { class: "data" },
                h("thead", null, h("tr", null, h("th", null, "Category"), h("th", { class: "num" }, "Per person*"), h("th", null, "Status"), h("th", null, "Guarantee"), h("th", null, "Max guests"), h("th", null, "Size (sq ft)"))),
                h("tbody", null, CF.pricing.offered(s).map((cat) => {
                  const f = s.fares[cat], d = CF.DATA.categories[cat];
                  return h("tr", null, h("td", null, h("strong", null, d.name), h("div", { class: "muted small" }, d.desc)), h("td", { class: "num" }, ui.whole(f.pp), f.override ? [" ", ui.badge("override", true)] : null),
                    h("td", null, f.avail ? (f.few ? ui.pill("Few left", "warn") : ui.pill("Available", "good")) : ui.pill("Sold out", "bad")),
                    h("td", null, f.gty ? `Save ${f.gty}%` : "–"), h("td", null, d.maxOcc), h("td", null, d.sqft));
                })))),
              h("p", { class: "muted small" }, `* Advertised-style fare: per person, two sharing, before taxes and fees (${ui.fmt(s.taxPP)} per guest here), gratuities and extras. `, ui.badge(s.source), " ", CF.DATA.rules.noInventory)),
            otherDates.length ? h("section", { class: "section" }, h("h2", null, "Other dates for this cruise"),
              h("div", { class: "table-wrap" }, h("table", { class: "data" },
                h("thead", null, h("tr", null, h("th", null, "Departs"), h("th", { class: "num" }, "Your estimated total"), h("th", { class: "num" }, "Difference"), h("th", null, ""))),
                h("tbody", null, [{ x: s, q }, ...otherDates].sort((a, b) => (a.x.depart < b.x.depart ? -1 : 1)).map(({ x, q: qq }) => h("tr", { class: x.id === s.id ? "current" : "" },
                  h("td", null, date.fmt(x.depart, "dow"), x.id === s.id ? h("span", { class: "muted small" }, " (this one)") : null),
                  h("td", { class: "num" }, ui.whole(qq.totals.total), qq.totals.total === minOther ? [" ", ui.pill("Lowest", "best")] : null),
                  h("td", { class: "num" }, qq.totals.total === q.totals.total ? "–" : CF.money.fmt(qq.totals.total - q.totals.total, { whole: true, sign: true })),
                  h("td", null, x.id === s.id ? null : h("a", { href: `#/cruise/${x.id}` }, "View")))))))) : null),
          h("aside", { class: "detail-side" },
            h("div", { class: "price-box sticky" },
              h("div", { class: "from" }, from ? ["Advertised from ", h("strong", null, ui.whole(from.pp)), " pp"] : "Sold out", h("span", { class: "fine" }, "per person, two sharing, before taxes & fees")),
              h("div", { class: "est-label" }, "Your estimated total ", ui.badge(ui.quoteSource(q), true)),
              h("div", { class: "est-total" }, ui.whole(q.totals.total)),
              h("div", { class: "est-sub" }, `${ui.whole(q.totals.perPerson)} per person · ${ui.whole(q.totals.perNight)} per night`),
              h("p", { class: "small muted" }, CF.configUI.summary(profile)),
              q.substituted ? h("p", { class: "est-warn" }, ui.icon("warn"), q.notices.find((n) => n.key === "substituted").text) : null,
              h("dl", { class: "mini-bd" }, CF.ui.GROUPS.map((g) => { const c = g.buckets.reduce((a, b) => a + q.buckets[b], 0); return c ? [h("dt", null, g.label), h("dd", null, ui.whole(c))] : null; })),
              h("a", { class: "btn primary block", href: `#/configure/${s.id}` }, "Customize this estimate"),
              h("a", { class: "btn ghost block", href: CF.data.line().bookingUrl, target: "_blank", rel: "noopener" }, "Continue to Royal Caribbean ", ui.icon("external")),
              h("p", { class: "fine" }, "Opens Royal Caribbean's official site in a new tab. Search for this ship and date there; prices will differ from these sample estimates.")))));
    },
  };
})();
