#!/usr/bin/env node

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { inspectRegistryImage, verifyStagingImageProvenance, type RegistryImageInspection } from './promote-image-provenance.ts';

const IMAGE_REPOSITORY = 'ghcr.io/smart-village-solutions/sva-studio';

export type PromoteEnvironment = 'dev' | 'prod' | 'staging';
export type PromoteImageType = 'digest' | 'tag';

export interface PromoteImageContract {
  deployRevision: string;
  deploySummaryDigest: string;
  deploySummaryImmutability: string;
  deploySummaryRollbackHint: string;
  deploySummaryTag: string;
  environment: PromoteEnvironment;
  imageInput: string;
  imageRef: string;
  imageType: PromoteImageType;
}

interface CliOptions {
  environment: PromoteEnvironment;
  expectedRevision?: string;
  imageInput: string;
}

const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const fullDigestRefPattern = new RegExp(
  `^${escapeRegExp(IMAGE_REPOSITORY)}@(sha256:[a-f0-9]{64})$`,
  'u'
);
const commitShaTagPattern = /^[a-f0-9]{40}$/u;
const imageTagPattern = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/u;

const normalizeEnvironment = (value: string): PromoteEnvironment => {
  if (value === 'dev' || value === 'staging' || value === 'prod') {
    return value;
  }

  throw new Error(`Ungültige Umgebung: ${value}`);
};

const normalizeImageInput = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error('Image-Referenz darf nicht leer sein.');
  }
  return trimmed;
};

const parseCliOptions = (args: readonly string[]): CliOptions => {
  let environment: PromoteEnvironment | null = null;
  let expectedRevision: string | undefined;
  let imageInput: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const nextValue = (): string => {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`Fehlender Wert für ${argument}`);
      }
      index += 1;
      return value;
    };

    if (argument === '--environment') {
      environment = normalizeEnvironment(nextValue());
      continue;
    }

    if (argument === '--image') {
      imageInput = normalizeImageInput(nextValue());
      continue;
    }

    if (argument === '--expected-revision') {
      const value = nextValue();
      if (!commitShaTagPattern.test(value)) {
        throw new Error('--expected-revision muss ein vollständiger Commit-SHA sein.');
      }
      expectedRevision = value;
      continue;
    }

    throw new Error(`Unbekannte Option: ${argument}`);
  }

  if (!environment) {
    throw new Error('Fehlender Wert für --environment');
  }

  if (!imageInput) {
    throw new Error('Fehlender Wert für --image');
  }

  return {
    environment,
    expectedRevision,
    imageInput,
  };
};

const isDigestInput = (imageInput: string): boolean =>
  digestPattern.test(imageInput) || fullDigestRefPattern.test(imageInput);

const extractDigest = (imageInput: string): string | null => {
  if (digestPattern.test(imageInput)) {
    return imageInput;
  }

  const fullDigestMatch = imageInput.match(fullDigestRefPattern);
  return fullDigestMatch?.[1] ?? null;
};

const extractTag = (imageInput: string): string => {
  const qualifiedPrefix = `${IMAGE_REPOSITORY}:`;
  const tag = imageInput.startsWith(qualifiedPrefix)
    ? imageInput.slice(qualifiedPrefix.length)
    : imageInput;

  if (!imageTagPattern.test(tag)) {
    throw new Error(`Ungültige Image-Tag-Referenz: ${imageInput}`);
  }

  return tag;
};

export const validatePromoteImageContract = ({
  environment,
  imageInput,
}: {
  environment: PromoteEnvironment;
  imageInput: string;
}): void => {
  const normalizedImageInput = normalizeImageInput(imageInput);
  const isDigest = isDigestInput(normalizedImageInput);
  const tag = isDigest ? null : extractTag(normalizedImageInput);
  const isCommitShaTag = tag !== null && commitShaTagPattern.test(tag);

  if (environment === 'dev') {
    return;
  }

  if (tag === 'latest') {
    throw new Error(`Image-Referenz "latest" ist für ${environment} nicht zulässig.`);
  }

  if (environment === 'staging' && !isDigest && !isCommitShaTag) {
    throw new Error('Staging-Promote erfordert mindestens einen Commit-SHA-Tag oder Digest.');
  }

  if (environment === 'prod' && !isDigest) {
    throw new Error('Prod-Promote erfordert einen immutable Digest.');
  }
};

