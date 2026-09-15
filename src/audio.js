const MELODIES = {
  jump: [330, 490],
  treat: [880, 1320],
  key: [523, 659, 784, 1046],
  checkpoint: [392, 523, 659],
  hurt: [220, 165, 110],
  stomp: [196, 392],
  start: [330, 440, 554, 660],
  "level-complete": [523, 659, 784, 1046, 1318],
  "game-over": [330, 294, 247, 196],
  won: [523, 659, 784, 1046, 784, 1046, 1318],
};

export class Sound {
  constructor() {
    this.Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    this.context = null;
    this.enabled = false;
  }

  async enable() {
    if (!this.Context) throw new Error("Web Audio is not supported in this browser.");
    this.context ??= new this.Context();
    await this.context.resume();
    this.enabled = true;
  }

  async unlock() {
    if (this.enabled && this.context?.state === "suspended") await this.context.resume();
  }

  play(type) {
    if (!this.enabled || this.context?.state !== "running") return;
    const notes = MELODIES[type];
    if (!notes) return;
    const duration = type === "jump" || type === "treat" ? 0.055 : 0.085;
    for (const [index, frequency] of notes.entries()) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const at = this.context.currentTime + index * duration;
      oscillator.type = type === "hurt" ? "triangle" : "square";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.025, at + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, at + duration + 0.025);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.035);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }
}
