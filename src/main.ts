import './styles.css';
import { AssetManager } from './core/AssetManager';
import { Audio } from './core/Audio';
import { EventBus } from './core/EventBus';
import { GameView } from './core/GameView';
import { Input } from './core/Input';
import { Loop } from './core/Loop';
import { SceneManager } from './core/SceneManager';
import type { Scene } from './core/SceneManager';
import type { GameEvents } from './game/events';
import { LoadingScene } from './game/scenes/LoadingScene';
import { MenuScene } from './game/scenes/MenuScene';
import { LevelSelectScene } from './game/scenes/LevelSelectScene';
import { ResultScene } from './game/scenes/ResultScene';
import { GameScene } from './game/scenes/GameScene';
import { GalleryScene } from './game/scenes/GalleryScene';
import { LEVELS } from './game/content';
import { debugFromUrl } from './game/debug';
import type { DebugShotConfig } from './game/debug';
import { save } from './game/save';

const stage = document.getElementById('stage');
const canvas = document.getElementById('game') as HTMLCanvasElement | null;
const ui = document.getElementById('ui');
if (!stage || !canvas || !ui) throw new Error('index.html is missing #stage/#game/#ui');

const view = new GameView(stage, canvas, ui);
const events = new EventBus<GameEvents>();
const input = new Input(canvas);
const assets = new AssetManager();
const audio = new Audio();

const data = save.load();
audio.setSettings(data.audio);
document.body.classList.toggle('high-contrast', data.highContrast);
// Tablet / touch layout: larger targets, condensed-but-equivalent HUD.
if (window.matchMedia('(pointer: coarse)').matches) {
  document.body.classList.add('touch-mode');
}

/** Deterministic screenshot/perf boot (never part of normal play). */
function buildShotScene(shot: DebugShotConfig): Scene<GameEvents> {
  switch (shot.scene) {
    case 'menu':
      return new MenuScene(shot.t);
    case 'levelselect':
      return new LevelSelectScene(shot.t);
    case 'gallery':
      return new GalleryScene(shot.galleryGroup, shot.t);
    case 'result-win':
      return new ResultScene(LEVELS[0]!, true, shot.stats ?? { kills: 42, sun: 825, time: 74 }, shot.t);
    case 'result-lose':
      return new ResultScene(LEVELS[0]!, false, shot.stats ?? { kills: 7, sun: 150, time: 41 }, shot.t);
    case 'game': {
      const level = LEVELS[Math.min(Math.max(shot.level, 0), LEVELS.length - 1)]!;
      return new GameScene(level, shot.seed, {
        fixedT: shot.t,
        forcedTier: shot.tier,
        reducedMotion: shot.reducedMotion,
        plants: shot.plants,
        zombies: shot.zombies,
        wallnutHpFrac: shot.wallnutHpFrac,
        cherryFuse: shot.cherryFuse,
      });
    }
  }
}

const loop = new Loop(
  (dt) => sm.update(dt),
  (alpha) => sm.render(alpha),
);
const sm = new SceneManager<GameEvents>({ view, events, input, assets, audio, loop });

loop.onFrame = () => input.endFrame();
window.addEventListener('pointerdown', () => audio.ensure());
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'escape' || k === 'p') {
    if (loop.paused) sm.setPaused(false);
    else if (sm.current()?.name === 'game') sm.setPaused(true);
  }
});
window.addEventListener('resize', () => {
  view.resize();
  sm.onResize();
});

// Gameplay-critical bundle loads before the menu can appear.
const shot = debugFromUrl();
if (shot) {
  document.body.classList.add('debug-shot');
  if (shot.highContrast) document.body.classList.add('high-contrast');
  if (shot.muted) audio.setMuted(true);
}
sm.push(shot ? new LoadingScene(buildShotScene(shot)) : new LoadingScene());
loop.start();
