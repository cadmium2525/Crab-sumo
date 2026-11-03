// WebAudio による効果音・環境音・BGM
// BGM とジングルは tools/music（「かなでる」で作曲）から書き出した audio/*.mp3
let ctx = null, master = null, ambGain = null, ambNodes = [], musicBus = null;
let enabled = true;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.8 : 0;
    master.connect(ctx.destination);
    ambGain = ctx.createGain();
    ambGain.gain.value = 0.35;
    ambGain.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 1;
    musicBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setEnabled(v) {
  enabled = v;
  if (master) master.gain.value = v ? 0.8 : 0;
}
export function unlock() {
  if (!ensure()) return;
  // 操作前に頼まれていた BGM を、ここで始める
  if (wanted && (!current || current.name !== wanted)) music(wanted);
}

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  return s;
}

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function burst({ freq = 1000, q = 1, type = 'bandpass', a = 0.005, d = 0.15, peak = 0.5, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const s = noise();
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, a, peak, d);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t); s.stop(t + a + d + 0.05);
}

function tone({ freq = 440, freq2 = null, type = 'sine', a = 0.005, d = 0.2, peak = 0.3, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, t + a + d);
  const g = ctx.createGain();
  env(g, t, a, peak, d);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + a + d + 0.05);
}

export function sfx(name) {
  if (!ensure() || !enabled) return;
  switch (name) {
    case 'poke': tone({ freq: 180, freq2: 90, d: 0.12, peak: 0.5 }); burst({ freq: 600, d: 0.05, peak: 0.2 }); break;
    case 'click': tone({ freq: 900, freq2: 600, d: 0.05, peak: 0.12, type: 'triangle' }); break;
    case 'clack': burst({ freq: 3200, q: 4, d: 0.04, peak: 0.6 }); burst({ freq: 2200, q: 6, d: 0.05, peak: 0.4, delay: 0.035 }); break;
    case 'pinch': burst({ freq: 2800, q: 5, d: 0.05, peak: 0.7 }); tone({ freq: 520, freq2: 300, d: 0.25, peak: 0.25, type: 'square', delay: 0.05 }); break;
    case 'rock': burst({ freq: 300, q: 0.8, d: 0.3, peak: 0.6, type: 'lowpass' }); burst({ freq: 1200, q: 2, d: 0.08, peak: 0.3, delay: 0.25 }); break;
    case 'splash': burst({ freq: 1800, q: 0.6, a: 0.01, d: 0.4, peak: 0.5 }); burst({ freq: 700, q: 0.8, d: 0.3, peak: 0.3, delay: 0.05 }); break;
    case 'taiko':
      tone({ freq: 110, freq2: 60, d: 0.5, peak: 0.9 }); burst({ freq: 200, q: 1, d: 0.15, peak: 0.6, type: 'lowpass' });
      break;
    case 'hyoshigi': burst({ freq: 2500, q: 12, d: 0.08, peak: 0.8 }); burst({ freq: 2500, q: 12, d: 0.08, peak: 0.8, delay: 0.22 }); break;
    case 'catch': [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, d: 0.18, peak: 0.18, type: 'triangle', delay: i * 0.08 })); break;
    case 'escape': tone({ freq: 400, freq2: 180, d: 0.35, peak: 0.2, type: 'triangle' }); break;
    case 'win': [392, 523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, d: 0.3, peak: 0.2, type: 'triangle', delay: i * 0.11 })); break;
    case 'lose': [392, 370, 330, 262].forEach((f, i) => tone({ freq: f, d: 0.35, peak: 0.18, type: 'triangle', delay: i * 0.18 })); break;
    case 'thud': tone({ freq: 90, freq2: 45, d: 0.3, peak: 0.7 }); burst({ freq: 400, d: 0.1, peak: 0.3, type: 'lowpass' }); break;
    case 'crowd': burst({ freq: 900, q: 0.4, a: 0.1, d: 1.2, peak: 0.25 }); break;
  }
}

export function ambient(kind) {
  if (!ensure()) return;
  for (const n of ambNodes) { try { n.stop(); } catch (e) { /* noop */ } }
  ambNodes = [];
  if (!kind) return;
  const t = ctx.currentTime;
  const add = (src, filterSetup, gainV, lfo) => {
    const f = ctx.createBiquadFilter(); filterSetup(f);
    const g = ctx.createGain(); g.gain.value = gainV;
    src.connect(f); f.connect(g); g.connect(ambGain);
    if (lfo) {
      const o = ctx.createOscillator(); o.frequency.value = lfo.f;
      const og = ctx.createGain(); og.gain.value = lfo.depth;
      o.connect(og); og.connect(g.gain); o.start(t); ambNodes.push(o);
    }
    src.start(t); ambNodes.push(src);
  };
  if (kind === 'river') {
    add(noise(), (f) => { f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.4; }, 0.18, { f: 0.3, depth: 0.05 });
    add(noise(), (f) => { f.type = 'highpass'; f.frequency.value = 3000; }, 0.04, { f: 7, depth: 0.03 });
  }
  if (kind === 'sea') {
    add(noise(), (f) => { f.type = 'lowpass'; f.frequency.value = 700; }, 0.2, { f: 0.12, depth: 0.17 });
    add(noise(), (f) => { f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 0.5; }, 0.03, { f: 0.12, depth: 0.03 });
  }
}

