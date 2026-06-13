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

export type PluginArchitectureBoundaryCheckResult = {
  mode: PluginArchitectureBoundaryCheckMode;
  violations: readonly PluginArchitectureViolation[];
  unallowlistedViolations: readonly PluginArchitectureViolation[];
  exitCode: 0 | 1;
};

export const DEFAULT_ALLOWLIST_PATH = path.join(PROJECT_ROOT, 'config', 'plugin-architecture-allowlist.json');

type RunPluginArchitectureBoundaryCheckOptions = {
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

export const runPluginArchitectureBoundaryCheck = async (
  projectRoot = PROJECT_ROOT,
  allowlistPathOrEntries: string | readonly PluginArchitectureAllowlistEntry[] = DEFAULT_ALLOWLIST_PATH,
  options: RunPluginArchitectureBoundaryCheckOptions = {}
): Promise<PluginArchitectureBoundaryCheckResult> => {
  const mode = options.mode ?? 'strict';
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

const run = async (): Promise<void> => {
  const result = await runPluginArchitectureBoundaryCheck(PROJECT_ROOT, DEFAULT_ALLOWLIST_PATH, { mode: 'warn' });
  if (result.violations.length === 0) {
    return;
  }

  console.warn('Plugin-Boundary-Guard meldet nicht erlaubte interne Plugin-Kanten.');
  for (const violation of result.unallowlistedViolations) {
    console.warn(
      `- [${violation.kind ?? 'unknown'}] ${violation.relativePath} -> ${violation.resolvedTarget ?? violation.subject}`
    );
  }
  process.exitCode = result.exitCode;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run();
}
