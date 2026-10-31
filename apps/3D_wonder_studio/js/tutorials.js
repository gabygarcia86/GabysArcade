// Step-by-step lessons and creative challenges. A lesson step points at part of the screen,
// shows a small animated picture, and can move on by itself when the child does the thing.
import { h } from "./ui.js";

const CHALLENGE_KEY = "wonderStudio.challenges";

const clay = (extra = "") => `<svg viewBox="0 0 200 120" class="demo" aria-hidden="true">
  <defs><radialGradient id="demoClay" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#b6f28c"/><stop offset="1" stop-color="#4fae2c"/></radialGradient></defs>
  ${extra}
</svg>`;

const hand = (path, dur = "2.4s") => `<g><path d="M0 0l0 16 4.500-4 3 7 3-1.300-3-7 6-.3z" fill="#fff" stroke="#14112a" stroke-width="1.500" stroke-linejoin="round">
  <animateMotion dur="${dur}" repeatCount="indefinite" path="${path}"/></path></g>`;

const DEMOS = {
  hello: clay(`<circle cx="100" cy="62" r="42" fill="url(#demoClay)"><animate attributeName="r" values="40;44;40" dur="2s" repeatCount="indefinite"/></circle>
    <circle cx="86" cy="56" r="5" fill="#14112a"/><circle cx="114" cy="56" r="5" fill="#14112a"/>
    <path d="M84 74q16 14 32 0" stroke="#14112a" stroke-width="4" fill="none" stroke-linecap="round"/>`),
  shape: clay(`<rect x="20" y="40" width="34" height="34" rx="7" fill="#45b7ff"><animate attributeName="opacity" values="0;1;1" keyTimes="0;.3;1" dur="3s" repeatCount="indefinite"/></rect>
    <circle cx="100" cy="57" r="19" fill="url(#demoClay)"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;.3;.55;1" dur="3s" repeatCount="indefinite"/></circle>
    <path d="M146 76l19-38 19 38z" fill="#ff9d2e"><animate attributeName="opacity" values="0;0;1" keyTimes="0;.6;.85" dur="3s" repeatCount="indefinite"/></path>`),
  sculpt: clay(`<path fill="url(#demoClay)"><animate attributeName="d" dur="2.8s" repeatCount="indefinite"
      values="M30 90Q100 30 170 90Z;M30 90Q60 44 88 58T120 40 170 90Z;M30 90Q60 60 88 42T132 42 170 90Z;M30 90Q100 30 170 90Z"/></path>
    <rect x="24" y="90" width="152" height="6" rx="3" fill="#3f8f23"/>
    ${hand("M70 64 L100 48 L130 56 L70 64", "2.8s")}`),
  parts: clay(`<circle cx="100" cy="66" r="40" fill="url(#demoClay)"/>
    <g><circle r="11" fill="#fff" stroke="#14112a" stroke-width="2"/><circle r="5" cx="1" fill="#14112a"/>
      <animateMotion dur="2.6s" repeatCount="indefinite" path="M30 20 Q60 10 84 56 L84 56 L84 56"/></g>
    <g><circle r="11" fill="#fff" stroke="#14112a" stroke-width="2"/><circle r="5" cx="1" fill="#14112a"/>
      <animateMotion dur="2.6s" repeatCount="indefinite" path="M170 20 Q140 10 116 56 L116 56 L116 56"/></g>`),
  paint: clay(`<defs><clipPath id="demoStripe"><rect x="50" y="20" height="90" width="0"><animate attributeName="width" values="0;100;100" keyTimes="0;.75;1" dur="3s" repeatCount="indefinite"/></rect></clipPath></defs>
    <circle cx="100" cy="62" r="42" fill="url(#demoClay)"/>
    <g clip-path="url(#demoStripe)"><path d="M58 50h84M58 74h84" stroke="#ff5da8" stroke-width="13" stroke-linecap="round"/></g>
    ${hand("M56 48 L144 48 L56 72 L144 72 L144 72", "3s")}`),
  save: clay(`<rect x="72" y="26" width="56" height="66" rx="9" fill="#45b7ff"/><rect x="84" y="26" width="32" height="20" fill="#d7efff"/><rect x="82" y="62" width="36" height="30" rx="3" fill="#0e2f55"/>
    <path d="M92 76l6 6 12-12" stroke="#7dff6b" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.35;.85;1" dur="2.4s" repeatCount="indefinite"/></path>`),
  export: clay(`<circle cx="52" cy="62" r="28" fill="url(#demoClay)"/>
    <path d="M90 62h30" stroke="#ffc53d" stroke-width="7" stroke-linecap="round" stroke-dasharray="7 9"><animate attributeName="stroke-dashoffset" values="32;0" dur="1s" repeatCount="indefinite"/></path>
    <path d="M118 48l15 14-15 14" stroke="#ffc53d" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="142" y="34" width="44" height="56" rx="7" fill="#b16dff"/><text x="164" y="68" font-size="15" font-weight="700" text-anchor="middle" fill="#fff">GLB</text>`),
};

