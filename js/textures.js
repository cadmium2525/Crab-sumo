// 手続き的テクスチャ生成（外部画像なし・0円）
import * as THREE from 'three';

// ---- 疑似乱数 ----
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- タイル可能なバリューノイズ ----
class TileNoise {
  constructor(seed = 1, size = 256) {
    const r = mulberry32(seed);
    this.size = size;
    this.v = new Float32Array(size * size);
    for (let i = 0; i < this.v.length; i++) this.v[i] = r();
  }
  // x,y は [0, period) の格子座標
  sample(x, y, period) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const p = period;
    const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p;
    const x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const s = this.size;
    const v00 = this.v[(y0 % s) * s + (x0 % s)];
    const v10 = this.v[(y0 % s) * s + (x1 % s)];
    const v01 = this.v[(y1 % s) * s + (x0 % s)];
    const v11 = this.v[(y1 % s) * s + (x1 % s)];
    const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
    return (v00 * (1 - u) + v10 * u) * (1 - w) + (v01 * (1 - u) + v11 * u) * w;
  }
  // u,v: 0..1, base: 基本周期
  fbm(u, v, base = 4, oct = 5, gain = 0.5) {
    let amp = 1, sum = 0, norm = 0, f = base;
    for (let o = 0; o < oct; o++) {
      sum += this.sample(u * f, v * f, f) * amp;
      norm += amp; amp *= gain; f *= 2;
    }
    return sum / norm;
  }
}

const noiseCache = new Map();
export function getNoise(seed) {
  if (!noiseCache.has(seed)) noiseCache.set(seed, new TileNoise(seed));
  return noiseCache.get(seed);
}

// ---- セル（ボロノイ）ノイズ（タイル可能） ----
export function cellNoise(u, v, n, seed) {
  // 最近点距離 F1, F2
  const r = mulberry32(seed);
  // 事前計算をキャッシュ
  const key = n + ':' + seed;
  let pts = cellCache.get(key);
  if (!pts) {
    pts = new Float32Array(n * n * 2);
    for (let i = 0; i < n * n; i++) { pts[i * 2] = r(); pts[i * 2 + 1] = r(); }
    cellCache.set(key, pts);
  }
  const x = u * n, y = v * n;
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    const wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
    const k = wy * n + wx;
    const px = cx + pts[k * 2], py = cy + pts[k * 2 + 1];
    const d = Math.hypot(px - x, py - y);
    if (d < f1) { f2 = f1; f1 = d; id = k; } else if (d < f2) f2 = d;
  }
  return { f1, f2, id };
}
const cellCache = new Map();

