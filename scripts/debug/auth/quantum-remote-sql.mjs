import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [, , sqlFileArg] = process.argv;

if (!sqlFileArg) {
  console.error('Usage: node scripts/debug/auth/quantum-remote-sql.mjs <sql-file>');
  process.exit(2);
}

const sqlPath = resolve(process.cwd(), sqlFileArg);
const sql = readFileSync(sqlPath, 'utf8');

const apiKey = process.env.QUANTUM_API_KEY;
const endpoint = process.env.QUANTUM_ENDPOINT ?? 'sva';
const stack = process.env.QUANTUM_STACK ?? 'hb-meinquartier-studio-sva';
const service = process.env.QUANTUM_SERVICE ?? 'postgres';
const slot = process.env.QUANTUM_SLOT ?? '1';
const postgresUser = process.env.QUANTUM_POSTGRES_USER ?? 'sva';
const postgresDb = process.env.QUANTUM_POSTGRES_DB ?? 'sva_studio';
const postgresPassword = process.env.QUANTUM_POSTGRES_PASSWORD;

if (!apiKey) {
  console.error('QUANTUM_API_KEY fehlt.');
  process.exit(2);
}

if (!postgresPassword) {
  console.error('QUANTUM_POSTGRES_PASSWORD fehlt.');
  process.exit(2);
}

const shellEscape = (value) => {
  if (/^[A-Za-z0-9_./:=,@+-]+$/u.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
};

const marker = '__REMOTE_SQL__';
const remoteScript = [
  'set -euo pipefail',
  `cat <<'SQL' >/tmp/remote-sql.sql`,
  sql,
  'SQL',
  `if ! PGPASSWORD=${shellEscape(postgresPassword)} psql -X -P pager=off -q -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)} -f /tmp/remote-sql.sql >/tmp/remote-sql.log 2>&1; then`,
  '  cat /tmp/remote-sql.log',
  '  exit 1',
  'fi',
  `printf '%s\\n' '${marker}_START'`,
  `printf '%s\\n' 'ok'`,
  `printf '%s\\n' '${marker}_END'`,
  'rm -f /tmp/remote-sql.sql /tmp/remote-sql.log',
  'sleep 1',
].join('\n');

const result = spawnSync(
  'quantum-cli',
  [
    'exec',
    '--endpoint',
    endpoint,
    '--stack',
    stack,
    '--service',
    service,
    '--slot',
    slot,
    '-c',
    `sh -lc ${shellEscape(remoteScript)}`,
  ],
  {
    cwd: process.cwd(),
    env: { ...process.env, QUANTUM_API_KEY: apiKey },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  },
);

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

if (result.status !== 0) {
  console.error(output.trim());
  process.exit(result.status ?? 1);
}

console.log('ok');
