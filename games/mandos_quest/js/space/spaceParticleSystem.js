/* The particle pool, tuned for space: no gravity, and everything drifts back with the scroll. */
(function (MQ) {
  const { rand } = MQ.U;
  const { CHUNK, SPARK, SMOKE, DOT } = MQ.ParticleSystem.KIND;
  const TAU = MQ.TAU;

  class SpaceParticleSystem extends MQ.ParticleSystem {
    sparks(x, y, color, amount = 8, speed = 320) {
      for (let i = this.count(amount); i--;) {
        const a = Math.random() * TAU;
        const v = rand(speed * 0.3, speed);
        this.emit(SPARK, x, y, Math.cos(a) * v - 60, Math.sin(a) * v, rand(0.15, 0.4), rand(1.4, 3), color, 0, 3);
      }
    }

    smoke(x, y, color = "#4b4b55", amount = 1, size = 10) {
      for (let i = this.count(amount); i--;) {
        this.emit(SMOKE, x, y, rand(-190, -90), rand(-22, 22), rand(0.4, 0.8), size, color, 0, 0.8, size * 2.2);
      }
    }

    chunks(x, y, color, amount = 10, speed = 330) {
      for (let i = this.count(amount); i--;) {
        const a = Math.random() * TAU;
        const v = rand(speed * 0.2, speed);
        this.emit(CHUNK, x, y, Math.cos(a) * v - 90, Math.sin(a) * v, rand(0.6, 1.2), rand(4, 11), color, 0, 0.6);
      }
    }

    exhaust(x, y, color) {
      this.emit(DOT, x, y + rand(-3, 3), rand(-420, -250), rand(-18, 18), rand(0.15, 0.3), rand(2, 4), color, 0, 1);
    }
  }

  MQ.SpaceParticleSystem = SpaceParticleSystem;
})(window.MQ);
