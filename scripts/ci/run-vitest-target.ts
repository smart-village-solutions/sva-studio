import { spawnSync } from 'node:child_process';
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

  const conflictingOptionalValueFlag = passthroughArgs.find((argument) => OPTIONAL_VALUE_FLAGS.has(argument));
  if (conflictingOptionalValueFlag) {
    throw new Error(
      `${conflictingOptionalValueFlag} kann nicht mit --testFiles kombiniert werden. Verwende stattdessen direkte Vitest-Dateifilter ohne ${conflictingOptionalValueFlag}.`
    );
  }

  return [...passthroughArgs, ...testFileArgs];
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
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', ...normalizeVitestRunArgs(process.argv.slice(2))], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
};

if (isRunVitestTargetEntrypoint(import.meta.url, process.argv[1])) {
  runVitestTarget();
}
