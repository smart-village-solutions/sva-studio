#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { encryptFieldValue, parseFieldEncryptionConfigFromEnv } from '../../../packages/core/dist/security/index.js';

const DEFAULT_CLIENT_IDS = ['sva-studio', 'sva-studio-admin'];

const usage = () => {
  console.error(`
Usage:
  node scripts/debug/auth/keycloak-client-secret-inventory.mjs \\
    --env-file=config/runtime/studio.local.vars \\
    --realms=bb-guben,de-musterhausen \\
    --clients=sva-studio,sva-studio-admin

Required via env or flags:
  KEYCLOAK_ADMIN_BASE_URL / --base-url
  KEYCLOAK_ADMIN_REALM / --admin-realm
  KEYCLOAK_ADMIN_CLIENT_ID / --admin-client-id
  KEYCLOAK_ADMIN_CLIENT_SECRET / --admin-client-secret
  --realms or SVA_ALLOWED_INSTANCE_IDS

Options:
  --clients=<ids>          Comma-separated clientIds. Default: ${DEFAULT_CLIENT_IDS.join(',')}
  --json                   Emit JSON instead of a table.
  --markdown               Emit markdown grouped by tenant. Requires --reveal.
  --reveal                 Print actual client secrets. Requires SVA_ALLOW_SECRET_OUTPUT=1.
  --sync-db                Encrypt fetched secrets and write them to iam.instances via remote SQL.
  --realm-instance-map=<m> Comma-separated realm:instanceId overrides for --sync-db.
  --keyring-env-file=<p>   Load only IAM_PII_* values after the normal env files.
  --load-env-file=<path>   Load KEY=VALUE lines without printing them. Can be repeated or comma-separated.
  --env-file=<path>        Backwards-compatible alias; may collide with newer Node runtimes.

Default output never prints secret values. It prints length and a short sha256 fingerprint
so another local operator can compare values without exposing the secret text.
`);
};

const parseArgs = (argv) => {
  const args = {};
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }
    if (raw === '--json') {
      args.json = true;
      continue;
    }
    if (raw === '--markdown') {
      args.markdown = true;
      continue;
    }
    if (raw === '--reveal') {
      args.reveal = true;
      continue;
    }
    if (raw === '--sync-db') {
      args['sync-db'] = true;
      continue;
    }
    const match = raw.match(/^--([^=]+)=(.*)$/u);
    if (!match) {
      throw new Error(`Unbekanntes Argument: ${raw}`);
    }
    const key = match[1];
    if (key === 'env-file' || key === 'load-env-file' || key === 'keyring-env-file') {
      args[key] = args[key] ? `${args[key]},${match[2]}` : match[2];
    } else {
      args[key] = match[2];
    }
  }
  return args;
};

const stripOptionalQuotes = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const loadEnvFile = (path, filter = () => true) => {
  if (!path) return;
  if (!existsSync(path)) {
    throw new Error(`Env-Datei nicht gefunden: ${path}`);
  }
  const content = readFileSync(path, 'utf8');
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    if (!filter(key)) continue;
    const value = stripOptionalQuotes(trimmed.slice(separatorIndex + 1));
    process.env[key] = value;
  }
};

const loadEnvFiles = (value) => {
  for (const path of readList(value)) {
    loadEnvFile(path);
  }
};

const loadKeyringEnvFiles = (value) => {
  for (const path of readList(value)) {
    loadEnvFile(path, (key) => key.startsWith('IAM_PII_'));
  }
};

