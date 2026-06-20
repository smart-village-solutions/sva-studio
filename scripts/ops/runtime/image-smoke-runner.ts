import type { AcceptanceDeployOptions, AcceptanceProbeResult, RemoteRuntimeProfile, RuntimeProfile } from '../runtime-env.shared.ts';
import { runContainerHttpProbe, withStartedImageSmokeContainer } from './image-smoke-container.ts';
import { buildImageSmokeRuntimeEnvEntries, collectRemoteParityChecks, tryReuseLiveParityEvidence } from './image-smoke-parity.ts';
import type { RuntimeImageSmokeDeps } from './image-smoke.types.ts';

const buildContainerFailure = (deps: RuntimeImageSmokeDeps, containerName: string, env: NodeJS.ProcessEnv, message: string) => {
  const logResult = deps.runCaptureDetailed('docker', ['logs', containerName], env);
  const inspectResult = deps.runCaptureDetailed('docker', ['inspect', containerName, '--format', '{{json .State}}'], env);
  return `${message}\nState: ${inspectResult.stdout.trim() || inspectResult.stderr?.trim() || 'unbekannt'}\n${deps.summarizeProcessOutput(`${logResult.stdout ?? ''}\n${logResult.stderr ?? ''}`)}`.trim();
};

const runLocalEmergencyHybridImageSmoke = async (
  deps: RuntimeImageSmokeDeps,
  runtimeProfile: RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
  reportId: string,
) =>
  withStartedImageSmokeContainer(
    deps,
    env,
    options,
    reportId,
    (runtimeEnv) => buildImageSmokeRuntimeEnvEntries(deps, runtimeEnv),
    async ({ containerName }) => {
      const artifactProbe = await runContainerHttpProbe(deps, containerName, '/health/live', env, {
        expect: (response) => (response.status === 200 ? null : `Erwartet HTTP 200, erhalten ${response.status}.`),
        name: 'image-live',
        scope: 'image-smoke',
        target: `docker://${containerName}/health/live`,
      });
      if (artifactProbe.status === 'error') {
        throw new Error(buildContainerFailure(deps, containerName, env, artifactProbe.message));
      }

      const reusedChecks = await collectRemoteParityChecks(deps, runtimeProfile, env);
      const hybridParityProbe = deps.createProbeResult({
        details: {
          localEmergency: true,
          reusedChecks: reusedChecks.checks.map((check) => ({ code: check.code, name: check.name, status: check.status })),
        },
        durationMs: reusedChecks.durationMs,
        message:
          'Lokaler Notfallpfad: Artefakt-Startup wurde lokal bestaetigt; DB-/Redis-/Tenant-Paritaet wird fuer das noch nicht live laufende Ziel-Digest ueber den gesunden Studio-Stack wiederverwendet.',
        name: 'image-local-emergency-hybrid-parity',
        scope: 'image-smoke',
        status: 'ok',
        target: options.imageRef,
      });

      return [artifactProbe, hybridParityProbe] as const;
    },
  );

