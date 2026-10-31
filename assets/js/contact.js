/*
 * Contact forms. Submissions go to the hosted form service set in data/site-config.js.
 * A success message appears only after that service confirms it received the message.
 */
(function () {
  const REQUEST_TIMEOUT_MS = 15000;
  const SERVICE_LABELS = { comment: "General Comment", bug: "Bug / Issue Report" };

  const endpoint = (window.ARCADE_CONFIG?.contactFormEndpoint || "").trim();
  const forms = [...document.querySelectorAll("form[data-contact-form]")];

  async function populateGameSelects() {
    const games = await window.Arcade.loadGames();
    const publicGames = games
      .filter((game) => !game.comingSoon)
      .sort((a, b) => a.title.localeCompare(b.title));
    const apps = window.Arcade.getApps();

    document.querySelectorAll("select[data-game-select]").forEach((select) => {
      const optionGroup = (label, items) => {
        const group = document.createElement("optgroup");
        group.label = label;
        items.forEach((item) => group.append(new Option(item.title, item.title)));
        return group;
      };

      if (publicGames.length) select.append(optionGroup("Games", publicGames));
      if (apps.length) select.append(optionGroup("Apps", apps));
      select.append(
        optionGroup("Other", [{ title: "The website itself" }, { title: "A game not listed here" }]),
      );
    });
  }

  function showFormType(type) {
    forms.forEach((form) => {
      form.hidden = form.dataset.contactForm !== type;
    });
  }

  function setFieldError(field, message) {
    const error = document.getElementById(`${field.id}-error`);
    error.textContent = message;
    if (message) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }

  function validate(form) {
    const fields = [...form.querySelectorAll("[required]")];
    fields.forEach((field) => {
      const label = form.querySelector(`label[for="${field.id}"]`).dataset.name;
      const missing = !field.value.trim();
      const verb = field.tagName === "SELECT" ? "Please choose" : "Please enter";
      setFieldError(field, missing ? `${verb} ${label}.` : "");
    });
    const firstInvalid = fields.find((field) => field.hasAttribute("aria-invalid"));
    firstInvalid?.focus();
    return !firstInvalid;
  }

  function setStatus(form, kind, message) {
    const status = form.querySelector(".form-status");
    status.className = `form-status is-${kind}`;
    status.textContent = message;
    status.hidden = false;
    status.focus();
  }

  async function send(form) {
    const data = new FormData(form);
    data.set("Form type", SERVICE_LABELS[form.dataset.contactForm]);
    data.set("_subject", `Gaby’s Arcade: ${SERVICE_LABELS[form.dataset.contactForm]} (${data.get("Game")})`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
        signal: controller.signal,
      });
      return response.ok;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    if (form.dataset.busy) return;
    form.querySelector(".form-status").hidden = true;
    if (!validate(form)) return;

    if (!endpoint) {
      setStatus(
        form,
        "error",
        "Your message was not sent because the contact form isn’t connected yet. Please try again later.",
      );
      return;
    }

    const button = form.querySelector('[type="submit"]');
    const buttonLabel = button.textContent;
    form.dataset.busy = "true";
    form.setAttribute("aria-busy", "true");
    button.disabled = true;
    button.textContent = "Sending…";

    let sent = false;
    try {
      sent = await send(form);
    } catch (error) {
      sent = false;
    }

    delete form.dataset.busy;
    form.removeAttribute("aria-busy");
    button.disabled = false;
    button.textContent = buttonLabel;

    if (sent) {
      form.reset();
      setStatus(form, "success", "Thanks! Your message was sent.");
    } else {
      setStatus(
        form,
        "error",
        "Your message was not sent. Your text is still here, so please check your connection and try again.",
      );
    }
  }

  document.querySelectorAll('input[name="contact-type"]').forEach((radio) => {
    radio.addEventListener("change", () => showFormType(radio.value));
  });

  forms.forEach((form) => {
    form.addEventListener("submit", handleSubmit);
    // Clears a field's error as soon as the visitor fixes it.
    form.addEventListener("input", (event) => {
      if (event.target.hasAttribute("aria-invalid") && event.target.value.trim()) {
        setFieldError(event.target, "");
      }
    });
  });

  if (!endpoint) document.getElementById("contact-offline").hidden = false;

  showFormType(document.querySelector('input[name="contact-type"]:checked').value);
  populateGameSelects();
})();
