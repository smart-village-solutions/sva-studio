import { resolve } from 'node:path';

export type StudioInstanceAuditOptions = Readonly<{
  outputDir: string;
}>;

export const parseStudioInstanceAuditOptions = (
  argv: readonly string[],
  rootDir: string,
): StudioInstanceAuditOptions => {
  const outputDirArgIndex = argv.findIndex((entry) => entry === '--output-dir');
  const outputDir =
    outputDirArgIndex >= 0 && argv[outputDirArgIndex + 1]
      ? argv[outputDirArgIndex + 1]!
      : resolve(rootDir, 'docs/reports');

  return { outputDir };
};
