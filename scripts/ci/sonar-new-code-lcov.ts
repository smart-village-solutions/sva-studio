import fs from 'node:fs';
import path from 'node:path';
import { findCoverageArtifacts } from './coverage-gate.ts';
import { resolveLcovSourcePath } from './new-code-coverage-scope.ts';

export interface FileCoverage {
  coveredLines: Set<number>;
  instrumentedLines: Set<number>;
  coveredBranchesByLine: Map<number, number>;
  instrumentedBranchesByLine: Map<number, number>;
}

export function parseLcovCoverage(rootDir: string): Map<string, FileCoverage> {
  const workspaceRoots = [path.join(rootDir, 'apps'), path.join(rootDir, 'packages')];
  const lcovFiles = workspaceRoots.flatMap((workspaceRoot) =>
    findCoverageArtifacts(workspaceRoot, 'lcov.info')
  );
  const coverageByFile = new Map<string, FileCoverage>();

  for (const lcovPath of lcovFiles) {
    const projectRoot = path.dirname(path.dirname(lcovPath));
    const contents = fs.readFileSync(lcovPath, 'utf8');
    const records = contents.split('end_of_record');

    for (const record of records) {
      const trimmed = record.trim();
      if (!trimmed) {
        continue;
      }

      const sfMatch = trimmed.match(/^SF:(.+)$/m);
      if (!sfMatch) {
        continue;
      }

      const sourceFilePath = sfMatch[1].trim();
      const normalizedFilePath = resolveLcovSourcePath(rootDir, projectRoot, sourceFilePath);
      const fileCoverage: FileCoverage = {
        coveredLines: new Set<number>(),
        instrumentedLines: new Set<number>(),
        coveredBranchesByLine: new Map<number, number>(),
        instrumentedBranchesByLine: new Map<number, number>(),
      };

      for (const entryLine of trimmed.split('\n')) {
        const daMatch = entryLine.match(/^DA:(\d+),(\d+)/);
        if (daMatch) {
          const lineNumber = Number(daMatch[1]);
          const hits = Number(daMatch[2]);
          fileCoverage.instrumentedLines.add(lineNumber);
          if (hits > 0) {
            fileCoverage.coveredLines.add(lineNumber);
          }
          continue;
        }

        const brdaMatch = entryLine.match(/^BRDA:(\d+),(\d+|-),(\d+|-),(.+)$/);
        if (!brdaMatch) {
          continue;
        }

        const lineNumber = Number(brdaMatch[1]);
        const taken = brdaMatch[4];
        fileCoverage.instrumentedBranchesByLine.set(
          lineNumber,
          (fileCoverage.instrumentedBranchesByLine.get(lineNumber) ?? 0) + 1
        );
        if (taken !== '-' && Number(taken) > 0) {
          fileCoverage.coveredBranchesByLine.set(
            lineNumber,
            (fileCoverage.coveredBranchesByLine.get(lineNumber) ?? 0) + 1
          );
        }
      }

      coverageByFile.set(normalizedFilePath, fileCoverage);
    }
  }

  return coverageByFile;
}
