import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ensureTrailingSeparator = (value: string): string =>
  value.endsWith(path.sep) ? value : `${value}${path.sep}`;

const toAbsoluteFilePath = (baseDir: string, candidate: string): string => {
  if (candidate.startsWith('file://')) {
    return fileURLToPath(candidate);
  }

  if (path.isAbsolute(candidate)) {
    return path.normalize(candidate);
  }

  return fileURLToPath(new URL(candidate, pathToFileURL(ensureTrailingSeparator(baseDir))));
};

export const resolvePathFromBase = (baseDir: string, candidate: string): string =>
  toAbsoluteFilePath(baseDir, candidate);

export const resolvePathFromCwd = (candidate: string): string =>
  resolvePathFromBase(process.cwd(), candidate);

export const resolvePathWithin = (baseDir: string, candidate: string): string => {
  const absoluteBaseDir = path.normalize(baseDir);
  const absoluteCandidate = resolvePathFromBase(absoluteBaseDir, candidate);
  const relativePath = path.relative(absoluteBaseDir, absoluteCandidate);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Pfad "${candidate}" verlaesst den erlaubten Basisordner ${absoluteBaseDir}.`);
  }

  return absoluteCandidate;
};

export const isCliEntrypoint = (importMetaUrl: string, argvEntry: string | undefined): boolean =>
  argvEntry !== undefined && resolvePathFromCwd(argvEntry) === fileURLToPath(importMetaUrl);
