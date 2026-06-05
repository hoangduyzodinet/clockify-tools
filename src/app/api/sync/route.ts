import { NextRequest } from 'next/server';
import { syncClockifyTimeEntries } from '@/lib/clockify';
import { success, failure, errorMessage } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const { apiKey, workspaceId, projectId, tasks } = await req.json();

    if (!apiKey || !workspaceId || !Array.isArray(tasks) || tasks.length === 0) {
      return failure('Missing required fields: apiKey, workspaceId, tasks');
    }

    const results = await syncClockifyTimeEntries({ apiKey, workspaceId, projectId, tasks });
    return success(results);
  } catch (error) {
    return failure(errorMessage(error));
  }
}
