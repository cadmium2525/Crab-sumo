// WebAudio による効果音・環境音（音源ファイル不要）
let ctx = null, master = null, ambGain = null, ambNodes = [];
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
    ambGain.gain.value = 0.5;
    ambGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setEnabled(v) {
  enabled = v;
  if (master) master.gain.value = v ? 0.8 : 0;
}
export function unlock() { ensure(); }

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
  if (kind === 'cicada' || kind === 'river' || kind === 'sea') {
    // セミ（ミンミン風の変調）
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 4200;
    add(o, (f) => { f.type = 'bandpass'; f.frequency.value = 4400; f.Q.value = 8; }, kind === 'cicada' ? 0.03 : 0.012, { f: 9, depth: kind === 'cicada' ? 0.025 : 0.01 });
  }
  if (kind === 'night') {
    // 虫の声（コオロギ風）
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 4800;
    add(o, (f) => { f.type = 'bandpass'; f.frequency.value = 4800; f.Q.value = 10; }, 0.02, { f: 22, depth: 0.02 });
    add(noise(), (f) => { f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.4; }, 0.05);
  }
}
