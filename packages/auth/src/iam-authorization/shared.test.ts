import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Schwere Module-Abhängigkeiten mocken (vor die Imports hoisten)
// ---------------------------------------------------------------------------
vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'req-x', traceId: 'trace-x', workspaceId: 'ws-x' }),
}));

vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: () => ({
      createHistogram: () => ({ record: vi.fn() }),
      createGauge: () => ({ addCallback: vi.fn() }),
      createObservableGauge: () => ({ addCallback: vi.fn() }),
      createCounter: () => ({ add: vi.fn() }),
      createObservableCounter: () => ({ addCallback: vi.fn() }),
      createObservableUpDownCounter: () => ({ addCallback: vi.fn() }),
    }),
  },
}));

vi.mock('../iam-authorization.cache', () => {
  class PermissionSnapshotCache {
    get = vi.fn();
    set = vi.fn();
    invalidate = vi.fn();
  }
  return { PermissionSnapshotCache, parseInvalidationEvent: vi.fn() };
});

vi.mock('../shared/db-helpers', () => ({
  createPoolResolver: vi.fn(() => vi.fn()),
  withInstanceDb: vi.fn(),
  jsonResponse: vi.fn((status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status })
  ),
}));

vi.mock('../shared/input-readers', () => ({
  isUuid: vi.fn(() => true),
  readString: vi.fn(),
}));

vi.mock('../shared/log-context', () => ({
  buildLogContext: vi.fn((wsId?: string) => ({ workspace_id: wsId ?? 'unknown' })),
}));

