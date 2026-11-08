import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TEST_FILES_FLAG = '--testFiles';
const OPTIONAL_VALUE_FLAGS = new Set(['--changed']);

export const normalizeVitestRunArgs = (args: readonly string[]): string[] => {
  const passthroughArgs: string[] = [];
  const testFileArgs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === TEST_FILES_FLAG) {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Fehlender Wert für --testFiles');
      }
      testFileArgs.push(value);
      index += 1;
      continue;
    }

    if (argument.startsWith(`${TEST_FILES_FLAG}=`)) {
      const value = argument.slice(`${TEST_FILES_FLAG}=`.length);
      if (value.length === 0) {
        throw new Error('Fehlender Wert für --testFiles');
      }
      testFileArgs.push(value);
      continue;
    }

    if (argument.startsWith('-')) {
      passthroughArgs.push(argument);
      continue;
    }

    passthroughArgs.push(argument);
  }

  if (testFileArgs.length === 0) {
    return passthroughArgs;
  }

  const conflictingOptionalValueFlag = passthroughArgs.find((argument) =>
    OPTIONAL_VALUE_FLAGS.has(argument)
  );
  if (conflictingOptionalValueFlag) {
    throw new Error(
      `${conflictingOptionalValueFlag} kann nicht mit --testFiles kombiniert werden. Verwende stattdessen direkte Vitest-Dateifilter ohne ${conflictingOptionalValueFlag}.`
    );
  }

  // Several package targets select their default suite with a leading `tests`
  // directory. Vitest combines positional filters with OR, so retaining that
  // directory would silently turn an explicit file run back into the full suite.
  const selectedArgs = passthroughArgs[0] === 'tests' ? passthroughArgs.slice(1) : passthroughArgs;
  return [...selectedArgs, ...testFileArgs];
};

export const isRunVitestTargetEntrypoint = (
  scriptUrl: string,
  entrypointPath: string | undefined
): boolean => {
  if (!entrypointPath) {
    return false;
  }

  return scriptUrl === pathToFileURL(entrypointPath).href;
};

export const runVitestTarget = (): never => {
  const args = normalizeVitestRunArgs(process.argv.slice(2));
  const manifestPath = process.env.CI_APP_UNIT_MANIFEST;
  const reportPath = manifestPath ? `${manifestPath}.results.json` : undefined;
  let expectedFiles: string[] = [];
  if (manifestPath) {
    const index = args.indexOf('--config');
    if (index < 0 || !args[index + 1])
      throw new Error('App-Manifest benötigt eine explizite Vitest-Konfiguration.');
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.rmSync(manifestPath, { force: true });
    if (reportPath) fs.rmSync(reportPath, { force: true });
    const discovered = JSON.parse(
      execFileSync(
        'pnpm',
        ['exec', 'vitest', 'list', '--config', args[index + 1], '--filesOnly', '--json'],
        { encoding: 'utf8' }
      )
    ) as { file: string }[];
    expectedFiles = discovered.map(({ file }) => file);
    args.push('--reporter=json', `--outputFile.json=${reportPath}`);
  }
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (manifestPath && reportPath && result.status === 0) {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
      success: boolean;
      testResults: { name: string; assertionResults: { fullName: string; status: string }[] }[];
    };
    if (!report.success) throw new Error('App-Testreport ist nicht erfolgreich.');
    const root = process.env.CI_APP_UNIT_ROOT;
    if (!root) throw new Error('App-Manifest-Root fehlt.');
    const relative = (file: string): string => path.relative(root, file).split(path.sep).join('/');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({
        expectedFiles: expectedFiles.map(relative).sort(),
        files: report.testResults.map(({ name }) => relative(name)).sort(),
        tests: report.testResults.flatMap((file) =>
          file.assertionResults.map((test) => ({
            file: relative(file.name),
            name: test.fullName,
            status: test.status,
          }))
        ),
      })
    );
    fs.rmSync(reportPath);
  }
  process.exit(result.status ?? 1);
};

if (isRunVitestTargetEntrypoint(import.meta.url, process.argv[1])) {
  runVitestTarget();
}
