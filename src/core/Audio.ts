/**
 * Original Web Audio presentation: separate master/music/effects gains
 * with persisted settings, looping procedural music tracks (menu, game +
 * major-wave intensity layer), randomized SFX variations, and automatic
 * ducking when the tab is hidden. Everything is synthesized — no audio
 * files are imported or reused (see docs/CREDITS.md).
 */

export interface AudioSettings {
  muted: boolean;
  musicOn: boolean;
  effectsOn: boolean;
  /** Gains 0..1. */
  master: number;
  music: number;
  effects: number;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  musicOn: true,
  effectsOn: true,
  master: 0.8,
  music: 0.5,
  effects: 0.8,
};

type Wave = OscillatorType;

interface Step {
  /** Beat offset inside the loop. */
  at: number;
  dur: number;
  freq: number;
  type: Wave;
  vol: number;
  slideTo?: number;
}

interface Track {
  bpm: number;
  steps: Step[];
  intensity: Step[];
}

const C4 = 261.63;
const E4 = 329.63;
const G4 = 392.0;
const A4 = 440.0;
const B4 = 493.88;
const C5 = 523.25;
const E5 = 659.25;
const F4 = 349.23;
const C3 = 130.81;
const G2 = 98.0;
const A2 = 110.0;
const F2 = 87.31;
const D3 = 146.83;
const E3 = 164.81;

/** Original gentle garden waltz (3/4), menu. */
const MENU_TRACK: Track = {
  bpm: 92,
  steps: [
    // chord arpeggios + soft melody
    { at: 0, dur: 1.6, freq: C4, type: 'triangle', vol: 0.5 },
    { at: 0.75, dur: 1.6, freq: E4, type: 'triangle', vol: 0.45 },
    { at: 1.5, dur: 1.6, freq: G4, type: 'triangle', vol: 0.45 },
    { at: 2.25, dur: 1.2, freq: C5, type: 'sine', vol: 0.4 },
    { at: 3, dur: 1.6, freq: A2, type: 'triangle', vol: 0.5 },
    { at: 3.75, dur: 1.6, freq: E4, type: 'triangle', vol: 0.42 },
    { at: 4.5, dur: 1.6, freq: A4, type: 'triangle', vol: 0.42 },
    { at: 5.25, dur: 1.2, freq: E5, type: 'sine', vol: 0.36 },
    { at: 6, dur: 1.6, freq: F4, type: 'triangle', vol: 0.5 },
    { at: 6.75, dur: 1.6, freq: A4, type: 'triangle', vol: 0.42 },
    { at: 7.5, dur: 1.6, freq: C5, type: 'triangle', vol: 0.42 },
    { at: 8.25, dur: 1.2, freq: A4, type: 'sine', vol: 0.38 },
    { at: 9, dur: 1.6, freq: G2, type: 'triangle', vol: 0.5 },
    { at: 9.75, dur: 1.6, freq: D3, type: 'triangle', vol: 0.42 },
    { at: 10.5, dur: 1.6, freq: B4, type: 'triangle', vol: 0.42 },
    { at: 11.25, dur: 2.4, freq: G4, type: 'sine', vol: 0.4 },
    // bass
    { at: 0, dur: 3, freq: C3, type: 'sine', vol: 0.5 },
    { at: 3, dur: 3, freq: A2, type: 'sine', vol: 0.5 },
    { at: 6, dur: 3, freq: F2, type: 'sine', vol: 0.5 },
    { at: 9, dur: 3, freq: G2, type: 'sine', vol: 0.5 },
  ],
  intensity: [],
};

