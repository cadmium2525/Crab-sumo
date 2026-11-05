// カニ相撲（切り株の土俵）
import * as THREE from 'three';
import { Outdoor, rockGeometry, grassField, treeCluster, terrain } from '../env.js';
import { stumpTopTextures, barkTextures, groundTextures, rockTextures, skinTexture, getNoise, mulberry32 } from '../textures.js';
import { CrabModel } from '../crab.js';
import { SPECIES, SPECIES_ORDER, RIVALS, rivalCrab, makeCrab, overallPower, combatBuild, bodyBulk } from '../data.js';
import { el, modal, toast, bigText, hideBigText, setHud, setActions, sayBox, crabCard } from '../ui.js';
import * as Audio from '../audio.js';

const R = 3.2;            // 土俵（切り株）の半径
const BOUT_TIME = 45;

function wrapAngle(a) { return ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

class Fighter {
  constructor(crab, model, side) {
    this.crab = crab;
    this.model = model;
    this.side = side; // -1: 東(左/プレイヤー) +1: 西(右)
    const s = crab.stats;
    this.s = s;
    this.build = combatBuild(crab);
    this.bulk = bodyBulk(crab);
    this.tiredSaid = false;
    this.k = 1;
    this.vs = model.scale;
    this.reach = model.scale * 0.95;
    this.pos = new THREE.Vector2(side * (0.55 + this.reach), 0);
    this.heading = side < 0 ? 0 : Math.PI; // 進行方向の角度（xz平面, x軸から）
    this.kiai = clamp(30 + s.temper * 2 + ((crab.condition ?? 100) - 60) * 0.25, 10, 70);
    this.stam = clamp(60 + (crab.condition ?? 100) * 0.4, 40, 100);
    this.state = 'idle';
    this.stateT = 0;
    this.actT = 0.6 + Math.random();
    this.burst = 0;
    this.force = 0;
    this.pokes = 3;
    this.pokeCd = 0;
    this.lift = 0;
    this.flip = 0;
    this.fallV = 0;
    this.fallY = 0;
    this.edge = false;
    this.fleeT = 0;
    const sh = SPECIES[crab.species].shape;
    let claw = sh.claw * (crab.clawMul || 1);
    if (sh.fiddler) claw = crab.sex === 'm' ? 1.9 : 0.6;
    this.claw = claw;
    this.flat = sh.height;
  }
  dir() { return new THREE.Vector2(Math.cos(this.heading), Math.sin(this.heading)); }
}

export class SumoScene {
  constructor(app, opts) {
    this.app = app;
    this.opts = opts;
    const state = app.state;
    this.slot = state.slot;
    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 6000);
    this.camera.position.set(0, 4, 9);
    this.camLook = new THREE.Vector3(0, 0.3, 0);
    this.time = 0;
    this.distMul = 1;
    this.outdoor = new Outdoor(app.renderer, scene, this.slot, { shadowSize: 6, fogNear: 60, fogFar: 500 });
    this.outdoor.sunLight.target.position.set(0, 0, 0);
    this.buildArena();

    // 出場カニ
    const mine = state.crabs.find((c) => c.id === opts.crabId);
    this.rival = opts.rivalId ? RIVALS.find((r) => r.id === opts.rivalId) : null;
    let opp;
    if (this.rival) opp = rivalCrab(this.rival);
    else if (opts.selfOpp) opp = state.crabs.find((c) => c.id === opts.selfOpp);
    else opp = this.makeWild(mine);
    this.selfMode = !!opts.selfOpp;
    this.wild = !this.rival && !this.selfMode;
    const m1 = new CrabModel(mine), m2 = new CrabModel(opp);
    this.f1 = new Fighter(mine, m1, -1);
    this.f2 = new Fighter(opp, m2, 1);
    // 小さいカニ同士なら土俵を相対的に小さく見せる（カニと指を拡大）
    const maxScale = Math.max(m1.scale, m2.scale);
    this.k = clamp(1.2 / maxScale, 1, 2.6);
    for (const f of [this.f1, this.f2]) {
      f.k = this.k; f.vs = f.model.scale * this.k; f.reach = f.vs * 0.95;
      f.pos.x = f.side * (0.5 + f.reach);
      f.model.root.scale.setScalar(this.k);
      scene.add(f.model.root); this.placeModel(f);
    }

    // 指
    this.finger1 = this.makeFinger('#e8b896');
    this.finger2 = this.makeFinger(this.rival ? '#d8a07a' : '#e8b896');
    this.finger1.root.scale.setScalar(this.k * 0.85);
    this.finger2.root.scale.setScalar(this.k * 0.85);
    scene.add(this.finger1.root, this.finger2.root);
    this.finger1.root.visible = this.finger2.root.visible = false;

    this.phase = 'intro';
    this.phaseT = 0;
    this.boutT = 0;
    this.particles = [];
    this.result = null;
    this.hud = null;
    Audio.ambient(null);
    Audio.music('sumo');
  }

  makeWild(mine) {
    // 自分のカニに近い大きさの野良ガニ
    const target = mine.size;
    const cands = SPECIES_ORDER.map((id) => {
      const sp = SPECIES[id];
      const mid = (sp.size[0] + sp.size[1]) / 2;
      return { id, w: 1 / (0.3 + Math.abs(Math.log(mid / target))) };
    });
    const r = Math.random;
    let tot = cands.reduce((a, c) => a + c.w, 0), v = r() * tot, id = cands[0].id;
    for (const c of cands) { v -= c.w; if (v <= 0) { id = c.id; break; } }
    const c = makeCrab(id, Math.floor(r() * 1e9));
    c.name = '野良の' + SPECIES[id].name;
    c.id = 'wild';
    return c;
  }

  buildArena() {
    const scene = this.scene;
    const night = this.slot === 3;
    // 地面
    const n = getNoise(9);
    const gh = (x, z) => -2 + (n.fbm(x / 120 + 0.5, z / 120 + 0.5, 4, 4) - 0.5) * Math.min(4, Math.hypot(x, z) * 0.08);
    const gt = groundTextures('grass');
    gt.map.repeat.set(40, 40); gt.normalMap.repeat.set(40, 40);
    const ground = new THREE.Mesh(terrain(300, 300, 120, 120, gh), new THREE.MeshStandardMaterial({ map: gt.map, normalMap: gt.normalMap, roughness: 1 }));
    ground.receiveShadow = true;
    scene.add(ground);
    this.grass = grassField(7000, (r) => {
      const a = r() * Math.PI * 2, d = R + 0.8 + Math.pow(r(), 0.7) * 26;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      return { x, y: gh(x, z), z, h: 0.6 + r() * 1.4 };
    }, { seed: 21 });
    scene.add(this.grass);

    // 切り株
    const top = stumpTopTextures();
    const bark = barkTextures();
    bark.map.repeat.set(5, 1); bark.normalMap.repeat.set(5, 1);
    const geo = new THREE.CylinderGeometry(R, R * 1.12, 2.1, 96, 6, false);
    const pos = geo.attributes.position;
    const bn = getNoise(44);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r0 = Math.hypot(x, z);
      if (r0 < 0.01) continue;
      const a = Math.atan2(z, x);
      const isSide = Math.abs(Math.abs(y) - 1.05) > 0.001 || r0 > R * 0.999;
      let k = 1 + (bn.fbm(a / (Math.PI * 2) + 0.5, (y + 1) * 0.2, 6, 3) - 0.5) * 0.08;
      if (y < -0.5) k += Math.pow(Math.max(0, -y - 0.5) / 0.55, 2) * 0.12 * (0.5 + 0.5 * Math.sin(a * 5));
      if (isSide || y < 1.04) pos.setXYZ(i, x * k, y, z * k);
    }
    geo.computeVertexNormals();
    const topMat = new THREE.MeshStandardMaterial({ map: top.map, normalMap: top.normalMap, roughnessMap: top.roughnessMap, roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8) });
    const barkMat = new THREE.MeshStandardMaterial({ map: bark.map, normalMap: bark.normalMap, roughness: 0.95, normalScale: new THREE.Vector2(1.5, 1.5) });
    const stump = new THREE.Mesh(geo, [barkMat, topMat, barkMat]);
    stump.position.y = -1.05;
    stump.castShadow = true; stump.receiveShadow = true;
    scene.add(stump);
    // 根
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.3;
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.55, 2.4, 10), barkMat);
      root.position.set(Math.cos(a) * (R + 0.5), -1.9, Math.sin(a) * (R + 0.5));
      root.rotation.set(0, -a, 0);
      root.rotateZ(-1.2);
      root.castShadow = true; root.receiveShadow = true;
      scene.add(root);
    }
    // 仕切り線（チョーク）
    const chalk = new THREE.MeshStandardMaterial({ color: '#f4f0e6', roughness: 1, transparent: true, opacity: 0.85 });
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.9), chalk);
      l.rotation.x = -Math.PI / 2;
      l.position.set(s * 0.45, 0.004, 0);
      scene.add(l);
    }
    // 周りの景色
    const rt = rockTextures(0);
    const rockMat = new THREE.MeshStandardMaterial({ map: rt.map, normalMap: rt.normalMap, roughness: 1 });
    const rr = mulberry32(5);
    for (let i = 0; i < 8; i++) {
      const a = rr() * Math.PI * 2, d = 9 + rr() * 20, s = 0.8 + rr() * 2.5;
      const m = new THREE.Mesh(rockGeometry(60 + i, s, s * 0.6, s), rockMat);
      m.position.set(Math.cos(a) * d, gh(Math.cos(a) * d, Math.sin(a) * d), Math.sin(a) * d);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    }
    scene.add(treeCluster(60, (r) => {
      const a = r() * Math.PI * 2, d = 30 + r() * 120;
      return { x: Math.cos(a) * d, y: -2, z: Math.sin(a) * d, h: 16 + r() * 30 };
    }, 33));
    // 木漏れ日っぽい補助光
    const fill = new THREE.DirectionalLight('#fff0dd', 0.5);
    fill.position.set(-5, 6, 8);
    scene.add(fill);
    if (night) {
      for (const [x, z] of [[-4.5, -3], [4.5, -3]]) {
        const lt = new THREE.PointLight('#ffb060', 25, 18, 1.5);
        lt.position.set(x, 2.5, z);
        lt.castShadow = true;
        scene.add(lt);
        const lan = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshStandardMaterial({ color: '#ff9a40', emissive: '#ff7a20', emissiveIntensity: 2.5 }));
        lan.scale.y = 1.3;
        lan.position.copy(lt.position);
        scene.add(lan);
      }
    }
  }

  makeFinger(color) {
    const root = new THREE.Group();
    const sk = skinTexture();
    const mat = new THREE.MeshPhysicalMaterial({ color, map: sk.map, normalMap: sk.normalMap, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ffd0c0'), sheenRoughness: 0.5, clearcoat: 0.1 });
    const rad = 0.12;
    const fg = new THREE.CapsuleGeometry(rad, 1.6, 8, 16);
    fg.rotateZ(Math.PI / 2);
    fg.translate(-0.8 - rad, 0, 0); // 指先が原点
    const f = new THREE.Mesh(fg, mat);
    f.scale.set(1, 0.85, 1);
    f.castShadow = true;
    root.add(f);
    const nail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), new THREE.MeshPhysicalMaterial({ color: '#f0c8b8', roughness: 0.2, clearcoat: 1 }));
    nail.scale.set(1.3, 0.35, 0.9);
    nail.position.set(-0.17, 0.085, 0);
    root.add(nail);
    // 手（画面外へ続く）
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), mat);
    hand.scale.set(1.5, 0.8, 1);
    hand.position.set(-2.4, 0.2, 0);
    hand.castShadow = true;
    root.add(hand);
    return { root, anim: null };
  }

  placeModel(f) {
    const m = f.model;
    m.root.position.set(f.pos.x, f.fallY, f.pos.y);
    const hd = f.dir();
    m.root.rotation.set(0, Math.atan2(hd.x, hd.y), 0);
    const h = m.height * f.k; // 足先から甲羅のてっぺんまで
    if (f.flip > 0) { m.root.rotateZ(f.flip * Math.PI); m.root.position.y += Math.sin(f.flip * Math.PI / 2) * h; }
    if (f.lift > 0) { m.root.position.y += f.lift * f.vs * 0.6; m.root.rotateX(-f.lift * 0.5); }
    if (f.state === 'fall') {
      const sp = f.fallSpin || 0;
      m.root.rotateX(sp);
      // 回転中は体の中心で回して、地面にめり込まないように
      m.root.position.y += Math.abs(Math.sin(sp / 2)) * h;
    }
  }

  // ===== 進行 =====
  enter() {
    const a = this.f1.crab, b = this.f2.crab;
    this.makeHud();
    bigText('東　' + a.name, { ms: 1300, cls: 'small' });
    setTimeout(() => bigText('西　' + b.name, { ms: 1300, cls: 'small' }), 1400);
    Audio.sfx('hyoshigi');
    if (this.rival) setTimeout(() => toast(`${this.rival.name}「${this.rival.hello}」`, 3200), 400);
  }

  makeHud() {
    document.body.classList.add('in-sumo');
    const box = el('div', { class: 'bout-hud' });
    const fbox = (f, right) => {
      const k = el('i'), st = el('i');
      const d = el('div', { class: 'fighter' + (right ? ' right' : '') },
        el('div', { class: 'fn' }, (right ? '西 ' : '東 ') + f.crab.name),
        el('div', { class: 'fs' }, `${SPECIES[f.crab.species].name} ${f.crab.size.toFixed(1)}cm 強さ${overallPower(f.crab)}`),
        el('div', { class: 'gauge' }, k), el('div', { class: 'gl' }, '気合'),
        el('div', { class: 'gauge st' }, st), el('div', { class: 'gl' }, 'スタミナ'));
      return { d, k, st };
    };
    const h1 = fbox(this.f1, false), h2 = fbox(this.f2, true);
    const timer = el('div', { class: 'timer' }, '');
    box.appendChild(h1.d);
    box.appendChild(el('div', {}, el('div', { class: 'vs' }, '対'), timer));
    box.appendChild(h2.d);
    document.body.appendChild(box);
    const warn = el('div', { class: 'edge-warn' }, '土俵際！');
    document.body.appendChild(warn);
    this.hud = { box, h1, h2, timer, warn };
  }

  updateHud() {
    if (!this.hud) return;
    const { h1, h2, timer, warn } = this.hud;
    h1.k.style.width = clamp(this.f1.kiai, 0, 100) + '%';
    h2.k.style.width = clamp(this.f2.kiai, 0, 100) + '%';
    h1.st.style.width = clamp(this.f1.stam, 0, 100) + '%';
    h2.st.style.width = clamp(this.f2.stam, 0, 100) + '%';
    timer.textContent = this.phase === 'bout' ? `残り ${Math.max(0, Math.ceil(BOUT_TIME - this.boutT))}秒` : '';
    const edge = this.phase === 'bout' && (this.f1.edge || this.f2.edge);
    warn.style.display = edge ? 'block' : 'none';
  }

  setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
    if (p === 'shikiri') this.startShikiri();
  }

  // ===== 仕切り（指で押す） =====
  async startShikiri() {
    // 相手の仕切り
    if (this.rival) {
      toast(`${this.rival.name}が${this.f2.crab.name}の背中を押している…`, 2200);
      const n = 2 + (RIVALS.indexOf(this.rival) >= 3 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        await this.wait(700);
        const skill = 0.45 + RIVALS.indexOf(this.rival) * 0.07;
        const zones = this.zones(this.f2);
        let p = Math.random() < skill ? zones.b + Math.random() * (zones.c - zones.b) : zones.a + Math.random() * (zones.b - zones.a);
        if (Math.random() < 0.08) p = zones.c + 0.05;
        const res = this.applyPoke(this.f2, this.finger2, p, true);
        if (res === 'over') break;
      }
      await this.wait(900);
      this.finger2.root.visible = false;
    } else if (this.selfMode) {
      await this.pokeUI(this.f2, this.finger2, `${this.f2.crab.name}（西）の仕切り`);
    } else {
      this.f2.kiai = clamp(this.f2.kiai + Math.random() * 20, 0, 100);
    }
    await this.pokeUI(this.f1, this.finger1, `${this.f1.crab.name}の背中を押して気合を入れよう`);
    this.setPhase('ready');
  }

  wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  zones(f) {
    const T = f.s.temper;
    const c = clamp(0.94 - T * 0.025, 0.66, 0.9);
    const b = c - 0.11;
    const a = b - 0.32;
    return { a, b, c };
  }

  pokeUI(f, finger, label) {
    return new Promise((resolve) => {
      const z = this.zones(f);
      const meter = el('div', { class: 'poke-meter' });
      const cursor = el('div', { class: 'cursor' });
      const count = el('span', { class: 'poke-count' }, el('i'), el('i'), el('i'));
      meter.appendChild(el('div', { class: 'lbl' }, el('span', {}, label), count));
      const bar = el('div', { class: 'bar' },
        el('span', { class: 'z-weak', style: `width:${z.a * 100}%` }),
        el('span', { class: 'z-good', style: `width:${(z.b - z.a) * 100}%` }),
        el('span', { class: 'z-best', style: `width:${(z.c - z.b) * 100}%` }),
        el('span', { class: 'z-over', style: `width:${(1 - z.c) * 100}%` }),
        cursor);
      meter.appendChild(bar);
      document.body.appendChild(meter);
      let used = 0, p = 0, dir = 1, speed = 0.75, active = true, lock = false;
      finger.root.visible = true;
      this.fingerRest(f, finger);
      const tick = () => {
        if (!active) return;
        p += dir * speed * 0.016;
        if (p > 1) { p = 1; dir = -1; } if (p < 0) { p = 0; dir = 1; }
        cursor.style.left = (p * 100) + '%';
        requestAnimationFrame(tick);
      };
      tick();
      const finish = () => {
        active = false;
        meter.remove();
        this.pokeHandler = null;
        setActions([]);
        setTimeout(() => { finger.root.visible = false; resolve(); }, 600);
      };
      const doPoke = () => {
        if (lock || !active) return;
        lock = true;
        const res = this.applyPoke(f, finger, p);
        count.children[used].classList.add('used');
        used++;
        speed *= 1.3;
        setTimeout(() => {
          lock = false;
          if (res === 'over' || used >= 3) finish();
        }, 650);
      };
      this.pokeHandler = doPoke;
      setActions([
        { label: '👉 押す', cls: 'primary huge', onclick: doPoke },
        { label: 'はっけよい！', cls: 'gold', onclick: () => { if (!lock) finish(); } },
      ]);
    });
  }

  fingerRest(f, finger) {
    const d = f.dir();
    const back = f.vs * 0.5 + 0.9 * this.k * 0.85;
    finger.base = new THREE.Vector3(f.pos.x - d.x * back, f.model.height * f.k * 0.7 + 0.1 * this.k, f.pos.y - d.y * back);
    finger.dirV = new THREE.Vector3(d.x, -0.12, d.y).normalize();
    finger.root.position.copy(finger.base);
    finger.root.lookAt(finger.base.clone().add(finger.dirV));
    finger.root.rotateY(-Math.PI / 2);
    finger.anim = null;
  }

  applyPoke(f, finger, p, cpu = false) {
    const z = this.zones(f);
    let res;
    if (p < z.a) res = 'weak'; else if (p < z.b) res = 'good'; else if (p < z.c) res = 'best'; else res = 'over';
    finger.root.visible = true;
    this.fingerRest(f, finger);
    const dist = (0.88 + p * 0.35) * this.k * 0.85;
    finger.anim = { t: 0, dist, res };
    Audio.sfx('poke');
    const m = f.model;
    setTimeout(() => {
      m.jolt = 0.4 + p;
      const d = f.dir();
      const fwd = p * 0.12;
      f.pos.x += d.x * fwd; f.pos.y += d.y * fwd;
      const who = cpu ? `（${f.crab.name}）` : '';
      if (res === 'weak') { f.kiai += 4; toast('反応がうすい…' + who, 1000); }
      else if (res === 'good') { f.kiai += 12; m.raiseT = 1; m.openT = 0.8; toast('気合が入った！' + who, 1000); setTimeout(() => { m.raiseT = 0.3; }, 900); }
      else if (res === 'best') { f.kiai += 22; m.raiseT = 1; m.openT = 1; m.snap(); Audio.sfx('clack'); if (cpu) toast('やる気満々！' + who, 1000); else bigText('やる気満々！', { ms: 900, cls: 'gold small' }); setTimeout(() => { m.raiseT = 0.4; }, 1100); }
      else {
        f.kiai -= 8;
        f.turnAround = 1.0;
        m.raiseT = 1; m.openT = 1;
        setTimeout(() => { m.snap(); Audio.sfx('pinch'); if (cpu) toast(`押しすぎて${f.crab.name}が怒った！`, 1600); else { bigText('イテッ！', { ms: 800, cls: 'red small' }); toast('押しすぎて怒らせてしまった！', 1600); } }, 250);
        setTimeout(() => { m.raiseT = 0.2; }, 1200);
      }
      f.kiai = clamp(f.kiai, 0, 100);
    }, 120);
    return res;
  }

  // ===== 取組 =====
  startBout() {
    this.setPhase('bout');
    this.boutT = 0;
    for (const f of [this.f1, this.f2]) { f.state = 'approach'; f.model.raiseT = 0.6; f.model.openT = 0.7; f.pokes = 3; }
    bigText('はっけよい！', { ms: 1000 });
    Audio.sfx('taiko');
    setTimeout(() => { if (this.phase === 'bout') bigText('のこった！', { ms: 800, cls: 'small' }); }, 1000);
    this.updatePokeButton();
  }

  updatePokeButton() {
    if (this.phase !== 'bout') { setActions([]); return; }
    const f = this.f1;
    const btns = [{ label: `👉 つつく（${f.pokes}）`, cls: 'primary huge', disabled: f.pokes <= 0, onclick: () => this.boutPoke(this.f1, this.finger1) }];
    if (this.selfMode) btns.push({ label: `西をつつく（${this.f2.pokes}）`, cls: 'blue', disabled: this.f2.pokes <= 0, onclick: () => this.boutPoke(this.f2, this.finger2) });
    setActions(btns);
  }

  boutPoke(f, finger) {
    if (this.phase !== 'bout' || f.pokes <= 0 || f.pokeCd > 0) return;
    if (f.state === 'fall' || f.state === 'flipped') return;
    f.pokes--;
    f.pokeCd = 1.2;
    this.fingerRest(f, finger);
    finger.root.visible = true;
    finger.anim = { t: 0, dist: 1.1 * this.k * 0.85, res: 'bout', hide: true };
    Audio.sfx('poke');
    setTimeout(() => {
      f.model.jolt = 1;
      if (f.state === 'flinch' || f.state === 'flee') {
        f.state = 'approach'; f.kiai = clamp(f.kiai + 25, 0, 100); f.fleeT = 0;
        this.say(f, '立ち直った！');
      } else {
        f.kiai = clamp(f.kiai + 12, 0, 100);
        f.burst = 0.6;
        const d = f.dir();
        f.pos.x += d.x * 0.05; f.pos.y += d.y * 0.05;
        if (f === this.f1 || this.selfMode) toast('気合注入！', 800);
      }
    }, 130);
    this.updatePokeButton();
  }

  say(f, msg) {
    const who = f === this.f1 ? '' : '（相手）';
    toast(msg + who, 1100);
  }

  stepBout(dt) {
    const A = this.f1, B = this.f2;
    this.boutT += dt;
    for (const f of [A, B]) { f.pokeCd = Math.max(0, f.pokeCd - dt); f.burst = Math.max(0, f.burst - dt); f.flank = Math.max(0, (f.flank || 0) - dt); }
    // 相手AIのつつき
    if (!this.selfMode && this.rival && B.pokes > 0 && B.pokeCd <= 0) {
      const trouble = B.kiai < 25 || B.edge || B.state === 'flee' || B.state === 'flinch';
      if (trouble && Math.random() < dt * 1.2) this.boutPoke(B, this.finger2);
    }
    const ab = new THREE.Vector2().subVectors(B.pos, A.pos);
    const dist = ab.length();
    const axis = ab.clone().normalize();
    const contact = dist < (A.reach + B.reach) * 0.62;

    for (const [f, o, sgn] of [[A, B, 1], [B, A, -1]]) {
      const toO = axis.clone().multiplyScalar(sgn);
      if (f.state !== 'flee' && f.state !== 'fall' && f.state !== 'flipped' && f.state !== 'step') {
        const want = Math.atan2(toO.y, toO.x);
        const turn = 4 / Math.sqrt(Math.max(1, f.bulk));
        f.heading += clamp(wrapAngle(want - f.heading), -dt * turn, dt * turn);
      }
      f.stateT -= dt;
      switch (f.state) {
        case 'approach': {
          const sp = (0.22 + f.s.agility * 0.045) * (0.6 + f.kiai / 160);
          if (!contact) { f.pos.addScaledVector(toO, sp * dt); f.model.walk = 0; f.model.pushT = 0.6; }
          else {
            // ぶちかまし
            if (o.state === 'approach' || o.state === 'clinch') {
              const imp = 0.08 * (f.build / o.build) * (f.kiai / 60);
              o.pos.addScaledVector(toO, imp);
              Audio.sfx('thud');
              this.dust(f, o);
            }
            f.state = 'clinch'; f.stateT = 0;
          }
          f.model.raiseT = 0.7;
          break;
        }
        case 'flinch':
          f.model.pushT = 0; f.model.raiseT = 0.2;
          if (f.stateT <= 0) f.state = contact ? 'clinch' : 'approach';
          break;
        case 'step':
          f.pos.addScaledVector(f.stepDir, dt * 1.4);
          f.model.walk = f.stepSign; f.model.legSpeed = 2;
          if (f.stateT <= 0) { f.state = 'approach'; f.model.walk = 0; }
          break;
        case 'lunge':
          f.pos.addScaledVector(f.dir(), dt * f.lungeSp);
          f.lungeSp *= Math.exp(-dt * 2.5);
          f.model.pushT = 1;
          if (f.stateT <= 0) { f.state = 'flinch'; f.stateT = 0.8; f.model.jolt = 1; } // つんのめってひるむ
          break;
        case 'flee': {
          f.fleeT += dt;
          const away = f.pos.clone().normalize();
          if (away.lengthSq() < 0.01) away.set(-f.side, 0);
          const want = Math.atan2(away.y, away.x) + Math.PI / 2; // 横歩きで逃げる
          f.heading += clamp(wrapAngle(want - f.heading), -dt * 5, dt * 5);
          f.pos.addScaledVector(away, dt * (0.35 + f.s.agility * 0.05));
          f.model.walk = 1; f.model.legSpeed = 2; f.model.raiseT = 0; f.model.pushT = 0;
          f.kiai += dt * 2;
          if (f.kiai > 30 && Math.random() < dt * 0.6) { f.state = 'approach'; f.fleeT = 0; }
          if (f.fleeT > 3.5) return this.endBout(o, f, '戦意喪失');
          break;
        }
      }
    }

    // 組み合い
    if (A.state === 'clinch' && B.state === 'clinch') {
      if (!contact && dist > (A.reach + B.reach) * 0.8) { A.state = 'approach'; B.state = 'approach'; }
      const wob = (f, k) => 1 + Math.sin(this.time * (1.3 + k) + f.side) * 0.12 + (Math.random() - 0.5) * 0.08;
      const force = (f) => f.s.power * Math.pow(f.build, 0.8) * (0.5 + f.kiai / 100) * (0.35 + 0.65 * f.stam / 100) * (f.burst > 0 ? 1.7 : 1) * (f.flank > 0 ? 1.4 : 1);
      const resist = (f) => f.s.guard * Math.pow(f.build, 0.9) * (f.edge ? 1.3 : 1);
      const FA = force(A) * wob(A, 0), FB = force(B) * wob(B, 0.4);
      A.force = FA; B.force = FB;
      const net = FA - FB;
      const v = clamp(net / (resist(A) + resist(B)) * 0.62, -0.4, 0.4);
      A.pos.addScaledVector(axis, v * dt);
      B.pos.addScaledVector(axis, v * dt);
      for (const [f, s] of [[A, 1], [B, -1]]) {
        const fwd = v * s;
        // 大きい体ほど押し合いでバテやすい
        const heavy = Math.max(0, f.bulk - 1.6) * 0.5;
        f.stam = clamp(f.stam - dt * (Math.max(0.5, 2.2 - f.s.stamina * 0.15) + heavy + (f.burst > 0 ? 3 : 0)), 0, 100);
        if (f.stam < 25 && !f.tiredSaid) { f.tiredSaid = true; this.say(f, `${f.crab.name}がバテてきた！`); }
        if (fwd < -0.02) f.kiai -= -fwd * dt * 7 * (1.2 - f.s.temper / 15);
        else f.kiai += (Math.max(0, fwd) * 6 + (f.kiai < 45 ? 0.8 : 0)) * dt;
        f.kiai = clamp(f.kiai, 0, 100);
        f.model.pushT = 1; f.model.raiseT = 0.35; f.model.openT = 0.4 + Math.sin(this.time * 7 + s) * 0.2;
        f.model.walk = 0;
        // 押し合いで少し左右に揺れる
      }
      // 行動
      for (const [f, o, s] of [[A, B, 1], [B, A, -1]]) {
        f.actT -= dt;
        if (f.actT <= 0) {
          f.actT = clamp(1.4 - f.s.agility * 0.06 + Math.random() * 1.1, 0.5, 2.6);
          this.action(f, o, v * s, axis.clone().multiplyScalar(s));
          if (this.phase !== 'bout') return;
        }
      }
    }
    // ひるんだ相手を押し込む
    for (const [f, o, s] of [[A, B, 1], [B, A, -1]]) {
      if (f.state === 'clinch' && (o.state === 'flinch' || o.state === 'approach') && contact) {
        const v = clamp(f.s.power * Math.pow(f.build, 0.8) / (o.s.guard * Math.pow(o.build, 0.9) * 2), 0, 0.6) * (o.state === 'flinch' ? 1 : 0.4) * (f.flank > 0 ? 1.5 : 1);
        A.pos.addScaledVector(axis, v * s * dt);
        B.pos.addScaledVector(axis, v * s * dt);
        f.model.pushT = 1;
      }
    }
    // 戦意喪失
    for (const [f, o] of [[A, B], [B, A]]) {
      if (f.state !== 'flee' && f.state !== 'fall' && f.state !== 'flipped' && f.kiai < 8) {
        if (Math.random() < dt * Math.max(0.12, 0.8 - f.s.temper * 0.05)) {
          f.state = 'flee'; f.fleeT = 0;
          this.say(f, `${f.crab.name}が逃げ腰になった！`);
          if (o.state === 'clinch') o.state = 'approach';
        }
      }
    }
    // 土俵際・落下
    for (const [f, o] of [[A, B], [B, A]]) {
      const r = f.pos.length();
      f.edge = r > R - 0.45 - f.vs * 0.1;
      if (r > R - f.vs * 0.15 && f.state !== 'fall') {
        const how = f.state === 'flee' ? '逃げ出し' : (f.state === 'lunge' ? 'いなし' : (o.state === 'clinch' ? '押し出し' : '突き落とし'));
        f.state = 'fall';
        f.fallV = 0;
        f.fallDir = f.pos.clone().normalize();
        Audio.sfx('thud');
        return this.endBout(o, f, how);
      }
    }
    // 引き離し（めり込み防止）
    const minD = (A.reach + B.reach) * 0.5;
    if (dist < minD && dist > 0.001) {
      const push = (minD - dist) / 2;
      A.pos.addScaledVector(axis, -push);
      B.pos.addScaledVector(axis, push);
    }
    if (this.boutT >= BOUT_TIME) {
      const sa = A.kiai + (R - A.pos.length()) * 15 + A.stam * 0.3;
      const sb = B.kiai + (R - B.pos.length()) * 15 + B.stam * 0.3;
      return sa >= sb ? this.endBout(A, B, '判定') : this.endBout(B, A, '判定');
    }
  }

  action(f, o, fwd, toO) {
    const ratio = f.force / (o.force * 0.5 + o.s.guard * Math.pow(o.build, 0.9) * 0.6 + 0.01);
    const w = {
      burst: 3 + f.s.power * 0.2,
      pinch: 1 + f.s.temper * 0.3 + f.claw,
      flip: ratio > 0.92 ? (ratio - 0.82) * 4 + (f.kiai > 60 ? 0.8 : 0) : 0.15,
      side: (fwd < -0.05 ? f.s.agility * 0.35 : f.s.agility * 0.05) * clamp(1 + (o.bulk / f.bulk - 1) * 0.3, 1, 3),
      rest: 1.6,
    };
    let tot = Object.values(w).reduce((a, b) => a + b, 0), r = Math.random() * tot, act = 'rest';
    for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) { act = k; break; } }
    const m = f.model;
    if (act === 'burst') {
      f.burst = 0.6; f.stam -= 4; m.jolt = 0.5;
    } else if (act === 'pinch') {
      m.snap(); Audio.sfx('clack');
      const dmg = f.s.power * Math.sqrt(f.claw) * (0.6 + Math.random() * 0.6) * 0.95;
      o.kiai = clamp(o.kiai - Math.max(2, dmg - o.s.guard * 0.4), 0, 100);
      const fl = clamp(dmg / (o.kiai * 0.25 + o.s.temper * 1.5 + 6), 0.05, 0.6);
      if (Math.random() < fl) {
        o.state = 'flinch'; o.stateT = 0.6 + Math.random() * 0.4;
        o.pos.addScaledVector(toO, 0.12);
        o.model.jolt = 1;
        this.say(f, `${f.crab.name}のハサミ攻撃！`);
      }
      this.spark(f, o);
    } else if (act === 'flip') {
      const flatPenalty = o.flat < 0.3 ? 0.08 : 0; // 平たいカニはひっくり返しにくい
      const p = clamp((ratio - 0.95) * 0.5 + (f.kiai - o.kiai) / 250 - o.s.guard * 0.01 - flatPenalty, 0.02, 0.45);
      o.lift = 0.001;
      o.liftAnim = { t: 0, success: Math.random() < p };
      m.raiseT = 1;
      this.say(f, `${f.crab.name}が持ち上げにかかる！`);
      if (o.liftAnim.success) {
        o.state = 'flipped';
        f.state = 'idle';
        setTimeout(() => this.endBout(f, o, 'ひっくり返し'), 650);
        this.phase = 'ending';
      } else {
        f.stam -= 10;
        o.kiai = clamp(o.kiai - 4, 0, 100);
      }
    } else if (act === 'side') {
      const sizeEdge = 1 + clamp((o.bulk - f.bulk) * 0.15, 0, 0.8);
      const okSide = f.s.agility * sizeEdge * (0.5 + Math.random() * 0.7) > o.s.agility * (0.4 + Math.random() * 0.6);
      if (okSide) {
        f.state = 'step'; f.stateT = 0.5;
        f.stepSign = Math.random() < 0.5 ? 1 : -1;
        f.stepDir = new THREE.Vector2(-toO.y, toO.x).multiplyScalar(f.stepSign);
        o.state = 'lunge'; o.stateT = 0.55; o.lungeSp = 0.6 + o.force * 0.05 + o.bulk * 0.08; // 重いほど勢いあまって前へ
        o.kiai = clamp(o.kiai - 8, 0, 100);
        f.kiai = clamp(f.kiai + 6, 0, 100);
        f.flank = 2.2; // 横から押し込むチャンス
        toast(`${f.crab.name}がいなした！　${o.crab.name}がつんのめった！`, 1500);
        Audio.sfx('click');
      } else {
        f.pos.addScaledVector(toO, -0.04);
      }
    }
    f.stam = clamp(f.stam, 0, 100);
  }

  endBout(winner, loser, how) {
    if (this.result) return;
    this.phase = 'end';
    this.phaseT = 0;
    const playerWon = winner === this.f1;
    this.result = { winner, loser, how, playerWon };
    if (loser.state !== 'fall') { if (how !== 'ひっくり返し') loser.state = how === '戦意喪失' ? 'flee' : loser.state; }
    if (how === 'ひっくり返し') loser.state = 'flipped';
    winner.state = 'win';
    winner.model.raiseT = 1; winner.model.openT = 1;
    setActions([]);
    Audio.sfx('hyoshigi');
    setTimeout(() => {
      bigText(how, { ms: 1400, cls: 'small' });
      setTimeout(() => {
        if (this.selfMode) bigText(`${winner.crab.name}の勝ち！`, { ms: 1800, cls: 'gold small' });
        else bigText(playerWon ? '勝ち！' : '負け…', { ms: 1800, cls: playerWon ? 'gold' : 'red' });
        Audio.jingle(playerWon || this.selfMode ? 'win' : 'lose', { stopMusic: true });
      }, 1300);
      setTimeout(() => this.showResult(), 3200);
    }, 500);
  }

  async showResult() {
    const s = this.app.state;
    const { winner, loser, how, playerWon } = this.result;
    const growth = [];
    const grow = (c, amount) => {
      if (c.id === 'wild' || c.id.startsWith('rival_')) return;
      const sp = SPECIES[c.species];
      const keys = ['power', 'guard', 'stamina', 'agility'];
      const k = keys[Math.floor(Math.random() * keys.length)];
      const cap = Math.min(12, sp.stats[k] * 1.5 + 1);
      const before = c.stats[k];
      c.stats[k] = Math.round(Math.min(cap, c.stats[k] + amount) * 10) / 10;
      if (c.stats[k] > before) growth.push(`${c.name}の${{ power: '力', guard: '踏ん張り', stamina: '根性', agility: '素早さ' }[k]}が上がった！`);
    };
    const mine = [this.f1.crab];
    if (this.selfMode) mine.push(this.f2.crab);
    for (const c of mine) {
      const won = c === winner.crab;
      if (won) { c.wins++; c.condition = Math.max(0, c.condition - 15); grow(c, 0.3 + Math.random() * 0.4); }
      else { c.losses++; c.condition = Math.max(0, c.condition - 25); if (Math.random() < 0.35) grow(c, 0.2); }
    }
    if (!this.selfMode) {
      if (playerWon) s.record.wins++; else s.record.losses++;
    }
    let rewardMsg = '';
    const firstWin = !!(this.rival && playerWon && !s.beaten[this.rival.id]);
    if (firstWin) {
      s.beaten[this.rival.id] = true;
      const rw = this.rival.reward;
      if (rw?.tank) { s.capacity += rw.tank; rewardMsg = `水槽が ${60 + (Math.min(10, s.capacity) - 5) * 10}cm に大きくなった！（${s.capacity}匹まで飼える）`; }
      if (rw?.trap) { s.trapCount += rw.trap; rewardMsg = `カニカゴをもらった！（カゴ ${s.trapCount}個）`; }
      if (rw?.title) { s.title = rw.title; rewardMsg = `称号「${rw.title}」を手に入れた！`; }
    }
    this.app.save();
    // ごほうびの話は初めて勝ったときだけ。再戦で勝ったときは別のセリフ
    if (this.rival) await sayBox(this.rival.name, playerWon ? (firstWin ? this.rival.lose : this.rival.relose) : this.rival.win, this.rival.color);
    const c = this.f1.crab;
    modal((b, close) => {
      b.appendChild(el('p', { class: 'msg', style: 'text-align:center;font-size:20px;font-weight:900' },
        this.selfMode ? `${winner.crab.name}の勝ち（${how}）` : (playerWon ? `勝ち！（${how}）` : `負け…（${how}）`)));
      b.appendChild(crabCard(this.selfMode ? winner.crab : c, { compact: true }));
      for (const g of growth) b.appendChild(el('p', { class: 'help', style: 'text-align:center;color:#c4502e;font-weight:700' }, g));
      if (rewardMsg) b.appendChild(el('p', { class: 'msg', style: 'text-align:center;color:#b07a00;font-weight:900' }, '🎁 ' + rewardMsg));
      const canRe = c.condition >= 30 && (!this.selfMode || this.f2.crab.condition >= 30);
      b.appendChild(el('div', { class: 'row' },
        el('button', { class: 'btn primary', disabled: canRe ? null : '', onclick: () => { close(); this.app.goto('sumo', this.opts); } }, 'もう一番'),
        el('button', { class: 'btn', onclick: () => { close(); this.app.goto('tank'); } }, '水槽に戻る')));
      if (!canRe) b.appendChild(el('p', { class: 'help', style: 'text-align:center' }, 'カニが疲れている。休ませてあげよう。'));
    }, { title: '取組結果', closable: false });
  }

  // ===== 演出 =====
  dust(f, o) {
    const mid = new THREE.Vector3((f.pos.x + o.pos.x) / 2, 0.05, (f.pos.y + o.pos.y) / 2);
    this.emit(mid, 10, '#c8a878', 0.04, 1.2);
  }
  spark(f, o) {
    const mid = new THREE.Vector3((f.pos.x + o.pos.x) / 2, f.model.height * f.k * 0.8, (f.pos.y + o.pos.y) / 2);
    this.emit(mid, 6, '#ffffff', 0.025, 1.6);
  }
  emit(p, n, color, size, sp) {
    const geo = new THREE.SphereGeometry(size, 5, 4);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(p);
      this.scene.add(m);
      this.particles.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * sp, Math.random() * sp, (Math.random() - 0.5) * sp), life: 0.6 });
    }
  }

  updateFinger(finger, dt) {
    if (!finger.anim || !finger.root.visible) return;
    const a = finger.anim;
    a.t += dt;
    const push = a.t < 0.12 ? a.t / 0.12 : Math.max(0, 1 - (a.t - 0.12) / 0.35);
    finger.root.position.copy(finger.base).addScaledVector(finger.dirV, push * a.dist);
    if (a.t > 0.5) {
      finger.anim = null;
      if (a.hide) setTimeout(() => { if (!finger.anim) finger.root.visible = false; }, 200);
    }
  }

  update(dt) {
    this.time += dt;
    this.phaseT += dt;
    if (this.grass.userData.uniforms) this.grass.userData.uniforms.uTime.value = this.time;
    const A = this.f1, B = this.f2;
    if (this.phase === 'intro') {
      const a = -0.9 + this.phaseT * 0.35;
      this.camera.position.set(Math.sin(a) * 7 * this.distMul, 2.6 * this.distMul, Math.cos(a) * 7 * this.distMul);
      this.camLook.set(0, 0.3, 0);
      for (const f of [A, B]) { f.model.raiseT = 0.3 + Math.sin(this.time * 2 + f.side) * 0.2; }
      if (this.phaseT > 3) this.setPhase('shikiri');
    } else if (this.phase === 'shikiri') {
      this.updateHud();
      const target = new THREE.Vector3(0, 1.9 * this.distMul, 5.8 * this.distMul);
      this.camera.position.lerp(target, dt * 2);
      this.camLook.lerp(new THREE.Vector3(0, 0.25, 0), dt * 3);
    } else if (this.phase === 'ready') {
      if (this.phaseT < 0.05) { bigText('見合って…', { ms: 1200, cls: 'small' }); }
      for (const f of [A, B]) { f.model.raiseT = 0.8; f.model.openT = 0.8; }
      if (this.phaseT > 1.6) this.startBout();
    } else if (this.phase === 'bout') {
      const steps = Math.ceil(dt / (1 / 60));
      for (let i = 0; i < steps && this.phase === 'bout'; i++) this.stepBout(dt / steps);
      this.updateHud();
    } else if (this.phase === 'end' || this.phase === 'ending') {
      this.updateHud();
    }
    if (this.phase === 'bout' || this.phase === 'end' || this.phase === 'ending') {
      const mid = new THREE.Vector3((A.pos.x + B.pos.x) / 2, 0.25, (A.pos.y + B.pos.y) / 2);
      const span = A.pos.distanceTo(B.pos) + (A.vs + B.vs);
      const dm = this.distMul;
      const target = new THREE.Vector3(mid.x * 0.6, (1.3 + span * 0.45) * dm, (3.4 + span * 0.9) * dm);
      this.camera.position.lerp(target, dt * 1.5);
      this.camLook.lerp(mid, dt * 3);
    }
    this.camera.lookAt(this.camLook);

    // 落下・反転などの見た目
    for (const f of [A, B]) {
      const m = f.model;
      if (f.turnAround > 0) {
        f.turnAround -= dt;
        const k = f.turnAround > 0.5 ? (1 - f.turnAround) * 2 : f.turnAround * 2;
        m.root.rotation.y += 0; // placeModel で上書き
        f._turn = Math.PI * clamp(k * 1.4, 0, 1);
      } else f._turn = 0;
      if (f.liftAnim) {
        const la = f.liftAnim;
        la.t += dt;
        if (la.success) {
          f.lift = clamp(la.t * 2.5, 0, 1);
          f.flip = clamp((la.t - 0.2) * 2, 0, 1);
          if (la.t > 0.7) { f.lift = Math.max(0, 1 - (la.t - 0.7) * 3); }
          if (la.t > 1.4) f.liftAnim = null;
        } else {
          f.lift = Math.sin(clamp(la.t / 0.8, 0, 1) * Math.PI) * 0.6;
          if (la.t > 0.8) { f.lift = 0; f.liftAnim = null; }
        }
      }
      if (f.state === 'fall') {
        f.fallV += dt * 9.8;
        f.fallY -= f.fallV * dt * 0.5;
        f.pos.addScaledVector(f.fallDir, dt * 0.9);
        if (!f.landed) {
          f.fallSpin = (f.fallSpin || 0) + dt * 5;
          if (f.fallY < -2 + 0.02) { f.fallY = -2 + 0.02; f.fallV = 0; f.fallDir.set(0, 0); f.landed = true; f.restSpin = Math.round(f.fallSpin / Math.PI) * Math.PI; Audio.sfx('thud'); }
        } else {
          f.fallSpin += (f.restSpin - f.fallSpin) * Math.min(1, dt * 8);
          f.fallY = -2 + 0.02;
          const upside = Math.round(f.restSpin / Math.PI) % 2 !== 0;
          m.walk = upside ? 1.6 : 0; m.legSpeed = 2.5; m.pushT = 0; m.raiseT = upside ? 0.3 : 0.6;
        }
      }
      if (f.state === 'flipped') { m.walk = 1.6; m.legSpeed = 2.5; m.raiseT = 0.3; m.pushT = 0; }
      if (f.state === 'win') { m.walk = 0; m.pushT = 0; m.raiseT = 1; m.openT = 0.9 + Math.sin(this.time * 6) * 0.1; }
      if (f.state === 'idle' && this.phase === 'ending') { m.pushT = 0; }
      this.placeModel(f);
      if (f._turn) f.model.root.rotation.y += f._turn;
      m.update(dt);
    }
    this.updateFinger(this.finger1, dt);
    this.updateFinger(this.finger2, dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.v.y -= 4 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) { this.scene.remove(p.m); this.particles.splice(i, 1); }
    }
  }

  onClick() {
    // 画面タップでも押せる
    if (this.pokeHandler) this.pokeHandler();
    else if (this.phase === 'bout') this.boutPoke(this.f1, this.finger1);
  }

  dispose() {
    this.outdoor.dispose();
    this.f1.model.dispose(); this.f2.model.dispose();
    if (this.hud) { this.hud.box.remove(); this.hud.warn.remove(); }
    document.querySelectorAll('.poke-meter').forEach((e) => e.remove());
    document.body.classList.remove('in-sumo');
    hideBigText();
  }

  resize(w, h) {
    this.distMul = Math.max(1, 1.35 / (w / h));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
