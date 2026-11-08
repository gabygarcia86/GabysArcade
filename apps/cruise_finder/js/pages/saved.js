/* My Saved Cruises: favorites, wish lists, saved configurations, saved comparisons, recently viewed. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, date } = CF;
  const TABS = [
    { id: "favorites", label: "Favorites" },
    { id: "lists", label: "Wish lists" },
    { id: "configs", label: "Configurations" },
    { id: "comparisons", label: "Comparisons" },
    { id: "recent", label: "Recently viewed" },
  ];

  CF.pages.saved = {
    title: "My Saved Cruises",
    render(ctx) {
      const ui = CF.ui;
      const tab = TABS.some((t) => t.id === ctx.query.tab) ? ctx.query.tab : "favorites";
      ctx.on("favorites", () => tab === "favorites" && ctx.rerender());
      const profile = CF.profile.get();
      const cards = (ids, extra) => {
        const list = ids.map((id) => CF.data.get(id)).filter(Boolean);
        const gone = ids.length - list.length;
        return h("div", null,
          gone ? h("p", { class: "muted small" }, `${CF.plural(gone, "sailing")} departed or left the data and ${gone === 1 ? "is" : "are"} hidden.`) : null,
          h("div", { class: "card-list" }, list.map((s) => h("div", { class: "saved-item" }, ui.cruiseCard(s, CF.pricing.quick(s, profile)), extra ? extra(s) : null))));
      };
      let body;
      switch (tab) {
        case "favorites": {
          const f = CF.saved.favorites();
          body = f.length ? cards(f) : ui.empty("No saved cruises yet", "Tap Save on any cruise to keep it here.", h("a", { class: "btn primary", href: "#/search" }, "Find cruises"));
          break;
        }
        case "lists": {
          const lists = CF.saved.lists();
          body = h("div", null,
            h("button", { class: "btn primary", onClick: async () => { const n = await ui.prompt("New wish list", "List name", "Dream trips"); if (n) { CF.saved.createList(n); ctx.rerender(); } } }, ui.icon("plus"), "New wish list"),
            lists.length ? lists.map((l) => h("section", { class: "section list-section" },
              h("div", { class: "section-head" }, h("h2", null, l.name, h("span", { class: "muted small" }, ` · ${CF.plural(l.items.length, "cruise")}`)),
                h("div", { class: "toolbar" },
                  h("button", { class: "btn ghost sm", onClick: async () => { const n = await ui.prompt("Rename list", "List name", l.name); if (n) { CF.saved.renameList(l.id, n); ctx.rerender(); } } }, ui.icon("edit"), "Rename"),
                  l.items.length ? h("button", { class: "btn ghost sm", onClick: () => { const ids = l.items.filter((id) => CF.data.get(id)).slice(0, CF.compare.MAX); CF.compare.set(ids.map((id) => ({ id, config: null }))); CF.router.go("#/compare"); } }, ui.icon("compare"), "Compare list") : null,
                  h("button", { class: "btn ghost sm", onClick: async () => { if (await ui.confirm(`Delete "${l.name}"?`, "Delete", true)) { CF.saved.deleteList(l.id); ctx.rerender(); } } }, ui.icon("trash"), "Delete"))),
              l.items.length ? cards(l.items, (s) => h("button", { class: "link-btn", onClick: () => { CF.saved.toggleInList(l.id, s.id); ctx.rerender(); } }, "Remove from this list")) : h("p", { class: "muted" }, "Empty. Use \"Wish list\" on a cruise's details page to add it."))) : ui.empty("No wish lists yet", "Group cruises into lists like \"Summer with the kids\" or \"Anniversary ideas\"."));
          break;
        }
        case "configs": {
          const cs = CF.saved.configs();
          body = cs.length ? h("div", { class: "table-wrap" }, h("table", { class: "data" },
            h("thead", null, h("tr", null, h("th", null, "Name"), h("th", null, "Cruise"), h("th", { class: "num" }, "Total when saved"), h("th", { class: "num" }, "Total now"), h("th", null, ""))),
            h("tbody", null, cs.map((c) => {
              const s = CF.data.get(c.sailingId);
              const now = s ? CF.pricing.price(s, c.config).totals.total : null;
              return h("tr", null,
                h("td", null, h("strong", null, c.name), h("div", { class: "muted small" }, `Saved ${date.fmtTime(c.savedAt)}`), h("div", { class: "muted small" }, CF.configUI.summary(CF.pricing.normalize(c.config)))),
                h("td", null, s ? [CF.data.ship(s.shipId).name, h("div", { class: "muted small" }, `${CF.data.name(s)} · ${date.fmt(s.depart)}`)] : h("span", { class: "muted" }, "Departed")),
                h("td", { class: "num" }, ui.whole(c.total || 0)),
                h("td", { class: "num" }, now != null ? [ui.whole(now), now !== c.total ? h("div", { class: "small " + (now > c.total ? "up" : "down") }, CF.money.fmt(now - c.total, { whole: true, sign: true })) : null] : "–"),
                h("td", { class: "row-actions" },
                  s ? h("a", { class: "btn primary sm", href: `#/configure/${s.id}?cfg=${c.id}` }, "Open") : null,
                  s ? h("button", { class: "btn ghost sm", onClick: () => { if (CF.compare.add(s.id, c.config)) ui.toast("Added to compare with this configuration.", "good"); else ui.toast("Compare is full.", "warn"); } }, "Compare") : null,
                  h("button", { class: "btn ghost sm", onClick: async () => { const n = await ui.prompt("Rename", "Name", c.name); if (n) { CF.saved.updateConfig(c.id, { name: n }); ctx.rerender(); } } }, "Rename"),
                  h("button", { class: "icon-btn", "aria-label": `Delete ${c.name}`, onClick: async () => { if (await ui.confirm(`Delete "${c.name}"?`, "Delete", true)) { CF.saved.deleteConfig(c.id); ctx.rerender(); } } }, ui.icon("trash"))));
            })))) : ui.empty("No saved configurations", "On any Configure pricing page, choose Save configuration to keep your exact choices.");
          break;
        }
        case "comparisons": {
          const cs = CF.saved.comparisons();
          body = cs.length ? h("div", { class: "table-wrap" }, h("table", { class: "data" },
            h("thead", null, h("tr", null, h("th", null, "Name"), h("th", null, "Cruises"), h("th", null, "Saved"), h("th", null, ""))),
            h("tbody", null, cs.map((c) => h("tr", null,
              h("td", null, h("strong", null, c.name)),
              h("td", null, c.items.map((it) => { const s = CF.data.get(it.id); return h("div", { class: "small" }, s ? `${CF.data.ship(s.shipId).name} · ${date.fmt(s.depart, "short")}${it.config ? " (custom)" : ""}` : "Departed sailing"); })),
              h("td", null, date.fmtTime(c.savedAt)),
              h("td", { class: "row-actions" },
                h("a", { class: "btn primary sm", href: `#/compare?saved=${c.id}` }, "Open"),
                h("button", { class: "icon-btn", "aria-label": `Delete ${c.name}`, onClick: async () => { if (await ui.confirm(`Delete "${c.name}"?`, "Delete", true)) { CF.saved.deleteComparison(c.id); ctx.rerender(); } } }, ui.icon("trash")))))))) : ui.empty("No saved comparisons", "On the Compare page, choose Save comparison.");
          break;
        }
        case "recent": {
          const r = CF.saved.recent();
          body = r.length ? cards(r) : ui.empty("Nothing viewed yet", "Cruises you open appear here.");
          break;
        }
      }
      return h("div", { class: "page wrap saved" },
        h("div", { class: "page-head" }, h("h1", null, "My saved cruises"),
          h("p", { class: "muted" }, "Everything is stored in this browser (guest mode, no account). Use Settings > Your data to move it to another device.")),
        h("nav", { class: "tabs", "aria-label": "Saved sections" }, TABS.map((t) => h("a", { href: `#/saved?tab=${t.id}`, class: "tab" + (t.id === tab ? " on" : ""), "aria-current": t.id === tab ? "page" : undefined }, t.label))),
        body);
    },
  };
})();
