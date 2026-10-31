/*
 * Sends visitors back to the arcade if they open a Coming Soon game by direct URL.
 * Add it to a game's <head>, after its <title>:
 *   <script src="../../assets/js/coming-soon-guard.js"></script>
 *
 * It only acts while the title starts with "Coming Soon", so publishing a game
 * switches it off without touching this line. The PIN dialog in arcade.js sets the
 * pass it checks. GitHub Pages can't enforce access, so this keeps casual visitors
 * out but can't stop someone who reads the public source.
 */
(function () {
  if (!/^\s*coming\s+soon\b/i.test(document.title)) return;

  var previewUntil = 0;
  try {
    previewUntil = Number(localStorage.getItem("gabysArcade.previewUntil")) || 0;
  } catch (error) {
    // Blocked storage means no pass, so the visitor is redirected like anyone else.
  }
  if (previewUntil > Date.now()) return;

  document.documentElement.style.display = "none";
  location.replace(new URL("../../index.html#coming-soon", document.currentScript.src).href);
})();
