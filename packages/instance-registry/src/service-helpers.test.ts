import { describe, expect, it, vi } from 'vitest';

import {
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
});
