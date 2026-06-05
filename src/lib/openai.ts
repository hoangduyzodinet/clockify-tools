import OpenAI from 'openai';
import { CommitItem } from '@/types/commit';

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
      {
        role: 'system',
        content:
          'Rewrite Git commit messages into concise Clockify time-entry titles. Return JSON only as {"titles":{"<sha>":"<title>"}}. Titles should be clear, professional, and 4-12 words.',
      },
      {
        role: 'user',
        content: JSON.stringify(
          commits.map((commit) => ({
            sha: commit.sha,
            summary: commit.summary,
            message: commit.message,
          })),
        ),
      },
    ],
  });

  const content = response.choices[0]?.message.content || '{}';
  const parsed = JSON.parse(content) as { titles?: Record<string, string> };
  return parsed.titles || {};
}
