import type { GameState } from '../state';
import type { LevelDef, PlantKind } from '../content';
import { PLANTS } from '../content';
import { drawIcon } from '../render/painters';

export interface HUDHandlers {
  onSelect(kind: PlantKind): void;
  onShovel(): void;
  onPause(): void;
  onMute(): void;
}

/**
 * DOM overlay HUD, positioned in game-pixel coordinates by the
 * #ui-inner scale transform. Updated from GameState each frame.
 */
export class HUD {
  private root: HTMLDivElement;
  private sunValue: HTMLElement;
  private cards = new Map<PlantKind, { el: HTMLButtonElement; cost: HTMLElement; recharge: HTMLElement }>();
  private shovelBtn: HTMLButtonElement;
  private muteBtn: HTMLButtonElement;
  private progressFill: HTMLElement;
  private lastSun = -1;
  private lastPhase = '';

  constructor(
    uiInner: HTMLElement,
    level: LevelDef,
    state: GameState,
    handlers: HUDHandlers,
    waveTimes: number[],
    totalTime: number,
    muted: boolean,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud';

    // Sun counter
    const sunBox = document.createElement('div');
    sunBox.className = 'sun-counter';
    const sunIcon = document.createElement('span');
    sunIcon.className = 'sun-icon';
    sunIcon.textContent = '☀';
    this.sunValue = document.createElement('span');
    this.sunValue.className = 'sun-value';
    this.sunValue.textContent = String(state.sun);
    sunBox.append(sunIcon, this.sunValue);
    this.root.appendChild(sunBox);

    // Seed bank
    const bank = document.createElement('div');
    bank.className = 'seedbank';
    level.allowedPlants.forEach((kind, i) => {
      const def = PLANTS[kind];
      const card = document.createElement('button');
      card.className = 'seed-card';
      card.title = def.name + ' — ' + def.cost + ' sun' + (def.produces ? ' (produces sun)' : def.shoots ? ' (shoots peas)' : def.bomb ? ' (explodes)' : ' (blocks)');
      const icon = document.createElement('canvas');
      icon.width = 44;
      icon.height = 44;
      const ictx = icon.getContext('2d')!;
      ictx.save();
      ictx.translate(22, 24);
      ictx.scale(1.15, 1.15);
      drawIcon(ictx, kind);
      ictx.restore();
      const cost = document.createElement('span');
      cost.className = 'cost';
      cost.textContent = String(def.cost);
      const recharge = document.createElement('div');
      recharge.className = 'recharge';
      recharge.style.height = '0%';
      const hotkey = document.createElement('span');
      hotkey.className = 'hotkey';
      hotkey.textContent = String(i + 1);
      card.append(icon, cost, recharge, hotkey);
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onSelect(kind);
      });
      bank.appendChild(card);
      this.cards.set(kind, { el: card, cost, recharge });
    });
    this.root.appendChild(bank);

    // Shovel
    this.shovelBtn = document.createElement('button');
    this.shovelBtn.className = 'tool-btn';
    this.shovelBtn.title = 'Shovel (S): dig up a plant';
    this.shovelBtn.textContent = '🪏';
    this.shovelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onShovel();
    });
    this.root.appendChild(this.shovelBtn);

    // Pause
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'tool-btn';
    pauseBtn.title = 'Pause (Esc)';
    pauseBtn.textContent = '⏸';
    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onPause();
    });
    this.root.appendChild(pauseBtn);

    // Mute
    this.muteBtn = document.createElement('button');
    this.muteBtn.className = 'tool-btn';
    this.muteBtn.title = 'Toggle sound';
    this.muteBtn.textContent = muted ? '🔇' : '🔊';
    this.muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onMute();
    });
    this.root.appendChild(this.muteBtn);

    uiInner.appendChild(this.root);

    // Progress bar
    const progress = document.createElement('div');
    progress.className = 'progress';
    this.progressFill = document.createElement('div');
    this.progressFill.className = 'fill';
    progress.appendChild(this.progressFill);
    for (const wt of waveTimes) {
      const flag = document.createElement('div');
      flag.className = 'flag';
      flag.style.left = ((wt / totalTime) * 100).toFixed(2) + '%';
      progress.appendChild(flag);
    }
    uiInner.appendChild(progress);
  }

  update(state: GameState): void {
    if (state.sun !== this.lastSun) {
      this.lastSun = state.sun;
      this.sunValue.textContent = String(state.sun);
    }
    for (const [kind, c] of this.cards) {
      const def = PLANTS[kind];
      const recharging = state.recharges[kind] > 0;
      const affordable = state.sun >= def.cost;
      const disabled = recharging || !affordable;
      c.el.classList.toggle('disabled', disabled);
      c.el.classList.toggle('selected', state.selected === kind && !disabled);
      c.recharge.style.height = recharging
        ? Math.min(100, (state.recharges[kind] / def.recharge) * 100).toFixed(1) + '%'
        : '0%';
    }
    this.shovelBtn.classList.toggle('selected', state.shovel);
    const phase = state.phase;
    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
    }
  }

  setProgress(fraction: number): void {
    this.progressFill.style.width = Math.min(100, Math.max(0, fraction * 100)).toFixed(2) + '%';
  }

  setMuted(muted: boolean): void {
    this.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  showBanner(text: string): void {
    const old = this.root.parentElement?.querySelector('.banner');
    old?.remove();
    const b = document.createElement('div');
    b.className = 'banner';
    b.textContent = text;
    this.root.parentElement?.appendChild(b);
    window.setTimeout(() => b.remove(), 2400);
  }

  destroy(): void {
    const parent = this.root.parentElement;
    this.root.remove();
    parent?.querySelector('.progress')?.remove();
    parent?.querySelector('.banner')?.remove();
  }
}
