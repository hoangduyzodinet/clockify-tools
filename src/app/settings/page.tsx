'use client';

import { useState, useEffect } from 'react';
import { AppSettings, defaultSettings } from '@/types/settings';
import { loadSettings, saveSettings } from '@/lib/local-storage';
import { ClockifyUser, ClockifyWorkspace, ClockifyProject } from '@/types/clockify';
import { ApiResponse } from '@/lib/api-response';

const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini — fast & cheap' },
  { value: 'gpt-4o', label: 'gpt-4o' },
  { value: 'gpt-4-turbo', label: 'gpt-4-turbo' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [workspaces, setWorkspaces] = useState<ClockifyWorkspace[]>([]);
  const [projects, setProjects] = useState<ClockifyProject[]>([]);
  const [clockifyUser, setClockifyUser] = useState<ClockifyUser | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    if (s.clockifyApiKey) {
      connectClockify(s.clockifyApiKey, s.clockifyWorkspaceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectClockify(apiKey: string, savedWorkspaceId?: string) {
    setConnecting(true);
    setConnectError('');
    setClockifyUser(null);
    setWorkspaces([]);
    setProjects([]);

    try {
      const [userRes, wsRes] = await Promise.all([
        fetch('/api/clockify/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        }),
        fetch('/api/clockify/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        }),
      ]);

      const userData: ApiResponse<ClockifyUser> = await userRes.json();
      if (!userData.ok) throw new Error(userData.error.message);

      const wsData: ApiResponse<ClockifyWorkspace[]> = await wsRes.json();
      if (!wsData.ok) throw new Error(wsData.error.message);

      setClockifyUser(userData.data);
      setWorkspaces(wsData.data);

      setSettings((prev) => ({ ...prev, clockifyUserId: userData.data.id }));

      const wsId = savedWorkspaceId || wsData.data[0]?.id || '';
      if (wsId) {
        await fetchProjects(apiKey, wsId);
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }

  async function fetchProjects(apiKey: string, workspaceId: string) {
    const res = await fetch('/api/clockify/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, workspaceId }),
    });
    const data: ApiResponse<ClockifyProject[]> = await res.json();
    if (data.ok) setProjects(data.data);
  }

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      {/* GitHub */}
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-base font-semibold text-slate-800">GitHub</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Personal access token with <code className="font-mono">repo</code> read scope.
          </p>
        </div>

        <div>
          <label className={labelClass}>Personal Access Token</label>
          <input
            type="password"
            value={settings.githubToken}
            onChange={(e) => update('githubToken', e.target.value)}
            placeholder="ghp_..."
            autoComplete="off"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Default Owner</label>
            <input
              type="text"
              value={settings.githubOwner}
              onChange={(e) => update('githubOwner', e.target.value)}
              placeholder="org-or-username"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Default Repository</label>
            <input
              type="text"
              value={settings.githubRepo}
              onChange={(e) => update('githubRepo', e.target.value)}
              placeholder="repository-name"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Clockify */}
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Clockify</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Find your API key at clockify.me → Profile Settings → API.
          </p>
        </div>

        <div>
          <label className={labelClass}>API Key</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={settings.clockifyApiKey}
              onChange={(e) => update('clockifyApiKey', e.target.value)}
              placeholder="your-clockify-api-key"
              autoComplete="off"
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
            />
            <button
              onClick={() => connectClockify(settings.clockifyApiKey)}
              disabled={!settings.clockifyApiKey || connecting}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
          </div>
          {connectError && <p className="mt-1.5 text-xs text-red-600">{connectError}</p>}
          {clockifyUser && (
            <p className="mt-1.5 text-xs text-green-600">
              Connected as <strong>{clockifyUser.name}</strong> ({clockifyUser.email})
            </p>
          )}
        </div>

        {workspaces.length > 0 && (
          <div>
            <label className={labelClass}>Workspace</label>
            <select
              value={settings.clockifyWorkspaceId}
              onChange={(e) => {
                const wsId = e.target.value;
                update('clockifyWorkspaceId', wsId);
                update('clockifyProjectId', '');
                setProjects([]);
                if (wsId) fetchProjects(settings.clockifyApiKey, wsId);
              }}
              className={inputClass}
            >
              <option value="">Select workspace…</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {projects.length > 0 && (
          <div>
            <label className={labelClass}>Project</label>
            <select
              value={settings.clockifyProjectId}
              onChange={(e) => update('clockifyProjectId', e.target.value)}
              className={inputClass}
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* AI */}
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-base font-semibold text-slate-800">AI Title Generation</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Optional. Used to rewrite commit messages into clean Clockify task titles.
          </p>
        </div>

        <div>
          <label className={labelClass}>OpenAI API Key</label>
          <input
            type="password"
            value={settings.openAiApiKey}
            onChange={(e) => update('openAiApiKey', e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Model</label>
          <select
            value={settings.openAiModel}
            onChange={(e) => update('openAiModel', e.target.value)}
            className={inputClass}
          >
            {OPENAI_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="rounded-md bg-slate-800 px-6 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Save Settings
        </button>
        {saved && <span className="text-sm font-medium text-green-600">Saved!</span>}
      </div>
    </div>
  );
}