export const runImageSmoke = async (
  deps: RuntimeImageSmokeDeps,
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
  reportId: string,
): Promise<readonly AcceptanceProbeResult[]> => {
  const parsedRuntimeProfile = deps.parseRuntimeProfile((env.SVA_RUNTIME_PROFILE as RuntimeProfile | undefined) ?? 'studio');
  if (!parsedRuntimeProfile || !deps.isRemoteRuntimeProfile(parsedRuntimeProfile)) {
    throw new Error('image-smoke ist nur fuer Remote-Profile verfuegbar.');
  }

  const reusedLiveEvidence = await tryReuseLiveParityEvidence(deps, parsedRuntimeProfile, env, options);
  if (reusedLiveEvidence) {
    return reusedLiveEvidence;
  }

  if (!deps.commandExists('docker')) {
    throw new Error('docker ist fuer image-smoke nicht verfuegbar.');
  }

  if (deps.hasLocalEmergencyRemoteMutationOverride(env)) {
    return runLocalEmergencyHybridImageSmoke(deps, parsedRuntimeProfile, env, options, reportId);
  }

  return withStartedImageSmokeContainer(
    deps,
    env,
    options,
    reportId,
    (runtimeEnv) => buildImageSmokeRuntimeEnvEntries(deps, runtimeEnv),
    async ({ containerName, smokePort }) => {
      const parityPlan = deps.buildProdParityProbePlan(env);
      const rootHeaders = deps.buildTrustedForwardedHeaders(parityPlan.rootHost);
      const baseUrl = `http://127.0.0.1:${smokePort}`;
      const probes = await Promise.all([
        runContainerHttpProbe(deps, containerName, '/health/live', env, {
          expect: (response) => (response.status === 200 ? null : `Erwartet HTTP 200, erhalten ${response.status}.`),
          name: 'image-live',
          scope: 'image-smoke',
          target: `docker://${containerName}/health/live`,
        }),
        runContainerHttpProbe(deps, containerName, '/health/ready', env, {
          expect: (response, payload) => (response.status === 200 ? null : `Prod-naher Kandidat ist nicht ready (${response.status}): ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`),
          name: 'image-ready',
          scope: 'image-smoke',
          target: `docker://${containerName}/health/ready`,
        }),
        deps.runHttpProbe({
          expect: (response) => {
            const location = response.headers.get('location') ?? '';
            const configuredRedirectUri = env.SVA_AUTH_REDIRECT_URI?.trim();
            if (response.status !== 302) {
              return `Erwartet Redirect fuer Root-Auth, erhalten ${response.status}.`;
            }
            if (!deps.isExpectedOidcRedirect(location, env)) {
              return `OIDC-Redirect stimmt nicht: ${location}`;
            }
            return configuredRedirectUri && !location.includes(`redirect_uri=${encodeURIComponent(configuredRedirectUri)}`) ? `Root-Redirect-URI stimmt nicht: ${location}` : null;
          },
          headers: rootHeaders,
          name: 'image-root-auth-login',
          scope: 'image-smoke',
          target: `${baseUrl}/auth/login`,
        }),
        deps.runHttpProbe({
          expect: (response, payload) =>
            [200, 401, 403].includes(response.status) && !(typeof payload === 'string' && payload.toLowerCase().includes('<html'))
              ? null
              : `Unerwarteter IAM-Kontext-Status ${response.status}.`,
          headers: rootHeaders,
          name: 'image-root-iam-context',
          scope: 'image-smoke',
          target: `${baseUrl}/api/v1/iam/me/context`,
        }),
        ...parityPlan.tenantHosts.map(({ host, instanceId }) =>
          deps.runHttpProbe({
            expect: (response) => {
              const location = response.headers.get('location') ?? '';
              const expectedRedirectUri = `${new URL(env.SVA_PUBLIC_BASE_URL ?? 'https://studio.smart-village.app').protocol}//${host}/auth/callback`;
              if (response.status !== 302) {
                return `Erwartet Redirect fuer Tenant ${instanceId}, erhalten ${response.status}.`;
              }
              if (!location.includes(`/realms/${instanceId}/`)) {
                return `Tenant-Realm stimmt nicht fuer ${instanceId}: ${location}`;
              }
              return !location.includes(`redirect_uri=${encodeURIComponent(expectedRedirectUri)}`) ? `Tenant-Redirect-URI stimmt nicht fuer ${instanceId}: ${location}` : null;
            },
            headers: deps.buildTrustedForwardedHeaders(host),
            name: `image-tenant-auth-login-${instanceId}`,
            scope: 'image-smoke',
            target: `${baseUrl}/auth/login`,
          }),
        ),
      ]);

      const failingProbe = probes.find((probe) => probe.status === 'error');
      if (failingProbe) {
        throw new Error(buildContainerFailure(deps, containerName, env, `${failingProbe.name} fehlgeschlagen. ${failingProbe.message}`));
      }

      return probes;
    },
  ).catch((error) => {
    const containerName = `${reportId}-image-smoke`.replace(/[^a-z0-9-]/giu, '-').toLowerCase();
    throw new Error(buildContainerFailure(deps, containerName, env, error instanceof Error ? error.message : String(error)), {
      cause: error,
    });
  });
};

export const createRuntimeImageSmokeOps = (deps: RuntimeImageSmokeDeps) => ({
  runImageSmoke: (env: NodeJS.ProcessEnv, options: AcceptanceDeployOptions, reportId: string) =>
    runImageSmoke(deps, env, options, reportId),
});
