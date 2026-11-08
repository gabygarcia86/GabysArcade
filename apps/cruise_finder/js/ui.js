/* UI building blocks shared by every page. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h, money, date, clear } = CF;

  /* ---------- icons (24px stroke icons) ---------- */
  const ICONS = {
    home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
    compare: "M8 4v16M16 4v16M4 8h8M12 16h8",
    calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
    heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
    chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
    ship: "M3 17l2 4h14l2-4-9-3zM6 14V9h12v5M9 9V6h6v3M12 3v3",
    close: "M6 6l12 12M18 6L6 18",
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    info: "M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
    warn: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    check: "M5 12l5 5L20 7",
    map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    download: "M12 3v12M7 10l5 5 5-5M5 21h14",
    share: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
    print: "M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z",
    trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
    edit: "M4 20h4L20 8l-4-4L4 16zM14 6l4 4",
    external: "M14 4h6v6M10 14L20 4M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6",
    chevron: "M9 6l6 6-6 6",
    down: "M6 9l6 6 6-6",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
    bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4",
    tag: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",
    menu: "M4 6h16M4 12h16M4 18h16",
    lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
    send: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
    anchor: "M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 8v13M5 12H2a10 10 0 0 0 20 0h-3M8 11h8",
  };
  function icon(name, cls = "") {
    const span = h("span", { class: "icon " + cls, "aria-hidden": "true" });
    span.innerHTML = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name] || ICONS.info}"/></svg>`;
    return span;
  }

  /* ---------- feedback ---------- */
  let toastBox;
  function toast(msg, tone = "info", ms = 3800) {
    if (!toastBox) { toastBox = h("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.append(toastBox); }
    const t = h("div", { class: "toast " + tone }, icon(tone === "good" ? "check" : tone === "warn" || tone === "bad" ? "warn" : "info"), h("span", null, msg));
    toastBox.append(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, ms);
  }

  function modal({ title, body, actions = [], wide = false, onClose }) {
    const prevFocus = document.activeElement;
    const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); prevFocus?.focus?.(); onClose?.(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const dialog = h("div", { class: "modal" + (wide ? " wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "modal-head" }, h("h2", null, title), h("button", { class: "icon-btn", "aria-label": "Close", onClick: close }, icon("close"))),
      h("div", { class: "modal-body" }, body),
      actions.length ? h("div", { class: "modal-foot" }, actions.map((a) => h("button", { class: "btn " + (a.primary ? "primary" : a.danger ? "danger" : "ghost"), onClick: async () => { const keep = await a.onClick?.(); if (keep !== true) close(); } }, a.label))) : null);
    const wrap = h("div", { class: "modal-wrap", onClick: (e) => { if (e.target === wrap) close(); } }, dialog);
    document.body.append(wrap);
    document.addEventListener("keydown", onKey);
    setTimeout(() => (dialog.querySelector("input, select, textarea, .btn.primary") || dialog.querySelector("button"))?.focus(), 30);
    return { close, el: dialog };
  }
  function prompt(title, label, value = "") {
    return new Promise((resolve) => {
      const input = h("input", { class: "input", type: "text", value, "aria-label": label, maxlength: 80 });
      let done = false;
      const m = modal({
        title,
        body: h("label", { class: "field" }, h("span", { class: "field-label" }, label), input),
        actions: [{ label: "Cancel", onClick: () => { done = true; resolve(null); } }, { label: "Save", primary: true, onClick: () => { done = true; resolve(input.value.trim() || value); } }],
        onClose: () => { if (!done) resolve(null); },
      });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { done = true; resolve(input.value.trim() || value); m.close(); } });
    });
  }
  function confirm(text, okLabel = "OK", danger = false) {
    return new Promise((resolve) => {
      let done = false;
      modal({
        title: "Please confirm", body: h("p", null, text),
        actions: [{ label: "Cancel", onClick: () => { done = true; resolve(false); } }, { label: okLabel, primary: !danger, danger, onClick: () => { done = true; resolve(true); } }],
        onClose: () => { if (!done) resolve(false); },
      });
    });
  }

  /* ---------- small pieces ---------- */
  const SOURCE_HELP = {
    sample: "Made-up demonstration data. Not a real Royal Caribbean price.",
    reference: "A typical published rate. Royal Caribbean changes these often, so confirm before booking.",
    estimate: "Calculated by this app from a percentage or rule of thumb.",
    user: "An amount you entered.",
    override: "Set by an administrator in this browser.",
    manual: "From data imported by an administrator.",
    live: "Confirmed live price from an authorized source.",
  };
  function badge(source, short) {
    return h("span", { class: "src src-" + source, title: SOURCE_HELP[source] || "", tabindex: "0", "aria-label": `${CF.pricing.SOURCE_LABEL[source] || source}: ${SOURCE_HELP[source] || ""}` }, short ? (CF.pricing.SOURCE_LABEL[source] || source).split(" ")[0] : CF.pricing.SOURCE_LABEL[source] || source);
  }
  function pill(text, tone = "", ic) { return h("span", { class: "pill " + tone }, ic ? icon(ic) : null, text); }
  function sampleNotice(compact) {
    const anySample = CF.data.sailings.some((s) => s.source === "sample");
    if (!anySample) return null;
    return h("div", { class: "notice sample" + (compact ? " compact" : ""), role: "note" }, icon("info"),
      h("div", null, h("strong", null, "Sample data. "), compact ? "Prices and schedules are made up for demonstration."
        : "Schedules, fares and package prices in this app are made up for demonstration and are not live Royal Caribbean availability or pricing. Use the totals to understand what a cruise really costs, then confirm on Royal Caribbean's website."));
  }
  function field(label, control, hint, cls = "") {
    return h("label", { class: "field " + cls }, h("span", { class: "field-label" }, label), control, hint ? h("span", { class: "field-hint" }, hint) : null);
  }
  function select(options, value, onChange, attrs = {}) {
    const el = h("select", { class: "input", ...attrs, onChange: (e) => onChange(e.target.value) },
      options.map((o) => h("option", { value: o.value ?? o.id, disabled: o.disabled, selected: String(o.value ?? o.id) === String(value) }, o.label ?? o.name)));
    return el;
  }
  // Money input in the display currency. Stores USD cents. Empty = 0.
  function moneyInput(cents, onChange, attrs = {}) {
    const cur = CF.settings.currency();
    const sym = new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).formatToParts(0).find((p) => p.type === "currency")?.value || "$";
    const input = h("input", { class: "input", type: "text", inputmode: "decimal", placeholder: "0", value: money.toInput(cents), ...attrs });
    input.addEventListener("change", () => { const c = money.parse(input.value); input.value = money.toInput(c); onChange(c); });
    return h("span", { class: "money-input" }, h("span", { class: "prefix", "aria-hidden": "true" }, sym), input);
  }
  function numberInput(value, onChange, { min = 0, max = 99, step = 1, ...attrs } = {}) {
    return h("input", { class: "input num", type: "number", min, max, step, value, ...attrs, onChange: (e) => onChange(CF.clamp(Math.round(+e.target.value || 0), min, max)) });
  }
  const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  function segmented(options, value, onChange, label) {
    return h("div", { class: "seg", role: "radiogroup", "aria-label": label },
      options.map((o) => h("button", { type: "button", id: label ? `seg-${slug(label)}-${slug(o.id)}` : undefined, class: "seg-btn" + (o.id === value ? " on" : ""), role: "radio", "aria-checked": String(o.id === value), onClick: () => onChange(o.id) }, o.label)));
  }
  function chips(options, values, onChange, label) {
    return h("div", { class: "chips", role: "group", "aria-label": label },
      options.map((o) => {
        const on = values.includes(o.id);
        return h("button", { type: "button", id: label ? `chip-${slug(label)}-${slug(o.id)}` : undefined, class: "chip" + (on ? " on" : ""), "aria-pressed": String(on), onClick: () => onChange(on ? values.filter((v) => v !== o.id) : [...values, o.id]) }, on ? icon("check") : null, o.label);
      }));
  }
  function empty(title, text, action) {
    return h("div", { class: "empty" }, icon("anchor", "big"), h("h3", null, title), text ? h("p", null, text) : null, action || null);
  }
  function stat(label, value, sub, cls = "") {
    return h("div", { class: "stat " + cls }, h("div", { class: "stat-label" }, label), h("div", { class: "stat-value" }, value), sub ? h("div", { class: "stat-sub" }, sub) : null);
  }
  const fmt = (c, o) => money.fmt(c, o);
  const whole = (c) => money.fmt(c, { whole: true });

  /* ---------- favorites & compare buttons ---------- */
  function favButton(id, withLabel = true) {
    const on = CF.saved.isFav(id);
    const b = h("button", { type: "button", class: "btn ghost fav" + (on ? " on" : ""), "aria-pressed": String(on), title: on ? "Remove from saved" : "Save to favorites",
      onClick: (e) => {
        e.stopPropagation();
        const now = CF.saved.toggleFav(id);
        b.classList.toggle("on", now);
        b.setAttribute("aria-pressed", String(now));
        if (withLabel) b.lastChild.textContent = now ? "Saved" : "Save";
        toast(now ? "Saved to My Saved Cruises." : "Removed from saved cruises.", now ? "good" : "info");
      } }, icon("heart"), withLabel ? h("span", null, on ? "Saved" : "Save") : null);
    return b;
  }
  function compareButton(id, withLabel = true) {
    const on = CF.compare.has(id);
    const b = h("button", { type: "button", class: "btn ghost cmp" + (on ? " on" : ""), "aria-pressed": String(on),
      onClick: (e) => {
        e.stopPropagation();
        const now = CF.compare.toggle(id);
        b.classList.toggle("on", CF.compare.has(id));
        b.setAttribute("aria-pressed", String(CF.compare.has(id)));
        if (withLabel) b.lastChild.textContent = CF.compare.has(id) ? "Comparing" : "Compare";
        if (now) toast(`Added to compare (${CF.compare.items().length} of ${CF.compare.MAX}).`, "good");
      } }, icon("compare"), withLabel ? h("span", null, on ? "Comparing" : "Compare") : null);
    return b;
  }

  /* ---------- cruise card ---------- */
  function itinerarySummary(s, max = 6) {
    const stops = CF.data.timeline(s).filter((d) => d.kind !== "sea").map((d) => d.name.split(",")[0].replace("Perfect Day at ", "").replace(" transit", ""));
    const dedup = stops.filter((x, i) => x !== stops[i - 1]);
    return dedup.length > max ? [...dedup.slice(0, max - 1), "…", dedup[dedup.length - 1]].join(" → ") : dedup.join(" → ");
  }
  function cruiseCard(s, q, opts = {}) {
    const ship = CF.data.ship(s.shipId);
    const cls = CF.data.cls(s.shipId);
    const from = CF.data.fromPrice(s);
    const ports = CF.data.uniquePorts(s).length;
    const sea = CF.data.seaDays(s);
    const go = () => CF.router.go(`#/cruise/${s.id}`);
    const cats = CF.pricing.offered(s);
    const room = q.rooms[0];
    return h("article", { class: "card cruise-card" + (opts.compact ? " compact" : "") },
      h("div", { class: "card-media", html: CF.art.sailing(s), onClick: go }),
      h("div", { class: "card-body" },
        h("div", { class: "card-kicker" }, h("span", null, ship.name), h("span", { class: "dot" }), h("span", { class: "muted" }, cls.name),
          s.promo ? pill("Promo", "promo", "tag") : null, s.source !== "sample" ? badge(s.source, true) : null),
        h("h3", { class: "card-title" }, h("a", { href: `#/cruise/${s.id}` }, CF.data.name(s))),
        h("div", { class: "card-meta" },
          h("span", null, icon("calendar"), `${date.fmt(s.depart, "dow")} - ${date.fmt(s.ret, "short")}`),
          h("span", null, icon("anchor"), `From ${CF.data.port(s.port).name.split(",")[0]}`),
          h("span", null, `${s.nights} nights · ${ports} port${ports === 1 ? "" : "s"} · ${sea} sea day${sea === 1 ? "" : "s"}`)),
        opts.compact ? null : h("p", { class: "card-route" }, itinerarySummary(s)),
        opts.compact ? null : h("div", { class: "cat-row", "aria-label": "Stateroom categories" }, cats.map((c) => h("span", { class: "cat" + (s.fares[c].avail ? "" : " out"), title: s.fares[c].avail ? (s.fares[c].few ? "Few left" : "Available") : "Sold out" }, CF.DATA.categories[c].short, s.fares[c].few ? "*" : "")))),
      h("div", { class: "card-price" },
        h("div", { class: "from" }, from ? [h("span", null, "Advertised from "), h("strong", null, whole(from.pp)), h("span", null, " pp")] : "Sold out",
          h("span", { class: "fine" }, "per person, double occupancy, before taxes and fees")),
        h("div", { class: "est-label" }, "Your estimated total ", badge(CF.ui.quoteSource(q), true)),
        h("div", { class: "est-total" }, whole(q.totals.total)),
        h("div", { class: "est-sub" }, `${whole(q.totals.perPerson)} per person · ${whole(q.totals.perNight)} per night`),
        h("div", { class: "est-note" }, `${room ? room.catName : ""} · ${CF.plural(q.totals.guests, "guest")} · incl. taxes, gratuities${q.totals.optional ? " & your extras" : ""}`),
        q.substituted ? h("div", { class: "est-warn" }, icon("warn"), q.notices.find((n) => n.key === "substituted")?.text.replace(/^Stateroom( \d)?: /, "")) : null,
        h("div", { class: "card-actions" },
          h("a", { class: "btn primary", href: `#/configure/${s.id}` }, "Configure pricing"),
          h("a", { class: "btn ghost", href: `#/cruise/${s.id}` }, "View details"),
          compareButton(s.id), favButton(s.id))));
  }

  /* ---------- composition bar (one tall segmented bar) ---------- */
  const GROUPS = [
    { id: "fare", label: "Cruise fare", buckets: ["fare"] },
    { id: "taxes", label: "Taxes & fees", buckets: ["taxes"] },
    { id: "grat", label: "Gratuities", buckets: ["gratuities"] },
    { id: "pkg", label: "Packages", buckets: ["beverage", "internet", "dining"] },
    { id: "extra", label: "Extras", buckets: ["excursions", "insurance", "transfers", "onboard"] },
    { id: "travel", label: "Travel", buckets: ["flights", "hotel", "transport", "otherTravel"] },
  ];
  function composition(q) {
    const total = Math.max(1, q.totals.total);
    const parts = GROUPS.map((g, i) => ({ ...g, slot: i + 1, cents: g.buckets.reduce((a, b) => a + q.buckets[b], 0) })).filter((p) => p.cents > 0);
    const bar = h("div", { class: "comp-bar", role: "img", "aria-label": "Where the money goes: " + parts.map((p) => `${p.label} ${whole(p.cents)} (${Math.round((p.cents / total) * 100)}%)`).join(", ") },
      parts.map((p) => {
        const pct = (p.cents / total) * 100;
        return h("div", { class: `seg-part s${p.slot}`, style: { flexGrow: String(Math.max(pct, 0.5)) }, tabindex: "0", "data-tip": `${p.label}: ${whole(p.cents)} (${Math.round(pct)}%)` }, pct >= 9 ? `${Math.round(pct)}%` : "");
      }));
    const legend = h("ul", { class: "legend" }, parts.map((p) => h("li", null, h("span", { class: `sw s${p.slot}` }), p.label)));
    return h("div", { class: "composition" }, bar, legend);
  }

  /* ---------- full cost breakdown ---------- */
  function breakdown(q, opts = {}) {
    const T = q.totals, P = q.payments;
    const groupBlock = (kind, title, subtotalLabel, subtotal, hint) => {
      const lines = q.lines.filter((l) => l.kind === kind);
      if (!lines.length && kind !== "mandatory") return h("div", { class: "bd-group empty-group" }, h("div", { class: "bd-group-head" }, h("span", null, title), h("span", { class: "muted" }, "None added")));
      return h("div", { class: "bd-group" },
        h("div", { class: "bd-group-head" }, h("span", null, title), hint ? h("span", { class: "muted small" }, hint) : null),
        lines.map((l) => h("details", { class: "bd-line" + (l.discount ? " discount" : ""), open: opts.expand || undefined },
          h("summary", null, h("span", { class: "bd-label" }, l.label, " ", badge(l.source, true)), h("span", { class: "bd-amt" }, fmt(l.cents))),
          h("div", { class: "bd-detail" }, l.detail || "", h("span", { class: "muted" }, ` ${timingLabel(l.timing)}.`)))),
        h("div", { class: "bd-subtotal" }, h("span", null, subtotalLabel), h("span", null, fmt(subtotal))));
    };
    const notices = q.notices.length ? h("ul", { class: "notices" }, q.notices.map((n) => h("li", { class: n.level }, icon(n.level === "info" ? "info" : "warn"), h("span", null, n.text)))) : null;
    return h("section", { class: "breakdown", "aria-label": "Complete vacation cost breakdown" },
      h("div", { class: "bd-hero" },
        h("div", null, h("div", { class: "bd-kicker" }, "Estimated vacation total"), h("div", { class: "bd-total", "aria-live": "polite" }, fmt(T.total, { decimals: 0 })),
          h("div", { class: "bd-hero-sub" }, `${fmt(T.perPerson, { decimals: 0 })} per person · ${fmt(T.perNight, { decimals: 0 })} per night · ${CF.plural(T.guests, "guest")}, ${T.nights} nights`)),
        h("div", { class: "bd-split" },
          stat("Cruise only", whole(T.cruiseOnly), "Fare + taxes + gratuities"),
          stat("Optional extras", whole(T.optional), "Packages, excursions, insurance"),
          stat("Travel", whole(T.travel), "Flights, hotels, transport"))),
      h("div", { class: "bd-status" }, icon("info"), h("span", null, `Prices as of ${date.fmt(q.pricedAt)}. `, q.sample ? h("strong", null, "Sample data, not live. ") : null, "Every line shows where its number comes from."),
        h("span", { class: "bd-sources" }, q.sources.map((s) => badge(s)))),
      composition(q),
      notices,
      h("div", { class: "bd-table" },
        groupBlock("mandatory", "Required cruise charges", "Cruise-only total", T.mandatory, "You pay these on every booking"),
        groupBlock("optional", "Optional purchases", "Optional total", T.optional, "Only what you chose"),
        groupBlock("travel", "Travel to and from the cruise", "Travel total", T.travel, "Your own estimates"),
        h("div", { class: "bd-grand" }, h("span", null, "Estimated total"), h("span", null, fmt(T.total)))),
      h("div", { class: "bd-cols" },
        h("div", { class: "bd-box" }, h("h4", null, "When you pay ", h("span", { class: "muted small" }, "(sample payment terms)")),
          h("dl", { class: "pay" },
            payRow(P.pastFinal ? "Due at booking (full payment, inside the final-payment window)" : `Deposit due at booking (${whole(P.depositPP)} per guest)`, P.deposit),
            P.pastFinal ? null : payRow(`Remaining balance, due by ${date.fmt(P.finalDate)}`, P.dueByFinal),
            payRow("Pre-cruise purchases (packages, excursions)", P.precruise),
            payRow("Charged onboard", P.onboard),
            payRow("Paid separately (travel)", P.separate))),
        h("div", { class: "bd-box" }, h("h4", null, "Included at no extra cost"), h("ul", { class: "ticks" }, q.included.map((t) => h("li", null, icon("check"), t)))),
        h("div", { class: "bd-box warnbox" }, h("h4", null, "Not in this estimate"), q.notIncluded.length ? h("ul", { class: "ticks" }, q.notIncluded.map((t) => h("li", null, icon("minus"), t))) : h("p", { class: "muted" }, "Everything you listed is priced."))));
  }
  const payRow = (label, cents) => [h("dt", null, label), h("dd", null, fmt(cents))];
  const timingLabel = (t) => ({ final: "Paid with your booking", precruise: "Bought before you sail", onboard: "Charged onboard", separate: "Paid separately" }[t] || "");

  /* ---------- horizontal bar chart (single series) ---------- */
  function hbar(rows, opts = {}) {
    const max = Math.max(...rows.map((r) => r.value), 1);
    const wrap = h("div", { class: "hbar", role: "img", "aria-label": opts.label || "Bar chart" });
    for (const r of rows) {
      const pct = (r.value / max) * 100;
      wrap.append(h("div", { class: "hbar-row" },
        h("div", { class: "hbar-label" }, h("div", null, r.label), r.sub ? h("div", { class: "muted small" }, r.sub) : null),
        h("div", { class: "hbar-track" }, h("div", { class: "hbar-bar", style: { width: pct + "%" }, tabindex: "0", "data-tip": r.tip || `${r.label}: ${whole(r.value)}` })),
        h("div", { class: "hbar-value" }, whole(r.value), r.tags?.length ? h("div", { class: "hbar-tags" }, r.tags.map((t) => pill(t, "best"))) : null)));
    }
    return wrap;
  }

  /* ---------- sparkline for price history ---------- */
  function sparkline(points, opts = {}) {
    const W = opts.w || 220, H = opts.h || 56, pad = 6;
    if (points.length < 2) return h("span", { class: "muted small" }, "Not enough history yet");
    const vals = points.map((p) => p.v);
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const xy = points.map((p, i) => [pad + (i * (W - pad * 2)) / (points.length - 1), H - pad - ((p.v - min) / span) * (H - pad * 2)]);
    const d = xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const last = xy[xy.length - 1];
    const el = h("div", { class: "spark", role: "img", "aria-label": opts.label || `Price history from ${whole(vals[0])} to ${whole(vals[vals.length - 1])}` });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="M${pad} ${H - pad}H${W - pad}" class="spark-axis"/><path d="${d}" class="spark-line"/><circle cx="${last[0]}" cy="${last[1]}" r="4" class="spark-dot"/>${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="9" class="spark-hit" tabindex="0" data-tip="${CF.esc(points[i].label + ": " + whole(points[i].v))}"/>`).join("")}</svg>`;
    return el;
  }

  /* ---------- tooltips for [data-tip] (charts) ---------- */
  let tipEl;
  function showTip(target) {
    const text = target.getAttribute("data-tip");
    if (!text) return;
    tipEl ||= document.body.appendChild(h("div", { class: "tip", role: "tooltip" }));
    tipEl.textContent = text;
    tipEl.hidden = false;
    const r = target.getBoundingClientRect();
    const tw = tipEl.offsetWidth;
    tipEl.style.left = CF.clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8) + "px";
    tipEl.style.top = Math.max(8, r.top - tipEl.offsetHeight - 8) + "px";
  }
  const hideTip = () => { if (tipEl) tipEl.hidden = true; };
  document.addEventListener("pointerover", (e) => { const t = e.target.closest?.("[data-tip]"); if (t) showTip(t); else hideTip(); });
  document.addEventListener("focusin", (e) => { const t = e.target.closest?.("[data-tip]"); if (t) showTip(t); });
  document.addEventListener("focusout", hideTip);
  window.addEventListener("scroll", hideTip, { passive: true });

  /* ---------- traveler editor: staterooms and guest ages ---------- */
  const PRESETS = [
    { label: "2 adults", rooms: [[35, 35]] },
    { label: "Solo", rooms: [[35]] },
    { label: "Family of 4", rooms: [[40, 38, 10, 7]] },
    { label: "2 adults + 1 child", rooms: [[38, 36, 8]] },
    { label: "4 adults, 2 rooms", rooms: [[35, 35], [35, 35]] },
  ];
  function travelers(cfg, onChange, opts = {}) {
    const root = h("div", { class: "travelers" });
    const commit = (c) => { onChange(c); draw(c); };
    function draw(c) {
      clear(root);
      if (!opts.noPresets) root.append(h("div", { class: "presets" }, h("span", { class: "muted small" }, "Quick pick:"), PRESETS.map((p) => h("button", { type: "button", class: "chip", onClick: () => {
        const n = CF.clone(c);
        const cat = n.rooms[0]?.category || "BAL";
        n.rooms = p.rooms.map((ages) => CF.pricing.newRoom(cat, ages));
        commit(n);
      } }, p.label))));
      c.rooms.forEach((room, ri) => {
        const max = CF.DATA.categories[room.category]?.maxOcc || 4;
        root.append(h("div", { class: "room-box" },
          h("div", { class: "room-head" }, h("strong", null, `Stateroom ${ri + 1}`),
            opts.showCategory ? select(Object.entries(CF.DATA.categories).map(([id, d]) => ({ id, label: d.name })), room.category, (v) => { const n = CF.clone(c); n.rooms[ri].category = v; commit(n); }, { "aria-label": `Stateroom ${ri + 1} category` }) : null,
            c.rooms.length > 1 ? h("button", { type: "button", class: "icon-btn", "aria-label": `Remove stateroom ${ri + 1}`, onClick: () => { const n = CF.clone(c); n.rooms.splice(ri, 1); commit(n); } }, icon("trash")) : null),
          h("div", { class: "guests" }, room.guests.map((g, gi) => h("div", { class: "guest" },
            h("label", null, h("span", { class: "small muted" }, `Guest ${gi + 1} age`),
              numberInput(g.age, (v) => { const n = CF.clone(c); n.rooms[ri].guests[gi].age = v; commit(n); }, { min: 0, max: 120, id: `${opts.idPrefix || "t"}-r${ri}-g${gi}-age`, "aria-label": `Stateroom ${ri + 1} guest ${gi + 1} age` })),
            h("span", { class: "age-tag" }, g.age < 2 ? "Infant" : g.age < 18 ? "Child" : g.age < 21 ? "Adult under 21" : "Adult"),
            room.guests.length > 1 ? h("button", { type: "button", class: "icon-btn", "aria-label": `Remove guest ${gi + 1}`, onClick: () => { const n = CF.clone(c); n.rooms[ri].guests.splice(gi, 1); commit(n); } }, icon("close")) : null))),
          h("div", { class: "room-foot" },
            h("button", { type: "button", class: "btn ghost sm", disabled: room.guests.length >= Math.max(max, 4) || undefined, onClick: () => { const n = CF.clone(c); n.rooms[ri].guests.push(CF.pricing.newGuest(n.rooms[ri].guests.length >= 2 ? 10 : 35)); commit(n); } }, icon("plus"), "Add guest"),
            h("span", { class: "muted small" }, `Up to ${max} guests in ${CF.DATA.categories[room.category].name}`))));
      });
      if (c.rooms.length < 4) root.append(h("button", { type: "button", class: "btn ghost sm", onClick: () => { const n = CF.clone(c); n.rooms.push(CF.pricing.newRoom(n.rooms[0]?.category || "BAL", [35, 35])); commit(n); } }, icon("plus"), "Add another stateroom"));
      const total = CF.pricing.guestCount(c);
      root.append(h("p", { class: "muted small" }, `${CF.plural(total, "guest")} in ${CF.plural(c.rooms.length, "stateroom")}. Ages matter: guests 3 and 4 in a room pay a lower fare, and only guests 21+ can buy the Deluxe Beverage Package.`));
    }
    draw(cfg);
    return root;
  }
  function travelerSummary(cfg) {
    const all = cfg.rooms.flatMap((r) => r.guests);
    const adults = all.filter((g) => g.age >= 18).length, kids = all.length - adults;
    return `${CF.plural(adults, "adult")}${kids ? `, ${CF.plural(kids, "child", "children")}` : ""} · ${CF.plural(cfg.rooms.length, "stateroom")}`;
  }

  // Headline label for a quote: an Admin override wins, then sample data, then imported data.
  const quoteSource = (q) => (q.sources.includes("override") ? "override" : q.sample ? "sample" : "manual");

  CF.ui = {
    quoteSource,
    icon, toast, modal, prompt, confirm, badge, pill, sampleNotice, field, select, moneyInput, numberInput, segmented, chips, empty, stat,
    favButton, compareButton, cruiseCard, itinerarySummary, composition, breakdown, hbar, sparkline, travelers, travelerSummary, fmt, whole, GROUPS,
  };
})();
