import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

type EnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>;

const DEFAULT_PLAYWRIGHT_PORT = '4173';
const PLAYWRIGHT_ROOT_PASSWORD_ENV_KEY = 'PLAYWRIGHT_ROOT_' + 'PASSWORD';
const PLAYWRIGHT_DE_MUSTERHAUSEN_PASSWORD_ENV_KEY = 'PLAYWRIGHT_DE_MUSTERHAUSEN_' + 'PASSWORD';

export const ROOT_AUTH_SESSION_FILE = 'playwright/.auth/root-user.json';
export const DE_MUSTERHAUSEN_AUTH_SESSION_FILE = 'playwright/.auth/de-musterhausen-user.json';

export const unauthenticatedStorageState = {
  cookies: [],
  origins: [],
};

export const loadPlaywrightEnv = (cwd: string): void => {
  loadDotenv({
    path: resolve(cwd, '.env.local'),
    override: false,
  });
};

export const resolveAuthSessionFile = (cwd: string, relativeFile: string): string => resolve(cwd, relativeFile);

const resolveLocalDefaultBaseUrl = (env: EnvSource): string => `http://127.0.0.1:${env.PLAYWRIGHT_PORT ?? DEFAULT_PLAYWRIGHT_PORT}`;

const hasScopedAuthSetupCredentials = (
  env: EnvSource,
  input: {
    readonly passwordKey: string;
    readonly usernameKey: string;
  }
): boolean => Boolean(env[input.usernameKey] && env[input.passwordKey]);

const getScopedAuthSetupEnv = (
  env: EnvSource,
  input: {
    readonly baseUrlKeys: readonly string[];
    readonly label: string;
    readonly passwordKey: string;
    readonly usernameKey: string;
  }
) => {
  const baseUrl = input.baseUrlKeys.map((key) => env[key]).find(Boolean) ?? resolveLocalDefaultBaseUrl(env);
  const username = env[input.usernameKey];
  const password = env[input.passwordKey];
  const missingVariables = [
    username ? null : input.usernameKey,
    password ? null : input.passwordKey,
  ].filter((value): value is string => value !== null);

  if (missingVariables.length > 0) {
    throw new Error(`Missing Playwright ${input.label} auth environment variables: ${missingVariables.join(', ')}`);
  }

  return {
    baseUrl,
    password: password as string,
    username: username as string,
  };
};

export const getRootPlaywrightBaseUrl = (env: EnvSource): string =>
  env.PLAYWRIGHT_ROOT_BASE_URL ?? env.PLAYWRIGHT_BASE_URL ?? resolveLocalDefaultBaseUrl(env);

export const getDeMusterhausenPlaywrightBaseUrl = (env: EnvSource): string =>
  env.PLAYWRIGHT_DE_MUSTERHAUSEN_BASE_URL ?? env.PLAYWRIGHT_BASE_URL ?? resolveLocalDefaultBaseUrl(env);

export const hasRootAuthSetupCredentials = (env: EnvSource): boolean =>
  hasScopedAuthSetupCredentials(env, {
    passwordKey: PLAYWRIGHT_ROOT_PASSWORD_ENV_KEY,
    usernameKey: 'PLAYWRIGHT_ROOT_USERNAME',
  });

export const hasDeMusterhausenAuthSetupCredentials = (env: EnvSource): boolean =>
  hasScopedAuthSetupCredentials(env, {
    passwordKey: PLAYWRIGHT_DE_MUSTERHAUSEN_PASSWORD_ENV_KEY,
    usernameKey: 'PLAYWRIGHT_DE_MUSTERHAUSEN_USERNAME',
  });

export const hasRealAuthSetupCredentials = (env: EnvSource): boolean =>
  hasRootAuthSetupCredentials(env) && hasDeMusterhausenAuthSetupCredentials(env);

export const getRootAuthSetupEnv = (env: EnvSource) =>
  getScopedAuthSetupEnv(env, {
    baseUrlKeys: ['PLAYWRIGHT_ROOT_BASE_URL', 'PLAYWRIGHT_BASE_URL'],
    label: 'root',
    passwordKey: PLAYWRIGHT_ROOT_PASSWORD_ENV_KEY,
    usernameKey: 'PLAYWRIGHT_ROOT_USERNAME',
  });

export const getDeMusterhausenAuthSetupEnv = (env: EnvSource) =>
  getScopedAuthSetupEnv(env, {
    baseUrlKeys: ['PLAYWRIGHT_DE_MUSTERHAUSEN_BASE_URL', 'PLAYWRIGHT_BASE_URL'],
    label: 'de_musterhausen',
    passwordKey: PLAYWRIGHT_DE_MUSTERHAUSEN_PASSWORD_ENV_KEY,
    usernameKey: 'PLAYWRIGHT_DE_MUSTERHAUSEN_USERNAME',
  });
