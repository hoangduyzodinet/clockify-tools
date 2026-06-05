import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CommitItem } from '@/types/commit';
import { buildInput, buildGroupPrompt, CommitGroup, parseGroupOutput } from '@/lib/ai-titles';
import { success, failure, errorMessage } from '@/lib/api-response';

async function groupWithOpenAI(
  apiKey: string,
  model: string,
  commits: CommitItem[],
  targetGroups?: number,
): Promise<CommitGroup[]> {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildGroupPrompt(targetGroups) },
      { role: 'user', content: buildInput(commits) },
    ],
  });
  return parseGroupOutput(response.choices[0]?.message.content ?? '{}');
}

async function groupWithGemini(
  apiKey: string,
  model: string,
  commits: CommitItem[],
  targetGroups?: number,
): Promise<CommitGroup[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: buildGroupPrompt(targetGroups),
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });
  const result = await geminiModel.generateContent(buildInput(commits));
  return parseGroupOutput(result.response.text() ?? '{}');
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, model, provider, commits, targetGroups } = await req.json();

    if (!apiKey || !model || !Array.isArray(commits) || commits.length === 0) {
      return failure('Missing required fields: apiKey, model, commits');
    }
    if (commits.length > 500) {
      return failure('Too many commits: maximum 500 per request');
    }
    if (!/^[\w.:-]{1,100}$/.test(model)) {
      return failure('Invalid model identifier');
    }

    const groups =
      provider === 'gemini'
        ? await groupWithGemini(apiKey, model, commits, targetGroups)
        : await groupWithOpenAI(apiKey, model, commits, targetGroups);

    if (groups.length === 0) return failure('AI returned no groups — try again');

    return success(groups);
  } catch (error) {
    return failure(errorMessage(error));
  }
}
