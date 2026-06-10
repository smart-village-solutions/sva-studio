import { describe, expect, it } from 'vitest';

import { buildKeycloakChecks } from './service-audit-keycloak-checks.js';

const baseStatus = {
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
  runtimeSecretSource: 'tenant' as const,
};

describe('service-audit-keycloak-checks', () => {
  it('creates full skip chains when no keycloak status is available', () => {
    const checks = buildKeycloakChecks({
      keycloakStatus: null,
      keycloakEvidenceSource: 'keycloak_live',
      keycloakError: 'boom',
    });

    expect(checks[0]).toEqual(
      expect.objectContaining({
        checkId: 'keycloak.realm.exists',
        status: 'fail',
        actual: 'boom',
      })
    );
    expect(checks.slice(1).every((check) => check.status === 'skip')).toBe(true);
  });

  it('skips dependent checks when the realm is missing', () => {
    const checks = buildKeycloakChecks({
      keycloakStatus: {
        ...baseStatus,
        realmExists: false,
      },
      keycloakEvidenceSource: 'keycloak_snapshot',
    });

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkId: 'keycloak.realm.exists', status: 'fail' }),
        expect.objectContaining({ checkId: 'keycloak.client.login.exists', status: 'skip' }),
        expect.objectContaining({ checkId: 'keycloak.user.systemAdmin.exists', status: 'skip' }),
      ])
    );
  });

  it('reports missing clients and secret mismatches explicitly', () => {
    const checks = buildKeycloakChecks({
      keycloakStatus: {
        ...baseStatus,
        clientExists: false,
        tenantAdminClientExists: true,
        tenantAdminClientSecretAligned: false,
      },
      keycloakEvidenceSource: 'keycloak_live',
    });

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkId: 'keycloak.client.login.exists', status: 'fail', actual: 'fehlt' }),
        expect.objectContaining({ checkId: 'keycloak.client.login.secretAligned', status: 'skip' }),
        expect.objectContaining({
          checkId: 'keycloak.client.tenantAdmin.secretAligned',
          status: 'fail',
          actual: 'abweichend',
        }),
      ])
    );
  });

  it('distinguishes between missing role, missing user and user without system_admin', () => {
    const missingRoleChecks = buildKeycloakChecks({
      keycloakStatus: {
        ...baseStatus,
        systemAdminRoleExists: false,
      },
      keycloakEvidenceSource: 'keycloak_live',
    });
    expect(missingRoleChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkId: 'keycloak.role.systemAdmin.exists', status: 'fail' }),
        expect.objectContaining({ checkId: 'keycloak.user.systemAdmin.exists', status: 'skip' }),
      ])
    );

    const missingUserChecks = buildKeycloakChecks({
      keycloakStatus: {
        ...baseStatus,
        tenantAdminExists: false,
      },
      keycloakEvidenceSource: 'keycloak_live',
    });
    expect(missingUserChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: 'keycloak.user.systemAdmin.exists',
          status: 'fail',
          actual: 'kein_benutzer_nachweis',
        }),
      ])
    );

    const noRoleOnUserChecks = buildKeycloakChecks({
      keycloakStatus: {
        ...baseStatus,
        tenantAdminHasSystemAdmin: false,
      },
      keycloakEvidenceSource: 'keycloak_live',
    });
    expect(noRoleOnUserChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: 'keycloak.user.systemAdmin.exists',
          status: 'fail',
          actual: 'benutzer_ohne_system_admin',
        }),
      ])
    );
  });
});
