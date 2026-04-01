import fs from 'node:fs';
import path from 'node:path';

const GENERATED_SOURCE_ARTIFACT_PATTERN = /^packages\/[^/]+\/src\/.*\.(?:js|d\.ts|d\.ts\.map)$/;

const walk = (directory: string, files: string[]): void => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath, files);
      continue;
    }

    files.push(entryPath);
  }
};

const findGeneratedSourceArtifacts = (rootDir: string): string[] => {
  const packagesDir = path.join(rootDir, 'packages');
  if (!fs.existsSync(packagesDir)) {
    return [];
  }

  const files: string[] = [];
  walk(packagesDir, files);

  return files
    .map((entryPath) => path.relative(rootDir, entryPath).split(path.sep).join('/'))
    .filter((relativePath) => GENERATED_SOURCE_ARTIFACT_PATTERN.test(relativePath));
};

const run = (): number => {
  const rootDir = process.cwd();
  const artifacts = findGeneratedSourceArtifacts(rootDir);

  for (const artifact of artifacts) {
    fs.rmSync(path.join(rootDir, artifact), { force: true });
  }

  if (artifacts.length > 0) {
    console.log(`Removed ${artifacts.length} generated source artifact(s).`);
    return 0;
  }

  console.log('No generated source artifacts found.');
  return 0;
};

process.exit(run());
