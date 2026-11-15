import type { GameSnapshot, PhysicsSoundEvent } from './types';

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Dynamic stadium crowd murmur nodes
  private crowdActive = false;
  private crowdLowSrc: AudioBufferSourceNode | null = null;
  private crowdMidSrc: AudioBufferSourceNode | null = null;
  private crowdLfo: OscillatorNode | null = null;
  private crowdLowGain: GainNode | null = null;
  private crowdMidGain: GainNode | null = null;
  private crowdMidFilter: BiquadFilterNode | null = null;
  private crowdExcitement = 0.18;
  private crowdGoalBoostUntil = 0;

  private _muted = false;

  public get muted(): boolean {
    return this._muted;
  }

  public set muted(val: boolean) {
    this._muted = val;
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(val ? 0 : 0.9, now, 0.04);
    }
    if (val) {
      this.stopCrowdAmbience();
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;

      const master = ctx.createGain();
      master.gain.value = this._muted ? 0 : 0.9;
      master.connect(compressor).connect(ctx.destination);
      this.masterGain = master;

      this.noiseBuffer = this.buildPinkNoiseBuffer(ctx, 0.45);
    }
    return this.ctx;
  }

  // Generate warm pink-weighted noise buffer for organic acoustic textures (leather, breath)
  private buildPinkNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = Math.max(-1, Math.min(1, pink * 0.11));
    }

    // Crossfade start & end 80ms for click-free looping
    const fadeSamples = Math.min(Math.floor(ctx.sampleRate * 0.08), Math.floor(length / 4));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const tailIdx = length - fadeSamples + i;
      const mixed = data[i] * t + data[tailIdx] * (1 - t);
      data[i] = mixed;
    }

    return buffer;
  }

  public get isReady(): boolean {
    return Boolean(this.ctx && this.ctx.state === 'running');
  }

  public unlock(): void {
    if (this.ctx && this.ctx.state === 'running') return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  // Stadium crowd murmur disabled per user preference
  public startCrowdAmbience(): void {
    this.stopCrowdAmbience();
  }

  public stopCrowdAmbience(): void {
    if (!this.crowdActive || !this.ctx) return;
    this.crowdActive = false;
    const now = this.ctx.currentTime;

    const lowSrc = this.crowdLowSrc;
    const midSrc = this.crowdMidSrc;
    const lfo = this.crowdLfo;
    const lowGain = this.crowdLowGain;
    const midGain = this.crowdMidGain;

    this.crowdLowSrc = null;
    this.crowdMidSrc = null;
    this.crowdLfo = null;
    this.crowdLowGain = null;
    this.crowdMidGain = null;
    this.crowdMidFilter = null;

    if (lowGain) {
      lowGain.gain.cancelScheduledValues(now);
      lowGain.gain.setTargetAtTime(0.0001, now, 0.08);
    }
    if (midGain) {
      midGain.gain.cancelScheduledValues(now);
      midGain.gain.setTargetAtTime(0.0001, now, 0.08);
    }

    setTimeout(() => {
      try {
        lowSrc?.stop();
        midSrc?.stop();
        lfo?.stop();
      } catch {
        // Ignore already stopped sources
      }
    }, 320);
  }

  public updateCrowdFromSnapshot(_snap: GameSnapshot): void {
    // Crowd ambience turned off
  }

  public play(event: PhysicsSoundEvent): void {
    if (this._muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    switch (event) {
      case 'kick': {
        this.playBallKick(ctx, this.masterGain, now);
        break;
      }
      case 'wall': {
        this.playBarrierThud(ctx, this.masterGain, now);
        break;
      }
      case 'post': {
        this.playGoalpostClang(ctx, this.masterGain, now);
        break;
      }
      case 'whistle': {
        this.playRefereeWhistle(ctx, this.masterGain, now, 0.34);
        break;
      }
      case 'goal': {
        this.crowdGoalBoostUntil = performance.now() + 2200;
        this.playGoalCrowdCheer(ctx, this.masterGain, now);
        break;
      }
      case 'countdown_tick': {
        this.playStopwatchTick(ctx, this.masterGain, now);
        break;
      }
    }
  }

  // Acoustic soccer ball kick: air-cavity low punch + crisp leather contact slap
  private playBallKick(ctx: AudioContext, dest: AudioNode, now: number): void {
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(125, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(46, now + 0.085);
    bodyGain.gain.setValueAtTime(0.42, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    bodyOsc.connect(bodyGain).connect(dest);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.1);

    if (this.noiseBuffer) {
      const slap = ctx.createBufferSource();
      slap.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1150, now);
      bp.Q.setValueAtTime(1.1, now);
      const slapGain = ctx.createGain();
      slapGain.gain.setValueAtTime(0.32, now);
      slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
      slap.connect(bp).connect(slapGain).connect(dest);
      slap.start(now, Math.random() * 0.35, 0.04);
    }
  }

  // Soft padded pitch barrier / board thud
  private playBarrierThud(ctx: AudioContext, dest: AudioNode, now: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(88, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.06);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.07);

    if (this.noiseBuffer) {
      const thud = ctx.createBufferSource();
      thud.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(360, now);
      const tGain = ctx.createGain();
      tGain.gain.setValueAtTime(0.14, now);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      thud.connect(lp).connect(tGain).connect(dest);
      thud.start(now, Math.random() * 0.35, 0.06);
    }
  }

  // Hollow aluminum/steel goalpost clang: transient ball impact + inharmonic metallic overtones
  private playGoalpostClang(ctx: AudioContext, dest: AudioNode, now: number): void {
    // 1. Leather-on-metal impact transient
    if (this.noiseBuffer) {
      const impact = ctx.createBufferSource();
      impact.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600, now);
      bp.Q.setValueAtTime(0.9, now);
      const impGain = ctx.createGain();
      impGain.gain.setValueAtTime(0.36, now);
      impGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      impact.connect(bp).connect(impGain).connect(dest);
      impact.start(now, Math.random() * 0.35, 0.05);
    }

    // 2. Hollow steel cylinder resonant modes (inharmonic partials for real metal clang)
    const partials = [
      { freq: 392, gain: 0.22, decay: 0.42 },
      { freq: 658, gain: 0.16, decay: 0.34 },
      { freq: 1084, gain: 0.11, decay: 0.24 },
      { freq: 1645, gain: 0.06, decay: 0.16 },
    ];

    for (const p of partials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(p.gain, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0008, now + p.decay);
      osc.connect(g).connect(dest);
      osc.start(now);
      osc.stop(now + p.decay + 0.02);
    }
  }

  // Realistic Fox-40 / pea-whistle referee whistle: dual detuned resonant chambers + breath air + pea trill
  private playRefereeWhistle(ctx: AudioContext, dest: AudioNode, now: number, duration: number): void {
    const whistleOut = ctx.createGain();
    whistleOut.gain.setValueAtTime(0.001, now);
    whistleOut.gain.linearRampToValueAtTime(0.18, now + 0.022);
    whistleOut.gain.setValueAtTime(0.16, now + duration - 0.05);
    whistleOut.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    whistleOut.connect(dest);

    // Dual whistle chamber tones (natural acoustic beating)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(2680, now);
    osc1.frequency.linearRampToValueAtTime(2810, now + 0.04);
    osc1.frequency.setValueAtTime(2785, now + duration - 0.05);
    osc1.frequency.linearRampToValueAtTime(2590, now + duration);

    osc2.frequency.setValueAtTime(2815, now);
    osc2.frequency.linearRampToValueAtTime(2950, now + 0.04);
    osc2.frequency.setValueAtTime(2920, now + duration - 0.05);
    osc2.frequency.linearRampToValueAtTime(2720, now + duration);

    // Pea-ball 32 Hz flutter modulation
    const trill = ctx.createOscillator();
    const trillFreqDepth = ctx.createGain();
    const trillAmpDepth = ctx.createGain();
    trill.type = 'sine';
    trill.frequency.setValueAtTime(33, now);
    trillFreqDepth.gain.setValueAtTime(42, now);
    trillAmpDepth.gain.setValueAtTime(0.055, now);

    trill.connect(trillFreqDepth);
    trillFreqDepth.connect(osc1.frequency);
    trillFreqDepth.connect(osc2.frequency);
    trill.connect(trillAmpDepth).connect(whistleOut.gain);

    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    g1.gain.value = 0.55;
    g2.gain.value = 0.45;
    osc1.connect(g1).connect(whistleOut);
    osc2.connect(g2).connect(whistleOut);

    // Airy breath rush component
    if (this.noiseBuffer) {
      const air = ctx.createBufferSource();
      air.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3200, now);
      bp.Q.setValueAtTime(1.6, now);
      const airGain = ctx.createGain();
      airGain.gain.setValueAtTime(0.28, now);
      air.connect(bp).connect(airGain).connect(whistleOut);
      air.start(now, Math.random() * 0.15, Math.min(0.28, duration + 0.02));
    }

    trill.start(now);
    osc1.start(now);
    osc2.start(now);
    trill.stop(now + duration + 0.02);
    osc1.stop(now + duration + 0.02);
    osc2.stop(now + duration + 0.02);
  }

  // Crisp celebratory double referee goal whistle (no background crowd murmur)
  private playGoalCrowdCheer(ctx: AudioContext, dest: AudioNode, now: number): void {
    this.playRefereeWhistle(ctx, dest, now + 0.02, 0.22);
    this.playRefereeWhistle(ctx, dest, now + 0.28, 0.34);
  }

  // Subtle acoustic stopwatch / stadium clock pulse for final 10 seconds
  private playStopwatchTick(ctx: AudioContext, dest: AudioNode, now: number): void {
    if (this.noiseBuffer) {
      const click = ctx.createBufferSource();
      click.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1450, now);
      bp.Q.setValueAtTime(3.2, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
      click.connect(bp).connect(gain).connect(dest);
      click.start(now, Math.random() * 0.35, 0.045);
    }
  }
}

export const soundManager = new SoundManager();
