import { isAbsolute, relative, sep } from 'node:path';

export function toPortableArtifactPath(filePath: string, cwd: string = process.cwd()): string {
  if (isAbsolute(filePath) === false) {
    return filePath;
  }

  const relativePath = relative(cwd, filePath);

  if (relativePath === '') {
    return '.';
  }

  return relativePath.split(sep).join('/');
}
