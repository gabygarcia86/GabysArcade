# Cruise Finder

A Royal Caribbean cruise finder and price planner. It works like a personal travel agent: find a sailing, add everything you'd really buy, and see one complete, itemized vacation total you can compare against up to four other cruises. **Price transparency is the point.** Every line says where its number comes from, mandatory charges are kept apart from optional ones, and anything not priced is listed under "Not in this estimate".

It's plain HTML, CSS and JavaScript with no build step and no framework, matching the rest of Gaby's Arcade. Classic scripts share one `CF` namespace. The only optional extra is the AI proxy in `server/`, which runs on a server, not in the browser.

> **Data notice.** Royal Caribbean doesn't publish a public API for fares or stateroom inventory, and this app doesn't scrape its website. It ships with a **built-in sample data set** (made-up schedules and prices, clearly labelled "Sample" everywhere) and supports manually maintained data imported in Admin. It never presents a price as live or confirmed. The app is independent and not affiliated with Royal Caribbean.

## Features

- **Home dashboard:** a "Find My Cruise" quick search, popular destinations with the lowest complete trip total, featured deals ranked by cost per guest per night (never by advertised fare alone), seasonal ideas, recently viewed and saved cruises.
- **Search:** filter by destination (including Eastern, Western and Southern Caribbean, Bahamas and Perfect Day at CocoCay), departure port, dates (exact, flexible ± days, months, a date range or a whole year), length, ship, class, newest or largest ships, and budget. Budget filters use the **configured total**, not the advertised fare. Seven sort orders. Results update instantly and the search is remembered.
- **Cruise details:** ship facts, dining (included and specialty), entertainment, pools, activities, a day-by-day itinerary with a timeline or map view, port descriptions, fares and availability by category, and other dates for the same cruise.
- **Pricing configurator:** eight steps (stateroom, stateroom options, dining, beverages, internet, gratuities, optional extras, travel costs), with per-guest choices, multiple staterooms, a live total, how much the last change added or removed, and the full breakdown on the same page.
- **Cost breakdown:** total, per person, per night, cruise-only total, optional extras, travel, taxes and fees, and a payment schedule (deposit, balance due date, pre-cruise, onboard, paid separately). It also lists what's included and what isn't priced.
- **Compare up to 5 cruises:** every cruise uses the same travelers and choices unless you customize one, which is flagged. You get highlights for lowest total, lowest per person, lowest per night and best value; a bar chart; a price-difference table; and a full side-by-side table.
- **Find the Cheapest Dates:** a calendar and table of departures ranked by complete total.
- **AI travel agent:** natural-language questions answered from the app's own data (see below).
- **Saved:** favorites, wish lists, saved configurations, saved comparisons and recently viewed. Guest mode only, stored in the browser, with backup export and import.
- **Price tracker:** re-prices a saved configuration and shows the previous and current price, the change in dollars and percent, the last check, sample history and a target budget alert.
- **Export and share:** a built-in PDF writer for breakdowns and comparisons, CSV, print, and share links that carry the exact configuration.
- **Admin:** data-source status, JSON import of manually maintained sailings, manual price overrides, reference-rate and currency editing, data refresh, usage counters and an error log.

## Files

```text
index.html               Page shell; loads the scripts below in order
css/app.css              Tokens (light and dark), layout, components, every page, print styles
js/util.js               CF namespace, h() DOM helper, integer-cent money, UTC dates, seeded RNG, event bus
js/store.js              localStorage wrapper; settings, favorites, lists, configs, comparisons, compare tray, trackers, error log
js/data/ships.js         Ship classes (venues, dining) and ships (approximate public facts)
js/data/ports.js         Ports with coordinates and descriptions; sample excursion templates
js/data/itineraries.js   Destinations, itinerary templates, seasonal deployments, one-off repositioning sailings
js/data/rates.js         Stateroom categories, beverage packages, booking rules, reference rates, currencies
js/datasource.js         Data layer: sample generator, manual import, Admin overrides, source registry
js/pricing.js            Pricing engine (no DOM): configuration shape, category fallback, quotes, totals, payments
js/search.js             Filters, sorting, budget checks
js/assistant.js          AI travel agent: question -> plan -> execution -> answer
js/art.js                Original SVG illustrations (scenes and stylized ship profiles; no photos or logos)
js/ui.js                 Components: toasts, modals, badges, cruise cards, breakdown, charts, traveler editor
js/config-ui.js          The eight configurator steps (shared by Configure and Settings > Trip preferences)
js/map.js                Itinerary map (Leaflet + OpenStreetMap on demand, SVG fallback)
js/export.js             PDF writer, CSV, share links
js/pages/*.js            One file per page
js/app.js                Shell, hash router, theme, price alerts, startup
server/                  Optional AI proxy (Node.js)
icon/                    App icons
```

## How the pricing works

`CF.pricing.price(sailing, config)` returns every line item plus totals. All amounts are **integer US-dollar cents**, and percentages round once per line, so totals never drift. Currency conversion is display-only and labelled approximate.

