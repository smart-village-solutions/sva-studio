import { describe, expect, it, vi } from 'vitest';

import { createPublicWasteRepository } from './public-waste-repository.server.js';

describe('public waste repository', () => {
  it('lists only the next valid step options for a partially selected location', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'r-1', label: 'Prignitz' }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 's-1', label: 'Hauptstraße', is_catch_all: false }],
      });

    const repository = createPublicWasteRepository({
      schemaName: 'waste',
      execute,
    });

    await expect(
      repository.listSelectionOptions({
        selection: { regionId: 'r-1', cityId: 'c-1' },
      })
    ).resolves.toMatchObject({
      step: 'street',
      options: [{ id: 's-1', label: 'Hauptstraße' }],
    });
  });
});