vi.mock('../shared/schemas', () => ({
  authorizeRequestSchema: { safeParse: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Imports (nach Mocks)
// ---------------------------------------------------------------------------
import { toEffectivePermissions, readResourceType, cacheMetricsState } from './shared';

// ---------------------------------------------------------------------------
// PermissionRow-Hilfsfunktion
// ---------------------------------------------------------------------------
function makeRow(overrides: Partial<{
  permission_key: string;
  action: string | null;
  resource_type: string | null;
  resource_id: string | null;
  effect: 'allow' | 'deny' | null;
  scope: string | null;
  role_id: string;
  group_id: string | null;
  group_key: string | null;
  organization_id: string | null;
}> = {}) {
  return {
    permission_key: 'content.read',
    action: null,
    resource_type: null,
    resource_id: null,
    effect: null,
    scope: null,
    role_id: 'role-1',
    group_id: null,
    group_key: null,
    organization_id: null,
    ...overrides,
  };
}

// ============================================================================
// readResourceType
// ============================================================================
describe('readResourceType', () => {
  it('gibt den ersten Teil eines Schlüssels mit Punkt zurück', () => {
    expect(readResourceType('content.read')).toBe('content');
  });

  it('gibt den gesamten Schlüssel zurück wenn kein Punkt vorhanden', () => {
    expect(readResourceType('noDot')).toBe('noDot');
  });

  it('gibt den ersten Teil bei mehreren Punkten zurück', () => {
    expect(readResourceType('a.b.c')).toBe('a');
  });
});

// ============================================================================
// toEffectivePermissions — Basis-Fälle (Fallback-Branches)
// ============================================================================
describe('toEffectivePermissions — Fallback-Branches (null-Felder)', () => {
  it('verwendet permission_key als Action-Fallback wenn action null ist', () => {
    const result = toEffectivePermissions([makeRow({ action: null })]);
    expect(result[0].action).toBe('content.read');
  });

  it('verwendet action wenn sie definiert und nicht-leer ist', () => {
    const result = toEffectivePermissions([makeRow({ action: 'read' })]);
    expect(result[0].action).toBe('read');
  });

  it('verwendet readResourceType als resourceType-Fallback wenn resource_type null ist', () => {
    const result = toEffectivePermissions([makeRow({ resource_type: null })]);
    expect(result[0].resourceType).toBe('content');
  });

  it('verwendet resource_type wenn sie definiert ist', () => {
    const result = toEffectivePermissions([makeRow({ resource_type: 'article' })]);
    expect(result[0].resourceType).toBe('article');
  });

  it('setzt resourceId auf undefined wenn resource_id null ist', () => {
    const result = toEffectivePermissions([makeRow({ resource_id: null })]);
    expect(result[0].resourceId).toBeUndefined();
  });

  it('setzt resourceId auf den Wert wenn resource_id definiert ist', () => {
    const result = toEffectivePermissions([makeRow({ resource_id: 'article-42' })]);
    expect(result[0].resourceId).toBe('article-42');
  });

  it('verwendet "allow" als effect-Fallback wenn effect null ist', () => {
    const result = toEffectivePermissions([makeRow({ effect: null })]);
    expect(result[0].effect).toBe('allow');
  });

  it('verwendet effect wenn er definiert ist', () => {
    const result = toEffectivePermissions([makeRow({ effect: 'deny' })]);
    expect(result[0].effect).toBe('deny');
  });

  it('setzt scope auf undefined wenn scope null ist', () => {
    const result = toEffectivePermissions([makeRow({ scope: null })]);
    expect(result[0].scope).toBeUndefined();
  });

  it('setzt scope auf den Wert wenn scope definiert ist', () => {
    const result = toEffectivePermissions([makeRow({ scope: 'tenant' })]);
    expect(result[0].scope).toBe('tenant');
  });
});

// ============================================================================
// toEffectivePermissions — Gruppen-Branches
// ============================================================================
describe('toEffectivePermissions — Gruppen-Branches', () => {
  it('setzt sourceGroupIds wenn group_id definiert ist', () => {
    const result = toEffectivePermissions([makeRow({ group_id: 'grp-1' })]);
    expect(result[0].sourceGroupIds).toEqual(['grp-1']);
  });

  it('setzt groupName wenn group_key definiert ist', () => {
    const result = toEffectivePermissions([makeRow({ group_key: 'admins' })]);
    expect(result[0].groupName).toBe('admins');
  });

  it('setzt sourceGroupIds nicht wenn group_id null ist', () => {
    const result = toEffectivePermissions([makeRow({ group_id: null })]);
    expect(result[0].sourceGroupIds).toBeUndefined();
  });
});

// ============================================================================
// toEffectivePermissions — Bucket-Kollision (Duplikat-Merge)
// ============================================================================
describe('toEffectivePermissions — Duplikat-Bucket-Merge', () => {
  const baseRow = makeRow({
    action: 'read',
    resource_type: 'content',
    effect: 'allow',
  });

  it('merged zwei Rows mit gleichem Bucket-Key', () => {
    const row1 = { ...baseRow, role_id: 'role-1' };
    const row2 = { ...baseRow, role_id: 'role-2' };
    const result = toEffectivePermissions([row1, row2]);
    expect(result).toHaveLength(1);
    expect(result[0].sourceRoleIds).toContain('role-1');
    expect(result[0].sourceRoleIds).toContain('role-2');
  });

  it('fügt role_id nicht doppelt hinzu wenn sie bereits vorhanden ist', () => {
    const row1 = { ...baseRow, role_id: 'role-same' };
    const row2 = { ...baseRow, role_id: 'role-same' };
    const result = toEffectivePermissions([row1, row2]);
    expect(result[0].sourceRoleIds).toHaveLength(1);
  });

  it('merged sourceGroupIds bei Duplikat-Bucket mit unterschiedlichen Gruppen', () => {
    const row1 = { ...baseRow, role_id: 'role-1', group_id: 'grp-1' };
    const row2 = { ...baseRow, role_id: 'role-2', group_id: 'grp-2' };
    const result = toEffectivePermissions([row1, row2]);
    expect(result[0].sourceGroupIds).toContain('grp-1');
    expect(result[0].sourceGroupIds).toContain('grp-2');
  });

  it('fügt sourceGroupId nicht doppelt hinzu bei Duplikat-Gruppe', () => {
    const row1 = { ...baseRow, role_id: 'role-1', group_id: 'grp-same' };
    const row2 = { ...baseRow, role_id: 'role-2', group_id: 'grp-same' };
    const result = toEffectivePermissions([row1, row2]);
    const groupIds = result[0].sourceGroupIds ?? [];
    const uniqueGroupIds = [...new Set(groupIds)];
    expect(groupIds).toHaveLength(uniqueGroupIds.length);
  });

  it('übernimmt groupName aus zweitem Eintrag wenn group_key gesetzt', () => {
    const row1 = { ...baseRow, role_id: 'role-1', group_key: null };
    const row2 = { ...baseRow, role_id: 'role-2', group_key: 'managers' };
    const result = toEffectivePermissions([row1, row2]);
    expect(result[0].groupName).toBe('managers');
  });
});

// ============================================================================
// toEffectivePermissions — leere Eingabe
// ============================================================================
describe('toEffectivePermissions — Rand-Fälle', () => {
  it('gibt leeres Array zurück bei leerer Eingabe', () => {
    expect(toEffectivePermissions([])).toHaveLength(0);
  });

  it('gibt mehrere Buckets zurück bei verschiedenen Bucket-Keys', () => {
    const row1 = makeRow({ action: 'read', resource_type: 'content' });
    const row2 = makeRow({ action: 'write', resource_type: 'content' });
    const result = toEffectivePermissions([row1, row2]);
    expect(result).toHaveLength(2);
  });
});

// ============================================================================
// cacheMetricsState — staleRate Berechnung
// ============================================================================
describe('cacheMetricsState', () => {
  beforeEach(() => {
    cacheMetricsState.lookups = 0;
    cacheMetricsState.staleLookups = 0;
  });

  it('lookups und staleLookups sind initiell 0', () => {
    expect(cacheMetricsState.lookups).toBe(0);
    expect(cacheMetricsState.staleLookups).toBe(0);
  });

  it('kann lookups und staleLookups setzen', () => {
    cacheMetricsState.lookups = 10;
    cacheMetricsState.staleLookups = 2;
    expect(cacheMetricsState.lookups).toBe(10);
    expect(cacheMetricsState.staleLookups).toBe(2);
  });
});
