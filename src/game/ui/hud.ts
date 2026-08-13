import type { AssetManager } from '../../core/AssetManager';
import type { GameState } from '../state';
import type { LevelDef, PlantKind } from '../content';
import { PLANTS } from '../content';
import { drawSeedPortrait, drawToolIcon } from './icons';
import type { ToolIconKind } from './icons';

export interface HUDHandlers {
  onSelect(kind: PlantKind): void;
  onShovel(): void;
  onPause(): void;
  onMute(): void;
}

/**
 * DOM overlay HUD in the garden-tool style: painted wood bar, paper seed
 * packets with portraits, cost badges, recharge veils with last-second
 * countdowns, a lawn-path wave bar and painted tool icons. All controls
 * are ≥ 44 CSS px, keyboard-focusable and aria-labelled.
 */
export class HUD {
  private root: HTMLDivElement;
  private sunValue: HTMLElement;
  private cards = new Map<PlantKind, { el: HTMLButtonElement; recharge: HTMLElement; countdown: HTMLElement; badge: HTMLElement; portrait: HTMLCanvasElement }>();
  private shovelBtn: HTMLButtonElement;
  private muteBtn: HTMLButtonElement;
  private progressFill: HTMLElement;
  private lastSun = -1;
  private readonly assets: AssetManager;

