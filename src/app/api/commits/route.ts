import { NextRequest } from 'next/server';
import { fetchGithubCommits } from '@/lib/github';
import { success, failure, errorMessage } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const { token, owner, repo, branch, since, until, author } = await req.json();

    if (!token || !owner || !repo || !since || !until) {
      return failure('Missing required fields: token, owner, repo, since, until');
    }

    const commits = await fetchGithubCommits({ token, owner, repo, branch, since, until, author });
    return success(commits);
  } catch (error) {
    return failure(errorMessage(error));
  }
}
