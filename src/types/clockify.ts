export type DraftTask = {
  id: string;
  selected: boolean;
  title: string;
  start: string;
  end: string;
  commitSha: string;
  commitUrl: string;
  sourceMessage: string;
  generated: boolean;
  repo: string; // "owner/repo"
  groupSize?: number; // >1 when multiple commits were merged into this task
};

export type ClockifyWorkspace = {
  id: string;
  name: string;
};

export type ClockifyProject = {
  id: string;
  name: string;
};

export type ClockifyUser = {
  id: string;
  name: string;
  email: string;
};

export type ClockifySyncResult = {
  draftTaskId: string;
  ok: boolean;
  message: string;
  timeEntryId?: string;
};
