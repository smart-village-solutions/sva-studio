import { describe, expect, it } from 'vitest';

import { rewriteReactShimRequires } from './patch-runtime-artifact.js';

const bundledShim = `import { l as require_react } from "../_libs/react.mjs";
//#region use-sync-external-store-shim/with-selector.production.js
var React1 = __require("react");
var React2 = __require("react");`;

describe('SSR React shim artifact', () => {
  it('uses the renderer React instance for both shim hooks', () => {
    const patched = rewriteReactShimRequires(bundledShim);
    expect(patched).not.toContain('__require("react")');
    expect(patched.match(/require_react\(\)/g)).toHaveLength(2);
  });

  it('fails when the bundler changes the shim contract', () => {
    expect(() => rewriteReactShimRequires(bundledShim.replace('var React2 = __require("react");', ''))).toThrow(
      'SSR-React-Shim-Vertrag geaendert'
    );
    expect(() => rewriteReactShimRequires(bundledShim.replace('as require_react', 'as other_react'))).toThrow(
      'SSR-React-Shim-Vertrag geaendert'
    );
  });
});
