import type { AcceptanceDeployOptions, AcceptanceProbeResult, RemoteRuntimeProfile } from '../runtime-env.shared.ts';
import type { RuntimeImageSmokeDeps } from './image-smoke.types.ts';
import { resolveRemoteShortServiceName } from './runtime-health-helpers.ts';

export const collectRemoteParityChecks = async (
  deps: RuntimeImageSmokeDeps,
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
) => {
  const startedAt = Date.now();
  const checks = await Promise.all([
    deps.buildAcceptanceIngressConsistencyCheck(env),
    deps.buildAppPrincipalReadinessCheck(env),
    deps.buildTenantAuthProofCheck(runtimeProfile, env),
    deps.buildLiveRuntimeEnvCheck(runtimeProfile, env),
  ]);
  const failingChecks = checks.filter((check) => check.status === 'error');
  if (failingChecks.length > 0) {
    throw new Error(
      `Live-Paritaet fuer bereits laufenden Ziel-Digest ist nicht gesund: ${failingChecks.map((check) => `${check.name}: ${check.message}`).join('; ')}`,
    );
  }

  return { checks, durationMs: Date.now() - startedAt };
};

export const buildRemoteParityReuseProbe = (
  deps: RuntimeImageSmokeDeps,
  reusedChecks: Awaited<ReturnType<typeof collectRemoteParityChecks>>,
  liveImage: string,
  targetImage: string,
  messagePrefix = 'Ziel-Digest laeuft bereits live; prod-nahe Root-/Tenant-/APP-Principal-Paritaet wird ueber den laufenden Stack wiederverwendet.',
): readonly AcceptanceProbeResult[] => [
  deps.createProbeResult({
    details: {
      liveImage,
      reusedChecks: reusedChecks.checks.map((check) => ({
        code: check.code,
        name: check.name,
        status: check.status,
      })),
    },
    durationMs: reusedChecks.durationMs,
    message: messagePrefix,
    name: 'image-live-parity-reuse',
    scope: 'image-smoke',
    status: 'ok',
    target: targetImage,
  }),
];

export const tryReuseLiveParityEvidence = async (
  deps: RuntimeImageSmokeDeps,
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
): Promise<readonly AcceptanceProbeResult[] | null> => {
  const stackName = deps.getConfiguredStackName(env);
  const liveContract = await deps.inspectRemoteServiceContract(env, {
    quantumEndpoint: deps.getConfiguredQuantumEndpoint(env),
    serviceName: resolveRemoteShortServiceName(stackName, deps.getRemoteAppServiceName(env)),
    stackName,
  });

  if (liveContract?.image !== options.imageRef) {
    return null;
  }

  const reusedChecks = await collectRemoteParityChecks(deps, runtimeProfile, env);
  return buildRemoteParityReuseProbe(deps, reusedChecks, liveContract.image, options.imageRef);
};

export const buildImageSmokeRuntimeEnvEntries = async (deps: RuntimeImageSmokeDeps, env: NodeJS.ProcessEnv) => {
  const mergedEnv = { ...env } as Record<string, string | undefined>;
  delete mergedEnv.IAM_DATABASE_URL;
  delete mergedEnv.REDIS_URL;

  try {
    const stackName = deps.getConfiguredStackName(env);
    const liveContract = await deps.inspectRemoteServiceContract(env, {
      quantumEndpoint: deps.getConfiguredQuantumEndpoint(env),
      serviceName: resolveRemoteShortServiceName(stackName, deps.getRemoteAppServiceName(env)),
      stackName,
    });
    if (liveContract) {
      for (const [key, value] of Object.entries(liveContract.env)) {
        if ((mergedEnv[key]?.trim() || '').length === 0 && value.trim().length > 0) {
          mergedEnv[key] = value;
        }
      }
    }
  } catch {
    // keep local env-only fallback if the live contract is unavailable
  }

  return Object.entries(mergedEnv)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => `${key}=${value}`);
};
