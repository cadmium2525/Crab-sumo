// 種・個体・対戦相手のデータ
import { mulberry32 } from './textures.js';

// stats: power(力) guard(踏ん張り) stamina(根性) agility(素早さ) temper(気性) 1〜10
export const SPECIES = {
  sawagani: {
    name: 'サワガニ', sci: 'Geothelphusa dehaani', habitat: 'river', size: [2.0, 3.2], rarity: 1,
    stats: { power: 4, guard: 4.5, stamina: 6, agility: 5, temper: 5 },
    shape: { n: 2.6, lr: 0.82, height: 0.42, trap: 0.05, claw: 1.0, leg: 1.0, eye: 1.0 },
    look: { color: '#b8442a', color2: '#7a2a1a', pattern: 'plain', claw: '#c4502e', tip: '#e8c8a8', leg: '#b04a30', under: '#e6cdb0' },
    morphs: [
      { label: '赤', color: '#b8442a', color2: '#7a2a1a', claw: '#c4502e', leg: '#b04a30', w: 5 },
      { label: '青', color: '#4f6e8c', color2: '#2f4458', claw: '#6a88a8', leg: '#5a7898', w: 2 },
      { label: '白', color: '#d4c8b4', color2: '#a89880', claw: '#e0d4c0', leg: '#ccbca4', w: 1 },
      { label: '茶', color: '#7d5236', color2: '#4e3020', claw: '#a0603a', leg: '#8a5a3a', w: 3 },
    ],
    desc: '一生を淡水で過ごす日本固有のカニ。川の上流、きれいな水の石の下にひそむ。地域によって赤・青・白と体の色が違う。',
  },
  akate: {
    name: 'アカテガニ', sci: 'Chiromantes haematocheir', habitat: 'river', size: [2.6, 3.8], rarity: 1,
    stats: { power: 5, guard: 4.5, stamina: 5, agility: 6, temper: 6 },
    shape: { n: 3.6, lr: 0.86, height: 0.4, trap: 0.08, claw: 1.08, leg: 1.08, eye: 1.0 },
    look: { color: '#5a5238', color2: '#3a3424', pattern: 'mottled', spot: '#8a3a26', claw: '#d63a20', tip: '#f0b090', leg: '#5a4a34', under: '#d8c8a8' },
    desc: '真っ赤なハサミが目印。川辺の土手や林にすみ、夏の大潮の夜に海辺へ集まって子どもを放つ。夕方から夜に活発。',
  },
  benkei: {
    name: 'ベンケイガニ', sci: 'Sesarmops intermedius', habitat: 'river', size: [2.4, 3.4], rarity: 1,
    stats: { power: 5, guard: 5, stamina: 5, agility: 5, temper: 5 },
    shape: { n: 3.8, lr: 0.84, height: 0.42, trap: 0.06, claw: 1.05, leg: 1.0, eye: 1.0 },
    look: { color: '#9a3a28', color2: '#5a221a', pattern: 'mottled', spot: '#6a2a1e', claw: '#b8402a', tip: '#e8c0a0', leg: '#7a3426', under: '#e0c8a8' },
    desc: '河口近くの石垣やヨシ原にすむ赤っぽいカニ。四角い甲羅にいかつい顔つきで、まさに弁慶。',
  },
  kurobenkei: {
    name: 'クロベンケイガニ', sci: 'Chiromantes dehaani', habitat: 'river', size: [3.0, 4.2], rarity: 2,
    stats: { power: 6, guard: 5, stamina: 6, agility: 5, temper: 7.5 },
    shape: { n: 3.8, lr: 0.86, height: 0.44, trap: 0.06, claw: 1.12, leg: 1.05, eye: 1.0 },
    look: { color: '#3a332c', color2: '#221e1a', pattern: 'speckle', spot: '#5a4636', claw: '#6a4a36', tip: '#d8b898', leg: '#3a2e26', under: '#c8b8a0' },
    desc: '黒っぽい甲羅のベンケイガニの仲間。気が荒く、近づくとすぐにハサミを振り上げて威嚇する。',
  },
  mokuzu: {
    name: 'モクズガニ', sci: 'Eriocheir japonica', habitat: 'river', size: [5.0, 8.0], rarity: 2,
    stats: { power: 7, guard: 6, stamina: 7, agility: 4, temper: 6 },
    shape: { n: 2.5, lr: 0.9, height: 0.38, trap: 0.0, claw: 1.15, leg: 1.28, eye: 1.0, hairy: true, teeth: 4 },
    look: { color: '#6b6a3c', color2: '#44402a', pattern: 'speckle', spot: '#8a8450', claw: '#8a7a50', tip: '#e0d0b0', leg: '#5e5a36', under: '#e2d6b4' },
    desc: 'ハサミにふさふさの毛が生えた川のカニ。秋になると川を下り、海で卵を産む。上海ガニの近い仲間。',
  },
  siomaneki: {
    name: 'シオマネキ', sci: 'Tubuca arcuata', habitat: 'river', size: [2.4, 3.6], rarity: 3,
    stats: { power: 6, guard: 4, stamina: 5, agility: 6, temper: 7 },
    shape: { n: 2.4, lr: 0.62, height: 0.4, trap: 0.32, claw: 1.0, leg: 0.95, eye: 2.6, fiddler: true },
    look: { color: '#3c3a34', color2: '#6a5a48', pattern: 'marble', spot: '#8a7860', claw: '#ea6a38', tip: '#f4e6d4', leg: '#5a4a3a', under: '#e6dccc' },
    desc: 'オスの片方のハサミだけがとても大きい。河口の干潟で大きなハサミを振る姿が「潮を招く」ように見える。',
  },
  nokogiri: {
    name: 'ノコギリガザミ', sci: 'Scylla serrata', habitat: 'river', size: [14, 22], rarity: 4,
    stats: { power: 10, guard: 9, stamina: 8, agility: 4, temper: 9 },
    shape: { n: 1.9, lr: 0.7, height: 0.38, trap: 0.0, claw: 1.45, leg: 1.0, eye: 0.9, paddle: true, teeth: 9, spine: 0.35 },
    look: { color: '#3e4a34', color2: '#28301f', pattern: 'speckle', spot: '#56603e', claw: '#55603f', tip: '#e48a40', leg: '#3e4632', under: '#e4dcc0' },
    desc: '河口の泥にすむ巨大なワタリガニ。ハサミの力はすさまじく、人の指など簡単に挟み切る。まさに「主」の風格。',
  },
  isogani: {
    name: 'イソガニ', sci: 'Hemigrapsus sanguineus', habitat: 'sea', size: [2.4, 3.6], rarity: 1,
    stats: { power: 5, guard: 5, stamina: 5, agility: 5, temper: 6 },
    shape: { n: 3.3, lr: 0.86, height: 0.36, trap: 0.06, claw: 1.0, leg: 1.0, eye: 1.0 },
    look: { color: '#5a4a68', color2: '#3a4838', pattern: 'mottled', spot: '#c8b8a0', claw: '#6a5a74', tip: '#e8dccc', leg: '#5a4c60', under: '#ece2d0' },
    desc: '磯の石をめくると一番よく見つかるカニ。紫と緑のまだら模様で、ハサミには赤い斑点がある。',
  },
  hiraiso: {
    name: 'ヒライソガニ', sci: 'Gaetice depressus', habitat: 'sea', size: [2.0, 3.0], rarity: 1,
    stats: { power: 4, guard: 6.5, stamina: 5, agility: 5, temper: 4 },
    shape: { n: 3.0, lr: 0.82, height: 0.24, trap: 0.1, claw: 0.95, leg: 1.0, eye: 0.9 },
    look: { color: '#6a6258', color2: '#4a443c', pattern: 'speckle', spot: '#b8a888', claw: '#7a6e60', tip: '#e8dccc', leg: '#625a50', under: '#e8e0d0' },
    desc: '平べったい体で石のすき間にもぐりこむ。体色は個体ごとにさまざま。平たいのでひっくり返されにくい。',
  },
  shoujin: {
    name: 'ショウジンガニ', sci: 'Guinusia dentipes', habitat: 'sea', size: [4.5, 7.0], rarity: 2,
    stats: { power: 6, guard: 5, stamina: 6, agility: 9, temper: 6 },
    shape: { n: 2.3, lr: 0.96, height: 0.3, trap: 0.0, claw: 0.9, leg: 1.38, eye: 0.9, teeth: 3 },
    look: { color: '#a8302a', color2: '#6a1c18', pattern: 'mottled', spot: '#d89a7a', claw: '#b83a30', tip: '#f0d0b0', leg: '#a03a2c', under: '#f0d8c0' },
    desc: '岩の上をすばしっこく走り回る赤いカニ。足が長くとても素早いので、捕まえるのはひと苦労。',
  },
  ishigani: {
    name: 'イシガニ', sci: 'Charybdis japonica', habitat: 'sea', size: [6.0, 9.0], rarity: 2,
    stats: { power: 8, guard: 6, stamina: 6, agility: 6, temper: 9 },
    shape: { n: 1.8, lr: 0.74, height: 0.34, trap: 0.0, claw: 1.25, leg: 1.0, eye: 0.9, paddle: true, teeth: 6, spine: 0.12 },
    look: { color: '#5a4636', color2: '#3a2a22', pattern: 'mottled', spot: '#7a5a6a', claw: '#6a4a40', tip: '#2a1a2e', leg: '#5a4436', under: '#ecdcc4' },
    desc: '気性がとても荒いワタリガニの仲間。手を出すとすぐに鋭いハサミで反撃してくる。ハサミの先は黒紫色。',
  },
  gazami: {
    name: 'ガザミ', sci: 'Portunus trituberculatus', habitat: 'sea', size: [13, 20], rarity: 3,
    stats: { power: 9, guard: 7, stamina: 7, agility: 6, temper: 8 },
    shape: { n: 1.55, lr: 0.5, height: 0.32, trap: 0.0, claw: 1.4, leg: 1.0, eye: 0.85, paddle: true, teeth: 8, spine: 0.55, longClaw: true },
    look: { color: '#6a5a48', color2: '#46504c', pattern: 'spots', spot: '#d8d0bc', claw: '#5a6a78', tip: '#e8e0d0', leg: '#5c6a6a', under: '#f0ead8' },
    desc: '「ワタリガニ」の名で知られる。両脇の長いトゲと、泳ぐためのオールのような後ろ脚が特徴。',
  },
  taiwan: {
    name: 'タイワンガザミ', sci: 'Portunus pelagicus', habitat: 'sea', size: [12, 18], rarity: 4,
    stats: { power: 8, guard: 6, stamina: 7, agility: 8, temper: 7 },
    shape: { n: 1.55, lr: 0.48, height: 0.3, trap: 0.0, claw: 1.5, leg: 1.0, eye: 0.85, paddle: true, teeth: 8, spine: 0.6, longClaw: true },
    look: { color: '#3a68ac', color2: '#24447a', pattern: 'spots', spot: '#e8eef8', claw: '#4878c0', tip: '#202a48', leg: '#3a64a8', under: '#f4f2ec' },
    desc: '青い体に白い網目模様がとても美しいワタリガニ。南の海から黒潮に乗ってやってくる、めったに会えないカニ。',
  },
  manjuu: {
    name: 'スベスベマンジュウガニ', sci: 'Atergatis floridus', habitat: 'sea', size: [3.8, 6.0], rarity: 3,
    stats: { power: 6, guard: 9.5, stamina: 6, agility: 3, temper: 3 },
    shape: { n: 2.0, lr: 0.68, height: 0.55, trap: 0.0, claw: 1.0, leg: 0.85, eye: 0.7, lumpy: true },
    look: { color: '#8a4a3a', color2: '#5a6a4a', pattern: 'marble', spot: '#c89a7a', claw: '#8a4a3a', tip: '#1a1414', leg: '#7a4a3a', under: '#e8d8c0' },
    desc: 'つるつるの甲羅に大理石のような模様。体に強い毒を持つので食べてはいけない。とにかく硬くて動じない。',
  },
};

