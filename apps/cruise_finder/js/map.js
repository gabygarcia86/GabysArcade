/* Itinerary map. Loads Leaflet + OpenStreetMap tiles on demand; if that fails (offline, blocked), draws a
 * self-contained SVG route map instead so the feature always works. */
(function () {
  "use strict";
  const CF = window.CF;
  const { h } = CF;
  const LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
  let loading = null;

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      document.head.append(h("link", { rel: "stylesheet", href: LEAFLET + "leaflet.min.css", crossorigin: "" }));
      const s = document.createElement("script");
      s.src = LEAFLET + "leaflet.min.js";
      s.crossOrigin = "";
      s.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet missing")));
      s.onerror = () => reject(new Error("Couldn't load the map library"));
      document.head.append(s);
      setTimeout(() => reject(new Error("Map library timed out")), 9000);
    }).catch((e) => { loading = null; throw e; });
    return loading;
  }

  function stops(s) {
    const seen = [];
    for (const d of CF.data.timeline(s)) {
      if (d.kind === "sea") continue;
      const last = seen[seen.length - 1];
      if (last && last.id === d.id) { last.days.push(d.day); continue; }
      seen.push({ id: d.id, name: d.name, lat: d.port.lat, lon: d.port.lon, days: [d.day], kind: d.kind });
    }
    return seen;
  }

  function render(container, s) {
    const pts = stops(s);
    const mapEl = h("div", { class: "map-canvas", role: "region", "aria-label": `Map of the ${CF.data.name(s)} route` });
    const status = h("p", { class: "muted small map-status" }, "Loading map…");
    container.append(mapEl, status);
    loadLeaflet().then((L) => {
      const map = L.map(mapEl, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 12, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
      const latlngs = pts.map((p) => [p.lat, p.lon]);
      L.polyline(latlngs, { color: "#1f4fd6", weight: 3, dashArray: "6 6" }).addTo(map);
      pts.forEach((p, i) => {
        L.circleMarker([p.lat, p.lon], { radius: 8, color: "#ffffff", weight: 2, fillColor: i === 0 ? "#0b1f3f" : p.kind === "private" ? "#e8590c" : "#1f4fd6", fillOpacity: 1 })
          .addTo(map).bindTooltip(`${i + 1}. ${p.name} (day ${p.days.join(", ")})`);
      });
      map.fitBounds(L.latLngBounds(latlngs).pad(0.25));
      status.textContent = "Route lines are schematic, not the ship's actual course. Map data © OpenStreetMap contributors.";
    }).catch(() => {
      mapEl.classList.add("svg-map");
      mapEl.innerHTML = svgMap(pts);
      status.textContent = "Showing a simplified route map (the interactive map couldn't load). Positions are to scale; coastlines aren't drawn.";
    });
  }

  function svgMap(pts) {
    const W = 800, H = 420, pad = 60;
    const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const midLat = (minLat + maxLat) / 2, k = Math.cos((midLat * Math.PI) / 180);
    const spanX = Math.max((maxLon - minLon) * k, 2), spanY = Math.max(maxLat - minLat, 2);
    const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
    const cx = (minLon + maxLon) / 2, cy = midLat;
    const X = (lon) => W / 2 + (lon - cx) * k * scale, Y = (lat) => H / 2 - (lat - cy) * scale;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Simplified route map">`;
    s += `<rect width="${W}" height="${H}" class="sm-sea"/>`;
    const step = spanY > 20 ? 10 : spanY > 8 ? 5 : 2;
    for (let lat = Math.floor((cy - H / 2 / scale) / step) * step; lat <= cy + H / 2 / scale; lat += step) s += `<path d="M0 ${Y(lat)}H${W}" class="sm-grid"/><text x="6" y="${Y(lat) - 4}" class="sm-gridlabel">${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}</text>`;
    const stepX = spanX > 20 ? 10 : spanX > 8 ? 5 : 2;
    for (let lon = Math.floor((cx - W / 2 / (k * scale)) / stepX) * stepX; lon <= cx + W / 2 / (k * scale); lon += stepX) s += `<path d="M${X(lon)} 0V${H}" class="sm-grid"/>`;
    const d = pts.map((p, i) => (i ? "L" : "M") + X(p.lon).toFixed(1) + " " + Y(p.lat).toFixed(1)).join(" ");
    s += `<path d="${d}" class="sm-route"/>`;
    pts.forEach((p, i) => {
      const x = X(p.lon), y = Y(p.lat);
      const right = x < W * 0.7;
      s += `<g class="sm-stop ${i === 0 ? "home" : p.kind}"><circle cx="${x}" cy="${y}" r="11"/><text x="${x}" y="${y + 4}" text-anchor="middle" class="sm-num">${i + 1}</text>
        <text x="${right ? x + 16 : x - 16}" y="${y + 4}" text-anchor="${right ? "start" : "end"}" class="sm-label">${CF.esc(p.name.split(",")[0])}</text></g>`;
    });
    return s + `</svg>`;
  }

  CF.map = { render, stops };
})();
