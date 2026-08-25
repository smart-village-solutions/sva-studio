import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import * as ts from 'typescript';

const runtimeExtensions = new Set(['.cjs', '.js', '.json', '.mjs']);

const collectRuntimeSpecifiers = (filePath: string, sourceText: string): readonly string[] => {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const specifiers: string[] = [];

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return specifiers;
};

const resolveRuntimeImport = (importerPath: string, specifier: string): string | null => {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const cleanSpecifier = specifier.replace(/[?#].*$/, '');
  const candidate = resolve(dirname(importerPath), cleanSpecifier);
  const candidates = extname(candidate)
    ? [candidate]
    : [candidate, ...[...runtimeExtensions].map((extension) => `${candidate}${extension}`)];

  for (const path of candidates) {
    if (existsSync(path) && statSync(path).isFile()) {
      return path;
    }
  }

  throw new Error(`Lokaler Runtime-Import kann nicht aufgelöst werden: ${specifier} aus ${importerPath}`);
};

const isWithinDirectory = (parentDirectory: string, filePath: string): boolean => {
  const relativePath = relative(parentDirectory, filePath);
  return relativePath !== '..' && !relativePath.startsWith(`..${sep}`);
};

const stripKnownOptionalJsxDevReferences = (sourceText: string): string => {
  const regionStartPattern =
    /^\/\/#region .*\/node_modules\/hast-util-to-jsx-runtime\/lib\/index\.js\r?$/mu;
  const regionStartMatch = regionStartPattern.exec(sourceText);
  if (!regionStartMatch) {
    return sourceText;
  }

  const regionEndIndex = sourceText.indexOf('//#endregion', regionStartMatch.index);
  if (regionEndIndex < 0) {
    return sourceText;
  }

  const regionEndOffset = regionEndIndex + '//#endregion'.length;
  const helperRegion = sourceText.slice(regionStartMatch.index, regionEndOffset);
  const knownOptionalReferencePatterns = [
    /^\s*if \(typeof options\.jsxDEV !== "function"\) throw new TypeError\("Expected `jsxDEV` in options when `development: true`"\);\s*$/u,
    /^\s*create = developmentCreate\(filePath, options\.jsxDEV\);\s*$/u,
    /^\s*\* @param \{JsxDev\} jsxDEV\s*$/u,
    /^\s*function developmentCreate\(filePath, jsxDEV\) \{\s*$/u,
    /^\s*return jsxDEV\(type, props, key, isStaticChildren, \{\s*$/u,
  ];
  const guardedHelperRegion = helperRegion
    .split(/\r?\n/u)
    .map((line) =>
      line.includes('jsxDEV') && knownOptionalReferencePatterns.some((pattern) => pattern.test(line))
        ? line.replaceAll('jsxDEV', 'jsxOptionalDevelopmentHelper')
        : line
    )
    .join('\n');

  return `${sourceText.slice(0, regionStartMatch.index)}${guardedHelperRegion}${sourceText.slice(
    regionEndOffset
  )}`;
};

export const checkProductionJsxRuntime = (appDirectoryInput: string): readonly string[] => {
  const appDirectory = resolve(appDirectoryInput);
  const serverDirectory = resolve(appDirectory, '.output/server');
  const serverEntryPath = resolve(serverDirectory, 'index.mjs');
  const otelPreloadServerPath = resolve(serverDirectory, 'chunks/_/server.mjs');
  const recoveryServerPath = resolve(serverDirectory, 'chunks/build/server.mjs');

  if (!existsSync(serverEntryPath)) {
    throw new Error(`Finaler Server-Entry fehlt: ${serverEntryPath}`);
  }

  const pendingPaths = [serverEntryPath];
  for (const optionalRuntimeRoot of [otelPreloadServerPath, recoveryServerPath]) {
    if (existsSync(optionalRuntimeRoot)) {
      pendingPaths.push(optionalRuntimeRoot);
    }
  }
  const reachablePaths = new Set<string>();

  while (pendingPaths.length > 0) {
    const filePath = pendingPaths.pop();
    if (!filePath || reachablePaths.has(filePath)) {
      continue;
    }
    if (!isWithinDirectory(serverDirectory, filePath)) {
      throw new Error(`Runtime-Import verlässt das Server-Artefakt: ${filePath}`);
    }

    reachablePaths.add(filePath);
    if (!runtimeExtensions.has(extname(filePath)) || extname(filePath) === '.json') {
      continue;
    }

    const sourceText = readFileSync(filePath, 'utf8');
    const guardedSourceText = stripKnownOptionalJsxDevReferences(sourceText);
    if (guardedSourceText.includes('jsx-dev-runtime')) {
      throw new Error(`Erreichbarer Server-Output enthält React Development-JSX: ${filePath}`);
    }
    if (guardedSourceText.includes('jsxDEV')) {
      throw new Error(`Erreichbarer Server-Output enthält React Development-JSX: ${filePath}`);
    }

    for (const specifier of collectRuntimeSpecifiers(filePath, sourceText)) {
      const importedPath = resolveRuntimeImport(filePath, specifier);
      if (importedPath && !reachablePaths.has(importedPath)) {
        pendingPaths.push(importedPath);
      }
    }
  }

  return [...reachablePaths].sort();
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const reachablePaths = checkProductionJsxRuntime(process.argv[2] ?? 'apps/sva-studio-react');
    process.stdout.write(`Production-JSX-Runtime-Guard geprüft: ${reachablePaths.length} erreichbare Dateien.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