export const SPECIES_ORDER = ['sawagani', 'akate', 'benkei', 'kurobenkei', 'mokuzu', 'siomaneki', 'nokogiri',
  'isogani', 'hiraiso', 'shoujin', 'ishigani', 'gazami', 'taiwan', 'manjuu'];

export const SLOTS = ['朝', '昼', '夕方', '夜'];

// 出現テーブル  time: [朝,昼,夕,夜] 倍率
export const SPAWN = {
  river: {
    hand: [
      { id: 'sawagani', w: 42, t: [1, 1, 1, 0.8] },
      { id: 'akate', w: 20, t: [0.6, 0.5, 1.6, 2.2] },
      { id: 'benkei', w: 18, t: [1, 1, 1.1, 1.2] },
      { id: 'kurobenkei', w: 9, t: [0.8, 0.8, 1.2, 1.5] },
      { id: 'siomaneki', w: 4, t: [1.2, 1.6, 0.8, 0.1] },
      { id: 'mokuzu', w: 2.5, t: [0.6, 0.5, 1, 2] },
    ],
    trap: [
      { id: 'mokuzu', w: 44, t: [1, 0.8, 1.2, 1.6] },
      { id: 'sawagani', w: 18, t: [1, 1, 1, 1] },
      { id: 'kurobenkei', w: 16, t: [1, 1, 1, 1.2] },
      { id: 'nokogiri', w: 3.5, t: [0.8, 0.6, 1, 1.8], big: true },
    ],
  },
  sea: {
    hand: [
      { id: 'isogani', w: 42, t: [1, 1, 1, 1] },
      { id: 'hiraiso', w: 30, t: [1, 1, 1, 1] },
      { id: 'shoujin', w: 10, t: [0.8, 0.8, 1.2, 1.6] },
      { id: 'ishigani', w: 7, t: [0.8, 0.8, 1, 1.4] },
      { id: 'manjuu', w: 3.5, t: [1, 1, 1, 1] },
    ],
    trap: [
      { id: 'ishigani', w: 40, t: [1, 1, 1, 1.3] },
      { id: 'isogani', w: 22, t: [1, 1, 1, 1] },
      { id: 'gazami', w: 11, t: [0.8, 0.6, 1.2, 1.8], big: true },
      { id: 'taiwan', w: 3.2, t: [0.7, 0.6, 1, 1.6], big: true },
    ],
  },
};

