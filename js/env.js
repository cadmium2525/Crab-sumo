// レンダラーと空・光の共通処理
import * as THREE from 'three';
import { Sky } from 'three/addons/Sky.js';

export function createRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.setSize(window.innerWidth, window.innerHeight);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

// 時間帯の設定 0:朝 1:昼 2:夕方 3:夜
export const TIME_PRESETS = [
  { elev: 14, azim: 105, turb: 6, ray: 2.2, sun: '#ffd6a8', sunI: 2.6, hemiSky: '#bcd6f0', hemiGround: '#6a5a40', hemiI: 0.7, exposure: 0.62, fog: '#c8d6e0', env: 0.8 },
  { elev: 62, azim: 170, turb: 4, ray: 1.4, sun: '#fff6e8', sunI: 3.4, hemiSky: '#cfe4ff', hemiGround: '#6a5a40', hemiI: 0.8, exposure: 0.5, fog: '#cfe0ee', env: 0.6 },
  { elev: 5, azim: 255, turb: 9, ray: 3.2, sun: '#ffa060', sunI: 2.4, hemiSky: '#f0b890', hemiGround: '#4a3a30', hemiI: 0.55, exposure: 0.6, fog: '#e8b898', env: 0.7 },
  { elev: -6, azim: 200, turb: 2, ray: 0.6, sun: '#9fb8ff', sunI: 0.35, hemiSky: '#2a3c60', hemiGround: '#141a20', hemiI: 0.55, exposure: 0.95, fog: '#0c1420', env: 0.25, night: true },
];

export class Outdoor {
  constructor(renderer, scene, slot = 1, opts = {}) {
    this.renderer = renderer;
    this.scene = scene;
    const p = TIME_PRESETS[slot];
    this.preset = p;
    const sky = new Sky();
    sky.scale.setScalar(4500);
    const u = sky.material.uniforms;
    u.turbidity.value = p.turb;
    u.rayleigh.value = p.ray;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;
    const sun = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(90 - p.elev);
    const theta = THREE.MathUtils.degToRad(p.azim);
    sun.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(sun);
    this.sunDir = sun.clone();
    this.sky = sky;
    scene.add(sky);

    // 空から環境マップ
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const sky2 = new Sky();
    sky2.scale.setScalar(4500);
    sky2.material.uniforms.turbidity.value = p.turb;
    sky2.material.uniforms.rayleigh.value = p.ray;
    sky2.material.uniforms.mieCoefficient.value = 0.005;
    sky2.material.uniforms.mieDirectionalG.value = 0.8;
    sky2.material.uniforms.sunPosition.value.copy(sun);
    envScene.add(sky2);
    if (p.night) {
      // 夜は少し明るめの環境光を足す
      const m = new THREE.Mesh(new THREE.SphereGeometry(100, 16, 8), new THREE.MeshBasicMaterial({ color: '#1a2640', side: THREE.BackSide }));
      envScene.add(m);
      envScene.remove(sky2);
    }
    const rt = pm.fromScene(envScene, 0.02);
    this.envRT = rt;
    scene.environment = rt.texture;
    scene.environmentIntensity = p.env;
    pm.dispose();
    sky2.material.dispose();

    // 太陽光
    const sunLight = new THREE.DirectionalLight(p.sun, p.sunI);
    const sd = opts.shadowSize || 14;
    const lp = sun.clone();
    if (p.night) lp.set(0.4, 0.8, 0.3).normalize();
    sunLight.position.copy(lp.multiplyScalar(60));
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -sd; sunLight.shadow.camera.right = sd;
    sunLight.shadow.camera.top = sd; sunLight.shadow.camera.bottom = -sd;
    sunLight.shadow.camera.near = 1; sunLight.shadow.camera.far = 160;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    sunLight.shadow.radius = 3;
    scene.add(sunLight);
    scene.add(sunLight.target);
    this.sunLight = sunLight;

    const hemi = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiI);
    scene.add(hemi);
    this.hemi = hemi;

    scene.fog = new THREE.Fog(p.fog, opts.fogNear || 60, opts.fogFar || 600);
    renderer.toneMappingExposure = p.exposure;

    if (p.night) {
      // 星
      const n = 1500;
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection();
        v.y = Math.abs(v.y) * 0.9 + 0.05;
        v.normalize().multiplyScalar(2000);
        pos.set([v.x, v.y, v.z], i * 3);
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
      scene.add(stars);
      this.stars = stars;
      // 月
      const moon = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), new THREE.MeshBasicMaterial({ color: '#f4f0dc', fog: false }));
      moon.position.set(-600, 900, -1500);
      scene.add(moon);
    }
  }
  dispose() {
    this.envRT.dispose();
    this.sky.material.dispose();
  }
}

// 室内用：RoomEnvironment
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
export function roomEnv(renderer, scene, intensity = 0.6) {
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = rt.texture;
  scene.environmentIntensity = intensity;
  pm.dispose();
  return rt;
}

