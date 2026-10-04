import { mkdir, writeFile } from 'node:fs/promises';

import {
  createEvidenceArtifactPath,
  type EvidenceArtifact,
  type EvidenceCaseRecord,
  type EvidenceRunPaths,
} from './iam-evidence.ts';
import type { Page } from './iam-evidence-session.js';

export type RecordCase = (entry: EvidenceCaseRecord) => EvidenceCaseRecord;

const createArtifact = (input: {
  description: string;
  filename: string;
  kind: EvidenceArtifact['kind'];
  runPaths: EvidenceRunPaths;
  reportDirectory: string;
}): { absolutePath: string; artifact: EvidenceArtifact } => {
  const pathInfo = createEvidenceArtifactPath({
    artifactDirectory: input.runPaths.artifactDirectory,
    filename: input.filename,
    reportDirectory: input.reportDirectory,
  });

  return {
    absolutePath: pathInfo.absolutePath,
    artifact: {
      description: input.description,
      kind: input.kind,
      path: pathInfo.relativePath,
    },
  };
};

export const captureScreenshot = async (input: {
  description: string;
  filename: string;
  page: Page;
  reportDirectory: string;
  runPaths: EvidenceRunPaths;
}): Promise<EvidenceArtifact> => {
  const artifact = createArtifact({
    description: input.description,
    filename: input.filename,
    kind: 'screenshot',
    reportDirectory: input.reportDirectory,
    runPaths: input.runPaths,
  });
  await mkdir(input.runPaths.artifactDirectory, { recursive: true });
  await input.page.screenshot({ fullPage: true, path: artifact.absolutePath });
  return artifact.artifact;
};

export const writeTextArtifact = async (input: {
  contents: string;
  description: string;
  filename: string;
  kind: EvidenceArtifact['kind'];
  reportDirectory: string;
  runPaths: EvidenceRunPaths;
}): Promise<EvidenceArtifact> => {
  const artifact = createArtifact({
    description: input.description,
    filename: input.filename,
    kind: input.kind,
    reportDirectory: input.reportDirectory,
    runPaths: input.runPaths,
  });
  await mkdir(input.runPaths.artifactDirectory, { recursive: true });
  await writeFile(artifact.absolutePath, input.contents, 'utf8');
  return artifact.artifact;
};