export const TUTORIALS = [
  {
    title: "Welcome to 3D Wonder Studio",
    blurb: "Take a quick look around.",
    steps: [
      { title: "Hi there!", text: "This is your clay studio. Everything you make here is real 3D, so you can look at it from every side.", demo: "hello" },
      { title: "Your tools", text: "These buttons are your sculpting tools. Pick one, then use it on your clay.", target: "#tools" },
      { title: "Turn the view", text: "Drag the empty space around your clay to turn your view. Try it now!", target: "#stage", until: "orbit" },
      { title: "Oops button", text: "Made a mistake? Undo takes back your last step. You can't break anything here!", target: "#btn-undo" },
      { title: "You're ready!", text: "That's the tour. Try a lesson or a challenge from the Help button whenever you like.", target: "#btn-help" },
    ],
  },
  {
    title: "Create your first shape",
    blurb: "Add shapes and move them.",
    prepare: (app) => { app.ui.setDock("shapes"); },
    steps: [
      { title: "Pick a shape", text: "Tap any shape in the bottom bar to add it to your scene.", target: "#dock", demo: "shape", until: "add-shape" },
      { title: "Move it", text: "See the colored arrows? Drag one to slide your shape along that direction.", target: "#stage", until: "moved" },
      { title: "Turn and resize", text: "Use the handle buttons here to turn your shape or change its size.", target: "#props" },
      { title: "Nice work!", text: "Keep adding shapes to build anything: a snowman, a car, a castle." },
    ],
  },
  {
    title: "Learn to sculpt",
    blurb: "Push, pull and smooth clay.",
    prepare: (app) => { if (!app.objects.list.length) app.loadTemplate("ball"); },
    steps: [
      { title: "Pick Add Clay", text: "Tap Add Clay. This brush builds new clay wherever you draw.", target: '[data-tool="draw"]', demo: "sculpt", until: "tool:draw" },
      { title: "Draw on the clay", text: "Press on your clay and drag. Watch it grow!", target: "#stage", until: "stroke-end" },
      { title: "Make it smooth", text: "Now pick Smooth and rub over the bumps.", target: '[data-tool="smooth"]', until: "tool:smooth" },
      { title: "Rub the bumps", text: "Drag over the bumps to soften them.", target: "#stage", until: "stroke-end" },
      { title: "Try Grab", text: "Pick Grab, then pull part of the clay to stretch out a nose or an ear.", target: '[data-tool="grab"]', until: "stroke-end" },
      { title: "You're a sculptor!", text: "Hold your finger or mouse still with a brush and the clay keeps growing. Every brush has a Size and Strength in the panel." },
    ],
  },
  {
    title: "Add eyes, ears and more",
    blurb: "Stick on silly parts.",
    prepare: (app) => { if (!app.objects.list.length) app.loadTemplate("ball"); app.ui.setDock("parts"); },
    steps: [
      { title: "Choose a part", text: "Tap the Googly Eye in the bottom bar.", target: "#dock", demo: "parts", until: "placing" },
      { title: "Stick it on", text: "Now tap your model where the eye should go.", target: "#stage", until: "part-placed" },
      { title: "Both sides at once", text: "Pick a brush and turn on Symmetry. Parts and brushes now work on both sides.", target: "#props" },
      { title: "So funny!", text: "Add horns, ears and teeth the same way. To move a part, use the Move tool." },
    ],
  },
  {
    title: "Paint your creation",
    blurb: "Add color and patterns.",
    prepare: (app) => { if (!app.objects.list.length) app.loadTemplate("ball"); app.ui.setDock("colors"); },
    steps: [
      { title: "Pick Paint", text: "Tap the Paint tool.", target: '[data-tool="paint"]', demo: "paint", until: "tool:paint" },
      { title: "Choose a color", text: "Pick any color you like from the bottom bar.", target: "#dock" },
      { title: "Paint!", text: "Draw on your model. The paint wraps around every curve.", target: "#stage", until: "stroke-end" },
      { title: "Fix mistakes", text: "The Erase tool wipes paint away and shows the clay color again.", target: '[data-tool="erase"]' },
      { title: "Beautiful!", text: "Try the Materials tab too. One tap can turn your whole object into metal, wood or glass." },
    ],
  },
  {
    title: "Save your model",
    blurb: "Keep your work safe.",
    steps: [
      { title: "It saves itself", text: "The studio keeps your work in this browser while you create. Look for Saved here at the top.", target: ".project-box", demo: "save" },
      { title: "Name it", text: "Tap the name at the top and give your creation a great name.", target: "#project-name" },
      { title: "Save a file", text: "Save puts a project file in your downloads, so you can keep it forever.", target: "#btn-save" },
      { title: "Open it again", text: "Open shows My Projects, and can load any file you saved.", target: "#btn-open" },
    ],
  },
  {
    title: "Export your creation",
    blurb: "Use your model anywhere.",
    steps: [
      { title: "Share your model", text: "Export makes a real 3D file you can use in games, other 3D apps or a 3D printer.", target: "#btn-export", demo: "export" },
      { title: "Which file?", text: "Pick GLB for most things. Pick STL for a 3D printer. Tap Export to try it!", target: "#btn-export", until: "exported" },
      { title: "You did it!", text: "You know it all now. Go make something wonderful!" },
    ],
  },
];

