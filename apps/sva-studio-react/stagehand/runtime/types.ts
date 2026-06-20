export const STAGEHAND_MISSION_NAMES = [
  'admin-users-overview',
  'admin-user-permissions-inspection',
  'admin-role-management-navigation',
] as const;

export type StagehandMissionName = (typeof STAGEHAND_MISSION_NAMES)[number];
export type StagehandRunMode = 'mission' | 'story-loop';
export type StagehandStoryCheckStatus = 'offen' | 'teilweise' | 'erfuellt' | 'unklar' | 'umgebung_unzureichend';
export type StagehandStoryCoverage = 'nicht_geprueft' | 'vorhanden' | 'luecke' | 'nachweis_fehlend';

export interface StagehandAdminCredentials {
  username: string;
  password: string;
}

export interface StagehandStoryFilters {
  clusters: string[];
  packageIds: string[];
  resume: boolean;
  storyIds: number[];
}

export interface StagehandTenantConfig {
  admin: StagehandAdminCredentials;
  baseUrl: string;
  neighbor: {
    admin: StagehandAdminCredentials;
    baseUrl: string;
  } | null;
}

export interface StagehandLocalBrowserConfig {
  headless: boolean;
}

export interface StagehandAdminConfig {
  admin: StagehandAdminCredentials;
  baseUrl: string;
  localBrowser: StagehandLocalBrowserConfig;
  mission: StagehandMissionName;
  openAiApiKey: string;
  runMode: StagehandRunMode;
  storyFilters: StagehandStoryFilters;
  tenant: StagehandTenantConfig | null;
}
