// The 3D showroom (rotating, zoomable preview) plus the Character and Garage screens:
// rider appearance, clothing and gear; jet ski models, paint, graphics, decals and upgrades.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { JetSkiModel } from './jetSki.js';
import { Rider } from './rider.js';
import { deriveHandling } from './physics.js';
import {
  SKIS, skiById, UPGRADES, UPGRADE_MAX, UPGRADE_COST, UPGRADE_STEP, PAINT_PRESETS, FINISHES, GRAPHICS, DECALS, EXHAUSTS,
  SKIN_TONES, HAIR_COLORS, CLOTH_COLORS, HAIR_STYLES, FACES, TOPS, BOTTOMS, GLOVES, SHOES, HELMETS, EYEWEAR, VESTS, RIDER_PRESETS, MPH,
} from './data.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- Showroom
export class Showroom {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 256;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#0b3a66');
    grd.addColorStop(0.55, '#127a9e');
    grd.addColorStop(1, '#0a2238');
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 256);
    const bg = new THREE.CanvasTexture(cv);
    bg.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = bg;
    const pmrem = new THREE.PMREMGenerator(app.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.scene.add(new THREE.HemisphereLight('#d8f0ff', '#1a3a4a', 1.1));
    const key = new THREE.DirectionalLight('#fff4e0', 2.2);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#7fe6ff', 1.2);
    rim.position.set(-5, 3, -6);
    this.scene.add(rim);
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.35, 64), new THREE.MeshStandardMaterial({ color: '#16222e', roughness: 0.35, metalness: 0.6 }));
    plat.position.y = -0.5;
    plat.receiveShadow = true;
    this.scene.add(plat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.04, 8, 96), new THREE.MeshBasicMaterial({ color: '#2ef2ff' }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.32;
    this.scene.add(ring);
    this.turn = new THREE.Group();
    this.scene.add(this.turn);
    this.yaw = 0.7;
    this.pitch = 0.2;
    this.dist = 6.5;
    this.targetDist = 6.5;
    this.target = new THREE.Vector3(0, 0.3, 0);
    this.focusTarget = new THREE.Vector3(0, 0.3, 0);
    this.idle = 0;
    this.active = false;
    this.time = 0;
    this.offsetPx = 0;
    this.bindPointer(app.renderer.domElement);
  }

  bindPointer(el) {
    const pts = new Map();
    let pinch = 0;
    el.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      this.idle = 0;
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.active || !pts.has(e.pointerId)) return;
      const p = pts.get(e.pointerId);
      if (pts.size === 1) {
        this.yaw -= (e.clientX - p.x) * 0.008;
        this.pitch = Math.max(-0.1, Math.min(0.9, this.pitch + (e.clientY - p.y) * 0.005));
      }
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoom((pinch - d) * 0.02);
        pinch = d;
      }
      this.idle = 0;
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.zoom(e.deltaY * 0.004);
    }, { passive: false });
  }

  zoom(d) {
    this.targetDist = Math.max(this.minDist, Math.min(this.maxDist, this.targetDist + d));
    this.idle = 0;
  }

  focus(kind) {
    if (kind === 'rider') {
      this.focusTarget.set(0, 1.05, -0.1);
      this.targetDist = 3.4; this.minDist = 1.6; this.maxDist = 7;
    } else {
      this.focusTarget.set(0, 0.35, 0);
      this.targetDist = 6.6; this.minDist = 3; this.maxDist = 11;
    }
  }

  setLoadout(skiId, custom, look) {
    const key = JSON.stringify([skiId, custom, look]);
    if (key === this.key) return;
    this.key = key;
    if (this.model) { this.model.group.removeFromParent(); this.model.dispose(); }
    if (this.rider) { this.rider.dispose(); }
    this.model = new JetSkiModel(skiId, custom);
    this.rider = new Rider(look);
    this.model.body.add(this.rider.root);
    this.rider.fitToSki(this.model);
    this.model.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.model.group.position.y = -0.05;
    this.turn.add(this.model.group);
  }

  update(dt) {
    this.time += dt;
    this.idle += dt;
    if (this.idle > 2.5) this.yaw += dt * 0.35;
    this.dist += (this.targetDist - this.dist) * (1 - Math.exp(-dt * 8));
    this.target.lerp(this.focusTarget, 1 - Math.exp(-dt * 6));
    const c = this.camera;
    // Narrow (portrait) views need the camera further back to fit the model's width.
    const d = this.dist * Math.min(2.2, Math.max(1, 1.25 / (this.aspect || 1.5)));
    c.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d,
      this.target.y + Math.sin(this.pitch) * d + 0.3,
      this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d,
    );
    c.lookAt(this.target);
    if (this.rider) {
      const steer = Math.sin(this.time * 0.9) * 0.5;
      this.rider.update(dt, { steer, throttle: 0.3, brake: 0, airborne: false, trickPose: null, speed: 8, celebrate: false });
      this.model.setSteer(steer);
      this.model.group.position.y = -0.05 + Math.sin(this.time * 1.6) * 0.03;
      this.model.group.rotation.z = Math.sin(this.time * 1.2) * 0.02;
    }
  }

  render(renderer, w, h) {
    const c = this.camera;
    c.aspect = w / h;
    this.aspect = c.aspect;
    if (this.offsetPx || this.offsetPy) c.setViewOffset(w, h, this.offsetPx || 0, this.offsetPy || 0, w, h); else c.clearViewOffset();
    c.updateProjectionMatrix();
    renderer.render(this.scene, c);
  }
}

