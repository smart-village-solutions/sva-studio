import fs from 'node:fs';
import path from 'node:path';

const nonExecutablePrefixes = [
  '//',
  '/*',
  '*',
  '*/',
  'import ',
  'export type ',
  'type ',
  'interface ',
  'declare ',
  'export {',
  'export interface ',
  'export declare ',
];
const nonExecutableExact = new Set(['{', '}', '};', '];', '),', ');', '}[];']);
const nonExecutablePatterns = [
  /^from\s+['"][^'"]+['"];?$/,
  /^['"`][^'"`]+['"`][;,]?$/,
  /^[A-Za-z_$][\w$]*,?$/,
  /^(readonly\s+)?[A-Za-z_$][\w$]*\??:\s.+;?$/,
  /^(export\s+)?type\s+[A-Za-z_$][\w$]*\s*=\s*.+;?$/,
  /^}[,\s]*from\s+['"][^'"]+['"];?$/,
];
const typeOnlyPrefixes = [
  '//',
  '/*',
  '*',
  '*/',
  'import type ',
  'export type ',
  'type ',
  'interface ',
  'export interface ',
  'declare ',
  'export declare ',
  'readonly ',
  'export {',
  'export * from ',
];
const typeOnlyExact = new Set(['{', '}', '};', '}[];']);
const typeOnlyPatterns = [
  /^(readonly\s+)?[A-Za-z_$][\w$]*\??:\s.+;?$/,
  /^(export\s+)?type\s+[A-Za-z_$][\w$]*\s*=\s*.+;?$/,
  /^(\||&)\s+['"`][^'"`]+['"`][;,]?$/,
  /^['"`][^'"`]+['"`][;,]?$/,
  /^from\s+['"][^'"]+['"];?$/,
  /^}[,\s]*from\s+['"][^'"]+['"];?$/,
  /^[A-Za-z_$][\w$]*,?$/,
];

export function isLikelyExecutableLine(sourceLine: string): boolean {
  const trimmed = sourceLine.trim();
  if (!trimmed) {
    return false;
  }

  return (
    !nonExecutableExact.has(trimmed) &&
    !nonExecutablePrefixes.some((prefix) => trimmed.startsWith(prefix)) &&
    !nonExecutablePatterns.some((pattern) => pattern.test(trimmed))
  );
}

function isLikelyTypeOnlyOrReexportLine(sourceLine: string): boolean {
  const trimmed = sourceLine.trim();
  return (
    !trimmed ||
    typeOnlyExact.has(trimmed) ||
    typeOnlyPrefixes.some((prefix) => trimmed.startsWith(prefix)) ||
    typeOnlyPatterns.some((pattern) => pattern.test(trimmed))
  );
}

function isLikelyGeneratedFile(filePath: string, sourceLines: readonly string[]): boolean {
  const normalizedPath = filePath.replaceAll('\\', '/');
  if (
    normalizedPath.endsWith('.gen.ts') ||
    normalizedPath.endsWith('.gen.tsx') ||
    normalizedPath.endsWith('.generated.ts') ||
    normalizedPath.endsWith('.generated.tsx')
  ) {
    return true;
  }

  const leadingLines = sourceLines
    .slice(0, 12)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

  return (
    leadingLines.includes('This file was automatically generated') ||
    leadingLines.includes('You should NOT make any changes in this file')
  );
}

export function isLikelyNonExecutableFile(
  filePath: string,
  sourceLines: readonly string[]
): boolean {
  if (isLikelyGeneratedFile(filePath, sourceLines)) {
    return true;
  }

  const significantLines = sourceLines.map((line) => line.trim()).filter(Boolean);
  if (significantLines.length === 0) {
    return true;
  }

  return significantLines.every(isLikelyTypeOnlyOrReexportLine);
}

export function readSourceLines(rootDir: string, filePath: string): string[] {
  const absoluteFilePath = path.join(rootDir, filePath);
  if (!fs.existsSync(absoluteFilePath)) {
    return [];
  }

  return fs.readFileSync(absoluteFilePath, 'utf8').split('\n');
}
