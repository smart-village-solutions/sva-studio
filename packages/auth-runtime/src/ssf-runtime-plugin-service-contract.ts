import type { InstanceRegistryRecord } from '@sva/core';

import type { PluginServerHandlerDispatcherDependencies } from './plugin-server-handlers/dispatcher.js';
import {
  SSF_RUNTIME_REQUIRED_ACTION,
  type SsfRuntimeServiceAuthentication,
} from './ssf-runtime-service-token.js';

export const SSF_RUNTIME_CONTRACT_VERSION = '1.0';
export const SSF_RUNTIME_PLUGIN_ID = 'ssf';
export const SSF_RUNTIME_SERVICE_ID = 'ssf-runtime';
export const SSF_RUNTIME_INSTANCE_HEADER = 'X-Studio-Instance-Id';
export const SSF_RUNTIME_CORRELATION_HEADER = 'X-Correlation-Id';
export const SSF_RUNTIME_CORRELATION_LIMIT = 128;
export const SSF_REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/u;
export const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7e]+$/u;

export type SsfTenantReadinessInput = Readonly<{
  readonly databaseReady: boolean;
  readonly authorizationRevision: string | null;
  readonly timeZone: string | null;
}>;

export type ReadySsfTenant = Readonly<{
  readonly databaseReady: true;
  readonly authorizationRevision: string;
  readonly timeZone: string;
}>;

export type SsfRuntimeErrorCode =
  | 'service_authentication_invalid'
  | 'service_action_forbidden'
  | 'tenant_not_found'
  | 'tenant_suspended'
  | 'ssf_plugin_inactive'
  | 'ssf_tenant_not_ready'
  | 'runtime_configuration_unavailable';

export type SsfRuntimeReadinessReason =
  | SsfRuntimeErrorCode
  | 'identity_provider_unavailable'
  | 'invalid_service_token'
  | 'missing_action_scope'
  | 'service_token_not_configured'
  | 'ssf_authorization_revision_missing'
  | 'ssf_database_not_ready'
  | 'ssf_tenant_timezone_missing'
  | 'ready';

export type SsfRuntimePluginServiceDependencies = Readonly<{
  authenticateToken?: (token: string) => Promise<SsfRuntimeServiceAuthentication>;
  readInstance?: (instanceId: string) => Promise<InstanceRegistryRecord | null>;
  readPluginAccess?: typeof import('./plugin-tenant-lifecycle/access.js').readConfiguredPluginTenantAccess;
  readDatabaseReadiness?: (instanceId: string) => Promise<boolean>;
  readAuthorizationRevision?: (instanceId: string) => Promise<string | null>;
  readTimeZone?: (instanceId: string) => Promise<string | null>;
  emitSecurityAudit?: typeof import('./audit-events.js').emitAuthAuditEvent;
}>;

const isValidTimeZone = (value: string | null): value is string => {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

export const resolveSsfTenantReadinessReason = (
  input: SsfTenantReadinessInput
):
  | 'ssf_database_not_ready'
  | 'ssf_authorization_revision_missing'
  | 'ssf_tenant_timezone_missing'
  | null =>
  !input.databaseReady
    ? 'ssf_database_not_ready'
    : !input.authorizationRevision || !SSF_REVISION_PATTERN.test(input.authorizationRevision)
      ? 'ssf_authorization_revision_missing'
      : !isValidTimeZone(input.timeZone)
        ? 'ssf_tenant_timezone_missing'
        : null;

export const isReadySsfTenant = (input: SsfTenantReadinessInput): input is ReadySsfTenant =>
  resolveSsfTenantReadinessReason(input) === null;

export const hasExpectedSsfDescriptorContract = (input: {
  readonly serviceId: string;
  readonly descriptor: Parameters<
    NonNullable<PluginServerHandlerDispatcherDependencies['authenticateService']>
  >[0]['descriptor'];
}): boolean =>
  input.serviceId === SSF_RUNTIME_SERVICE_ID &&
  input.descriptor.ownerPluginId === SSF_RUNTIME_PLUGIN_ID &&
  input.descriptor.actionId === SSF_RUNTIME_REQUIRED_ACTION &&
  input.descriptor.accessRequirement.kind === 'service' &&
  input.descriptor.accessRequirement.tenantBinding.headerName.toLowerCase() ===
    SSF_RUNTIME_INSTANCE_HEADER.toLowerCase();
