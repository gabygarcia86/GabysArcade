// Entry point: renderer, shared world objects (ocean, sky, lights, particles), lighting and
// weather, the frame loop, full screen handling, and switching between menus and sessions.
import * as THREE from 'three';
import { SaveData } from './saveData.js';
import { WaveModel, Water, Sky } from './water.js';
import { PhysicsWorld } from './physics.js';
import { Particles, Rain, Lightning } from './effects.js';
import { Environment, ENVIRONMENTS, LIGHTING } from './environments.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Showroom } from './customization.js';
import { GameSession, AttractMode } from './game.js';

const isTouch = () => window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

class App {
  constructor() {
    this.save = new SaveData();
    this.quality = this.resolveQuality(this.save.settings.quality);
    this.audio = new AudioEngine(this.save);
    this.input = new Input(this.save);
    this.input.onPause = () => {
      if (this.session && !this.session.over) { if (this.session.paused) this.resume(); else this.pause(); }
    };

    const host = document.getElementById('canvas-host');
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.2, 3200);
    this.camera.position.set(0, 10, -20);

    this.waves = new WaveModel();
    this.water = new Water(this.waves, this.quality);
    this.sky = new Sky(this.quality);
    this.scene.add(this.water.mesh, this.sky.mesh);

    this.sun = new THREE.DirectionalLight('#fff3dc', 2.6);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#cfe9ff', '#2a6a7a', 1);
    this.scene.add(this.hemi);
    this.headlight = new THREE.PointLight('#fff1d0', 0, 40, 1.5);
    this.scene.add(this.headlight);

    this.physics = new PhysicsWorld(this.waves);
    this.cubeRT = new THREE.WebGLCubeRenderTarget(this.quality === 'high' ? 256 : 128, { type: THREE.HalfFloatType });
    this.cubeCam = new THREE.CubeCamera(1, 4000, this.cubeRT);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.captureScene = new THREE.Scene();
    this.lighting = LIGHTING.day;
    this.baseWaveIntensity = 1;
    this.sprayTint = 1;

