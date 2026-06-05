export type AppSettings = {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  clockifyApiKey: string;
  clockifyWorkspaceId: string;
  clockifyProjectId: string;
  clockifyUserId: string;
  openAiApiKey: string;
  openAiModel: string;
};

export const defaultSettings: AppSettings = {
  githubToken: '',
  githubOwner: '',
  githubRepo: '',
  clockifyApiKey: '',
  clockifyWorkspaceId: '',
  clockifyProjectId: '',
  clockifyUserId: '',
  openAiApiKey: '',
  openAiModel: 'gpt-4o-mini',
};
