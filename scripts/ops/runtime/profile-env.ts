import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getRuntimeProfileDefinition,
  getRuntimeProfileRequiredEnvKeys,
  isMockAuthRuntimeProfile,
  type RuntimeProfile,
  validateRuntimeProfileEnv,
} from '../../../packages/core/src/runtime-profile.ts';

type BuildProfileEnvOptions = Readonly<{
  localOverrideFile?: string;
  processEnv?: NodeJS.ProcessEnv;
  rootDir: string;
}>;

const REMOTE_ONLY_ENV_KEYS = [
  'SVA_STACK_NAME',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'REDIS_URL',
  'POSTGRES_PASSWORD',
  'IAM_DATABASE_URL',
  'IAM_PII_KEYRING_JSON',
] as const;

export const parseVarsFile = (filePath: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  const content = readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    parsed[key] = value;
  }

  return parsed;
};

export const buildProfileEnv = (
  runtimeProfile: RuntimeProfile,
  options: BuildProfileEnvOptions,
): NodeJS.ProcessEnv => {
  const processEnv = options.processEnv ?? process.env;
  const baseEnvPath = resolve(options.rootDir, 'config/runtime/base.vars');
  const profileEnvPath = resolve(options.rootDir, `config/runtime/${runtimeProfile}.vars`);
  const localOverridePath = options.localOverrideFile
    ? resolve(options.rootDir, options.localOverrideFile)
    : resolve(options.rootDir, `config/runtime/${runtimeProfile}.local.vars`);
  const baseEnv = parseVarsFile(baseEnvPath);
  const profileEnv = parseVarsFile(profileEnvPath);
  const localOverrideEnv = existsSync(localOverridePath) ? parseVarsFile(localOverridePath) : {};
  const userQuantumEnvPath = processEnv.HOME ? resolve(processEnv.HOME, '.config/quantum/env') : '';
  const userQuantumEnv = userQuantumEnvPath && existsSync(userQuantumEnvPath) ? parseVarsFile(userQuantumEnvPath) : {};
  const env = {
    ...baseEnv,
    ...profileEnv,
    ...localOverrideEnv,
    ...userQuantumEnv,
    ...processEnv,
  };

  if (!getRuntimeProfileDefinition(runtimeProfile).isLocal) {
    for (const key of REMOTE_ONLY_ENV_KEYS) {
      if (!(key in profileEnv) && !(key in localOverrideEnv) && !(key in processEnv)) {
        delete env[key];
      }
    }
  }

  env.SVA_RUNTIME_PROFILE = runtimeProfile;
  env.VITE_SVA_RUNTIME_PROFILE = runtimeProfile;

  if (isMockAuthRuntimeProfile(runtimeProfile)) {
    env.SVA_MOCK_AUTH = 'true';
    env.VITE_MOCK_AUTH = 'true';
    env.BUILDER_DEV_AUTH = 'true';
  }

  env.SVA_MAINSERVER_DEV_GRAPHQL_URL = env.SVA_MAINSERVER_GRAPHQL_URL;
  env.SVA_MAINSERVER_DEV_OAUTH_TOKEN_URL = env.SVA_MAINSERVER_OAUTH_TOKEN_URL;
  env.SVA_MAINSERVER_DEV_API_KEY = env.SVA_MAINSERVER_CLIENT_ID;
  env.SVA_MAINSERVER_DEV_API_SECRET = env.SVA_MAINSERVER_CLIENT_SECRET;

  return env;
};

export const assertRuntimeEnv = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): void => {
  const validation = validateRuntimeProfileEnv(runtimeProfile, env);
  if (validation.missing.length === 0 && validation.placeholders.length === 0 && validation.invalid.length === 0) {
    return;
  }

  const lines = [
    `Runtime-Profil ${runtimeProfile} ist nicht vollstaendig konfiguriert.`,
    validation.invalid.length > 0 ? `Ungueltig: ${validation.invalid.join(', ')}` : null,
    validation.missing.length > 0 ? `Fehlend: ${validation.missing.join(', ')}` : null,
    validation.placeholders.length > 0 ? `Platzhalter: ${validation.placeholders.join(', ')}` : null,
    `Erwartete Variablen: ${getRuntimeProfileRequiredEnvKeys(runtimeProfile).join(', ')}`,
    `Optionaler Override: config/runtime/${runtimeProfile}.local.vars`,
  ].filter((entry): entry is string => entry !== null);

  throw new Error(lines.join('\n'));
};