const readList = (value) =>
  String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const requireValue = (value, name) => {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} fehlt.`);
  }
  return normalized;
};

const trimTrailingSlash = (value) => value.replace(/\/+$/u, '');

const encodePathSegment = (value) => encodeURIComponent(value);

const secretFingerprint = (secret) => `sha256:${createHash('sha256').update(secret).digest('hex').slice(0, 16)}`;

const protectField = (value, aad) => {
  if (!value) return null;
  const config = parseFieldEncryptionConfigFromEnv(process.env);
  if (!config) {
    throw new Error('pii_encryption_required:PII-Verschluesselung ist nicht konfiguriert.');
  }
  return encryptFieldValue(value, config, aad);
};

const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;

const parseRealmInstanceMap = (value) => {
  const map = new Map();
  for (const entry of readList(value)) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
      throw new Error(`Ungueltiger realm-instance-map Eintrag: ${entry}`);
    }
    map.set(entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1));
  }
  return map;
};

const requireSuccessfulSecretRows = (rows) => {
  const failedRows = rows.filter((row) => row.status !== 'secret_read' || !row.secret);
  if (failedRows.length > 0) {
    const summary = failedRows.map((row) => `${row.realm}/${row.clientId}:${row.status}`).join(', ');
    throw new Error(`Nicht alle Secrets konnten gelesen werden: ${summary}`);
  }
};

const buildEncryptedSecretUpdates = (rows, realmInstanceMap) => {
  const grouped = new Map();
  for (const row of rows) {
    const instanceId = realmInstanceMap.get(row.realm) ?? row.realm;
    const current = grouped.get(instanceId) ?? { instanceId, realm: row.realm };
    if (row.clientId === 'sva-studio') {
      current.authClientSecretCiphertext = protectField(row.secret, `iam.instances.auth_client_secret:${instanceId}`);
      current.authClientFingerprint = row.fingerprint;
    } else if (row.clientId === 'sva-studio-admin') {
      current.tenantAdminClientSecretCiphertext = protectField(
        row.secret,
        `iam.instances.tenant_admin_client_secret:${instanceId}`,
      );
      current.tenantAdminClientFingerprint = row.fingerprint;
    }
    grouped.set(instanceId, current);
  }

  const updates = [...grouped.values()].filter(
    (entry) => entry.authClientSecretCiphertext || entry.tenantAdminClientSecretCiphertext,
  );
  if (updates.length === 0) {
    throw new Error('Keine DB-Updates erzeugt.');
  }
  return updates;
};

const buildSyncSql = (updates) => {
  const valuesSql = updates
    .map((entry) =>
      [
        '(',
        sqlLiteral(entry.instanceId),
        ', ',
        entry.authClientSecretCiphertext ? sqlLiteral(entry.authClientSecretCiphertext) : 'NULL',
        ', ',
        entry.tenantAdminClientSecretCiphertext ? sqlLiteral(entry.tenantAdminClientSecretCiphertext) : 'NULL',
        ')',
      ].join(''),
    )
    .join(',\n');

  return `
BEGIN;

WITH secret_updates(instance_id, auth_client_secret_ciphertext, tenant_admin_client_secret_ciphertext) AS (
  VALUES
${valuesSql}
)
UPDATE iam.instances instance
SET
  auth_client_secret_ciphertext = COALESCE(secret_updates.auth_client_secret_ciphertext, instance.auth_client_secret_ciphertext),
  tenant_admin_client_secret_ciphertext = COALESCE(secret_updates.tenant_admin_client_secret_ciphertext, instance.tenant_admin_client_secret_ciphertext),
  updated_at = NOW()
FROM secret_updates
WHERE instance.id = secret_updates.instance_id
  AND instance.status = 'active';

COMMIT;
`;
};

const runRemoteSql = (sql) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'sva-keycloak-secret-sync-'));
  const sqlPath = join(tempDir, 'sync.sql');
  try {
    writeFileSync(sqlPath, sql, { encoding: 'utf8', mode: 0o600 });
    const result = spawnSync('node', ['scripts/debug/auth/quantum-remote-sql.mjs', sqlPath], {
      cwd: resolve(import.meta.dirname, '../../..'),
      env: process.env,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'Remote SQL fehlgeschlagen.').trim());
    }
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
};

const printSyncSummary = (updates) => {
  console.log('instanceId                 authSecret  tenantAdminSecret');
  console.log('-------------------------  ----------  -----------------');
  for (const update of updates) {
    console.log(
      [
        formatCell(update.instanceId, 25),
        formatCell(update.authClientSecretCiphertext ? 'updated' : 'unchanged', 10),
        formatCell(update.tenantAdminClientSecretCiphertext ? 'updated' : 'unchanged', 17),
      ].join('  '),
    );
  }
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message = typeof body === 'string' ? body.slice(0, 220) : JSON.stringify(body).slice(0, 220);
    const error = new Error(`HTTP ${response.status} ${response.statusText}: ${message}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
};

