/* AI Travel Assistant chat. Conversation is kept for the session only. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h } = CF;
  const EXAMPLES = [
    "Find me a 7-night Caribbean cruise departing from Florida",
    "Find the cheapest cruise during summer",
    "What is the cheapest ship for a family of four?",
    "Compare Icon of the Seas and Wonder of the Seas",
    "Find cruises with the most stops",
    "Which cruises visit Perfect Day at CocoCay?",
    "Find a cruise with the best overall value",
    "Show me cruises under $4,000 total",
    "Is it cheaper to cruise in May or August?",
    "Alaska in July with a balcony for 2 adults and 2 kids",
  ];
  const history = []; // session only

  CF.pages.assistant = {
    title: "AI Travel Assistant",
    render() {
      const ui = CF.ui;
      const log = h("div", { class: "chat-log", role: "log", "aria-live": "polite" });
      const input = h("textarea", { class: "input chat-input", rows: 2, placeholder: "Ask about destinations, dates, budgets, ships…", "aria-label": "Your question", maxlength: 1000 });
      const sendBtn = h("button", { class: "btn primary", type: "submit" }, ui.icon("send"), "Ask");
      const engine = CF.settings.get("aiEngine") === "ai" && CF.settings.get("aiEndpoint") ? "AI service" : "Built-in";

      const bubble = (who, ...kids) => h("div", { class: "msg " + who }, h("div", { class: "msg-who" }, who === "me" ? "You" : "Travel agent"), h("div", { class: "msg-body" }, kids));
      function renderAnswer(a) {
        const profile = a.cfg || CF.profile.get();
        const cards = a.cards.map((id) => CF.data.get(id)).filter(Boolean);
        return bubble("agent",
          a.note ? h("p", { class: "small warn-text" }, ui.icon("warn"), " ", a.note) : null,
          a.text.map((t) => h("p", null, t)),
          a.table ? h("div", { class: "table-wrap" }, h("table", { class: "data compact" }, h("tbody", null, a.table.map((r) => h("tr", null, r.map((c) => h("td", null, c))))))) : null,
          cards.length ? h("div", { class: "chat-cards" }, cards.map((s) => ui.cruiseCard(s, CF.pricing.quick(s, profile), { compact: true }))) : null,
          (a.foot || []).map((t) => h("p", { class: "small muted" }, t)),
          h("div", { class: "msg-actions" },
            cards.length ? h("button", { class: "btn ghost sm", onClick: () => {
              let added = 0;
              const room = CF.compare.MAX - CF.compare.items().length;
              for (const s of cards) { if (CF.compare.has(s.id)) continue; if (added >= room) break; CF.compare.add(s.id, a.cfg); added++; }
              ui.toast(added ? `Added ${added} to compare${a.cfg ? " with the travelers you described" : ""}.` : "Those are already in compare, or compare is full.", added ? "good" : "info");
              if (added && a.compareIds?.length) CF.router.go("#/compare");
            } }, ui.icon("compare"), a.compareIds?.length ? "Compare these" : "Add to compare") : null,
            a.cfg ? h("button", { class: "btn ghost sm", onClick: () => { CF.profile.set(CF.pricing.normalize(a.cfg)); ui.toast("Saved as your trip preferences.", "good"); } }, "Use these travelers everywhere") : null,
            a.rows?.length > cards.length ? h("button", { class: "btn ghost sm", onClick: () => {
              const c = { ...CF.search.defaults(), dest: a.plan.destinations, ports: a.plan.departure_ports, ships: a.plan.intent === "compare_ships" ? [] : a.plan.ships, classes: a.plan.ship_classes };
              if (a.plan.months?.length) { c.dateMode = "month"; c.months = a.plan.months; }
              if (a.plan.max_total) c.maxTotal = a.plan.max_total * 100;
              CF.search.set(c);
              CF.router.go("#/search");
            } }, `See all ${a.rows.length} in search`) : null),
          h("p", { class: "msg-meta" }, `Answered with the ${a.via} engine from the app's own data. Understood as: ${CF.assistant.describePlan(a.plan)}.`));
      }
      function draw() {
        CF.clear(log);
        if (!history.length) log.append(bubble("agent", h("p", null, "Hi! I'm your cruise travel agent. Tell me where, when, who's going and your budget, and I'll find sailings and price the whole vacation, not just the fare."), h("p", { class: "muted small" }, "I only answer from the cruise data in this app. If something isn't in the data, I'll say so instead of guessing.")));
        history.forEach((m) => log.append(m.who === "me" ? bubble("me", h("p", null, m.text)) : renderAnswer(m.a)));
        log.scrollTop = log.scrollHeight;
      }
      async function send(text) {
        text = (text || "").trim();
        if (!text) return;
        history.push({ who: "me", text });
        input.value = "";
        draw();
        const thinking = bubble("agent", h("p", { class: "muted" }, "Searching sailings and pricing them…"));
        log.append(thinking);
        sendBtn.disabled = true;
        try {
          const a = await CF.assistant.ask(text);
          history.push({ who: "agent", a });
        } catch (e) {
          CF.log.error(e, "assistant");
          history.push({ who: "agent", a: { text: ["Sorry, something went wrong answering that. Try rephrasing."], cards: [], plan: CF.assistant.parse(""), via: "built-in" } });
        }
        sendBtn.disabled = false;
        draw();
        input.focus();
      }
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input.value); } });
      draw();
      return h("div", { class: "page wrap assistant" },
        h("div", { class: "page-head" }, h("h1", null, ui.icon("sparkle"), " AI travel agent"),
          h("p", { class: "muted" }, `Engine: ${engine}. `, h("a", { href: "#/settings" }, "Change in Settings"), ". Answers come from the app's own sailings and pricing engine, never from the AI's memory."),
          ui.sampleNotice(true)),
        h("div", { class: "examples" }, EXAMPLES.map((e) => h("button", { class: "chip", onClick: () => send(e) }, e))),
        log,
        h("form", { class: "chat-form", onSubmit: (e) => { e.preventDefault(); send(input.value); } }, input, sendBtn),
        history.length ? h("button", { class: "link-btn", onClick: () => { history.length = 0; draw(); } }, "Clear conversation") : null);
    },
  };
})();