export const CHALLENGES = [
  {
    id: "monster", title: "Make a funny monster", blurb: "How silly can it get?", template: "ball",
    tips: ["Use Grab to pull out a funny shape", "Add three or more googly eyes", "Stick on horns and big teeth", "Paint it with wild spots"],
  },
  {
    id: "alien", title: "Create an alien", blurb: "Who lives on your planet?", template: "ball",
    tips: ["Inflate the top to make a huge head", "Turn on X symmetry", "Add long antennae", "Try the Glow material on the eyes"],
  },
  {
    id: "dinosaur", title: "Sculpt a dinosaur", blurb: "Roar! Add spikes and a tail.", template: "dinosaur",
    tips: ["Grab the tail and give it a curl", "Carve a mouth with Crease", "Add a row of spikes", "Paint stripes down its back"],
  },
  {
    id: "robot", title: "Make a robot", blurb: "Build it from shapes.", template: "blank",
    tips: ["Start with cube shapes", "Use Metallic on every part", "Turn on Glow for the eyes", "Group the parts together"],
  },
  {
    id: "character", title: "Create your own cartoon character", blurb: "Give them a big personality.", template: "head",
    tips: ["Change the face with Grab", "Make new hair with Add Clay", "Paint a shirt or some freckles", "Save a picture to share"],
  },
  {
    id: "fantasy", title: "Build a fantasy creature", blurb: "Dragons, unicorns, or something new!", template: "creature",
    tips: ["Change the wings with Grab", "Add a horn or two", "Try the Glass material", "Give it a name at the top"],
  },
];

export class Tutor {
  constructor(app) {
    this.app = app;
    this.lesson = null;
    this.step = 0;
    this.root = document.getElementById("coach");
    this.ring = document.getElementById("coach-ring");
    this.card = document.getElementById("challenge-card");
    window.addEventListener("resize", () => this._place());
    for (const event of ["stroke-end", "exported", "add-shape", "moved", "orbit", "part-placed"]) {
      app.on(event, () => this._signal(event));
    }
    app.on("tool", () => this._signal(`tool:${app.tool}`));
    app.on("placing", (label) => { if (label) this._signal("placing"); });
  }

  start(index) {
    const lesson = TUTORIALS[index];
    this.lesson = lesson;
    this.step = 0;
    lesson.prepare?.(this.app);
    this._draw();
  }

  stop() {
    this.lesson = null;
    this.root.classList.add("is-hidden");
    this.ring.classList.add("is-hidden");
  }

  _signal(event) {
    const step = this.lesson?.steps[this.step];
    if (step?.until === event) setTimeout(() => this._next(), 500);
  }

