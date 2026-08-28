import fs from 'node:fs';
import path from 'node:path';

import {
  createScopeFailureEvidence,
  evaluateCiGateShadowParity,
  type CiGateShadowParityEvidence,
  type GitHubCheckRun,
} from './ci-gate-shadow-parity.ts';
import { parsePrScopeEvidence } from './pr-scope.cli.ts';

interface CliOptions {
  checksPath: string;
  scopePath: string;
  legacyScopePath: string;
  outputPath: string;
  baseSha: string;
  headSha: string;
  scopeResult: string;
  failPending: boolean;
}

const parseArguments = (args: readonly string[]): CliOptions => {
  const read = (name: string): string => {
    const index = args.indexOf(name);
    const value = index >= 0 ? args[index + 1] : undefined;
    if (!value) {
      throw new Error(`Fehlender Wert für ${name}`);
    }
    return value;
  };
  return {
    checksPath: read('--checks'),
    scopePath: read('--scope'),
    legacyScopePath: read('--legacy-scope'),
    outputPath: read('--output'),
    baseSha: read('--base'),
    headSha: read('--head'),
    scopeResult: read('--scope-result'),
    failPending: args.includes('--fail-pending'),
  };
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

const writeResult = (outputPath: string, result: CiGateShadowParityEvidence): void => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(
      summaryPath,
      [
        '### CI-Gate-Topologie-Shadow',
        '',
        `- Head-SHA: \`${result.headSha}\``,
        `- Verglichene Gate-Verträge: ${result.gates.length}`,
        `- Scope-Parität: ${result.scopeMatches ? 'identisch' : 'abweichend'}`,
        `- Abweichungen: ${result.mismatches.length}`,
        '',
      ].join('\n'),
      'utf8'
    );
  }
};

export const runCiGateShadowParityCli = (args: readonly string[]): number => {
  const options = parseArguments(args);
  let result: CiGateShadowParityEvidence;
  try {
    if (options.scopeResult !== 'success') {
      throw new Error(`Scope-Job endete mit ${options.scopeResult}`);
    }
    const rawScope = JSON.parse(fs.readFileSync(options.scopePath, 'utf8')) as unknown;
    const rawLegacyScope = JSON.parse(fs.readFileSync(options.legacyScopePath, 'utf8')) as unknown;
    const scope = parsePrScopeEvidence(rawScope, options.baseSha, options.headSha);
    const legacyScope = parsePrScopeEvidence(rawLegacyScope, options.baseSha, options.headSha);
    result = evaluateCiGateShadowParity(readChecks(options.checksPath), scope, legacyScope);
  } catch (error) {
    result = createScopeFailureEvidence(
      options.baseSha,
      options.headSha,
      error instanceof Error ? error.message : String(error)
    );
  }
  writeResult(options.outputPath, result);

  for (const mismatch of result.mismatches) {
    console.error(mismatch);
  }
  if (result.hardMismatchCount > 0 || (result.awaitingChecks && options.failPending)) {
    return 1;
  }
  if (result.awaitingChecks) {
    return 2;
  }
  console.log(`CI-Shadow-Parität für ${result.headSha}: ${result.gates.length} Gates identisch.`);
  return 0;
};

try {
  process.exit(runCiGateShadowParityCli(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