// ---- 汎用ジオメトリ ----
import { getNoise, mulberry32 } from './textures.js';

// ゴツゴツした岩
export function rockGeometry(seed, sx = 1, sy = 0.6, sz = 1, detail = 4) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const n = getNoise(900 + (seed % 40));
  const r = mulberry32(seed);
  const ox = r() * 10, oz = r() * 10;
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const u1 = (Math.atan2(v.z, v.x) / (Math.PI * 2) + 0.5);
    const v1 = (v.y * 0.5 + 0.5);
    let d = 1 + (n.fbm(u1 + ox, v1 + oz, 3, 5) - 0.5) * 0.7;
    // 平たい面（割れ面）
    if (v.y < -0.3) d *= 0.85;
    v.multiplyScalar(d);
    v.set(v.x * sx, v.y * sy, v.z * sz);
    if (v.y < 0) v.y *= 0.5;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // 三平面投影っぽいUV
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.x + v.y * 0.5) * 0.35, (v.z + v.y * 0.5) * 0.35);
  }
  return g;
}

// 地形
export function terrain(w, d, segW, segD, heightFn) {
  const g = new THREE.PlaneGeometry(w, d, segW, segD);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightFn(x, z));
  }
  g.computeVertexNormals();
  return g;
}

// 揺れる草（インスタンス）
import { grassBladeTexture } from './textures.js';
export function grassField(count, placeFn, opts = {}) {
  const blade = new THREE.PlaneGeometry(0.12, 1, 1, 4);
  blade.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({
    map: grassBladeTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8,
    color: opts.color || '#ffffff',
  });
  const uniforms = { uTime: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      vec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
      float sway = sin(uTime*1.6 + wp.x*0.35 + wp.z*0.2) * 0.12 + sin(uTime*3.1 + wp.x*1.3) * 0.04;
      transformed.x += sway * position.y * position.y;
      transformed.z += sway * 0.5 * position.y * position.y;
    `);
  };
  const mesh = new THREE.InstancedMesh(blade, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const r = mulberry32(opts.seed || 3);
  let k = 0;
  for (let i = 0; i < count * 4 && k < count; i++) {
    const res = placeFn(r);
    if (!res) continue;
    p.set(res.x, res.y, res.z);
    e.set((r() - 0.5) * 0.4, r() * Math.PI * 2, (r() - 0.5) * 0.4);
    q.setFromEuler(e);
    const h = res.h || (0.6 + r() * 0.9);
    s.set(1 + r(), h, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(k++, m);
  }
  mesh.count = k;
  mesh.receiveShadow = true;
  mesh.userData.uniforms = uniforms;
  return mesh;
}

// 遠景の木
export function treeCluster(count, placeFn, seed = 9) {
  const group = new THREE.Group();
  const r = mulberry32(seed);
  const leafGeo = new THREE.IcosahedronGeometry(1, 2);
  const lp = leafGeo.attributes.position;
  const n = getNoise(77);
  const v = new THREE.Vector3();
  for (let i = 0; i < lp.count; i++) {
    v.fromBufferAttribute(lp, i);
    const d = 1 + (n.fbm(v.x * 0.5 + 0.5, v.z * 0.5 + 0.5 + v.y * 0.3, 2, 3) - 0.5) * 0.6;
    v.multiplyScalar(d);
    lp.setXYZ(i, v.x, v.y, v.z);
  }
  leafGeo.computeVertexNormals();
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f5a26', roughness: 0.9, flatShading: true });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: '#2f4a1e', roughness: 0.9, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3a2a', roughness: 1 });
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 1, 6);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count * 4);
  const leaves2 = new THREE.InstancedMesh(leafGeo, leafMat2, count * 4);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let li = 0, li2 = 0, ti = 0;
  for (let i = 0; i < count; i++) {
    const pos = placeFn(r);
    if (!pos) continue;
    const h = pos.h || (20 + r() * 25);
    p.set(pos.x, pos.y + h * 0.3, pos.z); s.set(h * 0.06, h * 0.6, h * 0.06); q.identity();
    m.compose(p, q, s); trunks.setMatrixAt(ti++, m);
    for (let k = 0; k < 4; k++) {
      p.set(pos.x + (r() - 0.5) * h * 0.3, pos.y + h * (0.55 + r() * 0.35), pos.z + (r() - 0.5) * h * 0.3);
      const sc = h * (0.22 + r() * 0.14);
      s.set(sc * (1 + r() * 0.3), sc * 0.8, sc * (1 + r() * 0.3));
      q.setFromEuler(new THREE.Euler(0, r() * 6, 0));
      m.compose(p, q, s);
      if (r() < 0.5) leaves.setMatrixAt(li++, m); else leaves2.setMatrixAt(li2++, m);
    }
  }
  leaves.count = li; leaves2.count = li2; trunks.count = ti;
  group.add(leaves, leaves2, trunks);
  return group;
}
