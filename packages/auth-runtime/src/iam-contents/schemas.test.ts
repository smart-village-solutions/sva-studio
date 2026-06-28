import { describe, expect, it } from 'vitest';

import { createContentSchema, updateContentSchema } from './schemas.js';

describe('iam content schemas', () => {
  it('requires publishedAt when creating published content', () => {
    const result = createContentSchema.safeParse({
      contentType: 'news.article',
      payload: { body: 'Text', teaser: 'Teaser' },
      status: 'published',
      title: 'News',
    });

    if (result.success) {
      throw new Error('Expected published content without publishedAt to be rejected');
    }
    expect(result.error.issues[0]).toMatchObject({
      path: ['publishedAt'],
      message: 'Veröffentlichungsdatum ist für veröffentlichte Inhalte erforderlich.',
    });
  });

  it('accepts published content with a valid publishedAt timestamp', () => {
    expect(
      createContentSchema.safeParse({
        authorDisplayMode: 'organization',
        contentType: 'news.article',
        payload: { body: 'Text', teaser: 'Teaser' },
        publishedAt: '2026-04-25T12:00:00.000Z',
        status: 'published',
        title: 'News',
      }).success
    ).toBe(true);
    expect(
      createContentSchema.safeParse({
        authorDisplayMode: 'team',
        contentType: 'news.article',
        payload: { body: 'Text', teaser: 'Teaser' },
        publishedAt: '2026-04-25T12:00:00.000Z',
        status: 'published',
        title: 'News',
      }).success
    ).toBe(false);
  });

  it('rejects create-time ownership and organization overrides', () => {
    expect(
      createContentSchema.safeParse({
        contentType: 'news.article',
        organizationId: '11111111-1111-4111-8111-111111111111',
        payload: { body: 'Text' },
        status: 'draft',
        title: 'News',
      }).success
    ).toBe(false);
    expect(
      createContentSchema.safeParse({
        contentType: 'news.article',
        ownerUserId: '00000000-0000-0000-0000-000000000001',
        payload: { body: 'Text' },
        status: 'draft',
        title: 'News',
      }).success
    ).toBe(false);
    expect(
      createContentSchema.safeParse({
        contentType: 'news.article',
        ownerOrganizationId: '11111111-1111-4111-8111-111111111111',
        payload: { body: 'Text' },
        status: 'draft',
        title: 'News',
      }).success
    ).toBe(false);
  });

  it('accepts visible author changes on update', () => {
    expect(updateContentSchema.safeParse({ authorDisplayName: 'Stadt Musterhausen' }).success).toBe(true);
    expect(updateContentSchema.safeParse({ authorDisplayMode: 'organization' }).success).toBe(true);
    expect(updateContentSchema.safeParse({ authorDisplayMode: 'user' }).success).toBe(true);
    expect(updateContentSchema.safeParse({ authorDisplayMode: 'team' }).success).toBe(false);
    expect(updateContentSchema.safeParse({ authorDisplayName: '' }).success).toBe(false);
    expect(updateContentSchema.safeParse({ authorDisplayName: '  ' }).success).toBe(false);
  });

  it('accepts valid ISO timestamps with variable fractional precision', () => {
    for (const publishedAt of [
      '2026-04-25T12:00:00.1Z',
      '2026-04-25T12:00:00.12Z',
      '2026-04-25T12:00:00.123456Z',
      '2026-04-25T12:00:00.123456789+02:00',
    ]) {
      expect(updateContentSchema.safeParse({ publishedAt }).success).toBe(true);
    }
  });

  it('rejects empty update payloads and invalid timestamps', () => {
    expect(updateContentSchema.safeParse({ title: undefined }).success).toBe(false);
    expect(updateContentSchema.safeParse({ publishedAt: 'not-a-date' }).success).toBe(false);
    expect(updateContentSchema.safeParse({ publishedAt: '2026-04-25' }).success).toBe(false);
    expect(updateContentSchema.safeParse({ publishedAt: '2026-04-25T12:00:00' }).success).toBe(false);
    expect(updateContentSchema.safeParse({ publishedAt: '2026-02-31T12:00:00Z' }).success).toBe(false);
    expect(updateContentSchema.safeParse({ publishedAt: '2025-02-29T12:00:00Z' }).success).toBe(false);
    expect(updateContentSchema.safeParse({ publishedAt: '2026-04-31T12:00:00+02:00' }).success).toBe(false);
    expect(updateContentSchema.safeParse({ publishedAt: '2026-04-25T24:00:00Z' }).success).toBe(false);
    expect(updateContentSchema.safeParse({ publishedAt: '2026-04-25T12:00:00.1234567890Z' }).success).toBe(
      false
    );
  });

  it('rejects publication windows with identical start and end timestamps', () => {
    const result = updateContentSchema.safeParse({
      publishFrom: '2026-04-25T12:00:00.000Z',
      publishUntil: '2026-04-25T12:00:00.000Z',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected identical publication window bounds to be rejected');
    }
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['publishUntil'],
          message: 'Das Veröffentlichungsende muss nach dem Veröffentlichungsbeginn liegen.',
        }),
      ])
    );
  });
});
