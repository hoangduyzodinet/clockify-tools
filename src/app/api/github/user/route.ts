import { NextRequest } from 'next/server';
import { Octokit } from '@octokit/rest';
import { success, failure, errorMessage } from '@/lib/api-response';

export type GithubUserData = { login: string };

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return failure('Missing token');

    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.users.getAuthenticated();
    return success<GithubUserData>({ login: data.login });
  } catch (error) {
    return failure(errorMessage(error));
  }
}
