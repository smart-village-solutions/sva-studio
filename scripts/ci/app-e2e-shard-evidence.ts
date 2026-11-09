import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const shaPattern = /^[0-9a-f]{40}$/u;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value: object, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const appE2EShardCount = 4;

type AppE2EShardEvidence = Readonly<{
  schemaVersion: 1;
  shard: number;
  headSha: string;
  runId: string;
  expectedTestIds: string[];
  executedTestIds: string[];
  manifestHash: string;
  testOutcome: string;
}>;

const collectSpecTestIds = (spec: unknown, executed: boolean, allowRetry: boolean): string[] => {
  if (!isRecord(spec) || typeof spec.id !== 'string' || !Array.isArray(spec.tests))
    throw new Error('Ungültiger E2E-Test.');
  const ids: string[] = [];
  for (const test of spec.tests) {
    if (
      !isRecord(test) ||
      typeof test.projectName !== 'string' ||
      typeof test.expectedStatus !== 'string'
    )
      throw new Error('E2E-Projekt fehlt.');
    if (
      !['passed', 'failed', 'skipped'].includes(test.expectedStatus) ||
      (test.projectName === 'auth-setup' && test.expectedStatus !== 'passed')
    )
      throw new Error('Ungültiger erwarteter E2E-Teststatus.');
    if (executed) {
      const results = Array.isArray(test.results) ? test.results : [];
      const lastResult = results.at(-1);
      if (
        (!allowRetry && results.length !== 1) ||
        !isRecord(lastResult) ||
        lastResult.status !== test.expectedStatus
      )
        throw new Error('E2E-Test wurde nicht erwartungsgemäß abgeschlossen.');
    }
    if (test.projectName !== 'chromium' && test.projectName !== 'auth-setup')
      throw new Error('Unerwartetes E2E-Projekt.');
    // Runtime test.skip() changes expectedStatus after discovery, including in
    // existing hotfix sources. Validate outcomes above, independently of identity.
    ids.push(`${test.projectName}:${spec.id}`);
  }
  return ids;
};

const collectPlaywrightTestIds = (
  report: unknown,
  executed: boolean,
  allowRetry = false
): string[] => {
  if (!isRecord(report) || !Array.isArray(report.suites)) throw new Error('E2E-Report fehlt.');
  if (executed && Array.isArray(report.errors) && report.errors.length > 0)
    throw new Error('E2E-Report enthält unbehandelte Fehler.');
  const ids: string[] = [];
  const visit = (suite: unknown): void => {
    if (!isRecord(suite)) throw new Error('Ungültige E2E-Suite.');
    for (const nested of Array.isArray(suite.suites) ? suite.suites : []) visit(nested);
    for (const spec of Array.isArray(suite.specs) ? suite.specs : [])
      ids.push(...collectSpecTestIds(spec, executed, allowRetry));
  };
  report.suites.forEach(visit);
  if (new Set(ids).size !== ids.length) throw new Error('E2E-Test ist doppelt vorhanden.');
  return ids.sort();
};

export const writeAppE2EShardEvidenceFromEnvironment = (
  env: NodeJS.ProcessEnv = process.env
): string => {
  const shard = Number(env.APP_E2E_SHARD_INDEX);
  const headSha = env.APP_E2E_SOURCE_SHA ?? '';
  if (
    !Number.isInteger(shard) ||
    shard < 1 ||
    shard > appE2EShardCount ||
    !shaPattern.test(headSha)
  ) {
    throw new Error('Ungültige E2E-Shard-Quelle.');
  }
  const readReport = (reportPath: string | undefined): unknown => {
    if (!reportPath) throw new Error('E2E-Reportpfad fehlt.');
    return JSON.parse(readFileSync(reportPath, 'utf8')) as unknown;
  };
  const expectedTestIds = collectPlaywrightTestIds(readReport(env.APP_E2E_MANIFEST_PATH), false);
  const executedTestIds = collectPlaywrightTestIds(
    readReport(env.APP_E2E_REPORT_PATH),
    true,
    env.APP_E2E_ALLOW_RETRY === 'true'
  );
  const runId = env.GITHUB_RUN_ID ?? '';
  if (!/^\d+$/u.test(runId) || !expectedTestIds.some((id) => id.startsWith('chromium:')))
    throw new Error('E2E-Lauf ist ungültig.');
  const evidence: AppE2EShardEvidence = {
    schemaVersion: 1,
    shard,
    headSha,
    runId,
    expectedTestIds,
    executedTestIds,
    manifestHash: createHash('sha256').update(JSON.stringify(expectedTestIds)).digest('hex'),
    testOutcome: env.APP_E2E_TEST_OUTCOME ?? '',
  };
  const directory = env.APP_E2E_SHARD_DIRECTORY;
  if (!directory) throw new Error('E2E-Shard-Verzeichnis fehlt.');
  mkdirSync(directory, { recursive: true });
  const outputPath = resolve(directory, `app-e2e-shard-${shard}.json`);
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  return outputPath;
};

