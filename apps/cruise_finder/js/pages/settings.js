/* Settings: display, trip preferences (the shared configuration), AI assistant, notifications, your data. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h } = CF;

  CF.pages.settings = {
    title: "Settings",
    render(ctx) {
      const ui = CF.ui;
      const st = CF.settings.all();
      const set = (k, v, rerender = true) => { CF.settings.set(k, v); if (k === "theme") CF.applyTheme(); if (rerender) ctx.rerender(); };

      // Trip preferences editor (profile mode)
      const prefsEl = h("div");
      let profile = CF.profile.get();
      const onProfile = (n) => {
        profile = CF.pricing.normalize(n);
        CF.store.set("profile", profile);
        CF.configUI.rerenderKeepFocus(prefsEl, () => CF.configUI.steps(profile, null, onProfile));
        summaryEl.textContent = CF.configUI.summary(profile);
      };
      prefsEl.append(CF.configUI.steps(profile, null, onProfile));
      const summaryEl = h("p", { class: "prefs-summary" }, CF.configUI.summary(profile));

      const aiUrl = h("input", { class: "input", type: "url", id: "s-ai-url", value: st.aiEndpoint, placeholder: "http://localhost:8788", onChange: (e) => set("aiEndpoint", e.target.value.trim(), false) });
      const aiStatus = h("span", { class: "small muted" });
      const testAI = async () => {
        const url = aiUrl.value.trim().replace(/\/+$/, "");
        if (!url) { aiStatus.textContent = "Enter the proxy's address first."; return; }
        aiStatus.textContent = "Testing…";
        try {
          const r = await fetch(url + "/health");
          const d = await r.json();
          aiStatus.textContent = d.ok ? `Connected: ${d.provider} ${d.model}.` : `The proxy answered but isn't ready: ${d.error || "unknown"}`;
        } catch (e) { aiStatus.textContent = "Couldn't reach it. Is the proxy running, and does it allow this site's address?"; }
      };

      const fileIn = h("input", { type: "file", accept: "application/json,.json", hidden: true, onChange: async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const data = JSON.parse(await f.text());
          if (data.app !== "cruise-finder" || typeof data.data !== "object") throw new Error("Not a Cruise Finder backup.");
          if (!(await ui.confirm("Replace this browser's saved cruises, lists, configurations and settings with the backup?", "Import"))) return;
          CF.store.importAll(data.data);
          CF.data.init();
          ui.toast("Backup imported.", "good");
          ctx.rerender();
        } catch (err) { ui.toast("That file couldn't be imported: " + err.message, "bad"); }
      } });

      return h("div", { class: "page wrap settings" },
        h("div", { class: "page-head" }, h("h1", null, "Settings")),
        h("section", { class: "card pad section" }, h("h2", null, "Display"),
          h("div", { class: "grid-2" },
            ui.field("Currency", ui.select(CF.data.currencies().map((c) => ({ id: c, label: c })), st.currency, (v) => set("currency", v), { id: "s-cur" }),
              st.currency === "USD" ? "Prices are stored in US dollars." : `Converted from US dollars at an approximate rate of ${CF.data.fxRate(st.currency)} (as of ${CF.DATA.currencies.asOf}). Royal Caribbean may charge in a different currency.`),
            ui.field("Theme", ui.segmented([{ id: "auto", label: "Match device" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }], st.theme, (v) => set("theme", v), "Theme")))),
        h("section", { class: "card pad section", id: "home-ports" }, h("h2", null, "Default departure ports"),
          h("p", { class: "muted" }, "New searches, the home page and Cheapest Dates start with these ports selected. You can still pick any port in a search."),
          h("p", { class: "prefs-summary" }, `Currently: ${CF.settings.homePortsLabel()}`),
          ui.chips(CF.data.departurePorts().map((p) => ({ id: p.id, label: p.name })), CF.settings.homePorts(), (v) => { CF.settings.setHomePorts(v); ctx.rerender(); }, "Default departure ports"),
          h("div", { class: "toolbar" },
            h("button", { class: "btn ghost sm", onClick: () => { CF.settings.setHomePorts([...CF.settings.DEFAULT_HOME_PORTS]); ui.toast("Default set to Miami, Fort Lauderdale and Port Canaveral (Orlando).", "good"); ctx.rerender(); } }, "Miami, Fort Lauderdale & Orlando"),
            h("button", { class: "btn ghost sm", onClick: () => { CF.settings.setHomePorts([...CF.settings.FLORIDA_PORTS]); ui.toast("Default set to Florida ports.", "good"); ctx.rerender(); } }, "All Florida ports"),
            h("button", { class: "btn ghost sm", onClick: () => { CF.settings.setHomePorts([]); ui.toast("No default port: searches start with any port.", "good"); ctx.rerender(); } }, "Any port (no default)"))),
        h("section", { class: "card pad section", id: "prefs" },
          h("div", { class: "section-head" }, h("h2", null, "Trip preferences"),
            h("button", { class: "btn ghost sm", onClick: async () => { if (await ui.confirm("Reset trip preferences to 2 adults in a balcony with no extras?", "Reset")) { CF.profile.reset(); ctx.rerender(); } } }, "Reset")),
          h("p", { class: "muted" }, "These travelers and choices price every cruise in search, cheapest dates, the assistant and comparisons, so totals are like-for-like. You can still customize any single cruise."),
          summaryEl, prefsEl),
        h("section", { class: "card pad section" }, h("h2", null, "AI travel assistant"),
          ui.segmented([{ id: "builtin", label: "Built-in (offline)" }, { id: "ai", label: "AI service" }], st.aiEngine, (v) => set("aiEngine", v), "Assistant engine"),
          h("p", { class: "muted small" }, "Built-in understands common questions with no setup. AI service sends your question (never your saved data) to a proxy you run, which uses Claude to understand it. Either way, prices and sailings come only from this app's data."),
          ui.field("AI service address", aiUrl, "The proxy in server/ai-proxy.mjs. Its API key stays on that server; never paste an API key here."),
          h("div", { class: "toolbar" }, h("button", { class: "btn ghost sm", onClick: testAI }, "Test connection"), aiStatus)),
        h("section", { class: "card pad section" }, h("h2", null, "Price alerts"),
          h("label", { class: "check" }, h("input", { type: "checkbox", id: "s-notify", checked: st.notify || undefined, onChange: async (e) => {
            if (e.target.checked && "Notification" in window) { const p = await Notification.requestPermission(); set("notify", p === "granted", false); if (p !== "granted") { e.target.checked = false; ui.toast("Notifications weren't allowed by the browser.", "warn"); } }
            else set("notify", e.target.checked, false);
          } }), "Show a browser notification when a tracked cruise drops to my target"),
          h("p", { class: "muted small" }, "Alerts can only run while Cruise Finder is open; there's no server to send emails or push messages.")),
        h("section", { class: "card pad section" }, h("h2", null, "Your data"),
          h("p", { class: "muted" }, CF.store.persistent ? "Saved cruises, lists, configurations, comparisons, trackers and settings live in this browser only. Export a backup to move them to another device." : "This browser is blocking storage, so nothing is kept after you close the tab. Export a backup to keep your work."),
          h("div", { class: "toolbar" },
            h("button", { class: "btn ghost", onClick: () => CF.download(`cruise-finder-backup-${CF.date.today()}.json`, JSON.stringify({ app: "cruise-finder", version: CF.version, exported: new Date().toISOString(), data: CF.store.exportAll() }, null, 2), "application/json") }, ui.icon("download"), "Export backup"),
            h("button", { class: "btn ghost", onClick: () => fileIn.click() }, "Import backup"), fileIn,
            h("button", { class: "btn danger", onClick: async () => { if (await ui.confirm("Delete everything Cruise Finder saved in this browser? This can't be undone.", "Delete everything", true)) { CF.store.clearAll(); CF.data.init(); ui.toast("All local data deleted."); CF.router.go("#/"); } } }, ui.icon("trash"), "Delete all my data"))),
        h("section", { class: "card pad section" }, h("h2", null, "About the data"),
          h("p", null, "Royal Caribbean doesn't offer a public API for fares or stateroom inventory, and this app doesn't scrape its website. It runs on built-in sample data, plus anything an administrator imports or overrides. Every price is labelled with its source."),
          h("p", null, h("a", { href: "#/admin" }, "Open the Admin dashboard"), " to see data sources, import data or adjust reference rates.")));
    },
  };
})();
