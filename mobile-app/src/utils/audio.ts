/**
 * Web Audio API & HTML5 Audio alert ringtone player
 * Plays loud ringing alert sound repeatedly until stopped
 */

let activeAudioElement: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let isRinging = false;
let ringIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start ringing loud alert sound
 */
export function startAlertRingtone(): void {
  if (isRinging) return;
  isRinging = true;

  /* 1. Try HTML5 Audio player with public sound asset */
  try {
    if (!activeAudioElement) {
      activeAudioElement = new Audio('/sounds/incoming_call.wav');
      activeAudioElement.loop = true;
    }
    activeAudioElement.currentTime = 0;
    const playPromise = activeAudioElement.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        /* Fall back to Web Audio API synthesizer if browser blocks autoplay */
        startSynthesizedRingtone();
      });
    }
  } catch {
    startSynthesizedRingtone();
  }

  /* 2. Also start Web Audio API synthesized bell for guaranteed loud audio output */
  startSynthesizedRingtone();
}

/**
 * Stop ringing alert sound
 */
export function stopAlertRingtone(): void {
  isRinging = false;

  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      /* ignore */
    }
  }

  if (ringIntervalId) {
    clearInterval(ringIntervalId);
    ringIntervalId = null;
  }

  if (audioContext && audioContext.state !== 'closed') {
    try {
      void audioContext.close();
    } catch {
      /* ignore */
    }
    audioContext = null;
  }
}

/**
 * Synthesize loud dual-frequency telephone bell ring using Web Audio API
 */
function startSynthesizedRingtone(): void {
  if (ringIntervalId) return;

  const playRingBurst = () => {
    if (!isRinging) return;
    try {
      if (!audioContext || audioContext.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContext = new AudioCtx();
      }

      if (audioContext.state === 'suspended') {
        void audioContext.resume();
      }

      const now = audioContext.currentTime;

      // Primary tone: 440 Hz + 480 Hz (standard telephone ring)
      const osc1 = audioContext.createOscillator();
      const osc2 = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      // Tremor (bell clapper 20Hz modulation)
      const tremolo = audioContext.createOscillator();
      const tremoloGain = audioContext.createGain();
      tremolo.frequency.setValueAtTime(20, now);
      tremoloGain.gain.setValueAtTime(0.5, now);

      tremolo.connect(gain.gain);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioContext.destination);

      // Envelope: 1.6 second ring burst with soft decay
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

      osc1.start(now);
      osc2.start(now);
      tremolo.start(now);

      osc1.stop(now + 1.6);
      osc2.stop(now + 1.6);
      tremolo.stop(now + 1.6);
    } catch {
      /* ignore audio context restrictions */
    }
  };

  playRingBurst();
  ringIntervalId = setInterval(playRingBurst, 3000);
}
