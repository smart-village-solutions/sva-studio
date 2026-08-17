import { describe, expect, it } from 'vitest';

import { createRoleSchema } from './schemas.js';

describe('createRoleSchema', () => {
  it('defaults hidden roleLevel to zero when a display name is provided', () => {
    expect(
      createRoleSchema.parse({
        displayName: 'Redaktion',
        permissionIds: [],
      })
    ).toMatchObject({
      displayName: 'Redaktion',
      roleLevel: 0,
    });
  });

  it('keeps explicit technical keys available for legacy API clients', () => {
    expect(
      createRoleSchema.parse({
        roleName: 'legacy_editor',
        permissionIds: [],
      })
    ).toMatchObject({
      roleName: 'legacy_editor',
      roleLevel: 0,
    });
  });

  it('requires a display name when no legacy key is supplied', () => {
    expect(createRoleSchema.safeParse({ permissionIds: [] }).success).toBe(false);
  });
});
