import { Octokit } from '@octokit/rest';
import { CommitItem } from '@/types/commit';

export type FetchCommitsInput = {
  token: string;
  owner: string;
  repo: string;
  since: string;
  until: string;
  author?: string;
};

function githubErrorMessage(err: unknown, owner: string, repo: string): string {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    if (status === 401) return 'GitHub token is invalid or expired. Please update it in Settings.';
    if (status === 403)
      return `Access denied. Your GitHub token does not have permission to read ${owner}/${repo}.`;
    if (status === 404)
      return `Repository "${owner}/${repo}" not found. Check the owner/repo names and that your token has access.`;
    if (status === 422)
      return 'Invalid request — check that the author filter is a valid GitHub username or email.';
  }
  if (err instanceof Error) return err.message;
  return 'Failed to fetch commits from GitHub';
}

export async function fetchGithubCommits(input: FetchCommitsInput): Promise<CommitItem[]> {
  const octokit = new Octokit({ auth: input.token });
  const commits = await octokit
    .paginate(octokit.rest.repos.listCommits, {
      owner: input.owner,
      repo: input.repo,
      since: new Date(input.since).toISOString(),
      until: new Date(input.until).toISOString(),
      author: input.author || undefined,
      per_page: 100,
    })
    .catch((err) => {
      throw new Error(githubErrorMessage(err, input.owner, input.repo));
    });

  return commits.map((item) => {
    const message = item.commit.message || '';
    const date =
      item.commit.author?.date || item.commit.committer?.date || new Date().toISOString();

    return {
      sha: item.sha,
      shortSha: item.sha.slice(0, 7),
      message,
      summary: message.split('\n')[0] || item.sha.slice(0, 7),
      authorName: item.commit.author?.name || item.author?.login || 'Unknown',
      authorEmail: item.commit.author?.email || '',
      date,
      url: item.html_url,
      repo: `${input.owner}/${input.repo}`,
    };
  });
}
