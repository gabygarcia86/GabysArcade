/*
 * Gaby's Arcade catalog: the one file to edit when adding games or apps.
 * The README has step-by-step instructions; `node tools/check-catalog.mjs` validates this file.
 *
 * GAME FIELDS
 *   folder       Folder name inside games/. Also used as the game's unique id.
 *   title        Fallback only. The arcade shows the <title> from the game's index.html,
 *                and uses this value if that page can't be read.
 *   description  One or two sentences shown on the card. Searchable.
 *   category     Label and filter. New categories appear in the filter bar automatically.
 *   tags         Extra search words. Not displayed.
 *   added        Optional date as "YYYY-MM-DD". Leave it "" unless you know the real date.
 *                The "Recently added" sort appears once two or more games have a date.
 *   url, icon    Optional overrides. Defaults: games/<folder>/index.html and
 *                games/<folder>/icon/icon-256.png.
 *
 * COMING SOON
 *   A game is Coming Soon when the <title> in its index.html starts with "Coming Soon".
 *   Remove those words from the title to publish it.
 *
 * APP FIELDS
 *   Same as games, except `title` is what the arcade displays and the Coming Soon rule
 *   doesn't apply. Paths default to apps/<folder>/.
 */
window.ARCADE_CATALOG = {
  games: [
    {
      folder: "galactic_squadron",
      title: "Galactic Squadron",
      description:
        "An arcade space shooter with diving enemy squadrons and a capital-ship boss every seventh stage.",
      category: "Shooter",
      tags: [
        "space",
        "sci-fi",
        "retro",
        "boss battles",
        "leaderboard",
        "keyboard",
        "touch",
      ],
      added: "",
    },
    {
      folder: "galactic_squadron_racer",
      title: "Galactic Squadron Racer",
      description:
        "Pick a ship from the Galactic Squadron fleet and race three AI rivals on ten top-down circuits.",
      category: "Racing",
      tags: [
        "space",
        "sci-fi",
        "top-down",
        "drifting",
        "leaderboard",
        "keyboard",
        "gamepad",
        "touch",
      ],
      added: "",
    },
    {
      folder: "latke_toss",
      title: "Coming Soon - Latke Toss",
      description:
        "A 60-second 3D Hanukkah challenge. Toss as many latkes as you can into a pot of hot oil.",
      category: "Arcade",
      tags: ["holiday", "hanukkah", "3d", "timed", "leaderboard", "touch"],
      added: "",
    },
    {
      folder: "photo_scavenger_hunt_halloween",
      title: "Halloween Photo Scavenger Hunt",
      description:
        "A Halloween carnival photo scavenger hunt. Fill all ten spooky challenges with your own pictures.",
      category: "Real World",
      tags: [
        "halloween",
        "photo",
        "camera",
        "scavenger hunt",
        "family",
        "mobile",
      ],
      added: "",
    },
    {
      folder: "photo_scavenger_hunt_park",
      title: "Parks & Playgrounds Photo Scavenger Hunt",
      description:
        "Head to a park or playground and take on ten outdoor photo challenges.",
      category: "Real World",
      tags: [
        "outdoors",
        "park",
        "playground",
        "photo",
        "camera",
        "scavenger hunt",
        "family",
        "mobile",
      ],
      added: "",
    },
    {
      folder: "pumpkin_smash_AR",
      title: "Coming Soon - Pumpkin Smash — AR Halloween Hunt",
      description:
        "A mobile AR Halloween hunt. Explore your surroundings to find and smash five hidden pumpkins.",
      category: "Real World",
      tags: [
        "halloween",
        "ar",
        "augmented reality",
        "camera",
        "demo mode",
        "3d",
        "mobile",
      ],
      added: "",
    },
    {
      folder: "skateboard_ninjas",
      title: "Skateboard Ninjas",
      description:
        "A 60-second side-scrolling skate run. Ollie, flip, grab and grind while dodging angry Karens.",
      category: "Arcade",
      tags: [
        "skateboarding",
        "ninja",
        "timed",
        "leaderboard",
        "side-scroller",
        "touch",
      ],
      added: "",
    },
    {
      folder: "skateboard_ninjas_2",
      title: "Skateboard Ninjas 2 : Downhill Jam",
      description:
        "An endless 3D downhill runner. Grind rails and throw ninja stars at Karens and rival ninjas.",
      category: "Arcade",
      tags: [
        "skateboarding",
        "ninja",
        "endless runner",
        "3d",
        "customization",
        "leaderboard",
        "touch",
      ],
      added: "",
    },
    {
      folder: "skyline_slinger",
      title: "Skyline Slinger",
      description:
        "Swing from rooftop to rooftop through a bright city, scoop up stars, and see how far you can fly.",
      category: "Arcade",
      tags: ["swinging", "city", "web-slinging", "timed", "leaderboard", "touch"],
      added: "",
    },
    {
      folder: "stack_attack",
      title: "Stack Attack",
      description:
        "A retro falling-block puzzle game with 17 themes. Stack and clear lines as gravity speeds up.",
      category: "Puzzle",
      tags: [
        "blocks",
        "falling blocks",
        "retro",
        "themes",
        "keyboard",
        "touch", "leaderboard"],
      added: "",
    },
    {
      folder: "touch_the_beat",
      title: "Touch the Beat",
      description:
        "A neon four-lane rhythm game built for phones. Tap each lane as its note crosses the pad.",
      category: "Rhythm",
      tags: [
        "music",
        "neon",
        "songs",
        "import songs",
        "tapping",
        "touch",
        "keyboard",
        "leaderboard",
      ],
      added: "",
    },
  ],

  apps: [
    {
      folder: "drawing_studio",
      title: "Drawing Studio",
      description:
        "Draw, fill and erase on a simple canvas with brush sizes and a color palette, then save your picture.",
      category: "Creativity",
      tags: ["art", "drawing", "painting", "kids"],
      added: "",
    },
  ],
};
