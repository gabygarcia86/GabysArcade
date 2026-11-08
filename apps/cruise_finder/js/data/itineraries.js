/* Itinerary templates and ship deployments for the built-in sample data set.
 * days[] lists one stop per day: day 1 is embarkation, the last entry is disembarkation, "sea" is a sea day.
 * Deployments are seasonal patterns. The generator in datasource.js lays them over the next 13 months, so the
 * sample schedule always starts in the near future. None of this is a real Royal Caribbean schedule. */
(function () {
  "use strict";
  const CF = window.CF;
  CF.DATA = CF.DATA || {};

  CF.DATA.destinations = [
    { id: "caribbean", name: "Caribbean (all)", group: "Caribbean", scene: "tropical", blurb: "Turquoise water, beaches and island hopping." },
    { id: "eastern", name: "Eastern Caribbean", group: "Caribbean", scene: "tropical", blurb: "St. Thomas, St. Maarten and Puerto Rico." },
    { id: "western", name: "Western Caribbean", group: "Caribbean", scene: "tropical", blurb: "Cozumel, Roatán, Jamaica and Grand Cayman." },
    { id: "southern", name: "Southern Caribbean", group: "Caribbean", scene: "tropical", blurb: "Aruba, Curaçao, Barbados and St. Lucia." },
    { id: "bahamas", name: "Bahamas", group: "Caribbean", scene: "tropical", blurb: "Quick getaways to Nassau and the out islands." },
    { id: "cococay", name: "Perfect Day at CocoCay", group: "Caribbean", scene: "island", blurb: "Royal Caribbean's private island." },
    { id: "mexico", name: "Mexico", group: "Americas", scene: "tropical", blurb: "Cozumel, Cabo, Puerto Vallarta and Ensenada." },
    { id: "bermuda", name: "Bermuda", group: "Americas", scene: "tropical", blurb: "Pink sand and an overnight stay." },
    { id: "alaska", name: "Alaska", group: "Americas", scene: "alaska", blurb: "Glaciers, whales and gold-rush towns." },
    { id: "panama", name: "Panama Canal", group: "Americas", scene: "canal", blurb: "Ocean to ocean through the canal's locks." },
    { id: "europe", name: "Europe (all)", group: "Europe", scene: "mediterranean", blurb: "History, food and a new country nearly every day." },
    { id: "mediterranean", name: "Mediterranean", group: "Europe", scene: "mediterranean", blurb: "Spain, France, Italy and the Greek Isles." },
    { id: "northern", name: "Northern Europe & Norway", group: "Europe", scene: "northern", blurb: "Fjords and Baltic capitals." },
    { id: "transatlantic", name: "Transatlantic", group: "Other", scene: "ocean", blurb: "Long crossings with lots of sea days, often great value per night." },
    { id: "asia", name: "Asia", group: "Other", scene: "asia", blurb: "Singapore, Malaysia and Thailand." },
    { id: "australia", name: "Australia & South Pacific", group: "Other", scene: "pacific", blurb: "Sydney, New Caledonia and Vanuatu." },
  ];
  // Umbrella destinations match any of their children.
  CF.DATA.destUmbrella = { caribbean: ["eastern", "western", "southern"], europe: ["mediterranean", "northern"] };

  const I = (id, label, dest, days, taxPP, extra) => ({ id, label, dest, days, taxPP, nights: days.length - 1, ...extra });
  const list = [
    I("bah3-mia", "Bahamas & Perfect Day", ["bahamas", "cococay"], ["MIA", "NAS", "COCO", "MIA"], 11500),
    I("bah4-mia", "Key West, Bahamas & Perfect Day", ["bahamas", "cococay"], ["MIA", "KEY", "NAS", "COCO", "MIA"], 13500),
    I("bah3-pcv", "Bahamas & Perfect Day", ["bahamas", "cococay"], ["PCV", "NAS", "COCO", "PCV"], 11000),
    I("bah4-pcv", "Bahamas & Perfect Day", ["bahamas", "cococay"], ["PCV", "sea", "NAS", "COCO", "PCV"], 12500),
    I("bah4-fll", "Bahamas & Perfect Day", ["bahamas", "cococay"], ["FLL", "NAS", "COCO", "sea", "FLL"], 12500),
    I("bah7-bay", "Bahamas & Perfect Day", ["bahamas", "cococay"], ["BAY", "sea", "sea", "NAS", "COCO", "sea", "sea", "BAY"], 17000),
    I("bah7-bal", "Bahamas & Perfect Day", ["bahamas", "cococay"], ["BAL", "sea", "sea", "COCO", "NAS", "sea", "sea", "BAL"], 17000),
    I("wc7-mia", "Western Caribbean & Perfect Day", ["western", "cococay", "mexico"], ["MIA", "sea", "COZ", "ROA", "CMA", "sea", "COCO", "MIA"], 16500),
    I("ec7-mia", "Eastern Caribbean & Perfect Day", ["eastern", "cococay"], ["MIA", "sea", "sea", "STT", "SXM", "sea", "COCO", "MIA"], 17500),
    I("wc7-pcv", "Western Caribbean & Perfect Day", ["western", "cococay", "mexico"], ["PCV", "COCO", "sea", "FAL", "GCM", "COZ", "sea", "PCV"], 16500),
    I("ec7-pcv", "Eastern Caribbean & Perfect Day", ["eastern", "cococay"], ["PCV", "sea", "sea", "SXM", "STT", "sea", "COCO", "PCV"], 17500),
    I("ec7-fll", "Eastern Caribbean & Perfect Day", ["eastern", "cococay"], ["FLL", "COCO", "sea", "SJU", "STT", "sea", "sea", "FLL"], 17000),
    I("wc7-fll", "Western Caribbean", ["western", "mexico"], ["FLL", "sea", "LAB", "FAL", "sea", "COZ", "sea", "FLL"], 16000),
    I("wc4-tpa", "Western Caribbean", ["western", "mexico"], ["TPA", "sea", "COZ", "sea", "TPA"], 11500),
    I("wc5-tpa", "Western Caribbean", ["western", "mexico"], ["TPA", "sea", "GCM", "COZ", "sea", "TPA"], 13000),
    I("wc7-tpa", "Western Caribbean", ["western", "mexico"], ["TPA", "sea", "GCM", "FAL", "sea", "COZ", "sea", "TPA"], 15500),
    I("wc4-gal", "Western Caribbean", ["western", "mexico"], ["GAL", "sea", "COZ", "sea", "GAL"], 11500),
    I("wc5-gal", "Western Caribbean", ["western", "mexico"], ["GAL", "sea", "PRO", "COZ", "sea", "GAL"], 13000),
    I("wc7-gal", "Western Caribbean", ["western", "mexico"], ["GAL", "sea", "sea", "ROA", "CMA", "COZ", "sea", "GAL"], 16000),
    I("sc7-sju", "Southern Caribbean", ["southern"], ["SJU", "STT", "STK", "ANT", "STL", "BAR", "sea", "SJU"], 17000),
    I("sc8-fll", "Southern Caribbean ABC Islands", ["southern"], ["FLL", "sea", "sea", "ARU", "CUR", "BON", "sea", "sea", "FLL"], 19000),
    I("sc12-fll", "Ultimate Southern Caribbean", ["southern", "eastern"], ["FLL", "sea", "sea", "SJU", "STT", "STK", "ANT", "STL", "BAR", "sea", "sea", "sea", "FLL"], 24000),
    I("ec9-bay", "Caribbean from New Jersey", ["eastern"], ["BAY", "sea", "sea", "sea", "SJU", "STT", "SXM", "sea", "sea", "BAY"], 21000),
    I("bda5-bay", "Bermuda", ["bermuda"], ["BAY", "sea", "BDA", "BDA", "sea", "BAY"], 14500, { overnight: ["BDA"] }),
    I("mex3-lax", "Catalina & Ensenada", ["mexico"], ["LAX", "CAT", "ENS", "LAX"], 9500),
    I("mex4-lax", "Catalina & Ensenada", ["mexico"], ["LAX", "CAT", "sea", "ENS", "LAX"], 11000),
    I("mex7-lax", "Mexican Riviera", ["mexico"], ["LAX", "sea", "sea", "PVR", "MZT", "CSL", "sea", "LAX"], 16000),
    I("alk7-sea", "Alaska Glaciers", ["alaska"], ["SEA", "sea", "JNU", "SKG", "END", "KTN", "VIC", "SEA"], 26000),
    I("alk7-yvr", "Alaska Inside Passage", ["alaska"], ["YVR", "sea", "KTN", "JNU", "SKG", "END", "sea", "YVR"], 25000),
    I("med7-bcn", "Western Mediterranean", ["mediterranean"], ["BCN", "PMI", "TLN", "SPZ", "CIV", "NAP", "sea", "BCN"], 19000),
    I("grk7-civ", "Greek Isles", ["mediterranean"], ["CIV", "NAP", "sea", "MYK", "ATH", "SANT", "sea", "CIV"], 19000),
    I("nor7-sou", "Norwegian Fjords", ["northern"], ["SOU", "sea", "STV", "GEI", "ALE", "BGO", "sea", "SOU"], 18000),
    I("balt7-cph", "Baltic Capitals", ["northern"], ["CPH", "sea", "STO", "HEL", "TLL", "sea", "WAR", "CPH"], 18000),
    I("asia4-sin", "Malaysia Getaway", ["asia"], ["SIN", "PKL", "PEN", "sea", "SIN"], 9000),
    I("asia5-sin", "Thailand & Malaysia", ["asia"], ["SIN", "sea", "PKT", "PEN", "sea", "SIN"], 10500),
    I("aus4-syd", "Moreton Island Getaway", ["australia"], ["SYD", "sea", "MRT", "sea", "SYD"], 12000),
    I("sp8-syd", "South Pacific", ["australia"], ["SYD", "sea", "sea", "NOU", "MYS", "LIF", "sea", "sea", "SYD"], 18000),
    I("ta14-bcn-fll", "Transatlantic", ["transatlantic"], ["BCN", "PMI", "MAL", "sea", "TFS", "sea", "sea", "sea", "sea", "sea", "sea", "sea", "sea", "NAS", "FLL"], 21000, { oneWay: true }),
    I("pc15-fll-lax", "Panama Canal", ["panama", "mexico"], ["FLL", "sea", "sea", "CTG", "sea", "PAN", "sea", "PNT", "sea", "sea", "PVR", "sea", "CSL", "sea", "sea", "LAX"], 26000, { oneWay: true }),
  ];
  CF.DATA.itineraries = Object.fromEntries(list.map((it) => [it.id, it]));

  // Seasonal deployment patterns. months: [first, last] inclusive (wraps across New Year). dow: 0 = Sunday.
  const ALL = [1, 12], WINTER = [11, 4], SUMMER = [5, 10], ALASKA = [5, 9];
  CF.DATA.deployments = [
    { ship: "icon", months: ALL, dow: 6, cycle: ["wc7-mia", "ec7-mia"] },
    { ship: "star", months: ALL, dow: 0, cycle: ["ec7-pcv", "wc7-pcv"] },
    { ship: "legend", months: ALL, dow: 0, cycle: ["ec7-fll", "wc7-fll"] },
    { ship: "utopia", months: ALL, dow: 5, cycle: ["bah3-pcv", "bah4-pcv"] },
    { ship: "wonder", months: WINTER, dow: 0, cycle: ["ec7-mia", "wc7-mia"] },
    { ship: "wonder", months: SUMMER, dow: 0, cycle: ["med7-bcn"] },
    { ship: "symphony", months: ALL, dow: 5, cycle: ["bah3-mia", "bah4-mia"] },
    { ship: "harmony", months: ALL, dow: 0, cycle: ["wc7-gal"] },
    { ship: "allure", months: ALL, dow: 6, cycle: ["wc7-pcv", "ec7-pcv"] },
    { ship: "oasis", months: ALL, dow: 0, cycle: ["bah7-bay", "ec9-bay"] },
    { ship: "odyssey", months: WINTER, dow: 6, cycle: ["wc7-fll"] },
    { ship: "odyssey", months: SUMMER, dow: 6, cycle: ["grk7-civ"] },
    { ship: "spectrum", months: ALL, dow: 1, cycle: ["asia4-sin", "asia5-sin"] },
    { ship: "anthem", months: WINTER, dow: 1, cycle: ["bda5-bay", "bah7-bay"] },
    { ship: "anthem", months: SUMMER, dow: 6, cycle: ["nor7-sou"] },
    { ship: "ovation", months: [10, 4], dow: 0, cycle: ["mex7-lax"] },
    { ship: "ovation", months: ALASKA, dow: 5, cycle: ["alk7-sea"] },
    { ship: "quantum", months: ALL, dow: 1, cycle: ["sp8-syd", "aus4-syd"] },
    { ship: "freedom", months: ALL, dow: 0, cycle: ["sc7-sju"] },
    { ship: "liberty", months: ALL, dow: 4, cycle: ["wc4-gal", "wc5-gal"] },
    { ship: "independence", months: ALL, dow: 1, cycle: ["bah4-fll"] },
    { ship: "navigator", months: ALL, dow: 5, cycle: ["mex3-lax", "mex4-lax"] },
    { ship: "voyager", months: ALL, dow: 1, cycle: ["wc4-tpa", "wc5-tpa"] },
    { ship: "explorer", months: [11, 4], dow: 6, cycle: ["sc12-fll"] },
    { ship: "explorer", months: [5, 9], dow: 6, cycle: ["balt7-cph"] },
    { ship: "brilliance", months: ALL, dow: 0, cycle: ["wc7-tpa"], skip: [[4, 15], [5, 10]] },
    { ship: "radiance", months: ALASKA, dow: 1, cycle: ["alk7-yvr"] },
    { ship: "radiance", months: [10, 4], dow: 1, cycle: ["mex7-lax"] },
    { ship: "jewel", months: WINTER, dow: 6, cycle: ["sc8-fll"] },
    { ship: "jewel", months: SUMMER, dow: 6, cycle: ["med7-bcn"] },
    { ship: "vision", months: ALL, dow: 6, cycle: ["bah7-bal"] },
  ];
  // One-time repositioning sailings: month/day of departure, placed in the next occurrence inside the window.
  CF.DATA.oneOffs = [
    { ship: "explorer", it: "ta14-bcn-fll", month: 10, day: 14 },
    { ship: "brilliance", it: "pc15-fll-lax", month: 4, day: 18 },
  ];
})();
