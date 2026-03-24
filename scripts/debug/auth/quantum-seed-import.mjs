import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [, , seedArg] = process.argv;

if (!seedArg) {
  console.error('Usage: node scripts/debug/auth/quantum-seed-import.mjs <seed-file>');
  process.exit(2);
}

const seedPath = resolve(process.cwd(), seedArg);
const seed = readFileSync(seedPath, 'utf8');

const apiKey = process.env.QUANTUM_API_KEY;
const endpoint = process.env.QUANTUM_ENDPOINT ?? 'sva';
const stack = process.env.QUANTUM_STACK ?? 'hb-meinquartier-studio-sva';
const service = process.env.QUANTUM_SERVICE ?? 'postgres';
const slot = process.env.QUANTUM_SLOT ?? '1';
const postgresUser = process.env.QUANTUM_POSTGRES_USER ?? 'sva';
const postgresDb = process.env.QUANTUM_POSTGRES_DB ?? 'sva_studio';
const postgresPassword = process.env.QUANTUM_POSTGRES_PASSWORD;
const remotePath = process.env.QUANTUM_REMOTE_PATH ?? '/tmp/hb-local-seed.sql';

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

const stripControlArtifacts = (value) => value.replaceAll('\u0000', '');

const stripAnsiArtifacts = (value) => {
  const escapeChar = String.fromCharCode(27);
  return value.replace(new RegExp(`${escapeChar}\\[[0-9;?]*[ -/]*[@-~]`, 'gu'), '');
};

const stripCaretControlArtifacts = (value) => value.replaceAll('^@', '');

const sanitizeProcessOutput = (value) =>
  stripCaretControlArtifacts(stripAnsiArtifacts(stripControlArtifacts(value)));

const filterRemoteOutputLines = (value) =>
  sanitizeProcessOutput(value)
    .replace(/\ntime=.*level=/gu, '\ntime=')
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => !/^time=.*level=/u.test(entry))
    .filter((entry) => entry !== 'standard input')
    .filter((entry) => !/^~+$/u.test(entry));

const summarizeProcessOutput = (value, maxLines = 60) => filterRemoteOutputLines(value).slice(-maxLines).join('\n');

const parseMarkedOutput = (output, marker) => {
  const cleaned = sanitizeProcessOutput(output);
  const startMarker = `${marker}_START`;
  const endMarker = `${marker}_END`;
  const startIndex = cleaned.lastIndexOf(startMarker);
  const endIndex = startIndex === -1 ? -1 : cleaned.indexOf(endMarker, startIndex + startMarker.length);

  if (startIndex === -1) {
    throw new Error(`Markierte Ausgabe ${marker} nicht gefunden.`);
  }

  const segment = cleaned.slice(startIndex + startMarker.length, endIndex === -1 ? undefined : endIndex);
  const lines = filterRemoteOutputLines(segment.replace(/^n+/u, '').trimStart()).filter(
    (entry) => entry !== startMarker && entry !== endMarker,
  );

  if (lines.length > 0) {
    return lines.join('\n');
  }

  const boolMatrixMatches = Array.from(segment.matchAll(/(?:t|f)(?:\|(?:t|f)){3,}/gu)).map((match) => match[0]);
  if (boolMatrixMatches.length > 0) {
    return boolMatrixMatches.at(-1) ?? boolMatrixMatches[0];
  }

  const statusMatches = Array.from(segment.matchAll(/\b(?:ok|applied:[^\s]+)\b/gu)).map((match) => match[0]);
  if (statusMatches.length > 0) {
    return statusMatches.join('\n');
  }

  throw new Error(`Markierte Ausgabe ${marker} enthaelt keine auswertbaren Daten.`);
};

