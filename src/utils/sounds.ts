let audioCtx: AudioContext | null = null;
let sfxEnabled = true;
let currentTrackId = 'off';

// ── Beat Track Definitions ────────────────────────────────────────────────────
export type TrackId = 'off' | '90s' | 'chill' | 'hype' | 'lofi';

export const TRACKS: { id: TrackId; label: string; emoji: string }[] = [
  { id: 'off',   label: 'Off',      emoji: '🔇' },
  { id: '90s',   label: '90s Beat', emoji: '🎵' },
  { id: 'chill', label: 'Chill',    emoji: '🌊' },
  { id: 'hype',  label: 'Hype',     emoji: '🔥' },
  { id: 'lofi',  label: 'Lo-Fi',    emoji: '☕' },
];

interface TrackDef { bpm: number; kick: number[]; snare: number[]; hat: number[]; bass: number[]; }

const TRACK_DEFS: Record<Exclude<TrackId,'off'>, TrackDef> = {
  '90s': {
    bpm: 92,
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
    bass:  [55,0,0,0, 0,0,49,0, 0,0,55,0, 0,0,0,0],
  },
  chill: {
    bpm: 72,
    kick:  [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    bass:  [41,0,0,0, 0,0,0,0, 36,0,0,0, 0,0,0,0],
  },
  hype: {
    bpm: 115,
    kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0],
    snare: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
    hat:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    bass:  [55,0,55,0, 0,0,49,0, 55,0,0,0, 62,0,0,0],
  },
  lofi: {
    bpm: 78,
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 0,1,0,0, 0,0,0,0, 0,1,0,0],
    hat:   [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0],
    bass:  [36,0,0,0, 0,0,41,0, 0,0,36,0, 0,0,0,0],
  },
};

// ── Beat Loop State ───────────────────────────────────────────────────────────
let loopRunning = false;
let loopSchedulerId: ReturnType<typeof setTimeout> | null = null;
let loopStep = 0;
let activeTrackDef: TrackDef | null = null;

function beatKick(ctx: AudioContext, t: number, vol = 0.5) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.start(t); o.stop(t + 0.18);
}

function beatSnare(ctx: AudioContext, t: number, vol = 0.22) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.14), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.7;
  const g = ctx.createGain();
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.start(t); src.stop(t + 0.14);
}

function beatHat(ctx: AudioContext, t: number, vol = 0.07) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 9000;
  const g = ctx.createGain();
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
  src.start(t); src.stop(t + 0.04);
}

function beatBass(ctx: AudioContext, t: number, freq: number, vol = 0.18) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o.start(t); o.stop(t + 0.24);
}

function scheduleBeat() {
  if (!loopRunning || !activeTrackDef) return;
  const ctx = getCtx();
  const t = ctx.currentTime;
  const tr = activeTrackDef;
  const vol = currentTrackId === 'hype' ? 0.6 : currentTrackId === 'chill' || currentTrackId === 'lofi' ? 0.32 : 0.5;
  const hatVol = currentTrackId === 'hype' ? 0.05 : currentTrackId === 'lofi' ? 0.04 : 0.07;
  if (tr.kick[loopStep])  beatKick(ctx, t, vol);
  if (tr.snare[loopStep]) beatSnare(ctx, t, vol * 0.44);
  if (tr.hat[loopStep])   beatHat(ctx, t, hatVol);
  if (tr.bass[loopStep])  beatBass(ctx, t, tr.bass[loopStep], vol * 0.36);
  loopStep = (loopStep + 1) % 16;
  const stepS = (60 / tr.bpm) / 4;
  loopSchedulerId = setTimeout(scheduleBeat, stepS * 1000);
}
// ─────────────────────────────────────────────────────────────────────────────

// Auto-unlock AudioContext on ANY user interaction - keep listeners alive to handle re-suspension
// iOS Safari requires playing a sound DURING the touch event to unlock audio
let audioUnlocked = false;
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    // Play a silent sound to fully unlock on iOS
    if (!audioUnlocked && audioCtx.state === 'running') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.001; // Nearly silent
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.01);
      audioUnlocked = true;
    }
  };
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('touchend', unlock, { passive: true });
  window.addEventListener('click', unlock, { passive: true });
}

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  // Always try to resume if suspended (e.g. after switching apps on mobile)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, delay = 0) {
  if (typeof window === 'undefined' || !sfxEnabled) return;
  const ctx = getCtx();
  const play = () => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + dur);
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(play);
  } else {
    play();
  }
}