/** Original steady folk loop, gameplay. */
const GAME_TRACK: Track = {
  bpm: 100,
  steps: [
    { at: 0, dur: 1.6, freq: C4, type: 'triangle', vol: 0.4 },
    { at: 1, dur: 1.4, freq: E4, type: 'triangle', vol: 0.38 },
    { at: 2, dur: 1.6, freq: G4, type: 'triangle', vol: 0.38 },
    { at: 3, dur: 1.2, freq: E4, type: 'triangle', vol: 0.34 },
    { at: 4, dur: 1.6, freq: A2, type: 'triangle', vol: 0.4 },
    { at: 5, dur: 1.4, freq: E4, type: 'triangle', vol: 0.36 },
    { at: 6, dur: 1.6, freq: A4, type: 'triangle', vol: 0.36 },
    { at: 7, dur: 1.2, freq: C5, type: 'sine', vol: 0.3 },
    { at: 8, dur: 1.6, freq: F4, type: 'triangle', vol: 0.4 },
    { at: 9, dur: 1.4, freq: A4, type: 'triangle', vol: 0.36 },
    { at: 10, dur: 1.6, freq: C5, type: 'triangle', vol: 0.36 },
    { at: 11, dur: 1.2, freq: B4, type: 'sine', vol: 0.32 },
    { at: 12, dur: 1.6, freq: G2, type: 'triangle', vol: 0.4 },
    { at: 13, dur: 1.4, freq: D3, type: 'triangle', vol: 0.36 },
    { at: 14, dur: 1.6, freq: B4, type: 'triangle', vol: 0.36 },
    { at: 15, dur: 2.4, freq: G4, type: 'sine', vol: 0.36 },
    // bass
    { at: 0, dur: 2, freq: C3, type: 'sine', vol: 0.5 },
    { at: 2, dur: 2, freq: G2, type: 'sine', vol: 0.46 },
    { at: 4, dur: 2, freq: A2, type: 'sine', vol: 0.5 },
    { at: 6, dur: 2, freq: E3, type: 'sine', vol: 0.44 },
    { at: 8, dur: 2, freq: F2, type: 'sine', vol: 0.5 },
    { at: 10, dur: 2, freq: C3, type: 'sine', vol: 0.46 },
    { at: 12, dur: 2, freq: G2, type: 'sine', vol: 0.5 },
    { at: 14, dur: 2, freq: D3, type: 'sine', vol: 0.46 },
  ],
  // Major-wave intensity layer: driving bass + hats.
  intensity: [
    { at: 0, dur: 0.5, freq: C3, type: 'square', vol: 0.5 },
    { at: 0.5, dur: 0.5, freq: C3, type: 'square', vol: 0.42 },
    { at: 1, dur: 0.5, freq: G2, type: 'square', vol: 0.5 },
    { at: 1.5, dur: 0.5, freq: C3, type: 'square', vol: 0.42 },
    { at: 2, dur: 0.5, freq: A2, type: 'square', vol: 0.5 },
    { at: 2.5, dur: 0.5, freq: A2, type: 'square', vol: 0.42 },
    { at: 3, dur: 0.5, freq: E3, type: 'square', vol: 0.5 },
    { at: 3.5, dur: 0.5, freq: A2, type: 'square', vol: 0.42 },
  ],
};

