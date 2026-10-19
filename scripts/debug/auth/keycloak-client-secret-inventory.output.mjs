import { DEFAULT_CLIENT_IDS } from './keycloak-client-secret-inventory.args.mjs';

export const usage = () => {
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

const formatCell = (value, width) =>
  String(value ?? '')
    .slice(0, width)
    .padEnd(width, ' ');

const formatTokenValidation = (validation) => {
  if (!validation) return '';
  if (validation.status === 'ok') return `ok:${validation.httpStatus}`;
  return `${validation.reason ?? validation.status}:${validation.httpStatus ?? ''}`;
};

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
    const token = formatTokenValidation(row.tokenValidation);
    const values = {
      clientId: row.clientId,
      enabled: typeof row.enabled === 'boolean' ? String(row.enabled) : '',
      fingerprint: row.fingerprint ?? '',
      len: row.length ?? '',
      realm: row.realm,
      secret: row.secret ?? '',
      status: row.status,
      svcAcct:
        typeof row.serviceAccountsEnabled === 'boolean' ? String(row.serviceAccountsEnabled) : '',
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

export const printSyncSummary = (updates) => {
  console.log('instanceId                 rowStatus   authSecret  tenantAdminSecret');
  console.log('-------------------------  ----------  ----------  -----------------');
  for (const update of updates) {
    console.log(
      [
        formatCell(update.instanceId, 25),
        formatCell(update.rowUpdated ? 'updated' : 'not_found', 10),
        formatCell(update.authSecretUpdated ? 'updated' : 'unchanged', 10),
        formatCell(update.tenantAdminSecretUpdated ? 'updated' : 'unchanged', 17),
      ].join('  ')
    );
  }
};

export const printInventory = (rows, args, reveal) => {
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
