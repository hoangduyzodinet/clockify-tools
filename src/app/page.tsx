'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppSettings, defaultSettings, RepoTarget } from '@/types/settings';
import { loadSettings } from '@/lib/local-storage';
import { CommitItem } from '@/types/commit';
import { DraftTask, ClockifySyncResult } from '@/types/clockify';
import { commitsToDraftTasks, applyGeneratedTitles } from '@/lib/draft-tasks';
import { ApiResponse } from '@/lib/api-response';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white';

export default function HomePage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  // Repos list for this fetch session (pre-filled from settings)
  const [repos, setRepos] = useState<RepoTarget[]>([{ owner: '', repo: '' }]);
  const [author, setAuthor] = useState('');
  const [startDate, setStartDate] = useState(weekAgo());
  const [endDate, setEndDate] = useState(today());

  // Data
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [tasks, setTasks] = useState<DraftTask[]>([]);
  const [syncResults, setSyncResults] = useState<ClockifySyncResult[] | null>(null);

  // Loading states
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Errors
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  const [generateError, setGenerateError] = useState('');
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setRepos(
      s.githubRepos.length > 0 ? s.githubRepos : [{ owner: s.githubOwner, repo: s.githubRepo }],
    );
    setAuthor(s.githubUsername);
  }, []);

  const missingGitHub = !settings.githubToken;
  const missingClockify = !settings.clockifyApiKey || !settings.clockifyWorkspaceId;
  const validRepos = repos.filter((r) => r.owner.trim() && r.repo.trim());
  const canFetch = validRepos.length > 0 && startDate && endDate && !loadingCommits;
  const selectedTasks = tasks.filter((t) => t.selected);

  function updateRepo(idx: number, field: keyof RepoTarget, value: string) {
    setRepos((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function addRepo() {
    setRepos((prev) => [...prev, { owner: '', repo: '' }]);
  }

  function removeRepo(idx: number) {
    setRepos((prev) => (prev.length === 1 ? [{ owner: '', repo: '' }] : prev.filter((_, i) => i !== idx)));
  }

  async function fetchCommits() {
    setLoadingCommits(true);
    setFetchErrors([]);
    setCommits([]);
    setTasks([]);
    setSyncResults(null);

    const results = await Promise.allSettled(
      validRepos.map((r) =>
        fetch('/api/commits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: settings.githubToken,
            owner: r.owner.trim(),
            repo: r.repo.trim(),
            since: `${startDate}T00:00:00`,
            until: `${endDate}T23:59:59`,
            author: author.trim() || undefined,
          }),
        }).then((res) => res.json() as Promise<ApiResponse<CommitItem[]>>),
      ),
    );

    const allCommits: CommitItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const label = `${validRepos[i].owner}/${validRepos[i].repo}`;
      if (result.status === 'fulfilled') {
        const data = result.value;
        if (data.ok) {
          allCommits.push(...data.data);
        } else {
          errors.push(`${label}: ${data.error.message}`);
        }
      } else {
        errors.push(`${label}: ${result.reason?.message ?? 'Unknown error'}`);
      }
    }

    // Sort all commits newest-first
    allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const filtered = settings.filterMergeCommits
      ? allCommits.filter((c) => !c.isMerge)
      : allCommits;

    setCommits(filtered);
    setFetchErrors(errors);
    if (filtered.length > 0) {
      setTasks(
        commitsToDraftTasks(filtered, {
          start: settings.workDayStart,
          end: settings.workDayEnd,
          mode: settings.scheduleMode,
          workDays: settings.workDays,
          minDurationMinutes: settings.minTaskDurationMinutes,
        }),
      );
    }

    setLoadingCommits(false);
  }

  async function generateTitles() {
    setGenerating(true);
    setGenerateError('');

    const isGemini = settings.aiProvider === 'gemini';
    try {
      const res = await fetch('/api/generate-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.aiProvider,
          apiKey: isGemini ? settings.geminiApiKey : settings.openAiApiKey,
          model: isGemini ? settings.geminiModel : settings.openAiModel,
          commits,
        }),
      });

      const data: ApiResponse<Record<string, string>> = await res.json();
      if (!data.ok) throw new Error(data.error.message);

      setTasks((prev) => applyGeneratedTitles(prev, data.data));
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate titles');
    } finally {
      setGenerating(false);
    }
  }

  async function syncToClockify() {
    setSyncing(true);
    setSyncError('');
    setSyncResults(null);

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings.clockifyApiKey,
          workspaceId: settings.clockifyWorkspaceId,
          projectId: settings.clockifyProjectId || undefined,
          tasks: selectedTasks,
        }),
      });

      const data: ApiResponse<ClockifySyncResult[]> = await res.json();
      if (!data.ok) throw new Error(data.error.message);

      setSyncResults(data.data);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync to Clockify');
    } finally {
      setSyncing(false);
    }
  }

  function updateTask(id: string, changes: Partial<DraftTask>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  }

  function toggleAll(selected: boolean) {
    setTasks((prev) => prev.map((t) => ({ ...t, selected })));
  }

  const syncOk = syncResults?.filter((r) => r.ok).length ?? 0;
  const syncFailed = syncResults?.filter((r) => !r.ok).length ?? 0;

  // Show repo badge only when fetching more than one repo
  const multiRepo = validRepos.length > 1;

  return (
    <div className="space-y-6">
      {/* Setup warnings */}
      {(missingGitHub || missingClockify) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {missingGitHub && <span>GitHub token not configured. </span>}
          {missingClockify && <span>Clockify API key or workspace not configured. </span>}
          <Link href="/settings" className="font-semibold underline">
            Go to Settings →
          </Link>
        </div>
      )}

      {/* Step 1 — Fetch form */}
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-800">1. Fetch GitHub Commits</h2>

        {/* Repository list */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Repositories</label>
          <div className="space-y-2">
            {repos.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={r.owner}
                  onChange={(e) => updateRepo(i, 'owner', e.target.value)}
                  placeholder="owner"
                  className="w-36 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
                />
                <span className="text-slate-400">/</span>
                <input
                  type="text"
                  value={r.repo}
                  onChange={(e) => updateRepo(i, 'repo', e.target.value)}
                  placeholder="repository"
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
                />
                <button
                  onClick={() => removeRepo(i)}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addRepo}
            className="mt-2 text-xs text-slate-500 underline underline-offset-2 hover:text-slate-800"
          >
            + Add repository
          </button>
        </div>

        {/* Date range + author */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Author Filter{' '}
              <span className="font-normal text-slate-400">(optional — GitHub username or email)</span>
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Leave empty for all authors"
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <button
              onClick={fetchCommits}
              disabled={!canFetch}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loadingCommits ? 'Fetching…' : 'Fetch Commits'}
            </button>
          </div>
          {fetchErrors.length > 0 && (
            <ul className="space-y-0.5">
              {fetchErrors.map((e, i) => (
                <li key={i} className="text-sm text-red-600">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Step 2 — Preview + edit */}
      {tasks.length > 0 && (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-800">2. Review & Edit Tasks</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {commits.length} commit{commits.length !== 1 ? 's' : ''}
                {multiRepo && ` across ${validRepos.length} repositories`}. Edit titles, times, or
                deselect rows before syncing.
              </p>
            </div>

            {(settings.aiProvider === 'gemini' ? settings.geminiApiKey : settings.openAiApiKey) && (
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button
                  onClick={generateTitles}
                  disabled={generating}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {generating ? 'Generating…' : '✨ Generate AI Titles'}
                </button>
                {generateError && <span className="text-xs text-red-600">{generateError}</span>}
              </div>
            )}
          </div>

          {/* Select all / none */}
          <div className="flex gap-3 text-sm text-slate-500">
            <button
              onClick={() => toggleAll(true)}
              className="underline underline-offset-2 hover:text-slate-800"
            >
              Select all
            </button>
            <span>·</span>
            <button
              onClick={() => toggleAll(false)}
              className="underline underline-offset-2 hover:text-slate-800"
            >
              Deselect all
            </button>
            <span className="ml-auto text-slate-400">
              {selectedTasks.length} / {tasks.length} selected
            </span>
          </div>

          {/* Task table */}
          <div className="overflow-x-auto rounded-md border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2">Title</th>
                  <th className="w-52 px-3 py-2">Start</th>
                  <th className="w-52 px-3 py-2">End</th>
                  <th className="w-24 px-3 py-2">Commit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => {
                  const result = syncResults?.find((r) => r.draftTaskId === task.id);
                  return (
                    <tr
                      key={task.id}
                      className={`transition-opacity ${!task.selected ? 'opacity-40' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={task.selected}
                          onChange={(e) => updateTask(task.id, { selected: e.target.checked })}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-700"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={task.title}
                          onChange={(e) => updateTask(task.id, { title: e.target.value })}
                          className="w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 hover:border-slate-300 focus:border-slate-400 focus:bg-white focus:outline-none"
                        />
                        <div className="mt-0.5 flex gap-2">
                          {task.generated && (
                            <span className="text-xs text-indigo-500">AI generated</span>
                          )}
                          {multiRepo && (
                            <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-xs text-slate-500">
                              {task.repo}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="datetime-local"
                          value={task.start}
                          onChange={(e) => updateTask(task.id, { start: e.target.value })}
                          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-slate-300 focus:border-slate-400 focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="datetime-local"
                          value={task.end}
                          onChange={(e) => updateTask(task.id, { end: e.target.value })}
                          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-slate-300 focus:border-slate-400 focus:bg-white focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          <a
                            href={task.commitUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-slate-400 underline underline-offset-2 hover:text-slate-700"
                            title={task.sourceMessage}
                          >
                            {task.commitSha.slice(0, 7)}
                          </a>
                          {result && (
                            <span
                              className={`text-xs font-bold ${result.ok ? 'text-green-600' : 'text-red-500'}`}
                              title={result.message}
                            >
                              {result.ok ? '✓ synced' : '✗ failed'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sync bar */}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button
              onClick={syncToClockify}
              disabled={selectedTasks.length === 0 || syncing || missingClockify}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              title={missingClockify ? 'Configure Clockify in Settings first' : undefined}
            >
              {syncing
                ? 'Syncing…'
                : `Sync ${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''} to Clockify`}
            </button>

            {missingClockify && (
              <span className="text-sm text-amber-600">
                Clockify not configured —{' '}
                <Link href="/settings" className="underline">
                  Settings
                </Link>
              </span>
            )}

            {syncError && <span className="text-sm text-red-600">{syncError}</span>}

            {syncResults && (
              <span className="text-sm text-slate-600">
                <span className="font-medium text-green-600">{syncOk} synced</span>
                {syncFailed > 0 && (
                  <>
                    {' '}
                    · <span className="font-medium text-red-600">{syncFailed} failed</span>
                  </>
                )}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loadingCommits && commits.length === 0 && fetchErrors.length === 0 && tasks.length === 0 && (
        <div className="py-4 text-center text-sm text-slate-400">
          Enter a date range and at least one repository above, then click Fetch Commits.
        </div>
      )}
    </div>
  );
}
