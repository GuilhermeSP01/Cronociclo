import { KeepAwake } from '@capacitor-community/keep-awake';

class WakeLockService {
  constructor() {
    this.webWakeLock = null;
    this.shouldKeepAwake = false;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.shouldKeepAwake) {
        this.acquire();
      }
    });
  }

  async acquire() {
    this.shouldKeepAwake = true;
    try {
      await KeepAwake.keepAwake();
    } catch {
      // Fallback para Web Screen Wake Lock API
      if ('wakeLock' in navigator && !this.webWakeLock) {
        try {
          this.webWakeLock = await navigator.wakeLock.request('screen');
          this.webWakeLock.addEventListener('release', () => {
            this.webWakeLock = null;
          });
        } catch {
          // Permissão recusada ou bateria baixa
        }
      }
    }
  }

  async release() {
    this.shouldKeepAwake = false;
    try {
      await KeepAwake.allowSleep();
    } catch {
      // Ignora erro se não estiver em ambiente nativo
    }
    if (this.webWakeLock) {
      try {
        await this.webWakeLock.release();
      } catch {
        // Ignora
      }
      this.webWakeLock = null;
    }
  }
}

export const wakeLock = new WakeLockService();
