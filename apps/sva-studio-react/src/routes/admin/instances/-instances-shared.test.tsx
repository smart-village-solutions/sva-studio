import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as instancesShared from './-instances-shared';
import { buildInstanceDetailCockpitModel } from './-instance-detail-cockpit';
import { evaluateInstanceConfiguration } from './-instance-detail-configuration';
import { getKeycloakStatusEntries, getStatusGuidance } from './-instance-detail-status';
import { getEffectiveTenantIamStatus } from './-instance-detail-tenant-iam';
import { getSetupWorkflowSteps } from './-instance-detail-workflow';
import {
  buildExistingRealmOperationsModel,
  buildHistoryWorkspaceModel,
  buildNewRealmOperationsModel,
  buildOperationsPrimaryAction,
  getErrorMessage,
  getOperationsEvidenceSourceLabel,
  type OperationsStepModel,
  type RealmOperationsModel,
} from './-instances-shared';
import {
  createEmptyCreateForm,
  getCreateReadinessChecks,
  getCreateStepValidationMessages,
  getPostCreateGuidance,
  readSuggestedParentDomain,
} from './-instance-form-models';

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
    moduleActivations: [],
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
    moduleIamStatus: {
      overall: {
        status: 'unknown',
        summary: 'Noch keine Module für diese Instanz zugewiesen.',
        source: 'registry',
      },
      modules: [],
    },
    ...overrides,
  }) as const;

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

  it('maps operations evidence sources to translated labels', () => {
    expect(getOperationsEvidenceSourceLabel('worker_preflight')).toBe('Worker-Preflight');
    expect(getOperationsEvidenceSourceLabel('final_validation')).toBe('Abschlussvalidierung');
  });

  it('returns a validation message for malformed auth realms', () => {
    const formValues = createEmptyCreateForm('');
    formValues.authRealm =
      'Bitte ein Tenant-Client-Secret angeben. Bitte ein Tenant-Admin-Client-Secret angeben.';

    expect(getCreateStepValidationMessages('auth', formValues)).toContain(
      'Bitte ein gültiges Auth-Realm ohne Leerzeichen oder Fließtext angeben.'
    );
  });

  it('pre-populates both client ids for new create forms', () => {
    expect(createEmptyCreateForm('studio.smart-village.app')).toMatchObject({
      authClientId: 'sva-studio-login',
      tenantAdminClient: {
        clientId: 'sva-studio-realm-admin',
        secret: '',
      },
    });
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
    expect(
      getErrorMessage({
        name: 'IamHttpError',
        status: 500,
        code: 'unknown',
        message: 'boom',
      } as never)
    ).toContain('Instanz');
  });

  it('reads the suggested parent domain from window and falls back safely for invalid urls', () => {
    vi.stubGlobal('window', {
      location: { href: 'https://demo.studio.example.org/admin/instances' },
    });
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
        summary:
          'Bei einem neuen Realm wird das Tenant-Client-Secret erst beim Provisioning erzeugt und danach gespeichert.',
      },
      {
        key: 'tenantAdmin',
        title: 'Initialer Tenant-Admin',
        ready: true,
        summary:
          'Ein Tenant-Admin ist hinterlegt und kann beim ersten Bootstrap oder Reset verwendet werden.',
      },
      {
        key: 'followUp',
        title: 'Nächster Betriebs-Schritt',
        ready: false,
        summary:
          'Nach dem Speichern folgt im Detail die technische Prüfung und das Keycloak-Provisioning.',
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
      summary:
        'Die Instanz hb-meinquartier wurde in der Registry angelegt. Aktueller Status: Angefordert.',
      nextSteps: [
        'Öffnen Sie danach den Setup-Flow, um Provisioning, Aktivierung und Tenant-Admin-Struktur abzuschließen.',
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
      summary:
        'Bei einem neuen Realm wird das Tenant-Client-Secret erst beim Provisioning erzeugt und danach gespeichert.',
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
        moduleActivations: [],
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
      description:
        'Für neue Realms wird das Tenant-Client-Secret erst beim Provisioning erzeugt und danach gespeichert.',
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
      moduleActivations: [],
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authClientSecretConfigured: false,
      hostnames: [],
      provisioningRuns: [],
      auditEvents: [],
      keycloakPreflight: {
        overallStatus: 'blocked',
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

  it('does not surface deprecated tenant admin instance attribute drift anymore', () => {
    const entries = getKeycloakStatusEntries({
      keycloakStatus: {
        realmExists: true,
        clientExists: true,
        tenantAdminExists: true,
        tenantAdminHasSystemAdmin: true,
        systemAdminRoleExists: true,
        redirectUrisMatch: true,
        logoutUrisMatch: true,
        webOriginsMatch: true,
        clientSecretConfigured: true,
        tenantClientSecretReadable: true,
        clientSecretAligned: true,
        runtimeSecretSource: 'tenant',
      },
    } as never);

    expect(entries).not.toContainEqual([
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
        moduleActivations: [],
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
          tenantAdminExists: false,
          tenantAdminHasSystemAdmin: false,
          systemAdminRoleExists: false,
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

    expect(workflow.find((step) => step.key === 'tenantAdminClient')?.action).toBe(
      'provision_admin_client'
    );
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
        moduleActivations: [],
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
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          systemAdminRoleExists: true,
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
        moduleActivations: [],
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        hostnames: [],
        provisioningRuns: [
          {
            id: 'registry-run-1',
            instanceId: 'demo',
            operation: 'create',
            status: 'failed',
            idempotencyKey: 'idem-registry-run-1',
            createdAt: '2025-12-31T23:00:00.000Z',
            updatedAt: '2025-12-31T23:10:00.000Z',
          },
        ],
        auditEvents: [],
        keycloakPreflight: {
          overallStatus: 'ready',
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
            instanceId: 'demo',
            intent: 'provision',
            mode: 'existing',
            overallStatus: 'succeeded',
            driftSummary: 'Kein Drift.',
            requestId: 'req-1',
            createdAt: '2026-01-02T08:10:00.000Z',
            updatedAt: '2026-01-02T08:11:00.000Z',
            steps: [],
          },
        ],
        latestKeycloakProvisioningRun: {
          id: 'run-1',
          instanceId: 'demo',
          intent: 'provision',
          mode: 'existing',
          overallStatus: 'succeeded',
          driftSummary: 'Kein Drift.',
          requestId: 'req-1',
          createdAt: '2026-01-02T08:10:00.000Z',
          updatedAt: '2026-01-02T08:11:00.000Z',
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
    expect(
      model.secondaryActions.some(
        (action: { action: string }) => action.action === 'probeTenantIamAccess'
      )
    ).toBe(true);
    expect(model.dominantEvidence.source).toBe('role_reconcile');
    expect(model.dominantEvidence.checkedAt).toBe('2026-01-02T08:15:00.000Z');
    expect(model.anomalyQueue).toHaveLength(2);
    expect(model.anomalyQueue.map((item: { title: string }) => item.title)).toEqual([
      'Tenant-IAM-Zugriff',
      'Tenant-IAM-Reconcile',
    ]);
  });

  it('limits the anomaly queue to three items and does not derive a green overall state from unknown tenant access', () => {
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
        moduleActivations: [],
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        authClientSecretConfigured: true,
        hostnames: [],
        provisioningRuns: [],
        auditEvents: [],
        keycloakPreflight: {
          overallStatus: 'ready',
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
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          systemAdminRoleExists: true,
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
    expect(model.anomalyQueue.every((item: { status: string }) => item.status !== 'ready')).toBe(
      true
    );
    expect(model.primaryAction.action).toBe('probeTenantIamAccess');
  });

  it('prefers the current keycloak structure over stale tenant IAM configuration evidence', () => {
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
        moduleActivations: [],
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
            instanceId: 'demo',
            intent: 'provision',
            mode: 'existing',
            overallStatus: 'succeeded',
            driftSummary: 'Kein Drift.',
            requestId: 'req-1',
            createdAt: '2026-01-02T08:10:00.000Z',
            updatedAt: '2026-01-02T08:11:00.000Z',
            steps: [],
          },
        ],
        latestKeycloakProvisioningRun: {
          id: 'run-1',
          instanceId: 'demo',
          intent: 'provision',
          mode: 'existing',
          overallStatus: 'succeeded',
          driftSummary: 'Kein Drift.',
          requestId: 'req-1',
          createdAt: '2026-01-02T08:10:00.000Z',
          updatedAt: '2026-01-02T08:11:00.000Z',
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
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          systemAdminRoleExists: true,
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
        tenantAdminExists: true,
        tenantAdminHasSystemAdmin: true,
        systemAdminRoleExists: true,
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
          status: 'ready',
          source: 'keycloak_status_snapshot',
          checkedAt: '2026-01-01T00:00:00.000Z',
          requestId: 'req-config-1',
        }),
        overall: expect.objectContaining({
          status: 'unknown',
          source: 'role_reconcile',
        }),
      })
    );
  });

  it('returns localized status guidance for all remaining lifecycle states', () => {
    for (const lifecycleStatus of [
      'validated',
      'provisioning',
      'active',
      'failed',
      'suspended',
      'archived',
    ] as const) {
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
        moduleActivations: [],
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
            instanceId: 'demo',
            intent: 'provision',
            mode: 'existing',
            overallStatus: 'failed',
            driftSummary: 'Provisioning fehlgeschlagen.',
            requestId: 'req-failed-1',
            createdAt: '2026-01-03T10:10:00.000Z',
            updatedAt: '2026-01-03T10:15:00.000Z',
            steps: [],
          },
        ],
        latestKeycloakProvisioningRun: {
          id: 'run-failed-1',
          instanceId: 'demo',
          intent: 'provision',
          mode: 'existing',
          overallStatus: 'failed',
          driftSummary: 'Provisioning fehlgeschlagen.',
          requestId: 'req-failed-1',
          createdAt: '2026-01-03T10:10:00.000Z',
          updatedAt: '2026-01-03T10:15:00.000Z',
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

  it('builds the new realm operations model from the worker flow and derives a retry action from failed provisioning', () => {
    const model = buildNewRealmOperationsModel(
      createDetailFixture({
        keycloakPreflight: {
          overallStatus: 'ready',
          checkedAt: '2026-01-02T09:00:00.000Z',
          checks: [
            {
              checkKey: 'keycloak_admin_access',
              status: 'ready',
              title: 'Technischer Keycloak-Zugriff',
              summary: 'Der technische Keycloak-Admin-Client kann den Ziel-Realm lesen.',
              details: {},
            },
            {
              checkKey: 'realm_mode',
              status: 'ready',
              title: 'Realm-Modus',
              summary: 'Der Ziel-Realm fehlt und kann neu angelegt werden.',
              details: {},
            },
          ],
        },
        keycloakPlan: {
          mode: 'new',
          overallStatus: 'ready',
          generatedAt: '2026-01-02T09:05:00.000Z',
          driftSummary:
            'Keycloak und Registry weisen Drift auf und werden beim nächsten Lauf abgeglichen.',
          steps: [],
        },
        latestKeycloakProvisioningRun: {
          id: 'run-1',
          instanceId: 'demo',
          intent: 'provision',
          mode: 'new',
          overallStatus: 'failed',
          driftSummary: 'Provisioning fehlgeschlagen.',
          requestId: 'req-run-1',
          createdAt: '2026-01-02T09:10:00.000Z',
          updatedAt: '2026-01-02T09:15:00.000Z',
          steps: [],
        },
        keycloakProvisioningRuns: [
          {
            id: 'run-1',
            instanceId: 'demo',
            intent: 'provision',
            mode: 'new',
            overallStatus: 'failed',
            driftSummary: 'Provisioning fehlgeschlagen.',
            requestId: 'req-run-1',
            createdAt: '2026-01-02T09:10:00.000Z',
            updatedAt: '2026-01-02T09:15:00.000Z',
            steps: [],
          },
        ],
      }),
      null
    );

    expect(model.mode).toBe('new');
    expect(model.steps.map((step) => step.key)).toEqual([
      'registry_contract',
      'worker_preflight',
      'worker_plan',
      'realm',
      'login_client',
      'tenant_admin_client',
      'realm_roles',
      'tenant_admin',
      'secret_sync',
      'final_validation',
      'realm_bootstrap_complete',
    ]);
    expect(model.steps.find((step) => step.key === 'worker_preflight')).toMatchObject({
      status: 'erfolgreich',
      evidenceSource: 'worker_preflight',
    });
    expect(model.steps.find((step) => step.key === 'worker_plan')).toMatchObject({
      status: 'erfolgreich',
      evidenceSource: 'worker_plan',
    });
    expect(buildOperationsPrimaryAction(model)).toMatchObject({
      action: 'execute_provisioning',
      reason: 'run_retry',
    });
  });

  it('prefers execute provisioning over a pure status refresh when preflight and worker plan are ready but the realm artifacts are still open', () => {
    const model = buildNewRealmOperationsModel(
      createDetailFixture({
        updatedAt: '2026-05-06T14:46:44.000Z',
        keycloakPreflight: {
          overallStatus: 'ready',
          checkedAt: '2026-05-06T14:46:53.000Z',
          checks: [
            {
              checkKey: 'realm_mode',
              status: 'ready',
              title: 'Realm-Modus',
              summary: 'Der Ziel-Realm fehlt und kann neu angelegt werden.',
              details: {},
            },
          ],
        },
        keycloakPlan: {
          mode: 'new',
          overallStatus: 'ready',
          generatedAt: '2026-05-06T14:46:53.000Z',
          driftSummary: 'Der Worker kann den Realm-Grundaufbau ausführen.',
          steps: [],
        },
        keycloakStatus: {
          realmExists: false,
          clientExists: false,
          tenantAdminClientExists: false,
          tenantAdminExists: false,
          tenantAdminHasSystemAdmin: false,
          systemAdminRoleExists: false,
          redirectUrisMatch: false,
          logoutUrisMatch: false,
          webOriginsMatch: false,
          clientSecretConfigured: false,
          tenantClientSecretReadable: false,
          clientSecretAligned: false,
          tenantAdminClientSecretConfigured: false,
          tenantAdminClientSecretReadable: false,
          tenantAdminClientSecretAligned: false,
          runtimeSecretSource: 'platform',
        },
        latestKeycloakProvisioningRun: undefined,
        keycloakProvisioningRuns: [],
      }),
      null
    );

    expect(model.steps.find((step) => step.key === 'realm')).toMatchObject({ status: 'offen' });
    expect(model.steps.find((step) => step.key === 'final_validation')).toMatchObject({
      status: 'offen',
    });
    expect(buildOperationsPrimaryAction(model)).toMatchObject({
      action: 'execute_provisioning',
      reason: 'run_retry',
    });
  });

  it('prefers the plan action before provisioning when preflight passed but no worker plan exists yet', () => {
    const model = buildNewRealmOperationsModel(
      createDetailFixture({
        keycloakPreflight: {
          overallStatus: 'ready',
          checkedAt: '2026-05-06T14:46:53.000Z',
          checks: [
            {
              checkKey: 'realm_mode',
              status: 'ready',
              title: 'Realm-Modus',
              summary: 'Der Ziel-Realm fehlt und kann neu angelegt werden.',
              details: {},
            },
          ],
        },
        keycloakPlan: undefined,
        keycloakStatus: undefined,
        latestKeycloakProvisioningRun: undefined,
        keycloakProvisioningRuns: [],
      }),
      null
    );

    expect(buildOperationsPrimaryAction(model)).toMatchObject({
      action: 'plan_provisioning',
      reason: 'follow_up',
    });
  });

  it('derives final validation and follow-up recommendations for a successful new realm bootstrap', () => {
    const model = buildNewRealmOperationsModel(
      createDetailFixture({
        status: 'validated',
        authClientSecretConfigured: true,
        tenantAdminClient: {
          clientId: 'sva-studio-realm-admin',
          secretConfigured: true,
        },
        keycloakStatus: {
          realmExists: true,
          clientExists: true,
          tenantAdminClientExists: true,
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          systemAdminRoleExists: true,
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
        latestKeycloakProvisioningRun: {
          id: 'run-success-1',
          instanceId: 'demo',
          intent: 'provision',
          mode: 'new',
          overallStatus: 'succeeded',
          driftSummary: 'Kein Drift.',
          requestId: 'req-success-1',
          createdAt: '2026-01-02T09:10:00.000Z',
          updatedAt: '2026-01-02T09:15:00.000Z',
          steps: [],
        },
        keycloakProvisioningRuns: [
          {
            id: 'run-success-1',
            instanceId: 'demo',
            intent: 'provision',
            mode: 'new',
            overallStatus: 'succeeded',
            driftSummary: 'Kein Drift.',
            requestId: 'req-success-1',
            createdAt: '2026-01-02T09:10:00.000Z',
            updatedAt: '2026-01-02T09:15:00.000Z',
            steps: [],
          },
        ],
      }),
      null
    );

    expect(model.steps.find((step) => step.key === 'final_validation')).toMatchObject({
      status: 'erfolgreich',
      evidenceSource: 'final_validation',
    });
    expect(model.steps.find((step) => step.key === 'realm_bootstrap_complete')).toMatchObject({
      status: 'erfolgreich',
    });
    expect(buildOperationsPrimaryAction(model)).toMatchObject({
      action: 'activate_instance',
      reason: 'follow_up',
    });
  });

  it('builds the existing realm operations model with a reconcile action when drift remains', () => {
    const model = buildExistingRealmOperationsModel(
      createDetailFixture({
        realmMode: 'existing',
        authClientSecretConfigured: true,
        tenantAdminClient: {
          clientId: 'sva-studio-realm-admin',
          secretConfigured: true,
        },
        keycloakPreflight: {
          overallStatus: 'ready',
          checkedAt: '2026-01-02T09:00:00.000Z',
          checks: [],
        },
        keycloakStatus: {
          realmExists: true,
          clientExists: true,
          tenantAdminClientExists: true,
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          systemAdminRoleExists: true,
          redirectUrisMatch: true,
          logoutUrisMatch: false,
          webOriginsMatch: true,
          clientSecretConfigured: true,
          tenantClientSecretReadable: true,
          clientSecretAligned: true,
          tenantAdminClientSecretConfigured: true,
          tenantAdminClientSecretReadable: true,
          tenantAdminClientSecretAligned: false,
          runtimeSecretSource: 'tenant',
        },
      }),
      null
    );

    expect(model.mode).toBe('existing');
    expect(model.steps.map((step) => step.key)).toEqual([
      'registry_contract',
      'worker_preflight',
      'live_status',
      'drift_analysis',
      'contract_repair',
      'reconcile',
      'result_validation',
    ]);
    expect(buildOperationsPrimaryAction(model)).toMatchObject({
      action: 'reconcileKeycloak',
      reason: 'run_retry',
    });
  });

  it('does not suggest reconcile for an existing realm without drift', () => {
    const model = buildExistingRealmOperationsModel(
      createDetailFixture({
        realmMode: 'existing',
        authClientSecretConfigured: true,
        tenantAdminClient: {
          clientId: 'sva-studio-realm-admin',
          secretConfigured: true,
        },
        keycloakPreflight: {
          overallStatus: 'ready',
          checkedAt: '2026-01-02T09:00:00.000Z',
          checks: [],
        },
        keycloakStatus: {
          realmExists: true,
          clientExists: true,
          tenantAdminClientExists: true,
          tenantAdminExists: true,
          tenantAdminHasSystemAdmin: true,
          systemAdminRoleExists: true,
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
      }),
      null
    );

    expect(buildOperationsPrimaryAction(model)).toMatchObject({
      action: 'check_keycloak_status',
      reason: 'final_validation',
    });
  });

  it('separates current and historical provisioning runs in the history workspace model', () => {
    const model = buildHistoryWorkspaceModel(
      createDetailFixture({
        latestKeycloakProvisioningRun: {
          id: 'run-success',
          instanceId: 'demo',
          intent: 'provision',
          mode: 'new',
          overallStatus: 'succeeded',
          driftSummary: 'Kein Drift.',
          requestId: 'req-success',
          createdAt: '2026-01-03T09:50:00.000Z',
          updatedAt: '2026-01-03T10:00:00.000Z',
          steps: [],
        },
        keycloakProvisioningRuns: [
          {
            id: 'run-success',
            instanceId: 'demo',
            intent: 'provision',
            mode: 'new',
            overallStatus: 'succeeded',
            driftSummary: 'Kein Drift.',
            requestId: 'req-success',
            createdAt: '2026-01-03T09:50:00.000Z',
            updatedAt: '2026-01-03T10:00:00.000Z',
            steps: [],
          },
          {
            id: 'run-failed',
            instanceId: 'demo',
            intent: 'provision',
            mode: 'new',
            overallStatus: 'failed',
            driftSummary: 'Früherer Fehler.',
            requestId: 'req-failed',
            createdAt: '2026-01-02T09:50:00.000Z',
            updatedAt: '2026-01-02T10:00:00.000Z',
            steps: [],
          },
        ],
      }),
      buildNewRealmOperationsModel(
        createDetailFixture({
          latestKeycloakProvisioningRun: {
            id: 'run-success',
            instanceId: 'demo',
            intent: 'provision',
            mode: 'new',
            overallStatus: 'succeeded',
            driftSummary: 'Kein Drift.',
            requestId: 'req-success',
            createdAt: '2026-01-03T09:50:00.000Z',
            updatedAt: '2026-01-03T10:00:00.000Z',
            steps: [],
          },
          keycloakProvisioningRuns: [
            {
              id: 'run-success',
              instanceId: 'demo',
              intent: 'provision',
              mode: 'new',
              overallStatus: 'succeeded',
              driftSummary: 'Kein Drift.',
              requestId: 'req-success',
              createdAt: '2026-01-03T09:50:00.000Z',
              updatedAt: '2026-01-03T10:00:00.000Z',
              steps: [],
            },
            {
              id: 'run-failed',
              instanceId: 'demo',
              intent: 'provision',
              mode: 'new',
              overallStatus: 'failed',
              driftSummary: 'Früherer Fehler.',
              requestId: 'req-failed',
              createdAt: '2026-01-02T09:50:00.000Z',
              updatedAt: '2026-01-02T10:00:00.000Z',
              steps: [],
            },
          ],
        }),
        null
      )
    );

    expect(model.currentRun?.id).toBe('run-success');
    expect(model.historicalRuns.map((run) => run.id)).toEqual(['run-failed']);
    expect(model.hasHistoricalMismatchHint).toBe(true);
  });
});

const createOperationsStepFixture = (
  key: OperationsStepModel['key'],
  status: OperationsStepModel['status']
): OperationsStepModel => ({
  key,
  status,
  title: key,
  summary: `${key}:${status}`,
  evidenceSource: 'history',
});

const createOperationsModelFixture = (
  mode: RealmOperationsModel['mode'],
  steps: readonly OperationsStepModel[],
  overrides: Partial<RealmOperationsModel> = {}
): RealmOperationsModel => ({
  mode,
  status: 'degraded',
  summary: 'characterization',
  steps,
  followUpActions: [],
  signals: {
    modeConflict: false,
    hasDrift: false,
  },
  ...overrides,
});

const incompleteKeycloakStatus = {
  realmExists: false,
  clientExists: false,
  tenantAdminClientExists: false,
  tenantAdminExists: false,
  tenantAdminHasSystemAdmin: false,
  systemAdminRoleExists: false,
  redirectUrisMatch: false,
  logoutUrisMatch: false,
  webOriginsMatch: false,
  clientSecretConfigured: false,
  tenantClientSecretReadable: false,
  clientSecretAligned: false,
  tenantAdminClientSecretConfigured: false,
  tenantAdminClientSecretReadable: false,
  tenantAdminClientSecretAligned: false,
  runtimeSecretSource: 'platform',
} as const;

const completeKeycloakStatus = {
  ...incompleteKeycloakStatus,
  realmExists: true,
  clientExists: true,
  tenantAdminClientExists: true,
  tenantAdminExists: true,
  tenantAdminHasSystemAdmin: true,
  systemAdminRoleExists: true,
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
} as const;

const createProvisioningRunFixture = (
  overallStatus: 'planned' | 'running' | 'succeeded' | 'failed'
) => ({
  id: `run-${overallStatus}`,
  instanceId: 'demo',
  intent: 'provision' as const,
  mode: 'new' as const,
  overallStatus,
  driftSummary: `Run ${overallStatus}`,
  requestId: `request-${overallStatus}`,
  createdAt: '2026-08-15T09:00:00.000Z',
  updatedAt: '2026-08-15T09:05:00.000Z',
  steps: [],
});

describe('realm operations step characterization', () => {
  it.each([
    {
      name: 'incomplete contract keeps preflight and plan pending',
      overrides: { displayName: '' },
      expected: {
        registry_contract: { status: 'fehlgeschlagen', action: 'focus_configuration' },
        worker_preflight: { status: 'offen', action: undefined },
        worker_plan: { status: 'offen', action: undefined },
      },
    },
    {
      name: 'complete contract offers preflight before a plan exists',
      overrides: {},
      expected: {
        registry_contract: { status: 'erfolgreich', action: undefined },
        worker_preflight: { status: 'bereit', action: 'check_preflight' },
        worker_plan: { status: 'bereit', action: undefined },
      },
    },
    {
      name: 'blocked realm-mode preflight preserves its diagnostic summary',
      overrides: {
        keycloakPreflight: {
          overallStatus: 'blocked',
          checkedAt: '2026-08-15T08:00:00.000Z',
          checks: [
            {
              checkKey: 'realm_mode',
              status: 'blocked',
              title: 'Realm mode',
              summary: 'Live realm already exists.',
              details: {},
            },
          ],
        },
      },
      expected: {
        registry_contract: { status: 'erfolgreich', action: undefined },
        worker_preflight: {
          status: 'fehlgeschlagen',
          action: undefined,
          summary: 'Live realm already exists.',
          checkedAt: '2026-08-15T08:00:00.000Z',
        },
        worker_plan: { status: 'offen', action: 'plan_provisioning' },
      },
    },
    {
      name: 'ready preflight offers plan generation',
      overrides: {
        keycloakPreflight: {
          overallStatus: 'ready',
          checkedAt: '2026-08-15T08:00:00.000Z',
          checks: [],
        },
      },
      expected: {
        registry_contract: { status: 'erfolgreich', action: undefined },
        worker_preflight: {
          status: 'erfolgreich',
          action: undefined,
          checkedAt: '2026-08-15T08:00:00.000Z',
        },
        worker_plan: { status: 'bereit', action: 'plan_provisioning' },
      },
    },
    {
      name: 'blocked plan preserves worker drift evidence',
      overrides: {
        keycloakPreflight: {
          overallStatus: 'ready',
          checkedAt: '2026-08-15T08:00:00.000Z',
          checks: [],
        },
        keycloakPlan: {
          mode: 'new',
          overallStatus: 'blocked',
          generatedAt: '2026-08-15T08:05:00.000Z',
          driftSummary: 'Plan cannot reconcile the target realm.',
          steps: [],
        },
      },
      expected: {
        registry_contract: { status: 'erfolgreich', action: undefined },
        worker_preflight: { status: 'erfolgreich', action: undefined },
        worker_plan: {
          status: 'fehlgeschlagen',
          action: undefined,
          summary: 'Plan cannot reconcile the target realm.',
          checkedAt: '2026-08-15T08:05:00.000Z',
        },
      },
    },
  ])('keeps new-realm lead-step semantics when $name', ({ overrides, expected }) => {
    const model = buildNewRealmOperationsModel(createDetailFixture(overrides), null);

    for (const [key, stepExpectation] of Object.entries(expected)) {
      expect(model.steps.find((step) => step.key === key)).toMatchObject(stepExpectation);
    }
  });

  it.each([
    { runStatus: undefined, artifactStatus: 'offen', finalStatus: 'offen' },
    { runStatus: 'planned', artifactStatus: 'läuft', finalStatus: 'läuft' },
    { runStatus: 'running', artifactStatus: 'läuft', finalStatus: 'läuft' },
    { runStatus: 'failed', artifactStatus: 'fehlgeschlagen', finalStatus: 'fehlgeschlagen' },
    { runStatus: 'succeeded', artifactStatus: 'fehlgeschlagen', finalStatus: 'fehlgeschlagen' },
  ] as const)(
    'maps a $runStatus worker run to $artifactStatus artifacts and $finalStatus validation',
    ({ runStatus, artifactStatus, finalStatus }) => {
      const run = runStatus ? createProvisioningRunFixture(runStatus) : undefined;
      const model = buildNewRealmOperationsModel(
        createDetailFixture({
          latestKeycloakProvisioningRun: run,
          keycloakProvisioningRuns: run ? [run] : [],
        }),
        null
      );

      expect(model.steps.find((step) => step.key === 'realm')).toMatchObject({
        status: artifactStatus,
        evidenceSource: 'keycloak_run',
        checkedAt: run?.updatedAt,
        requestId: run?.requestId,
      });
      expect(model.steps.find((step) => step.key === 'final_validation')).toMatchObject({
        status: finalStatus,
        evidenceSource: 'final_validation',
        checkedAt: '2026-01-01T00:00:00.000Z',
        requestId: run?.requestId,
      });
    }
  );

  it.each([
    ['realm', { realmExists: true }],
    [
      'login_client',
      {
        clientExists: true,
        redirectUrisMatch: true,
        logoutUrisMatch: true,
        webOriginsMatch: true,
      },
    ],
    ['tenant_admin_client', { tenantAdminClientExists: true }],
    ['realm_roles', { tenantAdminHasSystemAdmin: true }],
    ['tenant_admin', { tenantAdminExists: true }],
    [
      'secret_sync',
      {
        clientSecretAligned: true,
        tenantAdminClientSecretAligned: true,
      },
    ],
  ] as const)(
    'marks only satisfied %s artifact evidence successful',
    (stepKey, statusOverrides) => {
      const run = createProvisioningRunFixture('running');
      const model = buildNewRealmOperationsModel(
        createDetailFixture({
          keycloakStatus: {
            ...incompleteKeycloakStatus,
            ...statusOverrides,
          },
          latestKeycloakProvisioningRun: run,
          keycloakProvisioningRuns: [run],
        }),
        null
      );

      expect(model.steps.find((step) => step.key === stepKey)).toMatchObject({
        status: 'erfolgreich',
        evidenceSource: 'final_validation',
        checkedAt: run.updatedAt,
        requestId: run.requestId,
      });
    }
  );

  it.each([
    {
      name: 'missing contract and evidence',
      overrides: { displayName: '', tenantAdminClient: null, keycloakPreflight: null },
      expected: {
        registry_contract: { status: 'fehlgeschlagen', action: 'focus_configuration' },
        worker_preflight: { status: 'offen', action: undefined },
        live_status: { status: 'bereit', action: 'check_keycloak_status' },
        drift_analysis: { status: 'offen' },
        contract_repair: { status: 'fehlgeschlagen', action: 'focus_configuration' },
        reconcile: { status: 'offen', action: undefined },
        result_validation: { status: 'offen' },
      },
    },
    {
      name: 'blocked preflight without live status',
      overrides: {
        realmMode: 'existing',
        authClientSecretConfigured: true,
        keycloakPreflight: {
          overallStatus: 'blocked',
          checkedAt: '2026-08-15T10:00:00.000Z',
          checks: [],
        },
      },
      expected: {
        worker_preflight: {
          status: 'fehlgeschlagen',
          checkedAt: '2026-08-15T10:00:00.000Z',
        },
        live_status: { status: 'offen', action: 'check_keycloak_status' },
        drift_analysis: { status: 'offen' },
        reconcile: { status: 'offen' },
        result_validation: { status: 'offen' },
      },
    },
    {
      name: 'complete live status without drift',
      overrides: {
        realmMode: 'existing',
        authClientSecretConfigured: true,
        keycloakStatus: completeKeycloakStatus,
      },
      expected: {
        live_status: { status: 'erfolgreich', evidenceSource: 'final_validation' },
        drift_analysis: { status: 'erfolgreich', evidenceSource: 'final_validation' },
        reconcile: {
          status: 'erfolgreich',
          action: undefined,
          evidenceSource: 'final_validation',
        },
        result_validation: { status: 'erfolgreich' },
      },
    },
    {
      name: 'drift with a failed latest run',
      overrides: {
        realmMode: 'existing',
        authClientSecretConfigured: true,
        keycloakStatus: {
          ...completeKeycloakStatus,
          logoutUrisMatch: false,
        },
        latestKeycloakProvisioningRun: {
          ...createProvisioningRunFixture('failed'),
          mode: 'existing',
        },
      },
      expected: {
        drift_analysis: { status: 'fehlgeschlagen' },
        reconcile: {
          status: 'fehlgeschlagen',
          action: 'reconcileKeycloak',
          evidenceSource: 'keycloak_run',
          checkedAt: '2026-08-15T09:05:00.000Z',
          requestId: 'request-failed',
        },
        result_validation: { status: 'fehlgeschlagen' },
      },
    },
  ])('keeps existing-realm assessment semantics for $name', ({ overrides, expected }) => {
    const model = buildExistingRealmOperationsModel(createDetailFixture(overrides) as never, null);

    for (const [key, stepExpectation] of Object.entries(expected)) {
      expect(model.steps.find((step) => step.key === key)).toMatchObject(stepExpectation);
    }
  });

  it('ignores mutation errors in both operation-model projections', () => {
    const mutationError = {
      name: 'IamHttpError',
      status: 409,
      code: 'conflict',
      message: 'legacy mutation error',
    } as const;

    expect(buildNewRealmOperationsModel(createDetailFixture(), mutationError)).toEqual(
      buildNewRealmOperationsModel(createDetailFixture(), null)
    );
    expect(
      buildExistingRealmOperationsModel(
        createDetailFixture({ realmMode: 'existing', authClientSecretConfigured: true }),
        mutationError
      )
    ).toEqual(
      buildExistingRealmOperationsModel(
        createDetailFixture({ realmMode: 'existing', authClientSecretConfigured: true }),
        null
      )
    );
  });
});

describe('realm operations primary-action priority characterization', () => {
  it.each([
    {
      name: 'contract failure beats every later candidate',
      steps: [
        createOperationsStepFixture('registry_contract', 'fehlgeschlagen'),
        createOperationsStepFixture('worker_preflight', 'fehlgeschlagen'),
        createOperationsStepFixture('worker_plan', 'bereit'),
        createOperationsStepFixture('realm', 'fehlgeschlagen'),
      ],
      overrides: { signals: { modeConflict: true, hasDrift: false } },
      expected: { action: 'focus_configuration', reason: 'missing_contract' },
    },
    {
      name: 'mode conflict beats a blocked preflight',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'fehlgeschlagen'),
      ],
      overrides: { signals: { modeConflict: true, hasDrift: false } },
      expected: { action: 'check_preflight', reason: 'mode_conflict' },
    },
    {
      name: 'blocked preflight beats worker planning',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'fehlgeschlagen'),
        createOperationsStepFixture('worker_plan', 'bereit'),
      ],
      expected: { action: 'check_preflight', reason: 'preflight_blocked' },
    },
    {
      name: 'completed validation exposes the first follow-up before stale plan evidence',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'erfolgreich'),
        createOperationsStepFixture('final_validation', 'erfolgreich'),
        createOperationsStepFixture('worker_plan', 'bereit'),
      ],
      overrides: { followUpActions: ['activate_instance', 'probeTenantIamAccess'] as const },
      expected: { action: 'activate_instance', reason: 'follow_up' },
    },
    {
      name: 'worker planning beats failed artifacts',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'erfolgreich'),
        createOperationsStepFixture('worker_plan', 'bereit'),
        createOperationsStepFixture('realm', 'fehlgeschlagen'),
      ],
      expected: { action: 'plan_provisioning', reason: 'follow_up' },
    },
    {
      name: 'failed worker plan is replanned before execution retry',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'erfolgreich'),
        createOperationsStepFixture('worker_plan', 'fehlgeschlagen'),
        createOperationsStepFixture('realm', 'fehlgeschlagen'),
      ],
      expected: { action: 'plan_provisioning', reason: 'follow_up' },
    },
    {
      name: 'failed provisioning artifact requests an execution retry',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'erfolgreich'),
        createOperationsStepFixture('worker_plan', 'erfolgreich'),
        createOperationsStepFixture('realm', 'fehlgeschlagen'),
        createOperationsStepFixture('final_validation', 'fehlgeschlagen'),
      ],
      expected: { action: 'execute_provisioning', reason: 'run_retry' },
    },
    {
      name: 'failed secret sync retains the legacy run-retry reason',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'erfolgreich'),
        createOperationsStepFixture('worker_plan', 'erfolgreich'),
        createOperationsStepFixture('secret_sync', 'fehlgeschlagen'),
      ],
      expected: { action: 'execute_provisioning', reason: 'run_retry' },
    },
    {
      name: 'open provisioning artifact starts worker execution',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'erfolgreich'),
        createOperationsStepFixture('worker_plan', 'erfolgreich'),
        createOperationsStepFixture('tenant_admin', 'offen'),
      ],
      expected: { action: 'execute_provisioning', reason: 'run_retry' },
    },
    {
      name: 'failed final validation refreshes live status',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'erfolgreich'),
        createOperationsStepFixture('worker_plan', 'erfolgreich'),
        createOperationsStepFixture('final_validation', 'fehlgeschlagen'),
      ],
      expected: { action: 'check_keycloak_status', reason: 'final_validation' },
    },
    {
      name: 'follow-up remains available without final-validation evidence',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'erfolgreich'),
      ],
      overrides: { followUpActions: ['probeTenantIamAccess'] as const },
      expected: { action: 'probeTenantIamAccess', reason: 'follow_up' },
    },
    {
      name: 'missing optional steps fail closed to status validation',
      steps: [],
      expected: { action: 'check_keycloak_status', reason: 'final_validation' },
    },
  ])('keeps new-realm priority when $name', ({ steps, overrides, expected }) => {
    expect(
      buildOperationsPrimaryAction(createOperationsModelFixture('new', steps, overrides))
    ).toMatchObject(expected);
  });

  it.each([
    {
      name: 'contract repair beats preflight and drift',
      steps: [
        createOperationsStepFixture('contract_repair', 'fehlgeschlagen'),
        createOperationsStepFixture('worker_preflight', 'fehlgeschlagen'),
        createOperationsStepFixture('reconcile', 'fehlgeschlagen'),
      ],
      overrides: { signals: { modeConflict: false, hasDrift: true } },
      expected: { action: 'focus_configuration', reason: 'missing_contract' },
    },
    {
      name: 'preflight blocker beats missing live status',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'fehlgeschlagen'),
        createOperationsStepFixture('live_status', 'bereit'),
      ],
      expected: { action: 'check_preflight', reason: 'preflight_blocked' },
    },
    {
      name: 'missing live status beats drift reconciliation',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'erfolgreich'),
        createOperationsStepFixture('live_status', 'bereit'),
        createOperationsStepFixture('reconcile', 'fehlgeschlagen'),
      ],
      overrides: { signals: { modeConflict: false, hasDrift: true } },
      expected: { action: 'check_keycloak_status', reason: 'final_validation' },
    },
    {
      name: 'drift requests reconcile',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'erfolgreich'),
        createOperationsStepFixture('live_status', 'erfolgreich'),
        createOperationsStepFixture('reconcile', 'bereit'),
      ],
      overrides: { signals: { modeConflict: false, hasDrift: true } },
      expected: { action: 'reconcileKeycloak', reason: 'run_retry' },
    },
    {
      name: 'failed reconcile retries even without a drift signal',
      steps: [
        createOperationsStepFixture('registry_contract', 'erfolgreich'),
        createOperationsStepFixture('worker_preflight', 'erfolgreich'),
        createOperationsStepFixture('live_status', 'erfolgreich'),
        createOperationsStepFixture('reconcile', 'fehlgeschlagen'),
      ],
      expected: { action: 'reconcileKeycloak', reason: 'run_retry' },
    },
    {
      name: 'missing optional steps fail closed to status validation',
      steps: [],
      expected: { action: 'check_keycloak_status', reason: 'final_validation' },
    },
  ])('keeps existing-realm priority when $name', ({ steps, overrides, expected }) => {
    expect(
      buildOperationsPrimaryAction(createOperationsModelFixture('existing', steps, overrides))
    ).toMatchObject(expected);
  });
});
