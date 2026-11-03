import './style.css';
import { WheelPicker } from './components/wheelPicker.js';
import { loadSettings, saveSettings } from './core/storage.js';
import { TimerEngine, PHASES } from './core/timerEngine.js';
import { soundHaptics } from './services/soundHaptics.js';
import { wakeLock } from './services/wakeLock.js';
import { notifications } from './services/notifications.js';

const RING_RADIUS = 126;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Estado carregado do localStorage
const settings = loadSettings();
soundHaptics.setMuted(settings.isMuted);

// Qual parâmetro a roleta gigante está editando no momento: 'activity' | 'rest' | 'sessions'
let activeParamMode = 'activity';

// Referências de DOM
const appEl = document.getElementById('app');
const viewSetup = document.getElementById('view-setup');
const viewTimer = document.getElementById('view-timer');
const viewComplete = document.getElementById('view-complete');

const btnMute = document.getElementById('btn-mute');
const iconSoundOn = document.getElementById('icon-sound-on');
const iconSoundOff = document.getElementById('icon-sound-off');

const pickerTimeWrapper = document.getElementById('picker-time-wrapper');
const pickerSessionsWrapper = document.getElementById('picker-sessions-wrapper');

const pillActivity = document.getElementById('pill-activity');
const pillRest = document.getElementById('pill-rest');
const pillSessions = document.getElementById('pill-sessions');

const pillValActivity = document.getElementById('pill-val-activity');
const pillValRest = document.getElementById('pill-val-rest');
const pillValSessions = document.getElementById('pill-val-sessions');
const totalDurationDisplay = document.getElementById('total-duration-display');

const btnStart = document.getElementById('btn-start');
const sessionPill = document.getElementById('session-pill');
const sessionDots = document.getElementById('session-dots');
const ringProgress = document.getElementById('timer-ring-progress');
const phaseBadge = document.getElementById('phase-badge');
const timerDigits = document.getElementById('timer-digits');
const nextUpHint = document.getElementById('next-up-hint');

const btnRestartPhase = document.getElementById('btn-restart-phase');
const btnPauseResume = document.getElementById('btn-pause-resume');
const iconPause = document.getElementById('icon-pause');
const iconPlay = document.getElementById('icon-play');
const btnSkipPhase = document.getElementById('btn-skip-phase');
const btnResetCycle = document.getElementById('btn-reset-cycle');

const completeSummaryLine = document.getElementById('complete-summary-line');
const statSessions = document.getElementById('stat-sessions');
const statActivityTime = document.getElementById('stat-activity-time');
const statTotalTime = document.getElementById('stat-total-time');
const btnRepeatCycle = document.getElementById('btn-repeat-cycle');
const btnBackSetup = document.getElementById('btn-back-setup');

// Configuração inicial do anel SVG
ringProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
ringProgress.style.strokeDashoffset = '0';

// Roleta Gigante de Tempo (Minutos e Segundos) compartilhada entre Atividade e Descanso
const wheelMin = new WheelPicker({
  container: document.getElementById('wheel-min'),
  min: 0,
  max: 99,
  initialValue: settings.activityMinutes,
  padZero: true,
  onChange: (val) => {
    if (activeParamMode === 'activity') {
      settings.activityMinutes = val;
      ensureMinimumActivityTime();
    } else if (activeParamMode === 'rest') {
      settings.restMinutes = val;
    }
    persistAndRefreshPreview();
  }
});

const wheelSec = new WheelPicker({
  container: document.getElementById('wheel-sec'),
  min: 0,
  max: 59,
  initialValue: settings.activitySeconds,
  padZero: true,
  onChange: (val) => {
    if (activeParamMode === 'activity') {
      settings.activitySeconds = val;
      ensureMinimumActivityTime();
    } else if (activeParamMode === 'rest') {
      settings.restSeconds = val;
    }
    persistAndRefreshPreview();
  }
});

// Roleta Gigante de Sessões (01 .. 99)
const wheelSessions = new WheelPicker({
  container: document.getElementById('wheel-sessions'),
  min: 1,
  max: 99,
  initialValue: settings.sessions,
  padZero: true,
  onChange: (val) => {
    settings.sessions = val;
    persistAndRefreshPreview();
  }
});

