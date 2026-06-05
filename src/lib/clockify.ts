import { DraftTask, ClockifyProject, ClockifySyncResult, ClockifyUser, ClockifyWorkspace } from '@/types/clockify';
import { localDatetimeToIso } from '@/lib/draft-tasks';

const CLOCKIFY_BASE_URL = 'https://api.clockify.me/api/v1';

function clockifyHeaders(apiKey: string) {
  return {
    'X-Api-Key': apiKey,
    'Content-Type': 'application/json',
  };
}

async function clockifyRequest<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CLOCKIFY_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...clockifyHeaders(apiKey),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Clockify request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getClockifyUser(apiKey: string) {
  return clockifyRequest<ClockifyUser>(apiKey, '/user');
}

export async function getClockifyWorkspaces(apiKey: string) {
  return clockifyRequest<ClockifyWorkspace[]>(apiKey, '/workspaces');
}

export async function getClockifyProjects(apiKey: string, workspaceId: string) {
  return clockifyRequest<ClockifyProject[]>(apiKey, `/workspaces/${workspaceId}/projects`);
}

export async function syncClockifyTimeEntries({
  apiKey,
  workspaceId,
  projectId,
  tasks,
}: {
  apiKey: string;
  workspaceId: string;
  projectId: string;
  tasks: DraftTask[];
}): Promise<ClockifySyncResult[]> {
  const results: ClockifySyncResult[] = [];

  for (const task of tasks) {
    try {
      const entry = await clockifyRequest<{ id: string }>(apiKey, `/workspaces/${workspaceId}/time-entries`, {
        method: 'POST',
        body: JSON.stringify({
          start: localDatetimeToIso(task.start),
          end: localDatetimeToIso(task.end),
          description: task.title,
          projectId,
        }),
      });

      results.push({ draftTaskId: task.id, ok: true, message: 'Synced', timeEntryId: entry.id });
    } catch (error) {
      results.push({
        draftTaskId: task.id,
        ok: false,
        message: error instanceof Error ? error.message : 'Failed to sync',
      });
    }
  }

  return results;
}
