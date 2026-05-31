import { pathToFileURL } from 'node:url';

export {
  collectPluginArchitectureViolations,
  DEFAULT_BASELINE_PATH,
  diffViolationsAgainstBaseline,
  parsePluginArchitectureBaseline,
  PROJECT_ROOT,
  runPluginArchitectureBoundaryCheck,
  type PluginArchitectureBaselineEntry,
  type PluginArchitectureViolation,
  type PluginArchitectureViolationRule,
} from './plugin-architecture-boundary-lib.ts';

import { runPluginArchitectureBoundaryCheck } from './plugin-architecture-boundary-lib.ts';

const run = async (): Promise<void> => {
  const violations = await runPluginArchitectureBoundaryCheck();
  if (violations.length === 0) {
    return;
  }

  console.error('Plugin-Architecture-Boundary-Check fehlgeschlagen.');
  console.error('');
  console.error('Plugins duerfen Host-Vertraege nur ueber den dokumentierten Plugin-Vertrag konsumieren.');
  console.error('Neue Drift ist nicht ueber die Brownfield-Baseline abgedeckt und blockiert den Lauf.');
  console.error('');
  for (const violation of violations) {
    console.error(`- [${violation.rule}] ${violation.relativePath} -> ${violation.subject}: ${violation.message}`);
  }
  process.exit(1);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run();
}
