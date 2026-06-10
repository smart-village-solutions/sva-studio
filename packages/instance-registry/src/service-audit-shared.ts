import type {
  InstanceAuditCheck,
  InstanceAuditCheckStatus,
  InstanceAuditInstanceResult,
} from '@sva/core';

export const CHECK_IDS = {
  runTargetsPresent: 'run.targets.present',
  instanceUrlReachable: 'instance.url.reachable',
  registryInstanceActive: 'registry.instance.active',
  registryRealmPresent: 'registry.realm.present',
  registryLoginClientPresent: 'registry.loginClient.present',
  registryTenantAdminClientPresent: 'registry.tenantAdminClient.present',
  registryLoginSecretConfigured: 'registry.loginSecret.configured',
  registryTenantAdminSecretConfigured: 'registry.tenantAdminSecret.configured',
  keycloakRealmExists: 'keycloak.realm.exists',
  keycloakLoginClientExists: 'keycloak.client.login.exists',
  keycloakLoginSecretAligned: 'keycloak.client.login.secretAligned',
  keycloakTenantAdminClientExists: 'keycloak.client.tenantAdmin.exists',
  keycloakTenantAdminSecretAligned: 'keycloak.client.tenantAdmin.secretAligned',
  keycloakSystemAdminRoleExists: 'keycloak.role.systemAdmin.exists',
  keycloakSystemAdminUserExists: 'keycloak.user.systemAdmin.exists',
  localSystemAdminAssignmentExists: 'localIam.systemAdminAssignment.exists',
} as const;

export const aggregateStatuses = (statuses: readonly InstanceAuditCheckStatus[]): InstanceAuditCheckStatus => {
  if (statuses.some((status) => status === 'fail')) {
    return 'fail';
  }
  if (statuses.some((status) => status === 'warn')) {
    return 'warn';
  }
  if (statuses.some((status) => status === 'pass')) {
    return 'pass';
  }
  return 'skip';
};

export const createCheck = (input: InstanceAuditCheck): InstanceAuditCheck => input;

export const createSkipCheck = (
  checkId: string,
  title: string,
  scope: InstanceAuditCheck['scope'],
  expected: string,
  evidenceSource: string,
  message: string
): InstanceAuditCheck =>
  createCheck({
    checkId,
    title,
    scope,
    status: 'skip',
    expected,
    actual: 'nicht geprüft',
    evidenceSource,
    message,
  });

export const mapWithConcurrencyLimit = async <TInput, TResult>(
  items: readonly TInput[],
  limit: number,
  worker: (item: TInput, index: number) => Promise<TResult>
): Promise<TResult[]> => {
  if (items.length === 0) {
    return [];
  }

  const results: TResult[] = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex] as TInput, currentIndex);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      await runWorker();
    })
  );

  return results;
};

export const toSummary = (
  instances: readonly InstanceAuditInstanceResult[],
  runChecks: readonly InstanceAuditCheck[]
) => {
  const allStatuses = [...instances.flatMap((instance) => instance.checks), ...runChecks].map((check) => check.status);
  return {
    totalInstances: instances.length,
    passCount: allStatuses.filter((status) => status === 'pass').length,
    failCount: allStatuses.filter((status) => status === 'fail').length,
    warnCount: allStatuses.filter((status) => status === 'warn').length,
    skipCount: allStatuses.filter((status) => status === 'skip').length,
  };
};
