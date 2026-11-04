// つかまえたカニの処理（キープ／逃がす／入れ替え）
import { el, modal, crabCard, toast } from './ui.js';
import { SPECIES } from './data.js';
import * as Save from './save.js';
import * as Audio from './audio.js';

export function catchFlow(app, crab, { how = 'hand' } = {}) {
  const s = app.state;
  const sp = SPECIES[crab.species];
  const isNew = !s.zukan[crab.species];
  Save.registerZukan(s, crab);
  app.save();
  Audio.jingle('catch');
  return new Promise((resolve) => {
    let done = false;
    const finish = (kept) => { if (done) return; done = true; app.save(); resolve(kept); };
    modal((b, close) => {
      b.appendChild(el('p', { class: 'msg', style: 'text-align:center;margin-bottom:8px' },
        how === 'trap' ? 'カゴに入っていた！' : 'つかまえた！',
        isNew ? el('span', { class: 'tag gold' }, '図鑑に登録') : null));
      b.appendChild(crabCard(crab));
      b.appendChild(el('p', { class: 'desc', style: 'margin-top:10px' }, sp.desc));
      const full = s.crabs.length >= s.capacity;
      if (full) b.appendChild(el('p', { class: 'help', style: 'text-align:center' }, `水槽がいっぱい（${s.crabs.length}/${s.capacity}）。入れ替えるか、逃がしてあげよう。`));
      b.appendChild(el('div', { class: 'row' },
        full
          ? el('button', { class: 'btn primary', onclick: () => { close(); swapFlow(app, crab).then(finish); } }, '入れ替える')
          : el('button', { class: 'btn primary', onclick: () => {
            s.crabs.push(crab);
            toast(`${crab.name}を水槽に入れた！`);
            close(); finish(true);
          } }, '水槽に入れる'),
        el('button', { class: 'btn', onclick: () => { close(); toast(`${crab.name}を逃がした`); finish(false); } }, '逃がす')));
    }, { title: crab.nushi ? `${sp.name}のヌシ！` : sp.name + (crab.monster ? '（大物！）' : ''), onClose: () => finish(false) });
  });
}

function swapFlow(app, crab) {
  const s = app.state;
  return new Promise((resolve) => {
    let done = false;
    modal((b, close) => {
      b.appendChild(el('p', { class: 'help' }, `どのカニと入れ替える？（選んだカニは逃がします）`));
      const list = el('div', { class: 'list' });
      for (const c of s.crabs) {
        list.appendChild(crabCard(c, { compact: true, onclick: () => {
          const i = s.crabs.indexOf(c);
          s.crabs.splice(i, 1, crab);
          toast(`${c.name}を逃がして、${crab.name}を水槽に入れた`);
          done = true; close(); resolve(true);
        } }));
      }
      b.appendChild(list);
    }, { title: '入れ替え', wide: true, onClose: () => { if (!done) { toast(`${crab.name}を逃がした`); resolve(false); } } });
  });
}
