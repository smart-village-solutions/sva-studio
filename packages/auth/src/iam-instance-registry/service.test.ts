import { describe, expect, it, vi } from 'vitest';

import { createInstanceRegistryService } from './service.js';

import type { InstanceRegistryRepository } from '@sva/data';
import type { InstanceAuditEvent, InstanceProvisioningRun, InstanceRegistryRecord } from '@sva/data';

const now = '2026-01-01T00:00:00.000Z';

const createRepository = (): InstanceRegistryRepository => {
  const instances = new Map<string, InstanceRegistryRecord>();
  const provisioningRuns = new Map<string, InstanceProvisioningRun[]>();
  const auditEvents = new Map<string, InstanceAuditEvent[]>();

  return {
    async listInstances(input = {}) {
      return [...instances.values()].filter((instance) => {
        const matchesSearch = input.search
          ? instance.instanceId.includes(input.search) || instance.displayName.includes(input.search)
          : true;
        const matchesStatus = input.status ? instance.status === input.status : true;
        return matchesSearch && matchesStatus;
      });
    },
    async getInstanceById(instanceId) {
      return instances.get(instanceId) ?? null;
    },
    async resolveHostname(hostname) {
      return [...instances.values()].find((instance) => instance.primaryHostname === hostname) ?? null;
    },
    async listProvisioningRuns(instanceId) {
      return provisioningRuns.get(instanceId) ?? [];
    },
    async listAuditEvents(instanceId) {
      return auditEvents.get(instanceId) ?? [];
    },
    async createInstance(input) {
      const record: InstanceRegistryRecord = {
        instanceId: input.instanceId,
        displayName: input.displayName,
        status: input.status,
        parentDomain: input.parentDomain,
        primaryHostname: input.primaryHostname,
        themeKey: input.themeKey,
        featureFlags: input.featureFlags ?? {},
        mainserverConfigRef: input.mainserverConfigRef,
        createdAt: now,
        createdBy: input.actorId,
        updatedAt: now,
        updatedBy: input.actorId,
      };
      instances.set(record.instanceId, record);
      return record;
    },
    async setInstanceStatus(input) {
      const current = instances.get(input.instanceId);
      if (!current) {
        return null;
      }

      const updated: InstanceRegistryRecord = {
        ...current,
        status: input.status,
        updatedAt: now,
        updatedBy: input.actorId,
      };
      instances.set(updated.instanceId, updated);
      return updated;
    },
    async createProvisioningRun(input) {
      const run: InstanceProvisioningRun = {
        id: `${input.instanceId}-${input.operation}-${input.status}`,
        instanceId: input.instanceId,
        operation: input.operation,
        status: input.status,
        stepKey: input.stepKey,
        idempotencyKey: input.idempotencyKey,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        requestId: input.requestId,
        actorId: input.actorId,
        createdAt: now,
        updatedAt: now,
      };
      provisioningRuns.set(input.instanceId, [run, ...(provisioningRuns.get(input.instanceId) ?? [])]);
      return run;
    },
    async appendAuditEvent(input) {
      const event: InstanceAuditEvent = {
        id: `${input.instanceId}-${input.eventType}`,
        instanceId: input.instanceId,
        eventType: input.eventType,
        actorId: input.actorId,
        requestId: input.requestId,
        details: input.details ?? {},
        createdAt: now,
      };
      auditEvents.set(input.instanceId, [event, ...(auditEvents.get(input.instanceId) ?? [])]);
    },
  };
};

describe('iam-instance-registry service', () => {
  it('resolves a newly provisioned instance without requiring a redeploy', async () => {
    const invalidateHost = vi.fn();
    const service = createInstanceRegistryService({
      repository: createRepository(),
      invalidateHost,
    });

    const created = await service.createProvisioningRequest({
      idempotencyKey: 'idem-create',
      instanceId: 'demo',
      displayName: 'Demo',
      parentDomain: 'studio.lvh.me',
      actorId: 'actor-1',
      requestId: 'req-1',
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error('Instanzanlage fehlgeschlagen.');
    }

    const resolved = await service.resolveRuntimeInstance('demo.studio.lvh.me');

    expect(resolved.hostClassification.kind).toBe('tenant');
    expect(resolved.instance).toEqual(
      expect.objectContaining({
        instanceId: 'demo',
        status: 'requested',
        primaryHostname: 'demo.studio.lvh.me',
      })
    );
    expect(invalidateHost).toHaveBeenCalledWith('demo.studio.lvh.me');
  });

  it('records follow-up runs and audit events when an instance is activated', async () => {
    const repository = createRepository();
    const service = createInstanceRegistryService({
      repository,
      invalidateHost: vi.fn(),
    });

    await repository.createInstance({
      instanceId: 'hb',
      displayName: 'HB',
      status: 'provisioning',
      parentDomain: 'studio.lvh.me',
      primaryHostname: 'hb.studio.lvh.me',
      actorId: 'actor-1',
      requestId: 'req-1',
    });
    await repository.createProvisioningRun({
      instanceId: 'hb',
      operation: 'create',
      status: 'provisioning',
      idempotencyKey: 'idem-create',
      actorId: 'actor-1',
      requestId: 'req-1',
    });
    await repository.appendAuditEvent({
      instanceId: 'hb',
      eventType: 'instance_requested',
      actorId: 'actor-1',
      requestId: 'req-1',
      details: {},
    });

    const changed = await service.changeStatus({
      idempotencyKey: 'idem-activate',
      instanceId: 'hb',
      nextStatus: 'active',
      actorId: 'actor-2',
      requestId: 'req-2',
    });

    expect(changed).toEqual(
      expect.objectContaining({
        ok: true,
        instance: expect.objectContaining({
          instanceId: 'hb',
          status: 'active',
        }),
      })
    );

    const detail = await service.getInstanceDetail('hb');
    expect(detail?.provisioningRuns.map((run) => run.operation)).toEqual(['activate', 'create']);
    expect(detail?.auditEvents.map((event) => event.eventType)).toEqual(['instance_activated', 'instance_requested']);
  });
});
