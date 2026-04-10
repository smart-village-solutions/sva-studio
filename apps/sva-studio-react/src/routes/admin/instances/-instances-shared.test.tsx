import { describe, expect, it } from 'vitest';

import {
  createEmptyCreateForm,
  getCreateReadinessChecks,
  getErrorMessage,
  getCreateStepValidationMessages,
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
});
