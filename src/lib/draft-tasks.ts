import { CommitItem } from '@/types/commit';
import { DraftTask } from '@/types/clockify';
import { ScheduleMode } from '@/types/settings';

export type WorkHours = {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  mode: ScheduleMode;
  workDays: number[]; // 0=Sun … 6=Sat
  minDurationMinutes: number;
  /** When set, overrides commit dates and distributes tasks across this range. */
  dateRange?: { start: string; end: string }; // "YYYY-MM-DD"
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

function nextCalendarDay(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return localDateString(d);
}

function nextWorkday(day: string, workDays: number[]): string {
  if (workDays.length === 0) return nextCalendarDay(day);
  const d = new Date(`${day}T00:00:00`);
  do {
    d.setDate(d.getDate() + 1);
  } while (!workDays.includes(d.getDay()));
  return localDateString(d);
}

export function allWorkdaysInRange(fromStr: string, toStr: string, workDays: number[]): string[] {
  const days: string[] = [];
  const current = new Date(`${fromStr}T00:00:00`);
  const end = new Date(`${toStr}T00:00:00`);
  while (current <= end) {
    if (workDays.includes(current.getDay())) days.push(localDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
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
        repo: commit.repo,
      });
    }
  }

  return tasks.sort((a, b) => a.start.localeCompare(b.start));
}

// ── day-map builders ──────────────────────────────────────────────────────────

/**
 * byDate mode: commits stay on their actual calendar day.
 * If a day has more commits than maxPerDay, extras overflow to the next
 * sequential calendar day (not skipping to the next day that already has commits).
 */
function buildDayMapByDate(commits: CommitItem[], maxPerDay: number): Map<string, CommitItem[]> {
  const sorted = [...commits].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const byDay = new Map<string, CommitItem[]>();
  let currentDay: string | null = null;
  let slotsUsed = 0;

  for (const commit of sorted) {
    const commitDay = localDateString(new Date(commit.date));

    if (currentDay === null) {
      currentDay = commitDay;
      slotsUsed = 0;
    } else if (slotsUsed >= maxPerDay) {
      // Day full: move to next calendar day, but not before the commit's actual date
      const next = nextCalendarDay(currentDay);
      currentDay = next > commitDay ? next : commitDay;
      slotsUsed = 0;
    } else if (commitDay > currentDay) {
      // Gap between days: jump to commit's actual date
      currentDay = commitDay;
      slotsUsed = 0;
    }

    if (!byDay.has(currentDay)) byDay.set(currentDay, []);
    byDay.get(currentDay)!.push(commit);
    slotsUsed++;
  }

  return byDay;
}

/**
 * fillWeek mode: commits are pooled and spread across workdays sequentially.
 * When a workday is full it overflows to the next workday (appending new
 * workdays beyond the original range if needed).
 */
function buildDayMapFillWeek(
  commits: CommitItem[],
  wh: WorkHours,
  maxPerDay: number,
): Map<string, CommitItem[]> {
  const sorted = [...commits].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  if (sorted.length === 0) return new Map();

  // Use explicit dateRange when provided; otherwise derive from commit dates.
  const firstDay = wh.dateRange?.start ?? localDateString(new Date(sorted[0].date));
  const lastDay = wh.dateRange?.end ?? localDateString(new Date(sorted[sorted.length - 1].date));

  const workdays = allWorkdaysInRange(firstDay, lastDay, wh.workDays);
  if (workdays.length === 0) {
    if (wh.dateRange) return new Map();
    return buildDayMapByDate(commits, maxPerDay);
  }

  const byDay = new Map<string, CommitItem[]>();

  if (wh.dateRange) {
    // Explicit date range: distribute groups evenly across ALL workdays so tasks
    // spread over the full period rather than bunching on the first few days.
    const baseCount = Math.floor(sorted.length / workdays.length);
    const extra = sorted.length % workdays.length;
    let idx = 0;
    for (let d = 0; d < workdays.length; d++) {
      const count = baseCount + (d < extra ? 1 : 0);
      if (count > 0) {
        byDay.set(workdays[d], sorted.slice(idx, idx + count));
        idx += count;
      }
    }
    return byDay;
  }

  // Normal fillWeek: sequential fill, overflow carries to the next workday.
  let dayIdx = 0;
  let slotsUsed = 0;

  for (const commit of sorted) {
    if (slotsUsed >= maxPerDay) {
      dayIdx++;
      slotsUsed = 0;
    }
    // Extend the workday list dynamically if commits overflow the original range
    if (dayIdx >= workdays.length) {
      workdays.push(nextWorkday(workdays[workdays.length - 1], wh.workDays));
    }

    const day = workdays[dayIdx];
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(commit);
    slotsUsed++;
  }

  return byDay;
}

// ── public API ────────────────────────────────────────────────────────────────

export function commitsToDraftTasks(commits: CommitItem[], workHours?: WorkHours): DraftTask[] {
  const wh: WorkHours = workHours ?? {
    start: '09:00',
    end: '18:00',
    mode: 'byDate',
    workDays: [1, 2, 3, 4, 5],
    minDurationMinutes: 60,
  };

  const [startH, startM] = wh.start.split(':').map(Number);
  const [endH, endM] = wh.end.split(':').map(Number);
  const dayTotalMinutes = endH * 60 + endM - (startH * 60 + startM);
  const maxPerDay = Math.max(1, Math.floor(dayTotalMinutes / wh.minDurationMinutes));

  // dateRange forces fillWeek distribution regardless of the saved mode setting.
  const byDay =
    wh.mode === 'fillWeek' || wh.dateRange
      ? buildDayMapFillWeek(commits, wh, maxPerDay)
      : buildDayMapByDate(commits, maxPerDay);

  return buildTasksFromByDay(byDay, wh);
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
