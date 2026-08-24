import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { pluginCategories } from '../../packages/plugin-categories/src/plugin.tsx';
import { pluginCockpitCards } from '../../packages/plugin-cockpit-cards/src/plugin.tsx';
import { pluginEvents } from '../../packages/plugin-events/src/plugin.tsx';
import { pluginFaq } from '../../packages/plugin-faq/src/plugin.tsx';
import { pluginGenericItems } from '../../packages/plugin-generic-items/src/plugin.tsx';
import { pluginNews } from '../../packages/plugin-news/src/plugin.tsx';
import { pluginPoi } from '../../packages/plugin-poi/src/plugin.tsx';
import { pluginProjects } from '../../packages/plugin-projects/src/plugin.tsx';
import { pluginSurveys } from '../../packages/plugin-surveys/src/plugin.tsx';
import { pluginWasteManagement } from '../../packages/plugin-waste-management/src/plugin.tsx';
import {
  collectDocumentationPageCatalog,
  type AppRouteBindings,
} from '../../packages/routing/src/index.ts';
import { appAdminResources } from '../../apps/sva-studio-react/src/routing/admin-resources.ts';

const outputPath = resolve('docs/user-documentation/page-catalog.json');
const component = () => null;
const bindings = new Proxy(
  {},
  {
    get: () => component,
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true, value: component }),
  }
) as AppRouteBindings;

const plugins = [
  pluginCategories,
  pluginNews,
  pluginEvents,
  pluginPoi,
  pluginGenericItems,
  pluginFaq,
  pluginCockpitCards,
  pluginProjects,
  pluginSurveys,
  pluginWasteManagement,
] as const;

export const createDocumentationPageCatalogJson = (): string =>
  `${JSON.stringify(
    collectDocumentationPageCatalog({ bindings, adminResources: appAdminResources, plugins }),
    null,
    2
  )}\n`;

const run = async (): Promise<void> => {
  const mode = process.argv[2];
  const generated = createDocumentationPageCatalogJson();
  if (mode === '--write') {
    await writeFile(outputPath, generated, 'utf8');
    return;
  }
  if (mode === '--check') {
    const current = await readFile(outputPath, 'utf8').catch(() => '');
    if (current !== generated) {
      throw new Error('documentation_page_catalog_outdated');
    }
    return;
  }
  throw new Error('usage: generate-documentation-page-catalog.ts --write|--check');
};

void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
