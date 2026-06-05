import { CommitItem } from '@/types/commit';
import { DraftTask } from '@/types/clockify';

const DEFAULT_DURATION_MINUTES = 30;

export function commitsToDraftTasks(commits: CommitItem[]): DraftTask[] {
  return commits.map((commit) => {
    const startDate = new Date(commit.date);
    const endDate = new Date(startDate.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);

    return {
      id: commit.sha,
      selected: true,
      title: commit.summary,
      start: toDatetimeLocal(startDate),
      end: toDatetimeLocal(endDate),
      commitSha: commit.sha,
      commitUrl: commit.url,
      sourceMessage: commit.message,
      generated: false,
    };
  });
}

export function applyGeneratedTitles(
  tasks: DraftTask[],
  titles: Record<string, string>,
): DraftTask[] {
  return tasks.map((task) => ({
    ...task,
    title: titles[task.commitSha] || task.title,
    generated: Boolean(titles[task.commitSha]),
  }));
}

export function toDatetimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function localDatetimeToIso(value: string) {
  return new Date(value).toISOString();
}
