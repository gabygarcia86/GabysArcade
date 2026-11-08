/* Exports: a small built-in PDF writer (no libraries), CSV downloads and shareable links. */
(function () {
  "use strict";
  const CF = window.CF;
  const { money, date } = CF;

  /* ---------- minimal PDF writer: Helvetica text, rules, filled boxes, multiple pages ---------- */
  // Helvetica glyph widths (1/1000 em) for ASCII 32..126, used to right-align numbers.
  const HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const ascii = (s) => String(s ?? "").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/→/g, "->").replace(/×/g, "x").replace(/·/g, "-").replace(/°/g, " deg").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "");
  const textWidth = (s, size, bold) => ascii(s).split("").reduce((a, c) => a + (HW[c.charCodeAt(0) - 32] || 556), 0) * size / 1000 * (bold ? 1.06 : 1);
  const pdfStr = (s) => "(" + ascii(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ")";

  function PDF() {
    const W = 612, H = 792, M = 48; // US Letter, points
    const pages = [];
    let ops = null, y = 0;
    const doc = {
      W, H, M,
      newPage() { ops = []; pages.push(ops); y = H - M; return doc; },
      get y() { return y; },
      set y(v) { y = v; },
      ensure(space) { if (y - space < M) doc.newPage(); return doc; },
      text(s, x, yy, { size = 10, bold = false, color = [0.1, 0.12, 0.18], align = "left" } = {}) {
        let tx = x;
        if (align === "right") tx = x - textWidth(s, size, bold);
        if (align === "center") tx = x - textWidth(s, size, bold) / 2;
        ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${color.join(" ")} rg ${tx.toFixed(2)} ${yy.toFixed(2)} Td ${pdfStr(s)} Tj ET`);
        return doc;
      },
      // Wrapped paragraph at the cursor; advances y.
      para(s, { size = 10, bold = false, color, width = W - 2 * M, x = M, leading = 1.35 } = {}) {
        const words = ascii(s).split(/\s+/);
        let line = "";
        const flush = () => { doc.ensure(size * leading); doc.text(line, x, y - size, { size, bold, color }); y -= size * leading; line = ""; };
        for (const w of words) {
          const test = line ? line + " " + w : w;
          if (textWidth(test, size, bold) > width && line) flush();
          line = line ? line + " " + w : w;
        }
        if (line) flush();
        return doc;
      },
      rule(yy = y, color = [0.85, 0.88, 0.93], x1 = M, x2 = W - M, w = 0.8) { ops.push(`${color.join(" ")} RG ${w} w ${x1} ${yy.toFixed(2)} m ${x2} ${yy.toFixed(2)} l S`); return doc; },
      box(x, yy, w, hgt, color) { ops.push(`${color.join(" ")} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${hgt.toFixed(2)} re f`); return doc; },
      // Two-column row: label left, amount right.
      row(label, amount, { size = 10, bold = false, color, indent = 0, rule = false } = {}) {
        doc.ensure(size + 6);
        doc.text(label, M + indent, y - size, { size, bold, color });
        if (amount != null) doc.text(amount, W - M, y - size, { size, bold, color, align: "right" });
        y -= size + 6;
        if (rule) doc.rule(y + 2);
        return doc;
      },
      gap(n = 8) { y -= n; return doc; },
      // Table with fixed column widths. cols: [{label, width, align}]
      table(cols, rows, { size = 8.5, header = true } = {}) {
        const rowH = size + 7;
        const drawHeader = () => {
          doc.box(M, y - rowH, W - 2 * M, rowH, [0.93, 0.95, 0.99]);
          let x = M;
          cols.forEach((c) => { doc.text(c.label, c.align === "right" ? x + c.width - 4 : x + 4, y - size - 2, { size, bold: true, align: c.align === "right" ? "right" : "left" }); x += c.width; });
          y -= rowH;
        };
        if (header) { doc.ensure(rowH * 2); drawHeader(); }
        rows.forEach((r) => {
          if (y - rowH < M) { doc.newPage(); if (header) drawHeader(); }
          let x = M;
          cols.forEach((c, i) => {
            let v = String(r.cells[i] ?? "");
            while (v.length > 3 && textWidth(v, size, r.bold) > c.width - 8) v = v.slice(0, -2);
            if (v !== String(r.cells[i] ?? "")) v = v.slice(0, -1) + "...";
            doc.text(v, c.align === "right" ? x + c.width - 4 : x + 4, y - size - 2, { size, bold: r.bold, align: c.align === "right" ? "right" : "left", color: r.color });
            x += c.width;
          });
          y -= rowH;
          doc.rule(y, [0.92, 0.93, 0.96], M, W - M, 0.5);
        });
        return doc;
      },
      footer(text) {
        pages.forEach((p, i) => {
          const saved = ops; ops = p;
          doc.text(`${text}   Page ${i + 1} of ${pages.length}`, W / 2, 24, { size: 7.5, color: [0.45, 0.5, 0.58], align: "center" });
          ops = saved;
        });
        return doc;
      },
      blob() {
        const objs = [];
        const add = (s) => { objs.push(s); return objs.length; };
        const font1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
        const font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
        const pagesId = objs.length + 1 + pages.length * 2;
        const kids = [];
        for (const p of pages) {
          const content = p.join("\n");
          const cId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
          kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${cId} 0 R >>`));
        }
        add(`<< /Type /Pages /Kids [${kids.map((k) => k + " 0 R").join(" ")}] /Count ${kids.length} >>`);
        const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
        let out = "%PDF-1.4\n";
        const offsets = [];
        objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
        const xref = out.length;
        out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
        out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
        return new Blob([out], { type: "application/pdf" });
      },
    };
    return doc.newPage();
  }

  const NAVY = [0.04, 0.12, 0.25], MUTED = [0.4, 0.45, 0.55], WARN = [0.6, 0.35, 0];
  // ASCII-safe amounts for the PDF: "$1,234.00" in USD, "EUR 1,234.00" otherwise.
  const usd = (c) => {
    const cur = CF.settings.currency();
    const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((c / 100) * (cur === "USD" ? 1 : CF.data.fxRate(cur)));
    return cur === "USD" ? (n.startsWith("-") ? "-$" + n.slice(1) : "$" + n) : `${cur} ${n}`;
  };
  const curNote = () => CF.settings.currency() !== "USD" ? ` Amounts converted from USD at approximate rates (${CF.settings.currency()}).` : "";

  function header(doc, title, subtitle) {
    doc.box(0, doc.H - 70, doc.W, 70, NAVY);
    doc.text("Cruise Finder", doc.M, doc.H - 32, { size: 18, bold: true, color: [1, 1, 1] });
    doc.text(title, doc.M, doc.H - 52, { size: 11, color: [0.75, 0.84, 1] });
    doc.text(`Created ${date.fmtTime(Date.now())}`, doc.W - doc.M, doc.H - 32, { size: 8.5, color: [0.75, 0.84, 1], align: "right" });
    doc.y = doc.H - 92;
    if (subtitle) doc.para(subtitle, { size: 9, color: MUTED });
  }
  function disclaimer(doc, sample) {
    doc.gap(10);
    if (sample) doc.para("SAMPLE DATA: the schedules, fares and package prices in this document are made up for demonstration. They are not live Royal Caribbean availability or pricing.", { size: 9, bold: true, color: WARN });
    doc.para("Estimates only. Independent planning tool, not affiliated with Royal Caribbean International. Confirm every price, policy and availability with Royal Caribbean or an authorized travel advisor before booking." + curNote(), { size: 8, color: MUTED });
  }

  function writeQuote(doc, s, q) {
    const ship = CF.data.ship(s.shipId);
    doc.para(CF.data.name(s), { size: 14, bold: true });
    doc.para(`${ship.name} (${CF.data.cls(s.shipId).name}) - ${date.fmt(s.depart, "long")} to ${date.fmt(s.ret)} - from ${CF.data.port(s.port).name}`, { size: 9.5, color: MUTED });
    doc.para(`Route: ${CF.ui.itinerarySummary(s, 12)}`, { size: 9, color: MUTED });
    doc.para(`Travelers: ${CF.ui.travelerSummary(q.config)} - Staterooms: ${q.rooms.map((r) => r.catName).join(", ")}`, { size: 9, color: MUTED });
    doc.gap(6);
    doc.row("Estimated vacation total", usd(q.totals.total), { size: 14, bold: true, color: NAVY });
    doc.row(`Per person (${q.totals.guests})`, usd(q.totals.perPerson), { color: MUTED });
    doc.row(`Per night (${q.totals.nights})`, usd(q.totals.perNight), { color: MUTED, rule: true });
    doc.gap(4);
    const group = (kind, title, sub, total) => {
      const lines = q.lines.filter((l) => l.kind === kind);
      doc.row(title, null, { bold: true, size: 10.5 });
      if (!lines.length) doc.row("None added", null, { indent: 10, color: MUTED, size: 9 });
      lines.forEach((l) => {
        doc.row(`${l.label}  [${CF.pricing.SOURCE_LABEL[l.source]}]`, usd(l.cents), { indent: 10, size: 9 });
        if (l.detail) doc.para(l.detail, { size: 7.5, color: MUTED, x: doc.M + 20, width: doc.W - 2 * doc.M - 100 });
      });
      doc.row(sub, usd(total), { bold: true, size: 9.5, rule: true });
      doc.gap(4);
    };
    group("mandatory", "Required cruise charges", "Cruise-only total", q.totals.mandatory);
    group("optional", "Optional purchases", "Optional total", q.totals.optional);
    group("travel", "Travel to and from the cruise", "Travel total", q.totals.travel);
    doc.row("ESTIMATED TOTAL", usd(q.totals.total), { size: 12, bold: true, color: NAVY, rule: true });
    doc.gap(6);
    const P = q.payments;
    doc.row("When you pay (sample payment terms)", null, { bold: true });
    doc.row(P.pastFinal ? "Due at booking (full payment)" : "Deposit due at booking", usd(P.deposit), { indent: 10, size: 9 });
    if (!P.pastFinal) doc.row(`Remaining balance due by ${date.fmt(P.finalDate)}`, usd(P.dueByFinal), { indent: 10, size: 9 });
    doc.row("Pre-cruise purchases", usd(P.precruise), { indent: 10, size: 9 });
    doc.row("Charged onboard", usd(P.onboard), { indent: 10, size: 9 });
    doc.row("Paid separately (travel)", usd(P.separate), { indent: 10, size: 9 });
    if (q.notIncluded.length) { doc.gap(4); doc.para("Not in this estimate: " + q.notIncluded.join("; ") + ".", { size: 8.5, color: WARN }); }
    if (q.notices.length) { doc.gap(2); q.notices.forEach((n) => doc.para("Note: " + n.text, { size: 8, color: MUTED })); }
    doc.para(`Prices as of ${date.fmt(q.pricedAt)}.`, { size: 8, color: MUTED });
  }

  function quotePdf(s, q) {
    const doc = PDF();
    header(doc, "Vacation cost breakdown");
    writeQuote(doc, s, q);
    disclaimer(doc, q.sample);
    doc.footer("Cruise Finder - vacation cost breakdown");
    CF.download(`cruise-cost-${s.id}.pdf`, doc.blob());
  }

  function comparisonPdf(entries) {
    const doc = PDF();
    header(doc, `Cruise comparison - ${entries.length} cruise${entries.length > 1 ? "s" : ""}`, "Every cruise below is priced with the same travelers and choices unless marked Custom, so the totals compare fairly.");
    const min = Math.min(...entries.map((e) => e.q.totals.total));
    const short = (s) => CF.data.ship(s.shipId).name.replace(" of the Seas", "");
    const cw = (doc.W - 2 * doc.M - 130) / entries.length;
    const cols = [{ label: "", width: 130 }, ...entries.map((e) => ({ label: `${short(e.s)} ${date.fmt(e.s.depart, "short")}`, width: cw, align: "right" }))];
    const row = (label, fn, opts = {}) => ({ cells: [label, ...entries.map(fn)], ...opts });
    const b = (k) => (e) => usd(e.q.buckets[k]);
    doc.table(cols, [
      row("Itinerary", (e) => CF.data.name(e.s)),
      row("Departs", (e) => date.fmt(e.s.depart)),
      row("From", (e) => CF.data.port(e.s.port).name.split(",")[0]),
      row("Nights", (e) => e.s.nights),
      row("Ports visited", (e) => CF.data.portCalls(e.s).length),
      row("Stateroom", (e) => e.q.rooms.map((r) => r.catName + (r.substituted ? "*" : "")).join(", ")),
      row("Configuration", (e) => (e.custom ? "Custom" : "Shared")),
      row("Cruise fare", b("fare")), row("Taxes & fees", b("taxes")), row("Gratuities", b("gratuities")),
      row("Beverage", b("beverage")), row("Internet", b("internet")), row("Dining", b("dining")), row("Excursions", b("excursions")),
      row("Insurance & transfers", (e) => usd(e.q.buckets.insurance + e.q.buckets.transfers)), row("Spa & onboard", b("onboard")),
      row("Flights", b("flights")), row("Hotels", b("hotel")), row("Transportation", b("transport")), row("Other travel", b("otherTravel")),
      row("ESTIMATED TOTAL", (e) => usd(e.q.totals.total), { bold: true, color: NAVY }),
      row("Per person", (e) => usd(e.q.totals.perPerson)),
      row("Per night", (e) => usd(e.q.totals.perNight)),
      row("vs. lowest total", (e) => (e.q.totals.total === min ? "Lowest" : "+" + usd(e.q.totals.total - min))),
    ]);
    if (entries.some((e) => e.q.substituted)) doc.para("* Requested stateroom category unavailable on that sailing; nearest available category used.", { size: 8, color: WARN });
    entries.forEach((e) => { doc.newPage(); writeQuote(doc, e.s, e.q); });
    disclaimer(doc, entries.some((e) => e.q.sample));
    doc.footer("Cruise Finder - comparison");
    CF.download(`cruise-comparison-${date.today()}.pdf`, doc.blob());
  }

  function quoteCsv(s, q) {
    const rows = [["Cruise Finder vacation cost breakdown"], ["Itinerary", CF.data.name(s)], ["Ship", CF.data.ship(s.shipId).name], ["Departs", s.depart], ["Prices as of", q.pricedAt], ["Data", q.sample ? "SAMPLE DATA - not live pricing" : "Imported/override data"], [], ["Group", "Item", "Source", "Amount (USD)", "Details"]];
    for (const l of q.lines) rows.push([l.kind, l.label, CF.pricing.SOURCE_LABEL[l.source], (l.cents / 100).toFixed(2), l.detail || ""]);
    rows.push([], ["", "Cruise-only total", "", (q.totals.mandatory / 100).toFixed(2)], ["", "Optional total", "", (q.totals.optional / 100).toFixed(2)], ["", "Travel total", "", (q.totals.travel / 100).toFixed(2)], ["", "ESTIMATED TOTAL", "", (q.totals.total / 100).toFixed(2)], ["", "Per person", "", (q.totals.perPerson / 100).toFixed(2)], ["", "Per night", "", (q.totals.perNight / 100).toFixed(2)]);
    CF.download(`cruise-cost-${s.id}.csv`, CF.csv(rows), "text/csv");
  }
  function comparisonCsv(entries) {
    const head = ["Item", ...entries.map((e) => `${CF.data.ship(e.s.shipId).name} ${e.s.depart}`)];
    const row = (label, fn) => [label, ...entries.map(fn)];
    const d = (c) => (c / 100).toFixed(2);
    const rows = [head,
      row("Itinerary", (e) => CF.data.name(e.s)), row("Nights", (e) => e.s.nights), row("Departure port", (e) => CF.data.port(e.s.port).name), row("Stateroom", (e) => e.q.rooms.map((r) => r.catName).join("; ")),
      ...CF.pricing.BUCKETS.map((b) => row(b.label + " (USD)", (e) => d(e.q.buckets[b.id]))),
      row("ESTIMATED TOTAL (USD)", (e) => d(e.q.totals.total)), row("Per person (USD)", (e) => d(e.q.totals.perPerson)), row("Per night (USD)", (e) => d(e.q.totals.perNight)),
      row("Data", (e) => (e.q.sample ? "SAMPLE - not live" : "Imported/override"))];
    CF.download(`cruise-comparison-${date.today()}.csv`, CF.csv(rows), "text/csv");
  }

  function shareUrl(hashPath, payload) {
    const base = location.href.split("#")[0];
    return `${base}${hashPath}?share=${CF.b64.enc(payload)}`;
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); CF.ui.toast("Link copied. Anyone with it sees the same cruises and choices.", "good"); }
    catch (e) { CF.ui.prompt("Copy this link", "Share link", text); }
  }

  CF.exporter = { PDF, quotePdf, comparisonPdf, quoteCsv, comparisonCsv, shareUrl, copy };
})();
