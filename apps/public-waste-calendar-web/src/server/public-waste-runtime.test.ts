import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createPublicWasteRuntime } from './public-waste-runtime.js';

const createAssetsDir = async (): Promise<string> => {
  const assetsDir = await mkdtemp(join(tmpdir(), 'public-waste-runtime-'));
  await writeFile(join(assetsDir, 'index.html'), '<!doctype html><html><body>Public Waste</body></html>', 'utf8');
  return assetsDir;
};

const cleanupPaths = new Set<string>();

afterEach(async () => {
  await Promise.all([...cleanupPaths].map(async (path) => rm(path, { recursive: true, force: true })));
  cleanupPaths.clear();
});

describe('public waste runtime', () => {
  it('returns 200 for /health/live when config is valid', async () => {
    const assetsDir = await createAssetsDir();
    cleanupPaths.add(assetsDir);

    const runtime = await createPublicWasteRuntime({
      assetsDir,
      env: {
        PUBLIC_WASTE_INSTANCE_ID: 'bb-prignitz',
        PUBLIC_WASTE_DATABASE_URL: 'postgres://example',
        PUBLIC_WASTE_SCHEMA_NAME: 'public',
        PUBLIC_WASTE_PDF_URL_TEMPLATE: 'https://example.invalid/{locationKey}/{year}.pdf',
      },
    });

    const response = await runtime.handle(new Request('http://localhost/health/live'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      app: 'public-waste-calendar-web',
      instanceId: 'bb-prignitz',
    });

    await runtime.dispose();
  });

  it('returns 500 for API requests when runtime config is invalid', async () => {
    const assetsDir = await createAssetsDir();
    cleanupPaths.add(assetsDir);

    const runtime = await createPublicWasteRuntime({
      assetsDir,
      env: {},
    });

    const response = await runtime.handle(new Request('http://localhost/api/public-waste/selection'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'missing_config',
    });

    await runtime.dispose();
  });
});
