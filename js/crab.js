// 手続き的カニモデル
import * as THREE from 'three';
import { SPECIES } from './data.js';
import { shellTexture, furTexture, getNoise } from './textures.js';

// 甲幅(cm) → 表示サイズ（1単位=10cm を圧縮）
export function visualWidth(cm) { return 0.2236 * Math.pow(cm, 0.635); }

const tmpV = new THREE.Vector3();

function outlineFn(shape) {
  const n = shape.n, lr = shape.lr, trap = shape.trap || 0;
  const A = 0.5, Bf = 0.5 * lr * 1.0, Bb = 0.5 * lr * 0.92;
  return (a) => {
    const s = Math.sin(a), c = Math.cos(a);
    const Aa = A * (1 + trap * s);
    const B = s > 0 ? Bf : Bb;
    return 1 / Math.pow(Math.pow(Math.abs(c) / Aa, n) + Math.pow(Math.abs(s) / B, n), 1 / n);
  };
}

function carapaceGeo(shape, top, seed) {
  const g = new THREE.SphereGeometry(0.5, 56, 22, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const R = outlineFn(shape);
  const H = shape.height * 0.5;
  const nz = getNoise(500 + (seed % 20));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * 2, y = pos.getY(i) * 2, z = pos.getZ(i) * 2;
    const s = Math.min(1, Math.hypot(x, z));
    const a = Math.atan2(z, x); // +z が前
    const r = R(a);
    let px = Math.cos(a) * r * s;
    let pz = Math.sin(a) * r * s;
    let py;
    if (top) {
      // 中央が平たく縁で急に落ちる甲羅
      py = Math.pow(Math.max(0, y), 0.55) * H;
      // 前縁を少し下げる
      py *= 1 - Math.max(0, Math.sin(a)) * 0.15 * s;
      if (shape.lumpy) py *= 1 + (nz.fbm(px + 0.5, pz + 0.5, 3, 3) - 0.5) * 0.35 * s;
    } else {
      py = -Math.pow(Math.max(0, -y), 0.8) * H * 0.42;
    }
    pos.setXYZ(i, px, py, pz);
    uv.setXY(i, px / 1.0 + 0.5, pz / 1.0 + 0.5);
  }
  g.computeVertexNormals();
  return g;
}

// +x 方向に伸びるテーパー付き円柱
function segGeo(len, r0, r1, flat = 0.75, seg = 10) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 3);
  g.rotateZ(-Math.PI / 2);
  g.translate(len / 2, 0, 0);
  g.scale(1, 1, flat);
  return g;
}
function coneGeo(len, r, flat = 0.8) {
  const g = new THREE.ConeGeometry(r, len, 10, 2);
  g.rotateZ(-Math.PI / 2);
  g.translate(len / 2, 0, 0);
  g.scale(1, 1, flat);
  return g;
}

const geoCache = new Map();
function cachedGeo(key, fn) {
  if (!geoCache.has(key)) geoCache.set(key, fn());
  return geoCache.get(key);
}

