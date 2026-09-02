import {
  createSsfAuthorizationRevision,
  normalizeSsfAuthorizationProjection,
  SSF_AUTHORIZATION_PROJECTION_VERSION,
  SSF_TOKEN_CLAIMS,
  ssfAuthorizationProjectionSchema,
} from './authorization-projection.js';
import type { SsfAuthorizationProjectionTarget } from './authorization-projection-reconciler.js';

type KeycloakAttributes = Readonly<Record<string, readonly string[]>>;

type KeycloakProjectionUser = Readonly<{
  externalId: string;
  attributes?: KeycloakAttributes;
}>;

export interface SsfKeycloakProjectionClient {
  listUsers(query?: {
    readonly first?: number;
    readonly max?: number;
  }): Promise<readonly KeycloakProjectionUser[]>;
  getUserAttributes(externalId: string): Promise<KeycloakAttributes>;
  updateUser(
    externalId: string,
    input: { readonly attributes: Readonly<Record<string, readonly string[]>> }
  ): Promise<void>;
  ensureUserAttributeProtocolMapper(input: {
    readonly clientId: string;
    readonly name: string;
    readonly userAttribute: string;
    readonly claimName: string;
    readonly multivalued?: boolean;
  }): Promise<void>;
}

export type SsfKeycloakProjectionTenant = Readonly<{
  instanceId: string;
  clientId: string;
  client: SsfKeycloakProjectionClient;
}>;

const PAGE_SIZE = 100;
const CLAIM_NAMES = Object.values(SSF_TOKEN_CLAIMS);
const CLAIM_NAME_SET = new Set<string>(CLAIM_NAMES);

const listAllUsers = async (
  client: SsfKeycloakProjectionClient
): Promise<readonly KeycloakProjectionUser[]> => {
  const users: KeycloakProjectionUser[] = [];
  for (let first = 0; ; first += PAGE_SIZE) {
    const page = await client.listUsers({ first, max: PAGE_SIZE });
    users.push(...page);
    if (page.length < PAGE_SIZE) return users;
  }
};

const areAttributesEqual = (
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

const withoutProjectionAttributes = (
  attributes: KeycloakAttributes
): Record<string, readonly string[]> =>
  Object.fromEntries(Object.entries(attributes).filter(([name]) => !CLAIM_NAME_SET.has(name)));

const hasProjectionAttributes = (attributes: KeycloakAttributes): boolean =>
  CLAIM_NAMES.some((name) => attributes[name] !== undefined);

const readSingleAttribute = (attributes: KeycloakAttributes, name: string): string => {
  const values = attributes[name];
  if (values?.length !== 1 || !values[0]) {
    throw new Error(`ssf_keycloak_projection_invalid_attribute:${name}`);
  }
  return values[0];
};

const ensureClaimMappers = async (tenant: SsfKeycloakProjectionTenant): Promise<void> => {
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

const requireTenant = async (
  resolveTenant: (instanceId: string) => Promise<SsfKeycloakProjectionTenant | null>,
  instanceId: string
): Promise<SsfKeycloakProjectionTenant> => {
  const tenant = await resolveTenant(instanceId);
  if (!tenant || tenant.instanceId !== instanceId) {
    throw new Error('ssf_keycloak_projection_tenant_unavailable');
  }
  return tenant;
};

export const createSsfKeycloakAuthorizationProjectionTarget = (dependencies: {
  readonly resolveTenant: (instanceId: string) => Promise<SsfKeycloakProjectionTenant | null>;
  readonly revokeSsfTenantSessions: (instanceId: string) => Promise<void>;
}): SsfAuthorizationProjectionTarget => ({
  async reconcile(projection, authorizationRevision) {
    const desired = normalizeSsfAuthorizationProjection(projection);
    if (createSsfAuthorizationRevision(desired) !== authorizationRevision) {
      throw new Error('ssf_keycloak_projection_revision_mismatch');
    }

    const tenant = await requireTenant(dependencies.resolveTenant, desired.instanceId);
    const users = await listAllUsers(tenant.client);
    const usersBySubject = new Map(users.map((user) => [user.externalId, user]));
    const desiredBySubject = new Map(desired.subjects.map((subject) => [subject.subject, subject]));

    for (const subject of desired.subjects) {
      if (!usersBySubject.has(subject.subject)) {
        throw new Error('ssf_keycloak_projection_subject_missing');
      }
    }
    await ensureClaimMappers(tenant);

    for (const user of users) {
      const currentAttributes = await tenant.client.getUserAttributes(user.externalId);
      const desiredSubject = desiredBySubject.get(user.externalId);
      const nextAttributes = withoutProjectionAttributes(currentAttributes);
      if (desiredSubject) {
        nextAttributes[SSF_TOKEN_CLAIMS.instanceId] = [desired.instanceId];
        nextAttributes[SSF_TOKEN_CLAIMS.roles] = desiredSubject.roles;
        nextAttributes[SSF_TOKEN_CLAIMS.permissions] = desiredSubject.permissions;
        nextAttributes[SSF_TOKEN_CLAIMS.authorizationRevision] = [authorizationRevision];
      }
      if (!areAttributesEqual(currentAttributes, nextAttributes)) {
        await tenant.client.updateUser(user.externalId, { attributes: nextAttributes });
      }
    }
  },

  async readBack(instanceId) {
    const tenant = await requireTenant(dependencies.resolveTenant, instanceId);
    const users = await listAllUsers(tenant.client);
    const projectedUsers = await Promise.all(
      users.map(async (user) => ({
        subject: user.externalId,
        attributes: await tenant.client.getUserAttributes(user.externalId),
      }))
    );
    const subjects = projectedUsers
      .filter(({ attributes }) => hasProjectionAttributes(attributes))
      .map(({ subject, attributes }) => {
        if (readSingleAttribute(attributes, SSF_TOKEN_CLAIMS.instanceId) !== instanceId) {
          throw new Error('ssf_keycloak_projection_foreign_instance');
        }
        return {
          subject,
          roles: [...(attributes[SSF_TOKEN_CLAIMS.roles] ?? [])],
          permissions: [...(attributes[SSF_TOKEN_CLAIMS.permissions] ?? [])],
          authorizationRevision: readSingleAttribute(
            attributes,
            SSF_TOKEN_CLAIMS.authorizationRevision
          ),
        };
      });
    const projection = normalizeSsfAuthorizationProjection(
      ssfAuthorizationProjectionSchema.parse({
        contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
        instanceId,
        subjects: subjects.map((subject) => ({
          subject: subject.subject,
          roles: subject.roles,
          permissions: subject.permissions,
        })),
      })
    );
    const revision = createSsfAuthorizationRevision(projection);
    if (subjects.some((subject) => subject.authorizationRevision !== revision)) {
      throw new Error('ssf_keycloak_projection_revision_mismatch');
    }
    return projection;
  },

  async revokeTenantSessions(instanceId) {
    await requireTenant(dependencies.resolveTenant, instanceId);
    await dependencies.revokeSsfTenantSessions(instanceId);
  },
});
