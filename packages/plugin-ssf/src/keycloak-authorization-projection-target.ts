import {
  createSsfAuthorizationRevision,
  normalizeSsfAuthorizationProjection,
  SSF_AUTHORIZATION_PROJECTION_VERSION,
  SSF_TOKEN_CLAIMS,
  ssfAuthorizationProjectionSchema,
  type SsfAuthorizationProjection,
} from './authorization-projection.js';
import type {
  ProjectedSubject,
  SsfKeycloakProjectionTargetDependencies,
} from './keycloak-authorization-projection-contract.js';
import {
  areAttributesEqual,
  ensureClaimMappers,
  hasProjectionAttributes,
  listAllUsers,
  readSingleAttribute,
  requireTenant,
  resolveSessionRevocationTimeoutMs,
  withSessionRevocationTimeout,
  withoutProjectionAttributes,
} from './keycloak-authorization-projection-support.js';
import type { SsfAuthorizationProjectionTarget } from './authorization-projection-reconciler.js';
import {
  createConfiguredSsfSessionRevocationClient,
  readSsfControlPlaneClientConfig,
} from './session-revocation-client.js';

export type {
  SsfKeycloakProjectionClient,
  SsfKeycloakProjectionTenant,
} from './keycloak-authorization-projection-contract.js';

const suspendTokenIssuance = async (
  dependencies: SsfKeycloakProjectionTargetDependencies,
  instanceId: string
): Promise<void> => {
  const tenant = await requireTenant(dependencies.resolveTenant, instanceId);
  await tenant.client.setOidcClientEnabled(tenant.clientId, false);
};

const reconcileProjection = async (
  dependencies: SsfKeycloakProjectionTargetDependencies,
  projection: SsfAuthorizationProjection,
  authorizationRevision: string
): Promise<void> => {
  const desired = normalizeSsfAuthorizationProjection(projection);
  if (createSsfAuthorizationRevision(desired) !== authorizationRevision) {
    throw new Error('ssf_keycloak_projection_revision_mismatch');
  }

  const tenant = await requireTenant(dependencies.resolveTenant, desired.instanceId);
  const users = await listAllUsers(tenant.client);
  const usersBySubject = new Map(users.map((user) => [user.externalId, user]));
  const desiredBySubject = new Map(desired.subjects.map((subject) => [subject.subject, subject]));
  if (desired.subjects.some((subject) => !usersBySubject.has(subject.subject))) {
    throw new Error('ssf_keycloak_projection_subject_missing');
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
};

const readProjectedSubjects = async (
  dependencies: SsfKeycloakProjectionTargetDependencies,
  instanceId: string
): Promise<readonly ProjectedSubject[]> => {
  const tenant = await requireTenant(dependencies.resolveTenant, instanceId);
  const users = await listAllUsers(tenant.client);
  const projectedUsers = await Promise.all(
    users.map(async (user) => ({
      subject: user.externalId,
      attributes: await tenant.client.getUserAttributes(user.externalId),
    }))
  );
  return projectedUsers
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
};

const readBackProjection = async (
  dependencies: SsfKeycloakProjectionTargetDependencies,
  instanceId: string
): Promise<SsfAuthorizationProjection> => {
  const subjects = await readProjectedSubjects(dependencies, instanceId);
  const projection = normalizeSsfAuthorizationProjection(
    ssfAuthorizationProjectionSchema.parse({
      contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
      instanceId,
      subjects: subjects.map(({ subject, roles, permissions }) => ({
        subject,
        roles,
        permissions,
      })),
    })
  );
  const revision = createSsfAuthorizationRevision(projection);
  if (subjects.some((subject) => subject.authorizationRevision !== revision)) {
    throw new Error('ssf_keycloak_projection_revision_mismatch');
  }
  return projection;
};

const revokeTenantSessions = async (
  dependencies: SsfKeycloakProjectionTargetDependencies,
  instanceId: string,
  authorizationRevision: string
): Promise<void> => {
  const timeoutMs = resolveSessionRevocationTimeoutMs(dependencies.sessionRevocationTimeoutMs);
  await requireTenant(dependencies.resolveTenant, instanceId);
  await withSessionRevocationTimeout(
    (signal) => dependencies.revokeSsfTenantSessions(instanceId, authorizationRevision, signal),
    timeoutMs
  );
};

const resumeTokenIssuance = async (
  dependencies: SsfKeycloakProjectionTargetDependencies,
  instanceId: string
): Promise<void> => {
  const tenant = await requireTenant(dependencies.resolveTenant, instanceId);
  await tenant.client.setOidcClientEnabled(tenant.clientId, true);
};

export const createSsfKeycloakAuthorizationProjectionTarget = (
  dependencies: SsfKeycloakProjectionTargetDependencies
): SsfAuthorizationProjectionTarget => ({
  suspendTokenIssuance: (instanceId) => suspendTokenIssuance(dependencies, instanceId),
  reconcile: (projection, revision) => reconcileProjection(dependencies, projection, revision),
  readBack: (instanceId) => readBackProjection(dependencies, instanceId),
  revokeTenantSessions: (instanceId, revision) =>
    revokeTenantSessions(dependencies, instanceId, revision),
  resumeTokenIssuance: (instanceId) => resumeTokenIssuance(dependencies, instanceId),
});

export const createConfiguredSsfKeycloakAuthorizationProjectionTarget = (dependencies: {
  readonly resolveTenant: SsfKeycloakProjectionTargetDependencies['resolveTenant'];
  readonly environment?: NodeJS.ProcessEnv;
  readonly fetchImpl?: typeof fetch;
  readonly sessionRevocationTimeoutMs?: number;
}): SsfAuthorizationProjectionTarget => {
  const config = readSsfControlPlaneClientConfig(dependencies.environment ?? process.env);
  if (!config) throw new Error('ssf_control_plane_configuration_missing');
  const revocationClient = createConfiguredSsfSessionRevocationClient(
    config,
    dependencies.fetchImpl ?? fetch
  );

  return createSsfKeycloakAuthorizationProjectionTarget({
    resolveTenant: dependencies.resolveTenant,
    revokeSsfTenantSessions: (instanceId, authorizationRevision, signal) =>
      revocationClient.revoke({ instanceId, authorizationRevision, signal }),
    ...(dependencies.sessionRevocationTimeoutMs === undefined
      ? {}
      : { sessionRevocationTimeoutMs: dependencies.sessionRevocationTimeoutMs }),
  });
};
