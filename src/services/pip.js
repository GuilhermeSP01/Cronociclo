class PipService {
  constructor() {
    this.isInPip = false;

    window.addEventListener('cronociclo:pip', (e) => {
      const active = Boolean(e.detail && e.detail.active);
      this.setPipMode(active);
    });

    window.addEventListener('resize', () => {
      const isTinyViewport = window.innerHeight > 0 && window.innerHeight <= 340;
      if (isTinyViewport !== this.isInPip) {
        this.setPipMode(isTinyViewport);
      }
    });
  }

  setPipMode(active) {
    this.isInPip = active;
    document.body.classList.toggle('is-pip', active);
  }

  setTimerRunning(running) {
    try {
      if (
        window.CronocicloNative &&
        typeof window.CronocicloNative.setTimerRunning === 'function'
      ) {
        window.CronocicloNative.setTimerRunning(Boolean(running));
      }
    } catch {
      // Ignora em navegadores web comuns
    }
  }
}

export const pipService = new PipService();
