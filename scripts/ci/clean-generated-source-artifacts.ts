import { deleteGeneratedSourceArtifacts } from './clean-source-artifacts.ts';

const run = (): number => {
  const rootDir = process.cwd();
  const removed = deleteGeneratedSourceArtifacts(rootDir);
  if (removed > 0) {
    console.log(`Removed ${removed} generated source artifact(s).`);
    return 0;
  }

  console.log('No generated source artifacts found.');
  return 0;
};

process.exit(run());