export const BAITS = {
  niboshi: { name: '煮干し', desc: 'よく食いつく。小〜中型のカニが入りやすい', bigMul: 1, rate: 1.15 },
  surume: { name: 'スルメ', desc: 'においが強い。大物が寄ってきやすいが数は少なめ', bigMul: 2.6, rate: 0.85 },
};

const TRAITS = [
  { name: '荒くれ', mod: { temper: 2, power: 0.5 } },
  { name: '臆病', mod: { temper: -2, agility: 1.2 } },
  { name: 'のんびり', mod: { agility: -1, stamina: 1.5 } },
  { name: '負けず嫌い', mod: { stamina: 2 } },
  { name: '力自慢', mod: { power: 1.5, agility: -0.5 } },
  { name: '慎重', mod: { guard: 1.5, temper: -0.5 } },
  { name: '気まぐれ', mod: { temper: 1, stamina: -0.5, agility: 0.8 } },
  { name: 'ふつう', mod: {} },
  { name: '根性者', mod: { stamina: 1.2, guard: 0.6 } },
  { name: 'すばしっこい', mod: { agility: 1.6, guard: -0.5 } },
];

export function pickWeighted(list, r, wfn = (x) => x.w) {
  const total = list.reduce((s, x) => s + wfn(x), 0);
  let v = r() * total;
  for (const x of list) { v -= wfn(x); if (v <= 0) return x; }
  return list[list.length - 1];
}

