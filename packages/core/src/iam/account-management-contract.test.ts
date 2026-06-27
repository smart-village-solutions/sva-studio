import { describe, expect, it } from 'vitest';

import {
  type IamKeycloakObjectDiagnostic,
  instanceAuditCheckScopes,
  instanceAuditCheckStatuses,
  type InstanceAuditRun,
  type IamUserPermissionTraceItem,
  iamRuntimeDiagnosticClassifications,
  iamRuntimeDiagnosticStatuses,
  iamRuntimeRecommendedActions,
  iamTenantIamAxisStatuses,
  iamTenantIamSources,
  type IamTenantIamStatus,
} from './account-management-contract.js';

describe('account-management-contract runtime diagnostics exports', () => {
  it('exports the supported runtime diagnostic classifications in a stable order', () => {
    expect(iamRuntimeDiagnosticClassifications).toEqual([
      'auth_resolution',
      'oidc_discovery_or_exchange',
      'tenant_host_validation',
      'session_store_or_session_hydration',
      'actor_resolution_or_membership',
      'keycloak_dependency',
      'database_or_schema_drift',
      'database_mapping_or_membership_inconsistency',
      'registry_or_provisioning_drift',
      'keycloak_reconcile',
      'frontend_state_or_permission_staleness',
      'legacy_workaround_or_regression',
      'unknown',
    ]);
  });

  it('exports the supported runtime diagnostic statuses and recommended actions', () => {
    expect(iamRuntimeDiagnosticStatuses).toEqual([
      'gesund',
      'degradiert',
      'recovery_laeuft',
      'manuelle_pruefung_erforderlich',
    ]);

    expect(iamRuntimeRecommendedActions).toEqual([
      'erneut_anmelden',
      'erneut_versuchen',
      'keycloak_pruefen',
      'migration_pruefen',
      'provisioning_pruefen',
      'rollenabgleich_pruefen',
      'manuell_pruefen',
      'support_kontaktieren',
    ]);
  });

  it('allows object-level Keycloak diagnostics for admin UI projections', () => {
    const diagnostic: IamKeycloakObjectDiagnostic = {
      code: 'missing_instance_attribute',
      objectId: 'kc-user-1',
      objectType: 'user',
    };

    expect(diagnostic).toEqual({
      code: 'missing_instance_attribute',
      objectId: 'kc-user-1',
      objectType: 'user',
    });
  });

  it('exports stable tenant IAM status enums for instance detail projections', () => {
    expect(iamTenantIamAxisStatuses).toEqual(['ready', 'degraded', 'blocked', 'unknown']);
    expect(iamTenantIamSources).toEqual([
      'registry',
      'keycloak_status_snapshot',
      'keycloak_provisioning_run',
      'role_reconcile',
      'access_probe',
    ]);
  });

  it('supports correlated tenant IAM detail shapes', () => {
    const status: IamTenantIamStatus = {
      configuration: {
        status: 'ready',
        summary: 'Tenant-Admin-Client und Strukturartefakte sind vorhanden.',
        source: 'registry',
        checkedAt: '2026-04-29T09:00:00.000Z',
      },
      access: {
        status: 'degraded',
        summary: 'Rechteprobe meldet fehlende Rollen-Leserechte.',
        source: 'access_probe',
        checkedAt: '2026-04-29T09:01:00.000Z',
        errorCode: 'IDP_FORBIDDEN',
        requestId: 'req-access-1',
      },
      reconcile: {
        status: 'unknown',
        summary: 'Noch kein Rollenabgleich ausgeführt.',
        source: 'role_reconcile',
      },
      overall: {
        status: 'degraded',
        summary: 'Tenant-IAM ist strukturell vorhanden, aber operativ eingeschränkt.',
        source: 'access_probe',
        checkedAt: '2026-04-29T09:01:00.000Z',
        errorCode: 'IDP_FORBIDDEN',
        requestId: 'req-access-1',
      },
    };

    expect(status.overall.requestId).toBe('req-access-1');
    expect(status.access.errorCode).toBe('IDP_FORBIDDEN');
  });

  it('supports inheritance and inactive-reason metadata on permission trace items', () => {
    const entry: IamUserPermissionTraceItem = {
      permissionKey: 'content.read',
      action: 'content.read',
      resourceType: 'content',
      isEffective: false,
      status: 'disabled',
      sourceKind: 'group_role',
      inheritedFromOrganizationId: '11111111-1111-4111-8111-111111111111',
      inheritedFromGeoUnitId: '22222222-2222-4222-8222-222222222222',
      restrictedByGeoUnitId: '33333333-3333-4333-8333-333333333333',
      inactiveReason: 'group_disabled',
    };

    expect(entry.inheritedFromOrganizationId).toBe('11111111-1111-4111-8111-111111111111');
    expect(entry.restrictedByGeoUnitId).toBe('33333333-3333-4333-8333-333333333333');
    expect(entry.inactiveReason).toBe('group_disabled');
  });

  it('exports stable instance audit enums and response shapes for root diagnostics', () => {
    expect(instanceAuditCheckStatuses).toEqual(['pass', 'fail', 'warn', 'skip']);
    expect(instanceAuditCheckScopes).toEqual(['instance', 'registry', 'keycloak', 'localIam', 'run']);

    const run: InstanceAuditRun = {
      generatedAt: '2026-06-10T08:00:00.000Z',
      includeOnlyActive: true,
      targetInstanceIds: ['bb-guben'],
      overallStatus: 'warn',
      summary: {
        totalInstances: 1,
        passCount: 3,
        failCount: 0,
        warnCount: 1,
        skipCount: 0,
      },
      checks: [],
      instances: [],
    };

    expect(run.summary.totalInstances).toBe(1);
    expect(run.overallStatus).toBe('warn');
  });
});