// ---- キャンバス→テクスチャ ----
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTex(canvas, { srgb = true, repeat = 1, wrap = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

// 高さ配列 → ノーマルマップ
function heightToNormal(h, w, hh, strength = 2, wrap = true) {
  const c = makeCanvas(w, hh);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, hh);
  const at = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + hh) % hh; }
    else { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(hh - 1, y)); }
    return h[y * w + x];
  };
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255;
    img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(h, w, hh, fn = (v) => v) {
  const c = makeCanvas(w, hh);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, hh);
  for (let i = 0; i < w * hh; i++) {
    const v = Math.max(0, Math.min(255, fn(h[i]) * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function mixRGB(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
export function hexToRGB(hex) {
  const c = parseInt(hex.replace('#', ''), 16);
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

const texCache = new Map();
function cached(key, fn) {
  if (!texCache.has(key)) texCache.set(key, fn());
  return texCache.get(key);
}

// ===== 切り株（土俵） =====
export function stumpTopTextures(size = 1024) {
  return cached('stump' + size, () => {
    const n = getNoise(11), n2 = getNoise(12);
    const col = makeCanvas(size, size);
    const ctx = col.getContext('2d');
    const img = ctx.createImageData(size, size);
    const h = new Float32Array(size * size);
    const rough = new Float32Array(size * size);
    // ひび割れの角度
    const cracks = [];
    const r = mulberry32(7);
    for (let i = 0; i < 9; i++) cracks.push({ a: r() * Math.PI * 2, len: 0.35 + r() * 0.55, w: 0.004 + r() * 0.01 });
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const dx = u - 0.5 + (n.fbm(u, v, 3, 3) - 0.5) * 0.04, dy = v - 0.5 + (n2.fbm(u, v, 3, 3) - 0.5) * 0.04;
      const d = Math.hypot(dx, dy) * 2; // 0..1 at edge
      const ang = Math.atan2(dy, dx);
      // 年輪
      const ringF = d * 38 + n.fbm(u, v, 6, 4) * 2.2;
      const ring = Math.pow(Math.abs(Math.sin(ringF * Math.PI)), 6);
      const late = Math.pow(0.5 + 0.5 * Math.sin(ringF * Math.PI), 2);
      const grain = n2.fbm(u * 1.0, v * 1.0, 64, 3);
      let base = mixRGB([214, 178, 128], [168, 120, 72], late * 0.6 + grain * 0.25);
      base = mixRGB(base, [120, 78, 44], ring * 0.55);
      // 中心の髄
      base = mixRGB(base, [110, 70, 40], clamp01(1 - d * 18) * 0.6);
      // 外周の樹皮側の暗部と風化
      const weather = n.fbm(u, v, 8, 5);
      base = mixRGB(base, [120, 110, 95], clamp01((weather - 0.55) * 2.0) * 0.45);
      base = mixRGB(base, [90, 60, 35], clamp01((d - 0.86) * 8));
      // ひび
      let crack = 0;
      for (const c of cracks) {
        let da = Math.abs(((ang - c.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const wob = (n.sample(d * 9 + c.a * 3, c.a * 5, 64) - 0.5) * 0.05;
        da = Math.abs(da + wob);
        const startD = 1 - c.len;
        if (d > startD && d < 0.99) {
          const wd = c.w * (d - startD) / c.len * 3;
          if (da * d < wd) crack = Math.max(crack, 1 - (da * d) / wd);
        }
      }
      base = mixRGB(base, [40, 25, 15], crack * 0.9);
      const i = y * size + x;
      h[i] = 0.5 - ring * 0.15 + grain * 0.15 - crack * 0.8 + weather * 0.1;
      rough[i] = 0.75 + ring * 0.1 + crack * 0.15 - late * 0.1;
      const k = i * 4;
      img.data[k] = base[0]; img.data[k + 1] = base[1]; img.data[k + 2] = base[2]; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return {
      map: toTex(col, { wrap: false }),
      normalMap: toTex(heightToNormal(h, size, size, 3, false), { srgb: false, wrap: false }),
      roughnessMap: toTex(grayCanvas(rough, size, size), { srgb: false, wrap: false }),
    };
  });
}

export function barkTextures(size = 512) {
  return cached('bark' + size, () => {
    const n = getNoise(21), n2 = getNoise(22);
    const col = makeCanvas(size, size);
    const ctx = col.getContext('2d');
    const img = ctx.createImageData(size, size);
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // 縦方向の割れ目
      const warp = n.fbm(u, v, 4, 3) * 0.3;
      const f = n2.fbm(u * 1 + warp, v * 0.15, 16, 4);
      const ridge = 1 - Math.abs(f - 0.5) * 2;
      const fine = n.fbm(u, v, 64, 3);
      const hv = Math.pow(ridge, 2.5) * 0.8 + fine * 0.2;
      const moss = clamp01((n.fbm(u, v, 3, 4) - 0.55) * 4);
      let c = mixRGB([60, 45, 34], [125, 104, 82], hv);
      c = mixRGB(c, [88, 104, 52], moss * 0.5 * hv);
      const i = y * size + x;
      h[i] = hv;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { map: toTex(col), normalMap: toTex(heightToNormal(h, size, size, 6), { srgb: false }) };
  });
}

// ===== 岩 =====
export function rockTextures(variant = 0, size = 512) {
  return cached('rock' + variant + size, () => {
    const n = getNoise(31 + variant), n2 = getNoise(41 + variant);
    const col = makeCanvas(size, size);
    const ctx = col.getContext('2d');
    const img = ctx.createImageData(size, size);
    const h = new Float32Array(size * size);
    const rough = new Float32Array(size * size);
    const palettes = [
      [[118, 114, 106], [160, 154, 142], [86, 82, 78]],     // 花崗岩っぽい灰
      [[104, 96, 84], [146, 132, 112], [70, 64, 58]],       // 茶系
      [[92, 92, 96], [130, 128, 130], [58, 58, 62]],        // 磯の黒っぽい岩
    ];
    const P = palettes[variant % palettes.length];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const f = n.fbm(u, v, 4, 6);
      const g = n2.fbm(u, v, 32, 3);
      const cell = cellNoise(u, v, 5, 50 + variant);
      const crev = clamp01(1 - (cell.f2 - cell.f1) * 14) * clamp01(n2.fbm(u, v, 3, 2) * 2 - 0.6);
      let c = mixRGB(P[0], P[1], clamp01(f * 1.4 - 0.2));
      c = mixRGB(c, P[2], crev * 0.6);
      // 斑晶
      const speck = n2.sample(u * 256, v * 256, 256);
      if (speck > 0.82) c = mixRGB(c, [220, 216, 205], 0.5);
      else if (speck < 0.12) c = mixRGB(c, [40, 38, 36], 0.5);
      // 地衣類
      const lich = clamp01((n.fbm(u + 0.3, v + 0.7, 6, 4) - 0.62) * 6);
      c = mixRGB(c, variant === 2 ? [150, 140, 120] : [170, 168, 120], lich * 0.35);
      const i = y * size + x;
      h[i] = f * 0.6 + g * 0.3 - crev * 0.4;
      rough[i] = 0.8 + g * 0.15 - crev * 0.1;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return {
      map: toTex(col),
      normalMap: toTex(heightToNormal(h, size, size, 4), { srgb: false }),
      roughnessMap: toTex(grayCanvas(rough, size, size), { srgb: false }),
    };
  });
}

// ===== 地面（砂利・砂・草地）=====
export function groundTextures(kind = 'gravel', size = 512) {
  return cached('ground' + kind + size, () => {
    const n = getNoise(61), n2 = getNoise(62);
    const col = makeCanvas(size, size);
    const ctx = col.getContext('2d');
    const img = ctx.createImageData(size, size);
    const h = new Float32Array(size * size);
    const rough = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const i = y * size + x;
      let c, hv, rv;
      if (kind === 'gravel' || kind === 'tank') {
        const cell = cellNoise(u, v, kind === 'tank' ? 15 : 18, 70);
        const pr = mulberry32(cell.id * 7919 + 13)();
        const pr2 = mulberry32(cell.id * 104729 + 3)();
        const stone = clamp01((cell.f2 - cell.f1) * 6);
        const dome = Math.sqrt(clamp01(1 - cell.f1 * 1.6));
        const pal = kind === 'tank'
          ? [[200, 190, 170], [150, 140, 125], [90, 86, 80], [225, 215, 200]]
          : [[168, 158, 140], [132, 126, 116], [190, 176, 150], [112, 104, 96], [150, 128, 104], [200, 196, 186]];
        c = pal[Math.floor(pr * pal.length)];
        c = mixRGB(c, [255, 255, 255], (pr2 - 0.5) * 0.25);
        const sandMix = 1 - stone;
        c = mixRGB(c, kind === 'tank' ? [170, 160, 140] : [150, 136, 112], sandMix * 0.75);
        const gr = n2.fbm(u, v, 64, 2);
        c = mixRGB(c, [0, 0, 0], (1 - dome) * 0.3 + (gr - 0.5) * 0.15);
        hv = dome * stone * 0.8 + gr * 0.2;
        rv = 0.85 - dome * 0.2;
      } else if (kind === 'sand') {
        const f = n.fbm(u, v, 8, 5);
        const ripple = Math.sin((v * 22 + n.fbm(u, v, 4, 3) * 3) * Math.PI * 2) * 0.5 + 0.5;
        const grain = n2.sample(u * 256, v * 256, 256);
        c = mixRGB([212, 196, 160], [180, 160, 124], f * 0.8 + ripple * 0.15);
        c = mixRGB(c, grain > 0.7 ? [240, 235, 220] : [120, 110, 95], Math.abs(grain - 0.5) * 0.35);
        hv = ripple * 0.35 + grain * 0.15 + f * 0.5;
        rv = 0.92;
      } else if (kind === 'shore') {
        // 磯の岩盤：割れ目と凹凸、フジツボの白い点
        const f = n.fbm(u, v, 4, 6);
        const rd = 1 - Math.abs(n2.fbm(u, v, 6, 5) * 2 - 1);
        const ridge = Math.pow(rd, 3);
        const fine = n2.fbm(u, v, 48, 3);
        c = mixRGB([70, 66, 62], [128, 120, 108], clamp01(f * 1.3 - 0.15));
        c = mixRGB(c, [40, 38, 36], clamp01(ridge * 1.6 - 0.6) * 0.7);
        c = mixRGB(c, [96, 90, 70], clamp01((n.fbm(u + 0.4, v, 3, 4) - 0.55) * 4) * 0.4);
        const bar = n2.sample(u * 220, v * 220, 220);
        const barn = bar > 0.93 && fine > 0.5 ? 1 : 0;
        c = mixRGB(c, [180, 176, 166], barn * 0.5);
        hv = f * 0.5 - ridge * 0.4 + fine * 0.25 + barn * 0.3;
        rv = 0.85;
      } else if (kind === 'mud') {
        const f = n.fbm(u, v, 6, 5);
        c = mixRGB([92, 80, 62], [130, 116, 92], f);
        hv = f; rv = 0.55 + f * 0.3;
      } else { // grass soil
        const f = n.fbm(u, v, 8, 5);
        const g = n2.fbm(u, v, 48, 3);
        c = mixRGB([86, 104, 48], [118, 132, 60], f);
        c = mixRGB(c, [98, 82, 58], clamp01((n.fbm(u + 0.5, v, 4, 4) - 0.55) * 3));
        c = mixRGB(c, [60, 76, 34], g * 0.4);
        hv = f * 0.5 + g * 0.5; rv = 0.95;
      }
      h[i] = hv; rough[i] = rv;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return {
      map: toTex(col),
      normalMap: toTex(heightToNormal(h, size, size, kind === 'sand' ? 2 : 5), { srgb: false }),
      roughnessMap: toTex(grayCanvas(rough, size, size), { srgb: false }),
    };
  });
}

// ===== 水面ノーマル =====
export function waterNormal(size = 512, seed = 81) {
  return cached('water' + size + seed, () => {
    const n = getNoise(seed);
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const cell = cellNoise(u, v, 8, seed);
      h[y * size + x] = n.fbm(u, v, 4, 5) * 0.6 + (cell.f1) * 0.4;
    }
    return toTex(heightToNormal(h, size, size, 6), { srgb: false });
  });
}

// ===== 木の床板 =====
export function plankTextures(size = 1024) {
  return cached('plank' + size, () => {
    const n = getNoise(91), n2 = getNoise(92);
    const col = makeCanvas(size, size);
    const ctx = col.getContext('2d');
    const img = ctx.createImageData(size, size);
    const h = new Float32Array(size * size);
    const boards = 6;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const b = Math.floor(v * boards);
      const bv = v * boards - b;
      const rb = mulberry32(b * 31 + 5);
      const off = rb(), tone = rb();
      const grainCoord = (bv + n.fbm(u + off, v, 3, 3) * 0.6);
      const grain = Math.pow(Math.abs(Math.sin(grainCoord * 40 + n2.fbm(u + off, bv, 8, 3) * 6)), 3);
      let c = mixRGB([150, 102, 62], [110, 70, 40], tone * 0.6);
      c = mixRGB(c, [80, 50, 28], grain * 0.35);
      c = mixRGB(c, [0, 0, 0], n.fbm(u, v, 16, 3) * 0.15);
      const seam = bv < 0.012 || bv > 0.988 ? 1 : 0;
      c = mixRGB(c, [30, 20, 12], seam * 0.85);
      const i = y * size + x;
      h[i] = 0.5 + grain * 0.1 - seam * 0.5;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { map: toTex(col), normalMap: toTex(heightToNormal(h, size, size, 3), { srgb: false }) };
  });
}

// ===== 漆喰壁 =====
export function plasterTexture(size = 512) {
  return cached('plaster', () => {
    const n = getNoise(95);
    const col = makeCanvas(size, size);
    const ctx = col.getContext('2d');
    const img = ctx.createImageData(size, size);
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const f = n.fbm(u, v, 8, 6);
      const c = mixRGB([196, 180, 150], [222, 208, 180], f);
      const i = y * size + x;
      h[i] = f;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { map: toTex(col), normalMap: toTex(heightToNormal(h, size, size, 2), { srgb: false }) };
  });
}

// ===== カニの甲羅模様 =====
// pattern: plain | mottled | spots | marble | hairy | speckle
export function shellTexture(look, seed, size = 256) {
  const n = getNoise(100 + (seed % 50)), n2 = getNoise(200 + (seed % 37));
  const col = makeCanvas(size, size);
  const ctx = col.getContext('2d');
  const img = ctx.createImageData(size, size);
  const h = new Float32Array(size * size);
  const A = hexToRGB(look.color), B = hexToRGB(look.color2 || look.color), S = hexToRGB(look.spot || '#ffffff');
  const ox = (seed % 97) / 97, oy = (seed % 89) / 89;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const f = n.fbm(u + ox, v + oy, 3, 5);
    const g = n2.fbm(u + oy, v + ox, 12, 4);
    let c = mixRGB(A, B, clamp01(f * 1.6 - 0.3));
    let hv = g * 0.4 + f * 0.2;
    const cx = u - 0.5, cy = v - 0.5;
    switch (look.pattern) {
      case 'mottled': {
        const m = clamp01((n2.fbm(u + ox, v, 6, 4) - 0.5) * 5);
        c = mixRGB(c, S, m * 0.75);
        break;
      }
      case 'spots': {
        const cell = cellNoise((u + ox) % 1, v, 9, seed % 1000);
        const sp = clamp01((0.28 - cell.f1) * 9);
        c = mixRGB(c, S, sp * 0.85);
        hv += sp * 0.1;
        break;
      }
      case 'marble': {
        const w = Math.sin((u * 6 + n.fbm(u, v, 3, 5) * 5) * Math.PI);
        c = mixRGB(c, S, clamp01(w * 0.5 + 0.3) * 0.7);
        const lobe = cellNoise(u, v, 5, seed % 333);
        hv += clamp01(lobe.f2 - lobe.f1) * 0.6;
        c = mixRGB(c, [0, 0, 0], clamp01(0.08 - (lobe.f2 - lobe.f1)) * 6 * 0.4);
        break;
      }
      case 'speckle': {
        const sp = n2.sample(u * 128, v * 128, 128);
        if (sp > 0.78) c = mixRGB(c, S, 0.6);
        break;
      }
      default: break;
    }
    // 甲羅中央のH型の溝（心域・胃域の区画）
    const hx = Math.abs(cx), hy = cy;
    const gw = 0.9 + n.fbm(u, v, 8, 2) * 0.4;
    const groove = Math.max(
      clamp01(1 - Math.abs(hx - 0.12 - hy * 0.25) * 22 * gw) * clamp01(1 - Math.abs(hy + 0.01) * 6),
      clamp01(1 - Math.abs(hy + 0.03 - hx * hx * 3) * 26 * gw) * clamp01(1 - hx * 7)
    ) * (look.grooves ?? 0.6);
    c = mixRGB(c, [c[0] * 0.6, c[1] * 0.55, c[2] * 0.55], groove * 0.35);
    hv -= groove * 0.45;
    // 細かいいぼ
    hv += Math.pow(n2.sample(u * 96, v * 96, 96), 4) * 0.25;
    // 縁取り
    const edge = clamp01((Math.hypot(cx, cy) - 0.42) * 10);
    c = mixRGB(c, B, edge * 0.4);
    const i = y * size + x;
    h[i] = hv;
    img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: toTex(col, { wrap: false, aniso: 4 }),
    normalMap: toTex(heightToNormal(h, size, size, 3.5, false), { srgb: false, wrap: false, aniso: 4 }),
  };
}

// 毛（モクズガニのハサミ）
export function furTexture() {
  return cached('fur', () => {
    const size = 256;
    const n = getNoise(301);
    const h = new Float32Array(size * size);
    const col = makeCanvas(size, size);
    const ctx = col.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const s = n.sample(u * 128, v * 128 * 0.4, 128);
      const f = n.fbm(u, v, 8, 3);
      const i = y * size + x;
      h[i] = s;
      const c = mixRGB([40, 30, 20], [96, 74, 48], s * 0.7 + f * 0.3);
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { map: toTex(col, { repeat: 2 }), normalMap: toTex(heightToNormal(h, size, size, 8), { srgb: false, repeat: 2 }) };
  });
}

// 肌（指）
export function skinTexture() {
  return cached('skin', () => {
    const size = 256;
    const n = getNoise(401);
    const h = new Float32Array(size * size);
    const col = makeCanvas(size, size);
    const ctx = col.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const f = n.fbm(u, v, 16, 4);
      const wr = Math.pow(Math.abs(Math.sin((v * 30 + f * 2) * Math.PI)), 12);
      const i = y * size + x;
      h[i] = f * 0.4 - wr * 0.3;
      const c = mixRGB([232, 182, 150], [214, 160, 128], f);
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { map: toTex(col), normalMap: toTex(heightToNormal(h, size, size, 2), { srgb: false }) };
  });
}

// 網（カゴ罠）アルファ
export function netTexture() {
  return cached('net', () => {
    const size = 256;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
    const step = size / 8;
    for (let i = -8; i <= 16; i++) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step + size, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * step, size); ctx.lineTo(i * step + size, 0); ctx.stroke();
    }
    return toTex(c, { srgb: false, repeat: 1 });
  });
}

// 水槽のコースティクス（動的に描くための元データ）
export function causticsTexture() {
  return cached('caustics', () => {
    const size = 512;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const cell = cellNoise(u, v, 7, 501);
      const e = Math.pow(clamp01(1 - (cell.f2 - cell.f1) * 3.2), 2.5);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = e * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return toTex(c, { srgb: false });
  });
}

// 草の葉（アルファ付き）
export function grassBladeTexture() {
  return cached('blade', () => {
    const w = 64, h = 256;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, '#3d4f1c'); g.addColorStop(0.5, '#6f8a2e'); g.addColorStop(1, '#a9b85a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h); ctx.quadraticCurveTo(w * 0.35, h * 0.3, w * 0.5, 0);
    ctx.quadraticCurveTo(w * 0.65, h * 0.3, w * 0.9, h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,220,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w * 0.5, h); ctx.lineTo(w * 0.5, 4); ctx.stroke();
    const t = toTex(c, { wrap: false });
    return t;
  });
}
