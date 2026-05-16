export const STAGEHAND_MISSION_NAMES = [
  'admin-users-overview',
  'admin-user-permissions-inspection',
  'admin-role-management-navigation',
] as const;

export type StagehandMissionName = (typeof STAGEHAND_MISSION_NAMES)[number];

export interface StagehandAdminCredentials {
  username: string;
  password: string;
}

export interface StagehandAdminConfig {
  admin: StagehandAdminCredentials;
  baseUrl: string;
  mission: StagehandMissionName;
  openAiApiKey: string;
}
