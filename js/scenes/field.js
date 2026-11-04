// 川・海でのカニとり（手づかみ・カゴ罠）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { Outdoor, rockGeometry, grassField, treeCluster, terrain } from '../env.js';
import { groundTextures, rockTextures, waterNormal, getNoise, mulberry32, netTexture } from '../textures.js';
import { CrabModel } from '../crab.js';
import { SPECIES, SPAWN, BAITS, SLOTS, makeCrab, pickWeighted } from '../data.js';
import { el, modal, toast, bigText, setHud, setActions } from '../ui.js';
import { catchFlow } from '../catchui.js';
import * as Save from '../save.js';
import * as Audio from '../audio.js';

const FLIPS = 10;

// 波の周期（秒）。沖の波・波打ち際・波の音をこの周期で合わせる
const WAVE_T = 5.5;
const NOISE_GLSL = `
      #define WAVE_T ${WAVE_T.toFixed(2)}
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }`;

// 高さで2種類の地面をブレンドするマテリアル
function splatMaterial(low, high, opts = {}) {
  const { scaleLow = 0.25, scaleHigh = 0.2, blendY = 0.4, wetY = 0.15 } = opts;
  const mat = new THREE.MeshStandardMaterial({ map: low.map, normalMap: low.normalMap, roughness: 1 });
  const u = { uHigh: { value: high.map }, uHighN: { value: high.normalMap }, uLowS: { value: scaleLow }, uHighS: { value: scaleHigh }, uBlendY: { value: blendY }, uWetY: { value: wetY }, uTide: { value: 0 }, uTime: { value: 0 }, uFoam: { value: 0 }, uFoamLight: { value: 1 }, uSeaTex: { value: null } };
  mat.userData.uniforms = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vWP;
      uniform sampler2D uHigh; uniform sampler2D uHighN; uniform float uLowS; uniform float uHighS; uniform float uBlendY; uniform float uWetY; uniform float uTide; uniform float uTime; uniform float uFoam; uniform float uFoamLight;
      ${NOISE_GLSL}
      uniform sampler2D uSeaTex;
      ${opts.seaMapGLSL || 'vec4 seaMap(vec2 xz) { return vec4(0.0, 0.0, 1.0, 1.0); }'}
      float blendF;
      float wetF;
      ` + sh.fragmentShader
      .replace('#include <map_fragment>', `
        float nn = vn(vWP.xz * 0.35) * 0.6 + vn(vWP.xz * 1.3) * 0.3;
        blendF = smoothstep(uBlendY - 0.25, uBlendY + 0.25, vWP.y + (nn - 0.45) * 0.6);
        wetF = 1.0 - smoothstep(uWetY - 0.1 + uFoam * 0.1, uWetY + 0.35 + uFoam * 0.1, vWP.y);
        vec4 cLow = texture2D(map, vWP.xz * uLowS);
        vec4 cHigh = texture2D(uHigh, vWP.xz * uHighS);
        vec4 sampledDiffuseColor = mix(cLow, cHigh, blendF);
        float macro = vn(vWP.xz * 0.08) * 0.5 + vn(vWP.xz * 0.23) * 0.5;
        sampledDiffuseColor.rgb *= 0.78 + macro * 0.44;
        sampledDiffuseColor.rgb *= mix(1.0, 0.6, wetF);
        // 波打ち際：沖から来た波が砂浜を駆け上がり、引いていく（水面そのものは動かさない）
        if (uFoam > 0.5) {
          float cyc = uTime / WAVE_T;
          float w = fract(cyc);
          float id = floor(cyc);
          float land = smoothstep(-0.05, 0.0, vWP.y) * seaMap(vWP.xz).z;
          // 波ごと・場所ごとに駆け上がる高さが違う
          float R = 0.08 + 0.07 * vn(vec2(vWP.x * 0.11 + id * 3.7, id * 1.31));
          float up = w < 0.2 ? sin(w / 0.2 * 1.5708) : 1.0 - smoothstep(0.2, 0.96, w);
          float H = R * up - 0.012 + (vn(vWP.xz * 0.8 + id) - 0.5) * 0.025;
          float sheet = smoothstep(H + 0.005, H - 0.012, vWP.y) * land;
          float thin = smoothstep(H, H - 0.05, vWP.y);
          // 水の膜（先端ほど薄い）
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, sampledDiffuseColor.rgb * vec3(0.5, 0.63, 0.7), sheet * (0.45 + thin * 0.35));
          // 泡：先端のふちと、引き波に残るレース模様
          float n1 = vn(vWP.xz * 5.0 + vec2(uTime * 0.25, -uTime * 0.1));
          float n2 = vn(vWP.xz * 15.0 - vec2(uTime * 0.15, 0.0));
          float lace = smoothstep(0.5, 0.78, n1 * 0.65 + n2 * 0.45);
          float front = exp(-abs(vWP.y - H) / 0.011) * land * (w < 0.22 ? 1.0 : 0.7 * (1.0 - smoothstep(0.22, 0.9, w)));
          float trail = sheet * lace * (1.0 - smoothstep(0.15, 0.85, w)) * 0.6;
          float foam = clamp(front * (0.5 + lace * 0.7) + trail, 0.0, 1.0);
          sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, vec3(0.93, 0.96, 0.96) * uFoamLight, foam * 0.92);
          // 波が届いたところまで濡れて光る
          float reach = 0.155 + (vn(vWP.xz * 0.5) - 0.5) * 0.03;
          wetF = max(wetF, smoothstep(reach + 0.03, reach - 0.03, vWP.y) * land * 0.8);
          wetF = max(wetF, sheet);
        }
        diffuseColor *= sampledDiffuseColor;
      `)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(0.92, 0.28, wetF);`)
      .replace('#include <normal_fragment_maps>', `
        vec3 nL = texture2D(normalMap, vWP.xz * uLowS).xyz * 2.0 - 1.0;
        vec3 nH = texture2D(uHighN, vWP.xz * uHighS).xyz * 2.0 - 1.0;
        vec3 mapN = normalize(mix(nL, nH, blendF));
        mapN.xy *= normalScale;
        normal = normalize( tbn * mapN );
      `);
  };
  return mat;
}

