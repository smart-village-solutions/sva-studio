import type { ChangedFile } from './new-code-coverage-scope.ts';
import {
  isLikelyExecutableLine,
  isLikelyNonExecutableFile,
  readSourceLines,
} from './new-code-coverage-source.ts';
import type { FileCoverage } from './sonar-new-code-lcov.ts';

export interface UncoveredFileSummary {
  path: string;
  covered: number;
  missed: number;
  coveredBranches: number;
  missedBranches: number;
}

interface FileCounts {
  coveredLines: number;
  missedLines: number;
  coveredBranches: number;
  missedBranches: number;
}

export interface ChangedFilesEvaluation extends FileCounts {
  ignoredFiles: number;
  uncoveredFiles: UncoveredFileSummary[];
}

function countChangedLine(
  coverage: FileCoverage | undefined,
  ignoreWithoutCoverage: boolean,
  sourceLine: string,
  lineNumber: number
): Pick<FileCounts, 'coveredLines' | 'missedLines'> {
  if (coverage?.instrumentedLines.has(lineNumber)) {
    return coverage.coveredLines.has(lineNumber)
      ? { coveredLines: 1, missedLines: 0 }
      : { coveredLines: 0, missedLines: 1 };
  }

  return {
    coveredLines: 0,
    missedLines: !coverage && !ignoreWithoutCoverage && isLikelyExecutableLine(sourceLine) ? 1 : 0,
  };
}

function countChangedBranches(
  coverage: FileCoverage | undefined,
  lineNumber: number
): Pick<FileCounts, 'coveredBranches' | 'missedBranches'> {
  const instrumented = coverage?.instrumentedBranchesByLine.get(lineNumber) ?? 0;
  const covered = instrumented > 0 ? (coverage?.coveredBranchesByLine.get(lineNumber) ?? 0) : 0;
  return { coveredBranches: covered, missedBranches: instrumented - covered };
}

function evaluateChangedFile(
  rootDir: string,
  changedFile: ChangedFile,
  coverage: FileCoverage | undefined
): FileCounts {
  const sourceLines = readSourceLines(rootDir, changedFile.path);
  const ignoreWithoutCoverage =
    !coverage && isLikelyNonExecutableFile(changedFile.path, sourceLines);
  const counts: FileCounts = {
    coveredLines: 0,
    missedLines: 0,
    coveredBranches: 0,
    missedBranches: 0,
  };

  for (const lineNumber of changedFile.changedLines) {
    const line = countChangedLine(
      coverage,
      ignoreWithoutCoverage,
      sourceLines[lineNumber - 1] ?? '',
      lineNumber
    );
    const branches = countChangedBranches(coverage, lineNumber);
    counts.coveredLines += line.coveredLines;
    counts.missedLines += line.missedLines;
    counts.coveredBranches += branches.coveredBranches;
    counts.missedBranches += branches.missedBranches;
  }

  return counts;
}

export function evaluateChangedFiles(
  rootDir: string,
  changedFiles: readonly ChangedFile[],
  coverageByFile: ReadonlyMap<string, FileCoverage>
): ChangedFilesEvaluation {
  const result: ChangedFilesEvaluation = {
    coveredLines: 0,
    missedLines: 0,
    coveredBranches: 0,
    missedBranches: 0,
    ignoredFiles: 0,
    uncoveredFiles: [],
  };

  for (const changedFile of changedFiles) {
    const counts = evaluateChangedFile(rootDir, changedFile, coverageByFile.get(changedFile.path));
    if (Object.values(counts).every((count) => count === 0)) {
      result.ignoredFiles += 1;
      continue;
    }

    result.coveredLines += counts.coveredLines;
    result.missedLines += counts.missedLines;
    result.coveredBranches += counts.coveredBranches;
    result.missedBranches += counts.missedBranches;
    if (counts.missedLines > 0 || counts.missedBranches > 0) {
      result.uncoveredFiles.push({
        path: changedFile.path,
        covered: counts.coveredLines,
        missed: counts.missedLines,
        coveredBranches: counts.coveredBranches,
        missedBranches: counts.missedBranches,
      });
    }
  }

  return result;
}
