import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import prettier from 'prettier';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, '../..');
const resourcesRoot = resolve(workspaceRoot, 'apps/sva-studio-react/src/i18n/resources');
const localePattern = /^[a-z]{2}$/;

type AggregatorEntry = {
  readonly key: string;
  readonly importPath: string;
  readonly importName: string;
};

type AggregatorDefinition = {
  readonly filePath: string;
  readonly exportName: string;
  readonly entries: readonly AggregatorEntry[];
};

const toPosixPath = (value: string): string => value.split(sep).join('/');

const toPascalCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const stripResourceSuffix = (fileName: string): string => fileName.replace(/\.resources\.ts$/, '');

export const deriveResourceExportName = (locale: string, relativeResourcePath: string): string => {
  const normalizedPath = toPosixPath(relativeResourcePath);
  const pathSegments = normalizedPath.split('/').filter(Boolean);

  if (pathSegments.length === 1 && pathSegments[0] === `${locale}.ts`) {
    return `${locale}Resources`;
  }

  const lastSegment = pathSegments[pathSegments.length - 1];
  if (!lastSegment) {
    throw new Error(`Invalid resource path: ${relativeResourcePath}`);
  }

  const fileBaseName = lastSegment.endsWith('.resources.ts')
    ? stripResourceSuffix(lastSegment)
    : lastSegment.replace(/\.ts$/, '');

  const parentSegments = pathSegments.slice(0, -1).filter((segment) => segment !== locale);
  const orderedSegments = [fileBaseName, ...parentSegments.reverse()];

  return `${orderedSegments[0]}${orderedSegments.slice(1).map(toPascalCase).join('')}${locale.toUpperCase()}Resources`;
};

const buildImportPath = (fromFilePath: string, targetFilePath: string): string => {
  const fromDirPath = dirname(fromFilePath);
  const relativeImportPath = relative(fromDirPath, targetFilePath);
  const normalizedPath = toPosixPath(relativeImportPath).replace(/\.ts$/, '.js');
  return normalizedPath.startsWith('.') ? normalizedPath : `./${normalizedPath}`;
};

const renderAggregatorSource = (definition: AggregatorDefinition): string => {
  const importLines = definition.entries.map(
    (entry) => `import { ${entry.importName} } from '${entry.importPath}';`
  );
  const propertyLines = definition.entries.map((entry) => `  ${entry.key}: ${entry.importName},`);

  const sections = [
    importLines.join('\n'),
    `export const ${definition.exportName} = {\n${propertyLines.join('\n')}\n} as const;`,
  ].filter(Boolean);

  return `${sections.join('\n\n')}\n`;
};

const resolvePrettierOptions = async (filePath: string) => {
  const resolvedOptions = await prettier.resolveConfig(filePath);
  return { ...(resolvedOptions ?? {}), filepath: filePath };
};

const formatTypeScript = async (filePath: string, sourceText: string): Promise<string> =>
  prettier.format(sourceText, await resolvePrettierOptions(filePath));

const writeIfChanged = async (
  filePath: string,
  sourceText: string,
  checkOnly: boolean
): Promise<boolean> => {
  const existingText = await readFile(filePath, 'utf8').catch((error: unknown) => {
    if (
      error instanceof Error &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code === 'ENOENT'
    ) {
      return null;
    }

    throw error;
  });

  if (existingText === sourceText) {
    return false;
  }

  if (!checkOnly) {
    await writeFile(filePath, sourceText, 'utf8');
  }

  return true;
};

const listChildFiles = async (directoryPath: string): Promise<readonly string[]> => {
  const childEntries = await readdir(directoryPath, { withFileTypes: true });

  return childEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
};

const listChildDirectories = async (directoryPath: string): Promise<readonly string[]> => {
  const childEntries = await readdir(directoryPath, { withFileTypes: true });

  return childEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
};

const buildDirectoryAggregator = async (
  locale: string,
  directoryPath: string,
  rootDirectoryPath: string,
  childAggregatorDefinitions: readonly AggregatorDefinition[]
): Promise<AggregatorDefinition | null> => {
  const childFileNames = await listChildFiles(directoryPath);
  const resourceFileNames = childFileNames.filter((fileName) => fileName.endsWith('.resources.ts'));
  const directResourceKeys = new Set(resourceFileNames.map((fileName) => stripResourceSuffix(fileName)));
  const childAggregatorEntries = childAggregatorDefinitions.map((definition) => ({
    key: stripResourceSuffix(basename(definition.filePath)),
    importPath: buildImportPath(filePathForDirectory(locale, directoryPath, rootDirectoryPath), definition.filePath),
    importName: definition.exportName,
  }))
    .filter((entry) => !directResourceKeys.has(entry.key));

  if (resourceFileNames.length === 0 && childAggregatorEntries.length === 0) {
    return null;
  }

  const relativeDirectoryPath = relative(rootDirectoryPath, directoryPath);
  const normalizedDirectoryPath = toPosixPath(relativeDirectoryPath);
  const filePath = filePathForDirectory(locale, directoryPath, rootDirectoryPath);

  const relativeAggregatorPath = toPosixPath(relative(rootDirectoryPath, filePath));
  const resourceEntries = resourceFileNames.map((fileName) => {
    const targetFilePath = join(directoryPath, fileName);
    const relativeTargetPath = toPosixPath(relative(rootDirectoryPath, targetFilePath));

    return {
      key: stripResourceSuffix(fileName),
      importPath: buildImportPath(filePath, targetFilePath),
      importName: deriveResourceExportName(locale, relativeTargetPath),
    } satisfies AggregatorEntry;
  });
  const entries = [...resourceEntries, ...childAggregatorEntries].sort((left, right) =>
    left.key.localeCompare(right.key)
  );

  return {
    filePath,
    exportName: deriveResourceExportName(locale, relativeAggregatorPath),
    entries,
  } satisfies AggregatorDefinition;
};

