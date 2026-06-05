import { CommitItem } from '@/types/commit';

// ── shared input builder ──────────────────────────────────────────────────────
// Input uses sequential index keys (not full SHAs) to minimise token usage.

/** Build compact {"0":"message","1":"message",...} payload for the model. */
export function buildInput(commits: CommitItem[]): string {
  const map: Record<number, string> = {};
  commits.forEach((commit, i) => {
    const body = commit.message.slice(commit.summary.length).trim();
    map[i] = body ? `${commit.summary}\n${body.slice(0, 100)}` : commit.summary;
  });
  return JSON.stringify(map);
}

// ── rename mode ───────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT =
  'Rewrite each Git commit message as a concise Clockify task title (4–12 words, professional tone). ' +
  'Input JSON: {"0":"message","1":"message",...}. ' +
  'Return the same shape: {"0":"title","1":"title",...}. No extra keys or explanation.';

/** Map the model's index-keyed response back to sha-keyed titles. */
export function parseOutput(raw: string, commits: CommitItem[]): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const result: Record<string, string> = {};
    for (const [idx, title] of Object.entries(parsed)) {
      const commit = commits[Number(idx)];
      if (commit && typeof title === 'string') result[commit.sha] = title.trim();
    }
    return result;
  } catch {
    return {};
  }
}

// ── group-and-summarise mode ──────────────────────────────────────────────────

/** Build the system prompt for group mode. Pass `targetGroups` to pin the exact group count. */
export function buildGroupPrompt(targetGroups?: number): string {
  const countRule = targetGroups
    ? `generate EXACTLY ${targetGroups} group${targetGroups === 1 ? '' : 's'} (one per workday in the target schedule)`
    : 'aim for 3–8 groups total';
  return (
    'You are given Git commit messages. Group semantically related commits (same feature, bug fix, refactor, etc.) and write one professional Clockify task title per group. ' +
    'Input JSON: {"0":"message","1":"message",...}. ' +
    'Output ONLY valid JSON: {"groups":[{"title":"Task title (5–10 words)","i":[0,3,7]},...]}. ' +
    `Rules: every index appears in exactly one group; ${countRule}; titles must be action-oriented task descriptions.`
  );
}

/** @deprecated Use buildGroupPrompt() instead */
export const GROUP_SYSTEM_PROMPT = buildGroupPrompt();

export type CommitGroup = {
  title: string;
  i: number[]; // commit indices from the input
};

export function parseGroupOutput(raw: string): CommitGroup[] {
  try {
    const parsed = JSON.parse(raw) as { groups?: CommitGroup[] };
    const groups = parsed.groups ?? [];
    return groups.filter(
      (g) => typeof g.title === 'string' && Array.isArray(g.i) && g.i.length > 0,
    );
  } catch {
    return [];
  }
}
