/* App shell, hash router and startup. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, clear } = CF;
  CF.pages = CF.pages || {};

  const NAV = [
    { id: "home", label: "Home", href: "#/", icon: "home" },
    { id: "search", label: "Find Cruises", href: "#/search", icon: "search" },
    { id: "compare", label: "Compare", href: "#/compare", icon: "compare" },
    { id: "dates", label: "Cheapest Dates", href: "#/dates", icon: "calendar" },
    { id: "saved", label: "My Saved", href: "#/saved", icon: "heart" },
    { id: "tracker", label: "Price Tracker", href: "#/tracker", icon: "chart" },
    { id: "settings", label: "Settings", href: "#/settings", icon: "settings" },
  ];
  const ROUTES = [
    [/^#?\/?$/, "home"],
    [/^#\/search$/, "search"],
    [/^#\/cruise\/([\w-]+)$/, "cruise"],
    [/^#\/configure\/([\w-]+)$/, "configure"],
    [/^#\/compare$/, "compare"],
    [/^#\/dates$/, "dates"],
    [/^#\/assistant$/, "assistant"],
    [/^#\/saved$/, "saved"],
    [/^#\/tracker$/, "tracker"],
    [/^#\/settings$/, "settings"],
    [/^#\/admin$/, "admin"],
  ];

  let main, navEl, trayEl, disposers = [];

  const router = {
    current: null,
    go(hash) { if (location.hash === hash) router.render(); else location.hash = hash; },
    parse() {
      const raw = location.hash || "#/";
      const [path, qs] = raw.split("?");
      const query = Object.fromEntries(new URLSearchParams(qs || ""));
      for (const [re, name] of ROUTES) {
        const m = path.match(re);
        if (m) return { name, params: m.slice(1), query, path };
      }
      return { name: "notfound", params: [], query, path };
    },
    async render() {
      disposers.forEach((d) => d());
      disposers = [];
      const route = router.parse();
      router.current = route;
      const page = CF.pages[route.name] || CF.pages.notfound;
      const ctx = {
        ...route,
        on: (ev, fn) => disposers.push(CF.bus.on(ev, fn)),
        rerender: () => router.render(),
        setTitle: (t) => { document.title = t ? `${t} · Cruise Finder` : "Cruise Finder"; },
      };
      ctx.setTitle(page.title);
      for (const a of navEl.querySelectorAll("a[data-nav]")) a.classList.toggle("on", a.dataset.nav === (page.nav || route.name));
      document.body.classList.remove("menu-open", "filters-open");
      try {
        const node = await page.render(ctx);
        clear(main).append(node);
      } catch (e) {
        CF.log.error(e, "render " + route.name);
        clear(main).append(CF.ui.empty("Something went wrong on this page", "The error was saved to the Admin error log. Try going back to the home page.", h("a", { class: "btn primary", href: "#/" }, "Go home")));
      }
      if (!route.query.keepScroll) window.scrollTo({ top: 0 });
      main.focus({ preventScroll: true });
      drawTray();
    },
  };
  CF.router = router;

  CF.pages.notfound = {
    title: "Not found",
    render: () => CF.ui.empty("We couldn't find that page", "The link may be old or the sailing may have departed.", h("a", { class: "btn primary", href: "#/" }, "Back to home")),
  };

  function brandMark() {
    const s = h("span", { class: "brand-mark", "aria-hidden": "true" });
    s.innerHTML = `<svg viewBox="0 0 40 40" width="34" height="34"><circle cx="20" cy="20" r="19" fill="#1f4fd6"/><path d="M8 25l3 6h18l3-6-12-4z" fill="#fff"/><path d="M12 22v-6h16v6M16 16v-4h8v4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linejoin="round"/><path d="M6 32q4-2.5 7 0t7 0 7 0 7 0" stroke="#9fd0ff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
    return s;
  }

  function buildShell() {
    const { icon } = CF.ui;
    navEl = h("nav", { class: "nav", "aria-label": "Main" }, NAV.map((n) => h("a", { href: n.href, "data-nav": n.id }, icon(n.icon), h("span", null, n.label))));
    const header = h("header", { class: "topbar" },
      h("div", { class: "topbar-inner" },
        h("a", { class: "brand", href: "#/" }, brandMark(), h("span", null, h("strong", null, "Cruise Finder"), h("small", null, "Royal Caribbean price planner"))),
        navEl,
        h("button", { class: "icon-btn menu-btn", "aria-label": "Menu", onClick: () => document.body.classList.toggle("menu-open") }, icon("menu"))));
    main = h("main", { id: "main", tabindex: "-1" });
    trayEl = h("div", { class: "tray", hidden: true, "aria-live": "polite" });
    const fab = h("a", { class: "fab", href: "#/assistant", "aria-label": "Ask the AI travel agent" }, icon("sparkle"), h("span", null, "Ask the travel agent"));
    const footer = h("footer", { class: "footer" },
      h("div", { class: "footer-inner" },
        h("p", null, h("strong", null, "Independent planning tool. "), "Not affiliated with, endorsed by or connected to Royal Caribbean International. Royal Caribbean, ship names and Perfect Day at CocoCay are trademarks of their owners. Estimates only: confirm every price, policy and availability on royalcaribbean.com before booking."),
        h("p", { class: "footer-links" },
          h("a", { href: "../../apps.html" }, "← Gaby's Apps"),
          h("a", { href: "#/admin" }, "Admin"),
          h("a", { href: CF.data.line().bookingUrl, target: "_blank", rel: "noopener" }, "Royal Caribbean official site ", icon("external")),
          h("span", { class: "muted" }, `v${CF.version}`))));
    const skip = h("a", { class: "skip", href: "#main", onClick: (e) => { e.preventDefault(); main.focus(); } }, "Skip to content");
    document.body.append(skip, header, main, trayEl, fab, footer);
    if (!CF.store.persistent) CF.ui.toast("This browser is blocking storage, so saved cruises last only until you close the tab.", "warn", 7000);
  }

  function drawTray() {
    const items = CF.compare.items().filter((x) => CF.data.byId.has(x.id));
    const onCompare = router.current?.name === "compare";
    trayEl.hidden = !items.length || onCompare;
    document.body.classList.toggle("has-tray", !trayEl.hidden);
    if (trayEl.hidden) return;
    const { icon } = CF.ui;
    clear(trayEl).append(h("div", { class: "tray-inner" },
      h("span", { class: "tray-title" }, icon("compare"), `Compare ${items.length}/${CF.compare.MAX}`),
      h("div", { class: "tray-items" }, items.map((it) => {
        const s = CF.data.get(it.id);
        return h("span", { class: "tray-chip" }, `${CF.data.ship(s.shipId).name.replace(" of the Seas", "")} · ${CF.date.fmt(s.depart, "short")}`,
          h("button", { class: "icon-btn xs", "aria-label": "Remove from compare", onClick: () => CF.compare.toggle(it.id) }, icon("close")));
      })),
      h("a", { class: "btn primary sm", href: "#/compare" }, "Compare now")));
  }

  function applyTheme() {
    const t = CF.settings.get("theme");
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
  }
  CF.applyTheme = applyTheme;

  // Price alerts can only run while the app is open: there's no server to email or push from.
  function checkAlerts() {
    const hits = [];
    CF.tracker.list().forEach((t) => {
      const s = CF.data.get(t.sailingId);
      if (!s || !t.target) return;
      const q = CF.pricing.price(s, t.config);
      if (q.totals.total <= t.target) hits.push({ t, s, q });
    });
    if (!hits.length) return;
    const msg = hits.length === 1 ? `Price alert: ${CF.data.ship(hits[0].s.shipId).name} on ${CF.date.fmt(hits[0].s.depart)} is at ${CF.ui.whole(hits[0].q.totals.total)}, at or below your ${CF.ui.whole(hits[0].t.target)} target.` : `${hits.length} tracked cruises are at or below your target budget.`;
    CF.ui.toast(msg, "good", 9000);
    if (CF.settings.get("notify") && "Notification" in window && Notification.permission === "granted") {
      try { new Notification("Cruise Finder price alert", { body: msg }); } catch (e) {}
    }
  }

  function start() {
    applyTheme();
    try { CF.data.init(); } catch (e) { CF.log.error(e, "data init"); }
    buildShell();
    CF.bus.on("compare", drawTray);
    window.addEventListener("hashchange", () => router.render());
    // Printing (and the browser's "Save as PDF") should show every line item's details.
    window.addEventListener("beforeprint", () => CF.$$("details.bd-line").forEach((d) => { d.dataset.wasOpen = d.open ? "1" : ""; d.open = true; }));
    window.addEventListener("afterprint", () => CF.$$("details.bd-line").forEach((d) => { d.open = d.dataset.wasOpen === "1"; }));
    window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => router.current && ["compare", "tracker"].includes(router.current.name) && router.render());
    router.render().then(() => document.body.classList.remove("loading"));
    setTimeout(checkAlerts, 800);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
