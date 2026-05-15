import type { CliOptions } from './parse-options.js';
import type { ShellRunner } from './docker-psql.js';
import { sqlLiteral } from './docker-psql.js';
import type { LogStep } from './logging.js';

export type KeycloakUser = {
  email?: string;
  enabled?: boolean;
  id: string;
};

type FetchLike = typeof fetch;

export const fetchKeycloakAccessToken = async (options: CliOptions, fetchImpl: FetchLike = fetch): Promise<string> => {
  const response = await fetchImpl(
    `${options.keycloakBaseUrl}/realms/${options.targetRealm}/protocol/openid-connect/token`,
    {
      body: new URLSearchParams({
        client_id: options.keycloakAdminClientId,
        client_secret: options.keycloakAdminClientSecret,
        grant_type: 'client_credentials',
      }),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    }
  );

  if (!response.ok) {
    throw new Error(`Keycloak token request failed with ${response.status}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('Keycloak token response did not contain access_token');
  }

  return payload.access_token;
};

export const fetchKeycloakUsers = async (
  options: CliOptions,
  logStep: LogStep,
  fetchImpl: FetchLike = fetch
): Promise<KeycloakUser[]> => {
  logStep(`Lese aktive Keycloak-User aus Realm ${options.targetRealm}`);
  const accessToken = await fetchKeycloakAccessToken(options, fetchImpl);
  const users: KeycloakUser[] = [];

  for (let first = 0; ; first += options.pageSize) {
    const url = new URL(`${options.keycloakBaseUrl}/admin/realms/${options.targetRealm}/users`);
    url.searchParams.set('first', String(first));
    url.searchParams.set('max', String(options.pageSize));

    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Keycloak user sync failed with ${response.status} for page starting at ${first}`);
    }

    const page = (await response.json()) as KeycloakUser[];
    users.push(...page);

    if (page.length < options.pageSize) {
      break;
    }
  }

  const seen = new Set<string>();
  return users.filter((user) => {
    if (!user?.id || user.enabled === false || seen.has(user.id)) {
      return false;
    }

    seen.add(user.id);
    return true;
  });
};

export const syncKeycloakUsers = async (
  options: CliOptions,
  deps: {
    readonly fetchImpl?: FetchLike;
    readonly logStep: LogStep;
    readonly run: ShellRunner;
  }
): Promise<void> => {
  const users = await fetchKeycloakUsers(options, deps.logStep, deps.fetchImpl);
  deps.logStep(`Provisioniere ${users.length} Keycloak-Subjects nach ${options.targetInstanceId}`);

  let sql = 'BEGIN;\n';
  for (const user of users) {
    const subject = sqlLiteral(user.id);
    sql += `INSERT INTO iam.accounts (instance_id, keycloak_subject, status)\n`;
    sql += `VALUES (${sqlLiteral(options.targetInstanceId)}, ${subject}, 'active')\n`;
    sql += `ON CONFLICT (keycloak_subject, instance_id) WHERE instance_id IS NOT NULL DO UPDATE\n`;
    sql += `SET status = 'active', updated_at = NOW();\n`;
    sql += `INSERT INTO iam.instance_memberships (instance_id, account_id, membership_type)\n`;
    sql += `SELECT ${sqlLiteral(options.targetInstanceId)}, id, 'member'\n`;
    sql += `FROM iam.accounts\n`;
    sql += `WHERE keycloak_subject = ${subject} AND instance_id = ${sqlLiteral(options.targetInstanceId)}\n`;
    sql += `ON CONFLICT (instance_id, account_id) DO NOTHING;\n`;
  }
  sql += 'COMMIT;\n';

  deps.run(
    'docker',
    [
      'exec',
      '-i',
      options.targetDbContainer,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      options.targetDbUser,
      '-d',
      options.targetDbName,
    ],
    sql
  );
};
