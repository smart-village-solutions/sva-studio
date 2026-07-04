#!/usr/bin/env node

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const IMAGE_REPOSITORY = 'ghcr.io/smart-village-solutions/sva-studio';

export type PromoteEnvironment = 'dev' | 'prod' | 'staging';
export type PromoteImageType = 'digest' | 'tag';

export interface PromoteImageContract {
  deployRevision: string;
  deploySummaryDigest: string;
  deploySummaryTag: string;
  environment: PromoteEnvironment;
  imageInput: string;
  imageRef: string;
  imageType: PromoteImageType;
}

interface CliOptions {
  environment: PromoteEnvironment;
  imageInput: string;
}

const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const fullDigestRefPattern = new RegExp(`^${IMAGE_REPOSITORY.replaceAll('/', '\\/')}@(sha256:[a-f0-9]{64})$`, 'u');
const commitShaTagPattern = /^[a-f0-9]{40}$/u;

const normalizeEnvironment = (value: string): PromoteEnvironment => {
  if (value === 'dev' || value === 'staging' || value === 'prod') {
    return value;
  }

  throw new Error(`Ungueltige Umgebung: ${value}`);
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
  let imageInput: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const nextValue = (): string => {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`Fehlender Wert fuer ${argument}`);
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

    throw new Error(`Unbekannte Option: ${argument}`);
  }

  if (!environment) {
    throw new Error('Fehlender Wert fuer --environment');
  }

  if (!imageInput) {
    throw new Error('Fehlender Wert fuer --image');
  }

  return {
    environment,
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

export const validatePromoteImageContract = ({
  environment,
  imageInput,
}: {
  environment: PromoteEnvironment;
  imageInput: string;
}): void => {
  const normalizedImageInput = normalizeImageInput(imageInput);
  const isDigest = isDigestInput(normalizedImageInput);
  const isCommitShaTag = commitShaTagPattern.test(normalizedImageInput);

  if (environment === 'dev') {
    return;
  }

  if (normalizedImageInput === 'latest') {
    throw new Error(`Image-Referenz "latest" ist fuer ${environment} nicht zulaessig.`);
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
      deploySummaryTag: 'none',
      environment,
      imageInput: normalizedImageInput,
      imageRef: normalizedImageInput.startsWith(`${IMAGE_REPOSITORY}@`)
        ? normalizedImageInput
        : `${IMAGE_REPOSITORY}@${digest}`,
      imageType: 'digest',
    };
  }

  return {
    deployRevision: normalizedImageInput,
    deploySummaryDigest: 'not-pinned',
    deploySummaryTag: normalizedImageInput,
    environment,
    imageInput: normalizedImageInput,
    imageRef: `${IMAGE_REPOSITORY}:${normalizedImageInput}`,
    imageType: 'tag',
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
  ];

  appendFileSync(githubOutput, `${lines.join('\n')}\n`, 'utf8');
};

export const executePromoteImageContract = (
  args: readonly string[]
): { exitCode: number; stderr: string; stdout: string } => {
  try {
    const options = parseCliOptions(args);
    const contract = resolvePromoteImageContract(options);
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
