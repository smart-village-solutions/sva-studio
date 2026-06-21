import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { AcceptanceDeployOptions, DoctorCheck } from '../runtime-env.shared.ts';
import type { RemoteServiceContract } from './remote-service-spec.ts';
import {
  runtimeContractComparisonKeys,
  runtimeContractSecretPresenceKeys,
  type AcceptanceRuntimeCheckDeps,
  type ExpectedAppContract,
} from './acceptance-runtime-checks.types.ts';
import { resolveRemoteShortServiceName } from './runtime-health-helpers.ts';

const createLiveSpecUnavailableCheck = (
  deps: AcceptanceRuntimeCheckDeps,
  details: Readonly<Record<string, unknown>>,
) =>
  deps.toDoctorCheck(
    'live-spec-drift',
    'warn',
    'live_spec_unavailable',
    'Live-Service-Spec konnte nicht gelesen werden; Drift-Pruefung bleibt auf Soll-Konfiguration beschraenkt.',
    details,
  );

const summarizeLiveSpecDrift = (
  env: NodeJS.ProcessEnv,
  expectedAppContract: ExpectedAppContract,
  expectedIngressLabels: Readonly<Record<string, string>>,
  liveContract: RemoteServiceContract | null,
) => {
  const liveEnv = liveContract?.env ?? {};
  const configDrift = runtimeContractComparisonKeys.filter((key) => (env[key]?.trim() || '') !== (liveEnv[key]?.trim() || ''));
  const missingSecretKeys = runtimeContractSecretPresenceKeys.filter((key) => (liveEnv[key]?.trim() || '').length === 0);
  const liveNetworks = [...(liveContract?.networkNames ?? [])].sort();
  const expectedNetworks = [...expectedAppContract.networks].sort();
  const missingNetworks = expectedNetworks.filter((networkName) => !liveNetworks.includes(networkName));
  const missingIngressLabels = Object.entries(expectedIngressLabels).filter(([key, value]) => liveContract?.labels[key] !== value);

  return {
    configDrift,
    liveNetworks,
    missingIngressLabels: missingIngressLabels.map(([key]) => key),
    missingNetworks,
    missingSecretKeys,
  };
};

export const buildAcceptanceLiveSpecCheck = async (
  deps: AcceptanceRuntimeCheckDeps,
  runtimeProfile: RuntimeProfile,
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
): Promise<DoctorCheck> => {
  const renderedCompose = deps.renderRemoteComposeDocument(env);
  const renderedComposeAppServiceName = 'app';
  const stackName = deps.getConfiguredStackName(env);
  const liveServiceName = resolveRemoteShortServiceName(stackName, deps.getRemoteAppServiceName(env));
  const expectedAppContract = deps.assertComposeServiceNetworks(renderedCompose, renderedComposeAppServiceName, ['internal', 'public']);
  deps.assertComposeServiceIngressLabels(renderedCompose, renderedComposeAppServiceName);
  const expectedIngressLabels = Object.fromEntries(
    Object.entries(expectedAppContract.labels).filter(([key]) => key.startsWith('traefik.')),
  );
  const expected = {
    derivedKeys: deps.getRuntimeProfileDerivedEnvKeys(runtimeProfile),
    effectiveSummary: deps.getRuntimeContractSummary(runtimeProfile, env),
    expectedAppNetworks: expectedAppContract.networks,
    expectedIngressLabels,
    imageRef: options.imageRef,
    requiredKeys: deps.getRuntimeProfileRequiredEnvKeys(runtimeProfile),
  };

  try {
    const liveContract = await deps.inspectRemoteServiceContract(env, {
      quantumEndpoint: deps.getConfiguredQuantumEndpoint(env),
      serviceName: liveServiceName,
      stackName,
    });
    const liveImage = liveContract?.image ?? (await deps.resolveLiveImageFallback(env, { stackName }));

    if (!liveImage) {
      return createLiveSpecUnavailableCheck(deps, expected);
    }

    const drift = summarizeLiveSpecDrift(env, expectedAppContract, expectedIngressLabels, liveContract);
    const liveSpecMatches =
      liveImage === options.imageRef &&
      drift.configDrift.length === 0 &&
      drift.missingSecretKeys.length === 0 &&
      drift.missingNetworks.length === 0 &&
      drift.missingIngressLabels.length === 0;

    return deps.toDoctorCheck(
      'live-spec-drift',
      liveSpecMatches ? 'ok' : 'warn',
      liveSpecMatches ? 'live_spec_matches' : 'live_spec_differs',
      liveSpecMatches
        ? 'Live-Service-Spec entspricht dem Zielartefakt und dem Studio-Runtime-Contract.'
        : 'Live-Service-Spec weicht beim Image, Runtime-Contract oder bei ingress-relevanten Service-Feldern ab.',
      { ...expected, ...drift, liveImage },
    );
  } catch {
    return createLiveSpecUnavailableCheck(deps, expected);
  }
};
