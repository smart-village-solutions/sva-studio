export type AuditCheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

export type AuditRunStatus = Exclude<AuditCheckStatus, 'skip'>;

export type AuditRegistryTarget = Readonly<{
  authClientSecretConfigured: boolean;
  authClientId: string;
  authRealm: string;
  displayName: string;
  instanceId: string;
  parentDomain: string;
  primaryHostname: string;
  status: string;
  tenantAdminClientId: string;
  tenantAdminClientSecretConfigured: boolean;
  tenantAdminEmail?: string;
  tenantAdminFirstName?: string;
  tenantAdminLastName?: string;
  tenantAdminUsername?: string;
}>;

export type AuditCheckResult = Readonly<{
  checkId: string;
  details?: Readonly<Record<string, unknown>>;
  status: AuditCheckStatus;
  summary: string;
  title: string;
}>;

export type AuditInstanceResult = Readonly<{
  authClientId: string;
  authRealm: string;
  checks: readonly AuditCheckResult[];
  instanceId: string;
  parentDomain: string;
  primaryHostname: string;
  registryStatus: string;
  status: AuditRunStatus;
}>;

export type StudioInstanceAuditResult = Readonly<{
  generatedAt: string;
  instances: readonly AuditInstanceResult[];
  profile: string;
  status: AuditRunStatus;
}>;

export const aggregateAuditStatus = (
  statuses: readonly AuditCheckStatus[],
): AuditRunStatus => {
  if (statuses.includes('fail')) {
    return 'fail';
  }
  if (statuses.includes('warn')) {
    return 'warn';
  }
  return 'pass';
};
