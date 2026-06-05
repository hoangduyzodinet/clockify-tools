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

export async function fetchGithubCommits(input: FetchCommitsInput): Promise<CommitItem[]> {
  const octokit = new Octokit({ auth: input.token });
  const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
    owner: input.owner,
    repo: input.repo,
    since: new Date(input.since).toISOString(),
    until: new Date(input.until).toISOString(),
    author: input.author || undefined,
    per_page: 100,
  });

  return commits.map((item) => {
    const message = item.commit.message || '';
    const date = item.commit.author?.date || item.commit.committer?.date || new Date().toISOString();

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
