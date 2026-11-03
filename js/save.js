// セーブデータ（localStorage）
const KEY = 'sumo-club-save-v1';

export function newState() {
  return {
    version: 1,
    day: 1,
    slot: 0,
    crabs: [],
    capacity: 5,
    trapCount: 2,
    traps: [],          // { loc, spot, bait, placedT }
    beaten: {},         // rivalId: true
    zukan: {},          // speciesId: { count, maxSize, sample }
    fedDay: 0,
    title: null,
    record: { wins: 0, losses: 0 },
    introSeen: false,
    summerEndSeen: false,
    sound: true,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return { ...newState(), ...s };
  } catch (e) {
    return null;
  }
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 保存できない環境では無視 */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
}

export function timeIndex(state) { return (state.day - 1) * 4 + state.slot; }

export function advanceTime(state, slots = 1) {
  for (let i = 0; i < slots; i++) {
    state.slot++;
    if (state.slot > 3) { state.slot = 0; state.day++; }
    for (const c of state.crabs) c.condition = Math.min(100, (c.condition ?? 100) + 14);
  }
}

export function dateLabel(state) {
  if (state.day <= 31) return `8月${state.day}日`;
  const d = state.day - 31;
  return d <= 30 ? `9月${d}日` : `${state.day}日目`;
}

export function registerZukan(state, crab) {
  const z = state.zukan[crab.species] || { count: 0, maxSize: 0, sample: null };
  z.count++;
  if (crab.size > z.maxSize) { z.maxSize = crab.size; z.sample = { ...crab, id: 'z_' + crab.species + '_' + crab.size }; }
  state.zukan[crab.species] = z;
}
