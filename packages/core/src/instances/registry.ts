const HOST_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const INSTANCE_ID_REGEX = HOST_LABEL_REGEX;
const PUNYCODE_PREFIX = 'xn--';

export const instanceStatuses = [
  'requested',
  'validated',
  'provisioning',
  'active',
  'failed',
  'suspended',
  'archived',
] as const;

export const trafficEnabledInstanceStatuses = ['active'] as const;

export type InstanceStatus = (typeof instanceStatuses)[number];
export type TrafficEnabledInstanceStatus = (typeof trafficEnabledInstanceStatuses)[number];

export type InstanceRegistryRecord = {
  readonly instanceId: string;
  readonly displayName: string;
  readonly status: InstanceStatus;
  readonly parentDomain: string;
  readonly primaryHostname: string;
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecretConfigured: boolean;
  readonly tenantAdminBootstrap?: {
    readonly username: string;
    readonly email?: string;
    readonly firstName?: string;
    readonly lastName?: string;
  };
  readonly themeKey?: string;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly mainserverConfigRef?: string;
  readonly createdAt: string;
  readonly createdBy?: string;
  readonly updatedAt: string;
  readonly updatedBy?: string;
};

export type InstanceProvisioningOperation = 'create' | 'activate' | 'suspend' | 'archive';

export type InstanceProvisioningRun = {
  readonly id: string;
  readonly instanceId: string;
  readonly operation: InstanceProvisioningOperation;
  readonly status: InstanceStatus;
  readonly stepKey?: string;
  readonly idempotencyKey: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly requestId?: string;
  readonly actorId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type InstanceAuditEvent = {
  readonly id: string;
  readonly instanceId: string;
  readonly eventType:
    | 'instance_requested'
    | 'instance_activated'
    | 'instance_suspended'
    | 'instance_archived'
    | 'instance_reconfigured';
  readonly actorId?: string;
  readonly requestId?: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
};

export type HostClassification =
  | { readonly kind: 'root'; readonly normalizedHost: string }
  | { readonly kind: 'tenant'; readonly normalizedHost: string; readonly instanceId: string }
  | { readonly kind: 'invalid'; readonly normalizedHost: string; readonly reason: string };

export const isInstanceStatus = (value: string): value is InstanceStatus =>
  (instanceStatuses as readonly string[]).includes(value);

export const isTrafficEnabledInstanceStatus = (
  value: InstanceStatus
): value is TrafficEnabledInstanceStatus =>
  (trafficEnabledInstanceStatuses as readonly string[]).includes(value);

export const normalizeHost = (host: string): string => {
  const hostWithoutPort = host.toLowerCase().split(':')[0] ?? '';
  let end = hostWithoutPort.length;
  while (end > 0 && hostWithoutPort[end - 1] === '.') {
    end -= 1;
  }
  return hostWithoutPort.slice(0, end);
};

export const isValidInstanceId = (value: string): boolean =>
  !value.startsWith(PUNYCODE_PREFIX) && INSTANCE_ID_REGEX.test(value);

export const isValidParentDomain = (value: string): boolean => {
  const normalized = normalizeHost(value);
  const labels = normalized.split('.');
  return (
    labels.length >= 2 &&
    labels.every((label) => label.length > 0 && !label.startsWith(PUNYCODE_PREFIX) && HOST_LABEL_REGEX.test(label))
  );
};

export const isValidHostname = (value: string): boolean => {
  const normalized = normalizeHost(value);
  const labels = normalized.split('.');
  return labels.every((label) => label.length > 0 && !label.startsWith(PUNYCODE_PREFIX) && HOST_LABEL_REGEX.test(label));
};

export const buildPrimaryHostname = (instanceId: string, parentDomain: string): string =>
  `${instanceId}.${normalizeHost(parentDomain)}`;

export const classifyHost = (host: string, parentDomain: string): HostClassification => {
  const normalizedHost = normalizeHost(host);
  const normalizedParentDomain = normalizeHost(parentDomain);

  if (!isValidParentDomain(normalizedParentDomain)) {
    return {
      kind: 'invalid',
      normalizedHost,
      reason: 'invalid_parent_domain',
    };
  }

  if (normalizedHost === normalizedParentDomain) {
    return {
      kind: 'root',
      normalizedHost,
    };
  }

  const suffix = `.${normalizedParentDomain}`;
  if (!normalizedHost.endsWith(suffix)) {
    return {
      kind: 'invalid',
      normalizedHost,
      reason: 'outside_parent_domain',
    };
  }

  const candidate = normalizedHost.slice(0, -suffix.length);
  if (candidate.includes('.')) {
    return {
      kind: 'invalid',
      normalizedHost,
      reason: 'multi_level_subdomain',
    };
  }

  if (!isValidInstanceId(candidate)) {
    return {
      kind: 'invalid',
      normalizedHost,
      reason: 'invalid_instance_id',
    };
  }

  return {
    kind: 'tenant',
    normalizedHost,
    instanceId: candidate,
  };
};

const allowedTransitions: Readonly<Record<InstanceStatus, readonly InstanceStatus[]>> = {
  requested: ['validated', 'failed', 'archived'],
  validated: ['provisioning', 'failed', 'archived'],
  provisioning: ['active', 'failed', 'archived'],
  active: ['suspended', 'archived'],
  failed: ['validated', 'provisioning', 'archived'],
  suspended: ['active', 'archived'],
  archived: [],
};

export const canTransitionInstanceStatus = (from: InstanceStatus, to: InstanceStatus): boolean =>
  from === to || allowedTransitions[from].includes(to);
