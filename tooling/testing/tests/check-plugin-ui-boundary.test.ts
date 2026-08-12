import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  checkPluginUiBoundary,
  checkPluginUiBoundarySource,
} from '../../../scripts/ci/check-plugin-ui-boundary.ts';

const temporaryDirectories: string[] = [];

describe('plugin UI boundary check', () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true }))
    );
  });

  it('ignores app-internal paths in comments and string literals', () => {
    const result = checkPluginUiBoundarySource(
      'packages/plugin-news/src/example.tsx',
      `
        // import { Button } from '../../../apps/sva-studio-react/src/components/ui/button';
        const documentation = "from '../../../apps/sva-studio-react/src/components/ui/button'";
      `
    );

    expect(result.hasAppInternalImport).toBe(false);
  });

  it('detects static and dynamic imports from app-internal sources', () => {
    expect(
      checkPluginUiBoundarySource(
        'packages/plugin-news/src/static.tsx',
        "import { Button } from './../../../apps/sva-studio-react/src/components/ui/button';"
      ).hasAppInternalImport
    ).toBe(true);

    expect(
      checkPluginUiBoundarySource(
        'packages/plugin-news/src/lazy.tsx',
        "const view = import('../../../apps/sva-studio-react/src/components/StudioDataTable');"
      ).hasAppInternalImport
    ).toBe(true);
  });

  it('detects re-exports from app-internal sources', () => {
    expect(
      checkPluginUiBoundarySource(
        'packages/plugin-news/src/reexport.tsx',
        "export { Button } from './../../../apps/sva-studio-react/src/components/ui/button';"
      ).hasAppInternalImport
    ).toBe(true);

    expect(
      checkPluginUiBoundarySource(
        'packages/plugin-news/src/reexport-all.tsx',
        "export * from '../../../apps/sva-studio-react/src/components/ui/button';"
      ).hasAppInternalImport
    ).toBe(true);
  });

  it('detects duplicate basis controls across common export forms', () => {
    const exportCases = [
      'export const Button = () => null;',
      'const Button = () => null; export { Button };',
      'const Button = () => null; export { Button as PluginButton };',
      'const PluginButton = () => null; export { PluginButton as Button };',
      'export default function Button() { return null; }',
      'const Button = () => null; export default Button;',
    ];

    for (const sourceCode of exportCases) {
      expect(
        checkPluginUiBoundarySource('packages/plugin-news/src/Button.tsx', sourceCode)
      ).toEqual({
        hasAppInternalImport: false,
        duplicateBasisControlExportName: 'Button',
      });
    }
  });

  it('rejects a parallel app-local Button implementation', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'studio-ui-boundary-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(path.join(projectRoot, 'packages'), { recursive: true });
    const buttonPath = path.join(projectRoot, 'apps/sva-studio-react/src/components/ui/button.tsx');
    await mkdir(path.dirname(buttonPath), { recursive: true });
    await writeFile(buttonPath, 'export const Button = () => null;\n', 'utf8');

    await expect(checkPluginUiBoundary(projectRoot)).resolves.toEqual([
      'apps/sva-studio-react/src/components/ui/button.tsx: dupliziert den kanonischen Button aus @sva/studio-ui-react',
    ]);
  });
});
