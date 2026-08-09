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

const genericTypeOwnership = {
  FAQ: 'faq.faq',
  COCKPIT_CARD: 'cockpit-cards.cockpit-card',
  FeaturedProject: 'projects.project',
} as const;

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

    const result = await operations.listProjectionWithConfig(
      'news.article',
      input,
      config,
      genericTypeOwnership
    );

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

    const result = await operations.listProjectionWithConfig(
      'news.article',
      input,
      config,
      genericTypeOwnership
    );

    expect(result.data[0]?.title).toBe('News-Titel');
  });

  it('loads surveys in one complete request without pagination variables', async () => {
    const execute = vi.fn().mockResolvedValue({ surveys: [{ id: 'survey-1', title: 'Umfrage' }] });
    const operations = createProjectionListOperations(execute);

    const result = await operations.listProjectionWithConfig(
      'surveys.survey',
      input,
      config,
      genericTypeOwnership
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ variables: { archived: true, order: 'updatedAt_DESC' } })
    );
    expect(result.pagination).toEqual({ page: 1, pageSize: 1, hasNextPage: false, total: 1 });
  });

  it('keeps claimed FAQ items out of the complementary generic projection', async () => {
    const faqItems = Array.from({ length: 99 }, (_, index) => ({
      id: `faq-${index + 1}`,
      title: `Frage ${index + 1}`,
      genericType: 'FAQ',
    }));
    const execute = vi.fn().mockImplementation(({ variables }) =>
      variables.skip === 0
        ? {
            genericItems: [
              { id: 'generic-1', title: 'Allgemein', genericType: 'ARTICLE' },
              ...faqItems,
              { id: 'faq-sentinel', title: 'Nächste Frage', genericType: 'FAQ' },
            ],
          }
        : { genericItems: [] }
    );
    const operations = createProjectionListOperations(execute);

    const faqResult = await operations.listProjectionWithConfig(
      'faq.faq',
      input,
      config,
      genericTypeOwnership
    );
    const genericResult = await operations.listProjectionWithConfig(
      'generic-items.generic-item',
      input,
      config,
      genericTypeOwnership
    );

    expect(faqResult.data).toHaveLength(100);
    expect(faqResult.data.map((item) => item.id)).toContain('faq-sentinel');
    expect(genericResult.data.map((item) => item.id)).toEqual(['generic-1']);
    expect(faqResult.pagination.hasNextPage).toBe(false);
    expect(genericResult.pagination.hasNextPage).toBe(false);
  });

  it('continues scanning when an upstream page contains only claimed GenericItems', async () => {
    const execute = vi.fn().mockImplementation(({ variables }) =>
      variables.skip === 0
        ? {
            genericItems: Array.from({ length: 26 }, (_, index) => ({
              id: `faq-${index + 1}`,
              title: `FAQ ${index + 1}`,
              genericType: 'FAQ',
            })),
          }
        : {
            genericItems: [{ id: 'generic-1', title: 'Allgemein', genericType: 'ARTICLE' }],
          }
    );
    const operations = createProjectionListOperations(execute);

    const result = await operations.listProjectionWithConfig(
      'generic-items.generic-item',
      { ...input, pageSize: 25 },
      config,
      genericTypeOwnership
    );

    expect(execute.mock.calls.map((call) => call[0].variables)).toEqual([
      { limit: 26, skip: 0, order: 'updatedAt_DESC' },
      { limit: 26, skip: 26, order: 'updatedAt_DESC' },
    ]);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.data.map((item) => item.id)).toEqual(['generic-1']);
    expect(result.pagination.hasNextPage).toBe(false);
  });

  it('keeps only unclaimed discriminators in generic projections', async () => {
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
      config,
      genericTypeOwnership
    );

    expect(result.data.map((item) => item.id)).toEqual(['future-1']);
  });

  it('fails closed for a specialized generic-item projection without a matching owner', async () => {
    const execute = vi.fn().mockResolvedValue({
      genericItems: [{ id: 'faq-1', title: 'FAQ', genericType: 'FAQ' }],
    });
    const operations = createProjectionListOperations(execute);

    const result = await operations.listProjectionWithConfig('faq.faq', input, config, {});

    expect(result.data).toEqual([]);
  });

  it('projects FeaturedProject items without requiring local Studio records', async () => {
    const execute = vi.fn().mockResolvedValue({
      genericItems: [
        { id: 'project-1', title: 'Projekt', genericType: 'FeaturedProject' },
        { id: 'legacy-1', title: 'Alt', genericType: 'PROJECT' },
        {
          id: 'deleted-project',
          title: 'Gelöscht',
          genericType: 'FeaturedProject',
          payload: { deleted: true },
        },
        { id: 'faq-1', title: 'FAQ', genericType: 'FAQ' },
      ],
    });
    const operations = createProjectionListOperations(execute);

    const result = await operations.listProjectionWithConfig(
      'projects.project',
      input,
      config,
      genericTypeOwnership
    );

    const request = execute.mock.calls[0]?.[0] as { document: string };
    expect(request.document).toMatch(/genericType\s+author\s+payload/);
    expect(result.data).toEqual([
      expect.objectContaining({
        id: 'project-1',
        contentType: 'projects.project',
        title: 'Projekt',
      }),
    ]);
  });

  it('rejects malformed projection pages', async () => {
    const operations = createProjectionListOperations(
      vi.fn().mockResolvedValue({ newsItems: null })
    );

    await expect(
      operations.listProjectionWithConfig('news.article', input, config, genericTypeOwnership)
    ).rejects.toThrow('Invalid projection page structure');
  });
});
