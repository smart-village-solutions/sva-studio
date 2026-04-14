import { describe, expect, it } from 'vitest';

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
});
