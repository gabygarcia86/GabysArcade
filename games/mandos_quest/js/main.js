/* Starts the game once every script has loaded. */
(function (MQ) {
  MQ.game = new MQ.GameEngine();
  MQ.game.start();
})(window.MQ);