// ---------------------------------------------------------------- Shared bits
function priceTag(price, owned) {
  if (owned || !price) return '';
  return `<span class="price">🔒 ${price.toLocaleString()}</span>`;
}

function swatches(colors, current, action, extra = '') {
  return `<div class="swatches">${colors.map((c) => `<button type="button" class="swatch${c.toLowerCase() === String(current).toLowerCase() ? ' on' : ''}" style="--c:${c}" data-action="${action}" data-value="${c}" aria-label="${c}"></button>`).join('')}${extra}</div>`;
}

function chips(list, current, action, ownedFn) {
  return `<div class="chips">${list.map((it) => {
    const owned = ownedFn ? ownedFn(it) : true;
    return `<button type="button" class="chip${it.id === current ? ' on' : ''}${owned ? '' : ' locked'}" data-action="${action}" data-value="${it.id}">${esc(it.name)}${priceTag(it.price, owned)}</button>`;
  }).join('')}</div>`;
}

// Two-step purchase: first tap previews and asks, second tap buys.
function tryBuy(ui, key, price, label, onBought) {
  const save = ui.app.save;
  if (!price || save.owns(key)) { onBought(); return true; }
  if (ui.pendingBuy !== key) {
    ui.pendingBuy = key;
    ui.toast(`Tap again to buy ${label} for ${price.toLocaleString()} coins`);
    return false;
  }
  ui.pendingBuy = null;
  if (save.coins < price) {
    ui.toast(`You need ${(price - save.coins).toLocaleString()} more coins`);
    ui.app.audio.wrong();
    return false;
  }
  save.spend(price);
  save.ownItem(key);
  ui.app.audio.coin();
  ui.toast(`Bought ${label}!`);
  onBought();
  return true;
}

// ---------------------------------------------------------------- Character screen
const RIDER_TABS = [['presets', 'Presets'], ['body', 'Body'], ['hair', 'Hair & Face'], ['outfit', 'Outfit'], ['gear', 'Gear']];

