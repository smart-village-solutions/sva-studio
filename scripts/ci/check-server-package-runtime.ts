import { pathToFileURL } from 'node:url';

import { runDistRuntimeSmokeCheck } from './server-runtime-guard-dist.js';
import { findPackageDirectory, findStaticRuntimeViolations } from './server-runtime-guard-workspace.js';
import type { RuntimeViolation } from './server-runtime-guard-workspace.js';

export { collectDistRuntimeEntryPoints, runDistRuntimeSmokeCheck, syncInjectedWorkspacePackageDists } from './server-runtime-guard-dist.js';
export {
  collectRuntimeImportReferences,
  collectRuntimeSourceFiles,
  discoverWorkspacePackages,
  findPackageDirectory,
  findStaticRuntimeViolations,
} from './server-runtime-guard-workspace.js';
export type { RuntimeImportReference, RuntimeViolation } from './server-runtime-guard-workspace.js';

const formatViolation = (violation: RuntimeViolation): string =>
  violation.line ? `${violation.filePath}:${violation.line}: ${violation.message}` : `${violation.filePath}: ${violation.message}`;

export const checkServerPackageRuntime = async (input: {
  rootDir: string;
  packageSelector: string;
  mode?: 'all' | 'smoke' | 'static';
}): Promise<RuntimeViolation[]> => {
  const packageDir = findPackageDirectory(input.rootDir, input.packageSelector);
  const mode = input.mode ?? 'all';

  const violations: RuntimeViolation[] = [];
  if (mode === 'all' || mode === 'static') {
    violations.push(...findStaticRuntimeViolations(input.rootDir, packageDir));
  }
  if (mode === 'all' || mode === 'smoke') {
    violations.push(...(await runDistRuntimeSmokeCheck(input.rootDir, packageDir)));
  }
  return violations;
};

const parseArgValue = (args: readonly string[], flag: string): string[] => {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) {
      continue;
    }
    const nextValue = args[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      throw new Error(`Missing value for ${flag}`);
    }
    values.push(nextValue);
    index += 1;
  }
  return values;
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const packageSelectors = parseArgValue(args, '--package');
  const rootDir = parseArgValue(args, '--root-dir')[0] ?? process.cwd();
  const modeValue = parseArgValue(args, '--mode')[0] ?? 'all';
  const mode = modeValue === 'static' || modeValue === 'smoke' || modeValue === 'all' ? modeValue : null;

  if (!mode) {
    throw new Error(`Unsupported mode: ${modeValue}`);
  }
  if (packageSelectors.length === 0) {
    throw new Error('Pass at least one --package <name> argument.');
  }

  const allViolations: RuntimeViolation[] = [];
  for (const packageSelector of packageSelectors) {
    const violations = await checkServerPackageRuntime({
      rootDir,
      packageSelector,
      mode,
    });
    allViolations.push(...violations);
  }

  if (allViolations.length > 0) {
    console.error('Server package runtime guard failed:\n');
    for (const violation of allViolations) {
      console.error(`- ${formatViolation(violation)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Server package runtime guard passed for ${packageSelectors.join(', ')} (${mode}).`);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main();
}
