import { describe, expect, it, vi } from 'vitest';

import {
  buildTenantIamStatus,
  buildInstanceDetail,
  createAuditDetails,
  createStatusArtifacts,
  getAuditEventType,
  getStatusOperation,
  toListItem,
} from './service-helpers.js';

describe('service-helpers', () => {
  it('maps list items and instance details including the latest provisioning run', () => {
    const instance = {
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      authRealm: 'demo',
      authClientId: 'studio-client',
      authIssuerUrl: 'https://auth.example.org/realms/demo',
      authClientSecretConfigured: true,
      tenantAdminBootstrap: false,
      themeKey: 'default',
      featureFlags: { beta: true },
      mainserverConfigRef: 'mainserver-config',
      createdAt: '2026-04-04T00:00:00.000Z',
      updatedAt: '2026-04-04T01:00:00.000Z',
    };
    const latestProvisioningRun = { id: 'run-1', status: 'requested' };

    expect(toListItem(instance as never, latestProvisioningRun as never)).toEqual(
      expect.objectContaining({
        instanceId: 'demo',
        latestProvisioningRun,
      }),
    );

    expect(
      buildInstanceDetail(instance as never, [latestProvisioningRun] as never, [{ id: 'audit-1' }] as never, {
        status: 'ready',
      } as never),
    ).toEqual(
      expect.objectContaining({
        hostnames: [
          {
            hostname: 'demo.studio.example.org',
            isPrimary: true,
            createdAt: '2026-04-04T00:00:00.000Z',
          },
        ],
        auditEvents: [{ id: 'audit-1' }],
      }),
    );
  });

  it('creates status operations, audit events, and artifacts for each transition', async () => {
    const repository = {
      createProvisioningRun: vi.fn().mockResolvedValue(undefined),
      appendAuditEvent: vi.fn().mockResolvedValue(undefined),
    };

    expect(getStatusOperation('active')).toBe('activate');
    expect(getStatusOperation('suspended')).toBe('suspend');
    expect(getStatusOperation('archived')).toBe('archive');
    expect(getAuditEventType('active')).toBe('instance_activated');
    expect(getAuditEventType('suspended')).toBe('instance_suspended');
    expect(getAuditEventType('archived')).toBe('instance_archived');
    expect(createAuditDetails()).toEqual({});

    await createStatusArtifacts(
      repository as never,
      {
        instanceId: 'demo',
        nextStatus: 'archived',
        idempotencyKey: 'idem-1',
        actorId: 'actor-1',
        requestId: 'req-1',
      },
      'active',
    );

    expect(repository.createProvisioningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'archive',
        status: 'archived',
      }),
    );
    expect(repository.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'instance_archived',
        details: {
          previousStatus: 'active',
          nextStatus: 'archived',
        },
      }),
    );
  });

  it('derives tenant IAM status with explicit precedence and correlation fields', () => {
    expect(
      buildTenantIamStatus({
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
        accessEvidence: {
          status: 'blocked',
          summary: 'Tenant-Admin-Client darf Realm-Rollen nicht lesen.',
          source: 'access_probe',
          checkedAt: '2026-04-29T10:01:00.000Z',
          errorCode: 'IDP_FORBIDDEN',
          requestId: 'req-access-1',
        },
        reconcileEvidence: {
          status: 'degraded',
          summary: 'Ein Rollenabgleich ist mit Drift beendet worden.',
          source: 'role_reconcile',
          checkedAt: '2026-04-29T10:00:00.000Z',
          errorCode: 'IDP_CONFLICT',
          requestId: 'req-reconcile-1',
        },
      })
    ).toEqual({
      configuration: {
        status: 'ready',
        summary: 'Tenant-IAM-Struktur ist vollständig vorhanden.',
        source: 'keycloak_status_snapshot',
        checkedAt: undefined,
        errorCode: undefined,
        requestId: undefined,
      },
      access: {
        status: 'blocked',
        summary: 'Tenant-Admin-Client darf Realm-Rollen nicht lesen.',
        source: 'access_probe',
        checkedAt: '2026-04-29T10:01:00.000Z',
        errorCode: 'IDP_FORBIDDEN',
        requestId: 'req-access-1',
      },
      reconcile: {
        status: 'degraded',
        summary: 'Ein Rollenabgleich ist mit Drift beendet worden.',
        source: 'role_reconcile',
        checkedAt: '2026-04-29T10:00:00.000Z',
        errorCode: 'IDP_CONFLICT',
        requestId: 'req-reconcile-1',
      },
      overall: {
        status: 'blocked',
        summary: 'Tenant-IAM ist blockiert.',
        source: 'access_probe',
        checkedAt: '2026-04-29T10:01:00.000Z',
        errorCode: 'IDP_FORBIDDEN',
        requestId: 'req-access-1',
      },
    });
  });

  it('marks access as unknown without prior evidence', () => {
    expect(
      buildTenantIamStatus({
        keycloakStatus: undefined,
        accessEvidence: undefined,
        reconcileEvidence: undefined,
      })
    ).toEqual(
      expect.objectContaining({
        access: {
          status: 'unknown',
          summary: 'Noch keine tenantlokale Rechteprobe vorhanden.',
          source: 'access_probe',
        },
        overall: {
          status: 'unknown',
          summary: 'Tenant-IAM-Befund ist unvollständig.',
          source: 'registry',
        },
      })
    );
  });
});