export const sounds = {
  click() {
    tone(600, 0.06, 'sine', 0.15);
  },

  // Whoosh swipe effect - very soft and gentle like wiping
  swipe() {
    if (typeof window === 'undefined' || !sfxEnabled) return;
    const ctx = getCtx();
    const play = () => {
      const dur = 0.22; // Shorter duration
      const now = ctx.currentTime;

      // Very soft filtered noise - gentle wiping sound
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      
      // Lower frequency filter for softer sound
      const lpf = ctx.createBiquadFilter(); 
      lpf.type = 'lowpass'; 
      lpf.frequency.setValueAtTime(800, now); // Lower start frequency
      lpf.frequency.exponentialRampToValueAtTime(200, now + dur);
      lpf.Q.value = 0.3; // Very low Q = extra smooth
      
      // Very gentle volume envelope
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.04); // Much softer
      gain.gain.linearRampToValueAtTime(0.04, now + dur * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      
      src.connect(lpf); lpf.connect(gain); gain.connect(ctx.destination);
      src.start(now); src.stop(now + dur);

      // Very subtle low tone for body
      const osc = ctx.createOscillator(); 
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now); // Lower frequency
      osc.frequency.exponentialRampToValueAtTime(60, now + dur * 0.8);
      oscGain.gain.setValueAtTime(0.0, now);
      oscGain.gain.linearRampToValueAtTime(0.025, now + 0.03); // Much quieter
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.6);
      osc.connect(oscGain); oscGain.connect(ctx.destination);
      osc.start(now); osc.stop(now + dur);
    };
    if (ctx.state === 'suspended') ctx.resume().then(play); else play();
  },

  // Correct answer - satisfying chime with harmonics
  correct() {
    // Main melody ascending
    tone(523,  0.15, 'sine', 0.20, 0.00);   // C5
    tone(659,  0.15, 'sine', 0.20, 0.10);   // E5
    tone(784,  0.15, 'sine', 0.20, 0.20);   // G5
    tone(1046, 0.35, 'sine', 0.22, 0.30);   // C6 - hold
    // Octave harmonics underneath for richness
    tone(262,  0.12, 'sine', 0.08, 0.00);
    tone(330,  0.12, 'sine', 0.08, 0.10);
    tone(392,  0.12, 'sine', 0.08, 0.20);
    tone(523,  0.30, 'sine', 0.10, 0.30);
    // Sparkle on top
    tone(2093, 0.08, 'sine', 0.06, 0.28);
    tone(2093, 0.12, 'sine', 0.05, 0.36);
  },

  // Wrong answer - descending buzz
  wrong() {
    tone(280, 0.12, 'square', 0.12, 0);
    tone(180, 0.25, 'square', 0.12, 0.1);
  },

  // Coins earned - bright ding ding ding
  coins() {
    tone(1046, 0.07, 'sine', 0.22, 0);
    tone(1318, 0.07, 'sine', 0.22, 0.08);
    tone(1568, 0.14, 'sine', 0.22, 0.16);
  },

  // Bonus claim - victory fanfare
  claim() {
    tone(523, 0.1, 'sine', 0.22, 0);
    tone(659, 0.1, 'sine', 0.22, 0.12);
    tone(784, 0.1, 'sine', 0.22, 0.24);
    tone(1046, 0.3, 'sine', 0.28, 0.36);
  },

  // Countdown beep - n=3 low, n=2 mid, n=1 high shrill
  countdown(n: number = 3) {
    const freqs: Record<number, number> = { 3: 330, 2: 523, 1: 880 };
    const freq = freqs[n] ?? 440;
    tone(freq, 0.12, 'sine', 0.22);
  },

  // GO! - punchy upward fanfare
  go() {
    tone(659, 0.07, 'sine', 0.28, 0);
    tone(784, 0.07, 'sine', 0.28, 0.07);
    tone(1046, 0.25, 'sine', 0.32, 0.14);
  },

  // Warning / Skip challenge - short soft double tap
  warning() {
    tone(480, 0.07, 'sine', 0.14, 0);
    tone(400, 0.09, 'sine', 0.12, 0.12);
  },

  // Modal open - soft pop
  modalOpen() {
    tone(400, 0.06, 'sine', 0.12, 0);
    tone(600, 0.1, 'sine', 0.12, 0.05);
  },

  // Error / not enough funds
  error() {
    tone(240, 0.12, 'sawtooth', 0.15, 0);
    tone(180, 0.28, 'sawtooth', 0.12, 0.12);
  },

  setTrack(id: TrackId) {
    if (typeof window === 'undefined') return;
    // Stop current loop
    loopRunning = false;
    if (loopSchedulerId !== null) { clearTimeout(loopSchedulerId); loopSchedulerId = null; }
    currentTrackId = id;
    if (id === 'off') { activeTrackDef = null; return; }
    activeTrackDef = TRACK_DEFS[id];
    loopRunning = true;
    loopStep = 0;
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().then(scheduleBeat); else scheduleBeat();
  },

  getTrack(): TrackId { return currentTrackId as TrackId; },

  startLoop() {
    if (typeof window === 'undefined') return;
    if (currentTrackId === 'off') currentTrackId = '90s';
    activeTrackDef = TRACK_DEFS[currentTrackId as Exclude<TrackId,'off'>];
    if (loopRunning) return;
    loopRunning = true;
    loopStep = 0;
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume().then(scheduleBeat); else scheduleBeat();
  },

  stopLoop() {
    loopRunning = false;
    currentTrackId = 'off';
    activeTrackDef = null;
    if (loopSchedulerId !== null) { clearTimeout(loopSchedulerId); loopSchedulerId = null; }
  },

  isLoopRunning() { return loopRunning; },

  getSfx() { return sfxEnabled; },
  setSfx(val: boolean) { sfxEnabled = val; },

  // Difficulty selection - easy=low, medium=mid, hard=high shrill
  difficultyEasy() {
    tone(330, 0.12, 'sine', 0.2, 0);
    tone(392, 0.15, 'sine', 0.18, 0.1);
  },
  difficultyMedium() {
    tone(523, 0.08, 'sine', 0.2, 0);
    tone(659, 0.08, 'sine', 0.2, 0.08);
    tone(784, 0.15, 'sine', 0.2, 0.16);
  },
  difficultyHard() {
    tone(880, 0.07, 'sine', 0.22, 0);
    tone(1100, 0.07, 'sine', 0.22, 0.07);
    tone(1320, 0.07, 'sine', 0.22, 0.14);
    tone(1568, 0.18, 'triangle', 0.25, 0.21);
  },
};
