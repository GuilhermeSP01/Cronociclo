const STORAGE_KEY = 'cronociclo_settings_v1';

const DEFAULT_SETTINGS = {
  activityMinutes: 0,
  activitySeconds: 45,
  restMinutes: 0,
  restSeconds: 15,
  sessions: 4,
  isMuted: false
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);

    const activityMinutes = clampInt(parsed.activityMinutes, 0, 99, DEFAULT_SETTINGS.activityMinutes);
    let activitySeconds = clampInt(parsed.activitySeconds, 0, 59, DEFAULT_SETTINGS.activitySeconds);
    if (activityMinutes === 0 && activitySeconds === 0) {
      activitySeconds = 1;
    }

    const restMinutes = clampInt(parsed.restMinutes, 0, 99, DEFAULT_SETTINGS.restMinutes);
    const restSeconds = clampInt(parsed.restSeconds, 0, 59, DEFAULT_SETTINGS.restSeconds);
    const sessions = clampInt(parsed.sessions, 1, 99, DEFAULT_SETTINGS.sessions);
    const isMuted = Boolean(parsed.isMuted);

    return {
      activityMinutes,
      activitySeconds,
      restMinutes,
      restSeconds,
      sessions,
      isMuted
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(partialSettings) {
  const current = loadSettings();
  const next = { ...current, ...partialSettings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota/storage errors in private mode
  }
  return next;
}

function clampInt(val, min, max, fallback) {
  const num = Number.parseInt(val, 10);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}
