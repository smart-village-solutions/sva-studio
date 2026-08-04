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
        {
          id: 'news-1',
          title: '',
          contentBlocks: [{ title: 'Headline aus dem ersten Inhaltsblock' }],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
        { id: 'news-2', title: null, contentBlocks: [{ title: null }] },
        { title: 'Ohne ID' },
      ],
    });
    const operations = createProjectionListOperations(execute);

    const result = await operations.listProjectionWithConfig('news.article', input, config);

    expect(result.data).toEqual([
      expect.objectContaining({ id: 'news-1', title: 'Headline aus dem ersten Inhaltsblock' }),
      expect.objectContaining({ id: 'news-2', title: 'news-2' }),
    ]);
    expect(result.skippedInvalidCount).toBe(1);
    const request = execute.mock.calls[0]?.[0] as { document: string; variables: unknown };
    expect(request.variables).toEqual({ limit: 101, skip: 0, order: 'updatedAt_DESC' });
    expect(request.document).toMatch(/contentBlocks\s*\{\s*title\s*\}/);
    expect(request.document).not.toMatch(/\b(payload|media|addresses)\b/);
  });

  it('prefers the news title over the first content-block headline', async () => {
    const execute = vi.fn().mockResolvedValue({
      newsItems: [
        {
          id: 'news-1',
          title: 'News-Titel',
          contentBlocks: [{ title: 'Headline aus dem ersten Inhaltsblock' }],
        },
      ],
    });
    const operations = createProjectionListOperations(execute);

    const result = await operations.listProjectionWithConfig('news.article', input, config);

    expect(result.data[0]?.title).toBe('News-Titel');
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

  it('keeps generic projections unfiltered while applying the complementary FAQ filter', async () => {
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
    expect(genericResult.data).toHaveLength(100);
    expect(genericResult.data.map((item) => item.id)).toEqual([
      'generic-1',
      ...faqItems.map((item) => item.id),
    ]);
    expect(faqResult.pagination.hasNextPage).toBe(true);
    expect(genericResult.pagination.hasNextPage).toBe(true);
  });

  it('includes every known and unknown discriminator in generic projections', async () => {
    const execute = vi.fn().mockResolvedValue({
      genericItems: [
        { id: 'project-1', title: 'Projekt', genericType: 'FeaturedProject' },
        { id: 'faq-1', title: 'FAQ', genericType: 'FAQ' },
        { id: 'card-1', title: 'Kachel', genericType: 'COCKPIT_CARD' },
        { id: 'future-1', title: 'Zukünftiger Typ', genericType: 'FUTURE_TYPE' },
      ],
    });
    const operations = createProjectionListOperations(execute);

    const result = await operations.listProjectionWithConfig(
      'generic-items.generic-item',
      input,
      config
    );

    expect(result.data.map((item) => item.id)).toEqual([
      'project-1',
      'faq-1',
      'card-1',
      'future-1',
    ]);
  });

  it('rejects malformed projection pages', async () => {
    const operations = createProjectionListOperations(vi.fn().mockResolvedValue({ newsItems: null }));

    await expect(
      operations.listProjectionWithConfig('news.article', input, config)
    ).rejects.toThrow('Invalid projection page structure');
  });
});
