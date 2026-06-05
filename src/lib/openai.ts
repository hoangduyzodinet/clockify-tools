import OpenAI from 'openai';
import { CommitItem } from '@/types/commit';
import { SYSTEM_PROMPT, buildInput, parseOutput } from '@/lib/ai-titles';

export async function generateTaskTitles({
  apiKey,
  model,
  commits,
}: {
  apiKey: string;
  model: string;
  commits: CommitItem[];
}) {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildInput(commits) },
    ],
  });

  return parseOutput(response.choices[0]?.message.content ?? '{}', commits);
}