  _next() {
    if (!this.lesson) return;
    if (this.step >= this.lesson.steps.length - 1) {
      this.stop();
      this.app.ui.toast("Lesson finished. Great job!");
      return;
    }
    this.step++;
    this._draw();
  }

  _draw() {
    const { lesson } = this;
    const step = lesson.steps[this.step];
    const last = this.step === lesson.steps.length - 1;
    this.root.classList.remove("is-hidden");
    this.root.replaceChildren(
      step.demo ? h("div", { class: "coach-demo", html: DEMOS[step.demo] }) : null,
      h("h3", {}, step.title),
      h("p", {}, step.text),
      h("div", { class: "coach-foot" },
        h("span", { class: "coach-count" }, `${this.step + 1} of ${lesson.steps.length}`),
        h("button", { class: "mini", type: "button", id: "coach-skip", onclick: () => this.stop() }, "Stop"),
        h("button", { class: "mini primary", type: "button", id: "coach-next", onclick: () => this._next() }, last ? "Finish" : step.until ? "Skip" : "Next")),
    );
    this._place();
  }

  /** Puts the ring on the step's target and keeps the bubble out of its way. */
  _place() {
    if (!this.lesson) return;
    const step = this.lesson.steps[this.step];
    const target = step.target ? document.querySelector(step.target) : null;
    const visible = target && target.getClientRects().length > 0;
    this.ring.classList.toggle("is-hidden", !visible);
    const box = this.root.getBoundingClientRect();
    const margin = 14;
    let left = (window.innerWidth - box.width) / 2;
    let top = (window.innerHeight - box.height) / 2;
    if (visible) {
      const rect = target.getBoundingClientRect();
      Object.assign(this.ring.style, {
        left: `${rect.left - 5}px`, top: `${rect.top - 5}px`, width: `${rect.width + 10}px`, height: `${rect.height + 10}px`,
      });
      const fits = [
        [rect.right + margin, rect.top],
        [rect.left - box.width - margin, rect.top],
        [rect.left, rect.bottom + margin],
        [rect.left, rect.top - box.height - margin],
      ].find(([x, y]) => x >= 8 && y >= 8 && x + box.width <= window.innerWidth - 8 && y + box.height <= window.innerHeight - 8);
      if (fits) [left, top] = fits;
      else {
        left = window.innerWidth - box.width - 12;
        top = 72;
      }
    }
    this.root.style.left = `${Math.max(8, left)}px`;
    this.root.style.top = `${Math.max(8, top)}px`;
  }

  // ---- Challenges ----------------------------------------------------------------------

  completed() {
    try {
      return new Set(JSON.parse(localStorage.getItem(CHALLENGE_KEY)) ?? []);
    } catch {
      return new Set();
    }
  }

  async startChallenge(challenge) {
    const { app } = this;
    if (!(await app.ui.guardUnsaved())) return;
    if (challenge.template === "blank") app.loadBlank();
    else app.loadTemplate(challenge.template);
    app.project.setName(challenge.title, { silent: true });
    this.card.classList.remove("is-hidden");
    this.card.replaceChildren(
      h("div", { class: "challenge-head" },
        h("strong", {}, challenge.title),
        h("button", { class: "mini", type: "button", "aria-label": "Close challenge", onclick: () => this.card.classList.add("is-hidden") }, "Hide")),
      h("ul", {}, challenge.tips.map((tip) => h("li", {}, h("label", {}, h("input", { type: "checkbox" }), h("span", {}, tip))))),
      h("button", {
        class: "mini primary", type: "button", id: "challenge-done",
        onclick: () => this._finishChallenge(challenge),
      }, "I did it!"),
    );
  }

  _finishChallenge(challenge) {
    const done = this.completed();
    done.add(challenge.id);
    try {
      localStorage.setItem(CHALLENGE_KEY, JSON.stringify([...done]));
    } catch {
      // The star is only a keepsake, so losing it is harmless.
    }
    this.card.classList.add("is-hidden");
    this.app.ui.toast(`Challenge complete! ${done.size} of ${CHALLENGES.length} stars earned.`);
    confetti();
  }
}

function confetti() {
  const root = document.getElementById("confetti");
  const colors = ["#7ed957", "#ff5da8", "#45b7ff", "#ffc53d", "#b16dff"];
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement("i");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.animationDuration = `${1.5 + Math.random() * 1.3}s`;
    root.append(piece);
    setTimeout(() => piece.remove(), 3400);
  }
}
