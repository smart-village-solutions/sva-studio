import { describe, expect, it, vi } from 'vitest';

import type {
  AcceptanceDeployOptions,
  DoctorCheck,
  DoctorReport,
  RemoteRuntimeProfile,
  RuntimeProfile,
} from '../runtime-env.shared.ts';
import { createRuntimeDoctorOps } from './doctor.ts';

const createCheck = (name: string, status: DoctorCheck['status'] = 'ok'): DoctorCheck => ({
  code: `${name}_code`,
  message: name,
  name,
  status,
});

describe('createRuntimeDoctorOps', () => {
  it('uses acceptance service checks for remote profiles and otel checks only for local profiles', async () => {
    const finalizeDoctorReport = vi.fn((profile: RuntimeProfile, checks: readonly DoctorCheck[]): DoctorReport => ({
      checks,
      generatedAt: '2026-06-19T10:00:00.000Z',
      profile,
      status: checks.some((check) => check.status === 'error') ? 'error' : 'ok',
    }));

    const ops = createRuntimeDoctorOps({
      assertLoginFlow: vi.fn(async () => {}),
      assertMainserverSmoke: vi.fn(async () => {}),
      assertMeEndpoint: vi.fn(async () => {}),
      assertOtelLocal: vi.fn(async () => {}),
      buildAcceptanceIngressConsistencyCheck: vi.fn(async () => createCheck('acceptance-ingress')),
      buildAcceptanceLiveSpecCheck: vi.fn(async () => createCheck('acceptance-live-spec')),
      buildAcceptancePostgresCheck: vi.fn(() => createCheck('acceptance-postgres')),
      buildAcceptanceServiceCheck: vi.fn(async () => createCheck('acceptance-service')),
      buildAppPrincipalReadinessCheck: vi.fn(async () => createCheck('app-db-principal')),
      buildActorDoctorCheck: vi.fn(() => createCheck('actor-diagnosis')),
      buildFeatureFlagCheck: vi.fn(() => createCheck('feature-flags')),
      buildImagePlatformDoctorCheck: vi.fn(() => createCheck('image-platform')),
      buildInstanceAuthConfigCheck: vi.fn(() => createCheck('instance-auth-config')),
      buildInstanceHostnameMappingCheck: vi.fn(async () => createCheck('instance-hostname-mapping')),
      buildKeycloakClientSecretCheck: vi.fn(async () => createCheck('keycloak-client-secret')),
      buildLocalInstanceIdentityDoctorCheck: vi.fn(() => createCheck('instance-identity')),
      buildLocalProvisioningWorkerCheck: vi.fn(() => createCheck('local-worker')),
      buildMigrationStatusCheck: vi.fn(() => createCheck('migration-status')),
      buildObservabilityDoctorCheck: vi.fn(async () => createCheck('observability')),
      buildSchemaGuardCheck: vi.fn(() => createCheck('schema-guard')),
      buildSchemaSnapshotCheck: vi.fn(() => createCheck('schema-snapshot')),
      buildStudioImageVerifyEvidenceCheck: vi.fn(() => createCheck('image-verify-evidence')),
      buildTenantAdminClientContractCheck: vi.fn(() => createCheck('tenant-admin-client')),
      buildTenantAdminSecretContractCheck: vi.fn(async () => createCheck('tenant-admin-secret')),
      buildTenantAuthProofCheck: vi.fn(async () => createCheck('tenant-auth-proof')),
      buildTenantAuthSecretContractCheck: vi.fn(async () => createCheck('tenant-auth-secret')),
      checkHttpHealth: vi.fn(async () => ({ payload: {}, response: { ok: true, status: 200 } })),
      finalizeDoctorReport,
      getRuntimeContractSummary: vi.fn(() => ({ runtimeProfile: 'studio' })),
      getRuntimeProfileDefinition: vi.fn((profile: RuntimeProfile) => ({ isLocal: profile !== 'studio' })),
      getRuntimeProfileDerivedEnvKeys: vi.fn(() => ['DERIVED_KEY']),
      getRuntimeProfileRequiredEnvKeys: vi.fn(() => ['REQUIRED_KEY']),
      isMainserverCheckRequired: vi.fn(() => false),
      isRemoteRuntimeProfile: ((profile: RuntimeProfile): profile is RemoteRuntimeProfile => profile === 'studio'),
      localWorkerStateFile: '/tmp/local-worker.json',
      readLocalWorkerState: vi.fn(() => ({ pid: 1 })),
      toDoctorCheck: vi.fn((name: string, status: DoctorCheck['status'], code: string, message: string, details?: Readonly<Record<string, unknown>>) => ({
        code,
        details,
        message,
        name,
        status,
      })),
      validateRuntimeProfileEnv: vi.fn(() => ({
        derived: {},
        invalid: [],
        missing: [],
        placeholders: [],
      })),
      buildGuardrailDoctorChecks: vi.fn(async () => [createCheck('guardrail')]),
    });

    const remoteReport = await ops.doctorRuntime('studio', {
      SVA_PUBLIC_BASE_URL: 'https://studio.example.org',
    });
    const localBuilderReport = await ops.doctorRuntime('local-builder', {
      SVA_PUBLIC_BASE_URL: 'http://localhost:3000',
    });
    const localKeycloakReport = await ops.doctorRuntime('local-keycloak', {
      SVA_PUBLIC_BASE_URL: 'http://localhost:3000',
    });
    const precheckReport = await ops.precheckAcceptance('studio', {} as NodeJS.ProcessEnv, {
      actor: 'codex',
      imageDigest: 'sha256:deadbeef',
      imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:deadbeef',
      imageRepository: 'sva-studio',
      releaseMode: 'app-only',
      reportSlug: 'test',
      rollbackHint: 'rollback',
      workflow: 'Studio Image Verify',
    } satisfies AcceptanceDeployOptions);

    expect(remoteReport.checks.map((check) => check.name)).toContain('acceptance-service');
    expect(remoteReport.checks.map((check) => check.name)).not.toContain('otel');
    expect(localBuilderReport.checks.map((check) => check.name)).toContain('otel');
    expect(localKeycloakReport.checks.map((check) => check.name)).toContain('actor-diagnosis');
    expect(precheckReport.checks.map((check) => check.name)).toContain('acceptance-live-spec');
    expect(finalizeDoctorReport).toHaveBeenCalledTimes(4);
  });
});
