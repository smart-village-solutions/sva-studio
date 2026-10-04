const HOST_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const INSTANCE_ID_REGEX = HOST_LABEL_REGEX;
const PUNYCODE_PREFIX = 'xn--';

export type HostClassification =
  | { readonly kind: 'root'; readonly normalizedHost: string }
  | { readonly kind: 'tenant'; readonly normalizedHost: string; readonly instanceId: string }
  | { readonly kind: 'invalid'; readonly normalizedHost: string; readonly reason: string };

export const normalizeHost = (host: string): string => {
  const hostWithoutPort = host.toLowerCase().split(':')[0] ?? '';
  let end = hostWithoutPort.length;
  while (end > 0 && hostWithoutPort[end - 1] === '.') {
    end -= 1;
  }
  return hostWithoutPort.slice(0, end);
};

export const isReservedTenantHostname = (value: string): boolean =>
  ['studio', 'auth'].includes(value.toLowerCase());

export const isValidInstanceId = (value: string): boolean =>
  !value.startsWith(PUNYCODE_PREFIX) && INSTANCE_ID_REGEX.test(value);

export const isValidParentDomain = (value: string): boolean => {
  const normalized = normalizeHost(value);
  const labels = normalized.split('.');
  return (
    labels.length >= 2 &&
    labels.every(
      (label) =>
        label.length > 0 && !label.startsWith(PUNYCODE_PREFIX) && HOST_LABEL_REGEX.test(label)
    )
  );
};

export const isValidHostname = (value: string): boolean => {
  const normalized = normalizeHost(value);
  const labels = normalized.split('.');
  return labels.every(
    (label) =>
      label.length > 0 && !label.startsWith(PUNYCODE_PREFIX) && HOST_LABEL_REGEX.test(label)
  );
};

export const buildPrimaryHostname = (instanceId: string, parentDomain: string): string =>
  `${instanceId}.${normalizeHost(parentDomain)}`;

export const classifyHost = (
  host: string,
  parentDomain: string,
  studioRootHost: string = parentDomain
): HostClassification => {
  const normalizedHost = normalizeHost(host);
  const normalizedParentDomain = normalizeHost(parentDomain);

  if (!isValidParentDomain(normalizedParentDomain)) {
    return {
      kind: 'invalid',
      normalizedHost,
      reason: 'invalid_parent_domain',
    };
  }

  if (normalizedHost === normalizeHost(studioRootHost)) {
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

  if (isReservedTenantHostname(candidate)) {
    return { kind: 'invalid', normalizedHost, reason: 'reserved_tenant_hostname' };
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
