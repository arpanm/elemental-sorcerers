class SoundController {
  private ctx: AudioContext | null = null;
  private masterVolume = 0.6;
  private sfxVolume = 0.8;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setVolumes(master: number, sfx: number) {
    this.masterVolume = Math.max(0, Math.min(1, master));
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
  }

  public playTone(
    freq: number,
    duration = 0.18,
    type: OscillatorType = 'sine',
    slideFreq?: number
  ) {
    const ctx = this.ensureContext();
    if (!ctx || this.masterVolume <= 0 || this.sfxVolume <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideFreq), now + duration);
    }

    const peak = 0.16 * this.masterVolume * this.sfxVolume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  public playGather() {
    this.playTone(320, 0.1, 'triangle', 480);
  }

  public playAttack() {
    this.playTone(210, 0.14, 'sawtooth', 95);
  }

  public playElement(element: string) {
    switch (element) {
      case 'fire':
        this.playTone(260, 0.28, 'sawtooth', 520);
        break;
      case 'water':
        this.playTone(440, 0.3, 'sine', 660);
        break;
      case 'wind':
        this.playTone(580, 0.25, 'triangle', 880);
        break;
      case 'ice':
        this.playTone(720, 0.25, 'sine', 420);
        break;
      case 'earth':
        this.playTone(130, 0.35, 'square', 75);
        break;
      default:
        this.playTone(300, 0.2, 'sine');
    }
  }

  public playTameSuccess() {
    this.playTone(440, 0.15, 'sine', 554);
    setTimeout(() => this.playTone(659, 0.28, 'sine', 880), 140);
  }

  public playOwlWarning() {
    this.playTone(290, 0.25, 'sine', 240);
    setTimeout(() => this.playTone(270, 0.38, 'sine', 210), 280);
  }

  public playDeerWarning() {
    this.playTone(520, 0.3, 'sawtooth', 310);
    setTimeout(() => this.playTone(620, 0.35, 'sawtooth', 260), 220);
  }

  public playRaidHorn() {
    this.playTone(165, 0.55, 'sawtooth', 145);
  }

  public playPenaltyWarning() {
    this.playTone(140, 0.3, 'square', 90);
  }
}

export const soundFX = new SoundController();
