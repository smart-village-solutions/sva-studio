import { SSF_TOKEN_CLAIMS } from './authorization-projection.js';
import type {
  KeycloakAttributes,
  KeycloakProjectionUser,
  SsfKeycloakProjectionClient,
  SsfKeycloakProjectionTargetDependencies,
  SsfKeycloakProjectionTenant,
} from './keycloak-authorization-projection-contract.js';

const PAGE_SIZE = 100;
const DEFAULT_SESSION_REVOCATION_TIMEOUT_MS = 10_000;
const CLAIM_NAMES = Object.values(SSF_TOKEN_CLAIMS);
const CLAIM_NAME_SET = new Set<string>(CLAIM_NAMES);

export const withSessionRevocationTimeout = async <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> => {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('ssf_session_revocation_timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const resolveSessionRevocationTimeoutMs = (
  configuredTimeoutMs: number | undefined
): number => {
  const timeoutMs = configuredTimeoutMs ?? DEFAULT_SESSION_REVOCATION_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('ssf_session_revocation_timeout_invalid');
  }
  return timeoutMs;
};

export const listAllUsers = async (
  client: SsfKeycloakProjectionClient
): Promise<readonly KeycloakProjectionUser[]> => {
  const users: KeycloakProjectionUser[] = [];
  for (let first = 0; ; first += PAGE_SIZE) {
    const page = await client.listUsers({ first, max: PAGE_SIZE });
    users.push(...page);
    if (page.length < PAGE_SIZE) return users;
  }
};

export const areAttributesEqual = (
  left: Readonly<Record<string, readonly string[]>>,
  right: Readonly<Record<string, readonly string[]>>
): boolean => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        (left[key]?.length ?? 0) === (right[key]?.length ?? 0) &&
        left[key]?.every((value, valueIndex) => value === right[key]?.[valueIndex]) === true
    )
  );
};

export const withoutProjectionAttributes = (
  attributes: KeycloakAttributes
): Record<string, readonly string[]> =>
  Object.fromEntries(Object.entries(attributes).filter(([name]) => !CLAIM_NAME_SET.has(name)));

export const hasProjectionAttributes = (attributes: KeycloakAttributes): boolean =>
  CLAIM_NAMES.some((name) => attributes[name] !== undefined);

export const readSingleAttribute = (attributes: KeycloakAttributes, name: string): string => {
  const values = attributes[name];
  if (values?.length !== 1 || !values[0]) {
    throw new Error(`ssf_keycloak_projection_invalid_attribute:${name}`);
  }
  return values[0];
};

export const ensureClaimMappers = async (tenant: SsfKeycloakProjectionTenant): Promise<void> => {
  for (const [claimName, multivalued] of [
    [SSF_TOKEN_CLAIMS.instanceId, false],
    [SSF_TOKEN_CLAIMS.roles, true],
    [SSF_TOKEN_CLAIMS.permissions, true],
    [SSF_TOKEN_CLAIMS.authorizationRevision, false],
  ] as const) {
    await tenant.client.ensureUserAttributeProtocolMapper({
      clientId: tenant.clientId,
      name: `studio-${claimName.replace(/_/gu, '-')}`,
      userAttribute: claimName,
      claimName,
      multivalued,
    });
  }
};

export const requireTenant = async (
  resolveTenant: SsfKeycloakProjectionTargetDependencies['resolveTenant'],
  instanceId: string
): Promise<SsfKeycloakProjectionTenant> => {
  const tenant = await resolveTenant(instanceId);
  if (!tenant || tenant.instanceId !== instanceId) {
    throw new Error('ssf_keycloak_projection_tenant_unavailable');
  }
  return tenant;
};
