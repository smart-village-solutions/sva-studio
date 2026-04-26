import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_OUTPUT_PATH = 'artifacts/sonar/lcov.info';
const COVERAGE_REPORT_PATH = 'coverage/lcov.info';

export interface PrepareSonarLcovOptions {
  rootDir: string;
  outputPath?: string;
}

export interface PrepareSonarLcovResult {
  outputPath: string;
  reports: number;
  sourceFiles: number;
}

const normalizePath = (value: string): string => value.split(path.sep).join('/');

const isWorkspaceRoot = (entry: fs.Dirent): boolean =>
  entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules';

const findCoverageReports = (rootDir: string): string[] => {
  const workspaceDirs = ['apps', 'packages'].flatMap((workspaceFolder) => {
    const workspaceRoot = path.join(rootDir, workspaceFolder);
    if (!fs.existsSync(workspaceRoot)) {
      return [];
    }

    return fs
      .readdirSync(workspaceRoot, { withFileTypes: true })
      .filter(isWorkspaceRoot)
      .map((entry) => path.join(workspaceRoot, entry.name));
  });

  return workspaceDirs
    .map((workspaceDir) => path.join(workspaceDir, COVERAGE_REPORT_PATH))
    .filter((reportPath) => fs.existsSync(reportPath))
    .sort((left, right) => left.localeCompare(right));
};

export const normalizeSonarSourcePath = (rootDir: string, projectRoot: string, sourcePath: string): string => {
  const sourcePathWithoutFileUrl = sourcePath.startsWith('file://') ? fileURLToPath(sourcePath) : sourcePath;
  const absoluteSourcePath = path.isAbsolute(sourcePathWithoutFileUrl)
    ? sourcePathWithoutFileUrl
    : path.resolve(projectRoot, sourcePathWithoutFileUrl);

  return normalizePath(path.relative(rootDir, absoluteSourcePath));
};

const normalizeLcovContents = (rootDir: string, reportPath: string): { contents: string; sourceFiles: number } => {
  const projectRoot = path.dirname(path.dirname(reportPath));
  let sourceFiles = 0;
  const contents = fs
    .readFileSync(reportPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => {
      if (!line.startsWith('SF:')) {
        return line;
      }

      sourceFiles += 1;
      return `SF:${normalizeSonarSourcePath(rootDir, projectRoot, line.slice(3))}`;
    })
    .join('\n');

  return { contents, sourceFiles };
};

export const prepareSonarLcov = ({
  rootDir,
  outputPath = DEFAULT_OUTPUT_PATH,
}: PrepareSonarLcovOptions): PrepareSonarLcovResult => {
  const absoluteOutputPath = path.resolve(rootDir, outputPath);
  const reports = findCoverageReports(rootDir);
  const normalizedReports = reports.map((reportPath) => normalizeLcovContents(rootDir, reportPath));
  const sourceFiles = normalizedReports.reduce((sum, report) => sum + report.sourceFiles, 0);
  const contents = normalizedReports.map((report) => report.contents.trimEnd()).join('\n');

  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, `${contents}\n`);

  return {
    outputPath: normalizePath(path.relative(rootDir, absoluteOutputPath)),
    reports: reports.length,
    sourceFiles,
  };
};

const runCli = (): void => {
  const result = prepareSonarLcov({ rootDir: process.cwd() });
  console.log(
    `Sonar LCOV vorbereitet: ${result.outputPath} (${result.reports} Reports, ${result.sourceFiles} Source-Files)`
  );
};

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === currentFilePath) {
  runCli();
}
