import { describe, expect, it } from 'vitest';

import { buildInstanceDetailCockpitModel } from './-instance-detail-cockpit';
import {
  buildCockpitState,
  getCockpitSourceLabel,
  getDetailActionLabel,
  mapConfigurationStatusToCockpitStatus,
} from './-instance-detail-cockpit-helpers';
import { getErrorMessage } from './-instance-error-messages';
import { getKeycloakStatusEntries, getStatusGuidance } from './-instance-detail-status';
import { getEffectiveTenantIamStatus } from './-instance-detail-tenant-iam';
import { getSetupWorkflowSteps } from './-instance-detail-workflow';

const createKeycloakStatusFixture = (overrides: Record<string, unknown> = {}) =>
  ({
    realmExists: true,
    clientExists: true,
    tenantAdminClientExists: true,
    tenantAdminExists: true,
    tenantAdminHasSystemAdmin: true,
    tenantAdminHasInstanceRegistryAdmin: true,
    redirectUrisMatch: true,
    logoutUrisMatch: true,
    webOriginsMatch: true,
    clientSecretConfigured: true,
    tenantClientSecretReadable: true,
    clientSecretAligned: true,
    tenantAdminClientSecretConfigured: true,
    tenantAdminClientSecretReadable: true,
    tenantAdminClientSecretAligned: true,
    runtimeSecretSource: 'tenant',
    ...overrides,
  }) as const;

const createDetailFixture = (overrides: Record<string, unknown> = {}) =>
  ({
    instanceId: 'demo',
    displayName: 'Demo',
    status: 'requested',
    featureFlags: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    parentDomain: 'studio.example.org',
    primaryHostname: 'demo.studio.example.org',
    assignedModules: [],
    realmMode: 'new',
    authRealm: 'demo',
    authClientId: 'sva-studio-login',
    authClientSecretConfigured: false,
    tenantAdminClient: {
      clientId: 'sva-studio-realm-admin',
      secretConfigured: false,
    },
    tenantAdminBootstrap: {
      username: 'demo-admin',
      email: 'demo@example.org',
      firstName: 'Demo',
      lastName: 'Admin',
    },
    hostnames: [],
    provisioningRuns: [],
    auditEvents: [],
    keycloakPreflight: undefined,
    keycloakPlan: undefined,
    keycloakProvisioningRuns: [],
    keycloakStatus: undefined,
    latestKeycloakProvisioningRun: undefined,
    tenantIamStatus: {
      configuration: { status: 'unknown', summary: 'Konfiguration unbekannt', source: 'registry' },
      access: { status: 'unknown', summary: 'Probe ausstehend', source: 'access_probe' },
      reconcile: { status: 'unknown', summary: 'Reconcile ausstehend', source: 'role_reconcile' },
      overall: { status: 'unknown', summary: 'Unbekannt', source: 'registry' },
    },
    ...overrides,
  }) as const;

