import { AppSettings, defaultSettings } from '@/types/settings';

const SETTINGS_KEY = 'clockify-tools-settings';

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  const stored = window.localStorage.getItem(SETTINGS_KEY);
  if (!stored) {
    return defaultSettings;
  }

  try {
    return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