| Line | How it's priced | Source label |
| --- | --- | --- |
| Cruise fare | Guests 1 and 2 pay the per-person double-occupancy fare. Guests 3+ pay an additional-guest rate by age (adult, child, infant). A solo guest pays 200%. Guarantee bookings can save a few percent. | Sample / Imported / Override |
| Promotions | Sample promotions apply to the fare only, as a separate negative line | Sample |
| Taxes, fees & port expenses | Per guest (every age), once per stateroom. Fares never include them, so they can't be double-counted | Sample / Imported / Override |
| Gratuities | Per guest per night, suite rate for suites. Always in the total; prepaying only changes when you pay | Reference |
| Beverage | Per guest per day × every day + 18% service charge. Deluxe is 21+ only, and if one 21+ guest in a room buys it, every 21+ guest in that room is added (and told why) | Sample |
| Internet | Per device per day, one or multi-device plan per stateroom | Reference |
| Dining | Unlimited Dining Package, 3-night package, a number of specialty dinners at the ship's average price, or specific restaurants; + service charge | Sample |
| Excursions | Specific sample excursions per port (child prices under 12, adults-only enforced) or a budget per port day | Sample / Your estimate |
| Insurance, transfers | An estimate (% of fare + taxes; per-person transfer rate) or an amount you enter | Estimate / Reference / Your estimate |
| Spa, onboard, travel | Amounts you enter (flights, hotels before and after, parking × days, port transport, rental car, other) | Your estimate |

If the chosen category isn't offered or is sold out, the engine uses the nearest available one (preferring an upgrade) and says so on the card, in the configurator and in comparisons. Specific stateroom numbers are never shown as available, because there's no inventory data; deck, location, connecting and accessible choices are recorded as requests.

**Fair comparisons:** search, Cheapest Dates, the assistant and Compare all price with your *trip preferences* (Settings), so totals are like-for-like. **Best value** is `total ÷ (nights + ½ × port visits)`, a cost per vacation day that credits port days, and the formula is shown in the app. A cruise is never called the best deal because of its advertised fare alone.

## The data

### Sample data

`datasource.js` generates about 1,600 sailings across 24 ships and 39 itineraries, always covering the next 13 months from today. Prices are deterministic (seeded per ship and date), so they're the same on every visit. They move with ship class, destination, season, holidays, length and a little noise. Each sailing has eight weekly sample price snapshots for the tracker's history chart. Ship facts are approximate public figures. Venues, excursions and package prices are representative samples.

### Manually maintained data

In **Admin › Data sources & API**, paste or upload JSON like this:

```json
{
  "sailings": [
    { "shipId": "icon", "itId": "wc7-mia", "depart": "2027-03-06",
      "fares": { "INT": 1249, "OV": 1449, "BAL": 1899, "JS": 3999 },
      "taxes": 180, "sold_out": ["RLS"], "pricedAt": "2026-11-07" }
  ]
}
```

Fares are dollars per person (double occupancy, before taxes), and taxes are dollars per person. `shipId` and `itId` must exist (see Admin › Ships & itineraries). Imported sailings replace sample sailings with the same ship and date and are labelled "Imported data". They're stored in that browser only.

### Admin overrides

You can override any sailing's fares, availability or taxes, and any reference rate or exchange rate. Overrides apply in that browser only and are labelled "Admin override" on every line they touch.

### Adding a live source later

Real fares and inventory need an authorized agreement (a Royal Caribbean travel-partner program or a licensed cruise data provider). Those credentials must live on a server. The pattern to follow is the one the AI proxy uses: a small server holds the key, the browser calls the server, and the server returns sailings in the same shape as the sample generator (`{ id, line, shipId, itId, depart, nights, fares: {CAT: {pp, avail}}, taxPP, source: "live", pricedAt }`). Register the new source in `CF.data.sources()` and merge its sailings in `CF.data.init()`. Sailings carry a `line` field so other cruise lines could be added the same way.

## The AI travel agent

The assistant never answers from a language model's memory. A question becomes a **plan** (intent, destinations, ports, dates, nights, budget, travelers, stateroom). The plan runs against the app's own data and pricing engine, and the answer is written from those results. If nothing matches, it says so.

- **Built-in** (default): a local parser that handles the example questions offline.
- **AI service** (optional): `server/ai-proxy.mjs` asks Claude (`claude-opus-5-5`, structured JSON output with server-side refusal fallbacks enabled) to fill in the plan. The JSON schema is built from the ids the app sends, so the model can only pick destinations, ports and ships that exist. The app re-validates the plan before using it. Claude never sees or writes prices.

Run the proxy with Node.js 18+:

```bash
cd apps/cruise_finder/server
npm install
ANTHROPIC_API_KEY=sk-ant-... node ai-proxy.mjs
```

Then open **Settings › AI travel assistant**, enter `http://localhost:8788`, press **Test connection** and choose **AI service**. If the proxy fails, the app falls back to the built-in engine and says so.

| Setting | Default |
| --- | --- |
| `PORT` | `8788` |
| `ALLOWED_ORIGINS` | `https://gabygarcia86.github.io` plus common localhost ports |
| `AI_MODEL` | `claude-opus-5-5` |
| `RATE_LIMIT_PER_MIN` | `20` requests per IP per minute |

GitHub Pages can't run server code, so host the proxy elsewhere or run it locally. AI requests cost money on your Anthropic account.

## Limits worth knowing

- **Static site:** there are no accounts or cross-device sync (use backup export/import), and price alerts only appear while the app is open. Admin changes affect one browser and aren't secret.
- **Map:** the interactive map loads Leaflet from cdnjs and tiles from OpenStreetMap when opened. Offline, it falls back to a built-in SVG route map.
- **PDF:** the built-in writer uses standard Helvetica, so non-Latin characters are simplified. Non-USD amounts show a currency code (for example "EUR 1,234.00").

## Changing the sample data

- **Add a ship:** add it to `C.ships` in `js/data/ships.js` (with a class from `C.classes`), then give it a deployment in `js/data/itineraries.js`.
- **Add an itinerary:** add an `I(...)` entry with one stop per day (`"sea"` for sea days) and reference it in a deployment `cycle`.
- **Change rates or rules:** edit `js/data/rates.js`. Rule text there is shown to users next to the lines it affects.