/* ===================== BGM ===================== */
// bars 小節ぶんが1ループ。ファイルの最後には余韻が入っているので、
// 次のループを余韻に重ねて始めると、つなぎ目なく聞こえる。
// （同じバッファを重ねるので、MP3 の先頭の遅延も両方で同じになり、拍がずれない）
const TRACKS = {
  home: { bpm: 84, bars: 16, vol: 0.9 },
  field: { bpm: 108, bars: 16, vol: 0.85 },
  night: { bpm: 70, bars: 12, vol: 1 },
  sumo: { bpm: 128, bars: 16, vol: 0.85 },
};
const JINGLES = { win: 0.95, lose: 0.95, catch: 0.9 };
const buffers = new Map();
const loading = new Map();
let current = null;      // { name, gain, next, sources, timer }
let wanted = null;

function load(name) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name));
  if (loading.has(name)) return loading.get(name);
  const p = fetch(`audio/${name}.mp3`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
    .then((buf) => { buffers.set(name, buf); return buf; })
    .catch((e) => { console.warn('BGM の読み込みに失敗', name, e); loading.delete(name); return null; });
  loading.set(name, p);
  return p;
}

function fadeOut(track, sec = 1.2) {
  if (!track) return;
  clearInterval(track.timer);
  const t = ctx.currentTime;
  track.gain.gain.cancelScheduledValues(t);
  track.gain.gain.setValueAtTime(track.gain.gain.value, t);
  track.gain.gain.linearRampToValueAtTime(0, t + sec);
  setTimeout(() => { for (const s of track.sources) { try { s.stop(); } catch (e) { /* noop */ } } track.gain.disconnect(); }, sec * 1000 + 100);
}

/** BGM を切り替える（同じ曲なら何もしない）。null で止める */
export function music(name) {
  wanted = name;
  if (!ensure()) return;
  if (current && current.name === name) return;
  fadeOut(current);
  current = null;
  if (!name || !TRACKS[name]) return;
  load(name).then((buf) => {
    if (!buf || wanted !== name || (current && current.name === name)) return;
    const meta = TRACKS[name];
    const loopLen = meta.bars * 4 * 60 / meta.bpm;
    const gain = ctx.createGain();
    gain.connect(musicBus);
    const t0 = ctx.currentTime + 0.05;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(meta.vol, t0 + 1.2);
    const track = { name, gain, next: t0, sources: [], timer: 0 };
    const schedule = () => {
      // 2 秒先までのループを予約
      while (track.next < ctx.currentTime + 2) {
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.connect(gain);
        s.start(track.next);
        s.onended = () => { const i = track.sources.indexOf(s); if (i >= 0) track.sources.splice(i, 1); };
        track.sources.push(s);
        track.next += loopLen;
      }
    };
    schedule();
    track.timer = setInterval(schedule, 500);
    current = track;
  });
}

/** 勝ち・負け・捕獲のジングル。BGM を下げて鳴らす */
export function jingle(name, { stopMusic = false } = {}) {
  if (!ensure() || !enabled) return;
  if (stopMusic) music(null);
  load(name).then((buf) => {
    if (!buf) { sfx(name); return; }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = JINGLES[name] ?? 1;
    s.connect(g); g.connect(master);
    const t = ctx.currentTime + 0.02;
    s.start(t);
    if (!stopMusic && musicBus) {
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(musicBus.gain.value, t);
      musicBus.gain.linearRampToValueAtTime(0.18, t + 0.15);
      musicBus.gain.setValueAtTime(0.18, t + buf.duration - 1);
      musicBus.gain.linearRampToValueAtTime(1, t + buf.duration + 0.5);
    }
  });
}

/** よく使う曲を先に読み込んでおく */
export function preload(names = ['home', 'field', 'sumo', 'catch']) {
  if (!ensure()) return;
  for (const n of names) load(n);
}

/** 状態の確認用 */
export function musicState() {
  return { ctx: ctx?.state, name: current?.name ?? null, sources: current?.sources.length ?? 0, loaded: [...buffers.keys()] };
}