const getAdminToken = async ({ adminClientId, adminClientSecret, adminRealm, baseUrl }) => {
  const body = new URLSearchParams({
    client_id: adminClientId,
    client_secret: adminClientSecret,
    grant_type: 'client_credentials',
  });
  const token = await requestJson(
    `${baseUrl}/realms/${encodePathSegment(adminRealm)}/protocol/openid-connect/token`,
    { method: 'POST', body },
  );
  if (!token?.access_token) {
    throw new Error('Keycloak Token-Endpoint lieferte kein access_token.');
  }
  return token.access_token;
};

const getClientByClientId = async ({ baseUrl, realm, token, clientId }) => {
  const clients = await requestJson(
    `${baseUrl}/admin/realms/${encodePathSegment(realm)}/clients?clientId=${encodeURIComponent(clientId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return Array.isArray(clients) ? clients.find((client) => client.clientId === clientId) : undefined;
};

const getClientSecret = async ({ baseUrl, realm, token, clientUuid }) =>
  requestJson(
    `${baseUrl}/admin/realms/${encodePathSegment(realm)}/clients/${encodePathSegment(clientUuid)}/client-secret`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

const validateClientCredentials = async ({ baseUrl, realm, clientId, secret }) => {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    grant_type: 'client_credentials',
  });
  const response = await fetch(
    `${baseUrl}/realms/${encodePathSegment(realm)}/protocol/openid-connect/token`,
    { method: 'POST', body },
  );
  if (response.ok) {
    return { httpStatus: response.status, status: 'ok' };
  }
  const text = await response.text().catch(() => '');
  const reason = text.includes('invalid_client')
    ? 'invalid_client'
    : text.includes('unauthorized_client')
      ? 'unauthorized_client'
      : response.status === 404
        ? 'not_found'
        : `http_${response.status}`;
  return { httpStatus: response.status, reason, status: 'failed' };
};

const inspectClient = async ({ baseUrl, clientId, realm, reveal, token }) => {
  try {
    const client = await getClientByClientId({ baseUrl, realm, token, clientId });
    if (!client) {
      return { clientId, realm, status: 'missing_client' };
    }

    if (client.publicClient === true) {
      return {
        clientId,
        enabled: client.enabled === true,
        publicClient: true,
        realm,
        serviceAccountsEnabled: client.serviceAccountsEnabled === true,
        status: 'public_client_no_secret',
        uuid: client.id,
      };
    }

    const secretResponse = await getClientSecret({ baseUrl, realm, token, clientUuid: client.id });
    const secret = typeof secretResponse?.value === 'string' ? secretResponse.value : '';
    const validation = secret
      ? client.serviceAccountsEnabled === true
        ? await validateClientCredentials({ baseUrl, realm, clientId, secret })
        : { reason: 'service_account_disabled', status: 'skipped' }
      : { status: 'missing_secret' };

    return {
      clientId,
      enabled: client.enabled === true,
      fingerprint: secret ? secretFingerprint(secret) : '',
      length: secret.length,
      publicClient: false,
      realm,
      secret: reveal ? secret : undefined,
      serviceAccountsEnabled: client.serviceAccountsEnabled === true,
      status: secret ? 'secret_read' : 'missing_secret',
      tokenValidation: validation,
      uuid: client.id,
    };
  } catch (error) {
    return {
      clientId,
      error: error instanceof Error ? error.message : String(error),
      httpStatus: error?.status,
      realm,
      status: 'error',
    };
  }
};

const formatCell = (value, width) => String(value ?? '').slice(0, width).padEnd(width, ' ');

const printTable = (rows, reveal) => {
  const columns = [
    ['realm', 24],
    ['clientId', 18],
    ['status', 24],
    ['enabled', 7],
    ['svcAcct', 7],
    ['len', 5],
    ['fingerprint', 23],
    ['token', 32],
  ];
  if (reveal) columns.push(['secret', 40]);

  console.log(columns.map(([name, width]) => formatCell(name, width)).join('  '));
  console.log(columns.map(([, width]) => '-'.repeat(width)).join('  '));
  for (const row of rows) {
    const token = row.tokenValidation
      ? row.tokenValidation.status === 'ok'
        ? `ok:${row.tokenValidation.httpStatus}`
        : `${row.tokenValidation.reason ?? row.tokenValidation.status}:${row.tokenValidation.httpStatus ?? ''}`
      : '';
    const values = {
      clientId: row.clientId,
      enabled: typeof row.enabled === 'boolean' ? String(row.enabled) : '',
      fingerprint: row.fingerprint ?? '',
      len: row.length ?? '',
      realm: row.realm,
      secret: row.secret ?? '',
      status: row.status,
      svcAcct: typeof row.serviceAccountsEnabled === 'boolean' ? String(row.serviceAccountsEnabled) : '',
      token,
    };
    console.log(columns.map(([name, width]) => formatCell(values[name], width)).join('  '));
    if (row.error) {
      console.log(`  error: ${row.error}`);
    }
  }
};

const printMarkdown = (rows) => {
  const rowsByRealm = new Map();
  for (const row of rows) {
    const current = rowsByRealm.get(row.realm) ?? [];
    current.push(row);
    rowsByRealm.set(row.realm, current);
  }

  const sections = [];
  for (const [realm, realmRows] of rowsByRealm.entries()) {
    const lines = [`# ${realm}`];
    for (const row of realmRows) {
      lines.push(row.clientId);
      lines.push(row.secret ?? '');
      lines.push('');
    }
    sections.push(lines.join('\n').trimEnd());
  }

  console.log(sections.join('\n\n'));
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  loadEnvFiles(args['load-env-file'] ?? args['env-file']);
  loadKeyringEnvFiles(args['keyring-env-file']);

  const reveal = args.reveal === true;
  if (reveal && process.env.SVA_ALLOW_SECRET_OUTPUT !== '1') {
    throw new Error('--reveal verweigert: SVA_ALLOW_SECRET_OUTPUT=1 muss bewusst gesetzt sein.');
  }
  if (args.markdown && !reveal) {
    throw new Error('--markdown gibt Secret-Werte aus und erfordert deshalb zusaetzlich --reveal.');
  }
  if (args['sync-db'] && reveal) {
    throw new Error('--sync-db darf nicht mit --reveal kombiniert werden.');
  }

  const baseUrl = trimTrailingSlash(requireValue(args['base-url'] ?? process.env.KEYCLOAK_ADMIN_BASE_URL, 'KEYCLOAK_ADMIN_BASE_URL'));
  const adminRealm = requireValue(args['admin-realm'] ?? process.env.KEYCLOAK_ADMIN_REALM, 'KEYCLOAK_ADMIN_REALM');
  const adminClientId = requireValue(args['admin-client-id'] ?? process.env.KEYCLOAK_ADMIN_CLIENT_ID, 'KEYCLOAK_ADMIN_CLIENT_ID');
  const adminClientSecret = requireValue(args['admin-client-secret'] ?? process.env.KEYCLOAK_ADMIN_CLIENT_SECRET, 'KEYCLOAK_ADMIN_CLIENT_SECRET');
  const realms = readList(args.realms ?? process.env.SVA_ALLOWED_INSTANCE_IDS);
  const clientIds = readList(args.clients).length > 0 ? readList(args.clients) : DEFAULT_CLIENT_IDS;

  if (realms.length === 0) {
    throw new Error('--realms oder SVA_ALLOWED_INSTANCE_IDS muss mindestens einen Realm enthalten.');
  }

  const token = await getAdminToken({ adminClientId, adminClientSecret, adminRealm, baseUrl });
  const rows = [];
  for (const realm of realms) {
    for (const clientId of clientIds) {
      rows.push(await inspectClient({ baseUrl, clientId, realm, reveal: reveal || Boolean(args['sync-db']), token }));
    }
  }

  if (args['sync-db']) {
    requireSuccessfulSecretRows(rows);
    const updates = buildEncryptedSecretUpdates(rows, parseRealmInstanceMap(args['realm-instance-map']));
    runRemoteSql(buildSyncSql(updates));
    printSyncSummary(updates);
    return;
  }

  if (args.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (args.markdown) {
    printMarkdown(rows);
    return;
  }

  printTable(rows, reveal);
};

main().catch((error) => {
  console.error(`[keycloak-client-secret-inventory] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
