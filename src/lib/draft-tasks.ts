import { CommitItem } from '@/types/commit';
import { DraftTask } from '@/types/clockify';
import { ScheduleMode } from '@/types/settings';

export type WorkHours = {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  mode: ScheduleMode;
  workDays: number[]; // 0=Sun … 6=Sat
};

// ── date helpers ──────────────────────────────────────────────────────────────

export function toDatetimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function localDatetimeToIso(value: string) {
  return new Date(value).toISOString();
}

function localDateString(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── task building ─────────────────────────────────────────────────────────────

function buildTasksFromByDay(byDay: Map<string, CommitItem[]>, wh: WorkHours): DraftTask[] {
  const [startH, startM] = wh.start.split(':').map(Number);
  const [endH, endM] = wh.end.split(':').map(Number);
  const dayTotalMinutes = endH * 60 + endM - (startH * 60 + startM);

  const tasks: DraftTask[] = [];

  for (const [day, dayCommits] of byDay) {
    if (dayCommits.length === 0) continue;
    const slotMinutes = dayTotalMinutes / dayCommits.length;

    for (let i = 0; i < dayCommits.length; i++) {
      const commit = dayCommits[i];
      const slotStart = startH * 60 + startM + i * slotMinutes;
      const slotEnd = slotStart + slotMinutes;

      // No timezone suffix → parsed as local time by the browser
      const startDate = new Date(`${day}T${minutesToHHMM(slotStart)}:00`);
      const endDate = new Date(`${day}T${minutesToHHMM(slotEnd)}:00`);

      tasks.push({
        id: commit.sha,
        selected: true,
        title: commit.summary,
        start: toDatetimeLocal(startDate),
        end: toDatetimeLocal(endDate),
        commitSha: commit.sha,
        commitUrl: commit.url,
        sourceMessage: commit.message,
        generated: false,
      });
    }
  }

  return tasks.sort((a, b) => a.start.localeCompare(b.start));
}

// ── mode: byDate ──────────────────────────────────────────────────────────────

function byDateMode(commits: CommitItem[], wh: WorkHours): DraftTask[] {
  const byDay = new Map<string, CommitItem[]>();

  for (const commit of commits) {
    const day = localDateString(new Date(commit.date));
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(commit);
  }

  for (const [day, dayCommits] of byDay) {
    byDay.set(
      day,
      [...dayCommits].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    );
  }

  return buildTasksFromByDay(byDay, wh);
}

// ── mode: fillWeek ────────────────────────────────────────────────────────────

function allWorkdaysInRange(fromStr: string, toStr: string, workDays: number[]): string[] {
  const days: string[] = [];
  // Parse as local midnight so getDay() returns the correct local weekday
  const current = new Date(`${fromStr}T00:00:00`);
  const end = new Date(`${toStr}T00:00:00`);

  while (current <= end) {
    if (workDays.includes(current.getDay())) {
      days.push(localDateString(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

function fillWeekMode(commits: CommitItem[], wh: WorkHours): DraftTask[] {
  const sorted = [...commits].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  if (sorted.length === 0) return [];

  const firstDay = localDateString(new Date(sorted[0].date));
  const lastDay = localDateString(new Date(sorted[sorted.length - 1].date));

  const workdays = allWorkdaysInRange(firstDay, lastDay, wh.workDays);

  // Fall back to byDate when no configured workdays exist in the range
  if (workdays.length === 0) return byDateMode(commits, wh);

  // Distribute commits sequentially: earlier commits → earlier workdays
  const baseCount = Math.floor(sorted.length / workdays.length);
  const extra = sorted.length % workdays.length;

  const byDay = new Map<string, CommitItem[]>();
  let idx = 0;

  for (let d = 0; d < workdays.length; d++) {
    const count = baseCount + (d < extra ? 1 : 0);
    if (count > 0) {
      byDay.set(workdays[d], sorted.slice(idx, idx + count));
      idx += count;
    }
  }

  return buildTasksFromByDay(byDay, wh);
}

// ── public API ────────────────────────────────────────────────────────────────

export function commitsToDraftTasks(commits: CommitItem[], workHours?: WorkHours): DraftTask[] {
  const wh: WorkHours = workHours ?? {
    start: '09:00',
    end: '18:00',
    mode: 'byDate',
    workDays: [1, 2, 3, 4, 5],
  };

  return wh.mode === 'fillWeek' ? fillWeekMode(commits, wh) : byDateMode(commits, wh);
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
