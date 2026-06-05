import { CommitItem } from '@/types/commit';

// Shared between OpenAI and Gemini providers.
// Input uses sequential index keys (not full SHAs) to minimise token usage.
// Output is the same shape: {"0":"title","1":"title",...}

export const SYSTEM_PROMPT =
  'Rewrite each Git commit message as a concise Clockify task title (4–12 words, professional tone). ' +
  'Input JSON: {"0":"message","1":"message",...}. ' +
  'Return the same shape: {"0":"title","1":"title",...}. No extra keys or explanation.';

/** Build the compact JSON payload sent to the model. */
export function buildInput(commits: CommitItem[]): string {
  const map: Record<number, string> = {};
  commits.forEach((commit, i) => {
    const body = commit.message.slice(commit.summary.length).trim();
    // Include body only when it adds context; cap at 100 chars to avoid waste
    map[i] = body ? `${commit.summary}\n${body.slice(0, 100)}` : commit.summary;
  });
  return JSON.stringify(map);
}

/** Map the model's index-keyed response back to sha-keyed titles. */
export function parseOutput(raw: string, commits: CommitItem[]): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const result: Record<string, string> = {};
    for (const [idx, title] of Object.entries(parsed)) {
      const commit = commits[Number(idx)];
      if (commit && typeof title === 'string') {
        result[commit.sha] = title.trim();
      }
    }
    return result;
  } catch {
    return {};
  }
}
