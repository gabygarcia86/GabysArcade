/*
 * Popups on touch and small screens, kept off the player. They show one at a time, below
 * the picture if there is room, otherwise along its top, or its bottom if the player is up there.
 * A popup's timer waits until it is showing.
 */
(function (MQ) {
  const { clamp } = MQ.U;
  const { min, max, round } = Math;

  const MIN_ROOM = 80; // CSS pixels needed below the picture.
  const EDGE = 12; // Also leaves room for a toast to slide in.
  const STATUS_RIGHT = 306; // The status panel and a gap.
  const MISSION_WIDTH = 278; // The mission panel and a gap.
  const BOSS_BAR = 66;
  const MAX_HEIGHT = 130; // Short enough that the top and bottom places can't both reach the player.
  const PAD_X = 20; // Around the player, for the cape and weapon.
  const PAD_Y = 12;
  const RETURN_GAP = 70; // How clear the top must be before a popup moves back up.

  class Notices {
    constructor(canvas, hud) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.hud = hud;
      this.enabled = false;
      this.below = false;
      this.low = false;
      this.place = null;
      this.width = 0;
      this.height = 0;
      this.gapLeft = 0;
      this.gapRight = MQ.VW;
    }

    /*
     * In CSS pixels: stage is the picture, safe the screen inside any notch,
     * and buttons the rectangles of the visible touch controls.
     */
    layout(stage, safe, buttons, enabled) {
      this.enabled = enabled;

      let floor = safe.bottom;
      let gapLeft = stage.left;
      let gapRight = stage.right;
      const middle = (stage.left + stage.right) / 2;
      for (const r of buttons) {
        floor = min(floor, r.top);
        if (r.top >= stage.bottom) continue;
        if (r.right <= middle) gapLeft = max(gapLeft, r.right + 6);
        else if (r.left >= middle) gapRight = min(gapRight, r.left - 6);
      }
      const unit = MQ.VW / (stage.right - stage.left);
      this.gapLeft = (gapLeft - stage.left) * unit;
      this.gapRight = (gapRight - stage.left) * unit;

      this.width = safe.right - safe.left;
      this.height = floor - stage.bottom;
      this.below = enabled && this.height >= MIN_ROOM;
      this.canvas.hidden = !this.below;
      if (!this.below) return;

      Object.assign(this.canvas.style, {
        left: `${safe.left}px`,
        top: `${stage.bottom}px`,
        width: `${this.width}px`,
        height: `${this.height}px`,
      });
      const ratio = min(window.devicePixelRatio || 1, 2);
      this.canvas.width = round(this.width * ratio);
      this.canvas.height = round(this.height * ratio);
    }

    // Chooses the popup and its place. Runs before the HUD draws, which may have to make room.
    plan(ctx, world) {
      this.place = null;
      const kind = this.hud.nextPopup();
      if (!kind) {
        this.low = false;
        return;
      }
      this.place = this.below ? this.planBelow(kind) : this.planInPicture(ctx, world, kind);
    }

    planBelow(kind) {
      const room = this.width - EDGE * 2;
      const card = this.hud.popup(this.ctx, kind, room);
      const scale = min(1, (this.height - EDGE * 2) / card.height);
      return { kind, card, scale, x: this.width / 2, y: EDGE };
    }

    planInPicture(ctx, world, kind) {
      const { hud } = this;
      const s = hud.scale;
      const fighting = hud.bossFight(world);
      const { crowded } = hud;

      const fit = (left, right) => {
        const card = hud.popup(ctx, kind, (right - left) / s);
        const scale = s * min(1, MAX_HEIGHT / card.height);
        const halfWidth = (card.width * scale) / 2;
        const x = (left + right) / 2;
        return { kind, card, scale, x, left: x - halfWidth, right: x + halfWidth, height: card.height * scale };
      };
      const top = () => {
        // With no room between the two panels, the mission panel steps aside.
        const place = fit(STATUS_RIGHT * s, MQ.VW - hud.rightInset - (crowded ? 0 : MISSION_WIDTH * s));
        place.y = (fighting && !crowded ? BOSS_BAR + 4 : EDGE) * s;
        place.coversMission = crowded;
        return place;
      };
      const bottom = () => {
        const place = fit(clamp(this.gapLeft, EDGE, MQ.VW), clamp(this.gapRight, 0, MQ.VW - EDGE));
        place.y = MQ.VH - EDGE * s - place.height - (fighting && crowded ? BOSS_BAR * s : 0);
        return place;
      };

      const high = top();
      if (this.clearOfPlayer(high, world, this.low ? RETURN_GAP : 0)) {
        this.low = false;
        return high;
      }
      const low = bottom();
      if (this.clearOfPlayer(low, world)) {
        this.low = true;
        return low;
      }
      this.low = false;
      return this.clearOfPlayer(high, world) ? high : null;
    }

    clearOfPlayer(place, world, gap = 0) {
      const { player, camera } = world;
      const { zoom } = camera;
      const x = (player.x - camera.x + camera.shakeX) * zoom;
      const feet = (player.y - camera.y + camera.shakeY) * zoom;
      const reach = (player.w / 2 + PAD_X) * zoom;
      const head = feet - (player.h + PAD_Y) * zoom;
      return place.right < x - reach || place.left > x + reach ||
        place.y + place.height + gap < head || place.y > feet + PAD_Y * zoom;
    }

    draw(ctx, world) {
      if (!this.place) return;
      const { kind, card, scale, x, y } = this.place;
      let target = ctx;
      if (this.below) {
        target = this.ctx;
        const ratio = this.canvas.width / this.width;
        target.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
      target.save();
      target.translate(x, y);
      target.scale(scale, scale);
      this.hud.drawPopup(target, world, kind, card);
      target.restore();
    }

    clear() {
      if (!this.below) return;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  MQ.Notices = Notices;
})(window.MQ);
