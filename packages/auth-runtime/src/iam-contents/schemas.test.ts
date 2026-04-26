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
        contentType: 'news.article',
        payload: { body: 'Text', teaser: 'Teaser' },
        publishedAt: '2026-04-25T12:00:00.000Z',
        status: 'published',
        title: 'News',
      }).success
    ).toBe(true);
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
    expect(updateContentSchema.safeParse({ publishedAt: '2026-04-25T12:00:00.1234567890Z' }).success).toBe(
      false
    );
  });
});
