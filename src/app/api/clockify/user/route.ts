import { NextRequest } from 'next/server';
import { getClockifyUser } from '@/lib/clockify';
import { success, failure, errorMessage } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey) return failure('Missing apiKey');
    const user = await getClockifyUser(apiKey);
    return success(user);
  } catch (error) {
    return failure(errorMessage(error));
  }
}
