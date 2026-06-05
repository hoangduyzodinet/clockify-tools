import { NextRequest } from 'next/server';
import { getClockifyWorkspaces } from '@/lib/clockify';
import { success, failure, errorMessage } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey) return failure('Missing apiKey');
    const workspaces = await getClockifyWorkspaces(apiKey);
    return success(workspaces);
  } catch (error) {
    return failure(errorMessage(error));
  }
}
