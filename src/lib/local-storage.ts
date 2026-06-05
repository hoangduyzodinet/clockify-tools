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
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const merged: AppSettings = { ...defaultSettings, ...parsed };
    // Migrate: promote old single-repo fields into the array
    if (
      merged.githubRepos.length === 0 &&
      typeof parsed['githubOwner'] === 'string' &&
      typeof parsed['githubRepo'] === 'string' &&
      parsed['githubOwner'] &&
      parsed['githubRepo']
    ) {
      merged.githubRepos = [
        { owner: parsed['githubOwner'] as string, repo: parsed['githubRepo'] as string },
      ];
    }
    return merged;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
