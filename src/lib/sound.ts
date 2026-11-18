// Web Audio API Synthesizer for high-fidelity networking sound effects (0KB external assets)

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      audioCtx = new Ctor();
    }
  }
  return audioCtx;
}

/**
 * Check if audio context is available and resume if suspended by browser autoplay policy
 */
function ensureContext(): AudioContext | null {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

/**
 * Soft futuristic chirp on packet send, receive, or drop
 */
export function playPacketBlip(type: 'send' | 'receive' | 'drop' | 'error' = 'send') {
  try {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'drop' || type === 'error') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } else {
      osc.type = 'sine';
      const freq = type === 'send' ? 760 : 1020;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + 0.035);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch {
    // Gracefully ignore audio errors (e.g. user interaction required)
  }
}

/**
 * Tactile metallic RJ-45 / SFP latch click-snap sound when cabling ports
 */
export function playCableConnectSound() {
  try {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Dual-click micro-transient simulating plastic latch snapping into metal jack
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1800, now);
    osc1.frequency.exponentialRampToValueAtTime(450, now + 0.015);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(2400, now + 0.012);
    osc2.frequency.exponentialRampToValueAtTime(800, now + 0.028);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.02);
    osc2.start(now + 0.01);
    osc2.stop(now + 0.035);
  } catch {
    // Ignore audio errors
  }
}

/**
 * Tactile unplug click sound when removing or disconnecting a link
 */
export function playCableDisconnectSound() {
  try {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // Ignore audio errors
  }
}

/**
 * Exhilarating 3-tone victory chime (C5 -> E5 -> G5) when a Break-It Challenge is solved!
 */
export function playChallengeSuccessSound() {
  try {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.11;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, startTime + 0.22);

      gain.gain.setValueAtTime(0.06, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  } catch {
    // Ignore audio errors
  }
}

/**
 * Gentle descending 2-tone diagnostic sound when a verification check fails
 */
export function playChallengeFailSound() {
  try {
    const ctx = ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 311.13]; // A4 -> Eb4 (tritone dissonance)

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.12;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.05, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  } catch {
    // Ignore audio errors
  }
}
