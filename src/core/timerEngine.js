export const PHASES = {
  IDLE: 'IDLE',
  PREPARE: 'PREPARE',
  ACTIVITY: 'ACTIVITY',
  REST: 'REST',
  COMPLETED: 'COMPLETED'
};

export const PREPARE_DURATION_SECONDS = 5;

export class TimerEngine {
  /**
   * @param {Object} callbacks
   * @param {(state: Object) => void} callbacks.onTick
   * @param {(phase: string, session: number, totalSessions: number) => void} callbacks.onPhaseChange
   * @param {(secondRemaining: number) => void} callbacks.onCountdownBeep
   * @param {(summary: Object) => void} callbacks.onComplete
   */
  constructor({ onTick, onPhaseChange, onCountdownBeep, onComplete }) {
    this.onTick = onTick;
    this.onPhaseChange = onPhaseChange;
    this.onCountdownBeep = onCountdownBeep;
    this.onComplete = onComplete;

    this.phase = PHASES.IDLE;
    this.isPaused = false;

    this.activityDurationMs = 45000;
    this.restDurationMs = 15000;
    this.totalSessions = 4;
    this.currentSession = 1;

    this.phaseDurationMs = 0;
    this.remainingMs = 0;
    this.phaseEndTime = 0;
    this.lastBeepSecond = null;

    this.rafId = null;
    this.intervalId = null;

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  start({ activitySecondsTotal, restSecondsTotal, sessions }) {
    this.stopTimers();

    this.activityDurationMs = Math.max(1, activitySecondsTotal) * 1000;
    this.restDurationMs = Math.max(0, restSecondsTotal) * 1000;
    this.totalSessions = Math.max(1, sessions);
    this.currentSession = 1;
    this.isPaused = false;

    this.enterPhase(PHASES.PREPARE, PREPARE_DURATION_SECONDS * 1000, Date.now());
    this.startLoop();
  }

  enterPhase(nextPhase, durationMs, referenceNow = Date.now()) {
    this.phase = nextPhase;
    this.phaseDurationMs = durationMs;
    this.remainingMs = durationMs;
    this.phaseEndTime = referenceNow + durationMs;
    this.lastBeepSecond = null;

    if (this.onPhaseChange) {
      this.onPhaseChange(this.phase, this.currentSession, this.totalSessions);
    }
    this.emitTick();
  }

  startLoop() {
    this.stopTimers();
    // Intervalo de segurança para segundo plano + requestAnimationFrame para 60fps na UI
    this.intervalId = setInterval(() => this.update(), 100);
    const loop = () => {
      this.update();
      if (this.phase !== PHASES.IDLE && this.phase !== PHASES.COMPLETED && !this.isPaused) {
        this.rafId = requestAnimationFrame(loop);
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopTimers() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  handleVisibilityChange() {
    if (document.visibilityState === 'visible' && !this.isPaused && this.isRunning()) {
      this.update();
      this.startLoop();
    }
  }

  isRunning() {
    return (
      this.phase === PHASES.PREPARE ||
      this.phase === PHASES.ACTIVITY ||
      this.phase === PHASES.REST
    );
  }

  update() {
    if (!this.isRunning() || this.isPaused) return;

    const now = Date.now();
    this.remainingMs = Math.max(0, this.phaseEndTime - now);

    // Verifica bipes nos últimos 3 segundos (3, 2, 1)
    const ceilSeconds = Math.ceil(this.remainingMs / 1000);
    if (
      ceilSeconds >= 1 &&
      ceilSeconds <= 3 &&
      ceilSeconds !== this.lastBeepSecond &&
      this.phaseDurationMs >= 3000
    ) {
      // Evita tocar bipe de 3s no exato milissegundo em que uma fase de 3s acabou de iniciar
      const elapsedMs = this.phaseDurationMs - this.remainingMs;
      if (elapsedMs > 80) {
        this.lastBeepSecond = ceilSeconds;
        if (this.onCountdownBeep) {
          this.onCountdownBeep(ceilSeconds);
        }
      }
    }

    if (now >= this.phaseEndTime) {
      this.advancePhase(this.phaseEndTime);
      return;
    }

    this.emitTick();
  }

  advancePhase(transitionTimestamp = Date.now()) {
    if (this.phase === PHASES.PREPARE) {
      this.enterPhase(PHASES.ACTIVITY, this.activityDurationMs, transitionTimestamp);
      return;
    }

    if (this.phase === PHASES.ACTIVITY) {
      // Se for a última sessão programada, finaliza imediatamente sem descanso final
      if (this.currentSession >= this.totalSessions) {
        this.completeCycle();
        return;
      }

      // Se houver descanso configurado (> 0s), entra em Descanso; caso contrário vai direto para a próxima Atividade
      if (this.restDurationMs > 0) {
        this.enterPhase(PHASES.REST, this.restDurationMs, transitionTimestamp);
      } else {
        this.currentSession += 1;
        this.enterPhase(PHASES.ACTIVITY, this.activityDurationMs, transitionTimestamp);
      }
      return;
    }

    if (this.phase === PHASES.REST) {
      this.currentSession += 1;
      this.enterPhase(PHASES.ACTIVITY, this.activityDurationMs, transitionTimestamp);
    }
  }

  pause() {
    if (!this.isRunning() || this.isPaused) return;
    this.remainingMs = Math.max(0, this.phaseEndTime - Date.now());
    this.isPaused = true;
    this.stopTimers();
    this.emitTick();
  }

  resume() {
    if (!this.isRunning() || !this.isPaused) return;
    this.isPaused = false;
    this.phaseEndTime = Date.now() + this.remainingMs;
    this.emitTick();
    this.startLoop();
  }

  togglePause() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  restartPhase() {
    if (!this.isRunning()) return;
    const now = Date.now();
    this.remainingMs = this.phaseDurationMs;
    this.phaseEndTime = now + this.phaseDurationMs;
    this.lastBeepSecond = null;
    this.emitTick();
  }

  skipPhase() {
    if (!this.isRunning()) return;
    const wasPaused = this.isPaused;
    this.advancePhase(Date.now());
    if (wasPaused && this.isRunning()) {
      this.remainingMs = this.phaseDurationMs;
      this.emitTick();
    }
  }

  stop() {
    this.stopTimers();
    this.phase = PHASES.IDLE;
    this.isPaused = false;
    this.remainingMs = 0;
  }

  completeCycle() {
    this.stopTimers();
    this.phase = PHASES.COMPLETED;
    this.isPaused = false;
    this.remainingMs = 0;

    const totalActivitySeconds = Math.round((this.activityDurationMs / 1000) * this.totalSessions);
    const totalRestSeconds = Math.round((this.restDurationMs / 1000) * Math.max(0, this.totalSessions - 1));

    if (this.onComplete) {
      this.onComplete({
        totalSessions: this.totalSessions,
        totalActivitySeconds,
        totalRestSeconds,
        totalCycleSeconds: totalActivitySeconds + totalRestSeconds
      });
    }
  }

  emitTick() {
    if (!this.onTick) return;
    const progress =
      this.phaseDurationMs > 0
        ? Math.max(0, Math.min(1, this.remainingMs / this.phaseDurationMs))
        : 0;

    this.onTick({
      phase: this.phase,
      isPaused: this.isPaused,
      currentSession: this.currentSession,
      totalSessions: this.totalSessions,
      remainingMs: this.remainingMs,
      phaseDurationMs: this.phaseDurationMs,
      progress
    });
  }
}
