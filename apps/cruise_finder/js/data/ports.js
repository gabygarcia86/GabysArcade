/* Ports: departure ports and ports of call, with map coordinates and short descriptions.
 * type picks the illustration and sample excursion set: beach, city, nature, glacier, private, scenic. */
(function () {
  "use strict";
  const CF = window.CF;
  CF.DATA = CF.DATA || {};

  const P = (id, name, country, lat, lon, type, desc, extra) => ({ id, name, country, lat, lon, type, desc, ...extra });
  const list = [
    // Departure ports
    P("MIA", "Miami, Florida", "USA", 25.77, -80.17, "city", "The cruise capital of the world. Easy flights, Art Deco South Beach and Little Havana nearby.", { home: true, state: "FL", region: "Florida" }),
    P("PCV", "Port Canaveral, Florida", "USA", 28.41, -80.62, "city", "An hour from Orlando's theme parks, next to Kennedy Space Center.", { home: true, state: "FL", region: "Florida" }),
    P("FLL", "Fort Lauderdale, Florida", "USA", 26.09, -80.12, "city", "Port Everglades sits minutes from the airport and the beach.", { home: true, state: "FL", region: "Florida" }),
    P("TPA", "Tampa, Florida", "USA", 27.94, -82.45, "city", "Gulf Coast departures from downtown's Channelside district.", { home: true, state: "FL", region: "Florida" }),
    P("GAL", "Galveston, Texas", "USA", 29.31, -94.79, "city", "Drive-to port about an hour from Houston, with a historic Strand district.", { home: true, state: "TX", region: "Texas" }),
    P("BAY", "Cape Liberty (Bayonne), New Jersey", "USA", 40.67, -74.08, "city", "Sail past the Statue of Liberty from the New York area.", { home: true, state: "NJ", region: "Northeast" }),
    P("BAL", "Baltimore, Maryland", "USA", 39.27, -76.58, "city", "Drive-to sailings for the Mid-Atlantic.", { home: true, state: "MD", region: "Northeast" }),
    P("LAX", "Los Angeles, California", "USA", 33.74, -118.28, "city", "San Pedro terminal for Mexico getaways.", { home: true, state: "CA", region: "West Coast" }),
    P("SEA", "Seattle, Washington", "USA", 47.61, -122.35, "city", "Gateway to Alaska's Inside Passage.", { home: true, state: "WA", region: "West Coast" }),
    P("YVR", "Vancouver, Canada", "Canada", 49.29, -123.11, "city", "Canada Place sits right downtown, a scenic start for Alaska.", { home: true, region: "West Coast" }),
    P("SJU", "San Juan, Puerto Rico", "USA", 18.47, -66.11, "city", "Colorful Old San Juan and El Morro fortress, steps from the pier.", { home: true, region: "Caribbean" }),
    P("BCN", "Barcelona, Spain", "Spain", 41.37, 2.18, "city", "Gaudí's architecture, tapas and Las Ramblas.", { home: true, region: "Europe" }),
    P("CIV", "Rome (Civitavecchia), Italy", "Italy", 42.09, 11.79, "city", "Port for Rome, about 90 minutes from the Colosseum.", { home: true, region: "Europe" }),
    P("SOU", "Southampton, England", "UK", 50.9, -1.4, "city", "Britain's cruise hub, an hour and a half from London.", { home: true, region: "Europe" }),
    P("CPH", "Copenhagen, Denmark", "Denmark", 55.69, 12.6, "city", "Nyhavn's colorful harbor and Tivoli Gardens.", { home: true, region: "Europe" }),
    P("SIN", "Singapore", "Singapore", 1.26, 103.82, "city", "Marina Bay Sands, hawker centers and Gardens by the Bay.", { home: true, region: "Asia" }),
    P("SYD", "Sydney, Australia", "Australia", -33.86, 151.21, "city", "Sail out past the Opera House and Harbour Bridge.", { home: true, region: "Australia" }),

    // Ports of call - Bahamas and Florida
    P("COCO", "Perfect Day at CocoCay", "Bahamas", 25.82, -77.94, "private", "Royal Caribbean's private island with a waterpark, beaches and a helium balloon (some areas cost extra)."),
    P("NAS", "Nassau, Bahamas", "Bahamas", 25.08, -77.35, "beach", "Colonial capital with beaches, straw markets and Paradise Island."),
    P("KEY", "Key West, Florida", "USA", 24.55, -81.8, "city", "Duval Street, Hemingway's house and sunset at Mallory Square."),
    P("BDA", "King's Wharf, Bermuda", "Bermuda", 32.33, -64.83, "beach", "Pink-sand beaches and the Royal Naval Dockyard. Overnight stay."),
    // Western Caribbean
    P("COZ", "Cozumel, Mexico", "Mexico", 20.51, -86.95, "beach", "World-class reef snorkeling and beach clubs."),
    P("CMA", "Costa Maya, Mexico", "Mexico", 18.71, -87.71, "nature", "Mayan ruins and a laid-back beach town."),
    P("PRO", "Progreso, Mexico", "Mexico", 21.29, -89.66, "nature", "Gateway to Mérida and the Chichén Itzá ruins."),
    P("ROA", "Roatán, Honduras", "Honduras", 16.33, -86.53, "beach", "Reef diving, zip lines and sloths."),
    P("GCM", "George Town, Grand Cayman", "Cayman Islands", 19.29, -81.38, "beach", "Seven Mile Beach and Stingray City (tender port)."),
    P("FAL", "Falmouth, Jamaica", "Jamaica", 18.49, -77.65, "nature", "Historic Georgian town near Dunn's River Falls."),
    P("LAB", "Labadee, Haiti", "Haiti", 19.78, -72.25, "private", "Royal Caribbean's private beach destination with a zip line."),
    // Eastern / Southern Caribbean
    P("STT", "St. Thomas, U.S. Virgin Islands", "USA", 18.34, -64.93, "beach", "Magens Bay, duty-free shopping and a quick ferry to St. John."),
    P("SXM", "Philipsburg, St. Maarten", "St. Maarten", 18.02, -63.05, "beach", "Half Dutch, half French, famous for Maho Beach plane-spotting."),
    P("AMB", "Puerto Plata (Amber Cove), Dominican Republic", "Dominican Republic", 19.81, -70.73, "nature", "Waterfalls, cable car and amber museums."),
    P("STK", "Basseterre, St. Kitts", "St. Kitts & Nevis", 17.3, -62.72, "nature", "Scenic railway and Brimstone Hill fortress."),
    P("ANT", "St. John's, Antigua", "Antigua", 17.12, -61.85, "beach", "Famous for having 365 beaches."),
    P("STL", "Castries, St. Lucia", "St. Lucia", 14.01, -60.99, "nature", "The Pitons, a drive-in volcano and rainforest."),
    P("BAR", "Bridgetown, Barbados", "Barbados", 13.1, -59.63, "beach", "Rum distilleries, Harrison's Cave and turtles."),
    P("ARU", "Oranjestad, Aruba", "Aruba", 12.52, -70.04, "beach", "Eagle Beach and desert landscapes, outside the hurricane belt."),
    P("CUR", "Willemstad, Curaçao", "Curaçao", 12.11, -68.93, "city", "Pastel Dutch colonial waterfront, a UNESCO site."),
    P("BON", "Kralendijk, Bonaire", "Bonaire", 12.15, -68.28, "nature", "Shore diving paradise and flamingos."),
    // Mexico Pacific
    P("CAT", "Catalina Island, California", "USA", 33.34, -118.33, "beach", "Avalon's harbor, glass-bottom boats and golf carts (tender port)."),
    P("ENS", "Ensenada, Mexico", "Mexico", 31.85, -116.63, "city", "La Bufadora blowhole and Valle de Guadalupe wineries."),
    P("CSL", "Cabo San Lucas, Mexico", "Mexico", 22.88, -109.91, "beach", "El Arco rock formation and whale watching in season (tender port)."),
    P("MZT", "Mazatlán, Mexico", "Mexico", 23.2, -106.42, "city", "Historic old town and a long malecón."),
    P("PVR", "Puerto Vallarta, Mexico", "Mexico", 20.65, -105.24, "beach", "Cobblestone streets, Banderas Bay and jungle zip lines."),
    // Alaska and Canada
    P("JNU", "Juneau, Alaska", "USA", 58.3, -134.42, "glacier", "Mendenhall Glacier, whale watching and the Mount Roberts Tramway."),
    P("SKG", "Skagway, Alaska", "USA", 59.45, -135.32, "nature", "Gold Rush town and the White Pass Scenic Railway."),
    P("KTN", "Ketchikan, Alaska", "USA", 55.34, -131.65, "nature", "Totem poles, Creek Street and Misty Fjords."),
    P("SIT", "Sitka, Alaska", "USA", 57.05, -135.33, "nature", "Russian heritage, raptors and sea otters."),
    P("ICY", "Icy Strait Point, Alaska", "USA", 58.13, -135.45, "nature", "Native-owned destination with whale watching and a huge zip line."),
    P("END", "Endicott Arm & Dawes Glacier", "USA", 57.5, -133.1, "scenic", "Scenic cruising past icebergs to a tidewater glacier.", { scenic: true }),
    P("VIC", "Victoria, British Columbia", "Canada", 48.42, -123.37, "city", "Evening call: Butchart Gardens and the Inner Harbour."),
    // Europe
    P("PMI", "Palma de Mallorca, Spain", "Spain", 39.56, 2.63, "beach", "Gothic cathedral and turquoise coves."),
    P("TLN", "Provence (Toulon), France", "France", 43.12, 5.93, "city", "Gateway to Provence villages and the Riviera."),
    P("SPZ", "Florence/Pisa (La Spezia), Italy", "Italy", 44.1, 9.82, "city", "Cinque Terre, Pisa's tower and Florence's art."),
    P("NAP", "Naples, Italy", "Italy", 40.84, 14.25, "city", "Pompeii, the Amalfi Coast and real Neapolitan pizza."),
    P("SANT", "Santorini, Greece", "Greece", 36.42, 25.43, "beach", "Whitewashed Oia and volcanic caldera views (tender port)."),
    P("MYK", "Mykonos, Greece", "Greece", 37.45, 25.33, "beach", "Windmills, Little Venice and beach clubs."),
    P("ATH", "Athens (Piraeus), Greece", "Greece", 37.94, 23.64, "city", "The Acropolis and Plaka district."),
    P("KOT", "Kotor, Montenegro", "Montenegro", 42.42, 18.77, "nature", "A walled medieval town at the end of a fjord-like bay."),
    P("MAL", "Málaga, Spain", "Spain", 36.71, -4.42, "city", "Picasso's birthplace and the Alhambra day trip."),
    P("TFS", "Tenerife, Canary Islands", "Spain", 28.47, -16.25, "nature", "Mount Teide volcano and black-sand beaches."),
    P("STV", "Stavanger, Norway", "Norway", 58.97, 5.73, "nature", "Hike toward Pulpit Rock above Lysefjord."),
    P("GEI", "Geiranger, Norway", "Norway", 62.1, 7.2, "scenic", "A UNESCO fjord with Seven Sisters waterfall."),
    P("ALE", "Ålesund, Norway", "Norway", 62.47, 6.15, "city", "Art Nouveau town on islands."),
    P("BGO", "Bergen, Norway", "Norway", 60.39, 5.32, "city", "Colorful Bryggen wharf and the Fløibanen funicular."),
    P("STO", "Stockholm, Sweden", "Sweden", 59.33, 18.07, "city", "Gamla Stan old town and the Vasa Museum."),
    P("HEL", "Helsinki, Finland", "Finland", 60.16, 24.95, "city", "Design District and Suomenlinna sea fortress."),
    P("TLL", "Tallinn, Estonia", "Estonia", 59.44, 24.77, "city", "One of Europe's best-preserved medieval old towns."),
    P("WAR", "Berlin (Warnemünde), Germany", "Germany", 54.18, 12.09, "city", "Seaside town and a long day trip to Berlin."),
    // Asia and the Pacific
    P("PKL", "Kuala Lumpur (Port Klang), Malaysia", "Malaysia", 2.99, 101.39, "city", "Petronas Towers and Batu Caves."),
    P("PEN", "Penang, Malaysia", "Malaysia", 5.41, 100.34, "city", "George Town street art and legendary street food."),
    P("PKT", "Phuket, Thailand", "Thailand", 7.88, 98.39, "beach", "Phang Nga Bay limestone islands (tender port)."),
    P("MRT", "Moreton Island, Australia", "Australia", -27.2, 153.4, "beach", "Sand dunes, shipwreck snorkeling and dolphins."),
    P("NOU", "Nouméa, New Caledonia", "New Caledonia", -22.27, 166.44, "city", "French Pacific capital with lagoon beaches."),
    P("LIF", "Lifou, New Caledonia", "New Caledonia", -20.92, 167.24, "beach", "Untouched beaches and coral reefs (tender port)."),
    P("MYS", "Mystery Island, Vanuatu", "Vanuatu", -20.25, 169.78, "beach", "A tiny uninhabited island with superb snorkeling."),
    // Panama Canal route
    P("CTG", "Cartagena, Colombia", "Colombia", 10.4, -75.53, "city", "Walled colonial city with colorful balconies."),
    P("PAN", "Panama Canal transit", "Panama", 9.08, -79.68, "scenic", "A full-day passage through the canal's locks.", { scenic: true }),
    P("PNT", "Puntarenas, Costa Rica", "Costa Rica", 9.97, -84.83, "nature", "Cloud forests, wildlife and hanging bridges."),
  ];

  CF.DATA.ports = Object.fromEntries(list.map((p) => [p.id, p]));

  // Sample excursions by port type. Prices are sample estimates per person in cents (adult / child under 12).
  CF.DATA.excursionTemplates = {
    beach: [
      { id: "snorkel", name: "Snorkel and beach break", adult: 7900, child: 5900, hours: 4 },
      { id: "beachclub", name: "Beach club day pass with lunch", adult: 9900, child: 6900, hours: 5 },
      { id: "catamaran", name: "Catamaran sail and swim", adult: 11900, child: 8900, hours: 4 },
    ],
    city: [
      { id: "walk", name: "Guided walking tour", adult: 5900, child: 3900, hours: 3 },
      { id: "highlights", name: "City highlights by coach", adult: 8900, child: 6400, hours: 5 },
      { id: "food", name: "Food tasting tour", adult: 10900, child: 7900, hours: 4 },
    ],
    nature: [
      { id: "eco", name: "Rainforest or nature reserve hike", adult: 8900, child: 6400, hours: 4 },
      { id: "zip", name: "Zip line adventure", adult: 12900, child: 10900, hours: 4 },
      { id: "ruins", name: "Historic site and scenic drive", adult: 9900, child: 7400, hours: 6 },
    ],
    glacier: [
      { id: "whales", name: "Whale watching cruise", adult: 17900, child: 11900, hours: 4 },
      { id: "glacierwalk", name: "Glacier visitor center and trails", adult: 8900, child: 6400, hours: 3 },
      { id: "heli", name: "Helicopter glacier landing", adult: 49900, child: 49900, hours: 3 },
    ],
    private: [
      { id: "waterpark", name: "Waterpark day pass", adult: 9900, child: 8900, hours: 6 },
      { id: "beachclub", name: "Beach club day pass", adult: 14900, child: 0, hours: 6, adultsOnly: true },
      { id: "cabana", name: "Share of a beach cabana (per guest)", adult: 12500, child: 12500, hours: 7 },
    ],
  };
})();
