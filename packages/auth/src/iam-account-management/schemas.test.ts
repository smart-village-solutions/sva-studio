import { describe, expect, it } from 'vitest';

import { updateUserSchema } from './schemas';

describe('updateUserSchema', () => {
  it('rejects requests that only send a blank mainserver secret', () => {
    const result = updateUserSchema.safeParse({
      mainserverUserApplicationSecret: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('normalizes blank mainserver secrets to undefined when other fields are updated', () => {
    const result = updateUserSchema.safeParse({
      displayName: 'Updated User',
      mainserverUserApplicationSecret: '   ',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data).toEqual({
      displayName: 'Updated User',
      mainserverUserApplicationSecret: undefined,
    });
  });
});
