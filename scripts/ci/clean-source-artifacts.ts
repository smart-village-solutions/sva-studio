import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { findGeneratedSourceArtifacts } from './check-file-placement.ts';

export const deleteGeneratedSourceArtifacts = (rootDir: string): number => {
  const artifacts = findGeneratedSourceArtifacts(rootDir);

  for (const artifact of artifacts) {
    fs.unlinkSync(path.join(rootDir, artifact));
  }

  return artifacts.length;
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
