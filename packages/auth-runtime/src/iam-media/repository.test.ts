import { describe, expect, it, vi } from 'vitest';

import { createWithMediaRepository } from './repository.js';

describe('media auth runtime repository wiring', () => {
  it('resolves the scoped db transaction and adapts SQL execution to the media repository', async () => {
    const execute = vi.fn(async () => ({
      listAssets: vi.fn(async () => ['asset-1']),
    }));
    const withDb = vi.fn(async (_resolvePool, instanceId, work) =>
      work({
        query: vi.fn(async (text: string, values?: readonly unknown[]) => {
          const repository = await execute({ text, values: values ?? [] });
          return {
            rowCount: 0,
            rows: [],
            repository,
          };
        }),
      })
    );

    const createRepository = vi.fn(() => ({
      listAssets: vi.fn(async () => ['asset-1']),
    }));

    const withMediaRepository = createWithMediaRepository({
      resolvePool: () => null,
      withDb,
      createRepository,
    });

    const result = await withMediaRepository('tenant-a', (repository) => repository.listAssets({ instanceId: 'tenant-a' }));

    expect(result).toEqual(['asset-1']);
    expect(withDb).toHaveBeenCalledOnce();
    expect(withDb).toHaveBeenCalledWith(expect.any(Function), 'tenant-a', expect.any(Function));
    expect(createRepository).toHaveBeenCalledOnce();
  });
});
