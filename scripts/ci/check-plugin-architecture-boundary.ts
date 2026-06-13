import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export {
  collectPluginArchitectureViolations,
  PROJECT_ROOT,
  type PluginArchitectureBaselineEntry,
  type PluginArchitectureViolation,
  type PluginArchitectureViolationRule,
} from './plugin-architecture-boundary-lib.ts';

export {
  diffViolationsAgainstAllowlist,
  diffViolationsAgainstBaseline,
  parsePluginArchitectureAllowlist,
  parsePluginArchitectureBaseline,
  type PluginArchitectureAllowlistEntry,
} from './plugin-architecture-boundary-baseline.ts';

import {
  collectPluginArchitectureViolations,
  PROJECT_ROOT,
  type PluginArchitectureViolation,
} from './plugin-architecture-boundary-lib.ts';
import {
  diffViolationsAgainstAllowlist,
  parsePluginArchitectureAllowlist,
  type PluginArchitectureAllowlistEntry,
} from './plugin-architecture-boundary-baseline.ts';

export type PluginArchitectureBoundaryCheckMode = 'warn' | 'strict';
export type PluginArchitectureBoundaryGuardLogger = Pick<typeof console, 'warn'>;

export type PluginArchitectureBoundaryCheckResult = {
  mode: PluginArchitectureBoundaryCheckMode;
  violations: readonly PluginArchitectureViolation[];
  unallowlistedViolations: readonly PluginArchitectureViolation[];
  exitCode: 0 | 1;
};

export const DEFAULT_ALLOWLIST_PATH = path.join(PROJECT_ROOT, 'config', 'plugin-architecture-allowlist.json');

type RunPluginArchitectureBoundaryGuardOptions = {
  mode?: PluginArchitectureBoundaryCheckMode;
};

const loadPluginArchitectureAllowlist = async (
  allowlistPathOrEntries: string | readonly PluginArchitectureAllowlistEntry[]
): Promise<readonly PluginArchitectureAllowlistEntry[]> => {
  if (typeof allowlistPathOrEntries !== 'string') {
    return allowlistPathOrEntries;
  }

  const raw = await readFile(allowlistPathOrEntries, 'utf8');
  return parsePluginArchitectureAllowlist(JSON.parse(raw) as unknown);
};

export const runPluginArchitectureBoundaryGuard = async (
  projectRoot = PROJECT_ROOT,
  allowlistPathOrEntries: string | readonly PluginArchitectureAllowlistEntry[] = DEFAULT_ALLOWLIST_PATH,
  options: RunPluginArchitectureBoundaryGuardOptions = {}
): Promise<PluginArchitectureBoundaryCheckResult> => {
  const mode = options.mode ?? 'warn';
  const [allowlist, violations] = await Promise.all([
    loadPluginArchitectureAllowlist(allowlistPathOrEntries),
    collectPluginArchitectureViolations(projectRoot),
  ]);
  const unallowlistedViolations = diffViolationsAgainstAllowlist(violations, allowlist);

  return {
    mode,
    violations,
    unallowlistedViolations,
    exitCode: mode === 'strict' && unallowlistedViolations.length > 0 ? 1 : 0,
  };
};

export const reportPluginArchitectureBoundaryGuardResult = (
  result: PluginArchitectureBoundaryCheckResult,
  logger: PluginArchitectureBoundaryGuardLogger = console
): boolean => {
  if (result.unallowlistedViolations.length === 0) {
    return false;
  }

  logger.warn('Plugin-Boundary-Guard meldet nicht erlaubte interne Plugin-Kanten.');
  for (const violation of result.unallowlistedViolations) {
    logger.warn(`- [${violation.kind ?? 'unknown'}] ${violation.relativePath} -> ${violation.resolvedTarget ?? violation.subject}`);
  }
  return true;
};

const run = async (): Promise<void> => {
  const result = await runPluginArchitectureBoundaryGuard(PROJECT_ROOT, DEFAULT_ALLOWLIST_PATH);
  if (!reportPluginArchitectureBoundaryGuardResult(result)) {
    return;
  }
  process.exitCode = result.exitCode;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run();
}
