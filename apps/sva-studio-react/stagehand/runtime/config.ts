import {
  STAGEHAND_MISSION_NAMES,
  type StagehandAdminConfig,
  type StagehandMissionName,
  type StagehandRunMode,
  type StagehandStoryFilters,
  type StagehandTenantConfig,
} from './types.js';

type StagehandAdminEnv = Record<string, string | undefined>;

const DEFAULT_MISSION: StagehandMissionName = 'admin-users-overview';
const DEFAULT_RUN_MODE: StagehandRunMode = 'mission';

const REQUIRED_ENV_SPECS = [
  {
    key: 'baseUrl',
    sources: ['STAGEHAND_ADMIN_BASE_URL', 'IAM_ACCEPTANCE_BASE_URL'] as const,
  },
  {
    key: 'username',
    sources: ['STAGEHAND_ADMIN_USERNAME', 'IAM_ACCEPTANCE_ADMIN_USERNAME'] as const,
  },
  {
    key: 'password',
    sources: ['STAGEHAND_ADMIN_PASSWORD', 'IAM_ACCEPTANCE_ADMIN_PASSWORD'] as const,
  },
  {
    key: 'openAiApiKey',
    sources: ['OPENAI_API_KEY'] as const,
  },
] as const;

function readFirstDefined(env: StagehandAdminEnv, keys: readonly string[]): string | undefined {
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

function parseBaseUrl(baseUrl: string): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (normalizedBaseUrl === '') {
    throw new Error(`Invalid Stagehand admin base URL: ${baseUrl}. Expected an absolute http(s) URL.`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedBaseUrl);
  } catch {
    throw new Error(`Invalid Stagehand admin base URL: ${baseUrl}. Expected an absolute http(s) URL.`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Invalid Stagehand admin base URL: ${baseUrl}. Expected an absolute http(s) URL.`);
  }

  return normalizedBaseUrl;
}

function parseRunMode(runMode: string | undefined): StagehandRunMode {
  const normalizedRunMode = runMode?.trim();

  if (normalizedRunMode === undefined || normalizedRunMode === '') {
    return DEFAULT_RUN_MODE;
  }

  if (normalizedRunMode === 'mission' || normalizedRunMode === 'story-loop') {
    return normalizedRunMode;
  }

  throw new Error(`Invalid Stagehand run mode: ${runMode}. Expected one of: mission, story-loop`);
}

function parseResumeFlag(value: string | undefined): boolean {
  const normalizedValue = value?.trim().toLowerCase();

  return normalizedValue === '1' || normalizedValue === 'true' || normalizedValue === 'yes';
}

function parseStoryFilters(env: StagehandAdminEnv): StagehandStoryFilters {
  return {
    clusters: normalizeCsvValues(env.STAGEHAND_STORY_CLUSTERS),
    packageIds: normalizeCsvValues(env.STAGEHAND_STORY_PACKAGE_IDS),
    resume: parseResumeFlag(env.STAGEHAND_STORY_RESUME),
    storyIds: normalizeNumericCsvValues(env.STAGEHAND_STORY_IDS),
  };
}

function parseTenantConfig(env: StagehandAdminEnv): StagehandTenantConfig | null {
  const baseUrl = readFirstDefined(env, ['STAGEHAND_TENANT_BASE_URL']);
  const username = readFirstDefined(env, ['STAGEHAND_TENANT_USERNAME']);
  const password = readFirstDefined(env, ['STAGEHAND_TENANT_PASSWORD']);

  if (baseUrl === undefined && username === undefined && password === undefined) {
    return null;
  }

  if (baseUrl === undefined || username === undefined || password === undefined) {
    throw new Error(
      'Missing Stagehand tenant config env vars: STAGEHAND_TENANT_BASE_URL, STAGEHAND_TENANT_USERNAME, STAGEHAND_TENANT_PASSWORD'
    );
  }

  const neighborBaseUrl = readFirstDefined(env, ['STAGEHAND_NEIGHBOR_TENANT_BASE_URL']);
  const neighborUsername = readFirstDefined(env, ['STAGEHAND_NEIGHBOR_TENANT_USERNAME']);
  const neighborPassword = readFirstDefined(env, ['STAGEHAND_NEIGHBOR_TENANT_PASSWORD']);

  const hasNeighborConfig =
    neighborBaseUrl !== undefined || neighborUsername !== undefined || neighborPassword !== undefined;

  if (
    hasNeighborConfig &&
    (neighborBaseUrl === undefined || neighborUsername === undefined || neighborPassword === undefined)
  ) {
    throw new Error(
      'Missing Stagehand neighbor tenant config env vars: STAGEHAND_NEIGHBOR_TENANT_BASE_URL, STAGEHAND_NEIGHBOR_TENANT_USERNAME, STAGEHAND_NEIGHBOR_TENANT_PASSWORD'
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

function parseMission(mission: string | undefined): StagehandMissionName {
  const normalizedMission = mission?.trim();

  if (normalizedMission === undefined || normalizedMission === '') {
    return DEFAULT_MISSION;
  }

  if (STAGEHAND_MISSION_NAMES.includes(normalizedMission as StagehandMissionName)) {
    return normalizedMission as StagehandMissionName;
  }

  throw new Error(
    `Invalid Stagehand admin mission: ${mission}. Expected one of: ${STAGEHAND_MISSION_NAMES.join(', ')}`
  );
}

export function parseStagehandAdminConfig(env: StagehandAdminEnv): StagehandAdminConfig {
  const missingKeys = REQUIRED_ENV_SPECS.flatMap(({ sources }) =>
    readFirstDefined(env, sources) === undefined ? [sources.join('|')] : []
  );

  if (missingKeys.length > 0) {
    throw new Error(`Missing Stagehand admin config env vars: ${missingKeys.join(', ')}`);
  }

  const baseUrl = readFirstDefined(env, REQUIRED_ENV_SPECS[0].sources);
  const username = readFirstDefined(env, REQUIRED_ENV_SPECS[1].sources);
  const password = readFirstDefined(env, REQUIRED_ENV_SPECS[2].sources);
  const openAiApiKey = readFirstDefined(env, REQUIRED_ENV_SPECS[3].sources);
  const mission = parseMission(env.STAGEHAND_ADMIN_MISSION);
  const runMode = parseRunMode(env.STAGEHAND_RUN_MODE);
  const storyFilters = parseStoryFilters(env);
  const tenant = parseTenantConfig(env);

  if (baseUrl === undefined || username === undefined || password === undefined || openAiApiKey === undefined) {
    throw new Error('Missing Stagehand admin config env vars: invariant violation');
  }

  return {
    admin: {
      username,
      password,
    },
    baseUrl: parseBaseUrl(baseUrl),
    mission,
    openAiApiKey,
    runMode,
    storyFilters,
    tenant,
  };
}
