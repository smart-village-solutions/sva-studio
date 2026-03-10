import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { findGeneratedSourceArtifacts } from './check-file-placement.ts';

export const deleteGeneratedSourceArtifacts = (rootDir: string): number => {
  const artifacts = findGeneratedSourceArtifacts(rootDir);
  let removedCount = 0;

  for (const artifact of artifacts) {
    const artifactPath = path.join(rootDir, artifact);

    try {
      fs.rmSync(artifactPath, { force: true });
      removedCount += 1;
    } catch (error) {
      console.error(`Failed to remove generated source artifact at ${artifactPath}:`, error);
    }
  }

  return removedCount;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = process.cwd();
  const removed = deleteGeneratedSourceArtifacts(rootDir);

  if (removed === 0) {
    console.log('No generated source artifacts found.');
    process.exit(0);
  }

  console.log(`Removed ${removed} generated source artifacts from package source trees.`);
}