const parseShardEvidence = (value: unknown): AppE2EShardEvidence => {
  const keys = [
    'schemaVersion',
    'shard',
    'headSha',
    'runId',
    'expectedTestIds',
    'executedTestIds',
    'manifestHash',
    'testOutcome',
  ];
  if (!isRecord(value) || !hasExactKeys(value, keys))
    throw new Error('Ungültige E2E-Shard-Struktur.');
  if (
    value.schemaVersion !== 1 ||
    typeof value.shard !== 'number' ||
    !Number.isInteger(value.shard) ||
    value.shard < 1 ||
    value.shard > appE2EShardCount
  )
    throw new Error('Ungültige E2E-Shard-Identität.');
  if (
    typeof value.headSha !== 'string' ||
    typeof value.runId !== 'string' ||
    typeof value.manifestHash !== 'string' ||
    typeof value.testOutcome !== 'string' ||
    !isStringArray(value.expectedTestIds) ||
    !isStringArray(value.executedTestIds)
  )
    throw new Error('Ungültige E2E-Shard-Felder.');
  return {
    schemaVersion: 1,
    shard: value.shard,
    headSha: value.headSha,
    runId: value.runId,
    manifestHash: value.manifestHash,
    testOutcome: value.testOutcome,
    expectedTestIds: value.expectedTestIds,
    executedTestIds: value.executedTestIds,
  };
};

const assertCompleteSetup = (ids: readonly string[], shardIds: readonly string[]): void => {
  const setupIds = ids.filter((id) => id.startsWith('auth-setup:'));
  if (
    setupIds.length === 0 ||
    !setupIds.every((id) => shardIds.includes(id)) ||
    new Set(shardIds).size !== shardIds.length
  )
    throw new Error('E2E-Authentifizierungssetup ist unvollständig.');
};

export const validateAppE2EShards = (directory: string, headSha: string, runId: string): void => {
  const files = readdirSync(directory).filter((file) => file.endsWith('.json'));
  if (files.length !== appE2EShardCount) throw new Error('E2E-Shards sind unvollständig.');
  const shards = new Set<number>();
  const executed = new Set<string>();
  let expectedIds: string[] | undefined;
  for (const file of files) {
    const evidence = parseShardEvidence(JSON.parse(readFileSync(resolve(directory, file), 'utf8')));
    if (
      shards.has(evidence.shard) ||
      evidence.headSha !== headSha ||
      evidence.runId !== runId ||
      evidence.testOutcome !== 'success'
    )
      throw new Error('E2E-Shard-Evidenz ist ungültig oder veraltet.');
    const ids = evidence.expectedTestIds;
    if (
      !ids.some((id) => id.startsWith('chromium:')) ||
      new Set(ids).size !== ids.length ||
      evidence.manifestHash !== createHash('sha256').update(JSON.stringify(ids)).digest('hex') ||
      (expectedIds && JSON.stringify(ids) !== JSON.stringify(expectedIds))
    ) {
      throw new Error('E2E-Testinventare stimmen nicht überein.');
    }
    expectedIds = ids;
    shards.add(evidence.shard);
    const shardIds = evidence.executedTestIds;
    assertCompleteSetup(ids, shardIds);
    for (const id of shardIds) {
      if (!ids.includes(id) || (!id.startsWith('auth-setup:') && executed.has(id)))
        throw new Error('E2E-Testmenge ist fremd oder überlappend.');
      executed.add(id);
    }
  }
  if (!expectedIds || expectedIds.length !== executed.size)
    throw new Error('E2E-Testmenge ist unvollständig.');
};
