import { NextRequest } from 'next/server';
import { generateTaskTitles } from '@/lib/openai';
import { success, failure, errorMessage } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const { apiKey, model, commits } = await req.json();

    if (!apiKey || !model || !Array.isArray(commits) || commits.length === 0) {
      return failure('Missing required fields: apiKey, model, commits');
    }

    const titles = await generateTaskTitles({ apiKey, model, commits });
    return success(titles);
  } catch (error) {
    return failure(errorMessage(error));
  }
}
