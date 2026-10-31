# Gaby's Arcade

**A playground for imagination!** A free collection of HTML5 games and apps with no logins, no ads and no microtransactions.

Live site: <https://gabygarcia86.github.io/GabysArcade/>

It's a static site with no framework and no build step. Edit a file, push, and the change goes live.

## Contents

- [Folder structure](#folder-structure)
- [How the site works](#how-the-site-works)
- [Preview locally](#preview-locally)
- [Publish to GitHub Pages](#publish-to-github-pages)
- [Add a new game](#add-a-new-game)
- [Update a game's title, description, category or tags](#update-a-games-title-description-category-or-tags)
- [Add or update a thumbnail](#add-or-update-a-thumbnail)
- [Add a new app](#add-a-new-app)
- [Coming Soon games](#coming-soon-games)
- [Favorites](#favorites)
- [Contact forms](#contact-forms)
- [Replace the About portrait and biography](#replace-the-about-portrait-and-biography)
- [Branding, colors and metadata](#branding-colors-and-metadata)
- [Troubleshooting](#troubleshooting)

## Folder structure

```text
GabysArcade/
├── index.html            Home: hero, favorites, library, Coming Soon
├── games.html            All public games
├── apps.html             All apps
├── contact.html          Contact forms
├── about.html            About page (your text lives here)
├── 404.html, 404.*       "Page not found" page
├── sitemap.xml           Page list for search engines
├── .nojekyll             Tells GitHub Pages to serve files exactly as they are
├── data/
│   ├── catalog.js        ★ Every game and app. This is the file you'll edit most
│   └── site-config.js    ★ Contact form address and Coming Soon PIN hash
├── assets/
│   ├── css/site.css      All styling. Brand colors are at the top
│   ├── fonts/            Oxanium and Sora, with their licenses
│   └── js/
│       ├── core.js                Loads the catalog, reads game titles, stores favorites
│       ├── layout.js              Header, navigation, footer and disclaimer
│       ├── arcade.js              Cards, search, filters, sorting, PIN dialog
│       ├── contact.js             Contact form validation and sending
│       └── coming-soon-guard.js   Blocks direct links to Coming Soon games
├── tools/
│   ├── check-catalog.mjs  Finds catalog mistakes before you publish
│   └── hash-pin.mjs       Generates a new PIN hash
├── icon/                 Site logo and favicons
├── images/               Site images, including the About portrait
├── games/<game>/         Each game: index.html plus icon/icon-256.png
└── apps/<app>/           Each app: index.html plus icon/icon-256.png
```

## How the site works

- **The catalog is the single list of games and apps.** `data/catalog.js` holds the metadata, and cards are generated from it. No card is written by hand in the HTML.
- **Each game's `<title>` sets its name and status.** When a page loads, the site reads the `<title>` from every game's `index.html`. If the title starts with `Coming Soon`, the game goes in the Coming Soon section. Otherwise it's public.
- **Every folder still needs a catalog entry.** A browser can't list the folders on GitHub Pages, so a new folder won't appear on its own. `node tools/check-catalog.mjs` warns you if you forget one.
- **All paths are relative**, so the site works at `/GabysArcade/`, at a custom domain, or on your own computer.

## Preview locally

From the repository root, start any static server:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>. The VS Code **Live Server** extension or `npx serve .` also work.

Double-clicking `index.html` opens the site too, with two limits: browsers won't let a `file://` page read each game's title, so the site falls back to the `title` in the catalog, and games built with ES modules won't run. Use a server when you're testing games.

Before publishing, run the catalog check (this needs [Node.js](https://nodejs.org)):

```bash
node tools/check-catalog.mjs
```

It reports missing folders, icons, descriptions and Coming Soon guards, and flags titles that don't match. Folder names are checked with exact capitals, because GitHub Pages is case-sensitive even though Windows isn't.

## Publish to GitHub Pages

The site publishes straight from the repository:

```bash
git add .
git commit -m "Describe your change"
git push
```

In the repository on GitHub, **Settings → Pages** should show **Deploy from a branch**, with `main` and `/ (root)` selected. Deployment usually takes a minute or two. GitHub can cache files for about ten minutes, so hard refresh (Ctrl+F5) if you still see the old version.

## Add a new game

1. Create the folder and add the game's files, with its start page and thumbnail in these places:

   ```text
   games/space_llamas/
   ├── index.html          with <title>Space Llamas</title>
   └── icon/icon-256.png   256 × 256 thumbnail
   ```

2. Add one entry to the `games` list in `data/catalog.js`:

   ```js
   {
     folder: "space_llamas",
     title: "Space Llamas",
     description: "Herd llamas through an asteroid field before the oxygen runs out.",
     category: "Arcade",
     tags: ["space", "llamas", "touch"],
     added: "2026-11-15",
   },
   ```

3. Run `node tools/check-catalog.mjs`, preview, and push.

The game appears with its title, description, thumbnail and category. A new `category` value creates its own filter automatically.

| Field | Required | What it does |
| --- | --- | --- |
| `folder` | Yes | Folder name inside `games/`, with exact capitals. Also the game's unique ID, so renaming it resets that game's favorites |
| `title` | Yes | Backup name, used only if the game's `<title>` can't be read. Keep it the same as the `<title>` |
| `description` | Yes | Card text, also searchable. About 100 characters fits best |
| `category` | Yes | Card label and filter |
| `tags` | No | Extra search words, not displayed |
| `added` | No | Real date as `YYYY-MM-DD`. Leave `""` if you don't know it |
| `url` | No | Only if the start page isn't `games/<folder>/index.html` |
| `icon` | No | Only if the thumbnail isn't `games/<folder>/icon/icon-256.png` |

**About "Recently added":** this sort option stays hidden until at least two games have an `added` date. All current games are blank because Git only shows when they were copied into this repository, not when they were made. Fill in real dates if you want the option.

## Update a game's title, description, category or tags

- **Title:** change the `<title>` in the game's `index.html`, and update `title` in `data/catalog.js` to match.
- **Description, category or tags:** edit the entry in `data/catalog.js`.

## Add or update a thumbnail

Save a square PNG as `games/<folder>/icon/icon-256.png`, replacing the old file. 256 × 256 is the expected size.

If an icon is missing, the card shows the game's first letter instead of a broken image, and the catalog check warns you. To use a different file, set `icon` in the catalog entry:

```js
icon: "games/space_llamas/art/cover.png",
```

## Add a new app

Apps work like games, using the `apps` list in `data/catalog.js`:

```js
{
  folder: "pixel_painter",
  title: "Pixel Painter",
  description: "Draw pixel art and save it as an image.",
  category: "Creativity",
  tags: ["art", "pixels"],
  added: "",
},
```

Put the files in `apps/pixel_painter/`, with `index.html` and `icon/icon-256.png`. Two differences from games: an app's displayed name comes from the catalog `title`, not from its `<title>` tag, and the Coming Soon rule doesn't apply.

## Coming Soon games

A game is Coming Soon whenever the `<title>` in its `index.html` starts with `Coming Soon`. Capitals don't matter. Coming Soon cards show only the icon and a Coming Soon tag, with no name or description. Both appear automatically once the game is published, without the `Coming Soon` words.

### Add a Coming Soon game

1. Follow [Add a new game](#add-a-new-game), but give it a Coming Soon title in both places:

   ```html
   <title>Coming Soon - Space Llamas</title>
   ```

   ```js
   title: "Coming Soon - Space Llamas",
   ```

2. Add this line to the game's `<head>`, **right after the `<title>`**. It sends anyone who opens the game's URL directly back to the arcade:

   ```html
   <script src="../../assets/js/coming-soon-guard.js"></script>
   ```

3. Run `node tools/check-catalog.mjs`, which reports an error if the guard is missing, then push.

### Test a Coming Soon game on the live site

Click its card on the Home page and enter the PIN. The game opens in the same tab, and that browser can reopen or refresh it for the next 12 hours. Clicking the card always asks for the PIN again.

### Update a Coming Soon game

Edit its files and push. Nothing else changes.

### Move a game from Coming Soon to the public library

1. Remove `Coming Soon` from the `<title>` in the game's `index.html`:

   ```diff
   - <title>Coming Soon - Latke Toss</title>
   + <title>Latke Toss</title>
   ```

2. Make the same change to `title` in `data/catalog.js`. The live site doesn't need this, but it keeps the backup name correct, and the catalog check will warn you otherwise.
3. Optional: delete the `coming-soon-guard.js` line. It switches itself off when the title changes, so leaving it in is harmless.
4. Optional: set `added` to today's date.
5. Run `node tools/check-catalog.mjs`, then push.

To move a game back, put `Coming Soon` back in both titles and make sure the guard line is there.

### Change the PIN

```bash
node tools/hash-pin.mjs 1234
```

Paste the result into `comingSoonPinHash` in `data/site-config.js`.

### How secure is the PIN?

It keeps casual visitors out, but it isn't real security. GitHub Pages can't check a password on a server, so everything happens in the browser. The game's files are publicly available, and anyone determined can read them from the repository or get around the guard. The PIN is stored as a hash so it isn't readable at a glance, but a 4-digit PIN can still be worked out from its hash in moments. Don't rely on it to protect anything sensitive.

## Favorites

Each star saves the game's `folder` value to the browser's `localStorage` under the key `gabysArcade.favorites`.

- There's no account or server. Favorites stay in that browser on that device, and other open arcade tabs update automatically.
- They're lost if the visitor clears site data, and private windows may not keep them.
- Coming Soon games have no star. If a favorite is moved back to Coming Soon, it stops showing until it's public again.

## Contact forms

GitHub Pages only serves files, so it can't send email. The forms post to [Formspree](https://formspree.io), a hosted form service that emails each submission to you. It was chosen because it accepts submissions from static sites, needs no server code, and keeps your email address out of the website's code. The form address isn't a secret, so it's safe to commit.

**The forms aren't connected yet.** Until they are, the Contact page shows a notice, and submitting tells the visitor nothing was sent.

### Connect the forms

1. Create a Formspree account using the email address that should receive messages, and confirm it. That address stays in your Formspree account and never appears on the site, so keep it out of this repository too.
2. Create a new form and copy its address, which looks like `https://formspree.io/f/abcdwxyz`.
3. Paste it into `data/site-config.js`:

   ```js
   contactFormEndpoint: "https://formspree.io/f/abcdwxyz",
   ```

4. Push, then send a test comment **and** a test bug report from the live site, and confirm that both emails arrive.

If a test shows "Your message was not sent", look at the form's settings in Formspree. The site sends messages with JavaScript, so a CAPTCHA that needs its own page can get in the way. If yours is on, turn it off for this form and test again. The forms already include Formspree's hidden `_gotcha` spam trap. Check [Formspree's pricing page](https://formspree.io/plans) for the current monthly limit on your plan.

### What gets sent

| Form | Fields |
| --- | --- |
| General Comments | Form type, Game, Message |
| Report a Bug / Issue | Form type, Game, Device, Browser, Issue description |

The Game list is built from the public games and apps in the catalog, plus "The website itself" and "A game not listed here".

The success message only appears after the service confirms it received the submission. On any failure, the visitor is told the message was not sent and their text stays in the form. The button is disabled while sending, which prevents duplicates.

To use a different service, change `contactFormEndpoint` and, if that service expects different field names, update `send()` in `assets/js/contact.js`.

## Replace the About portrait and biography

- **Portrait:** replace `images/AboutMe_ProfilePic.jpg`, keeping the file name. A square image works best; if yours isn't, update `width` and `height` on the `<img>` in `about.html`. Update its `alt` text if the picture changes.
- **Biography:** edit the text directly in `about.html`, inside `<div class="about-copy">`.

## Branding, colors and metadata

| To change | Edit |
| --- | --- |
| Colors and fonts | The `:root` block at the top of `assets/css/site.css`. Dark mode is the only theme |
| Logo and favicons | The files in `icon/`, keeping the same names |
| Name in the header and footer | `brand` in `assets/js/layout.js` |
| Navigation links | `NAV_ITEMS` in `assets/js/layout.js` |
| Footer disclaimer | `DISCLAIMER` in `assets/js/layout.js` |
| Hero message | `index.html` |
| Page titles, descriptions, social sharing | The `<head>` of each page |
| Browser theme color | `theme-color` in each page's `<head>` |

**If you move to a custom domain,** update `sitemap.xml` and the `og:image` address in each page's `<head>`. These are the only places that use the full web address, because search engines and social sites require one.

**Search engines:** to help Google find the site, submit `sitemap.xml` in [Google Search Console](https://search.google.com/search-console). There's deliberately no `robots.txt`, because crawlers only read it from the root of a domain, and this site lives in the `/GabysArcade/` folder. If you move to a custom domain, you can add one.

## Troubleshooting

| Problem | Likely cause | Fix |
| --- | --- | --- |
| New game doesn't appear | No catalog entry, or a mistake in `catalog.js` | Run `node tools/check-catalog.mjs`. If no cards appear at all, look for a missing comma or quote in `catalog.js` |
| Game works locally, 404 online | Capitals in a path don't match. Windows ignores case, GitHub Pages doesn't | Match `folder`, and every path in the game, to the exact capitals on disk |
| Thumbnail shows a letter | `icon/icon-256.png` is missing or misnamed | Check the path and capitals, or set `icon` in the catalog |
| Game stuck in Coming Soon | The `<title>` still starts with those words, or the old page is cached | Check `index.html`, wait ten minutes, then hard refresh |
| A public game shows as Coming Soon only when opened from `file://` | Browsers block reading titles there, so the catalog title is used | Preview with a local server, or update the catalog `title` |
| Coming Soon game opens without a PIN | The guard line is missing, or your browser has a pass from the last 12 hours | Run the catalog check. To test as a visitor, use a private window |
| Coming Soon game sends you home after the PIN | Browser storage is blocked, so the 12-hour pass couldn't be saved | Allow site data for the arcade |
| Contact form says "not connected" | `contactFormEndpoint` is empty | See [Connect the forms](#connect-the-forms) |
| Contact form says "not sent" | The service rejected the message or couldn't be reached | Check the form address and your Formspree dashboard |
| Changes don't show online | Pages is still deploying, or the browser has cached the old page | Check the repository's **Actions** tab, wait a few minutes, then hard refresh |
| Back button in a game gives a 404 | The game's link has the wrong depth | It must be `../../index.html` from a game folder |
