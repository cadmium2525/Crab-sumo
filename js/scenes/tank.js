// 縁側の水槽（ホーム画面）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { Outdoor, rockGeometry, grassField, treeCluster, terrain } from '../env.js';
import { plankTextures, groundTextures, rockTextures, waterNormal, causticsTexture, getNoise, mulberry32 } from '../textures.js';
import { CrabModel } from '../crab.js';
import { SPECIES, SPECIES_ORDER, RIVALS, rivalCrab, overallPower } from '../data.js';
import { el, modal, toast, crabCard, setHud, setActions, confirmBox, promptBox, sayBox } from '../ui.js';
import { SLOTS } from '../data.js';
import * as Save from '../save.js';
import * as Audio from '../audio.js';
import { silhouetteThumb, crabThumbnail } from '../crab.js';

const TW = 6, TH = 3.6, TD = 3.2, WATER = 1.9;

export class TankScene {
  constructor(app, opts = {}) {
    this.app = app;
    this.titleMode = !!opts.titleMode;
    const state = app.state;
    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.2, 6000);
    this.camera.position.set(0, 4.2, 10.5);
    this.time = 0;
    this.outdoor = new Outdoor(app.renderer, scene, state.slot, { shadowSize: 9, fogNear: 40, fogFar: 380 });
    this.outdoor.sunLight.target.position.set(0, 0, 0);
    const night = state.slot === 3;

    this.controls = new OrbitControls(this.camera, app.renderer.domElement);
    this.controls.target.set(0, 1.4, 0);
    this.controls.enableDamping = true;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 16;
    this.controls.minPolarAngle = 0.5;
    this.controls.maxPolarAngle = 1.52;
    this.controls.minAzimuthAngle = -1.1;
    this.controls.maxAzimuthAngle = 1.1;
    this.controls.enablePan = false;
    this.controls.update();

    this.buildVeranda(night);
    this.buildTank(night);

