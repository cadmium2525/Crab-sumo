// DOM UI ヘルパー
import { SPECIES, grade, overallPower } from './data.js';
import { crabThumbnail } from './crab.js';

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return e;
}

const $ = (id) => document.getElementById(id);

let toastTimer = null;
export function toast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// 中央の大きな文字
let bigTimer = null;
export function bigText(msg, { ms = 1400, cls = '' } = {}) {
  const b = $('bigtext');
  b.className = 'show ' + cls;
  b.textContent = msg;
  // 再生し直す
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(bigTimer);
  if (ms > 0) bigTimer = setTimeout(() => { b.className = ''; }, ms);
}
export function hideBigText() { $('bigtext').className = ''; }

const modalStack = [];
export function modal(content, { title = '', closable = true, wide = false, onClose = null } = {}) {
  const root = $('modal-root');
  const box = el('div', { class: 'modal' + (wide ? ' wide' : '') });
  const back = el('div', { class: 'modal-back' }, box);
  const close = () => {
    if (!back.parentNode) return;
    back.classList.add('closing');
    setTimeout(() => back.remove(), 160);
    const i = modalStack.indexOf(close); if (i >= 0) modalStack.splice(i, 1);
    onClose && onClose();
  };
  if (title) box.appendChild(el('h2', {}, title));
  if (closable) {
    box.appendChild(el('button', { class: 'modal-x', onclick: close, 'aria-label': '閉じる' }, '×'));
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  }
  const body = el('div', { class: 'modal-body' });
  if (typeof content === 'function') content(body, close); else body.appendChild(content);
  box.appendChild(body);
  root.appendChild(back);
  modalStack.push(close);
  return close;
}
export function closeAllModals() { [...modalStack].forEach((c) => c()); }
export function anyModalOpen() { return modalStack.length > 0; }

export function confirmBox(msg, { yes = 'はい', no = 'いいえ' } = {}) {
  return new Promise((res) => {
    let done = false;
    const close = modal((b, cl) => {
      b.appendChild(el('p', { class: 'msg' }, msg));
      b.appendChild(el('div', { class: 'row' },
        el('button', { class: 'btn primary', onclick: () => { done = true; cl(); res(true); } }, yes),
        el('button', { class: 'btn', onclick: () => { done = true; cl(); res(false); } }, no)));
    }, { onClose: () => { if (!done) res(false); } });
    return close;
  });
}

export function promptBox(msg, value = '') {
  return new Promise((res) => {
    let done = false;
    modal((b, cl) => {
      b.appendChild(el('p', { class: 'msg' }, msg));
      const inp = el('input', { class: 'text', value, maxlength: 10 });
      b.appendChild(inp);
      b.appendChild(el('div', { class: 'row' },
        el('button', { class: 'btn primary', onclick: () => { done = true; cl(); res(inp.value.trim()); } }, '決定'),
        el('button', { class: 'btn', onclick: () => { done = true; cl(); res(null); } }, 'やめる')));
      setTimeout(() => inp.focus(), 50);
    }, { onClose: () => { if (!done) res(null); } });
  });
}

export function sayBox(name, text, color = '#a06030') {
  return new Promise((res) => {
    modal((b, cl) => {
      b.appendChild(el('div', { class: 'say' },
        el('div', { class: 'say-name', style: `background:${color}` }, name),
        el('p', {}, text)));
      b.appendChild(el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => cl() }, 'つぎへ')));
    }, { closable: true, onClose: () => res() });
  });
}

const STAT_LABEL = { power: '力', guard: '踏ん張り', stamina: '根性', agility: '素早さ', temper: '気性' };

export function statBars(stats) {
  return el('div', { class: 'stats' }, Object.entries(STAT_LABEL).map(([k, label]) => {
    const v = stats[k];
    return el('div', { class: 'stat' },
      el('span', { class: 'stat-l' }, label),
      el('span', { class: 'stat-bar' }, el('i', { style: `width:${Math.min(100, v / 12 * 100)}%` })),
      el('span', { class: 'stat-g g' + grade(v) }, grade(v)));
  }));
}

export function crabCard(crab, { compact = false, extra = null, onclick = null, selected = false } = {}) {
  const sp = SPECIES[crab.species];
  const sexMark = crab.sex === 'm' ? '♂' : '♀';
  const img = el('img', { class: 'thumb', alt: sp.name, src: crabThumbnail(crab, compact ? 120 : 180) });
  const head = el('div', { class: 'card-head' },
    el('div', { class: 'card-name' }, crab.name, el('span', { class: 'sex ' + crab.sex }, sexMark)),
    el('div', { class: 'card-sp' }, sp.name + (crab.morph ? `（${crab.morph}）` : ''), crab.monster ? el('span', { class: 'tag gold' }, '大物') : null),
    el('div', { class: 'card-meta' }, `甲幅 ${crab.size.toFixed(1)}cm ・ ${crab.trait}`),
  );
  const card = el('div', { class: 'card' + (compact ? ' compact' : '') + (selected ? ' selected' : ''), onclick },
    img, el('div', { class: 'card-info' }, head,
      compact ? el('div', { class: 'card-mini' },
        el('span', {}, `強さ ${overallPower(crab)}`),
        el('span', {}, `調子 ${Math.round(crab.condition)}`),
        el('span', {}, `${crab.wins}勝${crab.losses}敗`))
        : el('div', {}, statBars(crab.stats),
          el('div', { class: 'card-mini' },
            el('span', {}, `強さ ${overallPower(crab)}`),
            el('span', {}, `調子 ${Math.round(crab.condition)}`),
            el('span', {}, `${crab.wins}勝${crab.losses}敗`))),
      extra));
  return card;
}

export function setHud(html) { $('hud-info').innerHTML = html; }
export function setActions(buttons) {
  const a = $('actions');
  a.innerHTML = '';
  for (const b of buttons) {
    if (!b) continue;
    a.appendChild(el('button', { class: 'btn ' + (b.cls || ''), onclick: b.onclick, disabled: b.disabled ? '' : null, id: b.id || null }, b.label));
  }
}
