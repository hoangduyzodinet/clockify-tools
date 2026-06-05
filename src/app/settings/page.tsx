'use client';

import { useState, useEffect } from 'react';
import { AppSettings, defaultSettings, ScheduleMode } from '@/types/settings';
import { loadSettings, saveSettings } from '@/lib/local-storage';
import { ClockifyUser, ClockifyWorkspace, ClockifyProject } from '@/types/clockify';
import { ApiResponse } from '@/lib/api-response';

const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini — fast & cheap' },
  { value: 'gpt-4o', label: 'gpt-4o' },
  { value: 'gpt-4-turbo', label: 'gpt-4-turbo' },
];

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — fast & cheap' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
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
          <label className={labelClass}>Provider</label>
          <div className="flex gap-2">
            {(['openai', 'gemini'] as const).map((p) => (
              <button
                key={p}
                onClick={() => update('aiProvider', p)}
                className={`rounded-md border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                  settings.aiProvider === p
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p === 'openai' ? 'OpenAI' : 'Gemini'}
              </button>
            ))}
          </div>
        </div>

        {settings.aiProvider === 'openai' && (
          <>
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
          </>
        )}

        {settings.aiProvider === 'gemini' && (
          <>
            <div>
              <label className={labelClass}>Gemini API Key</label>
              <input
                type="password"
                value={settings.geminiApiKey}
                onChange={(e) => update('geminiApiKey', e.target.value)}
                placeholder="AIza..."
                autoComplete="off"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Model</label>
              <select
                value={settings.geminiModel}
                onChange={(e) => update('geminiModel', e.target.value)}
                className={inputClass}
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </section>

      {/* Task Schedule */}
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Task Schedule</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Control how commit timestamps are mapped to Clockify time entries.
          </p>
        </div>

        {/* Schedule mode */}
        <div>
          <label className={labelClass}>Schedule mode</label>
          <div className="flex gap-2">
            {(
              [
                { value: 'byDate', label: 'By commit date', desc: 'Each day gets its own commits' },
                {
                  value: 'fillWeek',
                  label: 'Fill work week',
                  desc: 'Redistribute across Mon–Fri to fill each day',
                },
              ] as { value: ScheduleMode; label: string; desc: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => update('scheduleMode', opt.value)}
                title={opt.desc}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  settings.scheduleMode === opt.value
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            {settings.scheduleMode === 'byDate'
              ? 'Commits on each day are distributed evenly within the work window.'
              : 'All commits are pooled and spread evenly across every configured workday in the date range.'}
          </p>
        </div>

        {/* Work hours */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Work day start</label>
            <input
              type="time"
              value={settings.workDayStart}
              onChange={(e) => update('workDayStart', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Work day end</label>
            <input
              type="time"
              value={settings.workDayEnd}
              onChange={(e) => update('workDayEnd', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Work days (only relevant for fillWeek) */}
        {settings.scheduleMode === 'fillWeek' && (
          <div>
            <label className={labelClass}>Work days</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Sun', value: 0 },
                { label: 'Mon', value: 1 },
                { label: 'Tue', value: 2 },
                { label: 'Wed', value: 3 },
                { label: 'Thu', value: 4 },
                { label: 'Fri', value: 5 },
                { label: 'Sat', value: 6 },
              ].map((day) => {
                const checked = settings.workDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    onClick={() => {
                      const next = checked
                        ? settings.workDays.filter((d) => d !== day.value)
                        : [...settings.workDays, day.value].sort((a, b) => a - b);
                      update('workDays', next);
                    }}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      checked
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary */}
        {(() => {
          const [sh, sm] = settings.workDayStart.split(':').map(Number);
          const [eh, em] = settings.workDayEnd.split(':').map(Number);
          const dayMinutes = eh * 60 + em - (sh * 60 + sm);
          const dayHours = dayMinutes / 60;
          const numDays = settings.workDays.length;

          if (dayMinutes <= 0) {
            return <p className="text-xs text-red-500">End time must be after start time.</p>;
          }

          const h = Math.floor(dayMinutes / 60);
          const m = dayMinutes % 60;
          const perDay = `${h}h${m > 0 ? ` ${m}m` : ''}`;

          if (settings.scheduleMode === 'fillWeek' && numDays > 0) {
            const weekTotal = dayHours * numDays;
            const wh = Math.floor(weekTotal);
            const wm = Math.round((weekTotal - wh) * 60);
            return (
              <p className="text-xs text-slate-400">
                {numDays} day{numDays !== 1 ? 's' : ''} × {perDay} ={' '}
                <strong className="text-slate-600">
                  {wh}h{wm > 0 ? ` ${wm}m` : ''}/week
                </strong>
              </p>
            );
          }

          return (
            <p className="text-xs text-slate-400">{perDay} per day — fills this window evenly.</p>
          );
        })()}
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
