import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

class SoundHapticsService {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
  }

  /**
   * Desbloqueia o AudioContext no primeiro toque do usuário (exigência iOS/Android WebView).
   */
  unlockAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  playTone(freq, durationMs, delayMs = 0, type = 'sine', gainValue = 0.25) {
    if (this.isMuted) return;
    this.unlockAudio();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime + delayMs / 1000;
    const durationSec = durationMs / 1000;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  /**
   * Bipe curto nos últimos 3 segundos (3, 2, 1)
   */
  triggerCountdownTick() {
    this.playTone(660, 95, 0, 'triangle', 0.22);
    this.vibrateLight();
  }

  /**
   * Som e vibração ao iniciar fase de Atividade
   */
  triggerActivityStart() {
    this.playTone(587.33, 130, 0, 'sine', 0.3);    // D5
    this.playTone(880.0, 260, 140, 'sine', 0.35);  // A5
    this.vibrateMedium([120, 60, 180]);
  }

  /**
   * Som e vibração ao iniciar fase de Descanso
   */
  triggerRestStart() {
    this.playTone(659.25, 140, 0, 'sine', 0.28);   // E5
    this.playTone(440.0, 260, 150, 'sine', 0.28);  // A4
    this.vibrateMedium([200]);
  }

  /**
   * Som e vibração ao concluir todo o ciclo programado
   */
  triggerCycleComplete() {
    this.playTone(523.25, 130, 0, 'triangle', 0.3);    // C5
    this.playTone(659.25, 130, 130, 'triangle', 0.3);  // E5
    this.playTone(783.99, 130, 260, 'triangle', 0.3);  // G5
    this.playTone(1046.5, 420, 390, 'triangle', 0.36); // C6
    this.vibrateSuccess();
  }

  /**
   * Feedback tátil sutil para roleta/botões
   */
  triggerWheelTick() {
    if (this.isMuted) return;
    try {
      Haptics.selectionChanged().catch(() => {});
    } catch {
      // Silencioso em navegadores desktop
    }
  }

  async vibrateLight() {
    if (this.isMuted) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      if (navigator.vibrate) navigator.vibrate(40);
    }
  }

  async vibrateMedium(fallbackPattern = [150]) {
    if (this.isMuted) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      if (navigator.vibrate) navigator.vibrate(fallbackPattern);
    }
  }

  async vibrateSuccess() {
    if (this.isMuted) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      if (navigator.vibrate) navigator.vibrate([150, 80, 150, 80, 300]);
    }
  }
}

export const soundHaptics = new SoundHapticsService();
