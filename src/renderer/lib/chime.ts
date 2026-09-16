let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(at: number, freq: number, duration: number, gain: number, type: OscillatorType = 'sine'): void {
  const ac = context();
  if (!ac) return;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(amp);
  amp.connect(ac.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

export function chimeRinging(): void {
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime;
  tone(t, 880, 0.09, 0.08);
  tone(t + 0.14, 880, 0.09, 0.08);
}

export function chimeConnected(): void {
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime;
  tone(t, 659, 0.12, 0.12);
  tone(t + 0.13, 988, 0.22, 0.12);
}

export function chimeDone(): void {
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime;
  tone(t, 523, 0.16, 0.06, 'triangle');
}
