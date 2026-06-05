export type AiProvider = 'openai' | 'gemini';
export type ScheduleMode = 'byDate' | 'fillWeek';

export type RepoTarget = { owner: string; repo: string };

export type AppSettings = {
  githubToken: string;
  githubUsername: string; // authenticated user's login, fetched from token
  githubRepos: RepoTarget[];
  clockifyApiKey: string;
  clockifyWorkspaceId: string;
  clockifyProjectId: string;
  clockifyUserId: string;
  openAiApiKey: string;
  openAiModel: string;
  geminiApiKey: string;
  geminiModel: string;
  aiProvider: AiProvider;
  workDayStart: string; // "HH:MM"
  workDayEnd: string; // "HH:MM"
  scheduleMode: ScheduleMode;
  workDays: number[]; // 0=Sun, 1=Mon … 6=Sat
  filterMergeCommits: boolean;
  minTaskDurationMinutes: number;
};

export const defaultSettings: AppSettings = {
  githubToken: '',
  githubUsername: '',
  githubRepos: [],
  clockifyApiKey: '',
  clockifyWorkspaceId: '',
  clockifyProjectId: '',
  clockifyUserId: '',
  openAiApiKey: '',
  openAiModel: 'gpt-4o-mini',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  aiProvider: 'openai',
  workDayStart: '09:00',
  workDayEnd: '18:00',
  scheduleMode: 'byDate',
  workDays: [1, 2, 3, 4, 5], // Mon–Fri
  filterMergeCommits: true,
  minTaskDurationMinutes: 60,
};
