import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { encryptFieldValue, parseFieldEncryptionConfigFromEnv } from '@sva/core/security';
import { readList } from './keycloak-client-secret-inventory.args.mjs';

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
    const summary = failedRows
      .map((row) => `${row.realm}/${row.clientId}:${row.status}`)
      .join(', ');
    throw new Error(`Nicht alle Secrets konnten gelesen werden: ${summary}`);
  }
};

const buildEncryptedSecretUpdates = (rows, realmInstanceMap) => {
  const grouped = new Map();
  for (const row of rows) {
    const instanceId = realmInstanceMap.get(row.realm) ?? row.realm;
    const current = grouped.get(instanceId) ?? { instanceId, realm: row.realm };
    if (row.clientId === 'sva-studio') {
      current.authClientSecretCiphertext = protectField(
        row.secret,
        `iam.instances.auth_client_secret:${instanceId}`
      );
      current.authClientFingerprint = row.fingerprint;
    } else if (row.clientId === 'sva-studio-admin') {
      current.tenantAdminClientSecretCiphertext = protectField(
        row.secret,
        `iam.instances.tenant_admin_client_secret:${instanceId}`
      );
      current.tenantAdminClientFingerprint = row.fingerprint;
    }
    grouped.set(instanceId, current);
  }

  const updates = [...grouped.values()].filter(
    (entry) => entry.authClientSecretCiphertext || entry.tenantAdminClientSecretCiphertext
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
        entry.tenantAdminClientSecretCiphertext
          ? sqlLiteral(entry.tenantAdminClientSecretCiphertext)
          : 'NULL',
        ')',
      ].join('')
    )
    .join(',\n');

  return `
WITH secret_updates(instance_id, auth_client_secret_ciphertext, tenant_admin_client_secret_ciphertext) AS (
  VALUES
${valuesSql}
),
updated_rows AS (
  UPDATE iam.instances instance
  SET
    auth_client_secret_ciphertext = COALESCE(secret_updates.auth_client_secret_ciphertext, instance.auth_client_secret_ciphertext),
    tenant_admin_client_secret_ciphertext = COALESCE(secret_updates.tenant_admin_client_secret_ciphertext, instance.tenant_admin_client_secret_ciphertext),
    updated_at = NOW()
  FROM secret_updates
  WHERE instance.id = secret_updates.instance_id
    AND instance.status = 'active'
  RETURNING
    instance.id AS instance_id,
    (secret_updates.auth_client_secret_ciphertext IS NOT NULL) AS auth_secret_updated,
    (secret_updates.tenant_admin_client_secret_ciphertext IS NOT NULL) AS tenant_admin_secret_updated
)
SELECT
  secret_updates.instance_id,
  (updated_rows.instance_id IS NOT NULL) AS row_updated,
  COALESCE(updated_rows.auth_secret_updated, FALSE) AS auth_secret_updated,
  COALESCE(updated_rows.tenant_admin_secret_updated, FALSE) AS tenant_admin_secret_updated
FROM secret_updates
LEFT JOIN updated_rows ON updated_rows.instance_id = secret_updates.instance_id
ORDER BY secret_updates.instance_id;
`;
};

const runRemoteSql = (sql) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'sva-keycloak-secret-sync-'));
  const sqlPath = join(tempDir, 'sync.sql');
  try {
    writeFileSync(sqlPath, sql, { encoding: 'utf8', mode: 0o600 });
    const result = spawnSync('node', ['scripts/debug/auth/quantum-remote-query.mjs', sqlPath], {
      cwd: resolve(import.meta.dirname, '../../..'),
      env: process.env,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'Remote SQL fehlgeschlagen.').trim());
    }
    return (result.stdout ?? '').trim();
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
};

const parseSyncSummary = (rawOutput) =>
  rawOutput
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [instanceId, rowUpdated, authSecretUpdated, tenantAdminSecretUpdated] = line.split('|');
      return {
        authSecretUpdated: authSecretUpdated === 't',
        instanceId,
        rowUpdated: rowUpdated === 't',
        tenantAdminSecretUpdated: tenantAdminSecretUpdated === 't',
      };
    });

export const syncClientSecrets = (rows, realmInstanceMap) => {
  requireSuccessfulSecretRows(rows);
  const updates = buildEncryptedSecretUpdates(rows, parseRealmInstanceMap(realmInstanceMap));
  return parseSyncSummary(runRemoteSql(buildSyncSql(updates)));
};