export const resolvePromoteImageContract = ({
  environment,
  imageInput,
}: {
  environment: PromoteEnvironment;
  imageInput: string;
}): PromoteImageContract => {
  const normalizedImageInput = normalizeImageInput(imageInput);
  validatePromoteImageContract({
    environment,
    imageInput: normalizedImageInput,
  });

  const digest = extractDigest(normalizedImageInput);
  if (digest) {
    return {
      deployRevision: digest,
      deploySummaryDigest: digest,
      deploySummaryImmutability: 'digest',
      deploySummaryRollbackHint: 'Rollback über den vorherigen freigegebenen Digest ausführen.',
      deploySummaryTag: 'none',
      environment,
      imageInput: normalizedImageInput,
      imageRef: normalizedImageInput.startsWith(`${IMAGE_REPOSITORY}@`)
        ? normalizedImageInput
        : `${IMAGE_REPOSITORY}@${digest}`,
      imageType: 'digest',
    };
  }

  const tag = extractTag(normalizedImageInput);
  const isCommitShaTag = commitShaTagPattern.test(tag);
  const isLatestDevTag = environment === 'dev' && tag === 'latest';

  return {
    deployRevision: tag,
    deploySummaryDigest: 'not-pinned',
    deploySummaryImmutability: isLatestDevTag
      ? 'dev-latest-allowed'
      : isCommitShaTag
        ? 'commit-sha-tag'
        : 'mutable-dev-tag',
    deploySummaryRollbackHint: isLatestDevTag
      ? 'Rollback nicht über latest, sondern über vorherigen SHA-Tag oder Digest ausführen.'
      : isCommitShaTag
        ? 'Rollback über den vorherigen Commit-SHA-Tag oder einen bekannten Digest ausführen, nicht über latest.'
        : 'Rollback über einen vorherigen Commit-SHA-Tag oder bekannten Digest ausführen; der Dev-Tag ist veränderlich.',
    deploySummaryTag: tag,
    environment,
    imageInput: normalizedImageInput,
    imageRef: `${IMAGE_REPOSITORY}:${tag}`,
    imageType: 'tag',
  };
};

export const resolveVerifiedStagingImageContract = ({
  contract,
  expectedRevision,
  inspection,
}: {
  contract: PromoteImageContract;
  expectedRevision: string;
  inspection: RegistryImageInspection;
}): PromoteImageContract => {
  if (contract.environment !== 'staging') {
    return contract;
  }
  const digest = verifyStagingImageProvenance({ expectedRevision, inspection });

  return {
    ...contract,
    deployRevision: expectedRevision,
    deploySummaryDigest: digest,
    deploySummaryImmutability: 'digest-and-revision-attested',
    deploySummaryRollbackHint: 'Rollback über den vorherigen freigegebenen Digest ausführen.',
    imageRef: `${IMAGE_REPOSITORY}@${digest}`,
    imageType: 'digest',
  };
};

const emitGithubOutputs = (contract: PromoteImageContract): void => {
  const githubOutput = process.env.GITHUB_OUTPUT?.trim();
  if (!githubOutput) {
    return;
  }

  const lines = [
    `deploy_image_ref=${contract.imageRef}`,
    `deploy_image_type=${contract.imageType}`,
    `deploy_revision=${contract.deployRevision}`,
    `deploy_summary_tag=${contract.deploySummaryTag}`,
    `deploy_summary_digest=${contract.deploySummaryDigest}`,
    `deploy_summary_immutability=${contract.deploySummaryImmutability}`,
    `deploy_summary_rollback_hint=${contract.deploySummaryRollbackHint}`,
  ];

  appendFileSync(githubOutput, `${lines.join('\n')}\n`, 'utf8');
};

export const executePromoteImageContract = (
  args: readonly string[]
): { exitCode: number; stderr: string; stdout: string } => {
  try {
    const options = parseCliOptions(args);
    const initialContract = resolvePromoteImageContract(options);
    if (options.environment === 'staging' && !options.expectedRevision) {
      throw new Error('Staging erfordert --expected-revision.');
    }
    const expectedRevision = options.expectedRevision;
    const contract = options.environment === 'staging'
      ? resolveVerifiedStagingImageContract({
        contract: initialContract,
        expectedRevision: expectedRevision as string,
        inspection: inspectRegistryImage(initialContract.imageRef),
      })
      : initialContract;
    emitGithubOutputs(contract);

    return {
      exitCode: 0,
      stderr: '',
      stdout: JSON.stringify(contract, null, 2),
    };
  } catch (error) {
    return {
      exitCode: 2,
      stderr: error instanceof Error ? error.message : String(error),
      stdout: '',
    };
  }
};

export const runPromoteImageContract = (args: readonly string[]): number => {
  const result = executePromoteImageContract(args);

  if (result.stdout) {
    process.stdout.write(`${result.stdout}\n`);
  }
  if (result.stderr) {
    process.stderr.write(`${result.stderr}\n`);
  }

  return result.exitCode;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runPromoteImageContract(process.argv.slice(2)));
}
