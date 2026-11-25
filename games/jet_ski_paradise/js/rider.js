// Procedural rider: a jointed low-poly character with customizable body, hair, face, clothing
// and gear. Arms and legs use two-bone IK so hands stay on the handlebars and feet in the
// footwells while poses (leaning, tricks, landings, celebrations) blend on top.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, -1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

function mat(color, rough = 0.7, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
}

function faceTexture(look) {
  const W = 256, H = 128;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = look.skin;
  g.fillRect(0, 0, W, H);
  const cx = W * 0.25;
  const eyeY = H * 0.47, mouthY = H * 0.64;
  const dark = '#1d1410';
  // Cheeks.
  g.fillStyle = 'rgba(255,120,120,0.22)';
  g.beginPath(); g.arc(cx - 15, H * 0.57, 6, 0, Math.PI * 2); g.arc(cx + 15, H * 0.57, 6, 0, Math.PI * 2); g.fill();
  // Eyes.
  for (const s of [-1, 1]) {
    const ex = cx + s * 10;
    g.fillStyle = '#ffffff';
    g.beginPath();
    if (look.face === 'focus' || look.face === 'cool') g.ellipse(ex, eyeY, 4.2, 2.4, 0, 0, Math.PI * 2);
    else g.ellipse(ex, eyeY, 4, 3.4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2a1a';
    g.beginPath(); g.arc(ex + (look.face === 'cheeky' ? 1 : 0), eyeY + 0.3, 2.1, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(ex + 0.8, eyeY - 0.8, 0.7, 0, Math.PI * 2); g.fill();
    // Brows.
    g.strokeStyle = look.hairColor;
    g.lineWidth = 1.8;
    g.beginPath();
    const tilt = look.face === 'focus' ? 2 * s : look.face === 'cheeky' ? (s > 0 ? -2 : 1) : 0;
    g.moveTo(ex - 4.5, eyeY - 6 - tilt * 0.5);
    g.lineTo(ex + 4.5, eyeY - 6 + tilt * 0.5);
    g.stroke();
  }
  // Nose.
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(cx, eyeY + 3); g.lineTo(cx - 1.5, H * 0.57); g.lineTo(cx + 1, H * 0.58); g.stroke();
  // Mouth.
  g.strokeStyle = dark;
  g.fillStyle = '#7a2a2a';
  g.lineWidth = 1.6;
  g.beginPath();
  if (look.face === 'smile' || look.face === 'freckles' || look.face === 'beard') {
    g.arc(cx, mouthY - 3, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(cx - 4, mouthY + 0.2, 8, 1.4);
  } else if (look.face === 'cheeky') {
    g.moveTo(cx - 5, mouthY); g.quadraticCurveTo(cx + 2, mouthY + 4, cx + 6, mouthY - 2); g.stroke();
  } else if (look.face === 'cool') {
    g.moveTo(cx - 4, mouthY + 1); g.lineTo(cx + 5, mouthY - 0.5); g.stroke();
  } else {
    g.moveTo(cx - 5, mouthY); g.lineTo(cx + 5, mouthY); g.stroke();
  }
  if (look.face === 'freckles') {
    g.fillStyle = 'rgba(120,60,30,0.55)';
    for (let i = 0; i < 14; i++) {
      const s = i % 2 ? -1 : 1;
      g.beginPath(); g.arc(cx + s * (8 + (i * 7) % 9), H * 0.54 + (i % 3) * 2, 0.8, 0, Math.PI * 2); g.fill();
    }
  }
  if (look.face === 'beard') {
    g.fillStyle = look.hairColor;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(cx - 20, H * 0.5);
    g.quadraticCurveTo(cx - 18, H * 0.82, cx, H * 0.84);
    g.quadraticCurveTo(cx + 18, H * 0.82, cx + 20, H * 0.5);
    g.lineTo(cx + 13, H * 0.58); g.quadraticCurveTo(cx, H * 0.7, cx - 13, H * 0.58);
    g.closePath(); g.fill();
    g.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function torsoTexture(look) {
  const W = 256, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = look.topColor;
  g.fillRect(0, 0, W, H);
  g.fillStyle = look.accentColor;
  if (look.top === 'tropical') {
    for (let i = 0; i < 26; i++) {
      const x = (i * 53) % W, y = (i * 97) % H;
      g.save(); g.translate(x, y);
      for (let p = 0; p < 5; p++) { g.rotate(Math.PI * 2 / 5); g.beginPath(); g.ellipse(0, -9, 5, 9, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, 3, 0, Math.PI * 2); g.fill();
      g.restore();
      g.fillStyle = i % 3 ? look.accentColor : '#2f9e44';
    }
    // Open collar.
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(W * 0.24, 0, 4, H * 0.6);
  } else if (look.top === 'jersey') {
    g.fillRect(0, H * 0.35, W, H * 0.12);
    g.fillRect(0, H * 0.55, W, H * 0.05);
    g.fillStyle = '#ffffff';
    g.font = 'bold 70px Oxanium, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('7', W * 0.75, H * 0.45);
  } else if (look.top === 'prosuit') {
    g.fillRect(W * 0.1, 0, W * 0.08, H);
    g.fillRect(W * 0.32, 0, W * 0.08, H);
    g.fillRect(W * 0.6, 0, W * 0.08, H);
    g.fillRect(W * 0.82, 0, W * 0.08, H);
  } else if (look.top === 'wetsuit') {
    g.fillRect(W * 0.43, 0, W * 0.14, H);
    g.fillRect(W * 0.93, 0, W * 0.07, H);
    g.fillRect(0, 0, W * 0.07, H);
  } else {
    g.fillRect(0, 0, W, H * 0.08);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function capsule(r, len, m, seg = 8) {
  const geo = new THREE.CapsuleGeometry(r, len, 3, seg);
  geo.translate(0, -len / 2 - r * 0.4, 0);
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  return mesh;
}

// ---------------------------------------------------------------- Rider
export class Rider {
  constructor(look, opts = {}) {
    this.look = { ...look };
    this.low = !!opts.lowDetail;
    this.root = new THREE.Group();
    this.mats = [];
    this.textures = [];
    this.pose = {
      hipY: 0, hipZ: 0, hipX: 0, spineX: 0.35, spineZ: 0, spineY: 0, headX: 0, headY: 0,
      lHand: new THREE.Vector3(), rHand: new THREE.Vector3(), lFoot: new THREE.Vector3(), rFoot: new THREE.Vector3(),
    };
    this.target = {
      hipY: 0, hipZ: 0, hipX: 0, spineX: 0.35, spineZ: 0, spineY: 0, headX: 0, headY: 0,
      lHand: new THREE.Vector3(), rHand: new THREE.Vector3(), lFoot: new THREE.Vector3(), rFoot: new THREE.Vector3(),
    };
    this.anchors = {
      gripL: new THREE.Vector3(0.3, 0.17, 0.3), gripR: new THREE.Vector3(-0.3, 0.17, 0.3),
      footL: new THREE.Vector3(0.38, -0.27, 0.1), footR: new THREE.Vector3(-0.38, -0.27, 0.1),
    };
    this.time = Math.random() * 10;
    this.landing = 0;
    this.build();
    this.snap();
  }

  // grips and footwells in rider-root space (rider root sits on the seat).
  fitToSki(ski) {
    const seat = ski.seatTop;
    this.root.position.copy(seat);
    this.anchors.gripL.copy(ski.gripL).sub(seat);
    this.anchors.gripR.copy(ski.gripR).sub(seat);
    const w = ski.def.shape.width * 0.5 - 0.16;
    this.anchors.footL.set(w, -0.2, 0.18);
    this.anchors.footR.set(-w, -0.2, 0.18);
    this.snap();
  }

  build() {
    const L = this.look;
    const female = L.body === 'female';
    const seg = this.low ? 6 : 10;
    const skin = mat(L.skin, 0.6);
    const topTex = torsoTexture(L);
    this.textures.push(topTex);
    const top = mat(0xffffff, 0.75, { map: topTex });
    const sleeve = mat(L.top === 'tropical' ? L.topColor : L.topColor, 0.75);
    const bottom = mat(L.bottomColor, 0.8);
    const hair = mat(L.hairColor, 0.85);
    const gloves = L.gloves !== 'none' ? mat(L.gloveColor, 0.6) : skin;
    const shoes = L.shoes !== 'none' ? mat(L.shoeColor, 0.6) : skin;
    this.mats.push(skin, top, sleeve, bottom, hair);
    if (gloves !== skin) this.mats.push(gloves);
    if (shoes !== skin) this.mats.push(shoes);

    const shoulderW = female ? 0.165 : 0.2;
    const hipW = female ? 0.105 : 0.095;
    const torsoR = female ? 0.13 : 0.145;
    this.upperLen = 0.27;
    this.lowerLen = 0.26;
    this.thighLen = 0.4;
    this.shinLen = 0.4;

    this.hips = new THREE.Group();
    this.root.add(this.hips);
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(female ? 0.15 : 0.14, seg, 8), bottom);
    pelvis.scale.set(1.2, 0.75, 0.95);
    pelvis.castShadow = true;
    this.hips.add(pelvis);

    this.spine = new THREE.Group();
    this.spine.position.y = 0.06;
    this.hips.add(this.spine);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(torsoR, 0.3, 3, seg + 2), top);
    torso.position.y = 0.24;
    torso.scale.set(1.25, 1, 0.82);
    torso.castShadow = true;
    this.spine.add(torso);

    if (L.vest !== 'none') {
      const vm = mat(L.vestColor, 0.55);
      this.mats.push(vm);
      const vest = new THREE.Mesh(new THREE.CapsuleGeometry(torsoR + 0.035, L.vest === 'pro' ? 0.26 : 0.22, 3, seg + 2), vm);
      vest.position.y = 0.27;
      vest.scale.set(1.25, 1, 0.9);
      vest.castShadow = true;
      this.spine.add(vest);
      const strapM = mat(0x1a1a1a, 0.6);
      this.mats.push(strapM);
      for (const y of [0.2, 0.3]) {
        const strap = new THREE.Mesh(new THREE.TorusGeometry(torsoR * 1.28, 0.012, 4, 18), strapM);
        strap.rotation.x = Math.PI / 2;
        strap.scale.set(1.2, 0.95, 1);
        strap.position.y = y;
        this.spine.add(strap);
      }
      if (L.vest === 'race' || L.vest === 'pro') {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.02), strapM);
        panel.position.set(0, 0.3, -torsoR * 0.95);
        this.spine.add(panel);
      }
    }

    // Head.
    this.neck = new THREE.Group();
    this.neck.position.y = 0.5;
    this.spine.add(this.neck);
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8), skin);
    neckMesh.position.y = 0.0;
    this.neck.add(neckMesh);
    this.head = new THREE.Group();
    this.head.position.y = 0.13;
    this.neck.add(this.head);
    const faceTex = faceTexture(L);
    this.textures.push(faceTex);
    const faceMat = mat(0xffffff, 0.6, { map: faceTex });
    this.mats.push(faceMat);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.115, seg + 6, seg + 2), faceMat);
    headMesh.scale.set(0.95, 1.08, 1);
    headMesh.castShadow = true;
    this.head.add(headMesh);
    for (const s of [1, -1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), skin);
      ear.position.set(s * 0.11, 0, -0.005);
      ear.scale.set(0.6, 1, 1);
      this.head.add(ear);
    }
    this.buildHair(hair, seg);
    this.buildHeadGear(seg);

    // Arms.
    this.arms = [];
    for (const s of [1, -1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * shoulderW, 0.4, 0);
      this.spine.add(shoulder);
      const upper = new THREE.Group();
      shoulder.add(upper);
      upper.add(capsule(0.045, this.upperLen - 0.06, sleeve, seg));
      const fore = new THREE.Group();
      fore.position.y = -this.upperLen;
      upper.add(fore);
      const longSleeve = L.top !== 'tropical';
      fore.add(capsule(0.04, this.lowerLen - 0.07, longSleeve ? sleeve : skin, seg));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), gloves);
      hand.position.y = -this.lowerLen;
      hand.scale.set(0.9, 1.1, 1.2);
      hand.castShadow = true;
      fore.add(hand);
      this.arms.push({ side: s, shoulder, upper, fore });
    }

    // Legs.
    this.legs = [];
    for (const s of [1, -1]) {
      const hip = new THREE.Group();
      hip.position.set(s * hipW, -0.03, 0);
      this.hips.add(hip);
      const thigh = new THREE.Group();
      hip.add(thigh);
      thigh.add(capsule(female ? 0.065 : 0.06, this.thighLen - 0.08, bottom, seg));
      const shin = new THREE.Group();
      shin.position.y = -this.thighLen;
      thigh.add(shin);
      const shinMat = L.bottom === 'boardshorts' ? skin : bottom;
      if (L.bottom === 'boardshorts') {
        // Shorts end above the knee: add a short cuff of shorts colour over the thigh end.
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.07, 0.12, seg), bottom);
        cuff.position.y = -this.thighLen * 0.55;
        thigh.add(cuff);
        thigh.children[0].material = skin;
        const upperShorts = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.072, this.thighLen * 0.55, seg), bottom);
        upperShorts.position.y = -this.thighLen * 0.27;
        thigh.add(upperShorts);
      }
      shin.add(capsule(0.05, this.shinLen - 0.08, shinMat, seg));
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.2), shoes);
      foot.position.set(0, -this.shinLen, 0.05);
      foot.castShadow = true;
      shin.add(foot);
      this.legs.push({ side: s, hip, thigh, shin, foot });
    }
    this.root.scale.setScalar(female ? 0.96 : 1);
  }

  buildHair(hair, seg) {
    const L = this.look;
    const helmetCovers = L.helmet === 'open' || L.helmet === 'full' || L.helmet === 'visor';
    const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1, m = hair) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      this.head.add(mesh);
      return mesh;
    };
    const capGeo = (t) => new THREE.SphereGeometry(0.123, seg + 6, 8, 0, Math.PI * 2, 0, Math.PI * t);
    if (!helmetCovers && L.helmet !== 'cap') {
      if (L.hair === 'buzz') add(capGeo(0.42), 0, 0.01, -0.005, 0.97, 1.06, 1);
      if (L.hair === 'short' || L.hair === 'ponytail' || L.hair === 'long' || L.hair === 'bun') {
        const cap = add(capGeo(0.5), 0, 0.012, -0.01, 1, 1.08, 1.04);
        cap.rotation.x = -0.25;
      }
      if (L.hair === 'spiky') {
        add(capGeo(0.48), 0, 0.012, -0.01, 1, 1.08, 1.04);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const cone = add(new THREE.ConeGeometry(0.03, 0.09, 5), Math.cos(a) * 0.06, 0.12, Math.sin(a) * 0.06 - 0.01);
          cone.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
        }
      }
      if (L.hair === 'curly') {
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 6;
          const r = 0.06 + (i % 3) * 0.025;
          add(new THREE.SphereGeometry(0.045, 6, 5), Math.cos(a) * r, 0.08 + (i % 4) * 0.012, Math.sin(a) * r - 0.025);
        }
      }
      if (L.hair === 'mohawk') {
        add(new THREE.BoxGeometry(0.035, 0.1, 0.22), 0, 0.12, -0.01);
      }
    }
    if (L.hair === 'ponytail') {
      const tail = add(new THREE.CapsuleGeometry(0.035, 0.18, 3, 6), 0, -0.02, -0.15);
      tail.rotation.x = 0.5;
    }
    if (L.hair === 'long') add(new THREE.BoxGeometry(0.2, 0.24, 0.05), 0, -0.1, -0.09);
    if (L.hair === 'bun' && !helmetCovers) add(new THREE.SphereGeometry(0.055, 8, 6), 0, 0.14, -0.04);
  }

  buildHeadGear(seg) {
    const L = this.look;
    const hm = mat(L.helmetColor, 0.35, { metalness: 0.1 });
    const dark = mat(0x111418, 0.15, { metalness: 0.4 });
    this.mats.push(hm, dark);
    const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      this.head.add(mesh);
      return mesh;
    };
    if (L.helmet === 'cap') {
      add(new THREE.SphereGeometry(0.125, seg + 4, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hm, 0, 0.015, 0, 1, 1.05, 1.04);
      add(new THREE.BoxGeometry(0.15, 0.012, 0.1), hm, 0, 0.03, -0.16);
    } else if (L.helmet === 'open') {
      add(new THREE.SphereGeometry(0.145, seg + 6, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hm, 0, 0.01, -0.01, 1, 1.05, 1.08);
      const stripe = mat(L.accentColor || '#ffffff', 0.4);
      this.mats.push(stripe);
      add(new THREE.BoxGeometry(0.03, 0.01, 0.3), stripe, 0, 0.155, -0.01).rotation.x = 0;
    } else if (L.helmet === 'full' || L.helmet === 'visor') {
      add(new THREE.SphereGeometry(0.15, seg + 6, 12), hm, 0, 0.0, -0.005, 1, 1.08, 1.08);
      const visor = add(new THREE.SphereGeometry(0.152, seg + 4, 6, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.36, Math.PI * 0.22), dark, 0, 0.0, 0.004, 1, 1.08, 1.08);
      visor.rotation.y = 0;
      add(new THREE.BoxGeometry(0.15, 0.05, 0.06), hm, 0, -0.1, 0.11);
      if (L.helmet === 'visor') add(new THREE.BoxGeometry(0.2, 0.012, 0.12), hm, 0, 0.14, 0.12).rotation.x = -0.25;
    }
    // Eyewear.
    if (L.eyewear !== 'none' && L.helmet !== 'full' && L.helmet !== 'visor') {
      const lensCol = L.eyewear === 'goggles' ? 0xff8c1a : L.eyewear === 'aviators' ? 0x2d6a8f : 0x0b0d10;
      const lens = mat(lensCol, 0.1, { metalness: 0.6 });
      const frame = mat(L.eyewear === 'aviators' ? 0xd4a017 : 0x111111, 0.3, { metalness: 0.5 });
      this.mats.push(lens, frame);
      for (const s of [1, -1]) {
        const g = L.eyewear === 'goggles'
          ? new THREE.CylinderGeometry(0.035, 0.035, 0.025, 12)
          : new THREE.CylinderGeometry(0.03, L.eyewear === 'aviators' ? 0.024 : 0.03, 0.01, 12);
        const m = add(g, lens, s * 0.042, 0.012, 0.108);
        m.rotation.x = Math.PI / 2;
      }
      add(new THREE.BoxGeometry(0.03, 0.008, 0.01), frame, 0, 0.02, 0.112);
      if (L.eyewear === 'goggles') {
        const strap = add(new THREE.TorusGeometry(0.12, 0.012, 4, 20), frame, 0, 0.012, 0);
        strap.rotation.x = Math.PI / 2;
      }
    }
  }

  // ---------------------------------------------------------------- Animation
  // state: { steer, throttle, brake, airborne, trickPose, landing, celebrate, speed }
  update(dt, st) {
    this.time += dt;
    const T = this.target;
    const A = this.anchors;
    this.landing = Math.max(0, this.landing - dt * 2.6);
    const bob = Math.sin(this.time * 9) * 0.006 * Math.min(1, (st.speed || 0) / 10);
    // Base riding pose.
    T.hipY = 0.02 + bob - this.landing * 0.1;
    T.hipZ = 0;
    T.hipX = -st.steer * 0.05;
    T.spineX = 0.32 + st.throttle * 0.1 - st.brake * 0.22 + this.landing * 0.35;
    T.spineZ = -st.steer * 0.22;
    T.spineY = st.steer * 0.08;
    T.headX = -0.15 - st.throttle * 0.05;
    T.headY = -st.steer * 0.25;
    T.lHand.copy(A.gripL);
    T.rHand.copy(A.gripR);
    T.lFoot.copy(A.footL);
    T.rFoot.copy(A.footR);
    if (st.airborne) {
      T.hipY = 0.14;
      T.spineX = 0.45;
      T.headX = -0.1;
    }
    const pose = st.trickPose;
    if (pose === 'tuck') {
      T.hipY = 0.06;
      T.spineX = 0.75;
      T.headX = -0.25;
      T.lFoot.y += 0.05; T.rFoot.y += 0.05;
    } else if (pose === 'superman') {
      T.hipY = 0.32;
      T.hipZ = -0.15;
      T.spineX = 1.25;
      T.headX = -0.9;
      T.lFoot.set(0.2, 0.32, -0.75);
      T.rFoot.set(-0.2, 0.36, -0.78);
    } else if (pose === 'noHander') {
      T.spineX = -0.05;
      T.hipY = 0.1;
      T.headX = 0.1;
      T.lHand.set(0.55, 0.82, 0.12);
      T.rHand.set(-0.55, 0.82, 0.12);
    } else if (pose === 'oneHander') {
      T.spineX = 0.15;
      T.spineZ = 0.1;
      T.hipY = 0.08;
      T.rHand.set(-0.58, 0.78, 0.05);
    }
    if (st.celebrate) {
      const pump = Math.sin(this.time * 7);
      T.hipY = 0.28;
      T.spineX = -0.05;
      T.spineZ = 0;
      T.headX = 0.2;
      T.headY = Math.sin(this.time * 2) * 0.3;
      T.lHand.set(0.25, 0.95 + pump * 0.1, 0.1);
      T.rHand.copy(A.gripR);
      T.lFoot.y += 0.1; T.rFoot.y += 0.1;
    }

    // Blend toward the target pose.
    const P = this.pose;
    const k = 1 - Math.exp(-dt * (pose ? 14 : 9));
    for (const key of ['hipY', 'hipZ', 'hipX', 'spineX', 'spineZ', 'spineY', 'headX', 'headY']) P[key] += (T[key] - P[key]) * k;
    P.lHand.lerp(T.lHand, k);
    P.rHand.lerp(T.rHand, k);
    P.lFoot.lerp(T.lFoot, k);
    P.rFoot.lerp(T.rFoot, k);
    this.apply();
  }

  snap() {
    const T = this.target;
    T.lHand.copy(this.anchors.gripL); T.rHand.copy(this.anchors.gripR);
    T.lFoot.copy(this.anchors.footL); T.rFoot.copy(this.anchors.footR);
    Object.assign(this.pose, { hipY: 0.02, hipZ: 0, hipX: 0, spineX: 0.35, spineZ: 0, spineY: 0, headX: -0.15, headY: 0 });
    this.pose.lHand.copy(T.lHand); this.pose.rHand.copy(T.rHand);
    this.pose.lFoot.copy(T.lFoot); this.pose.rFoot.copy(T.rFoot);
    this.apply();
  }

  land(strength) {
    this.landing = Math.min(1, Math.max(this.landing, strength));
  }

  apply() {
    const P = this.pose;
    this.hips.position.set(P.hipX, P.hipY, P.hipZ);
    this.spine.rotation.set(P.spineX, P.spineY, P.spineZ);
    this.neck.rotation.set(P.headX - P.spineX * 0.6, P.headY, 0);
    this.root.updateMatrixWorld(true);
    // Root space -> limb parent spaces, then two-bone IK.
    for (const arm of this.arms) this.solve(arm.shoulder, arm.upper, arm.fore, arm.side > 0 ? P.lHand : P.rHand, this.upperLen, this.lowerLen, arm.side, true);
    for (const leg of this.legs) this.solve(leg.hip, leg.thigh, leg.shin, leg.side > 0 ? P.lFoot : P.rFoot, this.thighLen, this.shinLen, leg.side, false);
  }

  // Points bone A (upper) and bone B (lower) so the chain ends at target (given in root space).
  solve(base, boneA, boneB, targetRoot, la, lb, side, isArm) {
    // Target into the base joint's local space.
    _m.copy(base.matrixWorld).invert();
    _a.copy(targetRoot).applyMatrix4(this.root.matrixWorld).applyMatrix4(_m);
    let d = _a.length();
    const maxD = (la + lb) * 0.999;
    const dir = _b.copy(_a).divideScalar(d || 1);
    d = Math.min(Math.max(d, Math.abs(la - lb) + 0.01), maxD);
    // Pole: elbows point out and back, knees point forward and out.
    const pole = isArm ? _c.set(side * 0.8, -0.2, -0.6) : _c.set(side * 0.35, 0.2, 1);
    pole.normalize();
    _n.crossVectors(dir, pole).normalize();
    if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0);
    const cosA = (la * la + d * d - lb * lb) / (2 * la * d);
    const alpha = Math.acos(Math.max(-1, Math.min(1, cosA)));
    // Rotate dir toward the pole around n by alpha.
    // Rotating dir about (dir x pole) by +alpha swings it toward the pole.
    _q.setFromAxisAngle(_n, alpha);
    const upperDir = _c.copy(dir).applyQuaternion(_q);
    boneA.quaternion.setFromUnitVectors(UP, upperDir.normalize());
    // Elbow position and lower bone direction (in base space), then into boneA's space.
    const elbow = _n.copy(upperDir).multiplyScalar(la);
    const lowerDir = _a.copy(dir).multiplyScalar(d).sub(elbow).normalize();
    _q.copy(boneA.quaternion).invert();
    lowerDir.applyQuaternion(_q);
    boneB.quaternion.setFromUnitVectors(UP, lowerDir);
  }

  dispose() {
    this.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of this.mats) m.dispose();
    for (const t of this.textures) t.dispose();
  }
}
