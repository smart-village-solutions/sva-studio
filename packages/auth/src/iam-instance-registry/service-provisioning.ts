import { createSdkLogger } from '@sva/sdk/server';
import type { InstanceRegistryRepository } from '@sva/data';
import type { CreateInstanceProvisioningInput } from './mutation-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { createAuditDetails } from './service-helpers.js';

const logger = createSdkLogger({ component: 'iam-instance-registry-provisioning', level: 'info' });

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

  logger.info('provisioning_step_started', {
    operation: 'create_instance',
    step_key: 'keycloak',
    instance_id: instance.instanceId,
    request_id: input.requestId,
  });
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

    logger.info('provisioning_step_completed', {
      operation: 'create_instance',
      step_key: 'keycloak',
      instance_id: validatedInstance.instanceId,
      status: validatedInstance.status,
      request_id: input.requestId,
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

    logger.error('provisioning_step_failed', {
      operation: 'create_instance',
      step_key: 'keycloak',
      instance_id: failedInstance.instanceId,
      request_id: input.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return failedInstance;
  }
};
