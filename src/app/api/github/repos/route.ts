import { NextRequest } from 'next/server';
import { Octokit } from '@octokit/rest';
import { success, failure, errorMessage } from '@/lib/api-response';

export type GithubRepo = {
  fullName: string; // "owner/repo"
  owner: string;
  repo: string;
  private: boolean;
};

export type GithubReposData = {
  login: string; // authenticated user's GitHub login
  repos: GithubRepo[];
};

function mapAuthError(err: unknown): never {
  const status = (err as { status?: number })?.status;
  if (status === 401) throw new Error('GitHub token is invalid or expired.');
  if (status === 403) throw new Error('Token does not have permission to access GitHub.');
  throw err;
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return failure('Missing token');

    const octokit = new Octokit({ auth: token });

    const [{ data: user }, repoList] = await Promise.all([
      octokit.rest.users.getAuthenticated().catch(mapAuthError),
      octokit
        .paginate(octokit.rest.repos.listForAuthenticatedUser, { sort: 'updated', per_page: 100 })
        .catch(mapAuthError),
    ]);

    return success<GithubReposData>({
      login: user.login,
      repos: repoList.map((r) => ({
        fullName: r.full_name,
        owner: r.owner.login,
        repo: r.name,
        private: r.private,
      })),
    });
  } catch (error) {
    return failure(errorMessage(error));
  }
}
