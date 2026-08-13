/**
 * Procedural sound effects via WebAudio (no audio assets needed).
 * The AudioContext is created lazily on the first user gesture and
 * resumed if the browser suspends it.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
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
      this.master.gain.value = this._muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this._muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.01);
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return;
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
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
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
    src.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  // ---- game SFX ----
  shoot(): void {
    this.tone(900, 0.07, 'square', 0.12, 500);
  }
  frozenShoot(): void {
    this.tone(1300, 0.07, 'triangle', 0.12, 900);
  }
  chomp(): void {
    this.tone(160, 0.09, 'sawtooth', 0.16, 80);
  }
  plant(): void {
    this.tone(280, 0.1, 'triangle', 0.18, 520);
  }
  dig(): void {
    this.tone(420, 0.08, 'triangle', 0.14, 180);
  }
  sun(): void {
    this.tone(1100, 0.12, 'sine', 0.14, 1500);
  }
  seedSelect(): void {
    this.tone(600, 0.05, 'square', 0.1, 700);
  }
  seedDenied(): void {
    this.tone(220, 0.09, 'square', 0.12, 140);
  }
  explosion(): void {
    this.noise(0.35, 0.3);
    this.tone(120, 0.4, 'sine', 0.3, 40);
  }
  mower(): void {
    this.noise(0.5, 0.2);
  }
  zombieGroan(): void {
    this.tone(90, 0.5, 'sawtooth', 0.08, 70);
    this.tone(112, 0.5, 'sawtooth', 0.06, 84);
  }
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, undefined, i * 0.13));
  }
  lose(): void {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.14, undefined, i * 0.22));
  }
}