function shiftColor(hex, dh, ds, dl) {
  // HSL シフト
  const c = parseInt(hex.slice(1), 16);
  let r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  h = (h + dh + 1) % 1; s = Math.max(0, Math.min(1, s + ds)); l = Math.max(0, Math.min(1, l + dl));
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let R, G, B;
  if (s === 0) R = G = B = l;
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    R = hue2rgb(p, q, h + 1 / 3); G = hue2rgb(p, q, h); B = hue2rgb(p, q, h - 1 / 3);
  }
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + to(R) + to(G) + to(B);
}

let idCounter = Date.now() % 100000;

// 個体生成
export function makeCrab(speciesId, seed = Math.floor(Math.random() * 1e9), opts = {}) {
  const sp = SPECIES[speciesId];
  const r = mulberry32(seed);
  const [mn, mx] = sp.size;
  let rel = (r() + r() + r()) / 3; // 中央寄り
  if (opts.big) rel = Math.min(1, rel + 0.25 * r());
  let size = mn + (mx - mn) * rel;
  let monster = false;
  const nushi = !!opts.nushi;
  if (nushi) size = mx * (1.0 + r() * 0.08);
  else if (r() < 0.03) { size *= 1.12 + r() * 0.08; monster = true; }
  if (opts.size) { size = opts.size; rel = (size - mn) / (mx - mn); }
  const sex = opts.sex || (r() < 0.55 ? 'm' : 'f');
  const trait = opts.trait ? TRAITS.find((t) => t.name === opts.trait) : TRAITS[Math.floor(r() * TRAITS.length)];
  const stats = {};
  for (const k of Object.keys(sp.stats)) {
    let v = sp.stats[k] * (0.82 + r() * 0.36);
    v += trait.mod[k] || 0;
    if (k === 'power' || k === 'guard') v += (rel - 0.5) * 1.6;
    if (k === 'agility') v -= (rel - 0.5) * 1.0;
    if (k === 'power' && sex === 'm') v += 0.5;
    if (k === 'power' && sex === 'f') v -= 0.4;
    v *= opts.statMul || 1;
    // ヌシ：体は普通でも、力は大型のカニと互角
    if (nushi) v = { power: Math.max(v, 9 + r() * 1.5), guard: Math.max(v, 8.5 + r()), stamina: Math.max(v, 9 + r()), agility: v + 1.5, temper: Math.max(v, 8 + r()) }[k];
    stats[k] = Math.max(1, Math.min(12, Math.round(v * 10) / 10));
  }
  // 見た目
  let look = { ...sp.look };
  let morph = null;
  if (sp.morphs) {
    morph = pickWeighted(sp.morphs, r);
    look = { ...look, color: morph.color, color2: morph.color2, claw: morph.claw, leg: morph.leg };
  }
  const dh = (r() - 0.5) * 0.04, ds = (r() - 0.5) * 0.12 - (nushi ? 0.08 : 0), dl = (r() - 0.5) * 0.1 - (nushi ? 0.16 : 0);
  for (const k of ['color', 'color2', 'claw', 'leg', 'spot']) if (look[k]) look[k] = shiftColor(look[k], dh, ds, dl);
  const clawMul = (sex === 'm' ? 1.12 : 0.86) * (0.92 + r() * 0.16) * (nushi ? 1.35 : 1);
  return {
    id: 'c' + (idCounter++) + '_' + Math.floor(r() * 1e6),
    species: speciesId,
    name: nushi ? sp.name + 'のヌシ' : sp.name,
    seed,
    size: Math.round(size * 10) / 10,
    sex,
    trait: trait.name,
    morph: morph ? morph.label : null,
    monster,
    nushi,
    stats,
    look,
    clawMul,
    lefty: r() < 0.5,
    legMul: 0.95 + r() * 0.1,
    condition: 100,
    wins: 0, losses: 0,
    caughtDay: opts.day || 1,
  };
}

