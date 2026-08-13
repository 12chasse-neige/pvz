import './styles.css';
import { AssetManager } from './core/AssetManager';
import { Audio } from './core/Audio';
import { EventBus } from './core/EventBus';
import { GameView } from './core/GameView';
import { Input } from './core/Input';
import { Loop } from './core/Loop';
import { SceneManager } from './core/SceneManager';
import type { GameEvents } from './game/events';
import { MenuScene } from './game/scenes/MenuScene';
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
audio.setMuted(save.load().muted);

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

sm.push(new MenuScene());
loop.start();
