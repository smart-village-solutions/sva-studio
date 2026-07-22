import { execFileSync } from 'node:child_process';

export interface RegistryImageInspection {
  image?: {
    config?: {
      Labels?: Record<string, string>;
    };
  };
  manifest?: {
    digest?: string;
  };
}

const commitShaPattern = /^[a-f0-9]{40}$/u;
const digestPattern = /^sha256:[a-f0-9]{64}$/u;

export const verifyStagingImageProvenance = ({
  expectedRevision,
  inspection,
}: {
  expectedRevision: string;
  inspection: RegistryImageInspection;
}): string => {
  if (!commitShaPattern.test(expectedRevision)) {
    throw new Error('Die erwartete Staging-Revision muss ein vollständiger Commit-SHA sein.');
  }
  const digest = inspection.manifest?.digest;
  if (!digest || !digestPattern.test(digest)) {
    throw new Error('Der Registry-Manifest-Digest für das Staging-Image konnte nicht ermittelt werden.');
  }
  const revision = inspection.image?.config?.Labels?.['org.opencontainers.image.revision'];
  if (revision !== expectedRevision) {
    throw new Error(`Die OCI-Image-Revision stimmt nicht mit change_head überein: erwartet ${expectedRevision}, erhalten ${revision ?? 'fehlend'}.`);
  }
  return digest;
};

export const inspectRegistryImage = (imageRef: string): RegistryImageInspection => {
  const output = execFileSync(
    'docker',
    ['buildx', 'imagetools', 'inspect', imageRef, '--format', '{{json .}}'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return JSON.parse(output) as RegistryImageInspection;
};