export function showCharacter(ui, back) {
  const app = ui.app;
  const save = app.save;
  let tab = 'presets';
  let paintTarget = 'topColor';
  const look = () => save.data.rider;
  const preview = () => {
    const d = save.data;
    const id = d.skis.selected;
    app.showroom.setLoadout(id, { ...skiById(id).colors, ...d.skis.custom[id] }, look());
  };
  const owned = (cat) => (it) => !it.price || save.owns(`${cat}:${it.id}`);
  const section = (title, body) => `<div class="opt-group"><h4>${title}</h4>${body}</div>`;
  const render = () => {
    const L = look();
    let body = '';
    if (tab === 'presets') {
      body = `<div class="preset-grid">${RIDER_PRESETS.map((p, i) => `<button type="button" class="preset" data-action="preset" data-value="${i}"><span class="preset-dot" style="--a:${p.look.topColor};--b:${p.look.skin}"></span>${esc(p.name)}</button>`).join('')}</div>
        <p class="hint">Presets only use free items. Fine-tune every detail in the other tabs.</p>`;
    } else if (tab === 'body') {
      body = section('Rider', chips([{ id: 'male', name: 'Male' }, { id: 'female', name: 'Female' }], L.body, 'set:body'))
        + section('Skin tone', swatches(SKIN_TONES, L.skin, 'set:skin'));
    } else if (tab === 'hair') {
      body = section('Hairstyle', chips(HAIR_STYLES, L.hair, 'set:hair'))
        + section('Hair colour', swatches(HAIR_COLORS, L.hairColor, 'set:hairColor'))
        + section('Face', chips(FACES, L.face, 'set:face'));
    } else if (tab === 'outfit') {
      const targets = [['topColor', 'Top'], ['accentColor', 'Accent'], ['bottomColor', 'Shorts / Legs'], ['vestColor', 'Life Jacket'], ['gloveColor', 'Gloves'], ['shoeColor', 'Shoes']];
      body = section('Top', chips(TOPS, L.top, 'buy:top', owned('top')))
        + section('Bottoms', chips(BOTTOMS, L.bottom, 'buy:bottom', owned('bottom')))
        + section('Gloves', chips(GLOVES, L.gloves, 'buy:gloves', owned('gloves')))
        + section('Water shoes', chips(SHOES, L.shoes, 'buy:shoes', owned('shoes')))
        + section('Colours', `<div class="chips small">${targets.map(([k, n]) => `<button type="button" class="chip${paintTarget === k ? ' on' : ''}" data-action="target" data-value="${k}">${n}</button>`).join('')}</div>`
          + swatches(CLOTH_COLORS, L[paintTarget], 'color', `<label class="swatch custom" aria-label="Custom colour"><input type="color" data-input="color" value="${L[paintTarget]}"></label>`));
    } else if (tab === 'gear') {
      body = section('Helmet', chips(HELMETS, L.helmet, 'buy:helmet', owned('helmet')))
        + section('Helmet colour', swatches(CLOTH_COLORS, L.helmetColor, 'set:helmetColor'))
        + section('Eyewear', chips(EYEWEAR, L.eyewear, 'buy:eyewear', owned('eyewear')))
        + section('Life jacket', chips(VESTS, L.vest, 'buy:vest', owned('vest')));
    }
    ui.screen('character', `
      <div class="side-panel">
        <header class="panel-head"><button type="button" class="back" data-action="back">‹ Back</button><h2>Rider</h2>${ui.coinBadge()}</header>
        <nav class="tabs">${RIDER_TABS.map(([id, n]) => `<button type="button" class="tab${tab === id ? ' on' : ''}" data-action="tab" data-value="${id}">${n}</button>`).join('')}</nav>
        <div class="panel-body">${body}</div>
        <p class="hint drag-hint">Drag to rotate · scroll or pinch to zoom</p>
      </div>`, {
      showroom: 'rider',
      back,
      onAction(action, value) {
        if (action === 'tab') { tab = value; render(); return; }
        if (action === 'target') { paintTarget = value; render(); return; }
        if (action === 'preset') {
          const p = RIDER_PRESETS[Number(value)];
          save.data.rider = { ...save.data.rider, ...p.look };
          save.save(); preview(); render();
          ui.toast(`Preset: ${p.name}`);
          return;
        }
        if (action === 'color') { look()[paintTarget] = value; save.save(); preview(); render(); return; }
        if (action.startsWith('set:')) { look()[action.slice(4)] = value; save.save(); preview(); render(); return; }
        if (action.startsWith('buy:')) {
          const cat = action.slice(4);
          const list = { top: TOPS, bottom: BOTTOMS, gloves: GLOVES, shoes: SHOES, helmet: HELMETS, eyewear: EYEWEAR, vest: VESTS }[cat];
          const item = list.find((i) => i.id === value);
          const apply = () => {
            look()[cat] = value;
            if (item.price) save.unlock('stylish') && ui.toast('🏆 Island Style unlocked!');
            save.save(); preview(); render();
          };
          if (!tryBuy(ui, `${cat}:${value}`, item.price, item.name, apply)) {
            // Preview the locked item without saving it.
            app.showroom.setLoadout(save.data.skis.selected, { ...skiById(save.data.skis.selected).colors, ...save.data.skis.custom[save.data.skis.selected] }, { ...look(), [cat]: value });
          }
        }
      },
      onInput(name, value) {
        if (name === 'color') { look()[paintTarget] = value; save.save(); preview(); }
      },
    });
  };
  preview();
  app.showroom.focus('rider');
  render();
}

