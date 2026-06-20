import { parseRuntimeProfile, type RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { RemoteRuntimeProfile, RuntimeCommand } from '../runtime-env.shared.ts';

const usage = () => {
  console.error(
    'Usage: tsx scripts/ops/runtime-env.ts <up|down|update|status|smoke|migrate|doctor|repair|reconcile|reset|precheck|deploy|verify-schema-snapshot> <profile> [--json] [--authoritative] [--local-override-file=<path>] [--release-mode=<app-only|schema-and-app>] [--image-digest=<sha256:...>] [--maintenance-window=<text>] [--rollback-hint=<text>]',
  );
  process.exit(2);
};

const knownRuntimeCommands = new Set<RuntimeCommand>([
  'up',
  'down',
  'update',
  'status',
  'smoke',
  'migrate',
  'doctor',
  'repair',
  'reconcile',
  'reset',
  'precheck',
  'deploy',
  'verify-schema-snapshot',
]);

export const ensureKnownCommand = (value: RuntimeCommand | undefined): RuntimeCommand => {
  if (!value || !knownRuntimeCommands.has(value)) {
    usage();
    throw new Error('Unreachable');
  }

  return value;
};

export const ensureKnownProfile = (value: RuntimeProfile | undefined): RuntimeProfile => {
  const parsed = parseRuntimeProfile(value);
  if (!parsed) {
    usage();
    throw new Error('Unreachable');
  }

  return parsed;
};

export const createRemoteRuntimeProfileGuards = (getIsLocal: (runtimeProfile: RuntimeProfile) => boolean) => {
  const isRemoteRuntimeProfile = (runtimeProfile: RuntimeProfile): runtimeProfile is RemoteRuntimeProfile =>
    !getIsLocal(runtimeProfile);

  const requireRemoteRuntimeProfile = (runtimeProfile: RuntimeProfile): RemoteRuntimeProfile => {
    if (!isRemoteRuntimeProfile(runtimeProfile)) {
      throw new Error(`Remote-Runtime-Profil erwartet, erhalten: ${runtimeProfile}`);
    }

    return runtimeProfile;
  };

  return {
    isRemoteRuntimeProfile,
    requireRemoteRuntimeProfile,
  };
};
