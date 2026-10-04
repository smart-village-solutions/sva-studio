import {
  IAM_EXPLORE_MISSION_NAMES,
  type AdminExplorationConfig,
  type AdminExplorationLocalBrowserConfig,
  type AdminExplorationMissionName,
  type AdminExplorationRunMode,
  type AdminExplorationStoryFilters,
  type AdminExplorationTenantConfig,
} from './types.js';
import { IAM_EXPLORE_CLUSTER_IDS } from './clusters.js';

type AdminExplorationAdminEnv = Record<string, string | undefined>;

const DEFAULT_MISSION: AdminExplorationMissionName = 'admin-users-overview';
const DEFAULT_RUN_MODE: AdminExplorationRunMode = 'mission';
const IAM_EXPLORE_PILOT_MISSION_NAMES: readonly AdminExplorationMissionName[] = ['admin-users-overview'];
const IAM_EXPLORE_CLUSTER_ID_SET = new Set<string>(IAM_EXPLORE_CLUSTER_IDS);

const REQUIRED_ENV_SPECS = [
  {
    key: 'baseUrl',
    sources: ['IAM_EXPLORE_ADMIN_BASE_URL', 'IAM_ACCEPTANCE_BASE_URL'] as const,
  },
  {
    key: 'username',
    sources: ['IAM_EXPLORE_ADMIN_USERNAME', 'IAM_ACCEPTANCE_ADMIN_USERNAME'] as const,
  },
  {
    key: 'password',
    sources: ['IAM_EXPLORE_ADMIN_PASSWORD', 'IAM_ACCEPTANCE_ADMIN_PASSWORD'] as const,
  },
] as const;

function readFirstDefined(env: AdminExplorationAdminEnv, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined && value.trim() !== '') {
      return value;
    }
  }

  return undefined;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/u, '');
}

function normalizeCsvValues(value: string | undefined): string[] {
  return value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0) ?? [];
}

function normalizeNumericCsvValues(value: string | undefined): number[] {
  return normalizeCsvValues(value)
    .map((entry) => Number.parseInt(entry, 10))
    .filter((entry) => Number.isNaN(entry) === false);
}

function parseStoryIds(value: string | undefined): number[] {
  const normalizedEntries = normalizeCsvValues(value);

  if (normalizedEntries.length === 0) {
    return [];
  }

  const invalidEntry = normalizedEntries.find((entry) => /^\d+$/u.test(entry) === false);

  if (invalidEntry !== undefined) {
    throw new Error(
      `Invalid AdminExploration story id filter: ${value}. Expected a comma-separated list of numeric story ids.`
    );
  }

  return normalizeNumericCsvValues(value);
}

