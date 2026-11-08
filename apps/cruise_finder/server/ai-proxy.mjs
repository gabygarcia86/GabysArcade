// Cruise Finder - optional AI proxy server.
//
// Keeps your Anthropic API key on the server. The browser app only ever talks to this proxy.
//   GET  /health -> { ok, provider, model }
//   POST /plan   -> { plan }  a structured search plan for the app to run against its own data
//
// Claude only turns the traveler's question into a plan (destinations, dates, budget, travelers...). It never
// sees or writes prices, availability or policies: the app executes the plan against its own data and writes the
// answer from those results. The JSON schema is built per request from the ids the app sends, so the model can
// only pick destinations, ports and ships that exist in the app.
//
// Run:   npm install && ANTHROPIC_API_KEY=sk-ant-... node ai-proxy.mjs
// Env:   PORT (default 8788), ALLOWED_ORIGINS (comma-separated, default: the Gaby's Arcade site + localhost),
//        AI_MODEL (default claude-opus-5-5), RATE_LIMIT_PER_MIN (default 20 requests per IP per minute)
import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";

const PORT = Number(process.env.PORT || 8788);
const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const RATE = Number(process.env.RATE_LIMIT_PER_MIN || 20);
const ORIGINS = (process.env.ALLOWED_ORIGINS || "https://gabygarcia86.github.io,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000,http://localhost:8080")
  .split(",").map((s) => s.trim()).filter(Boolean);
const MAX_BODY = 60_000;

// Credentials come from the environment (ANTHROPIC_API_KEY or an `ant auth login` profile). Never from the browser.
let client = null;
function getClient() {
  if (!client) {
    try { client = new Anthropic(); }
    catch { throw Object.assign(new Error("The proxy has no API key. Set ANTHROPIC_API_KEY where the proxy runs."), { status: 503 }); }
  }
  return client;
}

