import type {
  InstanceAuditInstanceResult,
  InstanceAuditRun,
} from '@sva/core';

import { buildKeycloakChecks, resolveKeycloakStatus } from './service-audit-keycloak.js';
import {
  CHECK_IDS,
  aggregateStatuses,
  createCheck,
  mapWithConcurrencyLimit,
  toSummary,
} from './service-audit-shared.js';
import {
  createLocalIamCheck,
  createRegistryChecks,
  probeInstanceUrlReachability,
} from './service-audit-registry.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

const INSTANCE_AUDIT_CONCURRENCY = 3;

const buildInstanceAuditResult = async (
  deps: InstanceRegistryServiceDeps,
  instanceId: string
): Promise<InstanceAuditInstanceResult | null> => {
  const instance = await deps.repository.getInstanceById(instanceId);
  if (!instance) {
    return null;
  }

  const [urlCheck, keycloak, localSystemAdminCount] = await Promise.all([
    probeInstanceUrlReachability(instance.primaryHostname),
    resolveKeycloakStatus(deps, instance.instanceId),
    deps.repository.countLocalSystemAdminAssignments(instance.instanceId),
  ]);

  const checks = [
    urlCheck,
    ...createRegistryChecks({
      status: instance.status,
      authRealm: instance.authRealm,
      authClientId: instance.authClientId,
      authClientSecretConfigured: instance.authClientSecretConfigured,
      tenantAdminClientId: instance.tenantAdminClient?.clientId,
      tenantAdminSecretConfigured: instance.tenantAdminClient?.secretConfigured ?? false,
    }),
    ...buildKeycloakChecks({
      keycloakStatus: keycloak.status,
      keycloakEvidenceSource: keycloak.evidenceSource,
      keycloakError: keycloak.error,
      fallbackStatus: keycloak.fallbackStatus,
      fallbackEvidenceSource: keycloak.fallbackEvidenceSource,
      fallbackError: keycloak.fallbackError,
    }),
    createLocalIamCheck(localSystemAdminCount),
  ];

  return {
    instanceId: instance.instanceId,
    displayName: instance.displayName,
    status: instance.status,
    primaryHostname: instance.primaryHostname,
    overallStatus: aggregateStatuses(checks.map((check) => check.status)),
    checks,
  };
};

export const createRunInstanceAuditHandler =
  (deps: InstanceRegistryServiceDeps) =>
  async (input: {
    instanceIds?: readonly string[];
    includeOnlyActive?: boolean;
    actorId?: string;
    requestId?: string;
  } = {}): Promise<InstanceAuditRun> => {
    const includeOnlyActive = input.includeOnlyActive ?? true;
    const requestedInstanceIds = [...new Set((input.instanceIds ?? []).map((instanceId) => instanceId.trim()).filter(Boolean))];

    const instances =
      requestedInstanceIds.length > 0
        ? (
            await mapWithConcurrencyLimit(requestedInstanceIds, INSTANCE_AUDIT_CONCURRENCY, async (instanceId) => {
                const instance = await deps.repository.getInstanceById(instanceId);
                if (!instance) {
                  return null;
                }
                if (includeOnlyActive && instance.status !== 'active') {
                  return null;
                }
                return instance;
              })
          ).filter((instance): instance is NonNullable<typeof instance> => Boolean(instance))
        : await deps.repository.listInstances(includeOnlyActive ? { status: 'active' } : undefined);

    const runChecks =
      instances.length > 0
        ? [
            createCheck({
              checkId: CHECK_IDS.runTargetsPresent,
              title: 'Zielinstanzen geladen',
              scope: 'run',
              status: 'pass',
              expected: 'Mindestens eine Zielinstanz',
              actual: `${instances.length} Instanzen`,
              evidenceSource: 'instance_registry',
              message: 'Für den Audit-Lauf wurden Zielinstanzen geladen.',
            }),
          ]
        : [
            createCheck({
              checkId: CHECK_IDS.runTargetsPresent,
              title: 'Zielinstanzen geladen',
              scope: 'run',
              status: 'fail',
              expected: 'Mindestens eine Zielinstanz',
              actual: '0 Instanzen',
              evidenceSource: 'instance_registry',
              message: 'Der Audit-Lauf hat keine Zielinstanzen geladen.',
              remediationHint: 'Filter, Registry-Daten und den aktiven Status der Zielinstanzen prüfen.',
            }),
          ];

    const results = (
      await mapWithConcurrencyLimit(
        instances,
        INSTANCE_AUDIT_CONCURRENCY,
        async (instance) => buildInstanceAuditResult(deps, instance.instanceId)
      )
    ).filter((instance): instance is InstanceAuditInstanceResult => Boolean(instance));

    const overallStatus = aggregateStatuses([
      ...runChecks.map((check) => check.status),
      ...results.map((result) => result.overallStatus),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      requestId: input.requestId,
      actorId: input.actorId,
      includeOnlyActive,
      targetInstanceIds: requestedInstanceIds.length > 0 ? requestedInstanceIds : instances.map((instance) => instance.instanceId),
      overallStatus,
      summary: toSummary(results, runChecks),
      checks: runChecks,
      instances: results,
    };
  };