    // カニ
    this.crabs = [];
    this.crabGroup = new THREE.Group();
    scene.add(this.crabGroup);
    for (const c of state.crabs) this.addCrab(c);
    this.selected = null;
    this.food = [];
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.9, 40), new THREE.MeshBasicMaterial({ color: '#ffd040', transparent: true, opacity: 0.8, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
    this.raycaster = new THREE.Raycaster();
    Audio.ambient(null);
    Audio.music(night ? 'night' : 'home');
  }

  // ---- 縁側と庭 ----
  buildVeranda(night) {
    const scene = this.scene;
    const pt = plankTextures();
    const floorMat = new THREE.MeshStandardMaterial({ map: pt.map, normalMap: pt.normalMap, roughness: 0.55, metalness: 0 });
    pt.map.repeat.set(3, 1); pt.normalMap.repeat.set(3, 1);
    pt.map.rotation = Math.PI / 2; pt.normalMap.rotation = Math.PI / 2;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.4, 9), floorMat);
    floor.position.set(0, -0.2 - 2.2, 1.0);
    floor.receiveShadow = true;
    scene.add(floor);
    // 水槽台
    const standMat = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.6, map: pt.map });
    const stand = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.8, 2.2, TD + 0.8), standMat);
    stand.position.set(0, -1.1, 0);
    stand.castShadow = true; stand.receiveShadow = true;
    scene.add(stand);
    // 柱と軒
    const woodMat = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.7, map: pt.map });
    for (const x of [-11, 11]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 16, 0.7), woodMat);
      p.position.set(x, 5.6, -3.2); p.castShadow = true; scene.add(p);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 0.8, 0.9), woodMat);
    beam.position.set(0, 12.5, -3.2); scene.add(beam);
    const eave = new THREE.Mesh(new THREE.BoxGeometry(32, 0.3, 14), new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 0.9 }));
    eave.position.set(0, 13.2, 2); eave.castShadow = true; scene.add(eave);

    // 庭
    const gt = groundTextures('grass');
    gt.map.repeat.set(30, 30); gt.normalMap.repeat.set(30, 30);
    const gh = (x, z) => -4.4 + (getNoise(3).fbm(x / 200 + 0.5, z / 200 + 0.5, 3, 3) - 0.5) * 3 * Math.min(1, Math.max(0, (-z - 10) / 30));
    const ground = new THREE.Mesh(terrain(400, 400, 80, 80, gh), new THREE.MeshStandardMaterial({ map: gt.map, normalMap: gt.normalMap, roughness: 1 }));
    ground.position.z = -150;
    ground.receiveShadow = true;
    scene.add(ground);
    const grass = grassField(5000, (r) => {
      const x = (r() - 0.5) * 60, z = -4 - r() * 30;
      return { x, y: gh(x, z + 150) , z, h: 0.8 + r() * 1.2 };
    }, { seed: 4 });
    grass.position.y = 0;
    scene.add(grass);
    this.grass = grass;
    // 庭石
    const rt = rockTextures(0);
    const rockMat = new THREE.MeshStandardMaterial({ map: rt.map, normalMap: rt.normalMap, roughness: 0.9 });
    const rr = mulberry32(8);
    for (let i = 0; i < 6; i++) {
      const s = 1 + rr() * 2.5;
      const m = new THREE.Mesh(rockGeometry(20 + i, s, s * 0.6, s), rockMat);
      m.position.set((rr() - 0.5) * 40, -4.4, -8 - rr() * 20);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    }
    // 生け垣と木
    scene.add(treeCluster(40, (r) => {
      const a = r() * Math.PI - Math.PI;
      const d = 85 + r() * 160;
      return { x: Math.cos(a) * d, y: -4, z: Math.sin(a) * d - 10, h: 18 + r() * 30 };
    }, 5));
    // 夜の照明
    if (night) {
      const lamp = new THREE.PointLight('#ffb070', 30, 30, 1.6);
      lamp.position.set(-5, 8, 4);
      lamp.castShadow = true;
      scene.add(lamp);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffd8a0' }));
      bulb.position.copy(lamp.position);
      scene.add(bulb);
    }
  }

  // ---- 水槽 ----
  buildTank(night) {
    const scene = this.scene;
    const tank = new THREE.Group();
    scene.add(tank);
    // 底砂
    const gt = groundTextures('tank');
    gt.map.repeat.set(3, 1.6); gt.normalMap.repeat.set(3, 1.6); gt.roughnessMap.repeat.set(3, 1.6);
    const n = getNoise(17);
    this.floorY = (x, z) => 0.32 + (-z / TD) * 0.25 + (n.fbm(x / TW + 0.5, z / TD + 0.5, 3, 3) - 0.5) * 0.15;
    const gravelGeo = terrain(TW - 0.02, TD - 0.02, 60, 32, this.floorY);
    const caustic = causticsTexture();
    this.causticUniforms = { uTime: { value: 0 }, uCaustic: { value: caustic }, uStrength: { value: night ? 0.25 : 0.55 } };
    const gravelMat = new THREE.MeshStandardMaterial({ map: gt.map, normalMap: gt.normalMap, normalScale: new THREE.Vector2(0.45, 0.45), roughnessMap: gt.roughnessMap, roughness: 1 });
    const cu = this.causticUniforms;
    gravelMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, cu);
      sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vWP;\nuniform float uTime; uniform sampler2D uCaustic; uniform float uStrength;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
        float c1 = texture2D(uCaustic, vWP.xz * 0.22 + vec2(uTime * 0.012, uTime * 0.008)).r;
        float c2 = texture2D(uCaustic, vWP.xz * 0.19 + vec2(-uTime * 0.01, uTime * 0.013) + 0.37).r;
        float cs = smoothstep(0.05, 0.9, min(c1, c2)) * 1.6;
        outgoingLight += diffuseColor.rgb * cs * uStrength;
        #include <opaque_fragment>`);
    };
    const gravel = new THREE.Mesh(gravelGeo, gravelMat);
    gravel.receiveShadow = true;
    tank.add(gravel);
    // 底砂の側面（ガラス越しに見える断面）
    const sideMat = new THREE.MeshStandardMaterial({ map: gt.map, roughness: 1, color: '#d8cfc0' });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(TW - 0.02, 0.4), sideMat);
    front.position.set(0, 0.2, TD / 2 - 0.06); // 水の前面(TD/2-0.02)と重ならない位置
    tank.add(front);

    // 岩組（陸地）
    const rt = rockTextures(1);
    const rockMat = new THREE.MeshStandardMaterial({ map: rt.map, normalMap: rt.normalMap, roughnessMap: rt.roughnessMap, roughness: 1 });
    const rocks = [
      { x: -2.1, z: -0.8, s: 0.95, sy: 1.6, seed: 3 },
      { x: -1.3, z: -1.0, s: 0.7, sy: 1.0, seed: 4 },
      { x: -2.4, z: 0.2, s: 0.55, sy: 0.6, seed: 5 },
      { x: 1.9, z: -1.1, s: 0.6, sy: 0.5, seed: 6 },
      { x: 0.6, z: -1.2, s: 0.4, sy: 0.4, seed: 7 },
    ];
    this.obstacles = [];
    for (const r of rocks) {
      const m = new THREE.Mesh(rockGeometry(r.seed, r.s, r.sy, r.s * 0.8, 3), rockMat);
      m.position.set(r.x, this.floorY(r.x, r.z), r.z);
      m.castShadow = true; m.receiveShadow = true;
      tank.add(m);
      this.obstacles.push({ x: r.x, z: r.z, r: r.s * 0.95 });
    }
    // 水草
    const plants = grassField(70, (r) => {
      const x = 0.4 + r() * 2.2, z = -1.4 + r() * 0.5;
      return { x, y: this.floorY(x, z), z, h: 0.8 + r() * 1.0 };
    }, { seed: 9, color: '#7fbf6a' });
    plants.scale.set(1, 1, 1);
    tank.add(plants);
    this.plants = plants;

    // 水
    const wn = waterNormal(512, 83);
    wn.repeat.set(1.5, 1);
    this.waterNormal = wn;
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff', transmission: 1, roughness: 0.03, metalness: 0, ior: 1.33, thickness: 2.4,
      attenuationColor: new THREE.Color('#9ccfc0'), attenuationDistance: 5.5, normalMap: wn, normalScale: new THREE.Vector2(0.15, 0.15),
      specularIntensity: 1, envMapIntensity: 1,
    });
    waterMat.normalScale.set(0.08, 0.08);
    const waterSideMat = waterMat.clone();
    waterSideMat.normalMap = null;
    // BoxGeometry の面順: +x, -x, +y(水面), -y, +z, -z
    const water = new THREE.Mesh(new THREE.BoxGeometry(TW - 0.04, WATER, TD - 0.04),
      [waterSideMat, waterSideMat, waterMat, waterSideMat, waterSideMat, waterSideMat]);
    water.position.y = WATER / 2 + 0.01;
    tank.add(water);
    this.water = water;

    // ガラス
    const glassMat = new THREE.MeshPhysicalMaterial({ color: '#d8f0ea', transparent: true, opacity: 0.12, roughness: 0.02, metalness: 0, envMapIntensity: 1.6, specularIntensity: 1, depthWrite: false, side: THREE.DoubleSide });
    const gl = 0.05;
    const panes = [
      [TW, TH, gl, 0, TH / 2, TD / 2], [TW, TH, gl, 0, TH / 2, -TD / 2],
      [gl, TH, TD, TW / 2, TH / 2, 0], [gl, TH, TD, -TW / 2, TH / 2, 0],
    ];
    for (const p of panes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(p[0], p[1], p[2]), glassMat);
      m.position.set(p[3], p[4], p[5]);
      m.renderOrder = 2;
      tank.add(m);
    }
    // 枠
    const frameMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.4 });
    for (const y of [0.04, TH - 0.04]) {
      for (const [w, d, x, z] of [[TW + 0.12, 0.12, 0, TD / 2], [TW + 0.12, 0.12, 0, -TD / 2], [0.12, TD + 0.12, TW / 2, 0], [0.12, TD + 0.12, -TW / 2, 0]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), frameMat);
        m.position.set(x, y, z); m.castShadow = true;
        tank.add(m);
      }
    }
    // エアストーンと泡
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), new THREE.MeshStandardMaterial({ color: '#7a8a9a', roughness: 1 }));
    stone.position.set(2.5, this.floorY(2.5, -1.3) + 0.05, -1.3);
    tank.add(stone);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, TH, 6), new THREE.MeshPhysicalMaterial({ color: '#cfe8e0', transparent: true, opacity: 0.5, roughness: 0.1 }));
    tube.position.set(2.75, TH / 2 + 0.2, -1.45);
    tank.add(tube);
    const bubbleGeo = new THREE.SphereGeometry(0.04, 8, 6);
    const bubbleMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, roughness: 0, metalness: 0.1, envMapIntensity: 2 });
    this.bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, 40);
    this.bubbleData = [];
    for (let i = 0; i < 40; i++) this.bubbleData.push({ y: Math.random() * WATER, s: 0.5 + Math.random(), ph: Math.random() * 6, sp: 0.8 + Math.random() * 0.6 });
    this.bubbleOrigin = stone.position.clone();
    tank.add(this.bubbles);

    // 水槽ライト
    const tl = new THREE.SpotLight(night ? '#e8f0ff' : '#ffffff', night ? 40 : 18, 12, 0.9, 0.6, 1.5);
    tl.position.set(0, TH + 3, 0.5);
    tl.target.position.set(0, 0, 0);
    tl.castShadow = true;
    tl.shadow.mapSize.set(1024, 1024);
    tl.shadow.bias = -0.0005;
    this.scene.add(tl, tl.target);
  }

  addCrab(c) {
    const m = new CrabModel(c);
    const p = this.randomPoint();
    m.root.position.set(p.x, this.floorY(p.x, p.z), p.z);
    m.root.rotation.y = Math.random() * Math.PI * 2;
    this.crabGroup.add(m.root);
    const ai = { model: m, crab: c, target: null, wait: Math.random() * 2, speed: 0.25 + c.stats.agility * 0.04 };
    this.crabs.push(ai);
    return ai;
  }

  randomPoint() {
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * (TW - 1.2), z = (Math.random() - 0.5) * (TD - 1.0);
      if (this.obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + 0.3)) return { x, z };
    }
    return { x: 0.5, z: 0.5 };
  }

  enter() {
    if (this.titleMode) {
      document.getElementById('hud').style.display = 'none';
      return;
    }
    this.showHub();
  }

  exitTitle() {
    this.titleMode = false;
    document.getElementById('hud').style.display = '';
    this.camera.position.set(0, 4.2 + ((this.distMul || 1) - 1) * 2, 10.5 * (this.distMul || 1));
    this.controls.update();
    this.showHub();
  }

  hudHtml() {
    const s = this.app.state;
    const traps = s.traps.map((t) => (t.loc === 'river' ? '川' : '海')).join('・');
    return `<div class="date">${Save.dateLabel(s)}　${SLOTS[s.slot]}</div>
      <div class="sub">水槽 ${s.crabs.length}/${s.capacity}匹 ・ カゴ ${s.trapCount - s.traps.length}/${s.trapCount}${traps ? `（${traps}に設置中）` : ''}${s.title ? ` ・ <b style="color:#c4282e">${s.title}</b>` : ''}</div>`;
  }

  showHub() {
    const s = this.app.state;
    setHud(this.hudHtml());
    setActions([
      { label: '🏞 川へ行く', onclick: () => this.app.goto('field', { loc: 'river' }) },
      { label: '🌊 海へ行く', onclick: () => this.app.goto('field', { loc: 'sea' }) },
      { label: '🦀 カニ相撲', cls: 'primary', onclick: () => this.openSumo() },
      { label: '🐟 エサ', onclick: () => this.feed(), disabled: s.fedDay === s.day || !s.crabs.length },
      { label: '📋 カニ', onclick: () => this.openList() },
      { label: '📖 図鑑', onclick: () => this.openZukan() },
      { label: '💤 ひと休み', onclick: () => this.rest() },
    ]);
    if (!s.crabs.length) toast('水槽はからっぽ。川か海でカニをつかまえよう！', 3500);
    if (s.day > 31 && !s.summerEndSeen) {
      s.summerEndSeen = true;
      this.app.save();
      sayBox('ぼく', `夏休みが終わってしまった……。\nでも、カニたちとの夏はまだまだ続く。\n（これまでの成績：${s.record.wins}勝${s.record.losses}敗）`, '#2f6f8f');
    }
  }

  async rest() {
    Save.advanceTime(this.app.state, 1);
    this.app.save();
    this.app.goto('tank');
  }

  feed() {
    const s = this.app.state;
    if (s.fedDay === s.day) return;
    s.fedDay = s.day;
    for (const c of s.crabs) c.condition = Math.min(100, c.condition + 25);
    this.app.save();
    Audio.sfx('splash');
    const geo = new THREE.SphereGeometry(0.06, 8, 6);
    const mat = new THREE.MeshStandardMaterial({ color: '#8a5a2a', roughness: 0.8 });
    for (let i = 0; i < Math.max(3, this.crabs.length); i++) {
      const p = this.randomPoint();
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p.x, WATER, p.z);
      m.castShadow = true;
      this.scene.add(m);
      this.food.push({ mesh: m, x: p.x, z: p.z, landed: false, eaten: 0 });
    }
    toast('エサをあげた。カニたちの調子が上がった！');
    this.showHub();
  }

  openList() {
    const s = this.app.state;
    modal((b, close) => {
      if (!s.crabs.length) { b.appendChild(el('p', { class: 'msg' }, 'まだカニがいません。')); return; }
      const list = el('div', { class: 'list' });
      for (const c of s.crabs) {
        list.appendChild(crabCard(c, { compact: true, onclick: () => { close(); this.select(c.id); } }));
      }
      b.appendChild(list);
    }, { title: `水槽のカニ（${s.crabs.length}/${s.capacity}）` });
  }

  select(id) {
    const ai = this.crabs.find((a) => a.crab.id === id);
    this.selected = ai || null;
    const side = document.getElementById('side');
    side.innerHTML = '';
    if (!ai) { this.ring.visible = false; return; }
    const c = ai.crab;
    const card = crabCard(c, {
      extra: el('div', { class: 'card-actions' },
        el('button', { class: 'btn', onclick: async () => {
          const nm = await promptBox('名前をつけよう', c.name);
          if (nm) { c.name = nm; this.app.save(); this.select(id); }
        } }, '名前'),
        el('button', { class: 'btn', onclick: () => this.showDetail(c) }, 'くわしく'),
        el('button', { class: 'btn', onclick: async () => {
          if (await confirmBox(`${c.name}を逃がしますか？\n（元の場所に帰します）`)) this.release(c.id);
        } }, '逃がす'),
        el('button', { class: 'btn', onclick: () => this.select(null) }, '閉じる')),
    });
    side.appendChild(card);
    this.ring.visible = true;
  }

  showDetail(c) {
    const sp = SPECIES[c.species];
    modal((b) => {
      b.appendChild(crabCard(c));
      b.appendChild(el('div', { class: 'kv', style: 'margin-top:10px' },
        el('b', {}, '学名'), el('i', {}, sp.sci),
        el('b', {}, '性別'), c.sex === 'm' ? 'オス' : 'メス',
        el('b', {}, '性格'), c.trait,
        el('b', {}, 'つかまえた日'), `${c.caughtDay <= 31 ? '8月' + c.caughtDay + '日' : c.caughtDay + '日目'}`,
        el('b', {}, '戦績'), `${c.wins}勝 ${c.losses}敗`));
      b.appendChild(el('p', { class: 'desc' }, sp.desc));
    }, { title: c.name });
  }

  release(id) {
    const s = this.app.state;
    const i = s.crabs.findIndex((c) => c.id === id);
    if (i < 0) return;
    const [c] = s.crabs.splice(i, 1);
    const ai = this.crabs.find((a) => a.crab.id === id);
    if (ai) { ai.model.dispose(); this.crabs.splice(this.crabs.indexOf(ai), 1); }
    this.select(null);
    this.app.save();
    toast(`${c.name}を逃がした。元気でな！`);
    this.showHub();
  }

  openSumo() {
    const s = this.app.state;
    modal((b, close) => {
      b.appendChild(el('p', { class: 'help' }, '近所の子どもたちに相撲を挑もう。勝つと次の相手に挑戦できる。'));
      const list = el('div', { class: 'list' });
      RIVALS.forEach((rv, i) => {
        const unlocked = i === 0 || s.beaten[RIVALS[i - 1].id];
        const rc = rivalCrab(rv);
        const sp = SPECIES[rc.species];
        const row = el('div', { class: 'rival' + (unlocked ? '' : ' locked'), onclick: () => {
          if (!unlocked) return;
          close();
          this.chooseCrab(rv);
        } },
          el('div', { class: 'face', style: `background:${unlocked ? rv.color : '#999'}` }, unlocked ? rv.name[0] : '？'),
          el('div', {},
            el('div', { class: 'rk' }, rv.rank),
            el('div', { class: 'nm' }, unlocked ? rv.name : '？？？'),
            el('div', { class: 'ds' }, unlocked ? `${rv.title} ／ ${rc.name}（${sp.name} ${rc.size}cm）強さ${overallPower(rc)}` : '前の相手に勝つと挑戦できる')),
          s.beaten[rv.id] ? el('div', { class: 'done' }, '★') : null);
        list.appendChild(row);
      });
      b.appendChild(list);
      b.appendChild(el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: () => { close(); this.chooseCrab(null); } }, '野良ガニと練習試合'),
        s.crabs.length >= 2 ? el('button', { class: 'btn', onclick: () => { close(); this.chooseCrab('self'); } }, '自分のカニ同士') : null));
    }, { title: '🦀 カニ相撲 番付', wide: true });
  }

  chooseCrab(rival, first = null) {
    const s = this.app.state;
    if (!s.crabs.length) { toast('まずはカニをつかまえよう！'); return; }
    modal((b, close) => {
      b.appendChild(el('p', { class: 'help' }, first ? `${first.name}の相手を選んでください。` : '土俵に上げるカニを選んでください。調子が30未満のカニは疲れていて出られません。'));
      const list = el('div', { class: 'list' });
      for (const c of s.crabs) {
        if (first && c.id === first.id) continue;
        const ok = c.condition >= 30;
        const card = crabCard(c, { compact: true, onclick: () => {
          if (!ok) { toast(`${c.name}は疲れている。休ませてあげよう`); return; }
          close();
          if (rival === 'self' && !first) { this.chooseCrab('self', c); return; }
          if (rival === 'self') this.app.goto('sumo', { crabId: first.id, selfOpp: c.id });
          else this.app.goto('sumo', { crabId: c.id, rivalId: rival ? rival.id : null });
        } });
        if (!ok) card.style.opacity = 0.5;
        list.appendChild(card);
      }
      b.appendChild(list);
    }, { title: first ? '相手のカニ' : '出場するカニ', wide: true });
  }

  openZukan() {
    const s = this.app.state;
    const found = SPECIES_ORDER.filter((id) => s.zukan[id]).length;
    modal((b) => {
      b.appendChild(el('p', { class: 'help' }, `見つけたカニ ${found} / ${SPECIES_ORDER.length} 種`));
      const grid = el('div', { class: 'zukan' });
      for (const id of SPECIES_ORDER) {
        const z = s.zukan[id];
        const sp = SPECIES[id];
        const hab = sp.habitat === 'river' ? '川' : '海';
        if (!z) {
          grid.appendChild(el('div', { class: 'zk unknown' }, el('img', { src: silhouetteThumb(id) }), el('div', { class: 'n' }, '？？？'), el('div', { class: 'h' }, hab)));
        } else {
          grid.appendChild(el('div', { class: 'zk', onclick: () => {
            modal((bb) => {
              bb.appendChild(el('img', { src: crabThumbnail(z.sample, 240), style: 'width:200px;display:block;margin:0 auto;border-radius:12px;background:radial-gradient(#fff,#e8dcc4)' }));
              bb.appendChild(el('div', { class: 'kv', style: 'margin:10px 0' },
                el('b', {}, '学名'), el('i', {}, sp.sci),
                el('b', {}, 'すみか'), hab,
                el('b', {}, '甲幅'), `${sp.size[0]}〜${sp.size[1]}cm`,
                el('b', {}, 'つかまえた数'), `${z.count}匹`,
                el('b', {}, '最大記録'), `${z.maxSize.toFixed(1)}cm`));
              bb.appendChild(el('p', { class: 'desc' }, sp.desc));
            }, { title: sp.name });
          } }, el('img', { src: crabThumbnail(z.sample, 160) }), el('div', { class: 'n' }, sp.name), el('div', { class: 'h' }, `${hab} ・ 最大${z.maxSize.toFixed(1)}cm`)));
        }
      }
      b.appendChild(grid);
    }, { title: '📖 カニ図鑑', wide: true });
  }

  onClick(ndc) {
    if (this.titleMode) return;
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.crabGroup.children, true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData.crabModel) o = o.parent;
      if (o) {
        const ai = this.crabs.find((a) => a.model === o.userData.crabModel);
        if (ai) { this.select(ai.crab.id); Audio.sfx('click'); ai.model.raiseT = 1; ai.threat = 1.2; return; }
      }
    }
    // スクリーン距離で拾う（小さいカニ用）
    let best = null, bd = 0.08;
    const v = new THREE.Vector3();
    for (const a of this.crabs) {
      v.copy(a.model.root.position).project(this.camera);
      const d = Math.hypot(v.x - ndc.x, (v.y - ndc.y) * innerHeight / innerWidth);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) { this.select(best.crab.id); Audio.sfx('click'); best.model.raiseT = 1; best.threat = 1.2; }
  }

  update(dt) {
    this.time += dt;
    if (this.titleMode) {
      const a = Math.sin(this.time * 0.15) * 0.7;
      const dm = this.distMul || 1;
      this.camera.position.set(Math.sin(a) * 9 * dm, 3.2 + Math.sin(this.time * 0.2) * 0.4, Math.cos(a) * 9 * dm);
      this.camera.lookAt(0, 1.2, 0);
    } else {
      this.controls.update();
    }
    this.causticUniforms.uTime.value = this.time;
    if (this.grass.userData.uniforms) this.grass.userData.uniforms.uTime.value = this.time;
    if (this.plants.userData.uniforms) this.plants.userData.uniforms.uTime.value = this.time * 0.6;
    this.waterNormal.offset.set(this.time * 0.02, this.time * 0.013);
    // 泡
    const m = new THREE.Matrix4();
    this.bubbleData.forEach((b, i) => {
      b.y += dt * b.sp;
      if (b.y > WATER) b.y = 0;
      const o = this.bubbleOrigin;
      m.makeScale(b.s, b.s, b.s);
      m.setPosition(o.x + Math.sin(this.time * 3 + b.ph) * 0.05, o.y + b.y, o.z + Math.cos(this.time * 2.5 + b.ph) * 0.05);
      this.bubbles.setMatrixAt(i, m);
    });
    this.bubbles.instanceMatrix.needsUpdate = true;
    // エサ
    for (const f of this.food) {
      if (!f.landed) {
        f.mesh.position.y -= dt * 0.6;
        f.mesh.position.x += Math.sin(this.time * 2 + f.x) * dt * 0.05;
        const fy = this.floorY(f.mesh.position.x, f.mesh.position.z) + 0.05;
        if (f.mesh.position.y <= fy) { f.mesh.position.y = fy; f.landed = true; f.x = f.mesh.position.x; f.z = f.mesh.position.z; }
      }
    }
    // カニの徘徊
    for (const a of this.crabs) this.updateCrab(a, dt);
    if (this.selected) {
      const p = this.selected.model.root.position;
      this.ring.position.set(p.x, p.y + 0.03, p.z);
      const s = this.selected.model.scale * 1.4;
      this.ring.scale.setScalar(s);
      this.ring.material.opacity = 0.5 + Math.sin(this.time * 5) * 0.3;
    }
  }

  updateCrab(a, dt) {
    const m = a.model;
    const pos = m.root.position;
    if (a.threat > 0) {
      a.threat -= dt;
      m.walk = 0; m.raiseT = 1; m.openT = 0.9;
      if (a.threat <= 0) { m.raiseT = 0; m.openT = 0.2; }
      m.update(dt);
      return;
    }
    // エサを探す
    const food = this.food.find((f) => f.landed && f.eaten < 4);
    if (food && !a.eating && Math.random() < 0.02) a.target = { x: food.x + (Math.random() - 0.5) * 0.3, z: food.z + 0.2, food };
    if (a.eating > 0) {
      a.eating -= dt;
      m.walk = 0;
      m.feed += dt * 5;
      m.openT = 0.4;
      if (a.eating <= 0) {
        a.eating = 0; m.feed = 0;
        if (a.food) {
          a.food.eaten += 1;
          if (a.food.eaten >= 3) { this.scene.remove(a.food.mesh); this.food.splice(this.food.indexOf(a.food), 1); }
          a.food = null;
        }
      }
      m.update(dt);
      return;
    }
    if (!a.target) {
      a.wait -= dt;
      m.walk *= 0.9;
      if (Math.random() < 0.003) m.feed = 0.01;
      if (m.feed > 0) { m.feed += dt * 4; if (m.feed > Math.PI * 4) m.feed = 0; }
      if (a.wait <= 0) { const p = this.randomPoint(); a.target = { x: p.x, z: p.z }; }
    } else {
      const dx = a.target.x - pos.x, dz = a.target.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.08) {
        if (a.target.food && this.food.includes(a.target.food)) { a.eating = 3; a.food = a.target.food; }
        a.target = null; a.wait = 1 + Math.random() * 4;
      } else {
        // 横歩き：体の x 軸を進行方向へ
        const desired = Math.atan2(-dz, dx); // x 軸を向ける yaw
        let yaw = m.root.rotation.y;
        // 左右どちらでも横歩きできるので近い方を選ぶ
        let diff1 = ((desired - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        let diff2 = ((desired + Math.PI - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const useLeft = Math.abs(diff2) < Math.abs(diff1);
        const diff = useLeft ? diff2 : diff1;
        m.root.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), dt * 1.5);
        const sp = Math.min(a.speed, d * 2);
        pos.x += (dx / d) * sp * dt;
        pos.z += (dz / d) * sp * dt;
        m.walk = (useLeft ? -1 : 1) * Math.min(1, sp / 0.3);
        m.legSpeed = 1 / Math.max(0.4, m.scale * 2);
      }
    }
    pos.y = this.floorY(pos.x, pos.z);
    m.update(dt);
  }

  dispose() {
    this.controls.dispose();
    this.outdoor.dispose();
    for (const a of this.crabs) a.model.dispose();
    this.scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.();
    });
    document.getElementById('side').innerHTML = '';
    document.getElementById('hud').style.display = '';
  }

  resize(w, h) {
    const dm = Math.max(1, 1.5 / (w / h));
    if (dm !== this.distMul) {
      this.distMul = dm;
      this.controls.maxDistance = 16 * dm;
      this.camera.position.set(0, 4.2 + (dm - 1) * 2, 10.5 * dm);
      this.controls.update();
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