// ---------------------------------------------------------------- Garage screen
const GARAGE_TABS = [['models', 'Jet Skis'], ['paint', 'Paint'], ['style', 'Graphics'], ['upgrades', 'Upgrades']];

export function statBars(stats, upgrades = {}) {
  const rows = [['speed', 'Speed', 'engine'], ['handling', 'Handling', 'steering'], ['accel', 'Acceleration', 'accel'], ['stability', 'Stability', 'stability']];
  return `<div class="stats">${rows.map(([k, n, u]) => {
    const base = stats[k];
    const bonus = (upgrades[u] || 0) * UPGRADE_STEP;
    return `<div class="stat"><span>${n}</span><div class="bar"><i style="width:${base * 10}%"></i><b style="left:${base * 10}%;width:${bonus * 10}%"></b></div><em>${base}${bonus ? `<small>+${bonus}</small>` : ''}</em></div>`;
  }).join('')}</div>`;
}

export function showGarage(ui, back) {
  const app = ui.app;
  const save = app.save;
  const d = save.data;
  let tab = 'models';
  let viewId = d.skis.selected;
  let part = 'main';
  const custom = () => d.skis.custom[viewId];
  const preview = () => app.showroom.setLoadout(viewId, { ...skiById(viewId).colors, ...custom() }, d.rider);
  const ownedItem = (cat) => (it) => !it.price || save.owns(`${cat}:${it.id}`);
  const section = (title, body) => `<div class="opt-group"><h4>${title}</h4>${body}</div>`;
  const render = () => {
    const def = skiById(viewId);
    const own = save.ownsSki(viewId);
    const up = save.upgradeLevels(viewId);
    const h = deriveHandling(def.stats, up);
    let body = '';
    if (tab === 'models') {
      body = `<div class="ski-list">${SKIS.map((s) => {
        const o = save.ownsSki(s.id);
        return `<button type="button" class="ski-card${s.id === viewId ? ' on' : ''}${d.skis.selected === s.id ? ' selected' : ''}" data-action="view" data-value="${s.id}">
          <span class="ski-swatch" style="--a:${(d.skis.custom[s.id] || s.colors).main};--b:${(d.skis.custom[s.id] || s.colors).secondary}"></span>
          <b>${esc(s.name)}</b><small>${o ? (d.skis.selected === s.id ? 'Riding' : 'Owned') : `🔒 ${s.price.toLocaleString()}`}</small></button>`;
      }).join('')}</div>`;
    } else if (!own) {
      body = '<p class="hint">Buy this jet ski to customize it.</p>';
    } else if (tab === 'paint') {
      const parts = [['main', 'Main body'], ['secondary', 'Secondary'], ['seat', 'Seat'], ['handlebar', 'Handlebars']];
      body = section('Part', `<div class="chips small">${parts.map(([k, n]) => `<button type="button" class="chip${part === k ? ' on' : ''}" data-action="part" data-value="${k}">${n}</button>`).join('')}</div>`)
        + section('Colour', swatches(PAINT_PRESETS, custom()[part], 'paint', `<label class="swatch custom" aria-label="Custom colour"><input type="color" data-input="paint" value="${custom()[part]}"></label>`))
        + section('Paint finish', chips(FINISHES, custom().finish, 'buy:finish', ownedItem('finish')))
        + section('Racing number', `<div class="number-row"><button type="button" class="chip" data-action="num" data-value="-1">−</button><b class="race-num">${custom().number}</b><button type="button" class="chip" data-action="num" data-value="1">+</button></div>`);
    } else if (tab === 'style') {
      body = section('Graphics', chips(GRAPHICS, custom().graphic, 'buy:graphic', ownedItem('graphic')))
        + section('Decals', chips(DECALS, custom().decal, 'buy:decal', ownedItem('decal')))
        + section('Exhaust', chips(EXHAUSTS, custom().exhaust, 'buy:exhaust', ownedItem('exhaust')));
    } else if (tab === 'upgrades') {
      body = `<div class="upgrades">${UPGRADES.map((u) => {
        const lvl = up[u.id] || 0;
        const cost = UPGRADE_COST[lvl];
        return `<div class="upgrade"><div><b>${u.name}</b><small>${u.desc}</small><span class="pips">${Array.from({ length: UPGRADE_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span></div>
          ${lvl >= UPGRADE_MAX ? '<span class="maxed">MAX</span>' : `<button type="button" class="btn small" data-action="upgrade" data-value="${u.id}">${cost.toLocaleString()} 🪙</button>`}</div>`;
      }).join('')}</div>`;
    }
    const action = own
      ? (d.skis.selected === viewId ? '<span class="tag good">Currently riding</span>' : '<button type="button" class="btn" data-action="select">Ride this jet ski</button>')
      : `<button type="button" class="btn gold" data-action="buyski">Buy for ${def.price.toLocaleString()} 🪙</button>`;
    ui.screen('garage', `
      <div class="side-panel">
        <header class="panel-head"><button type="button" class="back" data-action="back">‹ Back</button><h2>Garage</h2>${ui.coinBadge()}</header>
        <div class="ski-head">
          <h3>${esc(def.name)}</h3>
          <p>${esc(def.desc)}</p>
          ${statBars(def.stats, up)}
          <p class="tiny">Top speed ${Math.round(h.maxSpeed * MPH)} mph · Boost tank ${Math.round(h.boostMax)}</p>
          <div class="ski-action">${action}</div>
        </div>
        <nav class="tabs">${GARAGE_TABS.map(([id, n]) => `<button type="button" class="tab${tab === id ? ' on' : ''}" data-action="tab" data-value="${id}">${n}</button>`).join('')}</nav>
        <div class="panel-body">${body}</div>
        <p class="hint drag-hint">Drag to rotate · scroll or pinch to zoom</p>
      </div>`, {
      showroom: 'ski',
      back,
      onAction(action, value) {
        if (action === 'tab') { tab = value; render(); return; }
        if (action === 'view') { viewId = value; preview(); render(); return; }
        if (action === 'part') { part = value; render(); return; }
        if (action === 'select') { d.skis.selected = viewId; save.save(); app.audio.click(); render(); return; }
        if (action === 'buyski') {
          const def2 = skiById(viewId);
          if (ui.pendingBuy !== `ski:${viewId}`) { ui.pendingBuy = `ski:${viewId}`; ui.toast(`Tap again to buy the ${def2.name} for ${def2.price.toLocaleString()} coins`); return; }
          ui.pendingBuy = null;
          if (save.coins < def2.price) { ui.toast(`You need ${(def2.price - save.coins).toLocaleString()} more coins`); app.audio.wrong(); return; }
          save.spend(def2.price);
          d.skis.owned.push(viewId);
          d.skis.selected = viewId;
          app.audio.coin();
          ui.toast(`The ${def2.name} is yours!`);
          if (d.skis.owned.length >= 4) save.unlock('garage4');
          if (d.skis.owned.length >= SKIS.length) save.unlock('garageAll');
          save.save();
          render();
          return;
        }
        if (action === 'paint') { custom()[part] = value; save.save(); preview(); render(); return; }
        if (action === 'num') { custom().number = (custom().number + Number(value) + 100) % 100; save.save(); preview(); render(); return; }
        if (action === 'upgrade') {
          const lvl = up[value] || 0;
          const cost = UPGRADE_COST[lvl];
          if (save.coins < cost) { ui.toast(`You need ${(cost - save.coins).toLocaleString()} more coins`); app.audio.wrong(); return; }
          save.spend(cost);
          d.skis.upgrades[viewId][value] = lvl + 1;
          app.audio.coin();
          if (lvl + 1 >= UPGRADE_MAX) save.unlock('maxUpgrade');
          save.save();
          render();
          return;
        }
        if (action.startsWith('buy:')) {
          const cat = action.slice(4);
          const list = { finish: FINISHES, graphic: GRAPHICS, decal: DECALS, exhaust: EXHAUSTS }[cat];
          const item = list.find((i) => i.id === value);
          const ok = tryBuy(ui, `${cat}:${value}`, item.price, item.name, () => { custom()[cat] = value; save.save(); preview(); render(); });
          if (!ok) app.showroom.setLoadout(viewId, { ...skiById(viewId).colors, ...custom(), [cat]: value }, d.rider);
        }
      },
      onInput(name, value) {
        if (name === 'paint') { custom()[part] = value; save.save(); preview(); }
      },
    });
  };
  preview();
  app.showroom.focus('ski');
  render();
}
