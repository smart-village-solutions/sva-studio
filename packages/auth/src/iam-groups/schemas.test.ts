import { describe, expect, it } from 'vitest';

import {
  assignGroupMembershipSchema,
  assignGroupRoleSchema,
  createGroupSchema,
  groupKeySchema,
  removeGroupMembershipSchema,
  updateGroupSchema,
} from './schemas';

// ---------------------------------------------------------------------------
// groupKeySchema
// ---------------------------------------------------------------------------
describe('groupKeySchema', () => {
  it('akzeptiert gültige keys', () => {
    expect(groupKeySchema.safeParse('admin').success).toBe(true);
    expect(groupKeySchema.safeParse('my-group_01').success).toBe(true);
    expect(groupKeySchema.safeParse('ab').success).toBe(true); // min 2
  });

  it('lehnt zu kurze Keys ab (<2)', () => {
    expect(groupKeySchema.safeParse('a').success).toBe(false);
  });

  it('lehnt Keys länger als 64 Zeichen ab', () => {
    expect(groupKeySchema.safeParse('a'.repeat(65)).success).toBe(false);
  });

  it('lehnt Großbuchstaben ab', () => {
    expect(groupKeySchema.safeParse('MyGroup').success).toBe(false);
  });

  it('lehnt Leerzeichen ab', () => {
    expect(groupKeySchema.safeParse('my group').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createGroupSchema
// ---------------------------------------------------------------------------
describe('createGroupSchema', () => {
  const valid = {
    groupKey: 'test-group',
    displayName: 'Test Gruppe',
    groupType: 'custom' as const,
    isActive: true,
  };

  it('akzeptiert ein vollständiges gültiges Objekt', () => {
    const result = createGroupSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupType).toBe('custom');
      expect(result.data.isActive).toBe(true);
    }
  });

  it('setzt Defaults (groupType=custom, isActive=true)', () => {
    const result = createGroupSchema.safeParse({ groupKey: 'my-key', displayName: 'Mein Name' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupType).toBe('custom');
      expect(result.data.isActive).toBe(true);
    }
  });

  it('akzeptiert optionale description', () => {
    expect(createGroupSchema.safeParse({ ...valid, description: 'Eine Beschreibung' }).success).toBe(true);
  });

  it('lehnt displayName leer ab', () => {
    expect(createGroupSchema.safeParse({ ...valid, displayName: '' }).success).toBe(false);
  });

  it('lehnt description > 512 Zeichen ab', () => {
    expect(createGroupSchema.safeParse({ ...valid, description: 'x'.repeat(513) }).success).toBe(false);
  });

  it('lehnt ungültigen groupType ab', () => {
    expect(createGroupSchema.safeParse({ ...valid, groupType: 'unknown' }).success).toBe(false);
  });

  it('akzeptiert alle gültigen groupTypes', () => {
    for (const t of ['custom', 'system', 'geo', 'org'] as const) {
      expect(createGroupSchema.safeParse({ ...valid, groupType: t }).success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// updateGroupSchema
// ---------------------------------------------------------------------------
describe('updateGroupSchema', () => {
  it('akzeptiert leeres Update-Objekt (alle optional)', () => {
    expect(updateGroupSchema.safeParse({}).success).toBe(true);
  });

  it('akzeptiert partielle Updates', () => {
    expect(updateGroupSchema.safeParse({ displayName: 'Neuer Name' }).success).toBe(true);
    expect(updateGroupSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateGroupSchema.safeParse({ description: null }).success).toBe(true);
  });

  it('lehnt displayName leer ab', () => {
    expect(updateGroupSchema.safeParse({ displayName: '' }).success).toBe(false);
  });

  it('lehnt displayName > 128 Zeichen ab', () => {
    expect(updateGroupSchema.safeParse({ displayName: 'x'.repeat(129) }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assignGroupRoleSchema
// ---------------------------------------------------------------------------
describe('assignGroupRoleSchema', () => {
  it('akzeptiert eine gültige UUID', () => {
    const result = assignGroupRoleSchema.safeParse({ roleId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(true);
  });

  it('akzeptiert uuid-aehnliche Rollen-IDs aus den lokalen Seeds', () => {
    const result = assignGroupRoleSchema.safeParse({ roleId: '30666666-6666-6666-6666-666666666666' });
    expect(result.success).toBe(true);
  });

  it('lehnt eine ungültige UUID ab', () => {
    expect(assignGroupRoleSchema.safeParse({ roleId: 'not-a-uuid' }).success).toBe(false);
  });

  it('lehnt fehlendes roleId ab', () => {
    expect(assignGroupRoleSchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assignGroupMembershipSchema
// ---------------------------------------------------------------------------
describe('assignGroupMembershipSchema', () => {
  it('akzeptiert minimales gültiges Objekt', () => {
    expect(assignGroupMembershipSchema.safeParse({ keycloakSubject: 'user-123' }).success).toBe(true);
  });

  it('akzeptiert optionale Datumsfelder als ISO-Datetime', () => {
    expect(
      assignGroupMembershipSchema.safeParse({
        keycloakSubject: 'user-123',
        validFrom: '2025-01-01T00:00:00Z',
        validUntil: '2025-12-31T23:59:59Z',
      }).success
    ).toBe(true);
  });

  it('lehnt leeres keycloakSubject ab', () => {
    expect(assignGroupMembershipSchema.safeParse({ keycloakSubject: '' }).success).toBe(false);
  });

  it('lehnt ungültiges Datumsformat ab', () => {
    expect(
      assignGroupMembershipSchema.safeParse({ keycloakSubject: 'abc', validFrom: 'not-a-date' }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// removeGroupMembershipSchema
// ---------------------------------------------------------------------------
describe('removeGroupMembershipSchema', () => {
  it('akzeptiert gültiges keycloakSubject', () => {
    expect(removeGroupMembershipSchema.safeParse({ keycloakSubject: 'user-xyz' }).success).toBe(true);
  });

  it('lehnt leeres keycloakSubject ab', () => {
    expect(removeGroupMembershipSchema.safeParse({ keycloakSubject: '' }).success).toBe(false);
  });

  it('lehnt fehlendes keycloakSubject ab', () => {
    expect(removeGroupMembershipSchema.safeParse({}).success).toBe(false);
  });
});
