import type { InstanceRegistryRepository } from '@sva/data';
import type { CreateInstanceProvisioningInput, InstanceRegistryServiceDeps } from './types.js';
import { createAuditDetails } from './service-helpers.js';

export const createProvisioningArtifacts = async (
  repository: InstanceRegistryRepository,
  instance: Awaited<ReturnType<InstanceRegistryRepository['createInstance']>>,
  input: CreateInstanceProvisioningInput
): Promise<void> => {
  await repository.createProvisioningRun({
    instanceId: instance.instanceId,
    operation: 'create',
    status: 'requested',
    idempotencyKey: input.idempotencyKey,
    actorId: input.actorId,
    requestId: input.requestId,
  });
  await repository.appendAuditEvent({
    instanceId: instance.instanceId,
    eventType: 'instance_requested',
    actorId: input.actorId,
    requestId: input.requestId,
    details: createAuditDetails({
      parentDomain: instance.parentDomain,
      primaryHostname: instance.primaryHostname,
    }),
  });
};

export const provisionInstanceAuth = async (
  deps: InstanceRegistryServiceDeps,
  instance: Awaited<ReturnType<InstanceRegistryRepository['createInstance']>>,
  input: CreateInstanceProvisioningInput
): Promise<Awaited<ReturnType<InstanceRegistryRepository['createInstance']>>> => {
  if (!deps.provisionInstanceAuth) {
    return instance;
  }

  await deps.repository.createProvisioningRun({
    instanceId: instance.instanceId,
    operation: 'create',
    status: 'provisioning',
    stepKey: 'keycloak',
    idempotencyKey: input.idempotencyKey,
    actorId: input.actorId,
    requestId: input.requestId,
  });

  try {
    await deps.provisionInstanceAuth({
      instanceId: instance.instanceId,
      primaryHostname: instance.primaryHostname,
      authRealm: instance.authRealm,
      authClientId: instance.authClientId,
      authIssuerUrl: instance.authIssuerUrl,
      authClientSecret: input.authClientSecret,
      tenantAdminBootstrap: input.tenantAdminBootstrap,
    });

    const validatedInstance =
      (await deps.repository.setInstanceStatus({
        instanceId: instance.instanceId,
        status: 'validated',
        actorId: input.actorId,
        requestId: input.requestId,
      })) ?? instance;

    await deps.repository.createProvisioningRun({
      instanceId: instance.instanceId,
      operation: 'create',
      status: validatedInstance.status,
      stepKey: 'keycloak',
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestId: input.requestId,
    });

    return validatedInstance;
  } catch (error) {
    const failedInstance =
      (await deps.repository.setInstanceStatus({
        instanceId: instance.instanceId,
        status: 'failed',
        actorId: input.actorId,
        requestId: input.requestId,
      })) ?? instance;

    await deps.repository.createProvisioningRun({
      instanceId: instance.instanceId,
      operation: 'create',
      status: failedInstance.status,
      stepKey: 'keycloak',
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestId: input.requestId,
      errorCode: 'keycloak_provisioning_failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    return failedInstance;
  }
};
