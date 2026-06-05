'use client';

import { useState, useEffect, useRef } from 'react';
import { AppSettings, defaultSettings, ScheduleMode, RepoTarget } from '@/types/settings';
import { loadSettings, saveSettings } from '@/lib/local-storage';
import { ClockifyUser, ClockifyWorkspace, ClockifyProject } from '@/types/clockify';
import { ApiResponse } from '@/lib/api-response';
import { GithubRepo, GithubReposData } from '@/app/api/github/repos/route';
import { GithubUserData } from '@/app/api/github/user/route';

const OPENAI_MODELS = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini — fast & cheap' },
  { value: 'gpt-4o', label: 'gpt-4o' },
  { value: 'gpt-4-turbo', label: 'gpt-4-turbo' },
];

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — fast & cheap' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

const NAV_SECTIONS = [
  { id: 'github', label: 'GitHub' },
  { id: 'clockify', label: 'Clockify' },
  { id: 'ai', label: 'AI Generation' },
  { id: 'schedule', label: 'Task Schedule' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [workspaces, setWorkspaces] = useState<ClockifyWorkspace[]>([]);
  const [projects, setProjects] = useState<ClockifyProject[]>([]);
  const [clockifyUser, setClockifyUser] = useState<ClockifyUser | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('github');

  // GitHub repo browser
  const [githubRepoList, setGithubRepoList] = useState<GithubRepo[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState('');
  const [showRepoBrowser, setShowRepoBrowser] = useState(false);
  const repoBrowserRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    if (s.clockifyApiKey) {
      connectClockify(s.clockifyApiKey, s.clockifyWorkspaceId);
    }
    if (s.githubToken && !s.githubUsername) {
      fetchGithubUser(s.githubToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close repo browser on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (repoBrowserRef.current && !repoBrowserRef.current.contains(e.target as Node)) {
        setShowRepoBrowser(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Track active section via IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { threshold: 0.3 },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
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
      if (wsId) await fetchProjects(apiKey, wsId);
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

  async function fetchGithubUser(token: string) {
    if (!token) return;
    try {
      const res = await fetch('/api/github/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data: ApiResponse<GithubUserData> = await res.json();
      if (data.ok) {
        update('githubUsername', data.data.login);
        // persist immediately so the main page can read it without requiring Save
        saveSettings({ ...loadSettings(), githubUsername: data.data.login });
      }
    } catch {
      // silently ignore — the token field will show no username
    }
  }

  async function loadGithubRepos() {
    if (!settings.githubToken) return;
    setLoadingRepos(true);
    setRepoError('');
    setShowRepoBrowser(true);

    try {
      const res = await fetch('/api/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.githubToken }),
      });
      const data: ApiResponse<GithubReposData> = await res.json();
      if (!data.ok) throw new Error(data.error.message);
      setGithubRepoList(data.data.repos);
      if (data.data.login) {
        update('githubUsername', data.data.login);
      }
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  }

  function toggleRepo(r: GithubRepo) {
    const exists = settings.githubRepos.some(
      (s) => s.owner === r.owner && s.repo === r.repo,
    );
    const next = exists
      ? settings.githubRepos.filter((s) => !(s.owner === r.owner && s.repo === r.repo))
      : [...settings.githubRepos, { owner: r.owner, repo: r.repo }];
    update('githubRepos', next);
  }

  function removeRepo(idx: number) {
    update(
      'githubRepos',
      settings.githubRepos.filter((_, i) => i !== idx),
    );
  }

  function addManualRepo() {
    update('githubRepos', [...settings.githubRepos, { owner: '', repo: '' }]);
  }

  function updateRepo(idx: number, field: keyof RepoTarget, value: string) {
    const next = settings.githubRepos.map((r, i) =>
      i === idx ? { ...r, [field]: value } : r,
    );
    update('githubRepos', next);
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

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white transition-shadow';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5';

  const filteredRepos = githubRepoList.filter((r) =>
    r.fullName.toLowerCase().includes(repoSearch.toLowerCase()),
  );

  return (
    <div className="flex gap-8 min-h-0">
      {/* Sticky sidebar */}
      <aside className="w-48 shrink-0">
        <div className="sticky top-8 space-y-1">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Settings
          </p>
          {NAV_SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                activeSection === id
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}

          <div className="pt-4">
            <button
              onClick={handleSave}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              Save Settings
            </button>
            {saved && (
              <p className="mt-2 text-center text-xs font-medium text-green-600">Saved!</p>
            )}
          </div>
        </div>
      </aside>

      {/* Scrollable content */}
      <div ref={contentRef} className="min-w-0 flex-1 space-y-8 max-w-2xl">

        {/* GitHub */}
        <section id="github" className="scroll-mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">GitHub</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Personal access token with <code className="rounded bg-slate-100 px-1 font-mono">repo</code> read scope.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className={labelClass}>Personal Access Token</label>
              <input
                type="password"
                value={settings.githubToken}
                onChange={(e) => {
                  update('githubToken', e.target.value);
                  update('githubUsername', '');
                }}
                onBlur={(e) => fetchGithubUser(e.target.value)}
                placeholder="ghp_..."
                autoComplete="off"
                className={inputClass}
              />
              {settings.githubUsername && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  Connected as <strong>{settings.githubUsername}</strong>
                </p>
              )}
            </div>

            {/* Repositories */}
            <div>
              <label className={labelClass}>Repositories</label>

              {settings.githubRepos.length > 0 && (
                <div className="mb-3 space-y-2">
                  {settings.githubRepos.map((r, i) => (
                    <div key={i} className="grid grid-cols-[9rem_1rem_minmax(8rem,1fr)_2rem] items-center gap-2">
                      <input
                        type="text"
                        value={r.owner}
                        onChange={(e) => updateRepo(i, 'owner', e.target.value)}
                        placeholder="owner"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                      <span className="text-center text-slate-300">/</span>
                      <input
                        type="text"
                        value={r.repo}
                        onChange={(e) => updateRepo(i, 'repo', e.target.value)}
                        placeholder="repository"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                      <button
                        onClick={() => removeRepo(i)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={addManualRepo}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  + Add manually
                </button>

                {settings.githubToken && (
                  <div className="relative" ref={repoBrowserRef}>
                    <button
                      onClick={loadGithubRepos}
                      disabled={loadingRepos}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      {loadingRepos ? 'Loading…' : 'Browse from GitHub'}
                    </button>

                    {showRepoBrowser && (
                      <div className="absolute top-full left-0 z-20 mt-1 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
                        <div className="border-b border-slate-100 p-2">
                          <input
                            autoFocus
                            type="text"
                            value={repoSearch}
                            onChange={(e) => setRepoSearch(e.target.value)}
                            placeholder="Search repositories…"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                          />
                        </div>

                        {repoError && (
                          <p className="p-3 text-xs text-red-600">{repoError}</p>
                        )}

                        <ul className="max-h-64 overflow-y-auto">
                          {filteredRepos.length === 0 && !repoError && (
                            <li className="p-3 text-xs text-slate-400">No repositories found.</li>
                          )}
                          {filteredRepos.map((r) => {
                            const selected = settings.githubRepos.some(
                              (s) => s.owner === r.owner && s.repo === r.repo,
                            );
                            return (
                              <li key={r.fullName}>
                                <button
                                  onClick={() => toggleRepo(r)}
                                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                                    selected ? 'font-medium text-slate-900' : 'text-slate-700'
                                  }`}
                                >
                                  <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs transition-colors ${
                                      selected
                                        ? 'border-slate-800 bg-slate-800 text-white'
                                        : 'border-slate-300'
                                    }`}
                                  >
                                    {selected && '✓'}
                                  </span>
                                  <span className="truncate">{r.fullName}</span>
                                  {r.private && (
                                    <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                                      private
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Merge commit filter */}
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Filter merge commits</p>
                <p className="text-xs text-slate-400">
                  Exclude commits with more than one parent (e.g. pull request merges).
                </p>
              </div>
              <button
                role="switch"
                aria-checked={settings.filterMergeCommits}
                onClick={() => update('filterMergeCommits', !settings.filterMergeCommits)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  settings.filterMergeCommits ? 'bg-slate-800' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    settings.filterMergeCommits ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Clockify */}
        <section id="clockify" className="scroll-mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">Clockify</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Find your API key at clockify.me → Profile Settings → API.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className={labelClass}>API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={settings.clockifyApiKey}
                  onChange={(e) => update('clockifyApiKey', e.target.value)}
                  placeholder="your-clockify-api-key"
                  autoComplete="off"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <button
                  onClick={() => connectClockify(settings.clockifyApiKey)}
                  disabled={!settings.clockifyApiKey || connecting}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {connecting ? 'Connecting…' : 'Connect'}
                </button>
              </div>
              {connectError && <p className="mt-1.5 text-xs text-red-600">{connectError}</p>}
              {clockifyUser && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
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
          </div>
        </section>

        {/* AI */}
        <section id="ai" className="scroll-mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">AI Title Generation</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Optional. Used to rewrite commit messages into clean Clockify task titles.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className={labelClass}>Provider</label>
              <div className="flex gap-2">
                {(['openai', 'gemini'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => update('aiProvider', p)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      settings.aiProvider === p
                        ? 'border-slate-800 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
          </div>
        </section>

        {/* Task Schedule */}
        <section id="schedule" className="scroll-mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900">Task Schedule</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Control how commit timestamps are mapped to Clockify time entries.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className={labelClass}>Schedule mode</label>
              <div className="flex gap-2">
                {(
                  [
                    { value: 'byDate', label: 'By commit date', desc: 'Each day gets its own commits' },
                    {
                      value: 'fillWeek',
                      label: 'Fill work week',
                      desc: 'Redistribute across workdays to fill each day',
                    },
                  ] as { value: ScheduleMode; label: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update('scheduleMode', opt.value)}
                    title={opt.desc}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      settings.scheduleMode === opt.value
                        ? 'border-slate-800 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {settings.scheduleMode === 'byDate'
                  ? 'Commits on each day are distributed evenly within the work window.'
                  : 'All commits are pooled and spread evenly across every configured workday in the date range.'}
              </p>
            </div>

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

            <div>
              <label className={labelClass}>Minimum task duration</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '30 min', value: 30 },
                  { label: '1 hour', value: 60 },
                  { label: '2 hours', value: 120 },
                  { label: '4 hours', value: 240 },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update('minTaskDurationMinutes', opt.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      settings.minTaskDurationMinutes === opt.value
                        ? 'border-slate-800 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {(() => {
                  const [sh, sm] = settings.workDayStart.split(':').map(Number);
                  const [eh, em] = settings.workDayEnd.split(':').map(Number);
                  const dayMinutes = eh * 60 + em - (sh * 60 + sm);
                  const max = Math.max(1, Math.floor(dayMinutes / settings.minTaskDurationMinutes));
                  return `Up to ${max} task${max !== 1 ? 's' : ''} per day — excess commits overflow to the next day.`;
                })()}
              </p>
            </div>

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
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                          checked
                            ? 'border-slate-800 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(() => {
              const [sh, sm] = settings.workDayStart.split(':').map(Number);
              const [eh, em] = settings.workDayEnd.split(':').map(Number);
              const dayMinutes = eh * 60 + em - (sh * 60 + sm);
              const dayHours = dayMinutes / 60;
              const numDays = settings.workDays.length;

              if (dayMinutes <= 0)
                return <p className="text-xs text-red-500">End time must be after start time.</p>;

              const h = Math.floor(dayMinutes / 60);
              const m = dayMinutes % 60;
              const perDay = `${h}h${m > 0 ? ` ${m}m` : ''}`;

              if (settings.scheduleMode === 'fillWeek' && numDays > 0) {
                const weekTotal = dayHours * numDays;
                const wh = Math.floor(weekTotal);
                const wm = Math.round((weekTotal - wh) * 60);
                return (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">
                      {numDays} day{numDays !== 1 ? 's' : ''} × {perDay} ={' '}
                      <strong className="text-slate-700">
                        {wh}h{wm > 0 ? ` ${wm}m` : ''}/week
                      </strong>
                    </p>
                  </div>
                );
              }

              return (
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">{perDay} per day — fills this window evenly.</p>
                </div>
              );
            })()}
          </div>
        </section>

        {/* Bottom padding so last section can scroll into view cleanly */}
        <div className="h-8" />
      </div>
    </div>
  );
}
