// Checks data/catalog.js against the real folders. Run from anywhere:
//   node tools/check-catalog.mjs
// Errors would show up as broken cards on the site. Warnings are worth a look.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMING_SOON = /^\s*coming\s+soon\b/i;
const GUARD_SCRIPT = "assets/js/coming-soon-guard.js";

const errors = [];
const warnings = [];

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(path.join(root, "data/catalog.js"), "utf8"), sandbox);
const catalog = sandbox.window.ARCADE_CATALOG;

const pageTitle = (html) => html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim() ?? "";
const decode = (text) => text.replace(/&amp;/g, "&");

function checkSection(entries, baseFolder) {
  const folders = readdirSync(path.join(root, baseFolder), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const listed = new Set();

  for (const entry of entries) {
    const label = `${baseFolder}/${entry.folder}`;
    if (listed.has(entry.folder)) errors.push(`${label}: listed twice`);
    listed.add(entry.folder);

    // Exact-case match, because GitHub Pages paths are case-sensitive and Windows isn't.
    if (!folders.includes(entry.folder)) {
      errors.push(`${label}: folder not found (check the spelling and capitals)`);
      continue;
    }

    const entryPage = path.join(root, entry.url ?? `${label}/index.html`);
    const icon = path.join(root, entry.icon ?? `${label}/icon/icon-256.png`);
    if (!existsSync(entryPage)) errors.push(`${label}: missing entry page`);
    if (!existsSync(icon)) warnings.push(`${label}: missing icon, the card will show its initial`);
    if (!entry.description) warnings.push(`${label}: no description`);
    if (!entry.category) warnings.push(`${label}: no category, it will be filed under "Other"`);
    if (entry.added && !/^\d{4}-\d{2}-\d{2}$/.test(entry.added)) {
      errors.push(`${label}: added must look like YYYY-MM-DD`);
    }

    if (baseFolder === "games" && existsSync(entryPage)) {
      const html = readFileSync(entryPage, "utf8");
      const title = decode(pageTitle(html));
      if (!title) warnings.push(`${label}: index.html has no <title>`);
      if (title && title !== entry.title) {
        warnings.push(`${label}: catalog title "${entry.title}" differs from <title> "${title}"`);
      }
      if (COMING_SOON.test(title) && !html.includes(GUARD_SCRIPT)) {
        errors.push(`${label}: Coming Soon game is missing the guard script, so its URL is open`);
      }
    }
  }

  for (const folder of folders) {
    if (!listed.has(folder)) warnings.push(`${baseFolder}/${folder}: folder has no catalog entry`);
  }

  console.log(`${baseFolder}: ${entries.length} catalog entries, ${folders.length} folders`);
}

checkSection(catalog.games, "games");
checkSection(catalog.apps, "apps");

warnings.forEach((message) => console.warn(`WARNING  ${message}`));
errors.forEach((message) => console.error(`ERROR    ${message}`));
console.log(errors.length || warnings.length
  ? `${errors.length} error(s), ${warnings.length} warning(s)`
  : "Everything looks good.");
process.exit(errors.length ? 1 : 0);