// ヌシは体の大きさに見合わない力を持つ（相撲での体格を何倍に扱うか）
export const NUSHI_BUILD = 3.6;
// 体の大きさそのもの（スタミナの減りやすさ・小回りに効く）
export function bodyBulk(c) { return Math.pow(c.size / 3, 0.9); }
// 相撲での体格（押す力・踏ん張りに効く）
export function combatBuild(c) { return bodyBulk(c) * (c.nushi ? NUSHI_BUILD : 1); }

// 総合力（表示用）
export function overallPower(c) {
  const s = c.stats;
  const build = combatBuild(c);
  return Math.round((s.power * 1.2 + s.guard + s.stamina * 0.8 + s.agility * 0.6 + s.temper * 0.4) * Math.pow(build, 0.55) * 2.2);
}

export function grade(v) {
  if (v >= 9) return 'S';
  if (v >= 7.5) return 'A';
  if (v >= 6) return 'B';
  if (v >= 4.5) return 'C';
  if (v >= 3) return 'D';
  return 'E';
}

// 対戦相手（番付）
export const RIVALS = [
  {
    id: 'yuta', name: 'ゆうた', title: 'となりの家の小1', rank: '序ノ口',
    crab: { species: 'sawagani', size: 2.4, statMul: 0.82, trait: 'のんびり', seed: 101, nick: 'カニオ' },
    hello: 'ぼくのカニオ、つよいんだぞ！', win: 'えへへ、かったー！', lose: 'うわーん、カニオがまけたー！', relose: 'またまけた〜！　つぎはぜったい勝つもん！',
    reward: null, color: '#f0a040',
  },
  {
    id: 'misaki', name: 'みさき', title: '磯あそびが好きな女の子', rank: '序二段',
    crab: { species: 'isogani', size: 3.0, statMul: 0.95, trait: '気まぐれ', seed: 202, nick: 'ムラサキ' },
    hello: 'この子、ハサミの赤い点がかわいいでしょ？　勝負よ！', win: 'やった！　ムラサキの勝ち！', lose: 'くやしい……でも、いいカニね。', relose: 'また負けちゃった。ムラサキ、もっと鍛えなきゃ。',
    reward: { tank: 1 }, color: '#e06a8a',
  },
  {
    id: 'kohei', name: 'こうへい', title: '川あそびの達人', rank: '三段目',
    crab: { species: 'kurobenkei', size: 3.8, statMul: 1.0, trait: '荒くれ', seed: 303, nick: 'クロガネ' },
    hello: '石の下のことならオレに聞きな。クロガネは気が荒いぜ。', win: '川の男をなめるなよ！', lose: 'やるじゃん……。カニカゴ、一個やるよ。', relose: 'くそー、また負けた！　カゴはもうやらねえからな！',
    reward: { trap: 1 }, color: '#4a8a5a',
  },
  {
    id: 'taichi', name: 'たいち', title: '漁師のじいちゃんの孫', rank: '幕下',
    crab: { species: 'ishigani', size: 7.6, statMul: 1.0, trait: '力自慢', seed: 404, nick: 'イワオ' },
    hello: 'じいちゃんのカゴに入ってたイシガニだ。指、はさまれんなよ。', win: '海のカニはひと味ちがうだろ？', lose: 'まじかよ……イワオが負けるなんて。', relose: 'またかよ……じいちゃんに鍛え方を聞いてくる。',
    reward: { tank: 1 }, color: '#3a6aa0',
  },
  {
    id: 'yone', name: 'ヨネばあちゃん', title: '駄菓子屋のおばあちゃん', rank: '十両',
    crab: { species: 'mokuzu', size: 7.4, statMul: 1.05, trait: '根性者', seed: 505, nick: 'モクベエ' },
    hello: 'あらまぁ、相撲かい。うちのモクベエは長生きでねぇ、しぶといよ。', win: 'ほっほっほ、まだまだだねぇ。', lose: 'まぁまぁ、強いカニだこと。ごほうびにカゴをあげようね。', relose: 'あらあら、また負けちゃったねぇ。ラムネでも飲んでいきな。',
    reward: { trap: 1 }, color: '#a0785a',
  },
  {
    id: 'daigo', name: 'ダイゴ', title: '浜のガキ大将', rank: '前頭',
    crab: { species: 'gazami', size: 17.5, statMul: 1.0, trait: '荒くれ', seed: 606, nick: 'ダイオウ' },
    hello: 'オレのダイオウに勝ったやつは一人もいねえ！', win: 'ガハハ！　でかさがちがうんだよ！', lose: 'ウソだろ！？　……おまえ、なかなかやるな。', relose: 'ちっ、またかよ！　次こそダイオウが勝つ！',
    reward: { tank: 1 }, color: '#c04030',
  },
  {
    id: 'genji', name: 'ゲンじい', title: '浜の主と呼ばれる老漁師', rank: '横綱',
    crab: { species: 'nokogiri', size: 21, statMul: 1.12, trait: '負けず嫌い', seed: 707, nick: 'ヌシ' },
    hello: '……ほう、わしのヌシに挑むか。河口の泥で三十年、負け知らずじゃ。', win: '修行が足らんのう。また来なさい。', lose: '見事じゃ。今日からおまえが、この浜の横綱じゃ。', relose: 'さすがは横綱じゃ。ヌシもいい稽古になったわい。',
    reward: { title: '横綱' }, color: '#5a5a5a',
  },
];

export function rivalCrab(rv) {
  const c = makeCrab(rv.crab.species, rv.crab.seed, { size: rv.crab.size, statMul: rv.crab.statMul, trait: rv.crab.trait, sex: 'm' });
  c.name = rv.crab.nick;
  c.id = 'rival_' + rv.id;
  return c;
}
