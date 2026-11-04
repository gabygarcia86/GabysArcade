/* Built-in sticker library. Every sticker is original vector artwork drawn here as SVG,
 * so it stays crisp at any size and needs no image files. */
(function () {
  "use strict";
  const GAS = window.GAS;

  const O = "#2b2340"; // outline color shared by every sticker

  function wrap(body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="240" height="240">` +
      `<g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
  }

  /* ---------- path generators ---------- */
  function starPath(cx, cy, r1, r2, n, rot = -90) {
    let d = "";
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1;
      const a = ((rot + (i * 180) / n) * Math.PI) / 180;
      d += (i ? "L" : "M") + (cx + Math.cos(a) * r).toFixed(1) + " " + (cy + Math.sin(a) * r).toFixed(1);
    }
    return d + "Z";
  }
  function fuzzPath(cx, cy, r, n, amt) {
    let d = "";
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.5) / n) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r];
      const p1 = [cx + Math.cos(a1) * (r + amt), cy + Math.sin(a1) * (r + amt)];
      d += (i ? "L" : "M") + p0[0].toFixed(1) + " " + p0[1].toFixed(1) + "L" + p1[0].toFixed(1) + " " + p1[1].toFixed(1);
    }
    return d + "Z";
  }
  function rays(cx, cy, r1, r2, n) {
    let d = "";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      d += `M${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}L${(cx + Math.cos(a) * r2).toFixed(1)} ${(cy + Math.sin(a) * r2).toFixed(1)}`;
    }
    return d;
  }
  const eye = (x, y, r = 5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${O}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#fff" stroke="none"/>`;
  const blush = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="3" fill="#ff8fab" stroke="none" opacity="0.8"/>`;

  /* Emoji-style faces share one base. */
  function face(color, inner) {
    return wrap(`<circle cx="50" cy="50" r="42" fill="${color}"/><path d="M22 30 q8 -14 22 -18" fill="none" stroke="#fff" stroke-width="4" opacity="0.6"/>${inner}`);
  }
  const heartPath = (cx, cy, s) =>
    `M${cx} ${cy + s * 0.9} C${cx - s * 1.6} ${cy - s * 0.1} ${cx - s * 0.9} ${cy - s * 1.3} ${cx} ${cy - s * 0.45} C${cx + s * 0.9} ${cy - s * 1.3} ${cx + s * 1.6} ${cy - s * 0.1} ${cx} ${cy + s * 0.9}Z`;

  const LIB = {
    animals: {
      label: "Animals",
      items: {
        cat: wrap(`<path d="M20 42 L24 12 L44 30Z" fill="#ff9f43"/><path d="M80 42 L76 12 L56 30Z" fill="#ff9f43"/>
          <path d="M26 22 L28 34 L36 30Z" fill="#ffc6d9" stroke="none"/><path d="M74 22 L72 34 L64 30Z" fill="#ffc6d9" stroke="none"/>
          <ellipse cx="50" cy="56" rx="34" ry="30" fill="#ff9f43"/>
          <path d="M42 28 l3 8 M50 27 v9 M58 28 l-3 8" stroke="#d9772b" fill="none"/>
          ${eye(38, 52)}${eye(62, 52)}<path d="M46 62 h8 l-4 4z" fill="#ff6b9a"/>
          <path d="M50 66 q-4 6 -9 3 M50 66 q4 6 9 3" fill="none"/>
          <path d="M8 58 h16 M9 66 l15 -3 M92 58 h-16 M91 66 l-15 -3" fill="none" stroke-width="2"/>${blush(30, 64)}${blush(70, 64)}`),
        dog: wrap(`<ellipse cx="50" cy="55" rx="30" ry="29" fill="#d4995e"/>
          <path d="M26 32 C8 34 6 64 18 74 C28 70 30 50 32 40Z" fill="#7a4b2a"/>
          <path d="M74 32 C92 34 94 64 82 74 C72 70 70 50 68 40Z" fill="#7a4b2a"/>
          <ellipse cx="50" cy="68" rx="17" ry="13" fill="#f6dcb5"/>
          ${eye(39, 50)}${eye(61, 50)}<ellipse cx="50" cy="61" rx="6.5" ry="4.5" fill="${O}"/>
          <path d="M50 65 v5 M42 71 q8 6 16 0" fill="none"/><path d="M47 74 q3 9 6 0" fill="#ff6b9a"/>`),
        bunny: wrap(`<ellipse cx="37" cy="26" rx="9" ry="23" fill="#fff"/><ellipse cx="63" cy="26" rx="9" ry="23" fill="#fff"/>
          <ellipse cx="37" cy="28" rx="4" ry="15" fill="#ffc6d9" stroke="none"/><ellipse cx="63" cy="28" rx="4" ry="15" fill="#ffc6d9" stroke="none"/>
          <circle cx="50" cy="62" r="29" fill="#fff"/>${eye(39, 58)}${eye(61, 58)}
          <path d="M46 67 h8 l-4 4z" fill="#ff6b9a"/><path d="M50 71 q-4 5 -8 2 M50 71 q4 5 8 2" fill="none"/>
          <rect x="46" y="74" width="8" height="7" rx="1.5" fill="#fff" stroke-width="2"/>${blush(32, 68)}${blush(68, 68)}`),
        fish: wrap(`<path d="M70 50 L95 28 L90 50 L95 72Z" fill="#ff9f43"/><path d="M38 32 q10 -18 26 -6 L56 32Z" fill="#ff9f43"/>
          <ellipse cx="45" cy="52" rx="33" ry="23" fill="#4cc9f0"/>
          <path d="M50 36 q9 16 0 32 M61 39 q7 13 0 26" fill="none" stroke-width="2.5" stroke="#2a8db5"/>
          <circle cx="27" cy="46" r="6.5" fill="#fff"/>${eye(27, 46, 3.2)}<path d="M15 58 q6 5 11 0" fill="none"/>
          <circle cx="12" cy="30" r="3" fill="#cdf3ff" stroke-width="2"/><circle cx="8" cy="20" r="2" fill="#cdf3ff" stroke-width="1.5"/>`),
        bird: wrap(`<path d="M44 32 q-2 -14 8 -16 q0 6 -2 14" fill="#ff9f43"/>
          <ellipse cx="50" cy="56" rx="31" ry="29" fill="#ffd23f"/>
          <path d="M58 56 q22 -6 26 10 q-16 8 -26 -10z" fill="#ffb703"/>
          ${eye(40, 48)}${eye(58, 48)}<path d="M42 56 l7 9 l7 -9z" fill="#ff7b00"/>
          <path d="M40 85 v9 M36 94 h8 M58 85 v9 M54 94 h8" fill="none"/>${blush(33, 60)}`),
        frog: wrap(`<circle cx="31" cy="33" r="14" fill="#7bd389"/><circle cx="69" cy="33" r="14" fill="#7bd389"/>
          <ellipse cx="50" cy="62" rx="40" ry="29" fill="#7bd389"/>
          <circle cx="31" cy="32" r="8" fill="#fff" stroke="none"/><circle cx="69" cy="32" r="8" fill="#fff" stroke="none"/>
          ${eye(32, 33, 4)}${eye(70, 33, 4)}<path d="M26 64 q24 18 48 0" fill="none"/>
          <circle cx="45" cy="52" r="1.6" fill="${O}" stroke="none"/><circle cx="55" cy="52" r="1.6" fill="${O}" stroke="none"/>${blush(22, 62)}${blush(78, 62)}`),
        bear: wrap(`<circle cx="24" cy="26" r="13" fill="#a86b3c"/><circle cx="76" cy="26" r="13" fill="#a86b3c"/>
          <circle cx="24" cy="26" r="6" fill="#e3b58a" stroke="none"/><circle cx="76" cy="26" r="6" fill="#e3b58a" stroke="none"/>
          <circle cx="50" cy="55" r="34" fill="#a86b3c"/><ellipse cx="50" cy="66" rx="15" ry="12" fill="#e3b58a"/>
          ${eye(37, 50)}${eye(63, 50)}<ellipse cx="50" cy="61" rx="6" ry="4" fill="${O}"/><path d="M50 65 v4 M43 70 q7 5 14 0" fill="none"/>`),
        turtle: wrap(`<ellipse cx="84" cy="56" rx="11" ry="10" fill="#9be564"/>${eye(87, 53, 2.6)}
          <path d="M20 78 l-4 12 h10z M70 78 l4 12 h-10z" fill="#9be564"/><path d="M10 66 l-8 4 l8 3z" fill="#9be564"/>
          <path d="M12 72 C12 30 78 30 78 72Z" fill="#43aa8b"/>
          <path d="M45 40 l10 10 l-4 14 h-14 l-4 -14z M24 60 l13 4 M66 60 l-15 4 M45 40 l-8 -2 M55 50 l12 -6" fill="none" stroke="#2d6a4f" stroke-width="2.5"/>
          <path d="M8 72 h76" fill="none" stroke-width="4"/>`),
      },
    },
    monsters: {
      label: "Monsters",
      items: {
        blob: wrap(`<path d="M34 24 L28 8 M66 24 L72 8" fill="none"/><circle cx="28" cy="8" r="4.5" fill="#f15bb5"/><circle cx="72" cy="8" r="4.5" fill="#f15bb5"/>
          <path d="M18 92 C12 50 24 20 50 20 C76 20 88 50 82 92 L74 85 L66 92 L58 85 L50 92 L42 85 L34 92 L26 85Z" fill="#9b5de5"/>
          <circle cx="50" cy="45" r="15" fill="#fff"/><circle cx="52" cy="47" r="7.5" fill="${O}"/><circle cx="55" cy="44" r="2.4" fill="#fff" stroke="none"/>
          <path d="M34 66 q16 14 32 0z" fill="${O}"/><path d="M40 67 l3 5 l3 -5 M54 67 l3 5 l3 -5" fill="#fff" stroke-width="1.5"/>`),
        horny: wrap(`<path d="M28 32 L18 6 L40 24Z" fill="#fff6d5"/><path d="M72 32 L82 6 L60 24Z" fill="#fff6d5"/>
          <rect x="16" y="20" width="68" height="72" rx="28" fill="#80ed99"/>
          <circle cx="37" cy="46" r="10" fill="#fff"/><circle cx="63" cy="46" r="10" fill="#fff"/>${eye(38, 48, 4.5)}${eye(62, 48, 4.5)}
          <path d="M30 66 h40 q-4 18 -20 18 q-16 0 -20 -18z" fill="${O}"/><path d="M36 66 l4 7 l4 -7 M56 66 l4 7 l4 -7" fill="#fff" stroke-width="1.5"/>
          <circle cx="26" cy="80" r="4" fill="#57cc99" stroke="none"/><circle cx="76" cy="30" r="3" fill="#57cc99" stroke="none"/>`),
        fuzzy: wrap(`<path d="${fuzzPath(50, 54, 34, 22, 8)}" fill="#4cc9f0"/>
          <circle cx="36" cy="46" r="11" fill="#fff"/><circle cx="64" cy="46" r="11" fill="#fff"/>${eye(38, 48, 5)}${eye(62, 48, 5)}
          <path d="M34 66 q16 16 32 0" fill="#ef476f"/><path d="M34 66 h32" fill="none"/>
          <path d="M44 66 v6 h6 v-6" fill="#fff" stroke-width="2"/>`),
        ghost: wrap(`<path d="M20 90 V46 C20 24 34 12 50 12 C66 12 80 24 80 46 V90 L70 81 L60 90 L50 81 L40 90 L30 81Z" fill="#fff"/>
          <ellipse cx="38" cy="44" rx="5.5" ry="8" fill="${O}"/><ellipse cx="62" cy="44" rx="5.5" ry="8" fill="${O}"/>
          <ellipse cx="50" cy="62" rx="6" ry="7" fill="${O}"/>${blush(30, 56)}${blush(70, 56)}
          <path d="M86 30 l6 -4 M88 40 h7 M8 30 l-6 -4 M6 40 h-5" fill="none" stroke-width="2"/>`),
        cyclops: wrap(`<ellipse cx="50" cy="58" rx="36" ry="34" fill="#ff9f1c"/>
          <path d="M20 40 Q8 30 14 18 Q24 26 28 34Z M80 40 Q92 30 86 18 Q76 26 72 34Z" fill="#ff9f1c"/>
          <circle cx="50" cy="48" r="17" fill="#fff"/><circle cx="50" cy="50" r="9" fill="#06d6a0"/><circle cx="50" cy="50" r="4.5" fill="${O}" stroke="none"/>
          <path d="M32 74 q18 12 36 0" fill="none" stroke-width="4"/><path d="M40 77 v5 M60 77 v5" fill="none"/>
          <circle cx="24" cy="70" r="3.5" fill="#e76f51" stroke="none"/><circle cx="76" cy="70" r="3.5" fill="#e76f51" stroke="none"/>`),
      },
    },
    space: {
      label: "Space",
      items: {
        rocket: wrap(`<path d="M42 82 Q50 102 58 82 Q50 90 42 82Z" fill="#ffb703"/>
          <path d="M34 56 L16 78 L34 74Z" fill="#ef476f"/><path d="M66 56 L84 78 L66 74Z" fill="#ef476f"/>
          <path d="M50 6 C67 21 71 46 66 74 H34 C29 46 33 21 50 6Z" fill="#f1f1f8"/>
          <path d="M50 6 C56 11 60 17 62 24 H38 C40 17 44 11 50 6Z" fill="#ef476f"/>
          <circle cx="50" cy="40" r="10" fill="#4cc9f0"/><path d="M45 36 q3 -3 7 -2" fill="none" stroke="#fff" stroke-width="2.5"/>
          <path d="M40 74 h20 l-3 7 h-14z" fill="#8d99ae"/><path d="M50 58 v14" fill="none" stroke-width="2"/>`),
        planet: wrap(`<path d="M6 54 A44 12 0 0 1 94 54" fill="none" stroke="${O}" stroke-width="9"/><path d="M6 54 A44 12 0 0 1 94 54" fill="none" stroke="#ffd23f" stroke-width="4"/>
          <circle cx="50" cy="50" r="27" fill="#f77f00"/><path d="M27 40 q23 7 46 0 M24 56 q26 7 52 0" fill="none" stroke="#c25e00" stroke-width="3"/>
          <path d="M6 54 A44 12 0 0 0 94 54" fill="none" stroke="${O}" stroke-width="9"/><path d="M6 54 A44 12 0 0 0 94 54" fill="none" stroke="#ffd23f" stroke-width="4"/>`),
        ufo: wrap(`<path d="M38 66 L26 96 H74 L62 66Z" fill="#fff59d" opacity="0.75" stroke="none"/>
          <path d="M30 48 C30 22 70 22 70 48Z" fill="#a0e7e5"/><circle cx="50" cy="38" r="8" fill="#80ed99"/>${eye(46, 37, 2.2)}${eye(54, 37, 2.2)}
          <path d="M50 30 v-6" fill="none" stroke-width="2"/><circle cx="50" cy="23" r="2" fill="#f15bb5" stroke-width="1.5"/>
          <ellipse cx="50" cy="56" rx="42" ry="13" fill="#b8c0ff"/><path d="M14 54 q36 9 72 0" fill="none" stroke-width="2"/>
          <circle cx="26" cy="59" r="3.5" fill="#ffd23f"/><circle cx="50" cy="63" r="3.5" fill="#ffd23f"/><circle cx="74" cy="59" r="3.5" fill="#ffd23f"/>`),
        moon: wrap(`<path d="M60 10 A40 40 0 1 0 90 72 A32 32 0 1 1 60 10Z" fill="#ffe66d"/>
          <circle cx="36" cy="40" r="5" fill="#f4d35e" stroke-width="2"/><circle cx="30" cy="66" r="7" fill="#f4d35e" stroke-width="2"/>
          <path d="M48 56 q4 4 8 0" fill="none"/><path d="M44 46 q3 -3 6 0" fill="none"/>${blush(56, 64)}`),
        star: wrap(`<path d="${starPath(50, 54, 44, 20, 5)}" fill="#ffd23f"/>${eye(42, 52, 3.5)}${eye(58, 52, 3.5)}
          <path d="M44 62 q6 6 12 0" fill="none"/>${blush(36, 60)}${blush(64, 60)}`),
        comet: wrap(`<path d="M60 40 L6 8 L50 52 L4 40 L52 62Z" fill="#a0e7e5" stroke-width="2.5"/>
          <path d="${starPath(66, 56, 26, 13, 5, -60)}" fill="#ffd23f"/><circle cx="66" cy="56" r="6" fill="#fff" stroke="none" opacity="0.6"/>`),
        astronaut: wrap(`<rect x="22" y="54" width="56" height="40" rx="14" fill="#f1f1f8"/><rect x="38" y="66" width="24" height="14" rx="3" fill="#4cc9f0"/>
          <circle cx="44" cy="73" r="2" fill="#ef476f" stroke="none"/><circle cx="52" cy="73" r="2" fill="#ffd23f" stroke="none"/>
          <circle cx="50" cy="34" r="27" fill="#f1f1f8"/><rect x="30" y="22" width="40" height="26" rx="13" fill="#3a3a6e"/>
          <path d="M36 28 q6 -4 12 -3" fill="none" stroke="#fff" stroke-width="3"/>${eye(42, 36, 3)}${eye(58, 36, 3)}`),
      },
    },
    robots: {
      label: "Robots",
      items: {
        boxbot: wrap(`<path d="M50 18 V8" fill="none"/><circle cx="50" cy="7" r="4.5" fill="#ef476f"/>
          <rect x="28" y="18" width="44" height="30" rx="7" fill="#a8dadc"/>
          <circle cx="40" cy="32" r="6.5" fill="#fff"/><circle cx="60" cy="32" r="6.5" fill="#fff"/>${eye(40, 32, 3)}${eye(60, 32, 3)}
          <rect x="40" y="41" width="20" height="3" rx="1.5" fill="${O}" stroke="none"/>
          <path d="M24 62 L12 76 M76 62 L88 76" fill="none" stroke-width="5"/><circle cx="11" cy="78" r="4" fill="#ffd23f"/><circle cx="89" cy="78" r="4" fill="#ffd23f"/>
          <rect x="45" y="48" width="10" height="5" fill="#8d99ae"/><rect x="24" y="53" width="52" height="34" rx="7" fill="#457b9d"/>
          <rect x="36" y="60" width="28" height="14" rx="3" fill="#f1faee"/><circle cx="43" cy="67" r="3" fill="#ef476f" stroke-width="1.5"/><circle cx="57" cy="67" r="3" fill="#06d6a0" stroke-width="1.5"/>
          <rect x="31" y="87" width="12" height="9" rx="2" fill="#8d99ae"/><rect x="57" y="87" width="12" height="9" rx="2" fill="#8d99ae"/>`),
        eggbot: wrap(`<rect x="12" y="44" width="10" height="18" rx="3" fill="#ef476f"/><rect x="78" y="44" width="10" height="18" rx="3" fill="#ef476f"/>
          <ellipse cx="50" cy="56" rx="31" ry="36" fill="#ffd166"/><rect x="27" y="35" width="46" height="23" rx="11.5" fill="${O}"/>
          <circle cx="50" cy="46" r="7" fill="#06d6a0" stroke="none"/><circle cx="52" cy="44" r="2.4" fill="#fff" stroke="none"/>
          <path d="M40 72 q10 8 20 0" fill="none"/><path d="M50 20 V10" fill="none"/><path d="M44 10 h12" fill="none" stroke-width="4"/>`),
        robohead: wrap(`<path d="M18 40 h-8 v18 h8 M82 40 h8 v18 h-8" fill="#ffb703"/>
          <rect x="18" y="20" width="64" height="64" rx="12" fill="#c0c7d6"/>
          <path d="M34 20 l-6 -12 M66 20 l6 -12" fill="none"/><circle cx="28" cy="8" r="4" fill="#4cc9f0"/><circle cx="72" cy="8" r="4" fill="#4cc9f0"/>
          <rect x="28" y="34" width="18" height="16" rx="4" fill="#fff"/><rect x="54" y="34" width="18" height="16" rx="4" fill="#fff"/>
          <rect x="33" y="38" width="8" height="8" rx="2" fill="${O}" stroke="none"/><rect x="59" y="38" width="8" height="8" rx="2" fill="${O}" stroke="none"/>
          <rect x="30" y="62" width="40" height="12" rx="3" fill="#2b2340"/><path d="M38 62 v12 M46 62 v12 M54 62 v12 M62 62 v12" stroke="#06d6a0" stroke-width="2"/>`),
        rover: wrap(`<path d="M50 30 V16 M50 16 l10 -6" fill="none"/><circle cx="62" cy="9" r="5" fill="#ffd23f"/>
          <rect x="18" y="30" width="64" height="30" rx="8" fill="#f77f00"/><rect x="28" y="36" width="44" height="14" rx="7" fill="#2b2340"/>
          <circle cx="40" cy="43" r="4" fill="#4cc9f0" stroke="none"/><circle cx="60" cy="43" r="4" fill="#4cc9f0" stroke="none"/>
          <rect x="10" y="62" width="80" height="10" rx="5" fill="#8d99ae"/>
          <circle cx="24" cy="78" r="11" fill="${O}"/><circle cx="50" cy="78" r="11" fill="${O}"/><circle cx="76" cy="78" r="11" fill="${O}"/>
          <circle cx="24" cy="78" r="4" fill="#ddd" stroke="none"/><circle cx="50" cy="78" r="4" fill="#ddd" stroke="none"/><circle cx="76" cy="78" r="4" fill="#ddd" stroke="none"/>`),
      },
    },
    vehicles: {
      label: "Vehicles",
      items: {
        car: wrap(`<path d="M6 68 V56 Q8 46 22 46 L32 28 H66 L78 46 Q94 48 94 58 V68Z" fill="#ef476f"/>
          <path d="M36 33 H48 V46 H27Z" fill="#a0e7e5"/><path d="M53 33 H64 L72 46 H53Z" fill="#a0e7e5"/>
          <circle cx="27" cy="70" r="11" fill="${O}"/><circle cx="27" cy="70" r="4.5" fill="#ddd" stroke="none"/>
          <circle cx="73" cy="70" r="11" fill="${O}"/><circle cx="73" cy="70" r="4.5" fill="#ddd" stroke="none"/>
          <circle cx="89" cy="56" r="3" fill="#ffd23f" stroke-width="2"/><path d="M44 54 h6" fill="none"/>`),
        bus: wrap(`<rect x="6" y="22" width="88" height="54" rx="10" fill="#ffd23f"/>
          <rect x="13" y="30" width="16" height="16" rx="3" fill="#a0e7e5"/><rect x="34" y="30" width="16" height="16" rx="3" fill="#a0e7e5"/>
          <rect x="55" y="30" width="16" height="16" rx="3" fill="#a0e7e5"/><rect x="76" y="30" width="12" height="34" rx="3" fill="#a0e7e5"/>
          <path d="M6 56 h70" fill="none" stroke="#f77f00" stroke-width="4"/>
          <circle cx="24" cy="78" r="10" fill="${O}"/><circle cx="24" cy="78" r="4" fill="#ddd" stroke="none"/>
          <circle cx="72" cy="78" r="10" fill="${O}"/><circle cx="72" cy="78" r="4" fill="#ddd" stroke="none"/>`),
        plane: wrap(`<path d="M40 50 L22 84 H34 L58 52Z" fill="#4361ee"/><path d="M12 48 L6 26 H16 L30 46Z" fill="#4361ee"/>
          <path d="M8 46 Q8 38 22 38 H76 Q96 40 96 50 Q96 58 76 60 H22 Q8 60 8 50Z" fill="#f1f1f8"/>
          <path d="M80 41 Q90 42 92 48 H80Z" fill="#a0e7e5"/>
          <circle cx="36" cy="48" r="3.5" fill="#a0e7e5" stroke-width="2"/><circle cx="48" cy="48" r="3.5" fill="#a0e7e5" stroke-width="2"/><circle cx="60" cy="48" r="3.5" fill="#a0e7e5" stroke-width="2"/>
          <path d="M42 46 L58 20 H68 L56 46Z" fill="#4361ee"/>`),
        boat: wrap(`<path d="M50 12 V68" fill="none" stroke-width="3.5"/><path d="M52 14 L84 60 H52Z" fill="#fff"/><path d="M48 22 L22 60 H48Z" fill="#ef476f"/>
          <path d="M8 68 H92 L80 88 H20Z" fill="#c1121f"/><path d="M14 78 h72" fill="none" stroke="#fff" stroke-width="3"/>
          <path d="M2 92 q8 -6 16 0 t16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="#4cc9f0" stroke-width="4"/>`),
        train: wrap(`<path d="M24 14 h14 l-2 12 h-10z" fill="#555b6e"/><circle cx="22" cy="8" r="5" fill="#e9ecef" stroke-width="2"/><circle cx="12" cy="4" r="3.5" fill="#e9ecef" stroke-width="2"/>
          <rect x="16" y="26" width="30" height="40" rx="4" fill="#06d6a0"/><rect x="46" y="12" width="40" height="54" rx="5" fill="#118ab2"/>
          <rect x="54" y="20" width="24" height="18" rx="3" fill="#a0e7e5"/><path d="M4 66 L16 52 V66Z" fill="#ffd23f"/>
          <rect x="6" y="64" width="84" height="8" rx="3" fill="#2b2340"/>
          <circle cx="26" cy="78" r="9" fill="#ef476f"/><circle cx="50" cy="78" r="9" fill="#ef476f"/><circle cx="74" cy="78" r="9" fill="#ef476f"/>
          <path d="M26 78 L74 78" fill="none" stroke-width="3"/>`),
        bike: wrap(`<circle cx="24" cy="66" r="18" fill="none" stroke-width="4"/><circle cx="78" cy="66" r="18" fill="none" stroke-width="4"/>
          <path d="M24 66 L42 38 H70 L78 66 M42 38 L52 66 L70 38 M52 66 L24 66" fill="none" stroke="#ef476f" stroke-width="5"/>
          <path d="M38 30 h12 M70 38 L66 24 h10" fill="none" stroke-width="4"/><circle cx="52" cy="66" r="4" fill="${O}"/>`),
      },
    },
    food: {
      label: "Food",
      items: {
        pizza: wrap(`<path d="M50 94 L16 22 Q50 6 84 22Z" fill="#ffd166"/><path d="M16 22 Q50 6 84 22 L80 32 Q50 18 20 32Z" fill="#e09f3e"/>
          <circle cx="42" cy="40" r="6.5" fill="#d62828"/><circle cx="60" cy="46" r="6.5" fill="#d62828"/><circle cx="50" cy="64" r="6" fill="#d62828"/>
          <path d="M36 54 v8 M64 30 v6" fill="none" stroke="#e09f3e" stroke-width="3"/>`),
        icecream: wrap(`<path d="M30 52 L50 96 L70 52Z" fill="#f4a261"/><path d="M36 60 l22 22 M46 54 l18 18 M64 60 l-22 22 M54 54 l-18 18" fill="none" stroke="#c97b3a" stroke-width="2"/>
          <circle cx="50" cy="46" r="20" fill="#ff8fab"/><circle cx="38" cy="36" r="14" fill="#a7f3d0"/><circle cx="62" cy="34" r="14" fill="#fff3b0"/>
          <circle cx="52" cy="18" r="6" fill="#ef233c"/><path d="M52 12 q4 -8 10 -8" fill="none" stroke-width="2"/>`),
        donut: wrap(`<circle cx="50" cy="52" r="40" fill="#e9a35e"/>
          <path d="M14 48 C14 24 86 24 86 48 C88 62 80 66 76 60 C70 70 62 64 58 70 C50 76 44 66 38 72 C30 72 30 62 22 66 C12 64 14 56 14 48Z" fill="#ff8fab"/>
          <ellipse cx="50" cy="50" rx="12" ry="10" fill="#fff" stroke-width="3"/>
          <path d="M30 38 l4 3 M44 30 l5 -1 M62 34 l3 4 M70 46 l5 -2 M30 54 l-3 4 M58 62 l4 2" stroke="#4cc9f0" stroke-width="3"/>
          <path d="M38 44 l-2 4 M56 28 l4 1 M72 56 l1 4 M44 64 l4 -1" stroke="#ffd23f" stroke-width="3"/>`),
        apple: wrap(`<path d="M50 30 C36 18 12 24 14 50 C16 76 34 94 50 84 C66 94 84 76 86 50 C88 24 64 18 50 30Z" fill="#ef233c"/>
          <path d="M50 30 Q48 18 54 10" fill="none" stroke-width="4"/><path d="M54 18 Q68 8 76 18 Q64 26 54 18Z" fill="#70e000"/>
          <path d="M26 44 q2 -10 10 -12" fill="none" stroke="#fff" stroke-width="4" opacity="0.7"/>`),
        cupcake: wrap(`<path d="M24 54 L32 92 H68 L76 54Z" fill="#4cc9f0"/><path d="M36 56 l4 34 M50 56 v34 M64 56 l-4 34" fill="none" stroke="#2a8db5" stroke-width="2.5"/>
          <path d="M18 56 Q14 44 28 42 Q26 26 44 28 Q50 14 60 26 Q78 24 74 40 Q88 44 82 56Z" fill="#fff0f6"/>
          <circle cx="54" cy="14" r="7" fill="#ef233c"/><path d="M36 40 l3 3 M60 38 l-3 4 M48 46 l4 0" stroke="#f15bb5" stroke-width="3"/>`),
        watermelon: wrap(`<path d="M6 40 A44 44 0 0 0 94 40Z" fill="#70e000"/><path d="M13 40 A37 37 0 0 0 87 40Z" fill="#fff" stroke="none"/>
          <path d="M17 40 A33 33 0 0 0 83 40Z" fill="#ff4d6d"/>
          <path d="M34 50 l2 5 M50 56 l0 5 M66 50 l-2 5 M42 64 l1 4 M58 64 l-1 4" stroke="${O}" stroke-width="3.5"/>`),
        taco: wrap(`<path d="M10 72 A40 40 0 0 1 90 72Z" fill="#ffd166"/>
          <path d="M16 62 q6 -14 14 -10 q4 -12 14 -8 q6 -10 14 -4 q10 -6 14 4 q10 0 10 10" fill="#70e000"/>
          <circle cx="34" cy="52" r="4" fill="#ef233c" stroke-width="2"/><circle cx="58" cy="48" r="4" fill="#ef233c" stroke-width="2"/>
          <path d="M10 72 A40 40 0 0 1 90 72" fill="none"/><path d="M18 70 h64" fill="none" stroke="#e09f3e" stroke-width="2"/>`),
      },
    },
    sports: {
      label: "Sports",
      items: {
        soccer: wrap(`<circle cx="50" cy="50" r="42" fill="#fff"/><path d="${starPath(50, 50, 13, 13, 5)}" fill="${O}"/>
          <path d="M50 37 V18 M62 46 L80 40 M58 61 L70 76 M42 61 L30 76 M38 46 L20 40" fill="none"/>
          <path d="M42 10 L50 18 L58 10 M86 32 L80 40 L86 52 M76 84 L70 76 L58 86 M24 84 L30 76 L42 86 M14 32 L20 40 L14 52" fill="${O}"/>`),
        basketball: wrap(`<circle cx="50" cy="50" r="42" fill="#f77f00"/>
          <path d="M8 50 H92 M50 8 V92 M20 20 Q40 50 20 80 M80 20 Q60 50 80 80" fill="none"/>`),
        baseball: wrap(`<circle cx="50" cy="50" r="42" fill="#fff"/><path d="M24 16 Q38 50 24 84 M76 16 Q62 50 76 84" fill="none" stroke="#ef233c"/>
          <path d="M26 26 l6 -2 M30 38 l6 0 M31 50 l6 0 M30 62 l6 0 M26 74 l6 2 M74 26 l-6 -2 M70 38 l-6 0 M69 50 l-6 0 M70 62 l-6 0 M74 74 l-6 2" stroke="#ef233c" stroke-width="2"/>`),
        tennis: wrap(`<circle cx="50" cy="50" r="42" fill="#d4e157"/><path d="M14 30 Q50 50 14 72 M86 30 Q50 50 86 72" fill="none" stroke="#fff" stroke-width="5"/>
          <circle cx="50" cy="50" r="42" fill="none"/>`),
        trophy: wrap(`<path d="M28 20 H12 Q10 44 32 46 M72 20 H88 Q90 44 68 46" fill="none" stroke-width="5"/>
          <path d="M26 12 H74 V34 Q74 58 50 60 Q26 58 26 34Z" fill="#ffd23f"/><path d="M44 60 h12 v12 h-12z" fill="#f4a261"/>
          <rect x="30" y="72" width="40" height="16" rx="3" fill="#8d5524"/><rect x="38" y="77" width="24" height="6" rx="2" fill="#ffd23f" stroke-width="1.5"/>
          <path d="${starPath(50, 32, 11, 5, 5)}" fill="#fff59d" stroke-width="2"/>`),
        medal: wrap(`<path d="M30 4 L44 44 H56 L70 4 H58 L50 30 L42 4Z" fill="#4361ee"/><path d="M42 4 L50 30 L58 4Z" fill="#ef476f"/>
          <circle cx="50" cy="66" r="26" fill="#ffd23f"/><circle cx="50" cy="66" r="18" fill="#ffe66d" stroke-width="2"/>
          <path d="${starPath(50, 67, 11, 5, 5)}" fill="#f4a261" stroke-width="2"/>`),
        skateboard: wrap(`<path d="M8 50 Q8 40 18 40 H82 Q92 40 92 50 Q92 56 82 56 H18 Q8 56 8 50Z" fill="#9b5de5"/>
          <path d="M30 40 l10 16 M50 40 l10 16 M70 40 l-4 6" fill="none" stroke="#f15bb5" stroke-width="3"/>
          <circle cx="26" cy="66" r="8" fill="#ffd23f"/><circle cx="74" cy="66" r="8" fill="#ffd23f"/>`),
      },
    },
    nature: {
      label: "Nature",
      items: {
        tree: wrap(`<path d="M42 92 L44 60 H56 L58 92Z" fill="#8d5524"/>
          <circle cx="34" cy="44" r="20" fill="#38b000"/><circle cx="66" cy="44" r="20" fill="#38b000"/><circle cx="50" cy="28" r="22" fill="#70e000"/><circle cx="50" cy="54" r="16" fill="#38b000"/>
          <circle cx="40" cy="30" r="3" fill="#ef233c" stroke-width="1.5"/><circle cx="64" cy="40" r="3" fill="#ef233c" stroke-width="1.5"/><circle cx="34" cy="50" r="3" fill="#ef233c" stroke-width="1.5"/>`),
        flower: wrap(`<path d="M50 56 V96" fill="none" stroke="#38b000" stroke-width="5"/><path d="M50 82 Q30 66 22 78 Q36 90 50 82Z" fill="#70e000"/>
          ${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(50 + Math.cos((a - 90) * Math.PI / 180) * 18).toFixed(1)}" cy="${(36 + Math.sin((a - 90) * Math.PI / 180) * 18).toFixed(1)}" r="13" fill="#ff8fab"/>`).join("")}
          <circle cx="50" cy="36" r="11" fill="#ffd23f"/>${eye(46, 35, 2)}${eye(54, 35, 2)}<path d="M46 40 q4 3 8 0" fill="none" stroke-width="2"/>`),
        sun: wrap(`<path d="${rays(50, 50, 32, 46, 12)}" fill="none" stroke="#f77f00" stroke-width="5"/>
          <circle cx="50" cy="50" r="27" fill="#ffd23f"/>${eye(41, 46, 3.5)}${eye(59, 46, 3.5)}<path d="M40 58 q10 9 20 0" fill="none"/>${blush(34, 56)}${blush(66, 56)}`),
        cloud: wrap(`<path d="M22 76 Q6 76 8 60 Q10 46 26 48 Q26 26 48 26 Q66 26 70 42 Q92 40 92 60 Q92 76 76 76Z" fill="#fff"/>
          ${eye(40, 56, 3)}${eye(60, 56, 3)}<path d="M45 64 q5 4 10 0" fill="none" stroke-width="2.5"/>${blush(32, 63)}${blush(68, 63)}`),
        rainbow: wrap(`${["#ef476f", "#f77f00", "#ffd23f", "#06d6a0", "#118ab2", "#9b5de5"].map((c, i) => `<path d="M${10 + i * 5} 72 A${40 - i * 5} ${40 - i * 5} 0 0 1 ${90 - i * 5} 72" fill="none" stroke="${c}" stroke-width="5.5"/>`).join("")}
          <path d="M2 84 Q2 72 12 72 Q16 64 24 70 Q32 70 30 84Z" fill="#fff"/><path d="M70 84 Q68 70 78 70 Q84 64 90 72 Q98 72 98 84Z" fill="#fff"/>`),
        mushroom: wrap(`<path d="M36 56 Q34 86 40 92 H60 Q66 86 64 56Z" fill="#fff6d5"/>
          <path d="M8 58 Q8 14 50 12 Q92 14 92 58 Q50 66 8 58Z" fill="#ef233c"/>
          <circle cx="32" cy="34" r="7" fill="#fff" stroke-width="2"/><circle cx="56" cy="26" r="6" fill="#fff" stroke-width="2"/><circle cx="72" cy="44" r="5" fill="#fff" stroke-width="2"/><circle cx="46" cy="48" r="4" fill="#fff" stroke-width="2"/>
          ${eye(44, 72, 2.4)}${eye(56, 72, 2.4)}`),
        leaf: wrap(`<path d="M14 86 Q8 30 70 14 Q92 10 88 30 Q76 84 14 86Z" fill="#70e000"/><path d="M14 86 Q48 52 80 22 M40 62 l-6 -18 M52 50 l14 4 M58 40 l-4 -14" fill="none" stroke="#38b000" stroke-width="3"/>`),
        butterfly: wrap(`<path d="M50 50 Q30 10 12 22 Q2 40 50 52 Q8 60 20 82 Q38 92 50 56" fill="#4cc9f0"/>
          <path d="M50 50 Q70 10 88 22 Q98 40 50 52 Q92 60 80 82 Q62 92 50 56" fill="#f15bb5"/>
          <circle cx="26" cy="32" r="5" fill="#fff" stroke-width="2"/><circle cx="74" cy="32" r="5" fill="#fff" stroke-width="2"/>
          <ellipse cx="50" cy="54" rx="5" ry="20" fill="${O}"/><path d="M48 36 L40 22 M52 36 L60 22" fill="none" stroke-width="2"/>`),
      },
    },
    fantasy: {
      label: "Fantasy",
      items: {
        unicorn: wrap(`<circle cx="30" cy="32" r="10" fill="#f15bb5"/><circle cx="40" cy="22" r="9" fill="#9b5de5"/><circle cx="62" cy="22" r="9" fill="#00bbf9"/><circle cx="72" cy="32" r="10" fill="#ffd23f"/>
          <path d="M30 40 L24 16 L40 30Z M70 40 L76 16 L60 30Z" fill="#fff"/>
          <ellipse cx="50" cy="56" rx="26" ry="30" fill="#fff"/><ellipse cx="50" cy="74" rx="17" ry="12" fill="#ffd6e8"/>
          <path d="M44 30 L50 2 L56 30Z" fill="#ffd23f"/><path d="M45 24 l10 -3 M46 16 l7 -2" fill="none" stroke-width="2"/>
          <path d="M34 54 q5 -6 10 0 M56 54 q5 -6 10 0" fill="none"/><ellipse cx="44" cy="74" rx="2" ry="3" fill="${O}" stroke="none"/><ellipse cx="56" cy="74" rx="2" ry="3" fill="${O}" stroke="none"/>${blush(30, 64)}${blush(70, 64)}`),
        dragon: wrap(`<path d="M24 56 L4 34 L14 60 L2 62 L22 70Z M76 56 L96 34 L86 60 L98 62 L78 70Z" fill="#9b5de5"/>
          <path d="M64 86 Q90 92 92 76" fill="none" stroke="#38b000" stroke-width="7"/><path d="M90 70 l6 8 l-8 2z" fill="#38b000" stroke-width="2"/>
          <ellipse cx="50" cy="70" rx="24" ry="22" fill="#70e000"/><ellipse cx="50" cy="74" rx="13" ry="14" fill="#fff3b0"/>
          <path d="M34 20 L30 6 L40 16Z M66 20 L70 6 L60 16Z" fill="#ffd23f"/>
          <ellipse cx="50" cy="36" rx="24" ry="20" fill="#70e000"/>${eye(41, 32, 4)}${eye(59, 32, 4)}
          <ellipse cx="50" cy="46" rx="12" ry="6" fill="#9ef01a"/><circle cx="46" cy="45" r="1.5" fill="${O}" stroke="none"/><circle cx="54" cy="45" r="1.5" fill="${O}" stroke="none"/>`),
        wand: wrap(`<path d="M16 90 L58 44" fill="none" stroke="${O}" stroke-width="9"/><path d="M16 90 L58 44" fill="none" stroke="#9b5de5" stroke-width="4"/>
          <path d="${starPath(66, 34, 26, 11, 5, -75)}" fill="#ffd23f"/>
          <path d="M18 24 v10 M13 29 h10 M88 64 v10 M83 69 h10 M84 8 v8 M80 12 h8" fill="none" stroke="#f15bb5" stroke-width="3"/>`),
        castle: wrap(`<path d="M10 32 V22 h7 v6 h6 v-6 h7 v10 M70 32 V22 h7 v6 h6 v-6 h7 v10" fill="none"/>
          <rect x="10" y="32" width="20" height="62" fill="#c0c7d6"/><rect x="70" y="32" width="20" height="62" fill="#c0c7d6"/>
          <rect x="28" y="46" width="44" height="48" fill="#dee2ff"/><path d="M28 46 V38 h8 v6 h8 v-6 h12 v6 h8 v-6 h8 v8" fill="#dee2ff"/>
          <path d="M42 94 V76 Q50 66 58 76 V94Z" fill="#8d5524"/><path d="M50 38 V10" fill="none"/><path d="M50 10 L66 15 L50 20Z" fill="#ef476f"/>
          <rect x="16" y="48" width="8" height="12" rx="4" fill="#2b2340"/><rect x="76" y="48" width="8" height="12" rx="4" fill="#2b2340"/>`),
        crown: wrap(`<path d="M12 78 L8 30 L30 52 L50 18 L70 52 L92 30 L88 78Z" fill="#ffd23f"/><rect x="12" y="74" width="76" height="14" rx="3" fill="#f4a261"/>
          <circle cx="50" cy="54" r="7" fill="#ef476f"/><circle cx="28" cy="64" r="5" fill="#4cc9f0"/><circle cx="72" cy="64" r="5" fill="#06d6a0"/>
          <circle cx="8" cy="30" r="4" fill="#fff"/><circle cx="50" cy="18" r="4" fill="#fff"/><circle cx="92" cy="30" r="4" fill="#fff"/>`),
        potion: wrap(`<rect x="40" y="6" width="20" height="12" rx="3" fill="#8d5524"/><path d="M42 18 V36 Q16 46 18 70 Q20 94 50 94 Q80 94 82 70 Q84 46 58 36 V18Z" fill="#e0fbfc"/>
          <path d="M20 64 Q50 56 80 64 Q82 92 50 92 Q18 92 20 64Z" fill="#f15bb5" stroke="none"/><path d="M42 18 V36 Q16 46 18 70 Q20 94 50 94 Q80 94 82 70 Q84 46 58 36 V18" fill="none"/>
          <circle cx="40" cy="74" r="4" fill="#fff" stroke="none" opacity="0.8"/><circle cx="58" cy="80" r="3" fill="#fff" stroke="none" opacity="0.8"/>`),
      },
    },
    faces: {
      label: "Faces",
      items: {
        happy: face("#ffd23f", `${eye(36, 42, 5)}${eye(64, 42, 5)}<path d="M30 60 q20 20 40 0" fill="none" stroke-width="4"/>${blush(26, 58)}${blush(74, 58)}`),
        laughing: face("#ffd23f", `<path d="M28 42 l8 -6 l8 6 M56 42 l8 -6 l8 6" fill="none" stroke-width="4"/>
          <path d="M26 56 H74 Q72 84 50 84 Q28 84 26 56Z" fill="${O}"/><path d="M36 74 Q50 66 64 74 Q60 82 50 82 Q40 82 36 74Z" fill="#ff6b9a" stroke="none"/>`),
        sad: face("#8ecae6", `${eye(36, 44, 5)}${eye(64, 44, 5)}<path d="M28 34 l12 -4 M72 34 l-12 -4" fill="none"/><path d="M34 72 q16 -14 32 0" fill="none" stroke-width="4"/>
          <path d="M28 52 q-4 8 0 12 q4 -4 0 -12z" fill="#4cc9f0" stroke-width="2"/>`),
        angry: face("#ff7b7b", `<path d="M26 32 l18 8 M74 32 l-18 8" fill="none" stroke-width="4"/>${eye(38, 46, 4.5)}${eye(62, 46, 4.5)}
          <path d="M34 72 q16 -12 32 0" fill="none" stroke-width="4"/><path d="M74 12 l6 6 m0 -6 l-6 6" fill="none" stroke="#ef233c"/>`),
        surprised: face("#ffd23f", `<circle cx="36" cy="42" r="9" fill="#fff"/><circle cx="64" cy="42" r="9" fill="#fff"/>${eye(36, 43, 4)}${eye(64, 43, 4)}
          <ellipse cx="50" cy="68" rx="9" ry="12" fill="${O}"/><path d="M28 26 q8 -6 14 -2 M58 24 q6 -4 14 2" fill="none"/>`),
        love: face("#ffd23f", `<path d="${heartPath(36, 42, 9)}" fill="#ef233c" stroke-width="2"/><path d="${heartPath(64, 42, 9)}" fill="#ef233c" stroke-width="2"/>
          <path d="M32 62 q18 18 36 0" fill="none" stroke-width="4"/>${blush(24, 58)}${blush(76, 58)}`),
        silly: face("#ffd23f", `${eye(36, 42, 5)}<path d="M56 42 q8 -6 16 0" fill="none" stroke-width="4"/><path d="M30 60 q20 14 40 0" fill="none" stroke-width="4"/>
          <path d="M46 66 v10 q6 10 12 0 v-12" fill="#ff6b9a"/>`),
        cool: face("#ffd23f", `<path d="M16 38 H84" fill="none" stroke-width="4"/><path d="M20 38 h26 q0 16 -13 16 q-13 0 -13 -16z M54 38 h26 q0 16 -13 16 q-13 0 -13 -16z" fill="${O}"/>
          <path d="M24 42 l6 -2 M58 42 l6 -2" stroke="#fff" stroke-width="2.5"/><path d="M38 68 q14 8 26 -4" fill="none" stroke-width="4"/>`),
        sleepy: face("#ffd23f", `<path d="M28 46 q8 6 16 0 M56 46 q8 6 16 0" fill="none" stroke-width="4"/><ellipse cx="50" cy="68" rx="6" ry="5" fill="${O}"/>
          <path d="M74 10 h10 l-10 12 h10 M86 26 h7 l-7 8 h7" fill="none" stroke="#4361ee" stroke-width="3"/>`),
      },
    },
    effects: {
      label: "Cartoon FX",
      items: {
        speech: wrap(`<path d="M14 16 H86 Q94 16 94 24 V60 Q94 68 86 68 H40 L22 88 L26 68 H14 Q6 68 6 60 V24 Q6 16 14 16Z" fill="#fff"/>
          <path d="M22 34 H78 M22 48 H62" fill="none" stroke="#c0c7d6" stroke-width="4"/>`),
        thought: wrap(`<path d="M24 66 Q6 66 8 48 Q8 32 24 32 Q26 14 46 14 Q60 10 70 22 Q92 20 92 42 Q94 64 72 64 Q64 74 48 68 Q36 74 24 66Z" fill="#fff"/>
          <circle cx="20" cy="80" r="6" fill="#fff"/><circle cx="10" cy="92" r="4" fill="#fff"/>`),
        heart: wrap(`<path d="${heartPath(50, 50, 30)}" fill="#ef233c"/><path d="M28 34 q4 -10 14 -10" fill="none" stroke="#fff" stroke-width="4" opacity="0.7"/>`),
        lightning: wrap(`<path d="M58 4 L22 54 H46 L36 96 L80 38 H54Z" fill="#ffd23f"/>`),
        pow: wrap(`<path d="${starPath(50, 50, 48, 30, 12)}" fill="#ffd23f"/><path d="${starPath(50, 50, 34, 22, 12, -75)}" fill="#ef476f" stroke="none"/>
          <text x="50" y="60" font-family="Impact, 'Arial Black', sans-serif" font-size="26" font-weight="900" text-anchor="middle" fill="#fff" stroke="${O}" stroke-width="2.5" paint-order="stroke">POW!</text>`),
        exclaim: wrap(`<path d="M38 8 H62 L56 66 H44Z" fill="#ef233c"/><circle cx="50" cy="84" r="10" fill="#ef233c"/>`),
        question: wrap(`<path d="M28 34 Q28 8 52 8 Q76 8 76 30 Q76 44 60 50 Q56 52 56 60 V66 H42 V56 Q42 44 54 40 Q62 36 62 30 Q62 22 52 22 Q42 22 42 34Z" fill="#4361ee"/><circle cx="49" cy="84" r="9" fill="#4361ee"/>`),
        music: wrap(`<path d="M34 76 V22 L84 10 V64" fill="none" stroke-width="7"/><path d="M34 22 L84 10 V22 L34 34Z" fill="${O}"/>
          <ellipse cx="24" cy="78" rx="12" ry="9" fill="#9b5de5"/><ellipse cx="74" cy="66" rx="12" ry="9" fill="#9b5de5"/>`),
        sweat: wrap(`<path d="M50 6 Q80 50 74 66 Q68 90 50 90 Q32 90 26 66 Q20 50 50 6Z" fill="#8ecae6"/><path d="M38 64 q0 12 10 16" fill="none" stroke="#fff" stroke-width="4"/>`),
      },
    },
  };

  /* ---------- loading ---------- */
  const cache = new Map(); // key -> {img, loaded, svg}
  const all = {};
  for (const [cat, def] of Object.entries(LIB)) {
    for (const [name, svg] of Object.entries(def.items)) all[cat + "/" + name] = svg;
  }

  function url(key) {
    const svg = all[key];
    return svg ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg) : null;
  }

  let pendingEmit = 0;
  function get(key) {
    let entry = cache.get(key);
    if (!entry) {
      const src = url(key);
      if (!src) return null;
      const img = new Image();
      entry = { img, loaded: false };
      cache.set(key, entry);
      entry.promise = new Promise((resolve) => {
        img.onload = () => {
          entry.loaded = true;
          resolve(img);
          clearTimeout(pendingEmit);
          pendingEmit = setTimeout(() => GAS.bus.emit("assets-loaded"), 30);
        };
        img.onerror = () => resolve(null);
      });
      img.src = src;
    }
    return entry.loaded ? entry.img : null;
  }
  function ready(keys) {
    return Promise.all(keys.map((k) => { get(k); const e = cache.get(k); return e ? e.promise : null; }));
  }
  function preloadAll() { return ready(Object.keys(all)); }

  GAS.stickers = { LIB, all, url, get, ready, preloadAll, starPath };
})();
