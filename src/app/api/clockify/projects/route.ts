import { NextRequest } from 'next/server';
import { getClockifyProjects } from '@/lib/clockify';
import { success, failure, errorMessage } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const { apiKey, workspaceId } = await req.json();
    if (!apiKey || !workspaceId) return failure('Missing required fields: apiKey, workspaceId');
    const projects = await getClockifyProjects(apiKey, workspaceId);
    return success(projects);
  } catch (error) {
    return failure(errorMessage(error));
  }
}
