/* Builds the header and footer used on every page, so navigation lives in one place. */
(function () {
  const NAV_ITEMS = [
    { id: "home", label: "Home", href: "index.html" },
    { id: "games", label: "Games", href: "games.html" },
    { id: "apps", label: "Apps", href: "apps.html" },
    { id: "contact", label: "Contact", href: "contact.html" },
    { id: "about", label: "About", href: "about.html" },
  ];

  const DISCLAIMER =
    "All games are for fun and demo purposes only and are not for commercial or resale use. For best experience, recommend playing on the chrome browser.";

  const currentPage = document.body.dataset.page;

  const navLinks = NAV_ITEMS.map((item) => {
    const current = item.id === currentPage ? ' aria-current="page"' : "";
    return `<li><a href="${item.href}"${current}>${item.label}</a></li>`;
  }).join("");

  const brand = `
    <a class="brand" href="index.html" aria-label="Gaby’s Arcade home">
      <img src="icon/icon-128.png" width="40" height="40" alt="">
      <span class="brand-name"><span>Gaby’s</span> <span class="brand-accent">Arcade</span></span>
    </a>`;

  function renderHeader() {
    const header = document.getElementById("site-header");
    if (!header) return;

    header.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="site-header-inner">
        ${brand}
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">
          <span aria-hidden="true"></span>
        </button>
        <nav class="site-nav" id="site-nav" aria-label="Main">
          <ul>${navLinks}</ul>
        </nav>
      </div>`;

    const toggle = header.querySelector(".nav-toggle");
    const nav = header.querySelector(".site-nav");

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  function renderFooter() {
    const footer = document.getElementById("site-footer");
    if (!footer) return;

    footer.innerHTML = `
      <div class="site-footer-inner">
        <div class="footer-top">
          ${brand}
          <nav aria-label="Footer"><ul class="footer-nav">${navLinks}</ul></nav>
        </div>
        <p class="footer-disclaimer">${DISCLAIMER}</p>
        <p class="footer-copyright">Site design © ${new Date().getFullYear()} Gaby’s Arcade</p>
      </div>`;
  }

  renderHeader();
  renderFooter();
})();
