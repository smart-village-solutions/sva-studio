import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, expect, it } from 'vitest';

import { MANDATORY_ACCEPTANCE_PHASES } from './run-iam-acceptance.ts';

const rootDir = resolve(import.meta.dirname, '../..');
const runnerPath = resolve(import.meta.dirname, 'run-iam-acceptance.ts');
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

it('fails closed with exit code 1 and a redacted report when required configuration is missing', async () => {
  const reportDirectory = await mkdtemp(resolve(tmpdir(), 'iam-acceptance-characterization-'));
  temporaryDirectories.push(reportDirectory);
  const secretMarker = 'must-not-appear-in-acceptance-output';

  const result = spawnSync(process.execPath, ['--import', 'tsx', runnerPath], {
    cwd: rootDir,
    encoding: 'utf8',
    env: {
      IAM_ACCEPTANCE_ADMIN_PASSWORD: secretMarker,
      IAM_ACCEPTANCE_REPORT_DIR: reportDirectory,
      PATH: process.env.PATH,
    },
  });

  expect(result.status).toBe(1);
  expect(result.signal).toBeNull();
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('[iam-acceptance] FAILED Acceptance-Konfiguration');
  expect(result.stdout).toContain('Missing required acceptance env:');
  expect(result.stdout).not.toContain(secretMarker);

  const reportFiles = (await readdir(reportDirectory)).sort();
  expect(reportFiles).toHaveLength(2);
  expect(reportFiles).toEqual(['iam-foundation-acceptance.json', 'iam-foundation-acceptance.md']);

  const reports = await Promise.all(
    reportFiles.map((fileName) => readFile(resolve(reportDirectory, fileName), 'utf8'))
  );
  for (const report of reports) {
    expect(report).toContain('acceptance_config_missing');
    expect(report).not.toContain(secretMarker);
  }
});

it('keeps every mandatory acceptance check in its established orchestration order', async () => {
  const source = await readFile(runnerPath, 'utf8');
  const mandatoryChecks = [
    "name: 'Preflight Testnutzer'",
    "name: 'Testdaten-Reset'",
    "name: 'Readiness'",
    "name: 'OIDC Login Claims'",
    "name: 'Admin JIT-Provisioning Erstlogin'",
    "name: 'Member JIT-Provisioning Erstlogin'",
    "name: 'Admin JIT-Provisioning Zweitlogin'",
    "name: 'Organisations-CRUD'",
    "name: 'Membership-Zuweisung'",
    "name: 'UI Benutzerliste'",
    "name: 'UI Organisationsstruktur'",
  ] as const;
  expect(MANDATORY_ACCEPTANCE_PHASES).toEqual(mandatoryChecks);

  const phaseCalls = [
    'runIdentityPreflight(',
    'resetAcceptanceTestData(',
    'verifyReadiness(',
    'runLoginAndJitChecks(',
    'verifyOrganizationsAndMembership(',
    'verifyAdminUi(',
  ] as const;
  const orchestratorSource = source.slice(source.indexOf('const executeMandatoryChecks'));
  expect(phaseCalls.map((call) => orchestratorSource.indexOf(call))).toEqual(
    [...phaseCalls].map((_, index) => expect.any(Number))
  );
  let previousIndex = -1;
  for (const call of phaseCalls) {
    const currentIndex = orchestratorSource.indexOf(call, previousIndex + 1);
    expect(currentIndex, `missing or reordered mandatory phase: ${call}`).toBeGreaterThan(
      previousIndex
    );
    previousIndex = currentIndex;
  }
});
