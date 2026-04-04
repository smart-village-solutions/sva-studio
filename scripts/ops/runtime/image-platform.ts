import { summarizeProcessOutput } from './process.ts';

export type ImagePlatform = Readonly<{
  architecture: string;
  os: string;
}>;

type ProcessRunner = (
  commandName: string,
  args: readonly string[],
  env?: NodeJS.ProcessEnv
) => {
  status: number | null;
  stdout: string;
  stderr: string;
};

type CommandExists = (commandName: string) => boolean;

type ManifestPlatformDescriptor = {
  architecture?: string;
  os?: string;
};

type ManifestDescriptor = {
  platform?: ManifestPlatformDescriptor;
};

const normalizePlatform = (value: ManifestPlatformDescriptor | undefined): ImagePlatform | null => {
  const os = value?.os?.trim();
  const architecture = value?.architecture?.trim();

  if (!os || !architecture) {
    return null;
  }

  return {
    os,
    architecture,
  };
};

const collectPlatforms = (value: unknown): ImagePlatform[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const platforms: ImagePlatform[] = [];
  const record = value as {
    Descriptor?: ManifestDescriptor;
    manifests?: Array<{ platform?: ManifestPlatformDescriptor }>;
  };

  const descriptorPlatform = normalizePlatform(record.Descriptor?.platform);
  if (descriptorPlatform) {
    platforms.push(descriptorPlatform);
  }

  if (Array.isArray(record.manifests)) {
    for (const manifest of record.manifests) {
      const platform = normalizePlatform(manifest.platform);
      if (platform) {
        platforms.push(platform);
      }
    }
  }

  return platforms;
};

export const parseImagePlatformsFromDockerManifestVerbose = (raw: string): readonly ImagePlatform[] => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('docker manifest inspect lieferte keine Daten.');
  }

  const parsed = JSON.parse(trimmed) as unknown;
  const platforms = Array.isArray(parsed) ? parsed.flatMap((entry) => collectPlatforms(entry)) : collectPlatforms(parsed);
  const uniquePlatforms = Array.from(
    new Map(platforms.map((platform) => [`${platform.os}/${platform.architecture}`, platform])).values()
  );

  if (uniquePlatforms.length === 0) {
    throw new Error('Die Image-Plattform konnte aus docker manifest inspect nicht bestimmt werden.');
  }

  return uniquePlatforms;
};

export const formatImagePlatforms = (platforms: readonly ImagePlatform[]) =>
  platforms.map((platform) => `${platform.os}/${platform.architecture}`).join(', ');

export const supportsRequiredImagePlatform = (
  platforms: readonly ImagePlatform[],
  requiredPlatform: ImagePlatform = { os: 'linux', architecture: 'amd64' }
) => platforms.some((platform) => platform.os === requiredPlatform.os && platform.architecture === requiredPlatform.architecture);

export const assertRequiredImagePlatform = (
  imageRef: string,
  platforms: readonly ImagePlatform[],
  requiredPlatform: ImagePlatform = { os: 'linux', architecture: 'amd64' }
) => {
  if (supportsRequiredImagePlatform(platforms, requiredPlatform)) {
    return;
  }

  throw new Error(
    `Image ${imageRef} unterstuetzt ${requiredPlatform.os}/${requiredPlatform.architecture} nicht. ` +
      `Gefunden: ${formatImagePlatforms(platforms)}. ` +
      `Baue und publishe das Artefakt explizit mit docker buildx build --platform ${requiredPlatform.os}/${requiredPlatform.architecture} --push.`
  );
};

export const inspectImagePlatforms = (
  imageRef: string,
  env: NodeJS.ProcessEnv,
  deps: {
    commandExists: CommandExists;
    runCaptureDetailed: ProcessRunner;
  }
): readonly ImagePlatform[] => {
  if (!deps.commandExists('docker')) {
    throw new Error('docker ist fuer die Image-Plattform-Pruefung nicht verfuegbar.');
  }

  const result = deps.runCaptureDetailed('docker', ['manifest', 'inspect', '-v', imageRef], env);
  if (result.status !== 0) {
    throw new Error(
      summarizeProcessOutput(`${result.stdout ?? ''}\n${result.stderr ?? ''}`) ||
        `docker manifest inspect fuer ${imageRef} ist fehlgeschlagen.`
    );
  }

  return parseImagePlatformsFromDockerManifestVerbose(result.stdout);
};
