import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import prettier from 'prettier';
import { describe, expect, it } from 'vitest';

import {
  collectResourceAggregators,
  deriveResourceExportName,
  runI18nResourceFormatter,
} from './format-i18n-resources.ts';

const workspaceRoot = process.cwd();
const resourcesRoot = resolve(workspaceRoot, 'apps/sva-studio-react/src/i18n/resources');
const resolvePrettierOptions = async (filePath: string) => ({
  ...(await prettier.resolveConfig(filePath)),
  filepath: filePath,
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
});
