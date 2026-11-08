/* Admin dashboard: data sources, manual data import, price overrides, reference rates, currency, usage, errors.
 * This is a static site, so admin changes apply to this browser only and nothing here is secret. API keys for any
 * real data source or AI provider belong on a server (see server/ and the README), never in this page. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, date, money } = CF;
  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "sources", label: "Data sources & API" },
    { id: "sailings", label: "Sailings & prices" },
    { id: "ships", label: "Ships & itineraries" },
    { id: "rates", label: "Pricing rates" },
    { id: "currency", label: "Currency" },
    { id: "logs", label: "Usage & errors" },
  ];
  const RATE_FIELDS = [
    ["gratuityStd", "Gratuities per guest per night (standard)", "money"], ["gratuitySuite", "Gratuities per guest per night (suites)", "money"],
    ["gratuityKids", "Charge gratuities for children", "bool"], ["serviceChargePct", "Service charge on packages (%)", "pct"],
    ["deluxeBase", "Deluxe Beverage base per day (scaled by ship)", "money"], ["internetOne", "Internet, one device, per day", "money"],
    ["internetMulti", "Internet, multi-device, per device per day", "money"], ["udpBase", "Unlimited Dining base per day", "money"],
    ["dining3", "3-night dining package per person", "money"], ["transferEach", "Airport transfer per person, each way", "money"],
    ["insurancePct", "Insurance estimate (% of fare + taxes)", "pct"], ["depositShort", "Deposit per guest, 5 nights or fewer", "money"],
    ["depositLong", "Deposit per guest, 6+ nights", "money"], ["depositSuite", "Deposit per guest, Grand Suite and above", "money"],
    ["finalDaysShort", "Final payment days before sailing (1-4 nights)", "int"], ["finalDaysLong", "Final payment days before sailing (5+ nights)", "int"],
  ];
  const setOv = (fn) => CF.store.update("overrides", {}, fn);

  function editSailing(s, done) {
    const ov = CF.data.overrides();
    const draft = { fares: CF.clone(ov.fares?.[s.id] || {}), tax: ov.taxes?.[s.id] };
    const base = CF.data.byId.get(s.id);
    const body = h("div", null,
      h("p", { class: "muted small" }, `${CF.data.ship(s.shipId).name} · ${CF.data.name(s)} · ${date.fmt(s.depart)}. Source: ${CF.pricing.SOURCE_LABEL[base.source]}. Overrides are labelled "Admin override" everywhere they appear.`),
      h("table", { class: "data compact" }, h("thead", null, h("tr", null, h("th", null, "Category"), h("th", null, "Source fare pp"), h("th", null, "Override pp"), h("th", null, "Available"))),
        h("tbody", null, CF.pricing.offered(base).map((cat) => h("tr", null,
          h("td", null, CF.DATA.categories[cat].name),
          h("td", null, CF.ui.whole(base.fares[cat].pp)),
          h("td", null, CF.ui.moneyInput(draft.fares[cat]?.pp, (v) => { draft.fares[cat] = { ...(draft.fares[cat] || {}), pp: v || null }; }, { "aria-label": `${cat} override fare` })),
          h("td", null, h("input", { type: "checkbox", "aria-label": `${cat} available`, checked: (draft.fares[cat]?.avail ?? base.fares[cat].avail) || undefined, onChange: (e) => { draft.fares[cat] = { ...(draft.fares[cat] || {}), avail: e.target.checked }; } })))))),
      CF.ui.field(`Taxes & fees per guest (source: ${CF.ui.fmt(base.taxPP)})`, CF.ui.moneyInput(draft.tax, (v) => { draft.tax = v || null; })));
    CF.ui.modal({
      title: "Manual price override", body, wide: true,
      actions: [
        { label: "Remove overrides", danger: true, onClick: () => { setOv((o) => { delete o.fares?.[s.id]; delete o.taxes?.[s.id]; delete o.updated?.[s.id]; }); done(); } },
        { label: "Cancel" },
        { label: "Save override", primary: true, onClick: () => {
          const fares = {};
          for (const [cat, v] of Object.entries(draft.fares)) {
            const e = {};
            if (v.pp) e.pp = v.pp;
            if (v.avail != null && v.avail !== base.fares[cat].avail) e.avail = v.avail;
            if (Object.keys(e).length) fares[cat] = e;
          }
          setOv((o) => {
            o.fares ||= {}; o.taxes ||= {}; o.updated ||= {};
            if (Object.keys(fares).length) o.fares[s.id] = fares; else delete o.fares[s.id];
            if (draft.tax) o.taxes[s.id] = draft.tax; else delete o.taxes[s.id];
            if (o.fares[s.id] || o.taxes[s.id]) o.updated[s.id] = Date.now(); else delete o.updated[s.id];
          });
          CF.ui.toast("Override saved.", "good");
          done();
        } },
      ],
    });
  }

  CF.pages.admin = {
    title: "Admin",
    render(ctx) {
      const ui = CF.ui;
      const tab = TABS.some((t) => t.id === ctx.query.tab) ? ctx.query.tab : "overview";
      const ov = CF.data.overrides();
      let body;

      switch (tab) {
        case "overview": {
          const sources = CF.data.sources();
          const ovCount = Object.keys(ov.fares || {}).length + Object.keys(ov.taxes || {}).length;
          body = h("div", null,
            h("div", { class: "spec-grid" },
              ui.stat("Sailings", CF.data.sailings.length.toLocaleString(), `${CF.data.sailings.filter((s) => s.source === "manual").length} imported`),
              ui.stat("Ships", CF.DATA.ships.length, `${Object.keys(CF.DATA.classes).length} classes`),
              ui.stat("Itineraries", Object.keys(CF.DATA.itineraries).length),
              ui.stat("Ports", Object.keys(CF.DATA.ports).length),
              ui.stat("Price overrides", ovCount, `${CF.data.ratesOverridden().length} rate overrides`),
              ui.stat("Data refreshed", date.fmtTime(CF.data.generatedAt), `in ${CF.data.loadMs} ms`)),
            h("div", { class: "toolbar" }, h("button", { class: "btn primary", onClick: () => { CF.data.init(); ui.toast(`Data refreshed: ${CF.data.sailings.length} sailings.`, "good"); ctx.rerender(); } }, "Refresh data now")),
            h("h3", null, "Active sources"),
            h("ul", { class: "plain" }, sources.map((s) => h("li", null, ui.pill(s.status, s.tone), " ", h("strong", null, s.name), s.count != null ? ` · ${s.count} sailings` : ""))));
          break;
        }
        case "sources": {
          const ta = h("textarea", { class: "input mono", rows: 8, placeholder: '{"sailings":[{"shipId":"icon","itId":"wc7-mia","depart":"2027-03-06","fares":{"INT":1249,"BAL":1899},"taxes":180,"sold_out":["RLS"]}]}', "aria-label": "Sailing data JSON" });
          const result = h("div", { "aria-live": "polite" });
          const doImport = (text) => {
            CF.clear(result);
            try {
              const r = CF.data.importManual(JSON.parse(text));
              result.append(h("p", { class: r.count ? "good-text" : "warn-text" }, `${r.count} sailing${r.count === 1 ? "" : "s"} imported.`), r.problems.length ? h("ul", { class: "plain small" }, r.problems.slice(0, 30).map((p) => h("li", { class: "warn-text" }, p))) : null);
            } catch (e) { result.append(h("p", { class: "warn-text" }, "Couldn't read that JSON: " + e.message)); }
          };
          const file = h("input", { type: "file", accept: ".json,application/json", hidden: true, onChange: async (e) => { const f = e.target.files[0]; if (f) doImport(await f.text()); } });
          body = h("div", null,
            h("div", { class: "table-wrap" }, h("table", { class: "data" },
              h("thead", null, h("tr", null, h("th", null, "Priority"), h("th", null, "Source"), h("th", null, "Status"), h("th", null, "Notes"))),
              h("tbody", null, CF.data.sources().map((s) => h("tr", null, h("td", null, s.priority), h("td", null, h("strong", null, s.name)), h("td", null, ui.pill(s.status, s.tone), s.count != null ? h("div", { class: "small muted" }, `${s.count} sailings`) : null, s.updated ? h("div", { class: "small muted" }, date.fmtTime(s.updated)) : null), h("td", { class: "small" }, s.note)))))),
            h("section", { class: "section" }, h("h3", null, "API configuration"),
              h("p", null, "Live integrations must run on a server you control, because providers require secret credentials. The browser should only ever call your server. The included AI proxy (server/ai-proxy.mjs) shows the pattern: the key is read from an environment variable on the server, and the page stores only the proxy's address."),
              h("dl", { class: "pay" }, h("dt", null, "AI assistant engine"), h("dd", null, CF.settings.get("aiEngine") === "ai" ? "AI service" : "Built-in"), h("dt", null, "AI service address"), h("dd", null, CF.settings.get("aiEndpoint") || "Not set"), h("dt", null, "API keys stored in this browser"), h("dd", null, "None (by design)")),
              h("a", { class: "btn ghost sm", href: "#/settings" }, "Edit in Settings")),
            h("section", { class: "section" }, h("h3", null, "Import manually maintained data"),
              h("p", { class: "muted small" }, "Paste or upload JSON. Fares are dollars per person (double occupancy, before taxes), taxes are dollars per person. shipId and itId must match the Ships & itineraries tab. Imported sailings replace sample sailings with the same ship and date, and are labelled \"Imported data\"."),
              ta,
              h("div", { class: "toolbar" },
                h("button", { class: "btn primary", onClick: () => doImport(ta.value) }, "Import pasted JSON"),
                h("button", { class: "btn ghost", onClick: () => file.click() }, "Upload JSON file"), file,
                h("button", { class: "btn ghost", onClick: () => CF.download(`sailings-${date.today()}.json`, JSON.stringify(CF.data.exportSailings(CF.data.all().slice(0, 500)), null, 2), "application/json") }, ui.icon("download"), "Export first 500 sailings"),
                h("button", { class: "btn danger", onClick: async () => { if (await ui.confirm("Remove all imported sailings?", "Remove", true)) { CF.data.clearManual(); ctx.rerender(); } } }, "Clear imported data")),
              result));
          break;
        }
        case "sailings": {
          const q = (ctx.query.q || "").toLowerCase();
          const page = Math.max(0, +ctx.query.p || 0);
          const list = CF.data.all().filter((s) => !q || `${s.id} ${CF.data.ship(s.shipId).name} ${CF.data.name(s)} ${s.port}`.toLowerCase().includes(q));
          const per = 25;
          const rows = list.slice(page * per, page * per + per);
          const overridden = Object.keys({ ...(ov.fares || {}), ...(ov.taxes || {}) });
          const search = h("input", { class: "input", type: "search", value: ctx.query.q || "", placeholder: "Filter by ship, date (2027-03), itinerary or port code", "aria-label": "Filter sailings", onChange: (e) => CF.router.go(`#/admin?tab=sailings&q=${encodeURIComponent(e.target.value)}`) });
          body = h("div", null,
            overridden.length ? h("div", { class: "notice info" }, ui.icon("info"), h("div", null, h("strong", null, `${overridden.length} sailing${overridden.length > 1 ? "s have" : " has"} manual overrides: `), overridden.slice(0, 8).map((id) => h("a", { href: `#/admin?tab=sailings&q=${id}`, class: "tag-link" }, id)))) : null,
            search,
            h("p", { class: "muted small" }, `${list.length.toLocaleString()} sailings`),
            h("div", { class: "table-wrap" }, h("table", { class: "data compact" },
              h("thead", null, h("tr", null, h("th", null, "Sailing"), h("th", null, "Itinerary"), h("th", null, "Source"), h("th", { class: "num" }, "Interior"), h("th", { class: "num" }, "Balcony"), h("th", { class: "num" }, "Taxes pp"), h("th", null, ""))),
              h("tbody", null, rows.map((s) => h("tr", null,
                h("td", null, h("a", { href: `#/cruise/${s.id}` }, CF.data.ship(s.shipId).name), h("div", { class: "muted small" }, date.fmt(s.depart))),
                h("td", { class: "small" }, CF.data.name(s)),
                h("td", null, ui.badge(s.source, true), overridden.includes(s.id) ? [" ", ui.badge("override", true)] : null),
                h("td", { class: "num" }, s.fares.INT ? (s.fares.INT.avail ? ui.whole(s.fares.INT.pp) : "Sold out") : "–"),
                h("td", { class: "num" }, s.fares.BAL ? (s.fares.BAL.avail ? ui.whole(s.fares.BAL.pp) : "Sold out") : "–"),
                h("td", { class: "num" }, ui.fmt(s.taxPP)),
                h("td", null, h("button", { class: "btn ghost sm", onClick: () => editSailing(s, () => ctx.rerender()) }, ui.icon("edit"), "Override"))))))),
            h("div", { class: "toolbar" },
              page > 0 ? h("a", { class: "btn ghost sm", href: `#/admin?tab=sailings&q=${encodeURIComponent(q)}&p=${page - 1}` }, "Previous") : null,
              h("span", { class: "muted small" }, `Page ${page + 1} of ${Math.max(1, Math.ceil(list.length / per))}`),
              (page + 1) * per < list.length ? h("a", { class: "btn ghost sm", href: `#/admin?tab=sailings&q=${encodeURIComponent(q)}&p=${page + 1}` }, "Next") : null));
          break;
        }
        case "ships": {
          body = h("div", null,
            h("h3", null, "Ships"),
            h("div", { class: "table-wrap" }, h("table", { class: "data compact" },
              h("thead", null, h("tr", null, h("th", null, "Ship"), h("th", null, "id"), h("th", null, "Class"), h("th", { class: "num" }, "Year"), h("th", { class: "num" }, "Tonnage"), h("th", { class: "num" }, "Guests"), h("th", { class: "num" }, "Sailings"))),
              h("tbody", null, CF.DATA.ships.map((s) => h("tr", null, h("td", null, s.name), h("td", null, h("code", null, s.id)), h("td", null, CF.DATA.classes[s.cls].name), h("td", { class: "num" }, s.year, s.refurb ? h("div", { class: "muted small" }, `refresh ${s.refurb}`) : null), h("td", { class: "num" }, s.gt.toLocaleString()), h("td", { class: "num" }, s.guests.toLocaleString()), h("td", { class: "num" }, CF.data.sailings.filter((x) => x.shipId === s.id).length)))))),
            h("h3", null, "Itineraries"),
            h("div", { class: "table-wrap" }, h("table", { class: "data compact" },
              h("thead", null, h("tr", null, h("th", null, "id"), h("th", null, "Name"), h("th", null, "Days"), h("th", { class: "num" }, "Taxes pp (base)"))),
              h("tbody", null, Object.values(CF.DATA.itineraries).map((it) => h("tr", null, h("td", null, h("code", null, it.id)), h("td", null, `${it.nights}-Night ${it.label}`), h("td", { class: "small" }, it.days.map((d) => (d === "sea" ? "Sea" : d)).join(" → ")), h("td", { class: "num" }, ui.fmt(it.taxPP))))))),
            h("p", { class: "muted small" }, "Ship facts, itineraries and deployments are edited in js/data/*.js. See the README."));
          break;
        }
        case "rates": {
          const R = CF.data.rates(), D0 = CF.DATA.referenceRates, over = ov.rates || {};
          const setRate = (k, v) => setOv((o) => { o.rates ||= {}; if (v === D0[k] || v == null || v === "") delete o.rates[k]; else o.rates[k] = v; });
          body = h("div", null,
            h("p", { class: "muted" }, `Reference rates (as of ${D0.asOf}) used by the pricing engine. Changing one affects every estimate in this browser and is labelled "Admin override" where it applies.`),
            h("div", { class: "table-wrap" }, h("table", { class: "data compact" },
              h("thead", null, h("tr", null, h("th", null, "Rate"), h("th", null, "Default"), h("th", null, "Current"), h("th", null, ""))),
              h("tbody", null, RATE_FIELDS.map(([k, label, type]) => {
                const control = type === "money" ? ui.moneyInput(R[k], (v) => { setRate(k, v); ctx.rerender(); }, { "aria-label": label, id: "r-" + k })
                  : type === "bool" ? h("input", { type: "checkbox", id: "r-" + k, "aria-label": label, checked: R[k] || undefined, onChange: (e) => { setRate(k, e.target.checked); ctx.rerender(); } })
                  : ui.numberInput(R[k], (v) => { setRate(k, v); ctx.rerender(); }, { min: 0, max: type === "pct" ? 100 : 365, id: "r-" + k, "aria-label": label });
                return h("tr", { class: k in over ? "current" : "" }, h("td", null, label), h("td", { class: "muted" }, type === "money" ? ui.fmt(D0[k]) : String(D0[k])), h("td", null, control),
                  h("td", null, k in over ? h("button", { class: "link-btn", onClick: () => { setRate(k, null); ctx.rerender(); } }, "Reset") : null));
              })))),
            h("button", { class: "btn ghost", onClick: async () => { if (await ui.confirm("Reset all rates to their defaults?", "Reset")) { setOv((o) => { delete o.rates; }); ctx.rerender(); } } }, "Reset all rates"));
          break;
        }
        case "currency": {
          const rates = CF.DATA.currencies.rates;
          body = h("div", null,
            h("p", { class: "muted" }, `Display-only conversion from US dollars (defaults as of ${CF.DATA.currencies.asOf}). Royal Caribbean charges in the booking currency, which may differ.`),
            h("div", { class: "table-wrap" }, h("table", { class: "data compact" },
              h("thead", null, h("tr", null, h("th", null, "Currency"), h("th", null, "Default per USD"), h("th", null, "Current per USD"))),
              h("tbody", null, Object.keys(rates).filter((c) => c !== "USD").map((c) => h("tr", null, h("td", null, c), h("td", { class: "muted" }, rates[c]),
                h("td", null, h("input", { class: "input num", type: "number", step: "0.0001", min: "0", value: CF.data.fxRate(c), "aria-label": `${c} per US dollar`, onChange: (e) => { const v = parseFloat(e.target.value); setOv((o) => { o.fx ||= {}; if (!v || v === rates[c]) delete o.fx[c]; else o.fx[c] = v; }); ctx.rerender(); } }))))))),
            ui.field("Display currency", ui.select(CF.data.currencies().map((c) => ({ id: c, label: c })), CF.settings.currency(), (v) => { CF.settings.set("currency", v); ctx.rerender(); })));
          break;
        }
        case "logs": {
          const usage = CF.store.get("usage", {});
          const errors = CF.store.get("errors", []);
          let bytes = 0;
          try { for (const k of Object.keys(localStorage)) if (k.startsWith("cf.v1.")) bytes += (localStorage.getItem(k) || "").length * 2; } catch (e) {}
          body = h("div", null,
            h("div", { class: "spec-grid" },
              ui.stat("Searches", (usage.searches || 0).toLocaleString()),
              ui.stat("Assistant questions", (usage.assistantQueries || 0).toLocaleString()),
              ui.stat("AI service calls", (usage.aiCalls || 0).toLocaleString(), `${usage.aiErrors || 0} errors`),
              ui.stat("Local storage used", `${(bytes / 1024).toFixed(1)} KB`, CF.store.persistent ? "of about 5 MB" : "storage blocked")),
            h("div", { class: "toolbar" }, h("button", { class: "btn ghost sm", onClick: () => { CF.store.set("usage", {}); ctx.rerender(); } }, "Reset counters")),
            h("h3", null, `Error log (${errors.length})`),
            errors.length ? h("div", null,
              h("button", { class: "btn ghost sm", onClick: () => { CF.store.set("errors", []); ctx.rerender(); } }, "Clear log"),
              h("ul", { class: "plain error-log" }, errors.map((e) => h("li", null, h("div", null, h("strong", null, e.message), h("span", { class: "muted small" }, ` · ${date.fmtTime(e.at)} · ${e.context}`)), e.stack ? h("pre", { class: "small" }, e.stack) : null))))
              : h("p", { class: "muted" }, "No errors recorded."));
          break;
        }
      }
      return h("div", { class: "page wrap admin" },
        h("div", { class: "page-head" }, h("h1", null, ui.icon("lock"), " Admin dashboard"),
          h("p", { class: "notice info" }, ui.icon("info"), h("span", null, "Cruise Finder is a static site with no server, so admin changes apply to this browser only and nothing here is secret. Credentials for live data or AI providers belong on a server (see the README), never in this page."))),
        h("nav", { class: "tabs", "aria-label": "Admin sections" }, TABS.map((t) => h("a", { href: `#/admin?tab=${t.id}`, class: "tab" + (t.id === tab ? " on" : ""), "aria-current": t.id === tab ? "page" : undefined }, t.label))),
        h("div", { class: "card pad" }, body));
    },
  };
})();
