import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');

export function toPortableArtifactPath(filePath: string, cwd: string = repoRoot): string {
  if (isAbsolute(filePath) === false) {
    return filePath;
  }

  const relativePath = relative(cwd, filePath);

  if (relativePath === '') {
    return '.';
  }

  return relativePath.split(sep).join('/');
}
