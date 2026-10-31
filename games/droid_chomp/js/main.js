/* Starts the game once the page and its scripts are ready. */
(function (D) {
  const game = new D.GameManager();
  D.game = game;
  game.start();
})(window.DROID);
