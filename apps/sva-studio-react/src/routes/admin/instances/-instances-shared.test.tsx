import { describe, expect, it } from 'vitest';

import * as instancesShared from './-instances-shared';
import {
  createEmptyCreateForm,
  evaluateInstanceConfiguration,
  getCreateReadinessChecks,
  getErrorMessage,
  getCreateStepValidationMessages,
  getKeycloakStatusEntries,
  getPostCreateGuidance,
  getSetupWorkflowSteps,
  getStatusGuidance,
} from './-instances-shared';

describe('instances shared helpers', () => {
  it('returns step validation messages for missing create inputs', () => {
    const formValues = createEmptyCreateForm('');

    expect(getCreateStepValidationMessages('basics', formValues)).toEqual([
      'Bitte eine Instanz-ID angeben.',
      'Bitte einen Anzeigenamen angeben.',
      'Bitte eine Parent-Domain angeben.',
    ]);
    expect(getCreateStepValidationMessages('auth', formValues)).toEqual([
      'Bitte ein Auth-Realm angeben.',
    ]);
  });

  it('maps unauthorized instance errors to the session guidance message', () => {
    expect(
      getErrorMessage({
        name: 'IamHttpError',
        status: 401,
        code: 'unauthorized',
        message: 'Unauthorized',
      })
    ).toBe('Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.');
  });

  it('maps readiness and post-create guidance for a requested instance', () => {
    const formValues = createEmptyCreateForm('studio.smart-village.app');
    formValues.authClientSecret = 'tenant-secret';
    formValues.tenantAdminBootstrap.username = 'svs.admin';

    expect(getCreateReadinessChecks(formValues)).toEqual([
      {
        key: 'secret',
        title: 'Tenant-Client-Secret',
        ready: true,
        summary: 'Ein Secret wird mit der Instanz gespeichert und kann im Provisioning direkt geprüft werden.',
      },
      {
        key: 'tenantAdmin',
        title: 'Initialer Tenant-Admin',
        ready: true,
        summary: 'Ein Tenant-Admin ist hinterlegt und kann beim ersten Bootstrap oder Reset verwendet werden.',
      },
      {
        key: 'followUp',
        title: 'Nächster Betriebs-Schritt',
        ready: false,
        summary: 'Nach dem Speichern folgt im Detail die technische Prüfung und das Keycloak-Provisioning.',
      },
    ]);

    expect(
      getPostCreateGuidance({
        instanceId: 'hb-meinquartier',
        status: 'requested',
        primaryHostname: 'hb-meinquartier.studio.smart-village.app',
        authRealm: 'saas-hb-meinquartier',
      })
    ).toEqual({
      title: 'Instanz gespeichert',
      summary: 'Die Instanz hb-meinquartier wurde in der Registry angelegt. Aktueller Status: Angefordert.',
      nextSteps: [
        'Öffnen Sie die Detailseite, um den technischen Zustand der Instanz zu prüfen.',
        'Führen Sie dort den Keycloak-Abgleich für Realm saas-hb-meinquartier aus.',
        'Aktivieren Sie die Instanz erst nach erfolgreichem Provisioning für hb-meinquartier.studio.smart-village.app.',
      ],
    });
  });

  it('treats the tenant secret as generated follow-up state for new realms', () => {
    const formValues = createEmptyCreateForm('studio.smart-village.app');
    formValues.realmMode = 'new';
    formValues.authRealm = 'saas-demo';

    expect(getCreateReadinessChecks(formValues)).toContainEqual({
      key: 'secret',
      title: 'Tenant-Client-Secret',
      ready: true,
      summary: 'Bei einem neuen Realm wird das Tenant-Client-Secret erst beim Provisioning erzeugt und danach gespeichert.',
    });

    const workflow = getSetupWorkflowSteps(
      {
        instanceId: 'demo',
        displayName: 'Demo',
        status: 'requested',
        featureFlags: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: false,
        hostnames: [],
        provisioningRuns: [],
        auditEvents: [],
        keycloakPreflight: undefined,
        keycloakPlan: undefined,
        keycloakProvisioningRuns: [],
        tenantAdminBootstrap: undefined,
        keycloakStatus: undefined,
        latestKeycloakProvisioningRun: undefined,
      } as const,
      null
    );

    expect(workflow.find((step) => step.key === 'tenantSecret')).toMatchObject({
      status: 'pending',
      description: 'Für neue Realms wird das Tenant-Client-Secret erst beim Provisioning erzeugt und danach gespeichert.',
    });
  });

  it('maps setup workflow and status guidance for a blocked requested instance', () => {
    const instance = {
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'requested',
      featureFlags: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: false,
      hostnames: [],
      provisioningRuns: [],
      auditEvents: [],
      keycloakPreflight: {
        overallStatus: 'blocked',
        generatedAt: '2026-01-01T00:00:00.000Z',
        checkedAt: '2026-01-01T00:00:00.000Z',
        checks: [
          {
            checkKey: 'keycloak_admin_access',
            status: 'blocked',
            title: 'Keycloak erreichbar',
            summary: 'Kein Zugriff.',
            details: {},
          },
          {
            checkKey: 'realm_mode',
            status: 'blocked',
            title: 'Realm-Modus',
            summary: 'Realm fehlt.',
            details: {},
          },
        ],
      },
      keycloakPlan: undefined,
      keycloakProvisioningRuns: [],
      tenantAdminBootstrap: undefined,
      keycloakStatus: undefined,
      latestKeycloakProvisioningRun: undefined,
    } as const;

    const workflow = getSetupWorkflowSteps(instance, {
      name: 'IamHttpError',
      status: 502,
      code: 'keycloak_unavailable',
      message: 'kaputt',
    });

    expect(workflow.map((step) => [step.key, step.status])).toEqual([
      ['registry', 'done'],
      ['keycloakAccess', 'blocked'],
      ['realm', 'blocked'],
      ['client', 'blocked'],
      ['tenantAdminClient', 'blocked'],
      ['mapper', 'blocked'],
      ['tenantSecret', 'blocked'],
      ['tenantAdmin', 'blocked'],
      ['provisioning', 'current'],
      ['activation', 'pending'],
    ]);
    expect(getStatusGuidance(instance)).toEqual({
      title: 'Instanz gespeichert, aber noch nicht betriebsbereit',
      body: 'Die Registry-Daten sind angelegt. Als Nächstes sollten Sie den Keycloak-Status prüfen und das Provisioning ausführen.',
    });
  });

  it('marks tenant admin status as not fulfilled when the instanceId attribute is missing', () => {
    const entries = getKeycloakStatusEntries({
      keycloakStatus: {
        realmExists: true,
        clientExists: true,
        instanceIdMapperExists: true,
        tenantAdminExists: true,
        tenantAdminHasSystemAdmin: true,
        tenantAdminHasInstanceRegistryAdmin: false,
        tenantAdminInstanceIdMatches: false,
        redirectUrisMatch: true,
        logoutUrisMatch: true,
        webOriginsMatch: true,
        clientSecretConfigured: true,
        tenantClientSecretReadable: true,
        clientSecretAligned: true,
        runtimeSecretSource: 'tenant',
      },
    } as never);

    expect(entries).toContainEqual([
      'admin.instances.keycloakStatus.tenantAdminInstanceIdMatches',
      false,
    ]);
    expect(entries).toContainEqual([
      'admin.instances.keycloakStatus.tenantAdminHasInstanceRegistryAdmin',
      true,
    ]);
  });

  it('uses intent-specific workflow actions for tenant admin client and tenant admin steps', () => {
    const workflow = getSetupWorkflowSteps(
      {
        instanceId: 'demo',
        displayName: 'Demo',
        status: 'requested',
        featureFlags: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        tenantAdminClient: {
          clientId: 'demo-admin-client',
          secretConfigured: false,
        },
        hostnames: [],
        provisioningRuns: [],
        auditEvents: [],
        keycloakPreflight: undefined,
        keycloakPlan: undefined,
        keycloakProvisioningRuns: [],
        tenantAdminBootstrap: {
          username: 'demo-admin',
        },
        keycloakStatus: {
          realmExists: true,
          clientExists: true,
          tenantAdminClientExists: false,
          instanceIdMapperExists: true,
          tenantAdminExists: false,
          tenantAdminHasSystemAdmin: false,
          tenantAdminHasInstanceRegistryAdmin: false,
          tenantAdminInstanceIdMatches: false,
          redirectUrisMatch: true,
          logoutUrisMatch: true,
          webOriginsMatch: true,
          clientSecretConfigured: true,
          tenantClientSecretReadable: true,
          clientSecretAligned: true,
          tenantAdminClientSecretConfigured: false,
          tenantAdminClientSecretReadable: false,
          tenantAdminClientSecretAligned: false,
          runtimeSecretSource: 'tenant',
        },
        latestKeycloakProvisioningRun: undefined,
      } as const,
      null
    );

    expect(workflow.find((step) => step.key === 'tenantAdminClient')?.action).toBe('provision_admin_client');
    expect(workflow.find((step) => step.key === 'tenantAdmin')?.action).toBe('reset_tenant_admin');
  });

  it('evaluates the configuration as incomplete when canonical requirements are missing', () => {
    const assessment = evaluateInstanceConfiguration(
      {
        instanceId: 'demo',
        displayName: 'Demo',
        status: 'active',
        featureFlags: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        tenantAdminClient: {
          clientId: 'demo-admin-client',
          secretConfigured: false,
        },
        hostnames: [],
        provisioningRuns: [],
        auditEvents: [],
        keycloakPreflight: undefined,
        keycloakPlan: undefined,
        keycloakProvisioningRuns: [],
        tenantAdminBootstrap: {
          username: 'demo-admin',
        },
        keycloakStatus: {
          realmExists: true,
          clientExists: true,
          tenantAdminClientExists: false,
          instanceIdMapperExists: true,
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          tenantAdminHasInstanceRegistryAdmin: false,
          tenantAdminInstanceIdMatches: true,
          redirectUrisMatch: true,
          logoutUrisMatch: true,
          webOriginsMatch: true,
          clientSecretConfigured: true,
          tenantClientSecretReadable: true,
          clientSecretAligned: true,
          tenantAdminClientSecretConfigured: false,
          tenantAdminClientSecretReadable: false,
          tenantAdminClientSecretAligned: false,
          runtimeSecretSource: 'tenant',
        },
        latestKeycloakProvisioningRun: undefined,
      } as const,
      null
    );

    expect(assessment.overallStatus).toBe('incomplete');
    expect(assessment.blockingIssues.map((issue) => issue.key)).toEqual([
      'tenant_admin_client',
      'tenant_admin_client_secret',
    ]);
  });

  it('builds a cockpit model with a single primary action and prioritizes current evidence over history', () => {
    const buildInstanceDetailCockpitModel = (instancesShared as Record<string, unknown>)
      .buildInstanceDetailCockpitModel;

    expect(buildInstanceDetailCockpitModel).toBeTypeOf('function');
    if (typeof buildInstanceDetailCockpitModel !== 'function') {
      return;
    }

    const model = buildInstanceDetailCockpitModel(
      {
        instanceId: 'demo',
        displayName: 'Demo',
        status: 'validated',
        featureFlags: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        hostnames: [],
        provisioningRuns: [
          {
            id: 'registry-run-1',
            operation: 'provision',
            status: 'failed',
            startedAt: '2025-12-31T23:00:00.000Z',
            completedAt: '2025-12-31T23:10:00.000Z',
          },
        ],
        auditEvents: [],
        keycloakPreflight: {
          overallStatus: 'ready',
          generatedAt: '2026-01-02T08:00:00.000Z',
          checkedAt: '2026-01-02T08:00:00.000Z',
          checks: [
            {
              checkKey: 'keycloak_admin_access',
              status: 'ready',
              title: 'Keycloak erreichbar',
              summary: 'Technischer Zugriff ist vorhanden.',
              details: {},
            },
          ],
        },
        keycloakPlan: {
          mode: 'existing',
          overallStatus: 'ready',
          generatedAt: '2026-01-02T08:05:00.000Z',
          driftSummary: 'Kein Drift.',
          steps: [],
        },
        keycloakProvisioningRuns: [
          {
            id: 'run-1',
            intent: 'provision',
            mode: 'existing',
            overallStatus: 'succeeded',
            driftSummary: 'Kein Drift.',
            requestId: 'req-1',
            startedAt: '2026-01-02T08:10:00.000Z',
            finishedAt: '2026-01-02T08:11:00.000Z',
            steps: [],
          },
        ],
        latestKeycloakProvisioningRun: {
          id: 'run-1',
          intent: 'provision',
          mode: 'existing',
          overallStatus: 'succeeded',
          driftSummary: 'Kein Drift.',
          requestId: 'req-1',
          startedAt: '2026-01-02T08:10:00.000Z',
          finishedAt: '2026-01-02T08:11:00.000Z',
          steps: [],
        },
        tenantIamStatus: {
          configuration: {
            status: 'ready',
            summary: 'Konfiguration ok',
            source: 'keycloak_status_snapshot',
          },
          access: {
            status: 'unknown',
            summary: 'Noch keine Probe',
            source: 'access_probe',
          },
          reconcile: {
            status: 'degraded',
            summary: 'Backlog vorhanden',
            source: 'role_reconcile',
            checkedAt: '2026-01-02T08:15:00.000Z',
            requestId: 'reconcile-1',
          },
          overall: {
            status: 'degraded',
            summary: 'Eingeschränkt',
            source: 'role_reconcile',
            checkedAt: '2026-01-02T08:15:00.000Z',
            requestId: 'reconcile-1',
          },
        },
      },
      null
    );

    expect(model.primaryAction.action).toBe('activate_instance');
    expect(model.secondaryActions.some((action: { action: string }) => action.action === 'probeTenantIamAccess')).toBe(true);
    expect(model.dominantEvidence.source).toBe('role_reconcile');
    expect(model.dominantEvidence.checkedAt).toBe('2026-01-02T08:15:00.000Z');
    expect(model.anomalyQueue).toHaveLength(2);
    expect(model.anomalyQueue.map((item: { title: string }) => item.title)).toEqual([
      'Tenant-IAM-Zugriff',
      'Tenant-IAM-Reconcile',
    ]);
  });

  it('limits the anomaly queue to three items and does not derive a green overall state from unknown tenant access', () => {
    const buildInstanceDetailCockpitModel = (instancesShared as Record<string, unknown>)
      .buildInstanceDetailCockpitModel;

    expect(buildInstanceDetailCockpitModel).toBeTypeOf('function');
    if (typeof buildInstanceDetailCockpitModel !== 'function') {
      return;
    }

    const model = buildInstanceDetailCockpitModel(
      {
        instanceId: 'demo',
        displayName: 'Demo',
        status: 'active',
        featureFlags: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        hostnames: [],
        provisioningRuns: [],
        auditEvents: [],
        keycloakPreflight: {
          overallStatus: 'ready',
          generatedAt: '2026-01-02T08:00:00.000Z',
          checkedAt: '2026-01-02T08:00:00.000Z',
          checks: [
            {
              checkKey: 'keycloak_admin_access',
              status: 'ready',
              title: 'Keycloak erreichbar',
              summary: 'Technischer Zugriff ist vorhanden.',
              details: {},
            },
          ],
        },
        keycloakPlan: {
          mode: 'existing',
          overallStatus: 'ready',
          generatedAt: '2026-01-02T08:05:00.000Z',
          driftSummary: 'Kein Drift.',
          steps: [],
        },
        keycloakProvisioningRuns: [],
        latestKeycloakProvisioningRun: undefined,
        tenantIamStatus: {
          configuration: {
            status: 'ready',
            summary: 'Konfiguration ok',
            source: 'keycloak_status_snapshot',
          },
          access: {
            status: 'unknown',
            summary: 'Noch keine Rechteprobe',
            source: 'access_probe',
          },
          reconcile: {
            status: 'blocked',
            summary: 'Reconcile blockiert',
            source: 'role_reconcile',
            checkedAt: '2026-01-02T08:15:00.000Z',
          },
          overall: {
            status: 'blocked',
            summary: 'Tenant IAM blockiert',
            source: 'role_reconcile',
            checkedAt: '2026-01-02T08:15:00.000Z',
          },
        },
        keycloakStatus: {
          realmExists: true,
          clientExists: true,
          tenantAdminClientExists: true,
          instanceIdMapperExists: false,
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          tenantAdminHasInstanceRegistryAdmin: false,
          tenantAdminInstanceIdMatches: false,
          redirectUrisMatch: true,
          logoutUrisMatch: true,
          webOriginsMatch: true,
          clientSecretConfigured: true,
          tenantClientSecretReadable: true,
          clientSecretAligned: false,
          tenantAdminClientSecretConfigured: true,
          tenantAdminClientSecretReadable: true,
          tenantAdminClientSecretAligned: false,
          runtimeSecretSource: 'global',
        },
      },
      {
        name: 'IamHttpError',
        status: 409,
        code: 'conflict',
        message: 'conflict',
        classification: 'registry_or_provisioning_drift',
        requestId: 'req-drift',
      }
    );

    expect(model.overallStatus).toBe('blocked');
    expect(model.anomalyQueue).toHaveLength(3);
    expect(model.anomalyQueue.every((item: { status: string }) => item.status !== 'ready')).toBe(true);
    expect(model.primaryAction.action).toBe('probeTenantIamAccess');
  });
});
