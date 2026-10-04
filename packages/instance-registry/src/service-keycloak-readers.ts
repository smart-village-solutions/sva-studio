import { classifyHost, normalizeHost } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';
import type { InstanceRegistryRepository } from '@sva/data-repositories';

import type { InstanceRegistryServiceDeps } from './service-types.js';
import type { KeycloakTenantStatus, ResolveRuntimeInstanceResult } from './keycloak-types.js';
import { buildMissingRealmStatus } from './provisioning-auth-evaluation.js';
import { KEYCLOAK_SNAPSHOT_POLICY_VERSION } from './provisioning-auth-policy.js';
import { toListItem } from './service-helpers.js';
import {
  loadPersistedSnapshotSecretVersions,
  loadRepositoryAuthClientSecret,
  loadRepositoryTenantAdminClientSecret,
} from './service-keycloak-secrets.js';
import {
  buildSnapshotInputFingerprintForRun,
  readSnapshotFromRuns,
  refreshManagedRealmSmtpPasswordStatus,
} from './service-keycloak-snapshot-reader.js';
const logger = createSdkLogger({ component: 'iam-instance-registry-keycloak', level: 'info' });

const buildLocalStatus = (input: {
  authClientSecretConfigured: boolean;
  authClientSecret?: string;
  tenantAdminClient?: {
    clientId: string;
    secretConfigured: boolean;
  };
  tenantAdminClientSecret?: string;
}): KeycloakTenantStatus =>
  buildMissingRealmStatus(
    input.authClientSecretConfigured,
    input.authClientSecret,
    input.tenantAdminClient,
    input.tenantAdminClientSecret
  );
export const createGetKeycloakStatusHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (instanceId: string): Promise<KeycloakTenantStatus | null> => {
    logger.debug('get_keycloak_status_started', {
      operation: 'get_keycloak_status',
      instance_id: instanceId,
    });
    const instance = await deps.repository.getInstanceById(instanceId);
    if (!instance) {
      return null;
    }

    const runs = await deps.repository.listKeycloakProvisioningRuns(instanceId);
    const secretVersions = await loadPersistedSnapshotSecretVersions(
      deps.repository,
      runs,
      ['status_snapshot'],
      KEYCLOAK_SNAPSHOT_POLICY_VERSION,
      instanceId
    );
    const inputFingerprint = (run: (typeof runs)[number]) =>
      buildSnapshotInputFingerprintForRun(deps, run, instance, secretVersions);
    const status = readSnapshotFromRuns<KeycloakTenantStatus>(
      runs,
      ['status_snapshot'],
      'status',
      KEYCLOAK_SNAPSHOT_POLICY_VERSION,
      inputFingerprint
    );
    if (status) {
      const refreshedStatus = await refreshManagedRealmSmtpPasswordStatus(
        deps,
        instance,
        runs,
        secretVersions,
        status
      );
      logger.info('keycloak_status_check_completed', {
        operation: 'get_keycloak_status',
        instance_id: instanceId,
      });
      return refreshedStatus;
    }

    let authClientSecret: string | undefined;
    let tenantAdminClientSecret: string | undefined;
    if (deps.revealSecret) {
      authClientSecret = await loadRepositoryAuthClientSecret(
        deps,
        deps.repository,
        instance.instanceId
      );
      tenantAdminClientSecret = await loadRepositoryTenantAdminClientSecret(
        deps,
        deps.repository,
        instance.instanceId
      );
    }

    const result = buildLocalStatus({
      authClientSecretConfigured: instance.authClientSecretConfigured,
      authClientSecret,
      tenantAdminClient: instance.tenantAdminClient,
      tenantAdminClientSecret,
    });

    logger.info('keycloak_status_check_completed', {
      operation: 'get_keycloak_status',
      instance_id: instanceId,
    });
    return result;
  };

export const createGetKeycloakProvisioningRunHandler =
  (deps: InstanceRegistryServiceDeps) => async (instanceId: string, runId: string) =>
    deps.repository.getKeycloakProvisioningRun(instanceId, runId);

export const createRuntimeResolver =
  (repository: InstanceRegistryRepository) =>
  async (host: string): Promise<ResolveRuntimeInstanceResult> => {
    const normalizedHost = normalizeHost(host);
    const instance = await repository.resolveHostname(normalizedHost);
    if (!instance) {
      return {
        hostClassification: {
          kind: 'invalid',
          normalizedHost,
          reason: 'unknown_host',
        },
        instance: null,
      };
    }

    return {
      hostClassification: classifyHost(normalizedHost, instance.parentDomain),
      instance: toListItem(instance),
    };
  };

export { createGetKeycloakPreflightHandler } from './service-keycloak-readers-preflight.js';
export { createPlanKeycloakProvisioningHandler } from './service-keycloak-readers-plan.js';
