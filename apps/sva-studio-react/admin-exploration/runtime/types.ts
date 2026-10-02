export const IAM_EXPLORE_MISSION_NAMES = [
  'admin-users-overview',
  'admin-user-permissions-inspection',
  'admin-role-management-navigation',
] as const;

export type AdminExplorationMissionName = (typeof IAM_EXPLORE_MISSION_NAMES)[number];
export type AdminExplorationRunMode = 'mission' | 'story-loop';
export type AdminExplorationStoryCheckStatus = 'offen' | 'teilweise' | 'erfuellt' | 'unklar' | 'umgebung_unzureichend';
export type AdminExplorationStoryCoverage = 'nicht_geprueft' | 'vorhanden' | 'luecke' | 'nachweis_fehlend';

export interface AdminExplorationAdminCredentials {
  username: string;
  password: string;
}

export interface AdminExplorationStoryFilters {
  clusters: string[];
  packageIds: string[];
  resume: boolean;
  storyIds: number[];
}

export interface AdminExplorationTenantConfig {
  admin: AdminExplorationAdminCredentials;
  baseUrl: string;
  neighbor: {
    admin: AdminExplorationAdminCredentials;
    baseUrl: string;
  } | null;
}

export interface AdminExplorationLocalBrowserConfig {
  headless: boolean;
}

export interface AdminExplorationConfig {
  admin: AdminExplorationAdminCredentials;
  baseUrl: string;
  localBrowser: AdminExplorationLocalBrowserConfig;
  mission: AdminExplorationMissionName;
  runMode: AdminExplorationRunMode;
  storyFilters: AdminExplorationStoryFilters;
  tenant: AdminExplorationTenantConfig | null;
}
