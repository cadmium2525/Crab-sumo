import * as THREE from 'three';
import { createRenderer } from './env.js';
import * as Save from './save.js';
import * as Audio from './audio.js';
import { TankScene } from './scenes/tank.js';
import { FieldScene } from './scenes/field.js';
import { SumoScene } from './scenes/sumo.js';
import { closeAllModals, setActions, setHud, sayBox } from './ui.js';

const SCENES = { tank: TankScene, field: FieldScene, sumo: SumoScene };

class App {
  constructor() {
    this.canvas = document.getElementById('view');
    this.renderer = createRenderer(this.canvas);
    this.state = Save.load() || Save.newState();
    this.scene = null;
    this.clock = new THREE.Clock();
    this.fade = document.createElement('div');
    this.fade.className = 'fade-black';
    document.body.appendChild(this.fade);
    Audio.setEnabled(this.state.sound !== false);
    this.initInput();
    window.addEventListener('resize', () => this.resize());
    const sb = document.getElementById('btn-sound');
    const syncSound = () => sb.classList.toggle('off', this.state.sound === false);
    syncSound();
    sb.addEventListener('click', () => {
      this.state.sound = this.state.sound === false;
      Audio.setEnabled(this.state.sound);
      Audio.unlock();
      syncSound();
      this.save();
    });
  }

  save() { Save.save(this.state); }

  initInput() {
    let down = null;
    const ndc = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      Audio.unlock();
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.scene?.onPointerDown?.(ndc(e), e);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      this.scene?.onPointerMove?.(ndc(e), e);
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 10 && performance.now() - down.t < 700) this.scene?.onClick?.(ndc(e), e);
      down = null;
    });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.scene?.resize?.(w, h);
  }

  async goto(name, opts = {}) {
    if (this.transitioning) return;
    this.transitioning = true;
    if (this.scene) {
      this.fade.classList.add('on');
      await new Promise((r) => setTimeout(r, 360));
    }
    closeAllModals();
    setActions([]);
    setHud('');
    document.getElementById('side').innerHTML = '';
    if (this.scene) { this.scene.dispose(); this.scene = null; }
    this.renderer.setRenderTarget(null);
    const S = SCENES[name];
    this.scene = new S(this, opts);
    this.scene.resize?.(window.innerWidth, window.innerHeight);
    // 最初のフレームでシェーダーをコンパイル
    this.renderer.compile(this.scene.scene, this.scene.camera);
    this.fade.classList.remove('on');
    this.transitioning = false;
    this.scene.enter?.();
  }

  loop() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.scene) {
      this.scene.update(dt);
      this.renderer.render(this.scene.scene, this.scene.camera);
    }
    requestAnimationFrame(() => this.loop());
  }
}

const app = new App();
window.__app = app;

async function boot() {
  await app.goto('tank', { titleMode: true });
  app.loop();
  const loading = document.getElementById('loading');
  loading.classList.add('hide');
  setTimeout(() => loading.remove(), 600);
  const title = document.getElementById('title');
  const start = async () => {
    Audio.unlock();
    title.classList.add('hide');
    setTimeout(() => title.remove(), 700);
    if (!app.state.introSeen) {
      app.state.introSeen = true;
      app.save();
      await sayBox('ぼく', '夏休み。海と川にはさまれた、おじいちゃんの家にやってきた。\n縁側には、からっぽの水槽がひとつ置いてある。', '#2f6f8f');
      await sayBox('おじいちゃん', 'このあたりの子らは、夏になると「カニ相撲」で遊ぶんじゃ。\n川や海でカニをつかまえて、水槽で育ててごらん。水槽には5匹まで入るぞ。', '#7a5a3a');
      await sayBox('おじいちゃん', '川は石をひっくり返して手づかみ。海の大物はカゴ罠じゃな。\n相撲の前は、指でカニの背中を押して気合を入れてやるんじゃよ。押しすぎると怒ってはさまれるがの。', '#7a5a3a');
    }
    app.scene?.exitTitle?.();
  };
  document.getElementById('btn-start').addEventListener('click', start);
  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (app.state.crabs.length || app.state.day > 1) {
      if (!confirm('セーブデータを消して、さいしょから始めますか？')) return;
    }
    Save.clearSave();
    app.state = Save.newState();
    start();
  });
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('loading').innerHTML = '<p style="padding:20px">読み込みに失敗しました。<br>WebGLに対応したブラウザで開いてください。<br><small>' + String(e && e.message || e) + '</small></p>';
});
