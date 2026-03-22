import { describe, expect, it } from 'vitest';

import { mapGroupListItem, mapGroupMembership } from './types';
import type { GroupRow, AccountGroupRow } from './types';

// ---------------------------------------------------------------------------
// mapGroupListItem
// ---------------------------------------------------------------------------
describe('mapGroupListItem', () => {
  const baseRow: GroupRow = {
    id: 'grp-1',
    instance_id: 'inst-1',
    group_key: 'admins',
    display_name: 'Administratoren',
    description: null,
    group_type: 'custom',
    is_active: true,
    member_count: 3,
    role_count: 2,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
  };

  it('mappt Pflichtfelder korrekt', () => {
    const result = mapGroupListItem(baseRow);
    expect(result.id).toBe('grp-1');
    expect(result.instanceId).toBe('inst-1');
    expect(result.groupKey).toBe('admins');
    expect(result.displayName).toBe('Administratoren');
    expect(result.groupType).toBe('custom');
    expect(result.isActive).toBe(true);
    expect(result.memberCount).toBe(3);
    expect(result.roleCount).toBe(2);
    expect(result.createdAt).toBe('2025-01-01T00:00:00Z');
    expect(result.updatedAt).toBe('2025-01-15T00:00:00Z');
  });

  it('enthält keine description wenn null', () => {
    const result = mapGroupListItem({ ...baseRow, description: null });
    expect(result).not.toHaveProperty('description');
  });

  it('enthält description wenn gesetzt', () => {
    const result = mapGroupListItem({ ...baseRow, description: 'Eine Beschreibung' });
    expect(result.description).toBe('Eine Beschreibung');
  });

  it('mappt groupType korrekt (alle Werte)', () => {
    for (const t of ['custom', 'system', 'geo', 'org']) {
      const result = mapGroupListItem({ ...baseRow, group_type: t });
      expect(result.groupType).toBe(t);
    }
  });

  it('mappt isActive: false korrekt', () => {
    const result = mapGroupListItem({ ...baseRow, is_active: false });
    expect(result.isActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mapGroupMembership
// ---------------------------------------------------------------------------
describe('mapGroupMembership', () => {
  const baseRow: AccountGroupRow = {
    instance_id: 'inst-2',
    account_id: 'acc-1',
    group_id: 'grp-2',
    valid_from: null,
    valid_until: null,
    assigned_at: '2025-03-01T10:00:00Z',
  };

  it('mappt Pflichtfelder korrekt', () => {
    const result = mapGroupMembership(baseRow);
    expect(result.instanceId).toBe('inst-2');
    expect(result.accountId).toBe('acc-1');
    expect(result.groupId).toBe('grp-2');
    expect(result.assignedAt).toBe('2025-03-01T10:00:00Z');
  });

  it('enthält kein validFrom wenn null', () => {
    const result = mapGroupMembership({ ...baseRow, valid_from: null });
    expect(result).not.toHaveProperty('validFrom');
  });

  it('enthält validFrom wenn gesetzt', () => {
    const result = mapGroupMembership({ ...baseRow, valid_from: '2025-01-01T00:00:00Z' });
    expect(result.validFrom).toBe('2025-01-01T00:00:00Z');
  });

  it('enthält kein validUntil wenn null', () => {
    const result = mapGroupMembership({ ...baseRow, valid_until: null });
    expect(result).not.toHaveProperty('validUntil');
  });

  it('enthält validUntil wenn gesetzt', () => {
    const result = mapGroupMembership({ ...baseRow, valid_until: '2025-12-31T23:59:59Z' });
    expect(result.validUntil).toBe('2025-12-31T23:59:59Z');
  });

  it('enthält beide Datums-Felder wenn beide gesetzt', () => {
    const result = mapGroupMembership({
      ...baseRow,
      valid_from: '2025-01-01T00:00:00Z',
      valid_until: '2025-06-30T23:59:59Z',
    });
    expect(result.validFrom).toBe('2025-01-01T00:00:00Z');
    expect(result.validUntil).toBe('2025-06-30T23:59:59Z');
  });
});
