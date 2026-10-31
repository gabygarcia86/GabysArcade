/* Starts the game once the page and its scripts are ready. */
(function (J) {
  const game = new J.GameEngine();
  J.game = game;
  game.start();
})(window.JEDI);