describe('instance detail split helpers', () => {
  it('maps cockpit helper labels and statuses across all public helper branches', () => {
    expect(mapConfigurationStatusToCockpitStatus('complete')).toBe('ready');
    expect(mapConfigurationStatusToCockpitStatus('degraded')).toBe('degraded');
    expect(mapConfigurationStatusToCockpitStatus('incomplete')).toBe('blocked');
    expect(mapConfigurationStatusToCockpitStatus('unknown')).toBe('unknown');

    expect(getCockpitSourceLabel('access_probe')).toContain('Rechteprobe');
    expect(getCockpitSourceLabel('role_reconcile')).toContain('Rollenabgleich');
    expect(getCockpitSourceLabel('keycloak_status_snapshot')).toContain('Strukturstatus');
    expect(getCockpitSourceLabel('keycloak_provisioning_run')).toContain('Provisioning');
    expect(getCockpitSourceLabel('registry')).toContain('Registry');
    expect(getCockpitSourceLabel('custom-source')).toBe('custom-source');

    for (const action of [
      'check_preflight',
      'check_keycloak_status',
      'plan_provisioning',
      'execute_provisioning',
      'provision_admin_client',
      'reset_tenant_admin',
      'activate_instance',
      'rotate_client_secret',
      'probeTenantIamAccess',
      'reconcileKeycloak',
    ] as const) {
      expect(getDetailActionLabel(action)).toEqual(expect.any(String));
    }
  });

  it('maps split error messages for diagnostics, classifications, codes, and fallback', () => {
    expect(
      getErrorMessage({
        name: 'IamHttpError',
        status: 500,
        code: 'internal_error',
        message: 'läuft',
        diagnosticStatus: 'recovery_laeuft',
      } as never),
    ).toContain('wiederhergestellt');
    expect(
      getErrorMessage({
        name: 'IamHttpError',
        status: 409,
        code: 'conflict',
        message: 'drift',
        classification: 'database_or_schema_drift',
      } as never),
    ).toContain('Datenbank');
    expect(
      getErrorMessage({
        name: 'IamHttpError',
        status: 502,
        code: 'tenant_admin_client_secret_missing',
        message: 'fehlt',
      }),
    ).toContain('Tenant-Admin-Client-Secret');
    expect(
      getErrorMessage({
        name: 'IamHttpError',
        status: 409,
        code: 'internal_error',
        message: 'drift',
        classification: 'registry_or_provisioning_drift',
      } as never),
    ).toContain('Registry');
    expect(
      getErrorMessage({
        name: 'IamHttpError',
        status: 409,
        code: 'internal_error',
        message: 'reconcile',
        classification: 'keycloak_reconcile',
      } as never),
    ).toContain('Abgleich');
    for (const code of [
      'unauthorized',
      'forbidden',
      'csrf_validation_failed',
      'reauth_required',
      'conflict',
      'database_unavailable',
      'tenant_auth_client_secret_missing',
      'tenant_admin_client_not_configured',
      'tenant_admin_client_secret_missing',
      'keycloak_unavailable',
      'encryption_not_configured',
    ] as const) {
      expect(
        getErrorMessage({
          name: 'IamHttpError',
          status: 500,
          code,
          message: code,
        } as never),
      ).toEqual(expect.any(String));
    }
    expect(getErrorMessage(null)).toBe('Die Instanzverwaltung konnte nicht geladen werden.');
  });

  it('derives tenant iam status from keycloak facts and falls back safely without evidence', () => {
    expect(getEffectiveTenantIamStatus(createDetailFixture({ tenantIamStatus: undefined }))).toBeUndefined();

    const readyStatus = getEffectiveTenantIamStatus(
      createDetailFixture({
        keycloakStatus: {
          realmExists: true,
          clientExists: true,
          tenantAdminClientExists: true,
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          tenantAdminHasInstanceRegistryAdmin: true,
          redirectUrisMatch: true,
          logoutUrisMatch: true,
          webOriginsMatch: true,
          clientSecretConfigured: true,
          tenantClientSecretReadable: true,
          clientSecretAligned: true,
          tenantAdminClientSecretConfigured: true,
          tenantAdminClientSecretReadable: true,
          tenantAdminClientSecretAligned: true,
          runtimeSecretSource: 'tenant',
        },
        tenantIamStatus: {
          configuration: { status: 'blocked', summary: 'Alt', source: 'registry', requestId: 'req-config' },
          access: { status: 'ready', summary: 'ok', source: 'access_probe' },
          reconcile: { status: 'ready', summary: 'ok', source: 'role_reconcile' },
          overall: { status: 'blocked', summary: 'Alt', source: 'registry' },
        },
      }),
    );

    expect(readyStatus).toMatchObject({
      configuration: {
        status: 'degraded',
        source: 'keycloak_status_snapshot',
        requestId: 'req-config',
      },
      overall: {
        status: 'degraded',
        source: 'keycloak_status_snapshot',
      },
    });
  });

  it('derives cockpit state from registry, preflight, provisioning, and mutation evidence', () => {
    const blockedState = buildCockpitState(
      createDetailFixture({
        status: 'failed',
        keycloakPreflight: {
          overallStatus: 'blocked',
          checkedAt: '2026-02-01T00:00:00.000Z',
          checks: [],
        },
        latestKeycloakProvisioningRun: {
          id: 'run-failed',
          intent: 'provision',
          mode: 'new',
          overallStatus: 'failed',
          driftSummary: 'Drift',
          requestId: 'req-run',
          finishedAt: '2026-02-01T00:00:00.000Z',
          steps: [],
        },
        tenantIamStatus: {
          configuration: { status: 'ready', summary: 'ok', source: 'registry' },
          access: { status: 'ready', summary: 'ok', source: 'access_probe' },
          reconcile: { status: 'ready', summary: 'ok', source: 'role_reconcile' },
          overall: { status: 'ready', summary: 'ok', source: 'registry' },
        },
      }),
      {
        overallStatus: 'degraded',
        title: 'Konfiguration teilweise',
        body: 'Warnungen',
        statusLabel: 'Teilweise',
        satisfiedRequirements: 3,
        totalRequirements: 5,
        blockingIssues: [],
        warningIssues: [{ key: 'warning', label: 'Warnung', severity: 'warning' }],
      },
      {
        name: 'IamHttpError',
        status: 503,
        code: 'database_unavailable',
        message: 'db',
        requestId: 'req-db',
      },
    );

    expect(blockedState.overallStatus).toBe('blocked');
    expect(blockedState.overallTitle).toBe('Blockiert');
    expect(blockedState.dominantEvidence.source).toBe('keycloak_status_snapshot');
    expect(blockedState.anomalyQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'configuration', status: 'degraded' }),
        expect.objectContaining({ key: 'latest-run', requestId: 'req-run' }),
        expect.objectContaining({ key: 'mutation_error', requestId: 'req-db', status: 'degraded' }),
      ]),
    );

    const registryState = buildCockpitState(
      createDetailFixture({
        keycloakPreflight: undefined,
        latestKeycloakProvisioningRun: undefined,
        keycloakProvisioningRuns: [],
        tenantIamStatus: {
          configuration: { status: 'ready', summary: 'ok', source: 'registry' },
          access: { status: 'ready', summary: 'ok', source: 'access_probe' },
          reconcile: { status: 'ready', summary: 'ok', source: 'role_reconcile' },
          overall: { status: 'ready', summary: 'IAM ok', source: 'registry' },
        },
      }),
      {
        overallStatus: 'complete',
        title: 'Vollständig',
        body: 'Alles ok',
        statusLabel: 'Vollständig',
        satisfiedRequirements: 5,
        totalRequirements: 5,
        blockingIssues: [],
        warningIssues: [],
      },
      null,
    );

    expect(registryState.dominantEvidence.source).toBe('registry');
    expect(registryState.overallSummary).toBe('Tenant-IAM ist betriebsbereit.');
  });

  it('selects split cockpit primary actions for activation, tenant access probing, and reconcile', () => {
    expect(
      buildInstanceDetailCockpitModel(
        createDetailFixture({
          status: 'validated',
          latestKeycloakProvisioningRun: {
            id: 'run-success',
            intent: 'provision',
            mode: 'new',
            overallStatus: 'succeeded',
            driftSummary: 'Erfolgreich',
            requestId: 'req-run',
            steps: [],
          },
          tenantIamStatus: {
            configuration: { status: 'ready', summary: 'ok', source: 'registry' },
            access: { status: 'ready', summary: 'ok', source: 'access_probe' },
            reconcile: { status: 'ready', summary: 'ok', source: 'role_reconcile' },
            overall: { status: 'ready', summary: 'ok', source: 'registry' },
          },
        }),
        null,
      ).primaryAction.action,
    ).toBe('activate_instance');

    expect(
      buildInstanceDetailCockpitModel(
        createDetailFixture({
          tenantIamStatus: {
            configuration: { status: 'ready', summary: 'ok', source: 'registry' },
            access: { status: 'degraded', summary: 'Probe ausstehend', source: 'access_probe' },
            reconcile: { status: 'ready', summary: 'ok', source: 'role_reconcile' },
            overall: { status: 'degraded', summary: 'Probe ausstehend', source: 'access_probe' },
          },
        }),
        null,
      ).primaryAction.action,
    ).toBe('probeTenantIamAccess');

    expect(
      buildInstanceDetailCockpitModel(
        createDetailFixture({
          tenantIamStatus: {
            configuration: { status: 'ready', summary: 'ok', source: 'registry' },
            access: { status: 'ready', summary: 'ok', source: 'access_probe' },
            reconcile: { status: 'blocked', summary: 'Drift', source: 'role_reconcile' },
            overall: { status: 'blocked', summary: 'Drift', source: 'role_reconcile' },
          },
        }),
        null,
      ).primaryAction.action,
    ).toBe('reconcileKeycloak');
  });

  it('maps status guidance and keycloak entries for empty and populated detail states', () => {
    expect(getKeycloakStatusEntries({ keycloakStatus: undefined } as never)).toEqual([]);

    const keycloakEntries = getKeycloakStatusEntries({
      keycloakStatus: createKeycloakStatusFixture({
        tenantAdminHasInstanceRegistryAdmin: true,
        runtimeSecretSource: 'registry',
      }),
    } as never);

    expect(keycloakEntries).toContainEqual([
      'admin.instances.keycloakStatus.tenantAdminHasInstanceRegistryAdmin',
      false,
    ]);
    expect(keycloakEntries).toContainEqual([
      'admin.instances.keycloakStatus.runtimeSecretSourceTenant',
      false,
    ]);

    for (const status of [
      'requested',
      'validated',
      'provisioning',
      'active',
      'failed',
      'suspended',
      'archived',
    ] as const) {
      expect(getStatusGuidance({ status } as never)).toEqual({
        title: expect.any(String),
        body: expect.any(String),
      });
    }
  });

  it('builds split workflow steps for generated secrets, blocked admin client setup, and activation', () => {
    const newRealmSteps = getSetupWorkflowSteps(
      createDetailFixture({
        realmMode: 'new',
        authClientSecretConfigured: false,
        tenantAdminClient: {
          clientId: '',
          secretConfigured: false,
        },
      }),
      null,
    );

    expect(newRealmSteps.find((step) => step.key === 'tenantSecret')).toMatchObject({
      status: 'pending',
      action: 'rotate_client_secret',
    });
    expect(newRealmSteps.find((step) => step.key === 'tenantAdminClient')).toMatchObject({
      status: 'blocked',
      action: 'provision_admin_client',
    });

    const activatedSteps = getSetupWorkflowSteps(
      createDetailFixture({
        status: 'validated',
        latestKeycloakProvisioningRun: {
          id: 'run-success',
          intent: 'provision',
          mode: 'new',
          overallStatus: 'succeeded',
          driftSummary: 'Erfolgreich',
          requestId: 'req-run',
          steps: [],
        },
      }),
      { name: 'IamHttpError', status: 502, code: 'keycloak_unavailable', message: 'kaputt' },
    );

    expect(activatedSteps.find((step) => step.key === 'keycloakAccess')).toMatchObject({
      status: 'blocked',
      action: 'check_preflight',
    });
    expect(activatedSteps.find((step) => step.key === 'activation')).toMatchObject({
      status: 'current',
      action: 'activate_instance',
    });
  });

  it('covers workflow step branches for ready, pending, blocked, running, failed, and active states', () => {
    const readySteps = getSetupWorkflowSteps(
      createDetailFixture({
        realmMode: 'existing',
        status: 'active',
        authClientSecretConfigured: true,
        tenantAdminClient: {
          clientId: 'sva-studio-realm-admin',
          secretConfigured: true,
        },
        tenantAdminBootstrap: {
          username: 'demo-admin',
          email: 'demo@example.org',
          firstName: 'Demo',
          lastName: 'Admin',
        },
        keycloakPreflight: {
          overallStatus: 'ready',
          checks: [
            { checkKey: 'keycloak_admin_access', status: 'ready', title: '', summary: '' },
            { checkKey: 'realm_mode', status: 'ready', title: '', summary: '' },
          ],
        },
        keycloakStatus: createKeycloakStatusFixture({
          tenantAdminHasInstanceRegistryAdmin: false,
        }),
        latestKeycloakProvisioningRun: {
          id: 'run-success',
          intent: 'provision',
          mode: 'existing',
          overallStatus: 'succeeded',
          driftSummary: 'Erledigt',
          steps: [],
        },
      }),
      null,
    );

    expect(readySteps.find((step) => step.key === 'realm')).toMatchObject({ status: 'done' });
    expect(readySteps.find((step) => step.key === 'client')).toMatchObject({ status: 'done' });
    expect(readySteps.find((step) => step.key === 'mapper')).toMatchObject({ status: 'done' });
    expect(readySteps.find((step) => step.key === 'tenantAdminClient')).toMatchObject({ status: 'done' });
    expect(readySteps.find((step) => step.key === 'tenantSecret')).toMatchObject({ status: 'done' });
    expect(readySteps.find((step) => step.key === 'tenantAdmin')).toMatchObject({ status: 'done' });
    expect(readySteps.find((step) => step.key === 'provisioning')).toMatchObject({ status: 'done' });
    expect(readySteps.find((step) => step.key === 'activation')).toMatchObject({
      status: 'done',
      action: 'activate_instance',
    });

    const runningSteps = getSetupWorkflowSteps(
      createDetailFixture({
        realmMode: 'existing',
        authClientSecretConfigured: true,
        tenantAdminClient: {
          clientId: 'sva-studio-realm-admin',
          secretConfigured: true,
        },
        keycloakPreflight: {
          overallStatus: 'ready',
          checks: [{ checkKey: 'keycloak_admin_access', status: 'blocked', title: '', summary: '' }],
        },
        keycloakStatus: createKeycloakStatusFixture({
          realmExists: false,
          clientExists: false,
          tenantAdminClientExists: false,
          tenantAdminExists: false,
          tenantAdminHasSystemAdmin: false,
          tenantAdminHasInstanceRegistryAdmin: true,
          tenantAdminClientSecretConfigured: false,
          tenantAdminClientSecretReadable: false,
          tenantAdminClientSecretAligned: false,
          clientSecretAligned: false,
        }),
        latestKeycloakProvisioningRun: {
          id: 'run-running',
          intent: 'provision',
          mode: 'existing',
          overallStatus: 'running',
          driftSummary: 'Läuft',
          steps: [],
        },
      }),
      null,
    );

    expect(runningSteps.find((step) => step.key === 'keycloakAccess')).toMatchObject({ status: 'current' });
    expect(runningSteps.find((step) => step.key === 'realm')).toMatchObject({ status: 'pending' });
    expect(runningSteps.find((step) => step.key === 'client')).toMatchObject({ status: 'pending' });
    expect(runningSteps.find((step) => step.key === 'mapper')).toMatchObject({ status: 'done' });
    expect(runningSteps.find((step) => step.key === 'tenantAdminClient')).toMatchObject({ status: 'current' });
    expect(runningSteps.find((step) => step.key === 'tenantSecret')).toMatchObject({ status: 'current' });
    expect(runningSteps.find((step) => step.key === 'tenantAdmin')).toMatchObject({ status: 'current' });
    expect(runningSteps.find((step) => step.key === 'provisioning')).toMatchObject({
      status: 'current',
      action: 'execute_provisioning',
    });

    const failedSteps = getSetupWorkflowSteps(
      createDetailFixture({
        realmMode: 'existing',
        authClientSecretConfigured: false,
        tenantAdminClient: {
          clientId: 'configured-client',
          secretConfigured: false,
        },
        tenantAdminBootstrap: {
          username: '',
          email: '',
          firstName: '',
          lastName: '',
        },
        keycloakPreflight: {
          overallStatus: 'blocked',
          checks: [{ checkKey: 'realm_mode', status: 'blocked', title: '', summary: '' }],
        },
        keycloakStatus: undefined,
        latestKeycloakProvisioningRun: {
          id: 'run-failed',
          intent: 'provision',
          mode: 'existing',
          overallStatus: 'failed',
          driftSummary: 'Fehler',
          steps: [],
        },
      }),
      {
        name: 'IamHttpError',
        status: 502,
        code: 'keycloak_unavailable',
        message: 'kaputt',
      },
    );

    expect(failedSteps.find((step) => step.key === 'realm')).toMatchObject({ status: 'blocked' });
    expect(failedSteps.find((step) => step.key === 'tenantAdminClient')).toMatchObject({ status: 'blocked' });
    expect(failedSteps.find((step) => step.key === 'tenantSecret')).toMatchObject({ status: 'blocked' });
    expect(failedSteps.find((step) => step.key === 'tenantAdmin')).toMatchObject({ status: 'blocked' });
    expect(failedSteps.find((step) => step.key === 'provisioning')).toMatchObject({
      status: 'blocked',
      action: 'plan_provisioning',
    });
    expect(failedSteps.find((step) => step.key === 'activation')).toMatchObject({ status: 'pending' });
  });
});