  constructor(
    uiInner: HTMLElement,
    assets: AssetManager,
    level: LevelDef,
    state: GameState,
    handlers: HUDHandlers,
    waveTimes: number[],
    totalTime: number,
    muted: boolean,
  ) {
    this.assets = assets;
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.setAttribute('role', 'toolbar');
    this.root.setAttribute('aria-label', 'Game controls');

    // ---- sun counter ----
    const sunBox = document.createElement('div');
    sunBox.className = 'sun-counter';
    sunBox.setAttribute('aria-label', 'Sun balance');
    const sunIcon = this.makeIcon(assets, 'sun', 30);
    sunIcon.className = 'sun-icon-canvas';
    this.sunValue = document.createElement('span');
    this.sunValue.className = 'sun-value';
    this.sunValue.textContent = String(state.sun);
    sunBox.append(sunIcon, this.sunValue);
    this.root.appendChild(sunBox);

    // ---- seed bank ----
    const bank = document.createElement('div');
    bank.className = 'seedbank';
    level.allowedPlants.forEach((kind, i) => {
      const def = PLANTS[kind];
      const card = document.createElement('button');
      card.className = 'seed-card';
      card.setAttribute('aria-label', def.name + ', costs ' + def.cost + ' sun, hotkey ' + (i + 1));
      const paper = document.createElement('div');
      paper.className = 'packet';
      const portrait = document.createElement('canvas');
      portrait.width = 48;
      portrait.height = 56;
      const pctx = portrait.getContext('2d')!;
      drawSeedPortrait(pctx, assets, kind);
      const name = document.createElement('span');
      name.className = 'packet-name';
      name.textContent = def.name;
      const badge = document.createElement('span');
      badge.className = 'cost-badge';
      badge.textContent = String(def.cost);
      const recharge = document.createElement('div');
      recharge.className = 'recharge';
      recharge.style.height = '0%';
      const countdown = document.createElement('div');
      countdown.className = 'recharge-count';
      const hotkey = document.createElement('span');
      hotkey.className = 'hotkey';
      hotkey.textContent = String(i + 1);
      paper.append(portrait, name, badge, recharge, countdown, hotkey);
      card.appendChild(paper);
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onSelect(kind);
      });
      bank.appendChild(card);
      this.cards.set(kind, { el: card, recharge, countdown, badge, portrait });
    });
    this.root.appendChild(bank);

    // ---- tools ----
    this.shovelBtn = this.makeToolButton(assets, 'shovel', 'Shovel (S): dig up a plant', () => handlers.onShovel());
    const pauseBtn = this.makeToolButton(assets, 'pause', 'Pause (Esc)', () => handlers.onPause());
    this.muteBtn = this.makeToolButton(assets, muted ? 'sound-off' : 'sound-on', 'Toggle sound', () => handlers.onMute());
    this.root.append(this.shovelBtn, pauseBtn, this.muteBtn);

    uiInner.appendChild(this.root);

    // ---- wave bar (lawn path) ----
    const progress = document.createElement('div');
    progress.className = 'progress';
    progress.setAttribute('aria-hidden', 'true');
    this.progressFill = document.createElement('div');
    this.progressFill.className = 'fill';
    progress.appendChild(this.progressFill);
    waveTimes.forEach((wt, i) => {
      const flag = level.waves[i]?.flag;
      const marker = document.createElement('div');
      marker.className = 'wave-marker' + (flag ? ' flag-wave' : '');
      marker.style.left = ((wt / totalTime) * 100).toFixed(2) + '%';
      const icon = this.makeIcon(assets, flag ? 'flag' : 'zombie', flag ? 22 : 16);
      marker.appendChild(icon);
      progress.appendChild(marker);
    });
    const now = document.createElement('div');
    now.className = 'now-marker';
    progress.appendChild(now);
    uiInner.appendChild(progress);
  }

  private makeIcon(assets: AssetManager, kind: ToolIconKind, size: number): HTMLCanvasElement {
    const icon = document.createElement('canvas');
    icon.width = size * 2;
    icon.height = size * 2;
    const ictx = icon.getContext('2d')!;
    ictx.scale(2, 2);
    ictx.translate(size / 2, size / 2);
    drawToolIcon(ictx, assets, kind);
    return icon;
  }

  private makeToolButton(assets: AssetManager, kind: ToolIconKind, label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'tool-btn';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    const icon = this.makeIcon(assets, kind, 26);
    icon.className = 'tool-icon';
    btn.appendChild(icon);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  update(state: GameState): void {
    for (const [kind, c] of this.cards) {
      const def = PLANTS[kind];
      const recharging = state.recharges[kind] > 0;
      const affordable = state.sun >= def.cost;
      const disabled = recharging || !affordable;
      c.el.classList.toggle('disabled', disabled);
      c.el.classList.toggle('selected', state.selected === kind && !disabled);
      c.el.classList.toggle('unaffordable', !affordable && !recharging);
      c.badge.classList.toggle('badge-dim', !affordable);
      if (recharging) {
        c.recharge.style.height =
          Math.min(100, (state.recharges[kind] / def.recharge) * 100).toFixed(1) + '%';
        c.countdown.style.display = state.recharges[kind] < 3.5 ? 'block' : 'none';
        c.countdown.textContent = Math.ceil(state.recharges[kind]).toString();
      } else {
        c.recharge.style.height = '0%';
        c.countdown.style.display = 'none';
      }
    }
    this.shovelBtn.classList.toggle('selected', state.shovel);
  }

  setSun(value: number, pop = false): void {
    if (value === this.lastSun && !pop) return;
    this.lastSun = value;
    this.sunValue.textContent = String(value);
    if (pop) {
      this.sunValue.classList.remove('pop');
      void this.sunValue.offsetWidth; // restart the animation
      this.sunValue.classList.add('pop');
    }
  }

  setProgress(fraction: number): void {
    this.progressFill.style.width = Math.min(100, Math.max(0, fraction * 100)).toFixed(2) + '%';
  }

  setMuted(muted: boolean): void {
    const icon = this.muteBtn.querySelector('.tool-icon') as HTMLCanvasElement | null;
    if (!icon) return;
    const ictx = icon.getContext('2d')!;
    ictx.setTransform(1, 0, 0, 1, 0, 0);
    ictx.clearRect(0, 0, icon.width, icon.height);
    ictx.scale(2, 2);
    ictx.translate(13, 13);
    drawToolIcon(ictx, this.assets, muted ? 'sound-off' : 'sound-on');
  }

  showBanner(text: string, variant: 'info' | 'wave' = 'info'): void {
    const old = this.root.parentElement?.querySelector('.banner');
    old?.remove();
    const b = document.createElement('div');
    b.className = 'banner banner-' + variant;
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
