// Comic Book Studio - AI proxy server.
//
// Keeps your Anthropic API key on the server. The browser app only ever talks to this proxy.
//   GET  /health   -> { ok, provider, model }
//   POST /story    -> structured comic story (title, characters, outline, page-by-page panels)
//   POST /art      -> { svg } comic-style vector artwork drawn by Claude (character, background or panel)
//
// Run:   npm install && ANTHROPIC_API_KEY=sk-ant-... node ai-proxy.mjs
// Env:   PORT (default 8787), ALLOWED_ORIGINS (comma-separated, default: the Gaby's Arcade site + localhost),
//        AI_MODEL (default claude-opus-5-5), RATE_LIMIT_PER_MIN (default 12 requests per IP per minute)
import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const RATE = Number(process.env.RATE_LIMIT_PER_MIN || 12);
const ORIGINS = (process.env.ALLOWED_ORIGINS || "https://gabygarcia86.github.io,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://127.0.0.1:8000,http://localhost:8080")
  .split(",").map((s) => s.trim()).filter(Boolean);
const MAX_BODY = 20_000;

// Credentials come from the environment (ANTHROPIC_API_KEY or an `ant auth login` profile). Never from the browser.
// The client is created on first use so the proxy still starts (and /health answers) when no key is configured.
let client = null;
function getClient() {
  if (!client) {
    try { client = new Anthropic(); }
    catch { throw Object.assign(new Error("The proxy has no API key. Set ANTHROPIC_API_KEY where the proxy runs."), { status: 503 }); }
  }
  return client;
}

/* ---------- JSON schemas for structured outputs ---------- */
const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const STORY_SCHEMA = obj({
  title: { type: "string" },
  logline: { type: "string" },
  concept: { type: "string" },
  characters: { type: "array", items: obj({ name: { type: "string" }, role: { type: "string" }, look: { type: "string" }, personality: { type: "string" }, power: { type: "string" } }) },
  outline: { type: "array", items: { type: "string" } },
  pages: {
    type: "array",
    items: obj({
      number: { type: "integer" },
      panels: {
        type: "array",
        items: obj({
          scene: { type: "string" },
          caption: { type: "string" },
          dialogue: { type: "array", items: obj({ speaker: { type: "string" }, text: { type: "string" }, type: { type: "string", enum: ["speech", "thought", "whisper", "shout"] } }) },
          sfx: { type: "string" },
        }),
      },
    }),
  },
});
const ART_SCHEMA = obj({ svg: { type: "string" }, title: { type: "string" } });

/* ---------- prompts ---------- */
const STORY_SYSTEM = `You are a friendly comic book writing partner inside Comic Book Studio, an app used by kids, beginners and hobbyists.
Write original stories only: never use existing franchises, trademarked characters or real people. Keep content all-ages unless the idea is clearly for older readers, and even then avoid graphic violence.
Comic craft: 3 to 6 panels per page, short punchy speech balloons (under 20 words each), captions only where they help, sound effects in caps for action beats. The last page resolves the story.
"concept" is a short pitch paragraph. "outline" has one line per page. Use "" for an empty caption or sfx.`;

const ART_SYSTEM = `You draw original comic-book artwork as a single standalone SVG for Comic Book Studio.
Rules for the SVG:
- Root <svg xmlns="http://www.w3.org/2000/svg"> with the requested viewBox and matching width/height attributes.
- Bold comic style: flat colors, thick dark outlines (stroke-width 4-8), simple shading shapes, expressive faces.
- Only shapes, paths, gradients and groups. No <script>, no <foreignObject>, no event attributes, no external images, links or fonts, no <text> unless the request asks for words.
- Characters: full body, centered, transparent background (no background rectangle). Backgrounds: fill the whole canvas, no characters unless asked. Panels: a full scene that fills the canvas.
- Original designs only: never draw existing franchise characters, logos or real people.
Return the complete SVG markup in "svg" and a 2-5 word name in "title".`;

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

/* One structured-output call. Opts into server-side refusal fallbacks, then checks stop_reason before reading. */
async function structured({ system, user, schema }) {
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw Object.assign(new Error("The AI declined this request. Try describing it differently."), { status: 422 });
  if (response.stop_reason === "max_tokens") throw Object.assign(new Error("The answer was too long. Try fewer pages or a simpler description."), { status: 422 });
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

/* Strip anything active from model-written SVG before it reaches the browser. */
function sanitizeSvg(svg) {
  let s = String(svg || "").trim();
  const start = s.indexOf("<svg"), end = s.lastIndexOf("</svg>");
  if (start < 0 || end < 0) throw Object.assign(new Error("The AI didn't return a drawing. Try again."), { status: 502 });
  s = s.slice(start, end + 6);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "").replace(/(href|xlink:href)\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "");
  if (!/xmlns=/.test(s.slice(0, 200))) s = s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return s;
}

/* ---------- routes ---------- */
async function story(body) {
  const pages = Math.max(1, Math.min(12, parseInt(body.pages, 10) || 4));
  const user = [
    `Story idea: ${clip(body.idea, 1200) || "(surprise me)"}`,
    `Genre: ${clip(body.genre, 40) || "superhero"}`,
    `Tone: ${clip(body.tone, 40) || "fun"}`,
    `Pages: exactly ${pages}`,
    body.audience ? `Audience: ${clip(body.audience, 60)}` : "",
  ].filter(Boolean).join("\n");
  const data = await structured({ system: STORY_SYSTEM, user, schema: STORY_SCHEMA });
  data.pages = (data.pages || []).slice(0, pages);
  data.genre = body.genre; data.tone = body.tone; data.source = "ai";
  return data;
}

async function art(body) {
  const kind = ["character", "background", "panel"].includes(body.kind) ? body.kind : "panel";
  const w = kind === "character" ? 420 : Math.max(200, Math.min(1600, parseInt(body.width, 10) || 1200));
  const h = kind === "character" ? 600 : Math.max(200, Math.min(1600, parseInt(body.height, 10) || 800));
  const user = `Draw a ${kind}: ${clip(body.prompt, 1500)}\nviewBox="0 0 ${w} ${h}" width="${w}" height="${h}".${body.variation ? ` Variation #${clip(body.variation, 8)}: make it clearly different from other versions.` : ""}`;
  const data = await structured({ system: ART_SYSTEM, user, schema: ART_SCHEMA });
  return { svg: sanitizeSvg(data.svg), title: clip(data.title, 60), width: w, height: h };
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/health") {
      let ready = true;
      try { getClient(); } catch { ready = false; }
      return send(res, ready ? 200 : 503, ready ? { ok: true, provider: "anthropic", model: MODEL, features: ["story", "art"] } : { ok: false, error: "The proxy has no API key. Set ANTHROPIC_API_KEY where the proxy runs." });
    }
    if (req.method !== "POST" || !["/story", "/art"].includes(url.pathname)) return send(res, 404, { error: "Not found" });
    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "?";
    if (rateLimited(ip)) return send(res, 429, { error: "Too many requests. Wait a minute and try again." });
    const body = await readBody(req);
    const out = url.pathname === "/story" ? await story(body) : await art(body);
    send(res, 200, out);
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

server.listen(PORT, () => console.log(`Comic Book Studio AI proxy on http://localhost:${PORT} using ${MODEL}. Allowed origins: ${ORIGINS.join(", ")}`));
