import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [, , sqlFileArg] = process.argv;

if (!sqlFileArg) {
  console.error('Usage: node scripts/debug/auth/quantum-remote-query.mjs <sql-file>');
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

const marker = '__REMOTE_QUERY__';
const remoteScript = [
  'set -euo pipefail',
  `cat <<'SQL' >/tmp/remote-query.sql`,
  sql,
  'SQL',
  `printf '%s\\n' '${marker}_START'`,
  `PGPASSWORD=${shellEscape(postgresPassword)} psql -X -P pager=off -q -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)} -At -F '|' -f /tmp/remote-query.sql`,
  `printf '%s\\n' '${marker}_END'`,
  'rm -f /tmp/remote-query.sql',
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

const startMarker = `${marker}_START`;
const endMarker = `${marker}_END`;
const startIndex = output.lastIndexOf(startMarker);
const endIndex = output.indexOf(endMarker, startIndex + startMarker.length);

if (startIndex === -1) {
  console.error(output.trim());
  process.exit(1);
}

const segment = output.slice(startIndex + startMarker.length, endIndex === -1 ? undefined : endIndex).trim();
console.log(segment);