const filePathForDirectory = (
  locale: string,
  directoryPath: string,
  rootDirectoryPath: string
): string => {
  const relativeDirectoryPath = relative(rootDirectoryPath, directoryPath);
  const normalizedDirectoryPath = toPosixPath(relativeDirectoryPath);
  const directorySegments = normalizedDirectoryPath.split('/').filter(Boolean);

  return directorySegments.length === 1 && directorySegments[0] === locale
    ? join(rootDirectoryPath, `${locale}.ts`)
    : join(dirname(directoryPath), `${basename(directoryPath)}.resources.ts`);
};

const buildLocaleAggregators = async (
  locale: string,
  directoryPath: string,
  rootDirectoryPath: string
): Promise<readonly AggregatorDefinition[]> => {
  const childDirectoryNames = await listChildDirectories(directoryPath);
  const nestedDefinitions = await Promise.all(
    childDirectoryNames.map((childDirectoryName) =>
      buildLocaleAggregators(locale, join(directoryPath, childDirectoryName), rootDirectoryPath)
    )
  );

  const flattenedDefinitions = nestedDefinitions.flat();
  const childAggregatorDefinitions = childDirectoryNames
    .map((childDirectoryName, index) => {
      const childAggregatorPath = join(directoryPath, `${childDirectoryName}.resources.ts`);
      return nestedDefinitions[index]?.find((definition) => definition.filePath === childAggregatorPath) ?? null;
    })
    .filter((definition): definition is AggregatorDefinition => definition !== null);
  const currentDefinition = await buildDirectoryAggregator(
    locale,
    directoryPath,
    rootDirectoryPath,
    childAggregatorDefinitions
  );

  return currentDefinition ? [...flattenedDefinitions, currentDefinition] : flattenedDefinitions;
};

export const collectResourceAggregators = async (
  rootDirectoryPath: string = resourcesRoot
): Promise<readonly AggregatorDefinition[]> => {
  const childEntries = await readdir(rootDirectoryPath, { withFileTypes: true });
  const localeDirectoryNames = childEntries
    .filter((entry) => entry.isDirectory() && localePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const localeDefinitions = await Promise.all(
    localeDirectoryNames.map((locale) =>
      buildLocaleAggregators(locale, join(rootDirectoryPath, locale), rootDirectoryPath)
    )
  );

  return localeDefinitions.flat();
};

const collectTypeScriptFiles = async (directoryPath: string): Promise<readonly string[]> => {
  const childEntries = await readdir(directoryPath, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    childEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => collectTypeScriptFiles(join(directoryPath, entry.name)))
  );

  const directFiles = childEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => join(directoryPath, entry.name));

  return [...directFiles, ...nestedFiles.flat()].sort((left, right) => left.localeCompare(right));
};

export const runI18nResourceFormatter = async ({
  checkOnly = false,
  rootDirectoryPath = resourcesRoot,
}: {
  readonly checkOnly?: boolean;
  readonly rootDirectoryPath?: string;
} = {}): Promise<readonly string[]> => {
  const changedFilePaths: string[] = [];
  const aggregatorDefinitions = await collectResourceAggregators(rootDirectoryPath);

  for (const definition of aggregatorDefinitions) {
    const formattedSource = await formatTypeScript(definition.filePath, renderAggregatorSource(definition));
    const wasChanged = await writeIfChanged(definition.filePath, formattedSource, checkOnly);

    if (wasChanged) {
      changedFilePaths.push(definition.filePath);
    }
  }

  const resourceFilePaths = await collectTypeScriptFiles(rootDirectoryPath);

  for (const resourceFilePath of resourceFilePaths) {
    const sourceText = await readFile(resourceFilePath, 'utf8');
    const formattedSource = await formatTypeScript(resourceFilePath, sourceText);
    const wasChanged = await writeIfChanged(resourceFilePath, formattedSource, checkOnly);

    if (wasChanged && !changedFilePaths.includes(resourceFilePath)) {
      changedFilePaths.push(resourceFilePath);
    }
  }

  return changedFilePaths.sort((left, right) => left.localeCompare(right));
};

const main = async (): Promise<void> => {
  const checkOnly = process.argv.includes('--check');
  const changedFilePaths = await runI18nResourceFormatter({ checkOnly });

  if (changedFilePaths.length === 0) {
    process.stdout.write(`i18n resources ${checkOnly ? 'already match' : 'formatted'}\n`);
    return;
  }

  const relativeChangedPaths = changedFilePaths.map((filePath) => relative(workspaceRoot, filePath));

  if (checkOnly) {
    process.stderr.write(
      `i18n resources need formatting:\n${relativeChangedPaths.map((filePath) => `- ${filePath}`).join('\n')}\n`
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `formatted i18n resources:\n${relativeChangedPaths.map((filePath) => `- ${filePath}`).join('\n')}\n`
  );
};

const isDirectExecution =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