export class FieldScene {
  constructor(app, opts) {
    this.app = app;
    this.loc = opts.loc || 'river';
    const state = app.state;
    this.slot = state.slot;
    this.night = this.slot === 3;
    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 8000);
    this.time = 0;
    this.flips = FLIPS;
    this.busy = false;
    this.crab = null;
    this.raycaster = new THREE.Raycaster();
    this.outdoor = new Outdoor(app.renderer, scene, this.slot, { shadowSize: 22, fogNear: 80, fogFar: this.loc === 'sea' ? 1600 : 520 });
    this.outdoor.sunLight.target.position.set(0, 0, 2);

    if (this.loc === 'river') this.buildRiver(); else this.buildSea();
    this.buildRocks();
    this.buildTraps();
    if (this.night) this.buildNight();

    this.camera.position.set(0, 11, 14.5);
    this.controls = new OrbitControls(this.camera, app.renderer.domElement);
    this.controls.target.set(0, 0, 1);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 30;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.2;
    this.controls.minAzimuthAngle = -0.9;
    this.controls.maxAzimuthAngle = 0.9;
    this.controls.update();

    this.particles = [];
    Audio.ambient(this.loc);
    Audio.music(this.night ? 'night' : 'field');
  }

  // ---------- 川 ----------
  buildRiver() {
    const n = getNoise(2);
    this.center = (x) => Math.sin(x * 0.07) * 2.2 + 0.5;
    this.height = (x, z) => {
      const d = Math.abs(z - this.center(x));
      const sm = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
      const nn = (n.fbm(x / 70 + 0.5, z / 50 + 0.5, 4, 4) - 0.5);
      return -1.5 * (1 - sm(0, 6.8, d)) + 1.6 * sm(6.5, 15, d) + nn * 0.8 - 0.05;
    };
    const gravel = groundTextures('gravel'), grass = groundTextures('grass');
    const mat = splatMaterial(gravel, grass, { scaleLow: 0.42, scaleHigh: 0.15, blendY: 0.9, wetY: 0.12 });
    this.groundMat = mat;
    const g = new THREE.Mesh(terrain(90, 60, 180, 120, this.height), mat);
    g.receiveShadow = true;
    this.scene.add(g);
    this.ground = g;
    // 遠景の地面
    const far = new THREE.Mesh(new THREE.RingGeometry(40, 900, 64, 1), new THREE.MeshStandardMaterial({ color: '#4c6230', roughness: 1 }));
    far.rotation.x = -Math.PI / 2; far.position.y = 1.0;
    this.scene.add(far);
    // 上流・下流方向の水面の延長
    this.addWater(new THREE.PlaneGeometry(400, 120, 1, 1), '#4f7a5a', 2.2, (m) => { m.position.set(0, 0, 0); });
    // 大きな岩（景観）
    const rt = rockTextures(0);
    const big = new THREE.MeshStandardMaterial({ map: rt.map, normalMap: rt.normalMap, roughnessMap: rt.roughnessMap, roughness: 1 });
    const rr = mulberry32(31);
    for (let i = 0; i < 10; i++) {
      const x = (rr() - 0.5) * 70, side = rr() < 0.5 ? -1 : 1;
      const z = this.center(x) + side * (5 + rr() * 9);
      if (Math.abs(x) < 15 && z > -4 && z < 12) continue;
      const s = 2.5 + rr() * 4;
      const m = new THREE.Mesh(rockGeometry(100 + i, s, s * 0.7, s * 0.9), big);
      m.position.set(x, this.height(x, z) - s * 0.15, z);
      m.rotation.y = rr() * 6;
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
    }
    // 草
    this.grass = grassField(9000, (r) => {
      const x = (r() - 0.5) * 88, z = (r() - 0.5) * 58;
      const y = this.height(x, z);
      if (y < 0.75) return null;
      return { x, y, z, h: 0.8 + r() * 1.6 };
    }, { seed: 7 });
    this.scene.add(this.grass);
    // 木々
    this.scene.add(treeCluster(70, (r) => {
      const x = (r() - 0.5) * 300;
      const z = r() < 0.6 ? -28 - r() * 120 : 30 + r() * 80;
      if (z > 0 && Math.abs(x) < 40) return null;
      return { x, y: 1, z, h: 20 + r() * 35 };
    }, 12));
    // 山
    this.addMountains('#5a7a5a');
    this.trapSpots = [-8, 0.5, 8.5].map((x) => ({ x, z: this.center(x) + (x > 0 ? -1.2 : 1.0) }));
  }

  // ---------- 海（磯） ----------
  buildSea() {
    const n = getNoise(4);
    this.height = (x, z) => {
      const base = 0.13 * z - 0.2;
      const rock = Math.pow(n.fbm(x / 60 + 0.5, z / 60 + 0.5, 5, 4), 2) * 2.2 - 0.4;
      const pool = -Math.max(0, 1 - Math.hypot(x - 4, z - 2.5) / 2.6) * 0.9 - Math.max(0, 1 - Math.hypot(x + 6, z - 0.5) / 2.2) * 0.8;
      let y = base + rock * (z > -6 ? 1 : 0.5) + pool;
      if (z < -10) y = Math.min(y, -1.2 - (-10 - z) * 0.12);
      return y;
    };
    const rockG = groundTextures('shore'), sand = groundTextures('sand');
    this.bakeSeaMap();
    const mat = splatMaterial(rockG, sand, { scaleLow: 0.07, scaleHigh: 0.18, blendY: 1.2, wetY: 0.3, seaMapGLSL: this.seaMapGLSL });
    mat.userData.uniforms.uFoam.value = 1;
    mat.userData.uniforms.uSeaTex.value = this.seaTex;
    mat.userData.uniforms.uFoamLight.value = [0.95, 1, 0.8, 0.18][this.slot];
    this.groundMat = mat;
    const g = new THREE.Mesh(terrain(90, 70, 180, 140, this.height), mat);
    g.receiveShadow = true;
    this.scene.add(g);
    this.ground = g;
    this.addWater(new THREE.PlaneGeometry(6000, 6000, 1, 1), '#2f7a88', 4.5, () => {});
    const far = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), new THREE.MeshStandardMaterial({ color: '#c8b88a', roughness: 1 }));
    far.rotation.x = -Math.PI / 2; far.position.set(0, 3.5, 135);
    this.scene.add(far);
    // 磯の大岩
    const rt = rockTextures(2);
    const big = new THREE.MeshStandardMaterial({ map: rt.map, normalMap: rt.normalMap, roughnessMap: rt.roughnessMap, roughness: 1 });
    const rr = mulberry32(41);
    for (let i = 0; i < 16; i++) {
      const x = (rr() - 0.5) * 80;
      const z = -4 - rr() * 30;
      if (Math.abs(x) < 12 && z > -12) continue;
      const s = 2 + rr() * 6;
      const m = new THREE.Mesh(rockGeometry(200 + i, s, s * 0.8, s), big);
      m.position.set(x, this.height(x, z) - s * 0.1, z);
      m.rotation.y = rr() * 6;
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
    }
    // 遠くの島
    for (let i = 0; i < 3; i++) {
      const s = 80 + i * 40;
      const m = new THREE.Mesh(rockGeometry(300 + i, s, s * 0.45, s * 0.6, 3), new THREE.MeshStandardMaterial({ color: '#4a5a48', roughness: 1 }));
      m.position.set(-600 + i * 550, -10, -1400 - i * 300);
      this.scene.add(m);
    }
    this.grass = grassField(2500, (r) => {
      const x = (r() - 0.5) * 88, z = 18 + r() * 16;
      return { x, y: this.height(x, z), z, h: 0.6 + r() * 1.2 };
    }, { seed: 8, color: '#d8e0a0' });
    this.scene.add(this.grass);
    this.trapSpots = [{ x: -9, z: -8 }, { x: 0, z: -9 }, { x: 9, z: -8.5 }];
  }

  addWater(geo, atten, dist, place) {
    const wn = waterNormal(512, this.loc === 'sea' ? 85 : 81);
    const wn2 = waterNormal(512, 86);
    const rep = this.loc === 'sea' ? 0.035 : 0.12;
    wn.repeat.set(geo.parameters.width * rep, geo.parameters.height * rep);
    wn2.repeat.set(geo.parameters.width * rep * 1.6, geo.parameters.height * rep * 1.6);
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff', transmission: 1, roughness: this.loc === 'sea' ? 0.09 : 0.04, metalness: 0, ior: 1.33, thickness: this.loc === 'sea' ? 0.9 : 1.4,
      attenuationColor: new THREE.Color(atten), attenuationDistance: dist,
      normalMap: wn, normalScale: this.loc === 'sea' ? new THREE.Vector2(0.16, 0.16) : new THREE.Vector2(0.35, 0.35),
      clearcoat: 1, clearcoatRoughness: this.loc === 'sea' ? 0.16 : 0.05, clearcoatNormalMap: wn2, clearcoatNormalScale: this.loc === 'sea' ? new THREE.Vector2(0.18, 0.18) : new THREE.Vector2(0.3, 0.3),
      specularIntensity: 1, envMapIntensity: 1.1,
    });
    if (this.loc === 'sea') this.addSurf(mat);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    place(m);
    this.scene.add(m);
    this.water = m;
    this.wn = wn; this.wn2 = wn2;
  }

  // 海の波：地形の高さを地図（テクスチャ）にして、深さに応じて波を動かす
  // 海の地図：R=高さ、G=外海につながる水、B=外海の近く（潮だまりには波を立てない）
  bakeSeaMap() {
    const W = 256, Hh = 200, X0 = -45, Z0 = -35, SX = 90, SZ = 70;
    const h = new Float32Array(W * Hh);
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) h[j * W + i] = this.height(X0 + (i + 0.5) / W * SX, Z0 + (j + 0.5) / Hh * SZ);
    const open = new Uint8Array(W * Hh);
    const q = [];
    for (let i = 0; i < W; i++) if (h[i] < 0) { open[i] = 1; q.push(i); }
    while (q.length) {
      const k = q.pop(), i = k % W, j = (k / W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= Hh) continue;
        const nk = nj * W + ni;
        if (!open[nk] && h[nk] < 0) { open[nk] = 1; q.push(nk); }
      }
    }
    // 外海から少し陸へ広げた範囲（波が駆け上がれる場所）
    const near = new Float32Array(W * Hh);
    const R = 7;
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      let best = 0;
      for (let dj = -R; dj <= R && best < 1; dj++) for (let di = -R; di <= R; di++) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= Hh || !open[nj * W + ni]) continue;
        best = Math.max(best, 1 - Math.hypot(di, dj) / (R + 1));
      }
      near[j * W + i] = Math.min(1, best * 2);
    }
    const data = new Uint8Array(W * Hh * 4);
    for (let k = 0; k < W * Hh; k++) {
      data[k * 4] = Math.round(Math.max(0, Math.min(1, (h[k] + 6) / 8)) * 255);
      data[k * 4 + 1] = open[k] ? 255 : 0;
      data[k * 4 + 2] = Math.round(near[k] * 255);
      data[k * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, W, Hh);
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.seaTex = tex;
    this.seaMapGLSL = `
        vec4 seaMap(vec2 xz) {
          vec2 uv = (xz - vec2(${X0.toFixed(1)}, ${Z0.toFixed(1)})) / vec2(${SX.toFixed(1)}, ${SZ.toFixed(1)});
          vec4 m = texture2D(uSeaTex, clamp(uv, 0.0, 1.0));
          return vec4(m.r * 8.0 - 6.0, m.g, m.b, 1.0);
        }`;
    return tex;
  }

  addSurf(mat) {
    const tex = this.seaTex;
    const foamLight = [0.95, 1, 0.8, 0.18][this.slot];
    this.surfU = { uTime: { value: 0 }, uSeaTex: { value: tex }, uFoamLight: { value: foamLight } };
    const su = this.surfU;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, su);
      sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = `varying vec3 vWP;
        uniform float uTime; uniform sampler2D uSeaTex; uniform float uFoamLight;
        ${NOISE_GLSL}
        ${this.seaMapGLSL}
        ` + sh.fragmentShader
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            // 岸へ向かって進むうねり（浅くなるほど高く、波長が短く）
            vec4 sm = seaMap(vWP.xz);
            float d = -sm.x;
            float ph = uTime / WAVE_T + d * 1.15;
            float fadeX = 1.0 - smoothstep(40.0, 60.0, abs(vWP.x));
            float amp = smoothstep(5.0, 0.6, d) * smoothstep(-0.05, 0.15, d) * fadeX * sm.y;
            float sw = (sin(6.2832 * ph) * 0.6 + sin(12.566 * ph) * 0.2) * 0.22 * amp;
            normal = normalize(normal + (viewMatrix * vec4(0.0, 0.0, sw, 0.0)).xyz);
          }`)
        .replace('#include <opaque_fragment>', `
          {
            vec4 sm = seaMap(vWP.xz);
            float d = -sm.x;
            float ph = uTime / WAVE_T + d * 1.15;
            float w = fract(ph);
            float fadeX = (1.0 - smoothstep(40.0, 60.0, abs(vWP.x))) * sm.y;
            float shoal = smoothstep(1.7, 0.2, d) * smoothstep(-0.03, 0.04, d) * fadeX;
            float n1 = vn(vWP.xz * 1.1 + vec2(uTime * 0.12, 0.0));
            float n2 = vn(vWP.xz * 4.5 - vec2(0.0, uTime * 0.3));
            float n3 = vn(vWP.xz * 13.0 + uTime * 0.2);
            float brk = smoothstep(1.0, 0.15, d);
            // 波頭の白い筋（浅いほど太く、ちぎれにくい）
            float crest = smoothstep(0.0, 0.02, w) * (1.0 - smoothstep(0.02, 0.06 + brk * 0.07, w));
            // 平らな浅瀬で波頭がべったり広がらないよう、深さの変化がゆるい所では弱める
            float perUnit = fwidth(ph) / max(length(fwidth(vWP.xz)), 1e-4);
            crest *= smoothstep(0.03, 0.1, perUnit);
            float foam = crest * smoothstep(0.42 - brk * 0.35, 0.8, n1 * 0.65 + n2 * 0.45) * shoal;
            // 砕けたあとの泡のレース
            float lace = smoothstep(0.64, 0.86, n2 * 0.55 + n3 * 0.5) * exp(-w * 3.2) * smoothstep(0.55, 0.0, d) * fadeX;
            // 岸のふちの泡
            float edge = smoothstep(0.07, 0.0, d) * smoothstep(0.35, 0.75, n2 * 0.6 + n3 * 0.4) * fadeX;
            foam = clamp(foam + lace * 0.75 + edge * 0.7, 0.0, 1.0);
            // 波の前面（盛り上がり）を少し濃く
            float face = smoothstep(0.82, 1.0, w) * shoal * 0.18;
            outgoingLight *= 1.0 - face;
            outgoingLight = mix(outgoingLight, vec3(0.9, 0.94, 0.95) * uFoamLight, foam * 0.88);
          }
          #include <opaque_fragment>`);
    };
  }

  addMountains(color) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
    for (let i = 0; i < 7; i++) {
      const s = 200 + i * 40;
      const m = new THREE.Mesh(rockGeometry(400 + i, s, s * 0.55, s * 0.7, 3), mat);
      m.position.set(-900 + i * 300, -20, -1100 - (i % 3) * 200);
      this.scene.add(m);
    }
  }

  // ---------- めくれる石 ----------
  buildRocks() {
    const rt = rockTextures(this.loc === 'sea' ? 2 : 1);
    const mat = new THREE.MeshStandardMaterial({ map: rt.map, normalMap: rt.normalMap, roughnessMap: rt.roughnessMap, roughness: 1 });
    // 裏側は湿って暗い
    const wetMat = new THREE.MeshStandardMaterial({ map: rt.map, normalMap: rt.normalMap, roughness: 0.35, color: '#7a7060' });
    this.rocks = [];
    const r = mulberry32(this.app.state.day * 13 + this.slot * 7 + (this.loc === 'sea' ? 999 : 0));
    let tries = 0;
    while (this.rocks.length < 16 && tries++ < 600) {
      const x = (r() - 0.5) * 30;
      const z = -6 + r() * 15;
      const y = this.height(x, z);
      if (y < -0.55 || y > 0.9) continue;
      if (this.rocks.some((o) => Math.hypot(o.x - x, o.z - z) < 3.2)) continue;
      if (this.trapSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 2.5)) continue;
      const s = 0.9 + r() * 0.8;
      const geo = rockGeometry(1000 + this.rocks.length * 7 + Math.floor(r() * 99), s, s * 0.55, s * (0.7 + r() * 0.4), 3);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y - s * 0.12, z);
      m.rotation.y = r() * 6;
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
      // 石の下のくぼみ（湿った跡）
      const mark = new THREE.Mesh(new THREE.CircleGeometry(s * 0.9, 20), new THREE.MeshStandardMaterial({ color: '#3a3428', roughness: 0.3, transparent: true, opacity: 0.0, depthWrite: false }));
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(x, y + 0.03, z);
      this.scene.add(mark);
      this.rocks.push({ mesh: m, x, z, y, s, flipped: false, mark, wetMat });
    }
    // ホバー表示
    this.hover = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 40), new THREE.MeshBasicMaterial({ color: '#fff4c0', transparent: true, opacity: 0.7, depthWrite: false }));
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.visible = false;
    this.scene.add(this.hover);
  }

  // ---------- カゴ罠 ----------
  buildTraps() {
    const state = this.app.state;
    this.trapObjs = [];
    const markerMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false });
    this.trapSpots.forEach((sp, i) => {
      const y = this.height(sp.x, sp.z);
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 36), markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(sp.x, 0.04, sp.z);
      this.scene.add(marker);
      // 目印の竹ざおと赤い布（カゴを仕掛けられる場所）
      const flag = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 8), new THREE.MeshStandardMaterial({ color: '#b8a060', roughness: 0.6 }));
      pole.position.y = 1.1 + Math.min(0, y) * 0.5;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.32), new THREE.MeshStandardMaterial({ color: '#d03a28', roughness: 0.8, side: THREE.DoubleSide }));
      cloth.position.set(0.3, pole.position.y + 0.85, 0);
      pole.castShadow = cloth.castShadow = true;
      flag.add(pole, cloth);
      flag.position.set(sp.x + 1.1, 0, sp.z - 0.2);
      this.scene.add(flag);
      const trap = state.traps.find((t) => t.loc === this.loc && t.spot === i);
      const o = { spot: i, x: sp.x, z: sp.z, bedY: y, marker, trap, group: null, cloth: flag.children[1] };
      if (trap) this.makeTrapObject(o);
      this.trapObjs.push(o);
    });
  }

  makeTrapObject(o) {
    const g = new THREE.Group();
    const net = netTexture();
    const cageMat = new THREE.MeshStandardMaterial({ color: '#2a4a6a', alphaMap: net, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
    net.repeat.set(4, 2);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.9, 20, 1, true), cageMat);
    cage.position.y = 0.45;
    const ringMat = new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.5, metalness: 0.6 });
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.03, 6, 24), ringMat); r1.rotation.x = Math.PI / 2; r1.position.y = 0.9;
    const r2 = r1.clone(); r2.position.y = 0;
    const lid = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), cageMat); lid.rotation.x = -Math.PI / 2; lid.position.y = 0.9;
    const cageG = new THREE.Group();
    cageG.add(cage, r1, r2, lid);
    cageG.position.y = o.bedY;
    cageG.traverse((m) => { m.castShadow = true; });
    g.add(cageG);
    // ブイとロープ
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#ff6a20', roughness: 0.35, clearcoat: 0.8 }));
    buoy.scale.y = 0.8;
    buoy.castShadow = true;
    g.add(buoy);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 5), new THREE.MeshStandardMaterial({ color: '#d8c8a0', roughness: 1 }));
    g.add(rope);
    g.position.set(o.x, 0, o.z);
    this.scene.add(g);
    o.group = g; o.cage = cageG; o.buoy = buoy; o.rope = rope;
    o.marker.visible = false;
  }

  // ---------- 夜 ----------
  buildNight() {
    const spot = new THREE.SpotLight('#fff2d8', 300, 60, 0.32, 0.5, 1.6);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    this.scene.add(spot, spot.target);
    this.flash = spot;
    this.flashTarget = new THREE.Vector3(0, 0, 2);
    // ホタル
    const n = 60;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.fireflies = new THREE.Points(g, new THREE.PointsMaterial({ color: '#d8ff80', size: 0.25, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.fireflyData = Array.from({ length: n }, () => ({ x: (Math.random() - 0.5) * 50, z: (Math.random() - 0.5) * 30, y: 1 + Math.random() * 3, ph: Math.random() * 10 }));
    if (this.loc === 'river') this.scene.add(this.fireflies);
  }

  enter() {
    this.updateHud();
    setActions([
      { label: '🏠 帰る', onclick: () => this.leave() },
      { label: '❔ あそびかた', onclick: () => this.help() },
    ]);
    bigText(this.loc === 'river' ? '川' : '海', { ms: 1200, cls: 'small' });
    if (!this.app.state.fieldTipSeen) {
      this.app.state.fieldTipSeen = true;
      this.app.save();
      setTimeout(() => this.help(true), 900);
    } else setTimeout(() => toast('石をめくって手づかみ。赤い旗の輪にはカゴ罠を仕掛けられる', 3500), 900);
    // 罠の状態
    const ready = this.trapObjs.filter((o) => o.trap && Save.timeIndex(this.app.state) > o.trap.placedT);
    if (ready.length) setTimeout(() => toast('仕掛けたカゴを引き上げてみよう！（ブイをタップ）', 3500), 4600);
  }

  help(first = false) {
    modal((b) => {
      b.appendChild(el('div', { class: 'help', html: `
        <p><b>カニのとり方は2つ。どちらも最初から使えます。</b><br>
        ・<b>手づかみ</b>（石をめくる）…小〜中くらいのカニ。${this.loc === 'sea' ? 'イソガニ・ヒライソガニ・ショウジンガニなど' : 'サワガニ・アカテガニ・ベンケイガニなど'}<br>
        ・<b>カゴ罠</b>（赤い旗の白い輪）…石の下ではめったに見つからない大物が入りやすい。${this.loc === 'sea' ? 'ガザミ・タイワンガザミ・イシガニなど' : 'モクズガニ・ノコギリガザミなど'}</p>
        <p><b>手づかみ</b>：石をタップするとひっくり返せます。カニがいたら、<b>逃げている間</b>にタップしてつかまえよう。<br>
        ハサミを振り上げて<b>威嚇しているとき</b>に手を出すと、はさまれて逃げられやすい！</p>
        <p><b>カゴ罠</b>：赤い旗の白い輪をタップしてエサを入れたカゴを沈めます。時間をおいてから（帰ったりひと休みしたあと）ブイをタップして引き上げよう。夜をまたぐと大物が入りやすい。</p>
        <p>石めくりは1回の外出で${FLIPS}回まで。帰ると時間が進みます。</p>
        <p>夜は懐中電灯で照らしながら探そう。夜にしか出てこないカニもいる。</p>` }));
    }, { title: first ? (this.loc === 'sea' ? '海でカニをとろう' : '川でカニをとろう') : 'あそびかた' });
  }

  updateHud() {
    const s = this.app.state;
    setHud(`<div class="date">${this.loc === 'river' ? '🏞 川' : '🌊 海'}　${Save.dateLabel(s)} ${SLOTS[s.slot]}</div>
      <div class="sub">石めくり あと <b>${this.flips}</b> 回 ・ 水槽 ${s.crabs.length}/${s.capacity} ・ カゴ ${s.trapCount - s.traps.length}/${s.trapCount}</div>`);
  }

  leave() {
    if (this.busy) return;
    Save.advanceTime(this.app.state, 1);
    this.app.save();
    this.app.goto('tank');
  }

  // ---------- 入力 ----------
  pick(ndc) {
    const v = new THREE.Vector3();
    const toScreen = (x, y, z) => { v.set(x, y, z).project(this.camera); return Math.hypot((v.x - ndc.x) * innerWidth / 2, (v.y - ndc.y) * innerHeight / 2); };
    // カニ
    if (this.crab && this.crab.state !== 'gone' && this.crab.state !== 'caught') {
      const p = this.crab.model.root.position;
      const rad = Math.max(55, this.screenRadius(p, this.crab.model.scale * 1.8 * 1.4));
      if (toScreen(p.x, p.y + 0.2, p.z) < rad) return { type: 'crab' };
    }
    // 罠
    for (const o of this.trapObjs) {
      if (toScreen(o.x, 0.2, o.z) < 50) return { type: 'trap', o };
    }
    // 石
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.rocks.filter((r) => !r.flipped).map((r) => r.mesh), false);
    if (hits.length) return { type: 'rock', rock: this.rocks.find((r) => r.mesh === hits[0].object) };
    return null;
  }

  screenRadius(p, worldR) {
    const a = p.clone().project(this.camera);
    const b = p.clone().add(new THREE.Vector3(worldR, 0, 0)).project(this.camera);
    return Math.hypot((a.x - b.x) * innerWidth / 2, (a.y - b.y) * innerHeight / 2);
  }

  onPointerMove(ndc) {
    this.lastNdc = ndc;
    if (this.busy) { this.hover.visible = false; return; }
    const h = this.pick(ndc);
    document.body.style.cursor = h ? 'pointer' : '';
    if (h && h.type === 'rock') {
      this.hover.visible = true;
      this.hover.position.set(h.rock.x, h.rock.y + 0.06, h.rock.z);
      this.hover.scale.setScalar(h.rock.s * 1.15);
    } else this.hover.visible = false;
  }

  onClick(ndc) {
    this.lastNdc = ndc;
    const h = this.pick(ndc);
    if (!h) return;
    if (h.type === 'crab') return this.grab();
    if (this.busy || (this.crab && this.crab.state !== 'gone')) return;
    if (h.type === 'rock') this.flipRock(h.rock);
    if (h.type === 'trap') this.trapAction(h.o);
  }

  // ---------- 石めくり ----------
  flipRock(rock) {
    if (this.flips <= 0) { toast('もう暗くなってきた。今日は帰ろう'); return; }
    this.flips--;
    this.updateHud();
    this.busy = true;
    this.hover.visible = false;
    Audio.sfx('rock');
    // カメラから遠ざかる方向へ転がす
    const dir = new THREE.Vector3(rock.x - this.camera.position.x, 0, rock.z - this.camera.position.z).normalize();
    const axis = new THREE.Vector3(dir.z, 0, -dir.x);
    const q0 = rock.mesh.quaternion.clone();
    const p0 = rock.mesh.position.clone();
    rock.flipped = true;
    rock.anim = { t: 0, dur: 0.7, axis, q0, p0, dir };
    rock.mark.material.opacity = 0;
    rock.mark.material = rock.mark.material.clone();
    setTimeout(() => this.reveal(rock), 750);
  }

  reveal(rock) {
    this.busy = false;
    rock.mark.material.opacity = 0.55;
    const s = this.app.state;
    const tbl = SPAWN[this.loc].hand;
    const baseP = [0.55, 0.45, 0.6, 0.7][this.slot];
    const r = Math.random;
    if (r() > baseP) {
      const msgs = ['何もいない……', 'ヨコエビがぴょんと跳ねた', '小さな巻き貝がくっついていた', 'からっぽだ', 'ムカデみたいな虫がにょろっと逃げた…'];
      toast(msgs[Math.floor(r() * msgs.length)]);
      Audio.sfx('escape');
      this.splash(rock.x, rock.y, rock.z, 6, '#8a7a60');
      return;
    }
    const pick = pickWeighted(tbl, r, (x) => x.w * x.t[this.slot]);
    // ごくまれに「ヌシ」（大型と互角に戦える、石の下の主）
    const nushi = r() < (this.night ? 0.016 : 0.01);
    const crab = makeCrab(pick.id, Math.floor(r() * 1e9), { day: s.day, nushi });
    const model = new CrabModel(crab);
    model.root.scale.setScalar(1.8); // 見やすさのため少し大きく
    model.root.position.set(rock.x, rock.y, rock.z);
    model.root.rotation.y = Math.atan2(this.camera.position.x - rock.x, this.camera.position.z - rock.z);
    this.scene.add(model.root);
    this.crab = { crab, model, state: 'threat', t: 0.5 + crab.stats.temper * 0.08 + r() * 0.4, dir: null, speed: 0, tries: 0 };
    model.raiseT = 1; model.openT = 0.9;
    Audio.sfx('clack');
    if (crab.nushi) {
      this.crab.t += 0.8;
      Audio.sfx('taiko');
      this.shake = 0.3;
      bigText('ヌシだ！！', { ms: 1600, cls: 'gold' });
      toast(`黒光りする${SPECIES[crab.species].name}…… この石の主だ！`, 2600);
    } else toast(`${SPECIES[crab.species].name}だ！`, 1500);
  }

  grab() {
    const c = this.crab;
    if (!c || c.state === 'gone' || c.state === 'caught' || c.state === 'lift') return;
    const st = c.crab.stats;
    c.tries++;
    if (c.state === 'threat') {
      const pinch = Math.min(0.9, 0.3 + st.temper * 0.05 + (st.power - 5) * 0.03);
      if (Math.random() < pinch) {
        Audio.sfx('pinch');
        c.model.snap();
        this.redFlash();
        bigText('イテッ！', { ms: 900, cls: 'red small' });
        toast('ハサミを振り上げているときは危ない！', 2000);
        this.startFlee(c, 1.4);
        return;
      }
    } else {
      const ok = 0.95 - st.agility * 0.035 - c.tries * 0.04;
      if (Math.random() > ok) {
        Audio.sfx('escape');
        toast('スルッ！　すり抜けた！', 1200);
        this.startFlee(c, 1.25);
        return;
      }
    }
    // 捕獲
    c.state = 'lift';
    c.t = 0;
    c.from = c.model.root.position.clone();
    Audio.sfx('splash');
  }

  startFlee(c, mul = 1) {
    c.state = 'flee';
    c.t = 0.7 + Math.random() * 0.8;
    const st = c.crab.stats;
    c.speed = (1.1 + st.agility * 0.22) * mul * (c.crab.nushi ? 1.12 : 1);
    // 水の方向（低い方）へ逃げやすい
    let best = null, bestY = 99;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = c.model.root.position;
      const y = this.height(p.x + Math.cos(a) * 3, p.z + Math.sin(a) * 3) + Math.random() * 0.8;
      // カメラ方向へは逃げにくい
      const towardCam = Math.sin(a) > 0.6 ? 0.6 : 0;
      if (y + towardCam < bestY) { bestY = y + towardCam; best = a; }
    }
    c.dir = new THREE.Vector2(Math.cos(best), Math.sin(best));
    c.model.raiseT = 0.15; c.model.openT = 0.2;
  }

  updateCrab(dt) {
    const c = this.crab;
    if (!c) return;
    const m = c.model;
    const p = m.root.position;
    if (c.state === 'threat') {
      c.t -= dt;
      m.walk = 0; m.raiseT = 1; m.openT = 0.85 + Math.sin(this.time * 12) * 0.1;
      if (c.t <= 0) this.startFlee(c);
    } else if (c.state === 'flee') {
      c.t -= dt;
      p.x += c.dir.x * c.speed * dt;
      p.z += c.dir.y * c.speed * dt;
      // 横歩き：x 軸を進行方向に
      const yaw = Math.atan2(-c.dir.y, c.dir.x);
      const dy = ((yaw - m.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      m.root.rotation.y += Math.max(-dt * 8, Math.min(dt * 8, dy));
      m.walk = 1;
      m.legSpeed = 1.5;
      p.y = Math.max(this.height(p.x, p.z), this.height(p.x, p.z));
      const y = this.height(p.x, p.z);
      if (y < -0.75 || Math.hypot(p.x, p.z - 2) > 18) {
        c.state = 'gone';
        c.t = 1;
        Audio.sfx('splash');
        this.splash(p.x, Math.max(y, 0), p.z, 14, '#d8eef0');
        toast(`${SPECIES[c.crab.species].name}に逃げられた……`, 1800);
        return;
      }
      if (c.t <= 0) {
        if (Math.random() < 0.25 + c.crab.stats.temper * 0.05) {
          c.state = 'threat'; c.t = 0.45 + Math.random() * 0.6;
          m.root.rotation.y = Math.atan2(this.camera.position.x - p.x, this.camera.position.z - p.z);
          Audio.sfx('clack');
        } else this.startFlee(c);
      }
    } else if (c.state === 'gone') {
      c.t -= dt;
      p.y -= dt * 0.8;
      if (c.t <= 0) { m.dispose(); this.crab = null; }
    } else if (c.state === 'lift') {
      c.t += dt / 0.7;
      const k = Math.min(1, c.t);
      const target = this.camera.position.clone().lerp(this.controls.target, 0.75);
      p.lerpVectors(c.from, target, k * k * (3 - 2 * k));
      m.root.rotation.y += dt * 2;
      m.walk = 1.5; m.legSpeed = 2; m.raiseT = 1; m.openT = 1;
      if (c.t >= 1) {
        c.state = 'caught';
        this.busy = true;
        catchFlow(this.app, c.crab, { how: 'hand' }).then(() => {
          this.busy = false;
          m.dispose();
          this.crab = null;
          this.updateHud();
        });
      }
    }
    m.update(dt);
  }

  // ---------- 罠 ----------
  trapAction(o) {
    const s = this.app.state;
    if (!o.trap) {
      if (s.traps.length >= s.trapCount) { toast('カゴが足りない。仕掛けたカゴを回収しよう'); return; }
      modal((b, close) => {
        b.appendChild(el('p', { class: 'help' }, 'カゴに入れるエサを選んでください。時間をおくほどカニが入りやすくなります。'));
        const box = el('div', { class: 'bait' });
        for (const [id, bt] of Object.entries(BAITS)) {
          box.appendChild(el('button', { class: 'btn', onclick: () => { close(); this.placeTrap(o, id); } }, el('div', {}, bt.name), el('small', {}, bt.desc)));
        }
        b.appendChild(box);
      }, { title: 'カゴ罠を仕掛ける' });
      return;
    }
    const T = Save.timeIndex(s);
    if (T <= o.trap.placedT) {
      toast('まだ仕掛けたばかり。帰るか、ひと休みしてから見に来よう', 2600);
      return;
    }
    this.haulTrap(o);
  }

  placeTrap(o, bait) {
    const s = this.app.state;
    o.trap = { loc: this.loc, spot: o.spot, bait, placedT: Save.timeIndex(s) };
    s.traps.push(o.trap);
    this.app.save();
    this.makeTrapObject(o);
    o.cage.position.y = 1.5;
    o.sinking = 1;
    Audio.sfx('splash');
    this.splash(o.x, 0, o.z, 16, '#e0f0f0');
    toast(`${BAITS[bait].name}を入れたカゴを沈めた`);
    this.updateHud();
  }

  haulTrap(o) {
    const s = this.app.state;
    const T = Save.timeIndex(s);
    const elapsed = Math.min(4, T - o.trap.placedT);
    const bait = BAITS[o.trap.bait];
    const tbl = SPAWN[this.loc].trap;
    // 経過した時間帯の倍率を平均
    const slots = [];
    for (let t = o.trap.placedT + 1; t <= T && slots.length < 4; t++) slots.push(t % 4);
    const crabs = [];
    for (let i = 0; i < elapsed; i++) {
      if (Math.random() < 0.5 * bait.rate) {
        const pick = pickWeighted(tbl, Math.random, (x) => x.w * (x.big ? bait.bigMul : 1) * slots.reduce((a, sl) => a + x.t[sl], 0) / slots.length);
        crabs.push(makeCrab(pick.id, Math.floor(Math.random() * 1e9), { day: s.day, big: o.trap.bait === 'surume' }));
      }
    }
    if (crabs.length > 2) crabs.length = 2 + (Math.random() < 0.3 ? 1 : 0);
    s.traps.splice(s.traps.indexOf(o.trap), 1);
    o.trap = null;
    this.app.save();
    this.busy = true;
    Audio.sfx('splash');
    this.splash(o.x, 0, o.z, 20, '#e0f0f0');
    // 中身のカニをカゴに入れて引き上げる
    const models = crabs.map((c, i) => {
      const m = new CrabModel(c);
      m.root.scale.setScalar(Math.min(1, 0.7 / m.scale));
      m.root.position.set((i - (crabs.length - 1) / 2) * 0.5, 0.05, 0);
      m.raiseT = 1;
      o.cage.add(m.root);
      return m;
    });
    o.hauling = { t: 0, models };
    setTimeout(async () => {
      if (!crabs.length) {
        toast('からっぽだった……。時間を長くおくと入りやすいぞ', 2600);
      }
      for (const c of crabs) {
        await catchFlow(this.app, c, { how: 'trap' });
      }
      for (const m of models) m.dispose();
      this.scene.remove(o.group);
      o.group = null;
      o.marker.visible = true;
      o.hauling = null;
      this.busy = false;
      this.updateHud();
    }, 1500);
  }

  // ---------- 演出 ----------
  splash(x, y, z, n, color) {
    const geo = new THREE.SphereGeometry(0.05, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y + 0.1, z);
      this.scene.add(m);
      this.particles.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3), life: 0.8 });
    }
  }

  redFlash() {
    const f = document.createElement('div');
    f.className = 'flash';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 600);
    this.shake = 0.4;
  }

  update(dt) {
    this.time += dt;
    this.controls.update();
    if (this.shake > 0) {
      this.shake -= dt;
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.6;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.6;
    }
    if (this.wn) {
      if (this.loc === 'river') {
        this.wn.offset.set(this.time * 0.06, this.time * 0.004);
        this.wn2.offset.set(this.time * 0.042, -this.time * 0.006);
      } else {
        // うねりは2方向へゆっくり（水面の高さは動かさない）
        this.wn.offset.set(this.time * 0.006, this.time * 0.009);
        this.wn2.offset.set(-this.time * 0.008, this.time * 0.005);
      }
    }
    if (this.loc === 'sea') {
      // 波：沖の波（水面）と波打ち際（地面）を同じ時刻で動かす
      this.groundMat.userData.uniforms.uTime.value = this.time;
      if (this.surfU) this.surfU.uTime.value = this.time;
      const cyc = Math.floor(this.time / WAVE_T);
      if (cyc !== this.waveCycle) { if (this.waveCycle !== undefined) Audio.sfx('wave'); this.waveCycle = cyc; }
    }
    if (this.grass?.userData.uniforms) this.grass.userData.uniforms.uTime.value = this.time;
    // 石アニメ
    for (const r of this.rocks) {
      if (!r.anim) continue;
      const a = r.anim;
      a.t += dt / a.dur;
      const k = Math.min(1, a.t);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const q = new THREE.Quaternion().setFromAxisAngle(a.axis, Math.PI * 0.92 * e);
      r.mesh.quaternion.copy(q).multiply(a.q0);
      r.mesh.position.copy(a.p0).addScaledVector(a.dir, r.s * 1.7 * e);
      r.mesh.position.y = a.p0.y + Math.sin(Math.PI * e) * r.s * 0.9 + e * r.s * 0.1;
      if (k >= 1) { r.anim = null; r.mesh.material = r.wetMat; }
    }
    // 罠のアニメ
    for (const o of this.trapObjs) {
      if (o.cloth) { o.cloth.rotation.y = Math.sin(this.time * 2.3 + o.x) * 0.35; o.marker.material.opacity = 0.35 + Math.sin(this.time * 2.5) * 0.15; }
      if (!o.group) continue;
      o.buoy.position.y = (this.water ? this.water.position.y : 0) + 0.12 + Math.sin(this.time * 1.8 + o.x) * 0.05;
      if (o.sinking) {
        o.sinking = Math.max(0, o.sinking - dt * 0.8);
        o.cage.position.y = o.bedY + o.sinking * 1.5;
      }
      if (o.hauling) {
        o.hauling.t = Math.min(1, o.hauling.t + dt * 0.8);
        o.cage.position.y = o.bedY + o.hauling.t * (1.5 - o.bedY);
        for (const m of o.hauling.models) { m.walk = 1; m.update(dt); }
      }
      const top = o.cage.position.y + 0.9;
      const by = o.buoy.position.y;
      o.rope.position.y = (top + by) / 2;
      o.rope.scale.y = Math.max(0.01, by - top);
    }
    // パーティクル
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.v.y -= 9.8 * dt;
      p.m.position.addScaledVector(p.v, dt);
      if (p.life <= 0) { this.scene.remove(p.m); this.particles.splice(i, 1); }
    }
    // 夜：懐中電灯
    if (this.flash) {
      if (this.lastNdc) {
        this.raycaster.setFromCamera(this.lastNdc, this.camera);
        const hit = this.raycaster.intersectObject(this.ground, false)[0];
        if (hit) this.flashTarget.lerp(hit.point, 0.2);
      }
      this.flash.position.copy(this.camera.position).add(new THREE.Vector3(1.5, -1, 0));
      this.flash.target.position.copy(this.flashTarget);
      const pos = this.fireflies.geometry.attributes.position;
      this.fireflyData.forEach((f, i) => {
        pos.setXYZ(i, f.x + Math.sin(this.time * 0.5 + f.ph) * 1.5, f.y + Math.sin(this.time * 0.8 + f.ph * 2) * 0.5, f.z + Math.cos(this.time * 0.4 + f.ph) * 1.5);
      });
      pos.needsUpdate = true;
      this.fireflies.material.opacity = 0.5 + Math.sin(this.time * 3) * 0.4;
    }
    this.updateCrab(dt);
  }

  dispose() {
    this.controls.dispose();
    this.outdoor.dispose();
    if (this.crab) this.crab.model.dispose();
    document.body.style.cursor = '';
  }

  resize(w, h) {
    const dm = Math.max(1, 1.3 / (w / h));
    if (dm !== this.distMul) {
      this.distMul = dm;
      this.controls.maxDistance = 30 * dm;
      this.camera.position.set(0, 11 * dm, 14.5 * dm);
      this.controls.update();
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
