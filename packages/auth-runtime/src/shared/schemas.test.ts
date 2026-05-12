import { describe, expect, it } from 'vitest';

import { authorizeRequestSchema, dataSubjectRightsRequestSchema } from './schemas.js';

describe('shared schemas', () => {
  it('accepts uuid organization scopes via the current zod helpers', () => {
    const parsed = authorizeRequestSchema.safeParse({
      instanceId: 'instance-1',
      action: 'iam.read',
      resource: {
        type: 'organization',
        organizationId: '11111111-1111-4111-8111-111111111111',
      },
      context: {
        organizationId: '22222222-2222-4222-8222-222222222222',
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('keeps unknown fields for data subject rights payloads', () => {
    const parsed = dataSubjectRightsRequestSchema.safeParse({
      requestType: 'export',
      customField: 'preserved',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data).toMatchObject({
      requestType: 'export',
      customField: 'preserved',
    });
  });
});