export class CrabModel {
  constructor(crab, opts = {}) {
    this.crab = crab;
    const sp = SPECIES[crab.species];
    this.sp = sp;
    const shape = { ...sp.shape };
    this.shape = shape;
    const look = crab.look;
    const seed = crab.seed || 1;
    this.root = new THREE.Group();       // 位置・向き（外から操作）
    this.body = new THREE.Group();       // 揺れ・傾き
    this.root.add(this.body);
    this.scale = visualWidth(crab.size);
    this.body.scale.setScalar(this.scale);
    this.castShadow = opts.shadow !== false;

    // ---- 材質 ----
    const shellT = shellTexture(look, seed);
    const limbT = shellTexture({ ...look, color: look.leg, color2: look.leg, pattern: look.pattern === 'spots' ? 'spots' : 'speckle', grooves: 0 }, seed + 7, 128);
    const clawT = shellTexture({ ...look, color: look.claw, color2: look.claw, pattern: look.pattern === 'spots' ? 'spots' : 'speckle', grooves: 0 }, seed + 13, 128);
    const wet = crab.nushi
      ? { roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9 } // ヌシは黒光り
      : { roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.32, envMapIntensity: 0.5 };
    this.mats = {
      shell: new THREE.MeshPhysicalMaterial({ map: shellT.map, normalMap: shellT.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), ...wet }),
      under: new THREE.MeshPhysicalMaterial({ color: look.under, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
      leg: new THREE.MeshPhysicalMaterial({ map: limbT.map, normalMap: limbT.normalMap, ...wet }),
      claw: new THREE.MeshPhysicalMaterial({ map: clawT.map, normalMap: clawT.normalMap, ...wet, roughness: 0.32 }),
      tip: new THREE.MeshPhysicalMaterial({ color: look.tip, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
      eye: new THREE.MeshPhysicalMaterial({ color: '#0a0a0a', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 }),
      fur: null,
    };
    if (shape.hairy) {
      const f = furTexture();
      this.mats.fur = new THREE.MeshPhysicalMaterial({ map: f.map, normalMap: f.normalMap, normalScale: new THREE.Vector2(2, 2), roughness: 1, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#b89a70') });
    }

    // ---- 甲羅 ----
    this.shell = new THREE.Group();
    this.body.add(this.shell);
    const topG = carapaceGeo(shape, true, seed);
    const botG = carapaceGeo(shape, false, seed);
    this.addMesh(this.shell, topG, this.mats.shell);
    this.addMesh(this.shell, botG, this.mats.under);
    const R = outlineFn(shape);
    this.R = R;
    const H = shape.height * 0.5;
    this.H = H;

    // 前縁のトゲ・側棘
    const toothG = cachedGeo('tooth', () => coneGeo(0.08, 0.026, 0.5));
    const toothMat = new THREE.MeshPhysicalMaterial({ color: look.color2, roughness: 0.45, clearcoat: 0.4 });
    this.mats.tooth = toothMat;
    if (shape.teeth) {
      for (const side of [1, -1]) {
        for (let k = 0; k < shape.teeth; k++) {
          const a = 0.12 + (k / Math.max(1, shape.teeth - 1)) * 1.05;
          const aa = side > 0 ? a : Math.PI - a;
          const r = R(aa) * 0.97;
          const m = this.addMesh(this.shell, toothG, toothMat);
          m.position.set(Math.cos(aa) * r, H * 0.08, Math.sin(aa) * r);
          m.rotation.y = -(aa - 0.25 * side);
        }
      }
    }
    if (shape.spine) {
      const sg = cachedGeo('spine' + shape.spine, () => coneGeo(shape.spine * 0.5, 0.035));
      for (const side of [1, -1]) {
        const aa = side > 0 ? 0.05 : Math.PI - 0.05;
        const r = R(aa) * 0.94;
        const m = this.addMesh(this.shell, sg, toothMat);
        m.position.set(Math.cos(aa) * r, H * 0.1, Math.sin(aa) * r);
        m.rotation.y = -aa;
        m.rotation.z = 0.05;
      }
    }

    // 目
    const front = R(Math.PI / 2);
    const eyeLen = 0.09 * shape.eye;
    const stalkG = cachedGeo('stalk' + eyeLen, () => segGeo(eyeLen, 0.017, 0.014, 1));
    const ballG = cachedGeo('eyeball', () => new THREE.SphereGeometry(0.03, 12, 10));
    this.eyes = [];
    for (const side of [1, -1]) {
      const g = new THREE.Group();
      g.position.set(side * (shape.eye > 2 ? 0.06 : 0.12), H * 0.35, front * 0.92);
      g.rotation.y = -Math.PI / 2 + side * 0.15;
      g.rotation.z = shape.eye > 2 ? 1.25 : 0.7;
      this.shell.add(g);
      this.addMesh(g, stalkG, this.mats.leg);
      const b = this.addMesh(g, ballG, this.mats.eye);
      b.position.x = eyeLen;
      this.eyes.push(g);
    }
    // 口器（前面下の暗いプレート）
    const mouthG = cachedGeo('mouth', () => { const g = new THREE.BoxGeometry(0.16, 0.06, 0.03); return g; });
    const mouth = this.addMesh(this.shell, mouthG, toothMat);
    mouth.position.set(0, -H * 0.15, front * 0.9);

    // ---- 歩脚 ----
    this.legs = [];
    const legAngles = [0.62, 0.22, -0.2, -0.62];
    const legScales = [0.92, 1.04, 1.06, 0.92];
    const L = 0.36 * shape.leg * (crab.legMul || 1);
    for (const side of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const phi = legAngles[i];
        const aa = side > 0 ? phi : Math.PI - phi;
        const r = R(aa) * 0.88;
        const root = new THREE.Group();
        root.position.set(Math.cos(aa) * r, -H * 0.05, Math.sin(aa) * r);
        const yaw = -aa;
        root.rotation.y = yaw;
        this.shell.add(root);
        const ls = legScales[i];
        const l1 = L * 1.0 * ls, l2 = L * 0.62 * ls, l3 = L * 0.72 * ls;
        const coxa = new THREE.Group(); root.add(coxa);
        this.addMesh(coxa, cachedGeo('j1', () => new THREE.SphereGeometry(0.036, 10, 8)), this.mats.leg);
        this.addMesh(coxa, cachedGeo('s1_' + l1.toFixed(3), () => segGeo(l1, 0.036, 0.032, 0.55)), this.mats.leg);
        const knee = new THREE.Group(); knee.position.x = l1; coxa.add(knee);
        this.addMesh(knee, cachedGeo('j2', () => new THREE.SphereGeometry(0.031, 10, 8)), this.mats.leg);
        this.addMesh(knee, cachedGeo('s2_' + l2.toFixed(3), () => segGeo(l2, 0.03, 0.026, 0.65)), this.mats.leg);
        const ankle = new THREE.Group(); ankle.position.x = l2; knee.add(ankle);
        this.addMesh(ankle, cachedGeo('j3', () => new THREE.SphereGeometry(0.025, 10, 8)), this.mats.leg);
        const paddle = shape.paddle && i === 3;
        if (paddle) {
          const pg = cachedGeo('paddle' + l3.toFixed(3), () => { const g = new THREE.SphereGeometry(0.5, 14, 10); g.scale(l3, 0.03, l3 * 0.42); g.translate(l3 * 0.5, 0, 0); return g; });
          const pm = this.addMesh(ankle, pg, this.mats.leg);
          pm.rotation.x = Math.PI / 2;
        } else {
          this.addMesh(ankle, cachedGeo('s3_' + l3.toFixed(3), () => segGeo(l3, 0.024, 0.003, 0.7)), this.mats.leg);
        }
        this.legs.push({ side, i, root, coxa, knee, ankle, yaw, paddle, phase: ((i % 2) + (side > 0 ? 0 : 1)) % 2 * Math.PI + i * 0.35 });
      }
    }

    // ---- ハサミ（鉗脚） ----
    this.claws = [];
    for (const side of [1, -1]) {
      let cs = shape.claw * (crab.clawMul || 1);
      if (shape.fiddler) {
        const major = (crab.lefty ? -1 : 1) === side;
        cs = crab.sex === 'm' ? (major ? 2.4 : 0.42) : 0.5;
      }
      const big = cs > 1.6;
      const aa = side > 0 ? 1.0 : Math.PI - 1.0;
      const r = R(aa) * 0.86;
      const root = new THREE.Group();
      root.position.set(Math.cos(aa) * r, -H * 0.02, Math.sin(aa) * r);
      root.rotation.y = -aa + side * 0.35;
      this.shell.add(root);
      const k = shape.longClaw ? 1.35 : 1;
      const lm = 0.2 * cs * k, lc = 0.14 * cs, lp = 0.24 * cs * (shape.longClaw ? 1.2 : 1);
      const shoulder = new THREE.Group(); root.add(shoulder);
      this.addMesh(shoulder, cachedGeo('cj1' + cs.toFixed(2), () => new THREE.SphereGeometry(0.042 * Math.sqrt(cs), 10, 8)), this.mats.claw);
      this.addMesh(shoulder, cachedGeo('cm' + cs.toFixed(2) + k, () => segGeo(lm, 0.04 * Math.sqrt(cs), 0.048 * Math.sqrt(cs), 0.65)), this.mats.claw);
      const elbow = new THREE.Group(); elbow.position.x = lm; shoulder.add(elbow);
      this.addMesh(elbow, cachedGeo('cj2' + cs.toFixed(2), () => new THREE.SphereGeometry(0.05 * Math.sqrt(cs), 10, 8)), this.mats.claw);
      this.addMesh(elbow, cachedGeo('cc' + cs.toFixed(2), () => segGeo(lc, 0.05 * Math.sqrt(cs), 0.062 * Math.sqrt(cs), 0.8)), this.mats.claw);
      const wrist = new THREE.Group(); wrist.position.x = lc; elbow.add(wrist);
      // 掌部
      const palmG = cachedGeo('palm' + cs.toFixed(2) + (shape.longClaw ? 'L' : ''), () => {
        const g = new THREE.SphereGeometry(0.5, 18, 14);
        g.scale(lp * 1.05, lp * 0.66, lp * 0.4);
        g.translate(lp * 0.44, 0, 0);
        return g;
      });
      this.addMesh(wrist, palmG, this.mats.claw);
      if (shape.hairy && this.mats.fur) {
        const furG = cachedGeo('fur' + cs.toFixed(2), () => {
          const g = new THREE.SphereGeometry(0.5, 18, 14);
          g.scale(lp * 0.78, lp * 0.64, lp * 0.46);
          g.translate(lp * 0.4, -lp * 0.02, 0);
          return g;
        });
        this.addMesh(wrist, furG, this.mats.fur);
      }
      // 不動指
      const fl = lp * 0.62;
      const fixedG = cachedGeo('fix' + cs.toFixed(2) + k, () => coneGeo(fl, lp * 0.12, 0.7));
      const fixed = this.addMesh(wrist, fixedG, this.mats.claw);
      fixed.position.set(lp * 0.82, -lp * 0.08, 0);
      fixed.rotation.z = 0.06;
      const fixTip = this.addMesh(wrist, cachedGeo('fixt' + cs.toFixed(2) + k, () => coneGeo(fl * 0.35, lp * 0.05, 0.7)), this.mats.tip);
      fixTip.position.set(lp * 0.82 + fl * 0.66, -lp * 0.08 + fl * 0.04, 0);
      // 可動指
      const dactyl = new THREE.Group();
      dactyl.position.set(lp * 0.78, lp * 0.12, 0);
      wrist.add(dactyl);
      this.addMesh(dactyl, fixedG, this.mats.claw);
      const dTip = this.addMesh(dactyl, cachedGeo('fixt' + cs.toFixed(2) + k, () => coneGeo(fl * 0.35, lp * 0.05, 0.7)), this.mats.tip);
      dTip.position.x = fl * 0.66;
      dactyl.rotation.z = -0.08;
      this.claws.push({ side, root, shoulder, elbow, wrist, dactyl, cs, big, snap: 0 });
    }

    // ---- 状態 ----
    this.t = Math.random() * 10;
    this.walk = 0;        // 横歩き速度係数（-1..1）
    this.walkPhase = 0;
    this.raise = 0; this.raiseT = 0;   // 威嚇
    this.open = 0.2; this.openT = 0.2; // ハサミ開き
    this.push = 0; this.pushT = 0;     // 押し合い
    this.feed = 0;                      // 口に運ぶ動作
    this.jolt = 0;                      // 突かれた反動
    this.tremble = 0;
    this.legSpeed = 1;
    this.root.userData.crabModel = this;

    // 立ち高さを自動計算
    this.applyPose(0);
    this.body.updateMatrixWorld(true);
    let minY = 0;
    for (const l of this.legs) {
      const tip = new THREE.Vector3(l.paddle ? 0.15 : 0.25, 0, 0);
      l.ankle.localToWorld(tip);
      this.body.worldToLocal(tip);
      minY = Math.min(minY, tip.y);
    }
    this.standY = -minY * this.scale * 0.98;
    this.body.position.y = this.standY;
    this.height = this.standY + H * this.scale;
  }

  addMesh(parent, geo, mat) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = this.castShadow;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // 脚とハサミの関節角を設定
  applyPose(dt) {
    const w = this.walk;
    const moving = Math.abs(w) > 0.02 || this.push > 0.05;
    for (const l of this.legs) {
      const ph = this.walkPhase + l.phase;
      const lift = moving ? Math.max(0, Math.sin(ph)) : 0;
      const swing = moving ? Math.cos(ph) : 0;
      const spread = 1 + this.push * 0.1;
      l.root.rotation.y = l.yaw + swing * 0.22 * (l.side) * (w >= 0 ? 1 : -1) + (this.push * (l.i < 2 ? -0.12 : 0.12)) * l.side;
      l.coxa.rotation.z = 0.2 + lift * 0.35 + this.push * 0.12 + this.tremble * (Math.random() - 0.5) * 0.1;
      l.knee.rotation.z = -0.95 * spread - lift * 0.15;
      l.ankle.rotation.z = l.paddle ? -0.25 : -0.62;
      l.coxa.rotation.x = 0;
    }
    for (const c of this.claws) {
      const raise = this.raise, push = this.push, feed = c.side > 0 ? Math.max(0, Math.sin(this.feed)) : Math.max(0, -Math.sin(this.feed));
      const big = c.big ? 0.35 : 1;
      // 肩：上げ・前へ
      c.shoulder.rotation.z = 0.12 + raise * 0.95 * big + push * 0.15 + this.jolt * 0.2;
      c.shoulder.rotation.y = c.side * (-0.05 + raise * 0.3 - push * 0.25);
      // 肘：内側へ曲げ
      c.elbow.rotation.y = -c.side * (1.45 - raise * 0.75 - push * 0.55 + feed * 0.2);
      c.elbow.rotation.z = -0.15 + raise * 0.5;
      // 手首
      c.wrist.rotation.y = -c.side * (0.55 - raise * 0.4 - push * 0.2);
      c.wrist.rotation.z = -0.18 + raise * 0.7 - feed * 0.3;
      c.wrist.rotation.x = c.side * raise * 0.4;
      // 指の開閉
      const snap = c.snap > 0 ? Math.sin(Math.min(1, c.snap) * Math.PI) : 0;
      c.dactyl.rotation.z = -0.06 + Math.max(0, this.open - snap) * 0.75;
    }
    for (const e of this.eyes) {
      e.rotation.z = (this.shape.eye > 2 ? 1.2 : 0.65) + this.raise * 0.25;
    }
  }

  update(dt) {
    this.t += dt;
    const k = 1 - Math.exp(-dt * 8);
    this.raise += (this.raiseT - this.raise) * k;
    this.open += (this.openT - this.open) * k;
    this.push += (this.pushT - this.push) * k;
    this.jolt *= Math.exp(-dt * 6);
    this.tremble *= Math.exp(-dt * 3);
    const speed = Math.abs(this.walk) * 14 * this.legSpeed + this.push * 9;
    this.walkPhase += dt * speed;
    for (const c of this.claws) if (c.snap > 0) { c.snap += dt * 4; if (c.snap > 1) c.snap = 0; }
    // 呼吸のような微動
    const idle = Math.sin(this.t * 1.7) * 0.01;
    this.body.position.y = this.standY + (idle - this.push * 0.03 + Math.abs(Math.sin(this.walkPhase)) * 0.015 * Math.min(1, Math.abs(this.walk) * 2)) * this.scale + this.jolt * 0.04 * this.scale;
    this.shell.rotation.x = -this.push * 0.12 + this.raise * -0.12 + this.jolt * 0.15;
    this.shell.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.03 * Math.min(1, Math.abs(this.walk) * 2);
    this.applyPose(dt);
  }

  snap(side = 0) {
    for (const c of this.claws) if (side === 0 || c.side === side) c.snap = 0.001;
  }

  dispose() {
    this.root.parent && this.root.parent.remove(this.root);
    for (const m of Object.values(this.mats)) {
      if (!m) continue;
      if (m.map && !m.map.userData.shared) m.map.dispose();
      m.dispose();
    }
  }
}

// ---- サムネイル生成（図鑑・カード用） ----
let thumbRenderer = null, thumbScene = null, thumbCam = null;
const thumbCache = new Map();
export function crabThumbnail(crab, size = 160) {
  const key = crab.id + ':' + size;
  if (thumbCache.has(key)) return thumbCache.get(key);
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbRenderer.setPixelRatio(1);
    thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
    thumbScene = new THREE.Scene();
    thumbScene.add(new THREE.HemisphereLight('#fff8ee', '#556070', 1.6));
    const d = new THREE.DirectionalLight('#ffffff', 2.6); d.position.set(2, 4, 3); thumbScene.add(d);
    const d2 = new THREE.DirectionalLight('#bcd4ff', 1.0); d2.position.set(-3, 2, -2); thumbScene.add(d2);
    thumbCam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  }
  thumbRenderer.setSize(size, size, false);
  const m = new CrabModel(crab, { shadow: false });
  m.raiseT = m.raise = 0.35; m.openT = m.open = 0.35;
  m.update(0.016);
  thumbScene.add(m.root);
  const s = m.scale;
  const span = s * (1.8 + (m.shape.leg || 1) * 0.6 + (m.shape.spine || 0));
  thumbCam.position.set(0, span * 1.5, span * 1.9);
  thumbCam.lookAt(0, s * 0.15, 0);
  thumbRenderer.render(thumbScene, thumbCam);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  thumbScene.remove(m.root);
  m.dispose();
  thumbCache.set(key, url);
  return url;
}

export function silhouetteThumb(speciesId, size = 120) {
  const key = 'sil_' + speciesId;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const sp = SPECIES[speciesId];
  const fake = { id: key, species: speciesId, seed: 5, size: (sp.size[0] + sp.size[1]) / 2, sex: 'm', look: { ...sp.look, color: '#1c1c22', color2: '#1c1c22', claw: '#1c1c22', leg: '#1c1c22', tip: '#1c1c22', under: '#1c1c22', spot: '#1c1c22' }, clawMul: 1.1, legMul: 1 };
  const url = crabThumbnail(fake, size);
  thumbCache.set(key, url);
  return url;
}