function setParamMode(mode) {
  activeParamMode = mode;

  [pillActivity, pillRest, pillSessions].forEach((pill) => {
    const isSelected = pill.dataset.mode === mode;
    pill.classList.toggle('is-selected', isSelected);
    pill.setAttribute('aria-selected', String(isSelected));
  });

  if (mode === 'sessions') {
    pickerTimeWrapper.classList.add('hidden');
    pickerSessionsWrapper.classList.remove('hidden');
    requestAnimationFrame(() => {
      wheelSessions.setValue(settings.sessions, false, false);
    });
  } else {
    pickerSessionsWrapper.classList.add('hidden');
    pickerTimeWrapper.classList.remove('hidden');
    requestAnimationFrame(() => {
      if (mode === 'activity') {
        wheelMin.setValue(settings.activityMinutes, false, false);
        wheelSec.setValue(settings.activitySeconds, false, false);
      } else {
        wheelMin.setValue(settings.restMinutes, false, false);
        wheelSec.setValue(settings.restSeconds, false, false);
      }
    });
  }
}

[pillActivity, pillRest, pillSessions].forEach((pill) => {
  pill.addEventListener('click', () => {
    soundHaptics.vibrateLight();
    setParamMode(pill.dataset.mode);
  });
});

function ensureMinimumActivityTime() {
  if (settings.activityMinutes === 0 && settings.activitySeconds === 0) {
    settings.activitySeconds = 1;
    if (activeParamMode === 'activity') {
      wheelSec.setValue(1, true, false);
    }
  }
}