const runQuantumExec = (remoteScript, marker, failureMessage) => {
  const args = [
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
  ];

  const result = spawnSync('quantum-cli', args, {
    cwd: process.cwd(),
    env: { ...process.env, QUANTUM_API_KEY: apiKey },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

  if (result.status !== 0) {
    throw new Error(`${failureMessage}\n${summarizeProcessOutput(combined)}`);
  }

  if (!marker) {
    return summarizeProcessOutput(combined);
  }

  return parseMarkedOutput(combined, marker);
};

const writeRemoteFile = () => {
  runQuantumExec(
    [
      'set -euo pipefail',
      `: > ${remotePath}`,
      `printf '%s\\n' '__SEED_INIT___START'`,
      `printf '%s\\n' 'ok'`,
      `printf '%s\\n' '__SEED_INIT___END'`,
      'sleep 1',
    ].join('\n'),
    '__SEED_INIT__',
    'Remote-Datei konnte nicht initialisiert werden.',
  );

  const encodedSeed = Buffer.from(seed, 'utf8').toString('base64');
  const maxChunkBytes = 12000;
  const chunks = [];
  let currentChunk = '';

  for (const char of encodedSeed) {
    if (currentChunk.length > 0 && currentChunk.length + 1 > maxChunkBytes) {
      chunks.push(currentChunk);
      currentChunk = char;
      continue;
    }

    currentChunk += char;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  let uploaded = 0;

  for (const chunk of chunks) {
    const marker = `__SEED_CHUNK_${uploaded}__`;
    runQuantumExec(
      [
        'set -euo pipefail',
        `printf '%s' ${shellEscape(chunk)} | base64 -d >> ${remotePath}`,
        `printf '%s\\n' '${marker}_START'`,
        `printf '%s\\n' 'ok'`,
        `printf '%s\\n' '${marker}_END'`,
        'sleep 1',
      ].join('\n'),
      marker,
      `Chunk ${uploaded + 1} konnte nicht hochgeladen werden.`,
    );
    uploaded += 1;
    if (uploaded % 10 === 0 || uploaded === chunks.length) {
      console.log(`uploaded ${uploaded}`);
    }
  }

  const sizeMarker = '__SEED_SIZE__';
  const size = runQuantumExec(
    [
      'set -euo pipefail',
      `printf '%s\\n' '${sizeMarker}_START'`,
      `wc -c < ${remotePath}`,
      `printf '%s\\n' '${sizeMarker}_END'`,
      'sleep 1',
    ].join('\n'),
    sizeMarker,
    'Remote-Dateigroesse konnte nicht gelesen werden.',
  );

  console.log(`remote-bytes ${size}`);
};

const truncateTargetTables = () => {
  const truncateSql = `TRUNCATE TABLE
  iam.content_history,
  iam.contents,
  iam.legal_text_acceptances,
  iam.legal_text_versions,
  iam.geo_hierarchy,
  iam.geo_units,
  iam.geo_nodes,
  iam.account_groups,
  iam.group_roles,
  iam.groups,
  iam.account_roles,
  iam.role_permissions,
  iam.permissions,
  iam.roles,
  iam.account_organizations,
  iam.organizations,
  iam.instance_integrations,
  iam.instance_memberships,
  iam.accounts,
  iam.instances
RESTART IDENTITY CASCADE;`;

  runQuantumExec(
    [
      'set -euo pipefail',
      `cat <<'SQL' >/tmp/hb-seed-truncate.sql`,
      truncateSql,
      'SQL',
      `PGPASSWORD=${shellEscape(postgresPassword)} psql -X -P pager=off -q -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)} -f /tmp/hb-seed-truncate.sql`,
      'rm -f /tmp/hb-seed-truncate.sql',
      `printf '%s\\n' '__SEED_TRUNCATE___START'`,
      `printf '%s\\n' 'ok'`,
      `printf '%s\\n' '__SEED_TRUNCATE___END'`,
      'sleep 1',
    ].join('\n'),
    '__SEED_TRUNCATE__',
    'TRUNCATE der Seed-Tabellen fehlgeschlagen.',
  );
};

const importSeed = () => {
  const importMarker = '__SEED_IMPORT__';
  const importResult = runQuantumExec(
    [
      'set -euo pipefail',
      `if ! PGPASSWORD=${shellEscape(postgresPassword)} psql -X -P pager=off -q -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)} -f ${remotePath} >/tmp/hb-seed-import.log 2>&1; then`,
      '  cat /tmp/hb-seed-import.log',
      '  exit 1',
      'fi',
      `printf '%s\\n' '${importMarker}_START'`,
      `printf '%s\\n' 'ok'`,
      `printf '%s\\n' '${importMarker}_END'`,
      `rm -f ${remotePath} /tmp/hb-seed-import.log`,
      'sleep 1',
    ].join('\n'),
    importMarker,
    'Seed-Import fehlgeschlagen.',
  );

  console.log(`import ${importResult}`);
};

const verifyImport = () => {
  const verifyMarker = '__SEED_VERIFY__';
  const verifySql = `select (select count(*) from iam.instances) as instances,
       (select count(*) from iam.accounts) as accounts,
       (select count(*) from iam.instance_memberships) as memberships,
       (select count(*) from iam.roles) as roles,
       (select count(*) from iam.permissions) as permissions;`;

  const result = runQuantumExec(
    [
      'set -euo pipefail',
      `cat <<'SQL' >/tmp/hb-seed-verify.sql`,
      verifySql,
      'SQL',
      `printf '%s\\n' '${verifyMarker}_START'`,
      `PGPASSWORD=${shellEscape(postgresPassword)} psql -X -P pager=off -q -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(postgresDb)} -At -f /tmp/hb-seed-verify.sql`,
      `printf '%s\\n' '${verifyMarker}_END'`,
      'rm -f /tmp/hb-seed-verify.sql',
      'sleep 1',
    ].join('\n'),
    verifyMarker,
    'Verifikation des Seed-Imports fehlgeschlagen.',
  );

  console.log(`verify ${result}`);
};

writeRemoteFile();
truncateTargetTables();
importSeed();
verifyImport();