    this.applyQualityObjects();
    this.ui = new UI(this);
    this.showroom = new Showroom(this);
    this.session = null;
    this.attract = null;
    this.env = null;
    this.showroomKind = null;

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('fullscreenchange', () => this.resize());
    document.addEventListener('webkitfullscreenchange', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.session && !this.session.over && !this.session.paused) this.pause();
    });
    this.resize();
    if (this.save.settings.tilt) this.input.enableTilt(true);
    this.last = performance.now();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  resolveQuality(q) {
    if (q && q !== 'auto') return q;
    const small = Math.min(window.screen.width, window.screen.height) < 600;
    if (isTouch()) return small ? 'low' : 'medium';
    return 'high';
  }

  applyQualityObjects() {
    const q = this.quality;
    const r = this.renderer;
    r.setPixelRatio(q === 'low' ? Math.min(window.devicePixelRatio, 1) : q === 'medium' ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    const ext = q === 'high' ? 45 : 32;
    Object.assign(this.sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 400 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.particleDensity = q === 'high' ? 1 : q === 'medium' ? 0.65 : 0.38;
    if (this.particles) { this.particles.mesh.removeFromParent(); this.particles.mesh.geometry.dispose(); this.particles.mesh.material.dispose(); }
    this.particles = new Particles(q === 'high' ? 3600 : q === 'medium' ? 2000 : 1000);
    this.scene.add(this.particles.mesh);
    if (this.env) this.env.ctx.particles = this.particles;
    if (this.rain) { this.rain.mesh.removeFromParent(); this.rain.mesh.geometry.dispose(); }
    this.rain = new Rain(q === 'high' ? 1600 : q === 'medium' ? 900 : 450);
    this.scene.add(this.rain.mesh);
    if (!this.lightning) { this.lightning = new Lightning(); this.scene.add(this.lightning.mesh); }
    this.resize();
  }

  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.water.setQuality(q);
    this.sky.setQuality(q);
    this.applyQualityObjects();
    if (this.env) this.applyLighting(this.lightingName, this.env.def);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.particles) this.particles.uniforms.uScale.value = (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.updateShowroomOffset();
    this.updateTouchLayout();
  }

  // ---------------------------------------------------------------- Environment and lighting
  loadEnvironment(id, weather) {
    if (this.env) { this.env.dispose(); this.env = null; }
    const def = ENVIRONMENTS[id];
    const name = !weather || weather === 'default' ? def.weather : weather;
    this.waves.time = 0;
    this.waves.event.active = false;
    this.waves.configure(def.waves, def.seed);
    const ctx = { waves: this.waves, physics: this.physics, particles: this.particles, quality: this.quality, lighting: LIGHTING[name] };
    this.env = new Environment(id, ctx);
    this.scene.add(this.env.group);
    this.water.setDepthMap(this.env.depthTex, this.env.depthRect);
    this.applyLighting(name, def);
    this.baseWaveIntensity = LIGHTING[name].waveMul;
    this.waves.setIntensity(this.baseWaveIntensity, true);
    return this.env;
  }

  applyLighting(name, def) {
    const L = LIGHTING[name];
    this.lighting = L;
    this.lightingName = name;
    const tint = def.tint || {};
    const c = (hex) => new THREE.Color(hex);
    const el = THREE.MathUtils.degToRad(L.sunElev), az = THREE.MathUtils.degToRad(L.sunAz);
    const sunDir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    this.sunDir = sunDir;
    const horizon = name === 'day' && tint.horizon ? tint.horizon : L.horizon;
    const fog = name === 'day' && tint.fog ? tint.fog : L.fog;
    const su = this.sky.uniforms;
    su.uTop.value.set(L.skyTop);
    su.uHorizon.value.set(horizon);
    su.uGround.value.set(L.ground);
    su.uSunDir.value.copy(sunDir);
    su.uSunColor.value.set(L.sunColor);
    su.uCloud.value = L.clouds;
    su.uCloudColor.value.set(L.cloudColor);
    su.uCloudShade.value.set(L.cloudShade);
    su.uNight.value = L.night;
    su.uSunSize.value = L.sunSize;
    const wu = this.water.uniforms;
    wu.uSunDir.value.copy(sunDir);
    wu.uSunColor.value.set(L.sunColor).multiplyScalar(L.night ? 0.5 : 1);
    const night = L.night ? 0.25 : name === 'storm' ? 0.55 : name === 'rain' ? 0.75 : name === 'sunset' ? 0.8 : 1;
    wu.uDeep.value.copy(c(def.colors.deep)).multiplyScalar(night);
    wu.uShallow.value.copy(c(def.colors.shallow)).multiplyScalar(night);
    wu.uFoam.value.copy(c(def.colors.foam)).multiplyScalar(L.night ? 0.45 : 1);
    wu.uReefA.value.copy(c(def.colors.reefA)).multiplyScalar(night);
    wu.uReefB.value.copy(c(def.colors.reefB)).multiplyScalar(night);
    wu.uSkyTop.value.set(L.skyTop);
    wu.uSkyHorizon.value.set(horizon);
    wu.uFogColor.value.set(fog);
    wu.uFogDensity.value = L.fogD;
    wu.uRain.value = L.rain;
    wu.uSpec.value = L.spec;
    this.particles.uniforms.uFogColor.value.set(fog);
    this.particles.uniforms.uFogDensity.value = L.fogD;
    this.scene.fog = new THREE.FogExp2(fog, L.fogD);
    this.sun.color.set(L.sunColor);
    this.sun.intensity = L.sunI;
    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGround);
    this.hemi.intensity = L.hemiI;
    this.baseHemi = L.hemiI;
    this.renderer.toneMappingExposure = L.exposure;
    this.headlight.intensity = L.night ? 60 : 0;
    this.sprayTint = L.night ? 0.4 : name === 'storm' ? 0.72 : name === 'rain' ? 0.82 : 1;
    this.rain.amount = L.rain;
    this.audio.setAmbience(1, L.rain);
    // Capture the sky into a cube map for water reflections and PBR lighting.
    this.sky.uniforms.uTime.value = 0;
    this.sky.mesh.position.set(0, 0, 0);
    this.captureScene.add(this.sky.mesh);
    this.cubeCam.position.set(0, 2, 0);
    this.cubeCam.update(this.renderer, this.captureScene);
    this.scene.add(this.sky.mesh);
    if (this.envMap) this.envMap.dispose();
    this.envMap = this.pmrem.fromCubemap(this.cubeRT.texture).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = L.night ? 0.35 : 0.8;
    wu.uEnvMap.value = this.cubeRT.texture;
    wu.uUseEnv.value = 1;
  }

  applyFlash(f) {
    this.sky.uniforms.uFlash.value = f;
    this.water.uniforms.uFlash.value = f * 0.6;
    this.hemi.intensity = (this.baseHemi || 1) + f * 2.5;
  }

  // ---------------------------------------------------------------- Menus and sessions
  ensureAttract() {
    if (this.session || this.attract) return;
    const d = this.save.data;
    const env = d.unlockedCourses.includes(d.last.env) ? d.last.env : 'paradise';
    this.attract = new AttractMode(this, env);
  }

  refreshAttract() {
    if (this.attract) this.attract.refreshLoadout();
  }

  setShowroom(kind) {
    this.showroomKind = kind;
    this.showroom.active = !!kind;
    this.updateShowroomOffset();
  }

  updateShowroomOffset() {
    if (!this.showroom) return;
    const w = window.innerWidth, h = window.innerHeight;
    // Keep the model visible beside (or above) the options panel. These match menus.css/mobile.css.
    let ox = 0, oy = 0;
    if (w > 760) ox = Math.min(460, w * 0.42) / 2;
    else if (w > h) ox = (w * 0.55) / 2;
    else oy = (h * 0.58) / 2;
    this.showroom.offsetPx = ox;
    this.showroom.offsetPy = oy;
  }

  startSession(cfg) {
    this.audio.unlock();
    this.requestFullscreen();
    if (this.attract) { this.attract.dispose(); this.attract = null; }
    if (this.session) { this.session.dispose(); this.session = null; }
    this.lastConfig = cfg;
    this.session = new GameSession(this, cfg);
    this.updateTouchLayout();
    this.save.save();
  }

  pause() {
    if (!this.session || this.session.over || this.session.paused) return;
    this.session.setPaused(true);
    this.ui.showPause();
    this.updateTouchLayout();
  }

  resume(silent = false) {
    if (!this.session) return;
    this.session.setPaused(false);
    this.ui.clear();
    if (!silent) this.updateTouchLayout();
  }

  restart() {
    const cfg = this.lastConfig;
    if (this.session) { this.session.dispose(); this.session = null; }
    if (cfg.mode === 'championship') {
      // Restarting a championship race replays the same race.
      const run = this.save.data.cups[cfg.cup] && this.save.data.cups[cfg.cup].run;
      if (run) cfg.raceIndex = Math.min(cfg.raceIndex, run.raceIndex);
    }
    this.startSession(cfg);
  }

  quitToMenu(silent = false) {
    if (this.session) { this.session.dispose(); this.session = null; }
    this.ui.hideHUD();
    this.updateTouchLayout();
    this.audio.silenceEngine();
    if (!silent) this.ui.showMainMenu();
    else this.ensureAttract();
  }

  updateTouchLayout() {
    const touch = document.getElementById('touch');
    const playing = this.session && !this.session.over && !this.session.paused;
    const show = playing && (isTouch() || this.input.usingTouch);
    touch.classList.toggle('hidden', !show);
    touch.classList.toggle('tilt', !!this.save.settings.tilt);
    const portrait = window.innerHeight > window.innerWidth;
    const block = show && portrait;
    document.getElementById('rotate-msg').classList.toggle('hidden', !block);
    this.rotateBlocked = block;
    this.input.gameActive = !!playing;
  }

  // ---------------------------------------------------------------- Full screen
  isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  async requestFullscreen() {
    if (!this.save.settings.fullscreen || this.isFullscreen()) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try {
      await req.call(el, { navigationUI: 'hide' });
      if (screen.orientation && screen.orientation.lock && isTouch()) screen.orientation.lock('landscape').catch(() => {});
    } catch (error) { /* the browser said no; carry on windowed */ }
  }

  async toggleFullscreen() {
    if (this.isFullscreen()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) await exit.call(document).catch(() => {});
    } else {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) await req.call(el).catch(() => {});
    }
  }

  // ---------------------------------------------------------------- Frame loop
  frame(t) {
    const dt = Math.min(0.1, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    const s = this.session;
    if (this.showroomKind) {
      this.showroom.update(dt);
      this.showroom.render(this.renderer, window.innerWidth, window.innerHeight);
      return;
    }
    const running = s && !s.paused && !this.rotateBlocked;
    if (running) s.update(dt);
    else if (!s && this.attract) this.attract.update(dt);
    // Keep the camera FOV-dependent particle scale in sync.
    this.particles.uniforms.uScale.value = (window.innerHeight * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    const cam = this.camera;
    this.water.update(cam);
    this.sky.mesh.position.copy(cam.position);
    this.sky.uniforms.uTime.value = this.waves.time;
    const focus = s ? s.player.body.renderPos : this.attract ? this.attract.entity.body.renderPos : cam.position;
    if (this.sunDir) {
      this.sun.target.position.copy(focus);
      this.sun.position.copy(focus).addScaledVector(this.sunDir, 150);
    }
    if (this.headlight.intensity > 0) this.headlight.position.copy(focus).add(new THREE.Vector3(0, 4, 0));
    if (running || (!s && this.attract)) {
      this.particles.update(dt, this.waves);
      this.rain.update(dt, cam.position);
    }
    this.renderer.render(this.scene, cam);
  }
}

// ---------------------------------------------------------------- Boot
async function boot() {
  const fill = document.getElementById('load-fill');
  const text = document.getElementById('load-text');
  const step = async (pct, msg) => {
    fill.style.width = `${pct}%`;
    text.textContent = msg;
    await new Promise((r) => setTimeout(r, 30));
  };
  try {
    await step(15, 'Filling the ocean...');
    const app = new App();
    window.jetSkiParadise = app;
    await step(55, 'Planting palm trees...');
    app.ensureAttract();
    await step(90, 'Waxing the jet skis...');
    document.getElementById('loading').classList.add('hidden');
    app.ui.showSplash(() => {
      app.audio.unlock();
      app.requestFullscreen();
      app.ui.showMainMenu();
    });
  } catch (error) {
    console.error(error);
    window.showBootError(`Jet Ski Paradise couldn't start: ${error.message}. Try a browser with WebGL 2 enabled.`);
  }
}

boot();