/* ---------- helpers ---------- */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE;
}
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ORIGINS.includes("*") || ORIGINS.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
}
function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("Request too large"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(Object.assign(new Error("Invalid JSON"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}
const clip = (s, n) => String(s ?? "").slice(0, n);
// Keep only short, id-like values from the client's option lists.
const ids = (list, max = 200) => (Array.isArray(list) ? list : []).slice(0, max).map((o) => ({ id: clip(o?.id ?? o, 40), name: clip(o?.name ?? o?.id ?? o, 80) })).filter((o) => /^[\w-]+$/.test(o.id));

/* ---------- plan schema, built from the app's own ids ---------- */
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const enumList = (values) => ({ type: "array", items: values.length ? { type: "string", enum: values } : { type: "string" } });
function planSchema(o) {
  const properties = {
    intent: { type: "string", enum: ["search", "cheapest", "best_value", "most_stops", "compare_ships", "compare_months", "cheapest_ship", "help"] },
    destinations: enumList(o.destinations.map((x) => x.id)),
    departure_ports: enumList(o.departure_ports.map((x) => x.id)),
    visits_ports: enumList(o.ports_of_call.map((x) => x.id)),
    ships: enumList(o.ships.map((x) => x.id)),
    ship_classes: enumList(o.ship_classes.map((x) => x.id)),
    min_nights: nullable({ type: "integer" }),
    max_nights: nullable({ type: "integer" }),
    months: enumList(o.months_available.map((x) => x.id)),
    year: nullable({ type: "integer" }),
    max_total: nullable({ type: "number" }),
    max_per_person: nullable({ type: "number" }),
    max_per_night: nullable({ type: "number" }),
    adults: nullable({ type: "integer" }),
    children_ages: { type: "array", items: { type: "integer" } },
    staterooms: nullable({ type: "integer" }),
    category: nullable({ type: "string", enum: o.categories.map((x) => x.id) }),
    limit: { type: "integer" },
  };
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

const SYSTEM = `You turn a traveler's question about Royal Caribbean cruises into a search plan for Cruise Finder, a cruise price-planning app.
You do NOT answer the question yourself and you never state prices, availability, itineraries or policies. The app runs your plan against its own data and writes the answer.

How to fill the plan:
- intent: "compare_ships" when they compare named ships; "compare_months" when they ask which of two months is cheaper; "cheapest_ship" for "which ship is cheapest"; "most_stops" for most ports; "best_value" for best value or best deal; "cheapest" when they want the lowest price; "help" for greetings or questions about what you can do; otherwise "search".
- Use only ids from the option lists provided. Leave a list empty rather than guessing.
- "Caribbean" without a region means the "caribbean" destination. "From Florida" means every Florida departure port.
- Seasons: summer = June-August, winter = December-February, spring = March-May, fall = September-November. Use the next occurrence on or after today's date, and only months listed in months_available.
- Nights: "a week" = 7. Use min_nights and max_nights; set both to the same number for an exact length. Use null when not mentioned.
- Money is in US dollars, as plain numbers. "Under $4,000" is max_total unless they say per person (max_per_person) or per night (max_per_night).
- Travelers: "family of four" = 2 adults and children aged 10 and 7. Only set adults, children_ages and staterooms when the question mentions who is traveling; otherwise null and [].
- category: only when they name a stateroom type (interior, ocean view, balcony, suite...).
- limit: how many results to show, 5 unless they ask for a number (maximum 10).`;

async function plan(body) {
  const o = body.options || {};
  const options = {
    destinations: ids(o.destinations),
    departure_ports: ids(o.departure_ports),
    ports_of_call: ids(o.ports_of_call),
    ships: ids(o.ships),
    ship_classes: ids(o.ship_classes),
    categories: ids(o.categories, 20),
    months_available: ids(o.months_available, 30),
  };
  if (!options.categories.length) throw Object.assign(new Error("Missing option lists."), { status: 400 });
  const question = clip(body.question, 1000);
  if (!question.trim()) throw Object.assign(new Error("Ask a question first."), { status: 400 });
  const user = [
    `Today's date: ${clip(body.today, 10)}`,
    `Options (id: name):`,
    ...Object.entries(options).map(([k, list]) => `${k}: ${list.map((x) => (x.id === x.name ? x.id : `${x.id}: ${x.name}`)).join("; ")}`),
    ``,
    `Traveler's question: ${question}`,
  ].join("\n");
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: planSchema(options) } },
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw Object.assign(new Error("The AI declined this request. Try asking differently."), { status: 422 });
  if (response.stop_reason === "max_tokens") throw Object.assign(new Error("The AI's answer was cut off. Try a shorter question."), { status: 422 });
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return { plan: JSON.parse(text), model: MODEL };
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      let ready = true;
      try { getClient(); } catch { ready = false; }
      return send(res, ready ? 200 : 503, ready ? { ok: true, provider: "anthropic", model: MODEL, features: ["plan"] } : { ok: false, error: "The proxy has no API key. Set ANTHROPIC_API_KEY where the proxy runs." });
    }
    if (req.method !== "POST" || url.pathname !== "/plan") return send(res, 404, { error: "Not found" });
    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "?";
    if (rateLimited(ip)) return send(res, 429, { error: "Too many requests. Wait a minute and try again." });
    send(res, 200, await plan(await readBody(req)));
  } catch (err) {
    // Typed SDK errors, most specific first.
    if (err instanceof Anthropic.AuthenticationError) return send(res, 500, { error: "The proxy's API key is missing or invalid." });
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: "The AI service is busy. Try again shortly." });
    if (err instanceof Anthropic.BadRequestError) return send(res, 400, { error: "The AI service rejected the request." });
    if (err instanceof Anthropic.APIError) return send(res, 502, { error: `AI service error (${err.status ?? "network"}).` });
    console.error(err);
    send(res, err.status || 500, { error: err.status ? err.message : "Something went wrong in the proxy." });
  }
});

server.listen(PORT, () => console.log(`Cruise Finder AI proxy on http://localhost:${PORT} using ${MODEL}. Allowed origins: ${ORIGINS.join(", ")}`));
