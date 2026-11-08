/* Reference rates and booking rules used by the pricing engine.
 *
 * Every value here is either a SAMPLE figure (made up for demonstration) or a REFERENCE figure (a typical published
 * rate that changes often). The app labels them that way and lets an administrator override them. Royal Caribbean
 * prices most packages dynamically by sailing, so a confirmed price only comes from royalcaribbean.com or an
 * authorized booking source. */
(function () {
  "use strict";
  const CF = window.CF;
  CF.DATA = CF.DATA || {};

  CF.DATA.categories = {
    INT: { name: "Interior", short: "Interior", order: 1, maxOcc: 4, sqft: "150-170", suite: false, desc: "No window. Usually the lowest fare." },
    VBAL: { name: "Virtual Balcony", short: "Virtual Balcony", order: 2, maxOcc: 4, sqft: "150-170", suite: false, desc: "Interior room with a floor-to-ceiling screen showing a live view outside.", needsVbal: true },
    OV: { name: "Ocean View", short: "Ocean View", order: 3, maxOcc: 4, sqft: "160-180", suite: false, desc: "A window or porthole, no balcony." },
    BAL: { name: "Balcony", short: "Balcony", order: 4, maxOcc: 4, sqft: "180-200 + balcony", suite: false, desc: "Private veranda with outdoor seating." },
    JS: { name: "Junior Suite", short: "Jr. Suite", order: 5, maxOcc: 4, sqft: "280-300 + balcony", suite: true, desc: "More space, a bathtub and a larger balcony." },
    GS: { name: "Grand Suite", short: "Grand Suite", order: 6, maxOcc: 6, sqft: "350-400 + balcony", suite: true, desc: "Separate living area plus suite perks." },
    OWN: { name: "Owner's Suite", short: "Owner's", order: 7, maxOcc: 6, sqft: "500-600 + balcony", suite: true, desc: "Large suite with a dining area and full suite perks." },
    RLS: { name: "Royal Loft Suite", short: "Royal Loft", order: 8, maxOcc: 6, sqft: "1,500+ two-level", suite: true, desc: "Two-level loft with a huge balcony and top-tier perks." },
  };

  CF.DATA.beverage = {
    none: { name: "No beverage package", desc: "Pay for drinks as you go. Water, basic coffee, tea, lemonade and iced tea are included." },
    soda: { name: "Classic Soda Package", desc: "Unlimited fountain soft drinks in a souvenir cup.", factor: 0.2, minAge: 0 },
    refresh: { name: "Refreshment Package", desc: "Specialty coffees, juices, mocktails, bottled water and soda. No alcohol.", factor: 0.55, minAge: 0 },
    deluxe: { name: "Deluxe Beverage Package", desc: "Cocktails, beer and wine (up to a per-drink price limit) plus everything in the Refreshment Package.", factor: 1, minAge: 21 },
  };

  // Reference rules. Shown to the user next to the line they affect.
  CF.DATA.rules = {
    deluxeAllAdults: "Royal Caribbean's published policy: if one guest aged 21 or older in a stateroom buys the Deluxe Beverage Package, every guest 21+ in that stateroom must buy it too.",
    deluxeAge: "The Deluxe Beverage Package includes alcohol, so it's only for guests 21 and older on sailings from U.S. ports.",
    packageWholeCruise: "Beverage and dining packages are priced per day and must cover every day of the cruise.",
    adultPerRoom: "At least one guest in each stateroom must be 21 or older (Royal Caribbean allows a few exceptions, such as married couples and active military).",
    infantAge: "Infants must be at least 6 months old on sailing day (12 months for some longer sailings and transatlantic crossings).",
    gratuities: "Daily gratuities are added to your onboard account automatically unless you prepay them. Prepaying doesn't change the amount; it only changes when you pay.",
    myTime: "My Time Dining has historically required prepaid gratuities. Check the current policy when booking.",
    requests: "Deck, location, connecting and accessible stateroom choices are requests until Royal Caribbean confirms a specific stateroom.",
    noInventory: "This data set has no live stateroom inventory, so the app never shows a specific stateroom as available. Choose a guarantee or a category; Royal Caribbean assigns or confirms the room.",
  };

  // Default reference rates (cents). Editable in Admin > Pricing & rates; overrides are labelled as such.
  CF.DATA.referenceRates = {
    asOf: "2026-11-01",
    gratuityStd: 1850, // per guest per night, non-suite
    gratuitySuite: 2100, // per guest per night, suites
    gratuityKids: true, // gratuities apply to children too
    serviceChargePct: 18, // added to beverage and dining packages
    deluxeBase: 7900, // sample base for Deluxe per person per day, scaled per ship and sailing
    internetOne: 2299, // per device per day, one device
    internetMulti: 1899, // per device per day when buying a multi-device plan (2-4 devices)
    udpBase: 5200, // Unlimited Dining Package base per person per day
    dining3: 14900, // 3-night specialty dining package per person
    transferEach: 3000, // airport transfer per person, each way
    insurancePct: 7, // travel protection estimate, % of cruise fare + taxes
    depositShort: 10000, // per guest, 5 nights or fewer
    depositLong: 25000, // per guest, 6+ nights
    depositSuite: 50000, // per guest, Grand Suite and above
    finalDaysShort: 75, // final payment due this many days before sailing (1-4 nights)
    finalDaysLong: 90, // 5+ nights
  };

  // Approximate display-only exchange rates from USD. Editable in Admin.
  CF.DATA.currencies = {
    asOf: "2026-11-01",
    rates: { USD: 1, CAD: 1.38, GBP: 0.77, EUR: 0.88, AUD: 1.52, MXN: 18.4 },
  };

  CF.DATA.line = {
    id: "rci",
    name: "Royal Caribbean International",
    bookingUrl: "https://www.royalcaribbean.com/cruises",
  };
})();
