import { NextRequest } from 'next/server';
import { Octokit } from '@octokit/rest';
import { success, failure, errorMessage } from '@/lib/api-response';

export type GithubBranch = {
  name: string;
  protected: boolean;
};

export type GithubBranchesData = {
  branches: GithubBranch[];
};

function mapRepoError(err: unknown, owner: string, repo: string): never {
  const status = (err as { status?: number })?.status;
  if (status === 401) throw new Error('GitHub token is invalid or expired.');
  if (status === 403) throw new Error(`Token does not have permission to read ${owner}/${repo}.`);
  if (status === 404) throw new Error(`Repository "${owner}/${repo}" not found.`);
  throw err;
}

export async function POST(req: NextRequest) {
  try {
    const { token, owner, repo } = await req.json();
    if (!token || !owner || !repo) return failure('Missing required fields: token, owner, repo');

    const octokit = new Octokit({ auth: token });
    const branchList = await octokit
      .paginate(octokit.rest.repos.listBranches, {
        owner,
        repo,
        per_page: 100,
      })
      .catch((err) => mapRepoError(err, owner, repo));

    return success<GithubBranchesData>({
      branches: branchList.map((branch) => ({
        name: branch.name,
        protected: branch.protected,
      })),
    });
  } catch (error) {
    return failure(errorMessage(error));
  }
}