const TRACKS: Record<string, Track> = { menu: MENU_TRACK, game: GAME_TRACK };

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private fxGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private intensityGain: GainNode | null = null;
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  private trackName: string | null = null;
  private nextLoopAt = 0;
  private scheduler = 0;
  private mowerOn = false;
  private mowerNoise: { stop: () => void } | null = null;
  private lastFootstepAt = 0;

  get muted(): boolean {
    return this.settings.muted;
  }

  /** Call from a user gesture at least once (idempotent). */
  ensure(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.fxGain = this.ctx.createGain();
      this.fxGain.connect(this.master);
      document.addEventListener('visibilitychange', () => this.onVisibility());
      this.applyGains();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setSettings(s: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...s };
    this.applyGains();
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  setMuted(m: boolean): void {
    this.setSettings({ muted: m });
  }

  private applyGains(): void {
    if (!this.ctx || !this.master || !this.musicGain || !this.fxGain) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.master, t, 0.02);
    this.musicGain.gain.setTargetAtTime(this.settings.musicOn ? this.settings.music : 0, t, 0.05);
    this.fxGain.gain.setTargetAtTime(this.settings.effectsOn ? this.settings.effects : 0, t, 0.02);
  }

  /* ---------------- music ---------------- */

  playMusic(trackName: string): void {
    this.ensure();
    if (!this.ctx || !this.musicGain || this.trackName === trackName) return;
    this.stopMusic();
    const track = TRACKS[trackName];
    if (!track) return;
    this.trackName = trackName;
    this.musicBus = this.ctx.createGain();
    this.intensityGain = this.ctx.createGain();
    this.intensityGain.gain.value = 0;
    this.intensityGain.connect(this.musicBus);
    this.musicBus.connect(this.musicGain);
    const beat = 60 / track.bpm;
    const loopLen = Math.max(...track.steps.map((s) => s.at + s.dur)) + beat;
    this.nextLoopAt = this.ctx.currentTime + 0.1;
    this.scheduler = window.setInterval(() => this.scheduleLoop(track, loopLen), 180);
    void this.scheduleLoop(track, loopLen);
  }

  stopMusic(): void {
    this.trackName = null;
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = 0;
    }
    if (this.musicBus && this.ctx) {
      this.musicBus.disconnect();
      this.musicBus = null;
      this.intensityGain = null;
    }
  }

  /** 0..1 — layers the major-wave intensity track under the base loop. */
  setIntensity(level: number): void {
    if (this.intensityGain && this.ctx) {
      this.intensityGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.4);
    }
  }

  private scheduleLoop(track: Track, loopLen: number): void {
    if (!this.ctx || !this.musicBus || !this.intensityGain) return;
    const horizon = this.ctx.currentTime + 0.7;
    while (this.nextLoopAt < horizon) {
      for (const s of track.steps) {
        this.step(this.nextLoopAt + s.at, s, this.musicBus);
      }
      for (const s of track.intensity) {
        this.step(this.nextLoopAt + s.at, s, this.intensityGain);
      }
      this.nextLoopAt += loopLen;
    }
  }

  private step(at: number, s: Step, bus: GainNode): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = s.type;
    osc.frequency.setValueAtTime(s.freq, at);
    if (s.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, s.slideTo), at + s.dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(s.vol, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + s.dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(at);
    osc.stop(at + s.dur + 0.05);
  }

  private onVisibility(): void {
    if (!this.ctx || !this.musicGain) return;
    const hidden = document.hidden;
    const base = this.settings.musicOn ? this.settings.music : 0;
    this.musicGain.gain.setTargetAtTime(hidden ? base * 0.25 : base, this.ctx.currentTime, 0.4);
  }

  /* ---------------- SFX ---------------- */

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.fxGain) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    }
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.fxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, delay = 0, lowpass = 0): void {
    if (!this.ctx || !this.fxGain) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    let head: AudioNode = src;
    if (lowpass > 0) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      src.connect(f);
      head = f;
    }
    head.connect(gain);
    gain.connect(this.fxGain);
    src.start(t0);
  }

  /** Small random detune so repeated SFX never sound identical. */
  private vary(v: number): number {
    return v * (0.92 + Math.random() * 0.16);
  }

  shoot(): void {
    const v = Math.random();
    this.tone(this.vary(900), 0.07, 'square', 0.12, 500);
    if (v < 0.4) this.tone(this.vary(1150), 0.05, 'triangle', 0.08, 650, 0.01);
  }
  frozenShoot(): void {
    this.tone(this.vary(1300), 0.07, 'triangle', 0.12, 900);
    this.noise(0.06, 0.05, 0, 3200);
  }
  chomp(): void {
    this.tone(this.vary(160), 0.09, 'sawtooth', 0.16, 80);
    this.noise(0.05, 0.06, 0, 900);
  }
  plant(): void {
    this.tone(280, 0.1, 'triangle', 0.18, 520);
    this.noise(0.07, 0.07, 0.02, 700);
  }
  dig(): void {
    this.tone(420, 0.08, 'triangle', 0.14, 180);
    this.noise(0.1, 0.08, 0, 500);
  }
  sun(): void {
    this.tone(this.vary(1100), 0.12, 'sine', 0.14, 1500);
    this.tone(this.vary(1650), 0.1, 'sine', 0.08, 2100, 0.04);
  }
  seedSelect(): void {
    this.tone(600, 0.05, 'square', 0.1, 700);
  }
  seedDenied(): void {
    this.tone(220, 0.09, 'square', 0.12, 140);
  }
  uiClick(): void {
    this.tone(760, 0.04, 'triangle', 0.1, 640);
  }
  explosion(): void {
    this.noise(0.35, 0.3, 0, 1200);
    this.tone(120, 0.4, 'sine', 0.3, 40);
    this.noise(0.15, 0.2, 0.05, 500);
  }
  mower(): void {
    this.noise(0.5, 0.2, 0, 800);
  }
  /** Soft footstep thud, globally throttled so hordes stay pleasant. */
  footstep(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastFootstepAt < 0.11) return;
    this.lastFootstepAt = now;
    this.noise(0.07, 0.05, 0, 700);
    this.tone(this.vary(120), 0.06, 'sine', 0.1, 60);
  }
  /** Pea impact pop. */
  impact(): void {
    this.tone(this.vary(520), 0.05, 'triangle', 0.12, 240);
    this.noise(0.04, 0.06, 0, 1600);
  }
  mowerStart(): void {
    this.ensure();
    if (!this.ctx || !this.fxGain || this.mowerOn) return;
    this.mowerOn = true;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 82;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 13;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 9;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    osc.connect(g);
    g.connect(this.fxGain);
    osc.start();
    lfo.start();
    this.mowerNoise = {
      stop: () => {
        g.gain.setTargetAtTime(0.0001, this.ctx!.currentTime, 0.1);
        osc.stop(this.ctx!.currentTime + 0.3);
        lfo.stop(this.ctx!.currentTime + 0.3);
      },
    };
  }
  mowerStop(): void {
    if (!this.mowerOn) return;
    this.mowerOn = false;
    this.mowerNoise?.stop();
    this.mowerNoise = null;
  }
  zombieGroan(): void {
    if (Math.random() < 0.5) {
      this.tone(90, 0.5, 'sawtooth', 0.08, 70);
      this.tone(112, 0.5, 'sawtooth', 0.06, 84);
    } else {
      this.tone(84, 0.42, 'sawtooth', 0.08, 64);
      this.tone(104, 0.4, 'sawtooth', 0.06, 92, 0.06);
    }
  }
  armorHit(): void {
    this.tone(this.vary(2200), 0.06, 'square', 0.1, 1400);
    this.tone(this.vary(620), 0.05, 'triangle', 0.09, 420, 0.02);
  }
  waveHorn(): void {
    this.tone(98, 0.7, 'sawtooth', 0.2, 92);
    this.tone(147, 0.7, 'sawtooth', 0.14, 139, 0.05);
    this.tone(196, 0.9, 'sawtooth', 0.12, 185, 0.1);
  }
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, undefined, i * 0.13));
    [262, 330, 392].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.12, undefined, i * 0.13));
  }
  lose(): void {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.14, undefined, i * 0.22));
  }
}
