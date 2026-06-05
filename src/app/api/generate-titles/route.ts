import { NextRequest } from 'next/server';
import { generateTaskTitles } from '@/lib/openai';
import { generateTaskTitlesGemini } from '@/lib/gemini';
import { success, failure, errorMessage } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const { apiKey, model, commits, provider } = await req.json();

    if (!apiKey || !model || !Array.isArray(commits) || commits.length === 0) {
      return failure('Missing required fields: apiKey, model, commits');
    }
    if (commits.length > 500) {
      return failure('Too many commits: maximum 500 per request');
    }
    if (!/^[\w.:-]{1,100}$/.test(model)) {
      return failure('Invalid model identifier');
    }

    const titles =
      provider === 'gemini'
        ? await generateTaskTitlesGemini({ apiKey, model, commits })
        : await generateTaskTitles({ apiKey, model, commits });

    return success(titles);
  } catch (error) {
    return failure(errorMessage(error));
  }
}
