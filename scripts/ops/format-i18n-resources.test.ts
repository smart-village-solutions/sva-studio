import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import prettier from 'prettier';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  collectResourceAggregators,
  deriveResourceExportName,
  runI18nResourceFormatter,
} from './format-i18n-resources.ts';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const resourcesRoot = resolve(workspaceRoot, 'apps/sva-studio-react/src/i18n/resources');
const resolvePrettierOptions = async (filePath: string) => ({
  ...((await prettier.resolveConfig(filePath)) ?? {}),
  filepath: filePath,
});
const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories.splice(0).map((directoryPath) => rm(directoryPath, { recursive: true, force: true }))
  );
});

describe('deriveResourceExportName', () => {
  it('derives leaf, nested, and locale aggregator export names', () => {
    expect(deriveResourceExportName('de', 'de/shell.resources.ts')).toBe('shellDEResources');
    expect(deriveResourceExportName('en', 'en/account/profile.resources.ts')).toBe('profileAccountENResources');
    expect(deriveResourceExportName('en', 'en/admin/instances/page.resources.ts')).toBe(
      'pageInstancesAdminENResources'
    );
    expect(deriveResourceExportName('de', 'de.ts')).toBe('deResources');
  });
});

describe('collectResourceAggregators', () => {
  it('finds deterministic aggregator files for the current locale tree', async () => {
    const definitions = await collectResourceAggregators();
    const relativeDefinitionPaths = definitions.map((definition) => relative(resourcesRoot, definition.filePath));

    expect(relativeDefinitionPaths).toContain('de.ts');
    expect(relativeDefinitionPaths).toContain('de/account.resources.ts');
    expect(relativeDefinitionPaths).toContain('de/admin.resources.ts');
    expect(relativeDefinitionPaths).toContain('de/admin/instances.resources.ts');
    expect(relativeDefinitionPaths).toContain('en.ts');
    expect(relativeDefinitionPaths).toContain('en/account.resources.ts');
    expect(relativeDefinitionPaths).toContain('en/admin.resources.ts');
    expect(relativeDefinitionPaths).toContain('en/admin/instances.resources.ts');
  });

  it('matches the committed aggregator file contents', async () => {
    const definitions = await collectResourceAggregators();

    await Promise.all(
      definitions.map(async (definition) => {
        const actualSource = await readFile(definition.filePath, 'utf8');
        const expectedSource = await prettier.format(
          [
            ...definition.entries.map(
              (entry) => `import { ${entry.importName} } from '${entry.importPath}';`
            ),
            '',
            `export const ${definition.exportName} = {`,
            ...definition.entries.map((entry) => `  ${entry.key}: ${entry.importName},`),
            '} as const;',
            '',
          ].join('\n'),
          await resolvePrettierOptions(definition.filePath)
        );

        expect(actualSource).toBe(expectedSource);
      })
    );
  });
});

describe('runI18nResourceFormatter', () => {
  it('is idempotent in check mode', async () => {
    await expect(runI18nResourceFormatter({ checkOnly: true })).resolves.toEqual([]);
  });

  it('creates missing aggregator files for nested resource directories', async () => {
    const temporaryRoot = await mkdtemp(resolve(workspaceRoot, '.tmp-format-i18n-'));
    temporaryDirectories.push(temporaryRoot);

    const testResourcesRoot = resolve(temporaryRoot, 'resources');
    const nestedDirectory = resolve(testResourcesRoot, 'de/foo');
    await mkdir(nestedDirectory, { recursive: true });
    await writeFile(
      resolve(nestedDirectory, 'bar.resources.ts'),
      "export const barFooDEResources = { value: 'bar' } as const;\n",
      'utf8'
    );

    const changedFilePaths = await runI18nResourceFormatter({
      rootDirectoryPath: testResourcesRoot,
    });
    const aggregatorPath = resolve(testResourcesRoot, 'de/foo.resources.ts');
    const localeAggregatorPath = resolve(testResourcesRoot, 'de.ts');

    expect(changedFilePaths).toContain(aggregatorPath);
    expect(changedFilePaths).toContain(localeAggregatorPath);
    await expect(readFile(aggregatorPath, 'utf8')).resolves.toContain(
      "import { barFooDEResources } from './foo/bar.resources.js';"
    );
    await expect(readFile(localeAggregatorPath, 'utf8')).resolves.toContain(
      "import { fooDEResources } from './de/foo.resources.js';"
    );
  });
});
