import { describe, expect, it, vi } from 'vitest';

import { buildAcceptanceLiveSpecCheck, buildAppPrincipalReadinessCheck } from './acceptance-runtime-checks.ts';
import { acceptanceOptions, createDeps } from './acceptance-runtime-checks.test-helpers.ts';

describe('acceptance runtime checks live spec and readiness', () => {
  it('reports live spec drift details when image or env diverge', async () => {
    const getRemoteAppServiceName = vi.fn(() => 'studio-app');
    const assertComposeServiceNetworks = vi.fn(() => ({
      labels: {
        'traefik.http.routers.app.rule': 'Host(`studio.smart-village.app`)',
      },
      networks: ['internal', 'public'],
    }));
    const assertComposeServiceIngressLabels = vi.fn();
    const inspectRemoteServiceContract = vi.fn(async () => ({
      env: {
        APP_DB_USER: 'other-user',
        IAM_ADMIN_ENABLED: 'true',
        IAM_BULK_ENABLED: 'true',
        IAM_PII_KEYRING_JSON: '',
        IAM_UI_ENABLED: 'true',
        KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example.test',
        KEYCLOAK_ADMIN_CLIENT_ID: 'admin-cli',
        KEYCLOAK_ADMIN_CLIENT_SECRET: '',
        KEYCLOAK_ADMIN_REALM: 'master',
        POSTGRES_DB: 'sva_studio',
        POSTGRES_PASSWORD: '',
        REDIS_PASSWORD: '',
        SVA_ALLOWED_INSTANCE_IDS: 'bb-guben,de-musterhausen',
        SVA_AUTH_CLIENT_SECRET: '',
        SVA_AUTH_STATE_SECRET: '',
        SVA_PARENT_DOMAIN: 'smart-village.app',
        SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app',
        SVA_RUNTIME_PROFILE: 'studio',
        VITE_IAM_ADMIN_ENABLED: 'true',
        VITE_IAM_BULK_ENABLED: 'true',
        VITE_IAM_UI_ENABLED: 'true',
      },
      image: 'ghcr.io/smart-village/studio:old',
      labels: {},
      networkNames: ['internal'],
      serviceName: 'studio_app',
    }));
    const deps = createDeps({
      assertComposeServiceIngressLabels,
      assertComposeServiceNetworks,
      getRemoteAppServiceName,
      inspectRemoteServiceContract,
    });

    const check = await buildAcceptanceLiveSpecCheck(
      deps,
      'studio',
      {
        APP_DB_USER: 'sva_app',
        IAM_ADMIN_ENABLED: 'true',
        IAM_BULK_ENABLED: 'true',
        IAM_UI_ENABLED: 'true',
        KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example.test',
        KEYCLOAK_ADMIN_CLIENT_ID: 'admin-cli',
        KEYCLOAK_ADMIN_REALM: 'master',
        POSTGRES_DB: 'sva_studio',
        SVA_ALLOWED_INSTANCE_IDS: 'bb-guben,de-musterhausen',
        SVA_PARENT_DOMAIN: 'smart-village.app',
        SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app',
        SVA_RUNTIME_PROFILE: 'studio',
        VITE_IAM_ADMIN_ENABLED: 'true',
        VITE_IAM_BULK_ENABLED: 'true',
        VITE_IAM_UI_ENABLED: 'true',
      },
      acceptanceOptions,
    );

    expect(check.status).toBe('warn');
    expect(check.code).toBe('live_spec_differs');
    expect(assertComposeServiceNetworks).toHaveBeenCalledWith({ services: { app: {} } }, 'studio-app', ['internal', 'public']);
    expect(assertComposeServiceIngressLabels).toHaveBeenCalledWith({ services: { app: {} } }, 'studio-app');
    expect(inspectRemoteServiceContract).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ serviceName: 'studio-app' }),
    );
    expect(check.details).toMatchObject({
      configDrift: ['APP_DB_USER'],
      liveImage: 'ghcr.io/smart-village/studio:old',
      missingIngressLabels: ['traefik.http.routers.app.rule'],
      missingNetworks: ['public'],
      missingSecretKeys: [
        'SVA_AUTH_CLIENT_SECRET',
        'SVA_AUTH_STATE_SECRET',
        'KEYCLOAK_ADMIN_CLIENT_SECRET',
        'ENCRYPTION_KEY',
        'IAM_PII_KEYRING_JSON',
        'APP_DB_PASSWORD',
        'POSTGRES_PASSWORD',
        'REDIS_PASSWORD',
      ],
    });
  });

  it('builds an ok app principal readiness check when all readiness dependencies are green', async () => {
    const deps = createDeps({
      checkHttpHealth: vi.fn(async () => ({
        payload: {
          checks: {
            auth: { realm: 'smart-village-app' },
            db: true,
            keycloak: true,
            redis: true,
          },
        },
        response: {
          ok: true,
          status: 200,
        },
      })),
    });

    const check = await buildAppPrincipalReadinessCheck(deps, {
      APP_DB_USER: 'sva_app',
      SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app',
    });

    expect(check).toEqual({
      code: 'app_db_principal_ready',
      details: {
        appDbUser: 'sva_app',
        authRealm: 'smart-village-app',
        status: 200,
      },
      message: 'Die laufende App bestaetigt Registry-/Auth-Readiness aus Sicht des Runtime-DB-Users.',
      name: 'app-db-principal',
      status: 'ok',
    });
  });

  it('builds an error app principal readiness check when readiness dependencies are not stable', async () => {
    const deps = createDeps({
      checkHttpHealth: vi.fn(async () => ({
        payload: {
          checks: {
            auth: { realm: 'smart-village-app' },
            db: false,
            keycloak: true,
            redis: true,
          },
        },
        response: {
          ok: false,
          status: 503,
        },
      })),
    });

    const check = await buildAppPrincipalReadinessCheck(deps, {
      APP_DB_USER: 'sva_app',
      SVA_PUBLIC_BASE_URL: 'https://studio.smart-village.app',
    });

    expect(check).toEqual({
      code: 'app_db_principal_not_ready',
      details: {
        appDbUser: 'sva_app',
        payload: {
          checks: {
            auth: { realm: 'smart-village-app' },
            db: false,
            keycloak: true,
            redis: true,
          },
        },
        status: 503,
      },
      message: 'Die laufende App meldet Registry-/Auth- oder Datenbank-Readiness nicht stabil.',
      name: 'app-db-principal',
      status: 'error',
    });
  });
});
