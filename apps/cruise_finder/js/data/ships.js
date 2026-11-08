/* Ship classes and ships.
 * Ship facts (year, tonnage, guests at double occupancy, crew, decks) are approximate figures compiled from
 * public information and shown in the app as "approximate". Dining and venue lists are representative and vary
 * by ship and over time. Check royalcaribbean.com before booking. */
(function () {
  "use strict";
  const CF = window.CF;
  CF.DATA = CF.DATA || {};

  // Specialty and included restaurants. price = sample per-person cover charge in cents (specialty only).
  CF.DATA.restaurants = {
    mdr: { name: "Main Dining Room", included: true, desc: "Multi-course dinners. Choose traditional set times or My Time Dining." },
    wj: { name: "Windjammer Marketplace", included: true, desc: "Buffet for breakfast, lunch and dinner." },
    cafe: { name: "Café Promenade", included: true, desc: "Pastries, sandwiches and snacks around the clock." },
    sorrentos: { name: "Sorrento's", included: true, desc: "Pizza by the slice." },
    elloco: { name: "El Loco Fresh", included: true, desc: "Tacos and burritos by the pool." },
    parkcafe: { name: "Park Café", included: true, desc: "Deli sandwiches and salads in Central Park." },
    surfside: { name: "Surfside Eatery", included: true, desc: "Family-friendly casual dining." },
    aquadome: { name: "AquaDome Market", included: true, desc: "Food hall with several counters." },
    chops: { name: "Chops Grille", included: false, price: 6500, desc: "Steakhouse." },
    giovannis: { name: "Giovanni's Italian Kitchen", included: false, price: 4500, desc: "Family-style Italian." },
    izumi: { name: "Izumi Hibachi & Sushi", included: false, price: 5000, desc: "Teppanyaki show cooking and sushi (sushi priced à la carte)." },
    hooked: { name: "Hooked Seafood", included: false, price: 5000, desc: "Seafood and raw bar." },
    wonderland: { name: "Wonderland", included: false, price: 6500, desc: "Whimsical small plates." },
    central150: { name: "150 Central Park", included: false, price: 6500, desc: "Seasonal chef's menu." },
    empire: { name: "Empire Supper Club", included: false, price: 20000, desc: "Eight-course dinner with live jazz." },
    samba: { name: "Samba Grill", included: false, price: 5500, desc: "Brazilian churrascaria." },
    rockets: { name: "Johnny Rockets", included: false, price: 1500, desc: "Diner burgers and shakes (fee per person)." },
    chefstable: { name: "Chef's Table", included: false, price: 13000, desc: "Five-course paired dinner, limited seats." },
    jamies: { name: "Giovanni's Table", included: false, price: 4000, desc: "Trattoria-style Italian." },
  };

  const C = CF.DATA;
  C.classes = {
    icon: {
      name: "Icon Class", size: 1, decks: 20, lengthFt: 1198, crew: 2350,
      tagline: "The newest and largest ships in the fleet.",
      restaurants: ["mdr", "wj", "aquadome", "surfside", "elloco", "sorrentos", "parkcafe", "chops", "giovannis", "izumi", "hooked", "empire", "samba", "chefstable"],
      pools: ["Category 6 waterpark with six slides", "Seven pools including an infinity pool", "Chill Island pool deck", "Surfside family pools and splash zone", "Adults-only Cloud 17 pool"],
      activities: ["Crown's Edge ropes course", "FlowRider surf simulator", "Rock-climbing wall", "Mini-golf", "Adventure Ocean kids club", "Arcade and teen zone"],
      entertainment: ["Main theater Broadway-style musical", "AquaDome aqua shows", "Absolute Zero ice shows", "Comedy club", "Live music venues", "Casino"],
      amenities: ["AquaDome glass-dome neighborhood", "Central Park garden", "Royal Promenade", "Vitality Spa and fitness center", "Family suites", "Starlink Wi-Fi"],
      suites: ["JS", "GS", "OWN", "RLS"], vbal: true,
    },
    oasis: {
      name: "Oasis Class", size: 2, decks: 18, lengthFt: 1188, crew: 2200,
      tagline: "Giant ships with seven neighborhoods, from Central Park to the Boardwalk.",
      restaurants: ["mdr", "wj", "cafe", "sorrentos", "elloco", "parkcafe", "chops", "giovannis", "izumi", "hooked", "wonderland", "central150", "rockets", "samba"],
      pools: ["Waterslides (varies by ship)", "Main pool deck and sports pool", "Adults-only Solarium", "Splashaway Bay kids aqua park"],
      activities: ["Ultimate Abyss dry slide", "Two FlowRider surf simulators", "Zip line", "Rock-climbing walls", "Mini-golf", "Laser tag (most ships)"],
      entertainment: ["Broadway-style musical", "AquaTheater high-dive shows", "Ice shows", "Comedy club", "Jazz club", "Casino"],
      amenities: ["Central Park with live plants", "Boardwalk with carousel", "Royal Promenade", "Vitality Spa", "Starlink Wi-Fi"],
      suites: ["JS", "GS", "OWN", "RLS"], vbal: true,
    },
    quantumUltra: {
      name: "Quantum Ultra Class", size: 3, decks: 16, lengthFt: 1139, crew: 1550,
      tagline: "Tech-forward ships with sky-high views and indoor activity spaces.",
      restaurants: ["mdr", "wj", "cafe", "sorrentos", "elloco", "chops", "giovannis", "izumi", "hooked", "wonderland", "samba", "rockets"],
      pools: ["Indoor/outdoor Solarium pool (adults only)", "Main pool deck", "Splashaway Bay kids aqua park"],
      activities: ["North Star observation capsule", "RipCord by iFLY skydiving simulator", "FlowRider", "SeaPlex: bumper cars, roller skating, sports court"],
      entertainment: ["Two70 venue with digital shows", "Production theater", "Comedy and live music", "Casino"],
      amenities: ["Two70 lounge with panoramic windows", "Vitality Spa", "Virtual balconies on inside staterooms", "Starlink Wi-Fi"],
      suites: ["JS", "GS", "OWN"], vbal: true,
    },
    quantum: {
      name: "Quantum Class", size: 3, decks: 16, lengthFt: 1141, crew: 1500,
      tagline: "Sleek ships with skydiving, bumper cars and the North Star.",
      restaurants: ["mdr", "wj", "cafe", "sorrentos", "chops", "giovannis", "izumi", "wonderland", "rockets"],
      pools: ["Indoor/outdoor Solarium pool (adults only)", "Main pool deck", "Kids splash zone"],
      activities: ["North Star observation capsule", "RipCord by iFLY skydiving simulator", "FlowRider", "SeaPlex: bumper cars, roller skating"],
      entertainment: ["Two70 digital shows", "Production theater", "Live music", "Casino"],
      amenities: ["Two70 lounge", "Vitality Spa", "Virtual balconies on inside staterooms", "Starlink Wi-Fi"],
      suites: ["JS", "GS", "OWN"], vbal: true,
    },
    freedom: {
      name: "Freedom Class", size: 4, decks: 15, lengthFt: 1112, crew: 1360,
      tagline: "Big-ship energy with the Royal Promenade and FlowRider.",
      restaurants: ["mdr", "wj", "cafe", "sorrentos", "elloco", "chops", "giovannis", "izumi", "hooked", "rockets"],
      pools: ["Main pool deck with waterslides (varies by ship)", "Adults-only Solarium", "Splashaway Bay"],
      activities: ["FlowRider", "Rock-climbing wall", "Mini-golf", "Ice skating rink", "Sports court"],
      entertainment: ["Production shows", "Ice shows", "Comedy club", "Pub with live music", "Casino"],
      amenities: ["Royal Promenade", "Vitality Spa", "Starlink Wi-Fi"],
      suites: ["JS", "GS", "OWN"], vbal: false,
    },
    voyager: {
      name: "Voyager Class", size: 5, decks: 15, lengthFt: 1020, crew: 1180,
      tagline: "The original mega-ships, many refreshed with new slides and venues.",
      restaurants: ["mdr", "wj", "cafe", "sorrentos", "elloco", "chops", "giovannis", "izumi", "rockets"],
      pools: ["Main pool deck (waterslides on refreshed ships)", "Adults-only Solarium", "Kids splash zone"],
      activities: ["Rock-climbing wall", "Mini-golf", "Ice skating rink", "Sports court", "FlowRider (most ships)"],
      entertainment: ["Production shows", "Ice shows", "Lounges with live music", "Casino"],
      amenities: ["Royal Promenade", "Vitality Spa", "Starlink Wi-Fi"],
      suites: ["JS", "GS", "OWN"], vbal: false,
    },
    radiance: {
      name: "Radiance Class", size: 6, decks: 13, lengthFt: 962, crew: 860,
      tagline: "Glass-walled ships built for scenery, a favorite for Alaska.",
      restaurants: ["mdr", "wj", "cafe", "chops", "giovannis", "izumi", "chefstable"],
      pools: ["Main pool", "Adults-only Solarium"],
      activities: ["Rock-climbing wall", "Mini-golf", "Sports court"],
      entertainment: ["Theater shows", "Lounges with live music", "Casino"],
      amenities: ["Floor-to-ceiling glass walls", "Centrum atrium", "Vitality Spa", "Starlink Wi-Fi"],
      suites: ["JS", "GS", "OWN"], vbal: false,
    },
    vision: {
      name: "Vision Class", size: 7, decks: 11, lengthFt: 915, crew: 770,
      tagline: "Smaller, relaxed ships with lots of glass and sea views.",
      restaurants: ["mdr", "wj", "cafe", "chops", "giovannis", "izumi"],
      pools: ["Main pool", "Adults-only Solarium"],
      activities: ["Rock-climbing wall", "Sports court", "Fitness center"],
      entertainment: ["Theater shows", "Lounges with live music", "Casino"],
      amenities: ["Centrum atrium", "Vitality Spa", "Starlink Wi-Fi"],
      suites: ["JS", "GS", "OWN"], vbal: false,
    },
  };

  // gt = gross tonnage, guests = double occupancy. refurb = most recent major refresh, where known.
  // hue = accent color used only by the app's own illustrations.
  C.ships = [
    { id: "icon", name: "Icon of the Seas", cls: "icon", year: 2024, gt: 250800, guests: 5610, hue: 196 },
    { id: "star", name: "Star of the Seas", cls: "icon", year: 2025, gt: 248663, guests: 5610, hue: 268 },
    { id: "legend", name: "Legend of the Seas", cls: "icon", year: 2026, gt: 250800, guests: 5610, hue: 340 },
    { id: "utopia", name: "Utopia of the Seas", cls: "oasis", year: 2024, gt: 236860, guests: 5668, hue: 28 },
    { id: "wonder", name: "Wonder of the Seas", cls: "oasis", year: 2022, gt: 236857, guests: 5734, hue: 160 },
    { id: "symphony", name: "Symphony of the Seas", cls: "oasis", year: 2018, gt: 228081, guests: 5518, hue: 210 },
    { id: "harmony", name: "Harmony of the Seas", cls: "oasis", year: 2016, gt: 226963, guests: 5479, hue: 12 },
    { id: "allure", name: "Allure of the Seas", cls: "oasis", year: 2010, refurb: 2020, gt: 225282, guests: 5484, hue: 300 },
    { id: "oasis", name: "Oasis of the Seas", cls: "oasis", year: 2009, refurb: 2019, gt: 226838, guests: 5602, hue: 140 },
    { id: "odyssey", name: "Odyssey of the Seas", cls: "quantumUltra", year: 2021, gt: 169300, guests: 4198, hue: 46 },
    { id: "spectrum", name: "Spectrum of the Seas", cls: "quantumUltra", year: 2019, gt: 169379, guests: 4246, hue: 320 },
    { id: "anthem", name: "Anthem of the Seas", cls: "quantum", year: 2015, gt: 168666, guests: 4180, hue: 220 },
    { id: "ovation", name: "Ovation of the Seas", cls: "quantum", year: 2016, gt: 168666, guests: 4180, hue: 0 },
    { id: "quantum", name: "Quantum of the Seas", cls: "quantum", year: 2014, gt: 168666, guests: 4180, hue: 250 },
    { id: "freedom", name: "Freedom of the Seas", cls: "freedom", year: 2006, refurb: 2020, gt: 156271, guests: 3926, hue: 4 },
    { id: "liberty", name: "Liberty of the Seas", cls: "freedom", year: 2007, gt: 155889, guests: 3956, hue: 200 },
    { id: "independence", name: "Independence of the Seas", cls: "freedom", year: 2008, refurb: 2018, gt: 155889, guests: 3858, hue: 230 },
    { id: "navigator", name: "Navigator of the Seas", cls: "voyager", year: 2002, refurb: 2019, gt: 139999, guests: 3386, hue: 190 },
    { id: "voyager", name: "Voyager of the Seas", cls: "voyager", year: 1999, refurb: 2019, gt: 138194, guests: 3602, hue: 30 },
    { id: "explorer", name: "Explorer of the Seas", cls: "voyager", year: 2000, gt: 137308, guests: 3286, hue: 120 },
    { id: "brilliance", name: "Brilliance of the Seas", cls: "radiance", year: 2002, gt: 90090, guests: 2142, hue: 180 },
    { id: "radiance", name: "Radiance of the Seas", cls: "radiance", year: 2001, gt: 90090, guests: 2143, hue: 50 },
    { id: "jewel", name: "Jewel of the Seas", cls: "radiance", year: 2004, gt: 90090, guests: 2191, hue: 280 },
    { id: "vision", name: "Vision of the Seas", cls: "vision", year: 1998, gt: 78340, guests: 2514, hue: 165 },
  ];
})();
