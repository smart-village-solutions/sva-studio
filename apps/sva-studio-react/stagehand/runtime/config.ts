import { STAGEHAND_MISSION_NAMES, type StagehandAdminConfig, type StagehandMissionName } from './types.js';

type StagehandAdminEnv = Record<string, string | undefined>;

const DEFAULT_MISSION: StagehandMissionName = 'admin-users-overview';

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
  };
}
