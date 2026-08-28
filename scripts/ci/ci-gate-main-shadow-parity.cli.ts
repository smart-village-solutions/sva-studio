import fs from 'node:fs';
import path from 'node:path';

import {
  evaluateCiGateMainShadowParity,
  type CiGateMainShadowParityEvidence,
} from './ci-gate-main-shadow-parity.ts';
import type { GitHubCheckRun } from './ci-gate-shadow-parity.ts';

const readArgument = (args: readonly string[], name: string): string => {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value) throw new Error(`Fehlender Wert für ${name}`);
  return value;
};

const readChecks = (filePath: string): GitHubCheckRun[] => {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
    check_runs?: GitHubCheckRun[];
  };
  if (!Array.isArray(value.check_runs)) {
    throw new Error('GitHub-Check-Evidenz enthält keine check_runs-Liste.');
  }
  return value.check_runs;
};

const writeEvidence = (filePath: string, evidence: CiGateMainShadowParityEvidence): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
};

export const runCiGateMainShadowParityCli = (args: readonly string[]): number => {
  const evidence = evaluateCiGateMainShadowParity(
    readChecks(readArgument(args, '--checks')),
    readArgument(args, '--head'),
    readArgument(args, '--event'),
    new Date(),
    new Date(readArgument(args, '--comparison-started-at'))
  );
  writeEvidence(readArgument(args, '--output'), evidence);
  for (const mismatch of evidence.mismatches) console.error(mismatch);
  if (
    evidence.hardMismatchCount > 0 ||
    (evidence.awaitingChecks && args.includes('--fail-pending'))
  )
    return 1;
  if (evidence.awaitingChecks) return 2;
  console.log(`CI-Main-Shadow-Parität für ${evidence.headSha}: ${evidence.gates.length} Gates.`);
  return 0;
};

try {
  process.exit(runCiGateMainShadowParityCli(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
