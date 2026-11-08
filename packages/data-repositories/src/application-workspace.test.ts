import { describe, expect, it, vi } from 'vitest';
import { readApplicationWorkspace, saveApplicationWorkspace } from './application-workspace.js';
import type { CatalogSqlClient } from './app-translations-context.js';

const fixture = () => {
  const query = vi.fn<CatalogSqlClient['query']>();
  return { query, client: { query } satisfies CatalogSqlClient };
};
describe('application workspace repository outcomes', () => {
  it('distinguishes a new workspace from a persisted configuration and scopes reads', async () => {
    const { client, query } = fixture();
    const stored = { version: 4, tiles: [{ id: 'calendar' }] };
    query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [stored], rowCount: 1 });
    await expect(readApplicationWorkspace(client, 'first')).resolves.toEqual({
      version: 0,
      tiles: [],
    });
    await expect(readApplicationWorkspace(client, 'second')).resolves.toBe(stored);
    expect(query.mock.calls.map((call) => call[1])).toEqual([['first'], ['second']]);
  });
  it.each([0, 7])(
    'returns the authoritative database result when saving revision %s',
    async (version) => {
      const { client, query } = fixture();
      const configuration = {
        version,
        tiles: [{ id: 'calendar', url: 'https://calendar.example' }],
      };
      const stored = { ...configuration, version: version + 1 };
      query.mockResolvedValue({ rows: [stored], rowCount: 1 });
      await expect(saveApplicationWorkspace(client, 'municipality', configuration)).resolves.toBe(
        stored
      );
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0]?.[1]).toEqual(
        version === 0
          ? ['municipality', JSON.stringify(configuration.tiles)]
          : ['municipality', version, JSON.stringify(configuration.tiles)]
      );
    }
  );
  it.each([0, 7])('reports a CAS conflict without retrying revision %s', async (version) => {
    const { client, query } = fixture();
    query.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(
      saveApplicationWorkspace(client, 'municipality', { version, tiles: [] })
    ).rejects.toThrow('workspace_version_conflict');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('preserves a database failure instead of misclassifying it as a conflict', async () => {
    const { client, query } = fixture();
    const failure = new Error('connection unavailable');
    query.mockRejectedValue(failure);
    await expect(
      saveApplicationWorkspace(client, 'municipality', { version: 1, tiles: [] })
    ).rejects.toBe(failure);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
