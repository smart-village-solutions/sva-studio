export type GithubArtifactRecord = Readonly<{
  expired?: boolean;
  id?: number;
  name?: string;
  workflow_run?: {
    id?: number;
  };
}>;

export type GithubVerifyArtifactEvidence = Readonly<{
  imageRef: string;
  reportId?: string;
  status: 'ok';
}>;

export type GithubVerifyEvidenceOptions = Readonly<{
  commandExistsImpl?: (commandName: string) => boolean;
  imageTag?: string;
  readArtifactEvidenceImpl?: (args: {
    artifactId?: number;
    artifactName: string;
    imageDigest: string;
    owner: string;
    repo: string;
    runId: number;
  }) => GithubVerifyArtifactEvidence | undefined;
  runCaptureImpl?: (command: string, args: readonly string[]) => string;
}>;