function parseBaseUrl(baseUrl: string): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (normalizedBaseUrl === '') {
    throw new Error(`Invalid AdminExploration admin base URL: ${baseUrl}. Expected an absolute http(s) URL.`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedBaseUrl);
  } catch {
    throw new Error(`Invalid AdminExploration admin base URL: ${baseUrl}. Expected an absolute http(s) URL.`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Invalid AdminExploration admin base URL: ${baseUrl}. Expected an absolute http(s) URL.`);
  }

  return normalizedBaseUrl;
}

function parseRunMode(runMode: string | undefined): AdminExplorationRunMode {
  const normalizedRunMode = runMode?.trim();

  if (normalizedRunMode === undefined || normalizedRunMode === '') {
    return DEFAULT_RUN_MODE;
  }

  if (normalizedRunMode === 'mission' || normalizedRunMode === 'story-loop') {
    return normalizedRunMode;
  }

  throw new Error(`Invalid AdminExploration run mode: ${runMode}. Expected one of: mission, story-loop`);
}

function parseResumeFlag(value: string | undefined): boolean {
  const normalizedValue = value?.trim().toLowerCase();

  return normalizedValue === '1' || normalizedValue === 'true' || normalizedValue === 'yes';
}

function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue === undefined || normalizedValue === '') {
    return defaultValue;
  }

  if (normalizedValue === '1' || normalizedValue === 'true' || normalizedValue === 'yes') {
    return true;
  }

  if (normalizedValue === '0' || normalizedValue === 'false' || normalizedValue === 'no') {
    return false;
  }

  throw new Error(`Invalid AdminExploration headless flag: ${value}. Expected one of: true, false, 1, 0, yes, no`);
}

function parseStoryFilters(env: AdminExplorationAdminEnv): AdminExplorationStoryFilters {
  const clusters = normalizeCsvValues(env.IAM_EXPLORE_STORY_CLUSTERS);
  const invalidCluster = clusters.find((clusterId) => IAM_EXPLORE_CLUSTER_ID_SET.has(clusterId) === false);

  if (invalidCluster !== undefined) {
    throw new Error(
      `Invalid AdminExploration story cluster filter: ${invalidCluster}. Expected one of: ${IAM_EXPLORE_CLUSTER_IDS.join(', ')}`
    );
  }

  return {
    clusters,
    packageIds: normalizeCsvValues(env.IAM_EXPLORE_STORY_PACKAGE_IDS),
    resume: parseResumeFlag(env.IAM_EXPLORE_STORY_RESUME),
    storyIds: parseStoryIds(env.IAM_EXPLORE_STORY_IDS),
  };
}

function parseTenantConfig(env: AdminExplorationAdminEnv): AdminExplorationTenantConfig | null {
  const baseUrl = readFirstDefined(env, ['IAM_EXPLORE_TENANT_BASE_URL']);
  const username = readFirstDefined(env, ['IAM_EXPLORE_TENANT_USERNAME']);
  const password = readFirstDefined(env, ['IAM_EXPLORE_TENANT_PASSWORD']);

  if (baseUrl === undefined && username === undefined && password === undefined) {
    return null;
  }

  if (baseUrl === undefined || username === undefined || password === undefined) {
    throw new Error(
      'Missing AdminExploration tenant config env vars: IAM_EXPLORE_TENANT_BASE_URL, IAM_EXPLORE_TENANT_USERNAME, IAM_EXPLORE_TENANT_PASSWORD'
    );
  }

  const neighborBaseUrl = readFirstDefined(env, ['IAM_EXPLORE_NEIGHBOR_TENANT_BASE_URL']);
  const neighborUsername = readFirstDefined(env, ['IAM_EXPLORE_NEIGHBOR_TENANT_USERNAME']);
  const neighborPassword = readFirstDefined(env, ['IAM_EXPLORE_NEIGHBOR_TENANT_PASSWORD']);

  const hasNeighborConfig =
    neighborBaseUrl !== undefined || neighborUsername !== undefined || neighborPassword !== undefined;

  if (
    hasNeighborConfig &&
    (neighborBaseUrl === undefined || neighborUsername === undefined || neighborPassword === undefined)
  ) {
    throw new Error(
      'Missing AdminExploration neighbor tenant config env vars: IAM_EXPLORE_NEIGHBOR_TENANT_BASE_URL, IAM_EXPLORE_NEIGHBOR_TENANT_USERNAME, IAM_EXPLORE_NEIGHBOR_TENANT_PASSWORD'
    );
  }

  return {
    admin: {
      username,
      password,
    },
    baseUrl: parseBaseUrl(baseUrl),
    neighbor:
      neighborBaseUrl === undefined || neighborUsername === undefined || neighborPassword === undefined
        ? null
        : {
            admin: {
              username: neighborUsername,
              password: neighborPassword,
            },
            baseUrl: parseBaseUrl(neighborBaseUrl),
          },
  };
}

function parseLocalBrowserConfig(env: AdminExplorationAdminEnv): AdminExplorationLocalBrowserConfig {
  return {
    headless: parseBooleanFlag(env.IAM_EXPLORE_HEADLESS, true),
  };
}

function parseMission(mission: string | undefined): AdminExplorationMissionName {
  const normalizedMission = mission?.trim();

  if (normalizedMission === undefined || normalizedMission === '') {
    return DEFAULT_MISSION;
  }

  if (IAM_EXPLORE_MISSION_NAMES.includes(normalizedMission as AdminExplorationMissionName)) {
    return normalizedMission as AdminExplorationMissionName;
  }

  throw new Error(
    `Invalid AdminExploration admin mission: ${mission}. Expected one of: ${IAM_EXPLORE_MISSION_NAMES.join(', ')}`
  );
}

function assertSupportedPilotMission(mission: AdminExplorationMissionName, runMode: AdminExplorationRunMode): void {
  if (runMode !== 'mission') {
    return;
  }

  if (IAM_EXPLORE_PILOT_MISSION_NAMES.includes(mission)) {
    return;
  }

  throw new Error(
    `Invalid AdminExploration admin mission for mission mode: ${mission}. Expected one of: ${IAM_EXPLORE_PILOT_MISSION_NAMES.join(', ')}`
  );
}

export function parseAdminExplorationConfig(env: AdminExplorationAdminEnv): AdminExplorationConfig {
  const missingKeys = REQUIRED_ENV_SPECS.flatMap(({ sources }) =>
    readFirstDefined(env, sources) === undefined ? [sources.join('|')] : []
  );

  if (missingKeys.length > 0) {
    throw new Error(`Missing AdminExploration admin config env vars: ${missingKeys.join(', ')}`);
  }

  const baseUrl = readFirstDefined(env, REQUIRED_ENV_SPECS[0].sources);
  const username = readFirstDefined(env, REQUIRED_ENV_SPECS[1].sources);
  const password = readFirstDefined(env, REQUIRED_ENV_SPECS[2].sources);
  const mission = parseMission(env.IAM_EXPLORE_ADMIN_MISSION);
  const runMode = parseRunMode(env.IAM_EXPLORE_RUN_MODE);
  const storyFilters = parseStoryFilters(env);
  const tenant = parseTenantConfig(env);
  assertSupportedPilotMission(mission, runMode);

  if (baseUrl === undefined || username === undefined || password === undefined) {
    throw new Error('Missing AdminExploration admin config env vars: invariant violation');
  }

  return {
    admin: {
      username,
      password,
    },
    baseUrl: parseBaseUrl(baseUrl),
    localBrowser: parseLocalBrowserConfig(env),
    mission,
    runMode,
    storyFilters,
    tenant,
  };
}
