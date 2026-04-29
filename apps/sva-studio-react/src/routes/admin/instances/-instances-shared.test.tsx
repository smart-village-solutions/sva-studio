import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as instancesShared from './-instances-shared';
import {
  createEmptyCreateForm,
  evaluateInstanceConfiguration,
  getCreateReadinessChecks,
  getErrorMessage,
  getCreateStepValidationMessages,
  getEffectiveTenantIamStatus,
  getKeycloakStatusEntries,
  getPostCreateGuidance,
  getSetupWorkflowSteps,
  getStatusGuidance,
  readSuggestedParentDomain,
} from './-instances-shared';

describe('instances shared helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

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

  it('maps diagnostic and fallback error variants to localized messages', () => {
    expect(
      getErrorMessage({
        name: 'IamHttpError',
        status: 500,
        code: 'internal_error',
        message: 'Recovery',
        diagnosticStatus: 'recovery_laeuft',
      } as never)
    ).toContain('wiederhergestellt');
    expect(
      getErrorMessage({
        name: 'IamHttpError',
        status: 409,
        code: 'conflict',
        message: 'drift',
        classification: 'database_or_schema_drift',
      } as never)
    ).toContain('Datenbank');
    expect(
      getErrorMessage({
        name: 'IamHttpError',
        status: 419,
        code: 'csrf_validation_failed',
        message: 'csrf',
      } as never)
    ).toContain('Sicherheitsprüfung');
    expect(getErrorMessage({ name: 'IamHttpError', status: 500, code: 'unknown', message: 'boom' } as never)).toContain(
      'Instanz'
    );
  });

  it('reads the suggested parent domain from window and falls back safely for invalid urls', () => {
    vi.stubGlobal('window', { location: { href: 'https://demo.studio.example.org/admin/instances' } });
    expect(readSuggestedParentDomain()).toBe('demo.studio.example.org');

    vi.stubGlobal('window', { location: { href: 'not a url' } });
    expect(readSuggestedParentDomain()).toBe('');
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
        assignedModules: [],
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: false,
        assignedModules: [],
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
      assignedModules: [],
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: false,
      assignedModules: [],
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
        assignedModules: [],
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        assignedModules: [],
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
        assignedModules: [],
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        assignedModules: [],
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
        assignedModules: [],
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
        assignedModules: [],
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

  it('prefers the current keycloak structure over stale tenant IAM configuration evidence', () => {
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
        assignedModules: [],
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        hostnames: [],
        provisioningRuns: [],
        auditEvents: [],
        keycloakPreflight: undefined,
        keycloakPlan: undefined,
        keycloakProvisioningRuns: [
          {
            id: 'run-1',
            intent: 'provision',
            mode: 'existing',
            overallStatus: 'succeeded',
            driftSummary: 'Kein Drift.',
            requestId: 'req-1',
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
          steps: [],
        },
        tenantIamStatus: {
          configuration: {
            status: 'degraded',
            summary: 'Tenant-IAM-Struktur ist unvollständig oder driftet.',
            source: 'keycloak_status_snapshot',
          },
          access: {
            status: 'ready',
            summary: 'Tenant-Admin-Client kann Realm-Rollen lesen.',
            source: 'access_probe',
            requestId: 'req-access-1',
          },
          reconcile: {
            status: 'ready',
            summary: 'Letzter Rollenabgleich ist synchron.',
            source: 'role_reconcile',
            requestId: 'req-reconcile-1',
          },
          overall: {
            status: 'degraded',
            summary: 'Tenant-IAM ist eingeschränkt.',
            source: 'keycloak_status_snapshot',
          },
        },
        keycloakStatus: {
          realmExists: true,
          clientExists: true,
          tenantAdminClientExists: true,
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
          tenantAdminClientSecretConfigured: true,
          tenantAdminClientSecretReadable: true,
          tenantAdminClientSecretAligned: true,
          runtimeSecretSource: 'tenant',
        },
      },
      null
    );

    expect(model.overallStatus).toBe('ready');
    expect(model.overallSummary).toBe('Tenant-IAM ist betriebsbereit.');
    expect(model.anomalyQueue).toHaveLength(0);
  });

  it('derives effective tenant IAM status from current keycloak facts and preserves snapshot metadata', () => {
    expect(
      getEffectiveTenantIamStatus({
        tenantIamStatus: undefined,
      } as never)
    ).toBeUndefined();

    const status = getEffectiveTenantIamStatus({
      keycloakStatus: {
        realmExists: true,
        clientExists: true,
        tenantAdminClientExists: true,
        instanceIdMapperExists: true,
        tenantAdminExists: true,
        tenantAdminHasSystemAdmin: true,
        tenantAdminHasInstanceRegistryAdmin: true,
        tenantAdminInstanceIdMatches: true,
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
        configuration: {
          status: 'blocked',
          summary: 'veraltet',
          source: 'registry',
          checkedAt: '2026-01-01T00:00:00.000Z',
          requestId: 'req-config-1',
        },
        access: {
          status: 'ready',
          summary: 'ok',
          source: 'access_probe',
        },
        reconcile: {
          status: 'unknown',
          summary: 'offen',
          source: 'role_reconcile',
        },
        overall: {
          status: 'blocked',
          summary: 'alt',
          source: 'registry',
        },
      },
    } as never);

    expect(status).toEqual(
      expect.objectContaining({
        configuration: expect.objectContaining({
          status: 'degraded',
          source: 'keycloak_status_snapshot',
          checkedAt: '2026-01-01T00:00:00.000Z',
          requestId: 'req-config-1',
        }),
        overall: expect.objectContaining({
          status: 'degraded',
          source: 'keycloak_status_snapshot',
        }),
      })
    );
  });

  it('returns localized status guidance for all remaining lifecycle states', () => {
    for (const lifecycleStatus of ['validated', 'provisioning', 'active', 'failed', 'suspended', 'archived'] as const) {
      expect(getStatusGuidance({ status: lifecycleStatus } as never)).toEqual({
        title: expect.any(String),
        body: expect.any(String),
      });
    }
  });

  it('maps the remaining IAM error codes to dedicated localized messages', () => {
    const cases = [
      ['reauth_required', 'Re-Authentisierung'],
      ['conflict', 'Konflikt'],
      ['database_unavailable', 'Datenbank'],
      ['tenant_auth_client_secret_missing', 'Tenant-Client-Secret'],
      ['tenant_admin_client_not_configured', 'Tenant-Admin-Client'],
      ['tenant_admin_client_secret_missing', 'Tenant-Admin-Client-Secret'],
      ['keycloak_unavailable', 'Keycloak'],
      ['encryption_not_configured', 'verschlüsselung'],
    ] as const;

    for (const [code, expectedFragment] of cases) {
      expect(
        getErrorMessage({
          name: 'IamHttpError',
          status: 500,
          code,
          message: code,
        } as never)
      ).toContain(expectedFragment);
    }
  });

  it('surfaces failed provisioning runs as cockpit anomalies with provisioning source labels', () => {
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
        assignedModules: [],
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        hostnames: [],
        provisioningRuns: [],
        auditEvents: [],
        keycloakPreflight: undefined,
        keycloakPlan: undefined,
        tenantIamStatus: undefined,
        keycloakStatus: undefined,
        keycloakProvisioningRuns: [
          {
            id: 'run-failed-1',
            intent: 'provision',
            mode: 'existing',
            overallStatus: 'failed',
            driftSummary: 'Provisioning fehlgeschlagen.',
            requestId: 'req-failed-1',
            finishedAt: '2026-01-03T10:15:00.000Z',
            steps: [],
          },
        ],
        latestKeycloakProvisioningRun: {
          id: 'run-failed-1',
          intent: 'provision',
          mode: 'existing',
          overallStatus: 'failed',
          driftSummary: 'Provisioning fehlgeschlagen.',
          requestId: 'req-failed-1',
          finishedAt: '2026-01-03T10:15:00.000Z',
          steps: [],
        },
      },
      null
    );

    expect(model.anomalyQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'latest-run',
          status: 'blocked',
          sourceLabel: 'Quelle: Keycloak-Provisioning-Lauf',
        }),
      ])
    );
  });

  it('renders provisioning step badges with ready and non-ready variants', () => {
    render(
      <div>
        <instancesShared.ProvisioningStepBadge status="skipped" />
        <instancesShared.ProvisioningStepBadge status="failed" />
      </div>
    );

    expect(screen.getByText('skipped')).toBeTruthy();
    expect(screen.getByText('failed')).toBeTruthy();
  });
});
