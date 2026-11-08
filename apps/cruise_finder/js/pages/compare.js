/* Compare up to five cruises side by side, all priced with the same travelers and choices unless the user
 * customizes one on purpose. Highlights never use the advertised fare alone. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, date } = CF;

  CF.pages.compare = {
    title: "Compare Cruises",
    render(ctx) {
      const ui = CF.ui;
      ctx.on("compare", () => { if (!ctx.query.share && !ctx.query.saved) ctx.rerender(); });
      ctx.on("profile", () => ctx.rerender());

      // Source of the comparison: a share link, a saved comparison, or the live compare tray.
      let items, profile, external = null;
      if (ctx.query.share) {
        try { const d = CF.b64.dec(ctx.query.share); items = d.items || []; profile = CF.pricing.normalize(d.profile); external = "shared"; }
        catch (e) { ui.toast("That comparison link couldn't be read.", "warn"); }
      } else if (ctx.query.saved) {
        const sv = CF.saved.comparisons().find((c) => c.id === ctx.query.saved);
        if (sv) { items = sv.items; profile = CF.pricing.normalize(sv.profile); external = "saved"; }
      }
      if (!external) { items = CF.compare.items(); profile = CF.profile.get(); }

      const missing = items.filter((it) => !CF.data.get(it.id));
      const entries = items.filter((it) => CF.data.get(it.id)).map((it) => {
        const s = CF.data.get(it.id);
        const cfg = it.config ? CF.pricing.normalize(it.config) : profile;
        return { s, cfg, custom: !!it.config, q: CF.pricing.price(s, cfg) };
      });

      const head = h("div", { class: "page-head" },
        h("h1", null, "Compare cruises"),
        h("p", { class: "muted" }, external === "shared" ? "You're viewing a comparison someone shared with you." : external === "saved" ? "You're viewing a saved comparison." : `Add up to ${CF.compare.MAX} cruises from search results. Each is priced with the same travelers and choices so the totals are a fair, like-for-like comparison.`),
        ui.sampleNotice(true));

      if (!entries.length) {
        return h("div", { class: "page wrap compare" }, head,
          missing.length ? h("p", { class: "notice warn" }, ui.icon("warn"), `${missing.length} cruise${missing.length > 1 ? "s have" : " has"} departed or is no longer in the data.`) : null,
          ui.empty("Nothing to compare yet", "Use the Compare button on any cruise card. Try three 7-night Caribbean sailings on different ships.",
            h("a", { class: "btn primary", href: "#/search", onClick: () => { const c = CF.search.defaults(); c.dest = ["caribbean"]; c.durations = ["7"]; CF.search.set(c); } }, "Find 7-night Caribbean cruises")));
      }

      const totals = entries.map((e) => e.q.totals.total);
      const min = (f) => Math.min(...entries.map(f));
      const best = {
        total: min((e) => e.q.totals.total),
        pp: min((e) => e.q.totals.perPerson),
        night: min((e) => e.q.totals.perNight),
        value: min((e) => CF.pricing.valueScore(e.q, e.s)),
      };
      const tagsFor = (e) => [
        e.q.totals.total === best.total && "Lowest total",
        e.q.totals.perPerson === best.pp && "Lowest per person",
        e.q.totals.perNight === best.night && "Lowest per night",
        CF.pricing.valueScore(e.q, e.s) === best.value && "Best value",
      ].filter(Boolean);
      const shortName = (s) => `${CF.data.ship(s.shipId).name.replace(" of the Seas", "")} · ${date.fmt(s.depart, "short")}`;
      const sameConfig = entries.every((e) => !e.custom);
      const sameGuests = new Set(entries.map((e) => e.q.totals.guests)).size === 1;

      // Highlights
      const highlight = (label, e, value, why) => h("div", { class: "hl-card" }, h("div", { class: "hl-label" }, label), h("div", { class: "hl-name" }, shortName(e.s)), h("div", { class: "hl-value" }, value), h("div", { class: "muted small" }, why));
      const pick = (f, v) => entries.find((e) => f(e) === v);
      const valueE = pick((e) => CF.pricing.valueScore(e.q, e.s), best.value);
      const highlights = h("div", { class: "hl-grid" },
        highlight("Lowest total cost", pick((e) => e.q.totals.total, best.total), ui.whole(best.total), "Everything included in your configuration"),
        highlight("Lowest per person", pick((e) => e.q.totals.perPerson, best.pp), ui.whole(best.pp), "Total ÷ guests"),
        highlight("Lowest per night", pick((e) => e.q.totals.perNight, best.night), ui.whole(best.night), "Total ÷ nights, good for different lengths"),
        highlight("Best value", valueE, `${ui.whole(best.value)} per day`, "Total ÷ (nights + ½ × port visits). Port days count as a bonus; the advertised fare is never used alone."));

      // Chart: estimated totals, cheapest first.
      const chartRows = [...entries].sort((a, b) => a.q.totals.total - b.q.totals.total).map((e) => ({
        label: shortName(e.s), sub: `${e.s.nights} nights · ${CF.data.port(e.s.port).name.split(",")[0]}`, value: e.q.totals.total,
        tip: `${shortName(e.s)}: ${ui.whole(e.q.totals.total)} total, ${e.q.totals.total === best.total ? "lowest" : CF.money.fmt(e.q.totals.total - best.total, { whole: true, sign: true }) + " vs lowest"}`,
        tags: e.q.totals.total === best.total ? ["Lowest"] : [],
      }));

      // Difference table
      const diff = h("div", { class: "table-wrap" }, h("table", { class: "data" },
        h("thead", null, h("tr", null, h("th", null, "Cruise"), h("th", { class: "num" }, "Estimated total"), h("th", { class: "num" }, "Compared with the lowest"))),
        h("tbody", null, [...entries].sort((a, b) => a.q.totals.total - b.q.totals.total).map((e) => h("tr", null,
          h("td", null, h("a", { href: `#/cruise/${e.s.id}` }, shortName(e.s)), h("div", { class: "muted small" }, CF.data.name(e.s))),
          h("td", { class: "num" }, ui.whole(e.q.totals.total)),
          h("td", { class: "num" }, e.q.totals.total === best.total ? ui.pill("Lowest", "best") : h("span", { class: "up" }, `${CF.money.fmt(e.q.totals.total - best.total, { whole: true, sign: true })} more (${Math.round(((e.q.totals.total - best.total) / best.total) * 100)}%)`)))))));

      // Main comparison table
      const money = (c) => (c ? ui.whole(c) : h("span", { class: "muted" }, "–"));
      const row = (label, fn, cls = "") => h("tr", { class: cls }, h("th", { scope: "row" }, label), entries.map((e) => h("td", null, fn(e))));
      const bucket = (k) => (e) => money(e.q.buckets[k]);
      const table = h("div", { class: "table-wrap cmp-wrap" }, h("table", { class: "cmp" },
        h("colgroup", null, h("col", { class: "label-col" }), entries.map(() => h("col", { class: "data-col" }))),
        h("thead", null, h("tr", null, h("th", { class: "corner" }, sameConfig ? "All priced the same way" : "Mixed configurations"),
          entries.map((e) => h("th", { scope: "col" },
            h("div", { class: "cmp-art", html: CF.art.sailing(e.s, { w: 320, h: 160 }) }),
            h("a", { class: "cmp-name", href: `#/cruise/${e.s.id}` }, CF.data.ship(e.s.shipId).name),
            h("div", { class: "muted small" }, CF.data.name(e.s)),
            h("div", { class: "hbar-tags" }, tagsFor(e).map((t) => ui.pill(t, "best"))),
            external ? null : h("button", { class: "icon-btn", "aria-label": `Remove ${CF.data.ship(e.s.shipId).name} from compare`, onClick: () => CF.compare.toggle(e.s.id) }, ui.icon("close")))))),
        h("tbody", null,
          h("tr", { class: "grp" }, h("th", { colspan: entries.length + 1 }, "The cruise")),
          row("Ship class", (e) => CF.data.cls(e.s.shipId).name),
          row("Departure date", (e) => date.fmt(e.s.depart, "dow")),
          row("Destination", (e) => e.s.dest.map((d) => CF.data.dest(d).name).join(", ")),
          row("Duration", (e) => `${e.s.nights} nights`),
          row("Departure port", (e) => CF.data.port(e.s.port).name),
          row("Ports visited", (e) => `${CF.data.portCalls(e.s).length} (${CF.data.seaDays(e.s)} sea days)`),
          row("Stateroom", (e) => h("span", null, e.q.rooms.map((r) => r.catName).join(", "), e.q.substituted ? h("div", { class: "est-warn small" }, ui.icon("warn"), "Requested category unavailable") : null)),
          row("Configuration", (e) => h("div", null, h("span", { class: "pill " + (e.custom ? "warn" : "") }, e.custom ? "Custom" : "Shared"), external ? null : h("div", { class: "cell-actions" },
            h("a", { class: "link", href: `#/configure/${e.s.id}?cmp=1` }, "Customize"),
            e.custom ? h("button", { class: "link-btn", onClick: () => CF.compare.setConfig(e.s.id, null) }, "Use shared") : null))),
          h("tr", { class: "grp" }, h("th", { colspan: entries.length + 1 }, "Required cruise charges")),
          row("Cruise fare", bucket("fare")),
          row("Taxes & fees", bucket("taxes")),
          row("Gratuities", bucket("gratuities")),
          h("tr", { class: "grp" }, h("th", { colspan: entries.length + 1 }, "Optional purchases")),
          row("Beverage packages", bucket("beverage")),
          row("Internet", bucket("internet")),
          row("Specialty dining", bucket("dining")),
          row("Excursions", bucket("excursions")),
          row("Insurance & transfers", (e) => money(e.q.buckets.insurance + e.q.buckets.transfers)),
          row("Spa & onboard", bucket("onboard")),
          h("tr", { class: "grp" }, h("th", { colspan: entries.length + 1 }, "Travel")),
          row("Hotels", bucket("hotel")),
          row("Flights", bucket("flights")),
          row("Transportation", bucket("transport")),
          row("Other travel", bucket("otherTravel")),
          h("tr", { class: "grp" }, h("th", { colspan: entries.length + 1 }, "Totals")),
          row("Estimated vacation total", (e) => h("strong", { class: "cmp-total" + (e.q.totals.total === best.total ? " best" : "") }, ui.whole(e.q.totals.total)), "total-row"),
          row("Per person", (e) => h("span", { class: e.q.totals.perPerson === best.pp ? "best-text" : "" }, ui.whole(e.q.totals.perPerson))),
          row("Per night", (e) => h("span", { class: e.q.totals.perNight === best.night ? "best-text" : "" }, ui.whole(e.q.totals.perNight))),
          row("Vs. lowest total", (e) => (e.q.totals.total === best.total ? ui.pill("Lowest", "best") : h("span", { class: "up" }, CF.money.fmt(e.q.totals.total - best.total, { whole: true, sign: true })))),
          row("Advertised from (pp, fare only)", (e) => { const f = CF.data.fromPrice(e.s); return f ? h("span", { class: "muted" }, ui.whole(f.pp)) : "–"; }),
          row("", (e) => h("a", { class: "btn primary sm", href: `#/configure/${e.s.id}${e.custom && !external ? "?cmp=1" : ""}` }, "Full breakdown")))));

      const fair = h("div", { class: "notice " + (sameConfig ? "good" : "warn") }, ui.icon(sameConfig ? "check" : "warn"),
        h("div", null, sameConfig ? h("span", null, h("strong", null, "Fair comparison: "), `every cruise uses ${CF.configUI.summary(profile)}. `)
          : h("span", null, h("strong", null, "Heads up: "), "some cruises use custom choices, so differences may come from your choices rather than the cruise. "),
          !sameGuests ? h("strong", null, "Guest counts differ between cruises. ") : null,
          external ? null : h("button", { class: "link-btn", onClick: () => CF.router.go("#/settings") }, "Change shared trip preferences")));

      const payload = () => ({ items: entries.map((e) => ({ id: e.s.id, config: e.custom ? e.cfg : null })), profile });
      const toolbar = h("div", { class: "toolbar" },
        external ? h("button", { class: "btn primary", onClick: () => { CF.compare.set(payload().items); ui.toast("This is now your comparison. Custom choices were kept; shared ones use your own trip preferences.", "good"); CF.router.go("#/compare"); } }, "Make this my comparison") : null,
        h("button", { class: "btn " + (external ? "ghost" : "primary"), onClick: async () => { const name = await ui.prompt("Save comparison", "Name", `${entries.length} cruises · ${date.fmt(date.today())}`); if (name) { CF.saved.saveComparison(name, payload().items, profile); ui.toast("Comparison saved.", "good"); } } }, ui.icon("heart"), "Save comparison"),
        h("button", { class: "btn ghost", onClick: () => CF.exporter.comparisonPdf(entries) }, ui.icon("download"), "PDF"),
        h("button", { class: "btn ghost", onClick: () => CF.exporter.comparisonCsv(entries) }, ui.icon("download"), "CSV"),
        h("button", { class: "btn ghost", onClick: () => window.print() }, ui.icon("print"), "Print"),
        h("button", { class: "btn ghost", onClick: () => CF.exporter.copy(CF.exporter.shareUrl("#/compare", payload())) }, ui.icon("share"), "Copy link"),
        external ? null : h("button", { class: "btn ghost", onClick: async () => { if (await ui.confirm("Remove all cruises from the comparison?", "Clear", true)) CF.compare.clear(); } }, ui.icon("trash"), "Clear"));

      return h("div", { class: "page wrap compare" }, head,
        missing.length ? h("p", { class: "notice warn" }, ui.icon("warn"), `${missing.length} cruise${missing.length > 1 ? "s have" : " has"} departed or is no longer in the data and was left out.`) : null,
        toolbar, fair, highlights,
        h("section", { class: "section" }, h("h2", null, "Estimated vacation totals"), ui.hbar(chartRows, { label: "Estimated vacation total per cruise, lowest first" })),
        h("section", { class: "section" }, h("h2", null, "Side by side"), table),
        h("section", { class: "section" }, h("h2", null, "Price difference"), diff),
        !external && entries.length < CF.compare.MAX ? h("p", { class: "muted" }, `You can add ${CF.compare.MAX - entries.length} more. `, h("a", { href: "#/search" }, "Find more cruises")) : null);
    },
  };
})();
