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
    const merged: AppSettings = { ...defaultSettings, ...JSON.parse(stored) };
    // Migrate: promote old single-repo fields into the array
    if (merged.githubRepos.length === 0 && merged.githubOwner && merged.githubRepo) {
      merged.githubRepos = [{ owner: merged.githubOwner, repo: merged.githubRepo }];
    }
    return merged;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
