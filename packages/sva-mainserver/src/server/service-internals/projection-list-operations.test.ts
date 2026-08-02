import { describe, expect, it, vi } from 'vitest';

import { createProjectionListOperations } from './projection-list-operations.js';

const config = {
  instanceId: 'de-musterhausen',
  providerKey: 'sva_mainserver' as const,
  graphqlBaseUrl: 'https://mainserver.example.invalid/graphql',
  oauthTokenUrl: 'https://mainserver.example.invalid/oauth/token',
  enabled: true,
};

const input = {
  instanceId: 'de-musterhausen',
  keycloakSubject: 'subject-1',
  page: 1,
  pageSize: 100,
};

describe('projection list operations', () => {
  it('loads only allowlisted compact fields and skips invalid rows', async () => {
    const execute = vi.fn().mockResolvedValue({
      newsItems: [
        { id: 'news-1', title: '', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
        { title: 'Ohne ID' },
      ],
    });
    const operations = createProjectionListOperations(execute);

    const result = await operations.listProjectionWithConfig('news.article', input, config);

    expect(result.data).toEqual([
      expect.objectContaining({ id: 'news-1', title: 'news-1' }),
    ]);
    expect(result.skippedInvalidCount).toBe(1);
    const request = execute.mock.calls[0]?.[0] as { document: string; variables: unknown };
    expect(request.variables).toEqual({ limit: 101, skip: 0, order: 'updatedAt_DESC' });
    expect(request.document).not.toMatch(/\b(payload|contentBlocks|media|addresses)\b/);
  });

  it('loads surveys in one complete request without pagination variables', async () => {
    const execute = vi.fn().mockResolvedValue({ surveys: [{ id: 'survey-1', title: 'Umfrage' }] });
    const operations = createProjectionListOperations(execute);

    const result = await operations.listProjectionWithConfig('surveys.survey', input, config);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ variables: { archived: true, order: 'updatedAt_DESC' } })
    );
    expect(result.pagination).toEqual({ page: 1, pageSize: 1, hasNextPage: false, total: 1 });
  });

  it('keeps upstream pagination independent from complementary FAQ filtering', async () => {
    const faqItems = Array.from({ length: 99 }, (_, index) => ({
      id: `faq-${index + 1}`,
      title: `Frage ${index + 1}`,
      genericType: 'FAQ',
    }));
    const execute = vi.fn().mockResolvedValue({
      genericItems: [
        { id: 'generic-1', title: 'Allgemein', genericType: 'ARTICLE' },
        ...faqItems,
        { id: 'faq-sentinel', title: 'Nächste Frage', genericType: 'FAQ' },
      ],
    });
    const operations = createProjectionListOperations(execute);

    const faqResult = await operations.listProjectionWithConfig('faq.faq', input, config);
    const genericResult = await operations.listProjectionWithConfig(
      'generic-items.generic-item',
      input,
      config
    );

    expect(faqResult.data).toHaveLength(99);
    expect(faqResult.data.map((item) => item.id)).not.toContain('faq-sentinel');
    expect(genericResult.data.map((item) => item.id)).toEqual(['generic-1']);
    expect(faqResult.pagination.hasNextPage).toBe(true);
    expect(genericResult.pagination.hasNextPage).toBe(true);
  });

  it('rejects malformed projection pages', async () => {
    const operations = createProjectionListOperations(vi.fn().mockResolvedValue({ newsItems: null }));

    await expect(
      operations.listProjectionWithConfig('news.article', input, config)
    ).rejects.toThrow('Invalid projection page structure');
  });
});
