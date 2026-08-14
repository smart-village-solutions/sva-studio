import type { IdentityListedUser } from '../../packages/auth-runtime/src/identity-provider-port.ts';
import type { KeycloakAdminClient } from '../../packages/auth-runtime/src/keycloak-admin-client/core.ts';
import type { AcceptanceConfig } from './iam-acceptance.ts';
import {
  cleanupAcceptanceAccounts,
  cleanupAcceptanceOrganizations,
} from './iam-acceptance-runner-database.ts';
import type { AcceptanceRecorder, Pool } from './iam-acceptance-runner-runtime.ts';

type HealthReadyPayload = {
  checks?: { db?: boolean; keycloak?: boolean; redis?: boolean };
  path?: string;
  requestId?: string;
  status?: string;
};

const READINESS_TIMEOUT_MS = 45_000;

const resolveKeycloakUser = async (
  recorder: AcceptanceRecorder,
  client: KeycloakAdminClient,
  username: string,
  name: string
): Promise<IdentityListedUser> => {
  const matches = (await client.listUsers({ username })).filter(
    (entry) => entry.username === username
  );
  if (matches.length === 0) {
    recorder.failStep({
      name: `Preflight ${name}`,
      failureCode: 'acceptance_keycloak_user_missing',
      details: `Keycloak-Testnutzer "${username}" wurde nicht gefunden.`,
    });
  }
  if (matches.length > 1) {
    recorder.failStep({
      name: `Preflight ${name}`,
      failureCode: 'acceptance_keycloak_user_not_unique',
      details: `Keycloak-Testnutzer "${username}" ist nicht eindeutig.`,
      metadata: { matches: matches.map((entry) => entry.externalId) },
    });
  }
  return matches[0] as IdentityListedUser;
};

export const runIdentityPreflight = async (
  recorder: AcceptanceRecorder,
  keycloakAdmin: KeycloakAdminClient,
  config: AcceptanceConfig
): Promise<{ adminIdentity: IdentityListedUser; memberIdentity: IdentityListedUser }> => {
  const adminIdentity = await resolveKeycloakUser(
    recorder,
    keycloakAdmin,
    config.admin.username,
    'Admin-Testnutzer'
  );
  const memberIdentity = await resolveKeycloakUser(
    recorder,
    keycloakAdmin,
    config.member.username,
    'Member-Testnutzer'
  );
  const adminRoleNames = await keycloakAdmin.listUserRoleNames(adminIdentity.externalId);
  for (const expectedRole of config.admin.expectedRoles) {
    if (!adminRoleNames.includes(expectedRole) && expectedRole !== 'system_admin') {
      recorder.failStep({
        name: 'Preflight Admin-Testnutzer',
        failureCode: 'acceptance_expected_role_missing',
        details: `Der Keycloak-Testnutzer "${config.admin.username}" besitzt die Rolle "${expectedRole}" nicht.`,
        metadata: { roles: adminRoleNames },
      });
    }
  }
  recorder.recordStep({
    name: 'Preflight Testnutzer',
    status: 'passed',
    details: 'Keycloak-Testnutzer und Rollenvertrag wurden geprüft.',
    metadata: { adminSubject: adminIdentity.externalId, memberSubject: memberIdentity.externalId },
  });
  return { adminIdentity, memberIdentity };
};

const fetchReadiness = async (
  recorder: AcceptanceRecorder,
  url: string
): Promise<{ payload: HealthReadyPayload; response: Response }> => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), READINESS_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = (await response.json()) as HealthReadyPayload;
    return { payload, response };
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';
    recorder.failStep({
      name: 'Readiness',
      failureCode: 'acceptance_http_request_failed',
      details: isTimeout
        ? `HTTP-Anfrage auf ${url} hat das Timeout von ${READINESS_TIMEOUT_MS} ms überschritten.`
        : error instanceof Error
          ? error.message
          : String(error),
      metadata: isTimeout ? { timeoutMs: READINESS_TIMEOUT_MS, url } : { url },
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
};

export const resetAcceptanceTestData = async (
  recorder: AcceptanceRecorder,
  input: {
    adminIdentity: IdentityListedUser;
    config: AcceptanceConfig;
    memberIdentity: IdentityListedUser;
    pool: Pool;
  }
): Promise<void> => {
  await cleanupAcceptanceOrganizations(input.pool, {
    instanceId: input.config.instanceId,
    organizationKeyPrefix: input.config.organizationKeyPrefix,
  });
  await cleanupAcceptanceAccounts(recorder, input.pool, {
    instanceId: input.config.instanceId,
    keycloakSubjects: [input.adminIdentity.externalId, input.memberIdentity.externalId],
  });
  recorder.recordStep({
    name: 'Testdaten-Reset',
    status: 'passed',
    details: 'Acceptance-Accounts und Acceptance-Organisationen wurden zurückgesetzt.',
  });
};

export const verifyReadiness = async (
  recorder: AcceptanceRecorder,
  config: AcceptanceConfig
): Promise<void> => {
  const readinessUrl = new URL('/health/ready', config.baseUrl).toString();
  const { payload, response } = await fetchReadiness(recorder, readinessUrl);
  if (
    response.status !== 200 ||
    payload.status !== 'ready' ||
    !payload.checks?.db ||
    !payload.checks?.redis ||
    !payload.checks?.keycloak
  ) {
    recorder.failStep({
      name: 'Readiness',
      failureCode: 'acceptance_dependency_not_ready',
      details: 'Das Readiness-Gate meldet nicht alle Dependencies als bereit.',
      metadata: payload,
    });
  }
  recorder.recordStep({
    name: 'Readiness',
    status: 'passed',
    details: 'DB, Redis und Keycloak melden `ready`.',
    metadata: payload,
  });
};