function formatMMSS(minutes, seconds) {
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatSecondsCompact(totalSec) {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return formatMMSS(mins, secs);
}

function formatSecondsHuman(totalSec) {
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hours > 0) {
    return `${hours}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

function getTotalActivitySeconds() {
  return settings.activityMinutes * 60 + settings.activitySeconds;
}

function getTotalRestSeconds() {
  return settings.restMinutes * 60 + settings.restSeconds;
}

function persistAndRefreshPreview() {
  saveSettings(settings);

  pillValActivity.textContent = formatMMSS(
    settings.activityMinutes,
    settings.activitySeconds
  );
  pillValRest.textContent = formatMMSS(
    settings.restMinutes,
    settings.restSeconds
  );
  pillValSessions.textContent = `${settings.sessions}x`;

  const totalCycleSeconds =
    settings.sessions * getTotalActivitySeconds() +
    Math.max(0, settings.sessions - 1) * getTotalRestSeconds();

  totalDurationDisplay.textContent = formatSecondsHuman(totalCycleSeconds);
}

function updateMuteUI() {
  btnMute.classList.toggle('is-muted', settings.isMuted);
  iconSoundOn.classList.toggle('hidden', settings.isMuted);
  iconSoundOff.classList.toggle('hidden', !settings.isMuted);
}

btnMute.addEventListener('click', () => {
  settings.isMuted = !settings.isMuted;
  soundHaptics.setMuted(settings.isMuted);
  saveSettings({ isMuted: settings.isMuted });
  updateMuteUI();
  if (!settings.isMuted) {
    soundHaptics.unlockAudio();
    soundHaptics.triggerCountdownTick();
  }
});

function showView(targetView, phaseAttr) {
  [viewSetup, viewTimer, viewComplete].forEach((v) => {
    v.classList.toggle('is-active', v === targetView);
  });
  appEl.dataset.phase = phaseAttr;
}

function renderSessionDots(currentSession, totalSessions) {
  sessionDots.innerHTML = '';
  if (totalSessions > 24) return;

  for (let i = 1; i <= totalSessions; i++) {
    const dot = document.createElement('span');
    dot.className = 'session-dot';
    if (i < currentSession) {
      dot.classList.add('is-done');
    } else if (i === currentSession) {
      dot.classList.add('is-current');
    }
    sessionDots.appendChild(dot);
  }
}

function updateNextUpHint(phase, currentSession, totalSessions) {
  const actStr = formatMMSS(settings.activityMinutes, settings.activitySeconds);
  const restStr = formatMMSS(settings.restMinutes, settings.restSeconds);
  const restTotal = getTotalRestSeconds();

  if (phase === PHASES.PREPARE) {
    nextUpHint.textContent = `Próximo: Atividade 1 (${actStr})`;
    return;
  }

  if (phase === PHASES.ACTIVITY) {
    if (currentSession >= totalSessions) {
      nextUpHint.textContent = 'Última sessão';
    } else if (restTotal > 0) {
      nextUpHint.textContent = `Próximo: Descanso (${restStr})`;
    } else {
      nextUpHint.textContent = `Próximo: Atividade ${currentSession + 1} (${actStr})`;
    }
    return;
  }

  if (phase === PHASES.REST) {
    nextUpHint.textContent = `Próximo: Atividade ${currentSession + 1} (${actStr})`;
  }
}

// Instancia a Máquina de Estados do Timer
const timerEngine = new TimerEngine({
  onTick: ({
    phase,
    isPaused,
    currentSession,
    totalSessions,
    remainingMs,
    progress
  }) => {
    const totalSecondsRemaining = Math.ceil(remainingMs / 1000);
    const mins = Math.floor(totalSecondsRemaining / 60);
    const secs = totalSecondsRemaining % 60;
    timerDigits.textContent = formatMMSS(mins, secs);

    const offset = RING_CIRCUMFERENCE * (1 - progress);
    ringProgress.style.strokeDashoffset = `${offset}`;

    btnPauseResume.classList.toggle('is-running', !isPaused);
    iconPause.classList.toggle('hidden', isPaused);
    iconPlay.classList.toggle('hidden', !isPaused);

    if (isPaused) {
      phaseBadge.textContent = 'PAUSADO';
    } else if (phase === PHASES.PREPARE) {
      phaseBadge.textContent = 'PREPARE-SE';
    } else if (phase === PHASES.ACTIVITY) {
      phaseBadge.textContent = 'ATIVIDADE';
    } else if (phase === PHASES.REST) {
      phaseBadge.textContent = 'DESCANSO';
    }

    sessionPill.textContent = `Sessão ${currentSession} de ${totalSessions}`;
  },

  onPhaseChange: (phase, currentSession, totalSessions) => {
    appEl.dataset.phase = phase;
    renderSessionDots(currentSession, totalSessions);
    updateNextUpHint(phase, currentSession, totalSessions);

    if (phase === PHASES.ACTIVITY) {
      soundHaptics.triggerActivityStart();
      notifications.notifyPhaseTransition(
        `Atividade — Sessão ${currentSession} de ${totalSessions}`,
        `Tempo de atividade iniciado (${formatMMSS(
          settings.activityMinutes,
          settings.activitySeconds
        )}).`
      );
    } else if (phase === PHASES.REST) {
      soundHaptics.triggerRestStart();
      notifications.notifyPhaseTransition(
        `Descanso — Sessão ${currentSession} concluída`,
        `Recupere o fôlego por ${formatMMSS(
          settings.restMinutes,
          settings.restSeconds
        )}.`
      );
    }
  },

  onCountdownBeep: () => {
    soundHaptics.triggerCountdownTick();
  },

  onComplete: ({ totalSessions, totalActivitySeconds, totalCycleSeconds }) => {
    wakeLock.release();
    soundHaptics.triggerCycleComplete();
    notifications.notifyPhaseTransition(
      'Cronociclo Concluído!',
      `Você finalizou todas as ${totalSessions} sessões programadas.`
    );

    completeSummaryLine.textContent = `${totalSessions} ${
      totalSessions === 1 ? 'sessão' : 'sessões'
    } • ${formatSecondsHuman(totalCycleSeconds)} no total`;
    statSessions.textContent = `${totalSessions}x`;
    statActivityTime.textContent = formatSecondsCompact(totalActivitySeconds);
    statTotalTime.textContent = formatSecondsCompact(totalCycleSeconds);

    showView(viewComplete, PHASES.COMPLETED);
  }
});

async function startCycleExecution() {
  soundHaptics.unlockAudio();
  notifications.requestPermissions();
  await wakeLock.acquire();

  showView(viewTimer, PHASES.PREPARE);
  timerEngine.start({
    activitySecondsTotal: getTotalActivitySeconds(),
    restSecondsTotal: getTotalRestSeconds(),
    sessions: settings.sessions
  });
}

// Eventos dos botões
btnStart.addEventListener('click', () => {
  startCycleExecution();
});

btnPauseResume.addEventListener('click', async () => {
  soundHaptics.unlockAudio();
  timerEngine.togglePause();
  if (timerEngine.isPaused) {
    await wakeLock.release();
  } else {
    await wakeLock.acquire();
  }
});

btnRestartPhase.addEventListener('click', () => {
  soundHaptics.vibrateLight();
  timerEngine.restartPhase();
});

btnSkipPhase.addEventListener('click', () => {
  soundHaptics.vibrateLight();
  timerEngine.skipPhase();
});

btnResetCycle.addEventListener('click', async () => {
  soundHaptics.vibrateLight();
  timerEngine.stop();
  await wakeLock.release();
  showView(viewSetup, PHASES.IDLE);
  setParamMode(activeParamMode);
});

btnRepeatCycle.addEventListener('click', () => {
  startCycleExecution();
});

btnBackSetup.addEventListener('click', () => {
  timerEngine.stop();
  showView(viewSetup, PHASES.IDLE);
  setParamMode(activeParamMode);
});

// Inicialização da UI
updateMuteUI();
persistAndRefreshPreview();
setParamMode('activity');
