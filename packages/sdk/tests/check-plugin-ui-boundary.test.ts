import { describe, expect, it } from 'vitest';

import { checkPluginUiBoundarySource } from '../../../scripts/ci/check-plugin-ui-boundary.ts';

describe('plugin UI boundary check', () => {
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
        "import { Button } from '../../../apps/sva-studio-react/src/components/ui/button';"
      ).hasAppInternalImport
    ).toBe(true);

    expect(
      checkPluginUiBoundarySource(
        'packages/plugin-news/src/lazy.tsx',
        "const view = import('../../../apps/sva-studio-react/src/components/StudioDataTable');"
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
      expect(checkPluginUiBoundarySource('packages/plugin-news/src/Button.tsx', sourceCode)).toEqual({
        hasAppInternalImport: false,
        duplicateBasisControlExportName: 'Button',
      });
    }
  });
});
