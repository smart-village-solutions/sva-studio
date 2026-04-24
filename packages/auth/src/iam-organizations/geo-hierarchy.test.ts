import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../iam-account-management/shared', () => ({
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-x', traceId: 'trace-x', workspaceId: 'ws-x' }),
  withRequestContext: (_opts: unknown, fn: () => Promise<unknown>) => fn(),
}));

import { withInstanceScopedDb } from '../iam-account-management/shared';
import {
  getGeoAncestors,
  getGeoDepth,
  getGeoDescendants,
  getGeoNodes,
  isGeoAncestorOf,
  listGeoNodes,
} from './geo-hierarchy';

const mockWithDb = withInstanceScopedDb as ReturnType<typeof vi.fn>;

const makeClient = (rows: unknown[] = []) => ({
  query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getGeoAncestors
// ---------------------------------------------------------------------------
describe('getGeoAncestors', () => {
  it('gibt Vorfahren zurück und mappt sie korrekt', async () => {
    const rows = [
      { ancestor_id: 'anc-1', descendant_id: 'desc-1', depth: 0 },
      { ancestor_id: 'anc-2', descendant_id: 'desc-1', depth: 1 },
    ];
    const client = makeClient(rows);
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) => fn(client));

    const result = await getGeoAncestors('inst-1', 'desc-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ancestorId: 'anc-1', descendantId: 'desc-1', depth: 0 });
    expect(result[1]).toEqual({ ancestorId: 'anc-2', descendantId: 'desc-1', depth: 1 });

    const [sql, params] = client.query.mock.calls[0]!;
    expect(sql).toContain('geo_hierarchy');
    expect(params[0]).toBe('desc-1');
  });

  it('gibt leeres Array zurück wenn keine Vorfahren', async () => {
    const client = makeClient([]);
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) => fn(client));
    const result = await getGeoAncestors('inst-1', 'node-x');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getGeoDescendants
// ---------------------------------------------------------------------------
describe('getGeoDescendants', () => {
  it('gibt Nachfahren zurück und mappt sie korrekt', async () => {
    const rows = [
      { ancestor_id: 'root', descendant_id: 'child-1', depth: 1 },
      { ancestor_id: 'root', descendant_id: 'child-2', depth: 2 },
    ];
    const client = makeClient(rows);
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) => fn(client));

    const result = await getGeoDescendants('inst-1', 'root');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ancestorId: 'root', descendantId: 'child-1', depth: 1 });

    const params = client.query.mock.calls[0]![1];
    expect(params[0]).toBe('root');
  });
});

// ---------------------------------------------------------------------------
// getGeoNodes
// ---------------------------------------------------------------------------
describe('getGeoNodes', () => {
  it('gibt leeres Array zurück wenn nodeIds leer ist (kein DB-Aufruf)', async () => {
    const result = await getGeoNodes('inst-1', []);
    expect(result).toEqual([]);
    expect(mockWithDb).not.toHaveBeenCalled();
  });

  it('mappt GeoNode-Rows korrekt', async () => {
    const rows = [
      { id: 'n1', instance_id: 'inst-1', key: 'region-a', display_name: 'Region A', node_type: 'region' },
    ];
    const client = makeClient(rows);
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) => fn(client));

    const result = await getGeoNodes('inst-1', ['n1']);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'n1',
      instanceId: 'inst-1',
      key: 'region-a',
      displayName: 'Region A',
      nodeType: 'region',
    });

    const params = client.query.mock.calls[0]![1];
    expect(params[0]).toBe('inst-1');
    expect(params[1]).toEqual(['n1']);
  });

  it('gibt mehrere Nodes zurück', async () => {
    const rows = [
      { id: 'n1', instance_id: 'inst-1', key: 'a', display_name: 'A', node_type: 'district' },
      { id: 'n2', instance_id: 'inst-1', key: 'b', display_name: 'B', node_type: 'city' },
    ];
    const client = makeClient(rows);
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) => fn(client));

    const result = await getGeoNodes('inst-1', ['n1', 'n2']);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// listGeoNodes
// ---------------------------------------------------------------------------
describe('listGeoNodes', () => {
  it('gibt alle Nodes einer Instanz zurück', async () => {
    const rows = [
      { id: 'n1', instance_id: 'inst-2', key: 'x', display_name: 'X', node_type: 'region' },
      { id: 'n2', instance_id: 'inst-2', key: 'y', display_name: 'Y', node_type: 'city' },
    ];
    const client = makeClient(rows);
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) => fn(client));

    const result = await listGeoNodes('inst-2');

    expect(result).toHaveLength(2);
    const params = client.query.mock.calls[0]![1];
    expect(params[0]).toBe('inst-2');
  });

  it('gibt leeres Array zurück wenn keine Nodes vorhanden', async () => {
    const client = makeClient([]);
    mockWithDb.mockImplementation((_id: string, fn: (c: unknown) => unknown) => fn(client));
    const result = await listGeoNodes('inst-3');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isGeoAncestorOf
// ---------------------------------------------------------------------------
describe('isGeoAncestorOf', () => {
  it('gibt true zurück wenn Vorfahren-Beziehung existiert', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ exists: true }], rowCount: 1 }),
    };

    const result = await isGeoAncestorOf(client, { ancestorId: 'a', descendantId: 'b' });

    expect(result).toBe(true);
    const params = client.query.mock.calls[0]![1];
    expect(params[0]).toBe('a');
    expect(params[1]).toBe('b');
  });

  it('gibt false zurück wenn keine Vorfahren-Beziehung', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ exists: false }], rowCount: 1 }),
    };
    const result = await isGeoAncestorOf(client, { ancestorId: 'x', descendantId: 'y' });
    expect(result).toBe(false);
  });

  it('gibt false zurück wenn rows leer', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };
    const result = await isGeoAncestorOf(client, { ancestorId: 'a', descendantId: 'b' });
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getGeoDepth
// ---------------------------------------------------------------------------
describe('getGeoDepth', () => {
  it('gibt Tiefe zurück wenn Pfad gefunden', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ depth: 3 }], rowCount: 1 }),
    };
    const result = await getGeoDepth(client, { ancestorId: 'a', descendantId: 'b' });
    expect(result).toBe(3);
  });

  it('gibt -1 zurück wenn kein Pfad gefunden', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };
    const result = await getGeoDepth(client, { ancestorId: 'a', descendantId: 'b' });
    expect(result).toBe(-1);
  });

  it('gibt -1 zurück wenn depth null ist', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ depth: null }], rowCount: 1 }),
    };
    const result = await getGeoDepth(client, { ancestorId: 'a', descendantId: 'b' });
    expect(result).toBe(-1);
  });

  it('gibt 0 zurück bei identischen Knoten (Selbst-Referenz)', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [{ depth: 0 }], rowCount: 1 }),
    };
    const result = await getGeoDepth(client, { ancestorId: 'same', descendantId: 'same' });
    expect(result).toBe(0);
  });
});
