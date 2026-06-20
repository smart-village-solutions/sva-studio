import { vi } from 'vitest';

import type { AcceptanceDeployOptions, DoctorCheck } from '../runtime-env.shared.ts';
import type { AcceptanceRuntimeCheckDeps } from './acceptance-runtime-checks.ts';

export const createDoctorCheck = (
  name: string,
  status: DoctorCheck['status'],
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): DoctorCheck => ({
  code,
  ...(details ? { details } : {}),
  message,
  name,
  status,
});

export const createDeps = (overrides: Partial<AcceptanceRuntimeCheckDeps> = {}): AcceptanceRuntimeCheckDeps => ({
  assertComposeServiceIngressLabels: vi.fn(),
  assertComposeServiceNetworks: vi.fn(() => ({
    labels: {
      'traefik.http.routers.app.rule': 'Host(`studio.smart-village.app`)',
    },
    networks: ['internal', 'public'],
  })),
  checkHttpHealth: vi.fn(async () => ({
    payload: undefined,
    response: {
      ok: true,
      status: 200,
    },
  })),
  getConfiguredQuantumEndpoint: vi.fn(() => 'https://quantum.example.test'),
  getConfiguredStackName: vi.fn(() => 'studio'),
  getRemoteAppServiceName: vi.fn(() => 'app'),
  getRuntimeContractSummary: vi.fn(() => ({
    SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app',
  })),
  getRuntimeProfileDerivedEnvKeys: vi.fn(() => ['SVA_PUBLIC_BASE_URL']),
  getRuntimeProfileRequiredEnvKeys: vi.fn(() => ['SVA_PUBLIC_BASE_URL', 'APP_DB_USER']),
  inspectRemoteServiceContract: vi.fn(async () => ({
    env: {
      APP_DB_USER: 'sva_app',
      IAM_ADMIN_ENABLED: 'true',
      IAM_BULK_ENABLED: 'true',
      IAM_PII_KEYRING_JSON: '{"k":"v"}',
      IAM_UI_ENABLED: 'true',
      KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example.test',
      KEYCLOAK_ADMIN_CLIENT_ID: 'admin-cli',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'secret',
      KEYCLOAK_ADMIN_REALM: 'master',
      POSTGRES_DB: 'sva_studio',
      POSTGRES_PASSWORD: 'postgres-secret',
      REDIS_PASSWORD: 'redis-secret',
      SVA_ALLOWED_INSTANCE_IDS: 'bb-guben,de-musterhausen',
      SVA_AUTH_CLIENT_SECRET: 'auth-secret',
      SVA_AUTH_STATE_SECRET: 'state-secret',
      SVA_PARENT_DOMAIN: 'smart-village.app',
      SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app',
      SVA_RUNTIME_PROFILE: 'studio',
      VITE_IAM_ADMIN_ENABLED: 'true',
      VITE_IAM_BULK_ENABLED: 'true',
      VITE_IAM_UI_ENABLED: 'true',
    },
    image: 'ghcr.io/smart-village/studio:sha-123',
    labels: {
      'traefik.http.routers.app.rule': 'Host(`studio.smart-village.app`)',
    },
    networkNames: ['internal', 'public'],
    serviceName: 'studio_app',
  })),
  readRemoteStackEvidence: vi.fn(async () => ({
    channel: 'portainer-api' as const,
    hasRunningService: () => true,
    summary: 'app running',
  })),
  renderRemoteComposeDocument: vi.fn(() => ({
    services: {
      app: {},
    },
  })),
  resolveLiveImageFallback: vi.fn(async () => ''),
  toDoctorCheck: vi.fn(createDoctorCheck),
  ...overrides,
});

export const acceptanceOptions: AcceptanceDeployOptions = {
  actor: 'agent',
  imageDigest: 'sha256:123',
  imageRef: 'ghcr.io/smart-village/studio:sha-123',
  imageRepository: 'ghcr.io/smart-village/studio',
  releaseMode: 'app-only',
  reportSlug: 'acceptance',
  rollbackHint: 'rollback',
  workflow: 'manual',
};
