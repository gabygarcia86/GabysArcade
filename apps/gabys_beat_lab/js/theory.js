/* Music theory helpers: note names, scales, chords. */
(function () {
  "use strict";
  const GBL = window.GBL;

  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteName = (midi) => NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  const isBlack = (midi) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
  };

  /* Scale presets offered in the piano roll. */
  const SCALES = [
    { id: "none", name: "No scale", root: 0, mode: null },
    { id: "C-major", name: "C Major", root: 0, mode: "major" },
    { id: "G-major", name: "G Major", root: 7, mode: "major" },
    { id: "D-major", name: "D Major", root: 2, mode: "major" },
    { id: "F-major", name: "F Major", root: 5, mode: "major" },
    { id: "A-minor", name: "A Minor", root: 9, mode: "minor" },
    { id: "E-minor", name: "E Minor", root: 4, mode: "minor" },
    { id: "C-minor", name: "C Minor", root: 0, mode: "minor" },
  ];
  const scaleById = (id) => SCALES.find((s) => s.id === id) || SCALES[0];

  function inScale(midi, scale) {
    if (!scale || !scale.mode) return true;
    const pc = (((midi - scale.root) % 12) + 12) % 12;
    return MODES[scale.mode].includes(pc);
  }

  /* MIDI notes of the scale between lo and hi (inclusive). */
  function scaleNotes(scale, lo, hi) {
    const out = [];
    for (let m = lo; m <= hi; m++) if (inScale(m, scale)) out.push(m);
    return out;
  }

  /* Snap a pitch to the nearest note in the scale. */
  function snapToScale(midi, scale) {
    if (!scale || !scale.mode) return midi;
    for (let d = 0; d < 12; d++) {
      if (inScale(midi + d, scale)) return midi + d;
      if (inScale(midi - d, scale)) return midi - d;
    }
    return midi;
  }

  const ROMAN_MAJOR = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
  const ROMAN_MINOR = ["i", "ii°", "III", "iv", "v", "VI", "VII"];

  /* Triad (or 7th) built on scale degree (0-based) in the given scale, near octave base. */
  function diatonicChord(scale, degree, base = 60, seventh = false) {
    const mode = MODES[scale.mode || "major"];
    const notes = [];
    const count = seventh ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const idx = degree + i * 2;
      const oct = Math.floor(idx / 7);
      notes.push(scale.root + mode[idx % 7] + 12 * oct);
    }
    // move to the octave around base
    let shift = Math.round((base - notes[0]) / 12) * 12;
    return notes.map((n) => n + shift);
  }

  function chordName(scale, degree) {
    const notes = diatonicChord(scale, degree, 60);
    const root = NOTE_NAMES[((notes[0] % 12) + 12) % 12];
    const third = notes[1] - notes[0], fifth = notes[2] - notes[0];
    let q = "";
    if (third === 3 && fifth === 6) q = "dim";
    else if (third === 3) q = "m";
    return root + q;
  }

  function chordSuggestions(scale) {
    const s = scale && scale.mode ? scale : SCALES[1];
    const roman = s.mode === "minor" ? ROMAN_MINOR : ROMAN_MAJOR;
    return [0, 1, 2, 3, 4, 5, 6].map((d) => ({ degree: d, roman: roman[d], name: chordName(s, d), notes: diatonicChord(s, d, 60) }));
  }

  /* Popular progressions by scale degree. */
  const PROGRESSIONS = {
    major: [[0, 4, 5, 3], [0, 3, 4, 3], [5, 3, 0, 4], [0, 5, 3, 4], [1, 4, 0, 0], [0, 3, 0, 4]],
    minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 6], [0, 3, 6, 2], [0, 5, 3, 4]],
  };

  Object.assign(GBL, {
    theory: {
      NOTE_NAMES, noteName, isBlack, midiToFreq, MODES, SCALES, scaleById, inScale, scaleNotes, snapToScale,
      diatonicChord, chordName, chordSuggestions, PROGRESSIONS,
    },
  });
})();
