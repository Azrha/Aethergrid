type MoodProfile = {
  baseFreq: number;
  driftFreq: number;
  filterFreq: number;
  filterQ: number;
  gain: number;
  noiseGain: number;
  shimmer?: boolean;
};

const MOODS: Record<string, MoodProfile> = {
  living: { baseFreq: 180, driftFreq: 0.12, filterFreq: 1200, filterQ: 0.8, gain: 0.08, noiseGain: 0.03 },
  fantasy: { baseFreq: 240, driftFreq: 0.2, filterFreq: 1800, filterQ: 1.2, gain: 0.07, noiseGain: 0.02, shimmer: true },
  dino: { baseFreq: 110, driftFreq: 0.08, filterFreq: 900, filterQ: 0.6, gain: 0.09, noiseGain: 0.035 },
  space: { baseFreq: 70, driftFreq: 0.05, filterFreq: 600, filterQ: 0.4, gain: 0.06, noiseGain: 0.015 },
};

export class AmbientAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private tone: OscillatorNode | null = null;
  private drift: OscillatorNode | null = null;
  private driftGain: GainNode | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private shimmer: OscillatorNode | null = null;
  private shimmerGain: GainNode | null = null;
  private enabled = false;

  async enable(themeId: string, volume: number) {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = volume;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    this.enabled = true;
    this.applyTheme(themeId);
    this.setVolume(volume);
  }

  disable() {
    this.enabled = false;
    this.stopSources();
  }

  setVolume(value: number) {
    if (this.master) {
      this.master.gain.value = value;
    }
  }

  applyTheme(themeId: string) {
    if (!this.enabled || !this.context || !this.master) return;
    const profile = MOODS[themeId] || MOODS.living;
    this.stopSources();

    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = profile.filterFreq;
    filter.Q.value = profile.filterQ;
    filter.connect(this.master);
    this.filter = filter;

    const tone = this.context.createOscillator();
    tone.type = "sine";
    tone.frequency.value = profile.baseFreq;
    const toneGain = this.context.createGain();
    toneGain.gain.value = profile.gain;
    tone.connect(toneGain);
    toneGain.connect(filter);
    tone.start();
    this.tone = tone;

    const drift = this.context.createOscillator();
    drift.type = "sine";
    drift.frequency.value = profile.driftFreq;
    const driftGain = this.context.createGain();
    driftGain.gain.value = profile.baseFreq * 0.08;
    drift.connect(driftGain);
    driftGain.connect(tone.frequency);
    drift.start();
    this.drift = drift;
    this.driftGain = driftGain;

    const noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.6;
    }
    const noise = this.context.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseGain = this.context.createGain();
    noiseGain.gain.value = profile.noiseGain;
    noise.connect(noiseGain);
    noiseGain.connect(filter);
    noise.start();
    this.noise = noise;
    this.noiseGain = noiseGain;

    if (profile.shimmer) {
      const shimmer = this.context.createOscillator();
      shimmer.type = "triangle";
      shimmer.frequency.value = profile.baseFreq * 2.2;
      const shimmerGain = this.context.createGain();
      shimmerGain.gain.value = 0.02;
      shimmer.connect(shimmerGain);
      shimmerGain.connect(filter);
      shimmer.start();
      this.shimmer = shimmer;
      this.shimmerGain = shimmerGain;
    }
  }

  private stopSources() {
    this.tone?.stop();
    this.drift?.stop();
    this.noise?.stop();
    this.shimmer?.stop();
    this.tone = null;
    this.drift = null;
    this.noise = null;
    this.shimmer = null;
    this.driftGain = null;
    this.noiseGain = null;
    this.shimmerGain = null;
  }
}
