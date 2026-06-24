// Lightweight chime via Web Audio API — no external file
let _ctx = null;
const ctx = () => {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
  }
  return _ctx;
};

export function playWelcomeChime() {
  const ac = ctx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume();

  const now = ac.currentTime;
  const notes = [
    { f: 880, t: 0.0, d: 0.18 },   // A5
    { f: 1320, t: 0.12, d: 0.18 }, // E6
    { f: 1760, t: 0.24, d: 0.28 }, // A6
  ];

  const master = ac.createGain();
  master.gain.value = 0.0001;
  master.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  master.connect(ac.destination);

  notes.forEach(({ f, t, d }) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.5, now + t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
    osc.connect(g).connect(master);
    osc.start(now + t);
    osc.stop(now + t + d + 0.02);
  });

  // soft sparkle tail
  const noise = ac.createOscillator();
  const ng = ac.createGain();
  noise.type = "sine";
  noise.frequency.setValueAtTime(2200, now + 0.3);
  noise.frequency.exponentialRampToValueAtTime(3200, now + 0.55);
  ng.gain.value = 0.0001;
  ng.gain.exponentialRampToValueAtTime(0.08, now + 0.32);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  noise.connect(ng).connect(master);
  noise.start(now + 0.28);
  noise.stop(now + 0.62);
}
