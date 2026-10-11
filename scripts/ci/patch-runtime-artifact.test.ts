import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { patchReactShimRequires, rewriteReactShimRequires } from './patch-runtime-artifact.js';

const temporaryDirs: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const bundledShim = `import { l as require_react } from "../_libs/react.mjs";
//#region use-sync-external-store-shim/with-selector.production.js
var React1 = __require("react");
var React2 = __require("react");`;
const bundledLibraryShim = `import { l as require_react } from "../_libs/react.mjs";
//#region use-sync-external-store-shim/with-selector.production.js
var React = require_react();
//#endregion`;

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

  it('accepts a shim moved into libraries only when React is already bundled safely', async () => {
    const serverDir = await mkdtemp(path.join(tmpdir(), 'studio-react-shim-'));
    temporaryDirs.push(serverDir);
    await mkdir(path.join(serverDir, '_ssr'));
    await mkdir(path.join(serverDir, '_libs'));
    const libraryPath = path.join(serverDir, '_libs', 'router.mjs');
    await writeFile(libraryPath, bundledLibraryShim);

    await expect(patchReactShimRequires(serverDir)).resolves.toBeUndefined();

    await writeFile(libraryPath, bundledLibraryShim.replace('var React = require_react();', "var React = __require('react');"));
    await expect(patchReactShimRequires(serverDir)).rejects.toThrow('SSR-React-Shim-Vertrag geaendert');

    await writeFile(libraryPath, bundledLibraryShim.replace('as require_react', 'as other_react'));
    await expect(patchReactShimRequires(serverDir)).rejects.toThrow('SSR-React-Shim-Vertrag geaendert');

    await writeFile(libraryPath, bundledLibraryShim.replace('var React = require_react();', 'var React = other_react();'));
    await expect(patchReactShimRequires(serverDir)).rejects.toThrow('SSR-React-Shim-Vertrag geaendert');
  });

  it('still patches the shim in an SSR chunk', async () => {
    const serverDir = await mkdtemp(path.join(tmpdir(), 'studio-react-shim-'));
    temporaryDirs.push(serverDir);
    await mkdir(path.join(serverDir, '_ssr'));
    const chunkPath = path.join(serverDir, '_ssr', 'entry.mjs');
    await writeFile(chunkPath, bundledShim);

    await patchReactShimRequires(serverDir);

    expect(await readFile(chunkPath, 'utf8')).toContain('var React1 = require_react();');
  });
});
