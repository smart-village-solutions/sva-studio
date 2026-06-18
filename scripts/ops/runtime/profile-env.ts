import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getRuntimeProfileDefinition,
  getRuntimeProfileRequiredEnvKeys,
  isMockAuthRuntimeProfile,
  type RuntimeProfile,
  validateRuntimeProfileEnv,
} from '../../../packages/core/src/runtime-profile.ts';
import { parseVarsFile } from './vars-file.ts';
export { parseVarsFile } from './vars-file.ts';

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

const readOptionalVarsFile = (filePath: string): Record<string, string> =>
  existsSync(filePath) ? parseVarsFile(filePath) : {};

const hasExplicitEnvValue = (
  key: string,
  profileEnv: Record<string, string>,
  localOverrideEnv: Record<string, string>,
  processEnv: NodeJS.ProcessEnv,
) => key in profileEnv || key in localOverrideEnv || key in processEnv;

const deleteRemoteOnlyBaseKeys = (
  env: NodeJS.ProcessEnv,
  profileEnv: Record<string, string>,
  localOverrideEnv: Record<string, string>,
  processEnv: NodeJS.ProcessEnv,
) => {
  for (const key of REMOTE_ONLY_ENV_KEYS) {
    if (hasExplicitEnvValue(key, profileEnv, localOverrideEnv, processEnv)) {
      continue;
    }

    delete env[key];
  }
};

const setDerivedAlias = (env: NodeJS.ProcessEnv, targetKey: string, sourceKey: string) => {
  const sourceValue = env[sourceKey];
  if (typeof sourceValue === 'string') {
    env[targetKey] = sourceValue;
    return;
  }

  delete env[targetKey];
};

const setMockAuthFlags = (env: NodeJS.ProcessEnv) => {
  env.SVA_MOCK_AUTH = 'true';
  env.VITE_MOCK_AUTH = 'true';
  env.BUILDER_DEV_AUTH = 'true';
};

const buildRuntimeAliases = (env: NodeJS.ProcessEnv) => {
  setDerivedAlias(env, 'SVA_MAINSERVER_DEV_GRAPHQL_URL', 'SVA_MAINSERVER_GRAPHQL_URL');
  setDerivedAlias(env, 'SVA_MAINSERVER_DEV_OAUTH_TOKEN_URL', 'SVA_MAINSERVER_OAUTH_TOKEN_URL');
  setDerivedAlias(env, 'SVA_MAINSERVER_DEV_API_KEY', 'SVA_MAINSERVER_CLIENT_ID');
  setDerivedAlias(env, 'SVA_MAINSERVER_DEV_API_SECRET', 'SVA_MAINSERVER_CLIENT_SECRET');
};

const buildValidationLine = (label: string, values: readonly string[]) =>
  values.length > 0 ? `${label}: ${values.join(', ')}` : null;

const resolveLocalOverridePath = (rootDir: string, runtimeProfile: RuntimeProfile, localOverrideFile?: string) =>
  localOverrideFile
    ? resolve(rootDir, localOverrideFile)
    : resolve(rootDir, `config/runtime/${runtimeProfile}.local.vars`);

const readUserQuantumEnv = (processEnv: NodeJS.ProcessEnv) => {
  if (!processEnv.HOME) {
    return {};
  }

  return readOptionalVarsFile(resolve(processEnv.HOME, '.config/quantum/env'));
};

const mergeEnvLayers = (
  baseEnv: Record<string, string>,
  profileEnv: Record<string, string>,
  localOverrideEnv: Record<string, string>,
  userQuantumEnv: Record<string, string>,
  processEnv: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv => ({
  ...baseEnv,
  ...profileEnv,
  ...localOverrideEnv,
  ...userQuantumEnv,
  ...processEnv,
});

export const buildProfileEnv = (
  runtimeProfile: RuntimeProfile,
  options: BuildProfileEnvOptions,
): NodeJS.ProcessEnv => {
  const processEnv = options.processEnv ?? process.env;
  const baseEnvPath = resolve(options.rootDir, 'config/runtime/base.vars');
  const profileEnvPath = resolve(options.rootDir, `config/runtime/${runtimeProfile}.vars`);
  const localOverridePath = resolveLocalOverridePath(
    options.rootDir,
    runtimeProfile,
    options.localOverrideFile,
  );
  const baseEnv = parseVarsFile(baseEnvPath);
  const profileEnv = parseVarsFile(profileEnvPath);
  const localOverrideEnv = readOptionalVarsFile(localOverridePath);
  const userQuantumEnv = readUserQuantumEnv(processEnv);
  const env = mergeEnvLayers(baseEnv, profileEnv, localOverrideEnv, userQuantumEnv, processEnv);

  if (!getRuntimeProfileDefinition(runtimeProfile).isLocal) {
    deleteRemoteOnlyBaseKeys(env, profileEnv, localOverrideEnv, processEnv);
  }

  env.SVA_RUNTIME_PROFILE = runtimeProfile;
  env.VITE_SVA_RUNTIME_PROFILE = runtimeProfile;

  if (isMockAuthRuntimeProfile(runtimeProfile)) {
    setMockAuthFlags(env);
  }

  buildRuntimeAliases(env);

  return env;
};

export const assertRuntimeEnv = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv): void => {
  const validation = validateRuntimeProfileEnv(runtimeProfile, env);
  if (validation.missing.length === 0 && validation.placeholders.length === 0 && validation.invalid.length === 0) {
    return;
  }

  const lines = [
    `Runtime-Profil ${runtimeProfile} ist nicht vollstaendig konfiguriert.`,
    buildValidationLine('Ungueltig', validation.invalid),
    buildValidationLine('Fehlend', validation.missing),
    buildValidationLine('Platzhalter', validation.placeholders),
    `Erwartete Variablen: ${getRuntimeProfileRequiredEnvKeys(runtimeProfile).join(', ')}`,
    `Optionaler Override: config/runtime/${runtimeProfile}.local.vars`,
  ].filter((entry): entry is string => entry !== null);

  throw new Error(lines.join('\n'));
};
