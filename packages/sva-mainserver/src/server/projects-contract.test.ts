import { describe, expect, it } from 'vitest';

import type { SvaMainserverGenericItem } from '../types.js';
import {
  mapGenericItemToProject,
  mergeProjectIntoGenericItem,
  parseProjectInput,
  validateProjectProjection,
} from './projects-contract.js';

const project = {
  language: ' de ',
  title: ' Projekt ',
  description: ' Kurz ',
  fullText: ' <p>Text</p> ',
  images: [
    {
      url: 'https://example.test/a.jpg',
      altText: 'Alternativtext',
      caption: 'Bild',
      credits: 'Gemeinde',
      position: 0,
    },
  ],
  status: 'published' as const,
  author: { type: 'organization' as const, id: 'org-1', displayName: 'Gemeinde' },
};

const existing: SvaMainserverGenericItem = {
  id: 'external-1',
  title: 'Alt',
  contentType: 'generic-items.generic-item',
  status: 'published',
  genericType: 'FeaturedProject',
  teaser: 'Alt',
  visible: false,
  author: 'Alt',
  externalId: 'operation-1',
  payload: { language: 'en', unknown: 'keep', deleted: false },
  categories: [],
  contacts: [],
  webUrls: [{ id: '1', url: 'https://example.test/hidden' }],
  addresses: [],
  contentBlocks: [
    { id: 'block-1', title: 'Verborgener Titel', body: 'Alt', mediaContents: [] },
    { id: 'block-2', body: 'Verborgener Block', mediaContents: [] },
  ],
  openingHours: [],
  priceInformations: [],
  mediaContents: [],
  locations: [],
  dates: [],
  accessibilityInformations: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('projects contract', () => {
  it('parses valid input and rejects non-contiguous image positions', async () => {
    const valid = await parseProjectInput(
      new Request('https://studio.test/api/v1/mainserver/projects', {
        method: 'POST',
        body: JSON.stringify(project),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(valid).toEqual({ ...project, language: 'de', title: 'Projekt', description: 'Kurz', fullText: '<p>Text</p>' });

    const invalid = await parseProjectInput(
      new Request('https://studio.test/api/v1/mainserver/projects', {
        method: 'POST',
        body: JSON.stringify({ ...project, images: [{ ...project.images[0], position: 2 }] }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(invalid).toBeInstanceOf(Response);
  });

  it('accepts empty optional language and text fields', async () => {
    const parsed = await parseProjectInput(
      new Request('https://studio.test/api/v1/mainserver/projects', {
        method: 'POST',
        body: JSON.stringify({ ...project, language: '', description: '', fullText: '', images: [] }),
        headers: { 'Content-Type': 'application/json' },
      })
    );

    expect(parsed).toEqual({
      ...project,
      language: '',
      title: 'Projekt',
      description: '',
      fullText: '',
      images: [],
    });
    expect(
      mergeProjectIntoGenericItem({ project: parsed as typeof project })
    ).toEqual(expect.objectContaining({ teaser: '', contentBlocks: [], mediaContents: [] }));
  });

  it('defaults omitted optional language and text fields', async () => {
    const { language: _language, description: _description, fullText: _fullText, ...required } = project;
    const parsed = await parseProjectInput(
      new Request('https://studio.test/api/v1/mainserver/projects', {
        method: 'POST', body: JSON.stringify(required), headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(parsed).toEqual({ ...required, title: 'Projekt', language: '', description: '', fullText: '' });
  });

  it('rejects derived and unknown mutation fields', async () => {
    const response = await parseProjectInput(
      new Request('https://studio.test/api/v1/mainserver/projects', {
        method: 'POST',
        body: JSON.stringify({ ...project, published: true }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
  });

  it('maps status, images and stable external id to GenericItem', () => {
    expect(
      mergeProjectIntoGenericItem({
        project,
        externalId: 'operation-1',
        publishedAt: '2026-01-03T00:00:00.000Z',
      })
    ).toEqual(
      expect.objectContaining({
        title: 'Projekt',
        genericType: 'FeaturedProject',
        teaser: 'Kurz',
        visible: true,
        externalId: 'operation-1',
        publishedAt: '2026-01-03T00:00:00.000Z',
        payload: {
          language: 'de',
          status: 'published',
          author: project.author,
          deleted: false,
        },
        contentBlocks: [{ body: '<p>Text</p>' }],
        mediaContents: [
          {
            contentType: 'image',
            sourceUrl: {
              url: 'https://example.test/a.jpg',
              description: 'Alternativtext',
            },
            captionText: 'Bild',
            copyright: 'Gemeinde',
          },
        ],
      })
    );
  });

  it('preserves hidden GenericItem and payload fields during update', () => {
    const merged = mergeProjectIntoGenericItem({ project, existing });
    expect(merged.payload).toEqual({
      language: 'de',
      unknown: 'keep',
      status: 'published',
      author: project.author,
      deleted: false,
    });
    expect(merged.webUrls).toEqual([{ url: 'https://example.test/hidden' }]);
    expect(merged.contentBlocks).toEqual([
      { id: 'block-1', title: 'Verborgener Titel', body: '<p>Text</p>', mediaContents: [] },
      { id: 'block-2', body: 'Verborgener Block', mediaContents: [] },
    ]);
  });

  it('keeps cleared project text empty while preserving hidden remaining blocks', () => {
    const merged = mergeProjectIntoGenericItem({
      project: { ...project, description: '', fullText: '<p></p>' },
      existing,
    });
    expect(merged.teaser).toBe('');
    expect(merged.contentBlocks).toEqual([
      { id: 'block-1', title: 'Verborgener Titel', body: '', mediaContents: [] },
      { id: 'block-2', body: 'Verborgener Block', mediaContents: [] },
    ]);
    expect(
      mapGenericItemToProject({
        ...existing,
        teaser: merged.teaser,
        contentBlocks: merged.contentBlocks ?? [],
      }).fullText
    ).toBe('');
  });

  it('returns the exact FeaturedProject response without technical type fields', () => {
    const mapped = mapGenericItemToProject({
        ...existing,
        teaser: 'Kurz',
        visible: true,
        publishedAt: '2026-01-03T00:00:00.000Z',
        author: 'Gemeinde',
        payload: {
          language: 'en',
          status: 'published',
          deleted: false,
          author: { type: 'organization', id: 'org-1', displayName: 'Gemeinde' },
        },
        contentBlocks: [{ body: '<p>Text</p>', mediaContents: [] }],
        mediaContents: [
          {
            sourceUrl: { url: 'https://example.test/a.jpg', description: 'Alternativtext' },
            captionText: 'Bild',
            copyright: 'Gemeinde',
          },
        ],
    });
    expect(mapped).toEqual({
      id: 'external-1',
      language: 'en',
      title: 'Alt',
      description: 'Kurz',
      fullText: '<p>Text</p>',
      images: [
        {
          url: 'https://example.test/a.jpg',
          altText: 'Alternativtext',
          caption: 'Bild',
          credits: 'Gemeinde',
          position: 0,
        },
      ],
      status: 'published',
      published: true,
      publishedAt: '2026-01-03T00:00:00.000Z',
      author: { type: 'organization', id: 'org-1', displayName: 'Gemeinde' },
      deleted: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(mapped).not.toHaveProperty('genericType');
    expect(mapped).not.toHaveProperty('translations');
    expect(mapped).not.toHaveProperty('type');
  });

  it('preserves every hidden structured GenericItem field without transport ids', () => {
    const merged = mergeProjectIntoGenericItem({
      project: { ...project, status: 'archived' },
      existing: {
        ...existing,
        keywords: ['klima'],
        publicationDate: '2026-01-03T00:00:00.000Z',
        categories: [{ id: 'category-1', name: 'Umwelt', children: [{ id: 'child-1', name: 'Klima', children: [] }] }],
        contacts: [{ id: 'contact-1', firstName: 'Ada', webUrls: [{ id: 'web-1', url: 'https://example.test', description: 'Profil' }] }],
        addresses: [
          { id: '12', street: 'Markt', houseNumber: '1' },
          { id: 'not-a-number', street: 'Nebenstraße', houseNumber: '2' },
        ],
        openingHours: [{ id: 'hours-1', weekday: 'monday' }],
        priceInformations: [{ id: 'price-1', name: 'Kostenlos' }],
        locations: [{ id: 'location-1', name: 'Rathaus' }],
        dates: [
          { id: 'date-1', dateStart: '2026-01-01', useOnlyTimeDescription: 'true' },
          { id: 'date-2', dateStart: '2026-01-02' },
        ],
        accessibilityInformations: [{ id: 'access-1', description: 'Rampe', urls: [] }],
      },
    });

    expect(merged).toEqual(
      expect.objectContaining({
        visible: false,
        keywords: ['klima'],
        categories: [{ name: 'Umwelt', children: [{ name: 'Klima', children: [] }] }],
        contacts: [{ firstName: 'Ada', webUrls: [{ url: 'https://example.test', description: 'Profil' }] }],
        addresses: [
          { id: 12, street: 'Markt', houseNumber: '1' },
          { street: 'Nebenstraße', houseNumber: '2' },
        ],
        dates: [
          { dateStart: '2026-01-01', useOnlyTimeDescription: true },
          { dateStart: '2026-01-02' },
        ],
      })
    );
  });

  it('maps safe projection fallbacks and validates malformed responses', () => {
    const mapped = mapGenericItemToProject({
        ...existing,
        payload: null,
        teaser: undefined,
        contentBlocks: [],
        mediaContents: [{ sourceUrl: undefined }],
    });

    expect(mapped).toEqual(
      expect.objectContaining({
        language: '',
        description: '',
        fullText: '',
        status: 'draft',
        published: false,
        author: {
          type: 'organization',
          id: 'mainserver:external-1',
          displayName: 'Alt',
        },
        images: [{ url: '', altText: '', position: 0 }],
      })
    );
    expect(validateProjectProjection(mapped)).toBeInstanceOf(Response);
    expect(
      validateProjectProjection({
        ...mapped,
        language: 'de',
        description: 'Kurz',
        fullText: '<p>Text</p>',
        images: [],
      })
    ).toBeNull();
  });
});
