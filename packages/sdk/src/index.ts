import { coreVersion } from '@sva/core';

export const sdkVersion = coreVersion;
export type { RouteFactory } from '@sva/core';
export type {
  RuntimeProfile,
  RuntimeProfileAuthMode,
  RuntimeProfileDefinition,
  RuntimeProfileEnvValidationResult,
} from './runtime-profile';
export {
  RUNTIME_PROFILES,
  getRuntimeProfileDefinition,
  getRuntimeProfileFromEnv,
  getRuntimeProfileRequiredEnvKeys,
  isMockAuthRuntimeProfile,
  parseRuntimeProfile,
  validateRuntimeProfileEnv,
} from './runtime-profile';
