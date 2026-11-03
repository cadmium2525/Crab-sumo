// 相撲クラブの BGM・ジングルを「かなでる」の曲 JSON として作るスクリプト
//   node tools/music/gen.mjs        → tools/music/songs/*.json を書き出す
//   sh tools/music/build.sh         → かなでるのエンジンで音にして audio/*.mp3 を作る
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'songs');
mkdirSync(OUT, { recursive: true });

const N = (t, n, d, v = 0.7) => [t, n, d, v];
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const midi = (s) => { const m = /^([A-G][#b]?)(-?\d)$/.exec(s); return 12 * (Number(m[2]) + 1) + NOTE[m[1]]; };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const name = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const tr = (s, k) => name(midi(s) + k);
// 旋律：[[小節内の拍, 音, 長さ], ...] を小節ごとに並べたもの → 音符列
const melody = (bars, beatsPerBar = 4, vel = 0.68) => bars.flatMap((bar, i) => bar.map(([t, n, d, v]) => N(i * beatsPerBar + t, n, d, v ?? vel + (t === 0 ? 0.06 : 0))));
// 和音進行：[[開始拍, 長さ, 低音, [和音の構成音...]], ...]
const save = (file, song) => { writeFileSync(join(OUT, file), JSON.stringify(song, null, 1)); console.log('書き出し', file); };

/* ======================================================================
 * 1. 縁側の午後（水槽・ホーム） F メジャー 84BPM 16小節
 *    ナイロンギターのアルペジオ、ビブラフォンとフルートの旋律、風鈴
 * ==================================================================== */
{
  const prog = [
    [0, 4, 'F2', ['A3', 'C4', 'E4', 'F4']], [4, 2, 'E2', ['G3', 'B3', 'D4', 'E4']], [6, 2, 'A1', ['G3', 'C#4', 'E4', 'A4']],
    [8, 4, 'D2', ['F3', 'A3', 'C4', 'F4']], [12, 2, 'C2', ['G3', 'A#3', 'D#4', 'G4']], [14, 2, 'F2', ['A3', 'D#4', 'F4', 'A4']],
    [16, 4, 'A#1', ['A3', 'D4', 'F4', 'A4']], [20, 4, 'A1', ['G3', 'C4', 'E4', 'A4']], [24, 4, 'G1', ['F3', 'A#3', 'D4', 'G4']],
    [28, 2, 'C2', ['F3', 'A#3', 'C4', 'G4']], [30, 2, 'C2', ['E3', 'A#3', 'C4', 'G4']],
    [32, 4, 'D2', ['F3', 'A3', 'C4', 'F4']], [36, 4, 'A1', ['G3', 'C4', 'E4', 'A4']], [40, 4, 'A#1', ['A3', 'D4', 'F4', 'A4']], [44, 4, 'A1', ['A3', 'C4', 'F4', 'A4']],
    [48, 4, 'G1', ['F3', 'A#3', 'D4', 'G4']], [52, 2, 'A1', ['G3', 'C4', 'E4', 'A4']], [54, 2, 'D2', ['F3', 'A3', 'C4', 'F4']],
    [56, 4, 'G1', ['F3', 'A#3', 'D4', 'G4']], [60, 2, 'C2', ['F3', 'A#3', 'C4', 'G4']], [62, 2, 'C2', ['E3', 'A#3', 'C4', 'G4']],
  ];
  const guitar = [], keys = [], bass = [];
  for (const [t, d, b, v] of prog) {
    const seq = [v[0], v[1], v[2], v[3], v[2], v[1], v[2], v[3]];
    for (let k = 0; k < d * 2; k++) guitar.push(N(t + k * 0.5, k === 0 ? tr(b, 12) : seq[k % 8], k === 0 ? d : 0.9, k % 2 ? 0.42 : 0.55));
    keys.push(...v.slice(1).map((n) => N(t, tr(n, 12), d - 0.05, 0.3)));
    bass.push(N(t, b, d >= 4 ? 1.5 : 1.2, 0.72));
    if (d >= 4) { bass.push(N(t + 2.5, b, 0.5, 0.5)); bass.push(N(t + 3, tr(b, 7), 0.9, 0.6)); }
    else bass.push(N(t + 1.5, tr(b, 7), 0.45, 0.5));
  }
  const vib = melody([
    [[0, 'A4', 1], [1, 'C5', 1], [2, 'E5', 1.5], [3.5, 'D5', 0.5]],
    [[0, 'C5', 1], [1, 'A4', 1], [2, 'G4', 1.5], [3.5, 'A4', 0.5]],
    [[0, 'F5', 2], [2, 'E5', 1], [3, 'D5', 1]],
    [[0, 'D#5', 1.5], [1.5, 'D5', 0.5], [2, 'C5', 1], [3, 'A4', 1]],
    [[0, 'D5', 1], [1, 'F5', 1], [2, 'A5', 2]],
    [[0, 'G5', 1], [1, 'E5', 1], [2, 'C5', 2]],
    [[0, 'D5', 1.5], [1.5, 'F5', 0.5], [2, 'E5', 1], [3, 'D5', 1]],
    [[0, 'C5', 1], [1, 'D5', 1], [2, 'E5', 2]],
  ]);
  const flute = melody([
    [[0, 'F5', 1], [1, 'A5', 1], [2, 'G5', 1], [3, 'F5', 1]],
    [[0, 'E5', 2], [2, 'C5', 1], [3, 'E5', 1]],
    [[0, 'D5', 1.5], [1.5, 'C5', 0.5], [2, 'D5', 1], [3, 'F5', 1]],
    [[0, 'C5', 3], [3, 'A4', 1]],
    [[0, 'A#4', 1], [1, 'D5', 1], [2, 'F5', 1.5], [3.5, 'E5', 0.5]],
    [[0, 'E5', 1], [1, 'C5', 1], [2, 'D5', 2]],
    [[0, 'G5', 1], [1, 'F5', 1], [2, 'D5', 1], [3, 'A#4', 1]],
    [[0, 'C5', 2], [2, 'G4', 1], [3, 'A#4', 1]],
  ], 4, 0.62).map(([t, n, d, v]) => [t + 32, n, d, v]);
  // 風鈴（高いベルがときどき鳴る）
  const furin = [[3.5, 'C7'], [11, 'A6'], [18.5, 'F6'], [27, 'C7'], [35.5, 'A6'], [43, 'E7'], [50.5, 'C7'], [59, 'F6']].map(([t, n]) => N(t, n, 2, 0.4));
  const kit = { kick: 'X.......x.x.....', rim: '....x.......x...', shaker: 'o.g.o.g.o.g.o.g.' };
  save('home.json', {
    name: 'Engawa no gogo', bpm: 84, sig: [4, 4], bars: 16, tail: 3, key: 'F major',
    sends: { reverb: { size: 1.1, decay: 2.2, damp: 6500, predelay: 0.02 }, delay: { time: '1/8d', feedback: 0.3, tone: 4000 } },
    master: { loudness: -18, ceiling: -1 },
    tracks: [
      { id: 'gtr', name: 'ナイロンギター', inst: 'nylon', volume: -3, pan: -0.25, sends: { reverb: 0.2 }, humanize: { time: 0.008, vel: 0.06 }, swing: 0.12, clips: [{ at: 0, notes: guitar }] },
      { id: 'keys', name: 'エレピ', inst: 'epiano', volume: -12, pan: 0.2, sends: { reverb: 0.25 }, clips: [{ at: 0, notes: keys }] },
      { id: 'bass', name: 'ベース', inst: 'ebass', volume: -4, clips: [{ at: 0, notes: bass }] },
      { id: 'vib', name: 'ビブラフォン', inst: 'vibraphone', volume: -2, pan: 0.1, sends: { reverb: 0.3, delay: 0.12 }, humanize: { time: 0.006, vel: 0.05 }, clips: [{ at: 0, notes: vib }] },
      { id: 'fl', name: 'フルート', inst: 'flute', volume: -5, pan: -0.05, sends: { reverb: 0.3, delay: 0.1 }, clips: [{ at: 0, notes: flute }] },
      { id: 'furin', name: '風鈴', inst: 'glock', volume: -14, pan: 0.6, sends: { reverb: 0.6 }, clips: [{ at: 0, notes: furin }] },
      { id: 'drums', name: 'ドラム', type: 'drums', kit: 'lofi', volume: -9, swing: 0.12, humanize: { time: 0.006, vel: 0.08 }, clips: [{ at: 0, len: 4, grid: kit, repeat: 16 }] },
    ],
  });
}

/* ======================================================================
 * 2. 川あそび（川・海の昼） D メジャー 108BPM 16小節
 *    マリンバの旋律、ピチカートの裏打ち、アコギ、タンバリン
 * ==================================================================== */
{
  const prog = [
    [0, 4, 'D2', ['D4', 'F#4', 'A4']], [4, 4, 'C#2', ['C#4', 'E4', 'A4']], [8, 4, 'B1', ['D4', 'F#4', 'B4']], [12, 4, 'G1', ['D4', 'G4', 'B4']],
    [16, 4, 'F#1', ['D4', 'F#4', 'A4']], [20, 4, 'G1', ['D4', 'G4', 'B4']], [24, 4, 'E2', ['D4', 'G4', 'B4']], [28, 4, 'A1', ['C#4', 'G4', 'A4']],
    [32, 4, 'G1', ['D4', 'G4', 'B4']], [36, 4, 'A1', ['C#4', 'E4', 'A4']], [40, 4, 'F#1', ['C#4', 'F#4', 'A4']], [44, 4, 'B1', ['D4', 'F#4', 'B4']],
    [48, 4, 'G1', ['D4', 'G4', 'B4']], [52, 4, 'A1', ['C#4', 'E4', 'A4']], [56, 2, 'F#1', ['D4', 'F#4', 'A4']], [58, 2, 'G1', ['D4', 'G4', 'B4']],
    [60, 2, 'A1', ['D4', 'E4', 'A4']], [62, 2, 'A1', ['C#4', 'E4', 'G4']],
  ];
  const pizz = [], gtr = [], bass = [];
  for (const [t, d, b, v] of prog) {
    for (let k = 0; k < d; k++) pizz.push(...v.map((n) => N(t + k + 0.5, n, 0.4, 0.5)));
    for (let k = 0; k < d; k += 2) { gtr.push(...v.map((n) => N(t + k, tr(n, -12), 1.4, 0.5))); gtr.push(...v.map((n) => N(t + k + 1.5, tr(n, -12), 0.45, 0.4))); }
    for (let k = 0; k < d; k++) bass.push(N(t + k, k % 2 ? tr(b, 12) : b, 0.45, k % 2 ? 0.55 : 0.75));
  }
  const mar = melody([
    [[0, 'F#5', 0.5], [0.5, 'A5', 0.5], [1, 'A5', 1], [2, 'F#5', 0.5], [2.5, 'E5', 0.5], [3, 'D5', 1]],
    [[0, 'E5', 0.5], [0.5, 'F#5', 0.5], [1, 'E5', 1], [2, 'C#5', 1], [3, 'A4', 1]],
    [[0, 'D5', 0.5], [0.5, 'F#5', 0.5], [1, 'B5', 1], [2, 'A5', 0.5], [2.5, 'F#5', 0.5], [3, 'D5', 1]],
    [[0, 'E5', 1.5], [1.5, 'D5', 0.5], [2, 'B4', 2]],
    [[0, 'A4', 0.5], [0.5, 'D5', 0.5], [1, 'F#5', 1], [2, 'A5', 1], [3, 'F#5', 1]],
    [[0, 'G5', 0.5], [0.5, 'F#5', 0.5], [1, 'E5', 1], [2, 'D5', 1], [3, 'B4', 1]],
    [[0, 'E5', 1], [1, 'G5', 1], [2, 'F#5', 0.5], [2.5, 'E5', 0.5], [3, 'D5', 1]],
    [[0, 'C#5', 2], [2, 'E5', 1], [3, 'A4', 1]],
    [[0, 'B5', 1.5], [1.5, 'A5', 0.5], [2, 'G5', 1], [3, 'D5', 1]],
    [[0, 'C#5', 1], [1, 'E5', 1], [2, 'A5', 2]],
    [[0, 'F#5', 1], [1, 'A5', 0.5], [1.5, 'F#5', 0.5], [2, 'C#5', 2]],
    [[0, 'D5', 1], [1, 'F#5', 1], [2, 'B5', 1], [3, 'A5', 1]],
    [[0, 'G5', 1], [1, 'B5', 1], [2, 'D6', 1.5], [3.5, 'B5', 0.5]],
    [[0, 'A5', 1], [1, 'E5', 1], [2, 'C#5', 1], [3, 'E5', 1]],
    [[0, 'F#5', 1], [1, 'A5', 1], [2, 'G5', 1], [3, 'B5', 1]],
    [[0, 'A5', 2], [2, 'G5', 0.5], [2.5, 'F#5', 0.5], [3, 'E5', 1]],
  ]);
  // カリンバの合いの手（後半）
  const kal = [];
  for (let bar = 8; bar < 16; bar++) { const t = bar * 4; kal.push(N(t + 1.5, 'A5', 0.5, 0.4), N(t + 3.5, 'D6', 0.5, 0.35)); }
  const kit = { kick: 'X.......X.x.....', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.oo', tamb: '....o.......o..o' };
  save('field.json', {
    name: 'Kawaasobi', bpm: 108, sig: [4, 4], bars: 16, tail: 2.5, key: 'D major',
    sends: { reverb: { size: 0.9, decay: 1.6, damp: 7000 }, delay: { time: '1/8d', feedback: 0.28, tone: 4500 } },
    master: { loudness: -18, ceiling: -1 },
    tracks: [
      { id: 'mar', name: 'マリンバ', inst: 'marimba', volume: 0, pan: 0.05, sends: { reverb: 0.2, delay: 0.08 }, humanize: { time: 0.005, vel: 0.06 }, clips: [{ at: 0, notes: mar }] },
      { id: 'kal', name: 'カリンバ', inst: 'kalimba', volume: -8, pan: 0.5, sends: { reverb: 0.3, delay: 0.2 }, clips: [{ at: 0, notes: kal }] },
      { id: 'pizz', name: 'ピチカート', inst: 'pizz', volume: -9, pan: -0.35, sends: { reverb: 0.2 }, humanize: { time: 0.006, vel: 0.06 }, clips: [{ at: 0, notes: pizz }] },
      { id: 'gtr', name: 'アコギ', inst: 'guitar', volume: -10, pan: 0.35, strum: 0.015, sends: { reverb: 0.15 }, clips: [{ at: 0, notes: gtr }] },
      { id: 'bass', name: 'ベース', inst: 'ebass', volume: -5, clips: [{ at: 0, notes: bass }] },
      { id: 'drums', name: 'ドラム', type: 'drums', kit: 'acoustic', volume: -11, humanize: { time: 0.005, vel: 0.08 }, clips: [{ at: 0, len: 4, grid: kit, repeat: 16 }] },
    ],
  });
}

/* ======================================================================
 * 3. 夜の水辺（夜） A マイナー 70BPM 12小節
 *    パッドとオルゴール、やわらかいピアノ、ホタルのきらめき
 * ==================================================================== */
{
  const prog = [
    [0, 4, 'A1', ['C4', 'E4', 'G4', 'B4']], [4, 4, 'F1', ['C4', 'E4', 'A4']], [8, 4, 'C2', ['B3', 'E4', 'G4']], [12, 4, 'G1', ['B3', 'D4', 'E4']],
    [16, 4, 'A1', ['C4', 'E4', 'G4', 'B4']], [20, 4, 'F1', ['C4', 'E4', 'A4']], [24, 4, 'D2', ['C4', 'F4', 'A4', 'E5']], [28, 2, 'E2', ['A3', 'B3', 'E4']], [30, 2, 'E2', ['G#3', 'B3', 'E4']],
    [32, 4, 'F1', ['C4', 'E4', 'A4']], [36, 4, 'G1', ['B3', 'D4', 'G4']], [40, 2, 'E2', ['B3', 'D4', 'G4']], [42, 2, 'A1', ['C4', 'E4', 'A4']],
    [44, 2, 'D2', ['C4', 'F4', 'A4']], [46, 2, 'E2', ['A3', 'B3', 'E4']],
  ];
  const pad = [], pno = [], bass = [];
  for (const [t, d, b, v] of prog) {
    pad.push(...v.map((n) => N(t, n, d, 0.45)));
    bass.push(N(t, tr(b, 12), d - 0.1, 0.55));
    const arp = [tr(b, 24), ...v.map((n) => tr(n, 0))];
    for (let k = 0; k < d; k++) pno.push(N(t + k, arp[k % arp.length], 1.5, k ? 0.32 : 0.42));
  }
  const box = melody([
    [[0, 'E5', 1], [1, 'B5', 2], [3, 'A5', 1]],
    [[0, 'E5', 2], [2, 'C5', 2]],
    [[0, 'G5', 1], [1, 'E5', 1], [2, 'B4', 2]],
    [[0, 'D5', 3], [3, 'E5', 1]],
    [[0, 'C6', 1], [1, 'B5', 1], [2, 'A5', 1], [3, 'E5', 1]],
    [[0, 'A5', 2], [2, 'G5', 1], [3, 'E5', 1]],
    [[0, 'F5', 1], [1, 'E5', 1], [2, 'D5', 1], [3, 'E5', 1]],
    [[0, 'B4', 2], [2, 'G#4', 2]],
    [[0, 'A4', 1], [1, 'C5', 1], [2, 'E5', 1], [3, 'G5', 1]],
    [[0, 'B5', 2], [2, 'A5', 1], [3, 'G5', 1]],
    [[0, 'G5', 1], [1, 'E5', 1], [2, 'C5', 2]],
    [[0, 'D5', 1], [1, 'F5', 1], [2, 'E5', 2]],
  ], 4, 0.6);
  const sparkle = [[2.5, 'E7'], [9.75, 'B6'], [17.5, 'A6'], [26.25, 'E7'], [33.5, 'C7'], [41.75, 'G6']].map(([t, n]) => N(t, n, 1, 0.35));
  save('night.json', {
    name: 'Yoru no mizube', bpm: 70, sig: [4, 4], bars: 12, tail: 4, key: 'A minor',
    sends: { reverb: { size: 1.6, decay: 3.2, damp: 5500, predelay: 0.03 }, delay: { time: '1/4', feedback: 0.35, tone: 3500 } },
    master: { loudness: -20, ceiling: -1 },
    tracks: [
      { id: 'pad', name: 'パッド', inst: 'airpad', volume: -8, sends: { reverb: 0.3 }, clips: [{ at: 0, notes: pad }] },
      { id: 'pno', name: 'ピアノ', inst: 'softpiano', volume: -9, pan: -0.2, sends: { reverb: 0.35 }, humanize: { time: 0.01, vel: 0.06 }, clips: [{ at: 0, notes: pno }] },
      { id: 'bass', name: 'ベース', inst: 'subbass', volume: -10, clips: [{ at: 0, notes: bass }] },
      { id: 'box', name: 'オルゴール', inst: 'musicbox', volume: -2, pan: 0.15, sends: { reverb: 0.35, delay: 0.15 }, humanize: { time: 0.008, vel: 0.05 }, clips: [{ at: 0, notes: box }] },
      { id: 'spk', name: 'きらめき', inst: 'celesta', volume: -12, pan: 0.6, sends: { reverb: 0.6, delay: 0.3 }, clips: [{ at: 0, notes: sparkle }] },
    ],
  });
}

/* ======================================================================
 * 4. 土俵の熱戦（相撲） D マイナー 128BPM 16小節
 *    太鼓・鉦、琴の刻み、尺八風の笛、ストリングス
 * ==================================================================== */
{
  const prog = [
    [0, 8, 'D', 'm'], [8, 4, 'A#', 'M'], [12, 4, 'C', 'M'], [16, 8, 'D', 'm'], [24, 4, 'A#', 'M'], [28, 4, 'A', 'A'],
    [32, 4, 'G', 'm'], [36, 4, 'D', 'm'], [40, 2, 'A#', 'M'], [42, 2, 'C', 'M'], [44, 4, 'D', 'm'],
    [48, 4, 'G', 'm'], [52, 4, 'D', 'm'], [56, 4, 'A#', 'M'], [60, 4, 'A', 'A'],
  ];
  const koto = [], str = [], bass = [], choir = [];
  const shape = { m: [0, 7, 12, 7, 10, 7, 5, 7], M: [0, 7, 12, 7, 9, 7, 4, 7], A: [0, 7, 12, 7, 8, 7, 4, 7] };
  const triad = { m: [0, 3, 7], M: [0, 4, 7], A: [0, 4, 7] };
  for (const [t, d, r, q] of prog) {
    const root = midi(r + (['A', 'A#', 'G'].includes(r) ? '3' : '4'));
    for (let k = 0; k < d * 2; k++) koto.push(N(t + k * 0.5, name(root + shape[q][k % 8]), 0.45, k % 4 === 0 ? 0.72 : 0.5));
    str.push(...triad[q].map((i) => N(t, name(root + i), d - 0.05, 0.55)));
    for (let k = 0; k < d; k += 2) { bass.push(N(t + k, name(root - 24), 0.9, 0.8)); bass.push(N(t + k + 1.5, name(root - 24), 0.4, 0.6)); }
    if (t >= 32) choir.push(...triad[q].map((i) => N(t, name(root + i + 12), d - 0.05, 0.4)));
  }
  const fl = melody([
    [[0, 'D5', 1.5], [1.5, 'F5', 0.5], [2, 'G5', 2]],
    [[0, 'A5', 1], [1, 'G5', 0.5], [1.5, 'F5', 0.5], [2, 'D5', 2]],
    [[0, 'F5', 1], [1, 'G5', 1], [2, 'A#5', 1], [3, 'A5', 1]],
    [[0, 'G5', 3], [3, 'E5', 1]],
    [[0, 'D5', 0.5], [0.5, 'F5', 0.5], [1, 'A5', 1], [2, 'C6', 1], [3, 'A5', 1]],
    [[0, 'D6', 2], [2, 'C6', 1], [3, 'A5', 1]],
    [[0, 'A#5', 1], [1, 'A5', 1], [2, 'G5', 1], [3, 'F5', 1]],
    [[0, 'E5', 2], [2, 'C#5', 1], [3, 'E5', 1]],
    [[0, 'G5', 1.5], [1.5, 'A#5', 0.5], [2, 'D6', 2]],
    [[0, 'C6', 1], [1, 'A5', 1], [2, 'F5', 2]],
    [[0, 'F5', 1], [1, 'G5', 1], [2, 'G5', 1], [3, 'C6', 1]],
    [[0, 'D6', 3]],
    [[0, 'A#5', 1], [1, 'A5', 1], [2, 'G5', 1], [3, 'D5', 1]],
    [[0, 'F5', 1], [1, 'G5', 1], [2, 'A5', 2]],
    [[0, 'A#5', 1], [1, 'C6', 1], [2, 'D6', 1], [3, 'A#5', 1]],
    [[0, 'A5', 2], [2, 'G5', 0.5], [2.5, 'F5', 0.5], [3, 'E5', 1]],
  ], 4, 0.7);
  // 太鼓（cinematic キット：kick は大太鼓、tom は締太鼓）、鉦（cowbell）
  const taiko = { kick: 'X.....x.X.......', tom3: '....X.......X...', tom1: '..........o....o', cowbell: '..o...o...o...o.' };
  const fill = { kick: 'X.....x.X.......', tom3: '....X.......X.X.', tom1: '........xoxoXxXX' };
  save('sumo.json', {
    name: 'Dohyo no nessen', bpm: 128, sig: [4, 4], bars: 16, tail: 2.5, key: 'D minor',
    sends: { reverb: { size: 1.3, decay: 2, damp: 6000, predelay: 0.02 }, delay: { time: '1/8d', feedback: 0.25, tone: 4000 } },
    master: { loudness: -17, ceiling: -1 },
    patterns: { taiko: { len: 4, grid: taiko }, fill: { len: 4, grid: fill } },
    tracks: [
      { id: 'taiko', name: '太鼓', type: 'drums', kit: 'cinematic', volume: -4, sends: { reverb: 0.25 }, humanize: { time: 0.004, vel: 0.08 },
        clips: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60].map((bar, i) => ({ at: bar, pattern: (i % 4 === 3) ? 'fill' : 'taiko' })) },
      { id: 'koto', name: '琴', inst: 'koto', volume: -6, pan: -0.3, sends: { reverb: 0.2, delay: 0.1 }, humanize: { time: 0.004, vel: 0.06 }, clips: [{ at: 0, notes: koto }] },
      { id: 'fl', name: '笛', inst: 'flute', volume: -3, pan: 0.15, sends: { reverb: 0.3, delay: 0.12 }, clips: [{ at: 0, notes: fl }] },
      { id: 'str', name: 'ストリングス', inst: 'strings', volume: -12, sends: { reverb: 0.25 }, clips: [{ at: 0, notes: str }] },
      { id: 'choir', name: 'クワイア', inst: 'choiroo', volume: -16, sends: { reverb: 0.35 }, clips: [{ at: 0, notes: choir }] },
      { id: 'bass', name: 'ベース', inst: 'subbass', volume: -9, clips: [{ at: 0, notes: bass }] },
    ],
  });
}

/* ======================================================================
 * ジングル：勝ち・負け・捕獲
 * ==================================================================== */
save('win.json', {
  name: 'Kachi', bpm: 120, sig: [4, 4], bars: 3, tail: 2.5, key: 'D major',
  sends: { reverb: { size: 1.2, decay: 2.2 } }, master: { loudness: -15, ceiling: -1 },
  tracks: [
    { id: 'brass', name: 'ブラス', inst: 'brass', volume: -2, sends: { reverb: 0.25 }, clips: [{ at: 0, notes: [
      N(0, 'A4', 0.45, 0.75), N(0.5, 'D5', 0.45, 0.75), N(1, 'F#5', 0.45, 0.8), N(1.5, 'A5', 1.4, 0.85),
      N(3, 'F#5', 0.45, 0.75), N(3.5, 'A5', 0.45, 0.8), ...['D5', 'F#5', 'A5', 'D6'].map((n) => N(4, n, 4, 0.9))] }] },
    { id: 'koto', name: '琴', inst: 'koto', volume: -6, sends: { reverb: 0.3 }, clips: [{ at: 0, notes: ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6'].map((n, i) => N(3 + i * 0.16, n, 1, 0.6)) }] },
    { id: 'str', name: 'ストリングス', inst: 'strings', volume: -8, clips: [{ at: 0, notes: ['D4', 'F#4', 'A4'].map((n) => N(4, n, 4, 0.7)) }] },
    { id: 'bass', name: 'ベース', inst: 'subbass', volume: -8, clips: [{ at: 0, notes: [N(4, 'D2', 4, 0.8)] }] },
    { id: 'taiko', name: '太鼓', type: 'drums', kit: 'cinematic', volume: -3, clips: [{ at: 0, len: 8, grid: { kick: 'X.......X.......X...............', crash: '................X...............', tom1: '............xxXX................' } }] },
  ],
});
save('lose.json', {
  name: 'Make', bpm: 90, sig: [4, 4], bars: 2, tail: 2, key: 'D minor',
  sends: { reverb: { size: 1, decay: 1.8 } }, master: { loudness: -17, ceiling: -1 },
  tracks: [
    { id: 'brass', name: 'ブラス', inst: { preset: 'brass', vibrato: { rate: 5, depth: 0.35, delay: 0.3 } }, volume: -2, sends: { reverb: 0.2 }, clips: [{ at: 0, notes: [
      N(0, 'A3', 0.8, 0.7), N(1, 'G#3', 0.8, 0.65), N(2, 'G3', 0.8, 0.6), N(3, 'F#3', 3, 0.6)] }] },
    { id: 'taiko', name: '太鼓', type: 'drums', kit: 'cinematic', volume: -8, clips: [{ at: 0, len: 4, grid: { kick: '............X...' } }] },
  ],
});
save('catch.json', {
  name: 'Get', bpm: 140, sig: [4, 4], bars: 2, tail: 1.8, key: 'C major',
  sends: { reverb: { size: 0.9, decay: 1.5 } }, master: { loudness: -16, ceiling: -1 },
  tracks: [
    { id: 'mar', name: 'マリンバ', inst: 'marimba', volume: 0, sends: { reverb: 0.2 }, clips: [{ at: 0, notes: [
      N(0, 'C5', 0.25, 0.7), N(0.25, 'E5', 0.25, 0.7), N(0.5, 'G5', 0.25, 0.75), N(0.75, 'C6', 0.5, 0.8), N(1.5, 'G5', 0.25, 0.6), N(1.75, 'C6', 1.5, 0.85)] }] },
    { id: 'glock', name: 'グロッケン', inst: 'glock', volume: -8, sends: { reverb: 0.4 }, clips: [{ at: 0, notes: [N(1.75, 'E6', 1.5, 0.6), N(1.75, 'G6', 1.5, 0.5)] }] },
    { id: 'pizz', name: 'ピチカート', inst: 'pizz', volume: -6, clips: [{ at: 0, notes: ['C4', 'E4', 'G4'].map((n) => N(1.75, n, 1, 0.7)) }] },
  ],
});
