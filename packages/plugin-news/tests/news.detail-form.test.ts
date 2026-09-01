import { describe, expect, it } from 'vitest';

import {
  buildNewsDetailCharacterCounts,
  createDefaultNewsDetailFormValues,
  deriveDirtyNewsDetailTabs,
  mapNewsDetailFormValuesToMutation,
  mapNewsItemToDetailFormValues,
  newsDetailFormSchema,
} from '../src/news.detail-form.js';
import type {
  NewsContentBlockFormValue,
  NewsContentItem,
  NewsDetailCompatibilityField,
  NewsDetailFormValues,
  NewsFormInput,
} from '../src/news.types.js';

const sampleItem: NewsContentItem = {
  id: 'news-1',
  title: 'Rathaus informiert',
  contentType: 'news',
  payload: {
    category: 'Stadt',
  },
  status: 'published',
  author: 'Redaktion',
  keywords: 'Rathaus, Termin',
  externalId: 'ext-42',
  fullVersion: true,
  charactersToBeShown: 180,
  newsType: 'meldung',
  publicationDate: '2026-05-24T08:00:00.000Z',
  publishedAt: '2026-05-24T09:00:00.000Z',
  showPublishDate: false,
  categories: [{ name: 'Stadt' }, { name: 'Verwaltung' }],
  sourceUrl: { url: 'https://example.org/news', description: 'Quelle' },
  address: {
    street: 'Marktplatz 1',
    zip: '12345',
    city: 'Musterstadt',
  },
  contentBlocks: [
    {
      title: 'Abschnitt 1',
      intro: 'Kurzer Einstieg',
      body: '<p>Ausfuehrlicher Inhalt</p>',
      mediaContents: [{ sourceUrl: { url: 'https://example.org/image.jpg', description: '' } }],
    },
  ],
  pointOfInterestId: 'poi-1',
  visible: true,
  createdAt: '2026-05-20T09:00:00.000Z',
  updatedAt: '2026-05-22T09:00:00.000Z',
};

type CompatibilityTouchRuntime = true | false | undefined;

const defineCompatibilityRuntimeInput = (
  values: NewsDetailFormValues,
  key: NewsDetailCompatibilityField,
  value: unknown,
  touched: CompatibilityTouchRuntime
) => {
  Object.defineProperty(values, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });

  if (touched === undefined) {
    delete (values as unknown as Record<string, unknown>).__compatibilityTouched;
    return;
  }

  Object.defineProperty(values, '__compatibilityTouched', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: { [key]: touched },
  });
};

const readMutationField = (mutation: NewsFormInput, key: string): unknown =>
  (mutation as unknown as Record<string, unknown>)[key];

const compatibilityFieldCases = [
  {
    key: 'keywords',
    mutationKey: 'keywords',
    validValue: 'Neue Schlagwörter',
    invalidValue: 42,
    initialValue: 'Rathaus, Termin',
    updatedValue: 'Neue Schlagwörter',
  },
  {
    key: 'externalId',
    mutationKey: 'externalId',
    validValue: 'ext-new',
    invalidValue: false,
    initialValue: 'ext-42',
    updatedValue: 'ext-new',
  },
  {
    key: 'newsType',
    mutationKey: 'newsType',
    validValue: 'warnung',
    invalidValue: [],
    initialValue: 'meldung',
    updatedValue: 'warnung',
  },
  {
    key: 'charactersToBeShown',
    mutationKey: 'charactersToBeShown',
    validValue: '240',
    invalidValue: 240,
    initialValue: 180,
    updatedValue: 240,
  },
  {
    key: 'fullVersion',
    mutationKey: 'fullVersion',
    validValue: false,
    invalidValue: 'false',
    initialValue: true,
    updatedValue: false,
  },
  {
    key: 'showPublishDate',
    mutationKey: 'showPublishDate',
    validValue: true,
    invalidValue: 1,
    initialValue: false,
    updatedValue: true,
  },
  {
    key: 'pushNotification',
    mutationKey: 'pushNotification',
    validValue: true,
    invalidValue: 'true',
    initialValue: false,
    updatedValue: true,
  },
  {
    key: 'pointOfInterestId',
    mutationKey: 'pointOfInterestId',
    validValue: 'poi-new',
    invalidValue: null,
    initialValue: 'poi-1',
    updatedValue: 'poi-new',
  },
  {
    key: 'address',
    mutationKey: 'address',
    validValue: { street: 'Neue Straße 2', zip: '54321', city: 'Neustadt' },
    invalidValue: 'Neue Straße 2',
    initialValue: { street: 'Marktplatz 1', zip: '12345', city: 'Musterstadt' },
    updatedValue: { street: 'Neue Straße 2', zip: '54321', city: 'Neustadt' },
  },
] as const satisfies readonly {
  key: NewsDetailCompatibilityField;
  mutationKey: string;
  validValue: unknown;
  invalidValue: unknown;
  initialValue: unknown;
  updatedValue: unknown;
}[];

describe('news.detail-form', () => {
  it('backs compatibility aliases with the hidden snapshot instead of standalone public state', () => {
    const values = createDefaultNewsDetailFormValues(
      'Redaktion'
    ) as typeof createDefaultNewsDetailFormValues extends (...args: never[]) => infer TValue
      ? TValue & {
          externalId?: string;
          newsType?: string;
          contentBlocks?: NewsContentBlockFormValue[];
        }
      : never;

    values.externalId = 'ext-42';
    values.newsType = 'meldung';
    values.contentBlocks = [
      { title: 'Block', intro: 'Einleitung', body: '<p>Body</p>', mediaContents: [] },
    ];

    expect(values.__legacySnapshot).toMatchObject({
      externalId: 'ext-42',
      newsType: 'meldung',
    });
    expect(values.contentBlocks?.[0]).toMatchObject({
      title: 'Block',
      intro: 'Einleitung',
      body: '<p>Body</p>',
    });
    expect(values.contentIntro).toBe('Einleitung');
    expect(values.contentBody).toBe('<p>Body</p>');
  });

  it('counts intro and body from the editorial fields when no compatibility blocks are supplied', () => {
    expect(
      buildNewsDetailCharacterCounts({
        title: 'Titel',
        contentIntro: 'Intro',
        contentBody: 'Body',
      })
    ).toEqual({ title: 5, intros: [5], bodies: [4] });
  });

  it('maps a NewsContentItem into the simplified editorial form values', () => {
    expect(mapNewsItemToDetailFormValues(sampleItem)).toMatchObject({
      title: 'Rathaus informiert',
      author: 'Redaktion',
      categories: ['Stadt', 'Verwaltung'],
      contentIntro: 'Kurzer Einstieg',
      contentBody: '<p>Ausfuehrlicher Inhalt</p>',
      sourceUrl: { url: 'https://example.org/news', description: 'Quelle' },
      sourceUrlDescription: 'Quelle',
      publicationMode: 'immediate',
      scheduledPublicationAt: '',
      __legacySnapshot: expect.objectContaining({
        externalId: 'ext-42',
        newsType: 'meldung',
        charactersToBeShown: 180,
        fullVersion: true,
        showPublishDate: false,
        pointOfInterestId: 'poi-1',
      }),
    });
  });

  it('requires a schedule date only for scheduled publication mode', async () => {
    await expect(
      newsDetailFormSchema.parseAsync({
        ...createDefaultNewsDetailFormValues(),
        title: 'News title',
        author: 'Redaktion',
        contentIntro: 'Einleitung',
        contentBody: '<p>Body</p>',
        publicationMode: 'scheduled',
        scheduledPublicationAt: '',
      })
    ).rejects.toThrow();
  });

  it('allows draft mode without a scheduled publication date', async () => {
    await expect(
      newsDetailFormSchema.parseAsync({
        ...createDefaultNewsDetailFormValues(),
        title: 'News title',
        author: 'Redaktion',
        contentIntro: 'Einleitung',
        contentBody: '<p>Body</p>',
        publicationMode: 'draft',
        scheduledPublicationAt: '',
      })
    ).resolves.toMatchObject({
      publicationMode: 'draft',
    });
  });

  it('accepts the simplified schema without public legacy fields', async () => {
    await expect(
      newsDetailFormSchema.parseAsync({
        title: 'News title',
        author: 'Redaktion',
        categories: [],
        contentIntro: 'Einleitung',
        contentBody: '<p>Body</p>',
        contentMedia: [],
        sourceUrl: { url: '', description: '' },
        sourceUrlDescription: '',
        pushNotificationEnabled: false,
        publicationMode: 'immediate',
        scheduledPublicationAt: '',
      })
    ).resolves.not.toHaveProperty('externalId');
  });

  it('accepts news entries without content body and source url', async () => {
    await expect(
      newsDetailFormSchema.parseAsync({
        title: 'News title',
        author: 'Redaktion',
        categories: [],
        contentIntro: 'Einleitung',
        contentBody: '',
        contentMedia: [],
        sourceUrl: { url: '', description: '' },
        sourceUrlDescription: '',
        pushNotificationEnabled: false,
        publicationMode: 'draft',
        scheduledPublicationAt: '',
      })
    ).resolves.toMatchObject({
      title: 'News title',
      contentBody: '',
      sourceUrl: { url: '', description: '' },
    });
  });

  it('omits untouched compatibility defaults from serialized mutations', () => {
    const values = createDefaultNewsDetailFormValues('Redaktion');

    values.title = 'Neue News';
    values.contentIntro = 'Einleitung';
    values.contentBody = '<p>Body</p>';

    const mutation = mapNewsDetailFormValuesToMutation(values, 'create');

    expect(mutation).not.toHaveProperty('externalId');
    expect(mutation).not.toHaveProperty('keywords');
    expect(mutation).not.toHaveProperty('newsType');
    expect(mutation).not.toHaveProperty('pointOfInterestId');
    expect(mutation).not.toHaveProperty('address');
    expect(mutation).not.toHaveProperty('charactersToBeShown');
  });

  it.each(compatibilityFieldCases)(
    'applies touched $key compatibility values with their matching runtime type',
    ({ key, mutationKey, validValue, updatedValue }) => {
      const values = mapNewsItemToDetailFormValues(sampleItem);
      defineCompatibilityRuntimeInput(values, key, validValue, true);

      const mutation = mapNewsDetailFormValuesToMutation(values, 'edit');

      expect(readMutationField(mutation, mutationKey)).toEqual(updatedValue);
    }
  );

  it.each(compatibilityFieldCases)(
    'ignores explicitly untouched $key compatibility values',
    ({ key, mutationKey, validValue, initialValue }) => {
      const values = mapNewsItemToDetailFormValues(sampleItem);
      defineCompatibilityRuntimeInput(values, key, validValue, false);

      const mutation = mapNewsDetailFormValuesToMutation(values, 'edit');

      expect(readMutationField(mutation, mutationKey)).toEqual(initialValue);
    }
  );

  it.each(compatibilityFieldCases)(
    'ignores $key compatibility values when the touched marker is missing',
    ({ key, mutationKey, validValue, initialValue }) => {
      const values = mapNewsItemToDetailFormValues(sampleItem);
      defineCompatibilityRuntimeInput(values, key, validValue, undefined);

      const mutation = mapNewsDetailFormValuesToMutation(values, 'edit');

      expect(readMutationField(mutation, mutationKey)).toEqual(initialValue);
    }
  );

  it.each(compatibilityFieldCases)(
    'ignores touched $key compatibility values with a mismatching runtime type',
    ({ key, mutationKey, invalidValue, initialValue }) => {
      const values = mapNewsItemToDetailFormValues(sampleItem);
      defineCompatibilityRuntimeInput(values, key, invalidValue, true);

      const mutation = mapNewsDetailFormValuesToMutation(values, 'edit');

      expect(readMutationField(mutation, mutationKey)).toEqual(initialValue);
    }
  );

  it('applies multiple touched compatibility fields without losing the existing snapshot', () => {
    const values = mapNewsItemToDetailFormValues(sampleItem);
    values.keywords = 'Mehrfach';
    values.externalId = 'ext-multi';
    values.fullVersion = false;
    values.address = { street: 'Nebenstraße 4', zip: '77777', city: 'Anderswo' };

    expect(mapNewsDetailFormValuesToMutation(values, 'edit')).toMatchObject({
      keywords: 'Mehrfach',
      externalId: 'ext-multi',
      fullVersion: false,
      newsType: 'meldung',
      pointOfInterestId: 'poi-1',
      address: { street: 'Nebenstraße 4', zip: '77777', city: 'Anderswo' },
    });
  });

  it.each([true, false, undefined] as const)(
    'stores compatibility content blocks only when touched is %s',
    (touched) => {
      const values = mapNewsItemToDetailFormValues(sampleItem);
      const blocks: NewsContentBlockFormValue[] = [
        {
          title: 'Compatibility-Titel',
          intro: 'Compatibility-Intro',
          body: '<p>Compatibility-Body</p>',
          mediaContents: [],
        },
      ];
      defineCompatibilityRuntimeInput(values, 'contentBlocks', blocks, touched);

      const mutation = mapNewsDetailFormValuesToMutation(values, 'edit');

      if (touched === true) {
        expect(values.__legacySnapshot?.legacyContentBlocks).toBe(blocks);
      } else {
        expect(values.__legacySnapshot?.legacyContentBlocks).not.toBe(blocks);
      }
      expect(mutation.contentBlocks?.[0]).toMatchObject({
        title: 'Rathaus informiert',
        intro: 'Kurzer Einstieg',
        body: '<p>Ausfuehrlicher Inhalt</p>',
      });
      expect(mutation.contentBlocks).not.toBe(blocks);
    }
  );

  it('ignores touched content blocks with a mismatching runtime type', () => {
    const values = mapNewsItemToDetailFormValues(sampleItem);
    const existingBlocks = values.__legacySnapshot?.legacyContentBlocks;
    defineCompatibilityRuntimeInput(values, 'contentBlocks', { title: 'Kein Array' }, true);

    mapNewsDetailFormValuesToMutation(values, 'edit');

    expect(values.__legacySnapshot?.legacyContentBlocks).toBe(existingBlocks);
  });

  it('retains compatibility object references in the snapshot and clones mutation values', () => {
    const values = mapNewsItemToDetailFormValues(sampleItem);
    const address = { street: 'Referenzweg 1', zip: '10101', city: 'Klonstadt' };
    defineCompatibilityRuntimeInput(values, 'address', address, true);

    const mutation = mapNewsDetailFormValuesToMutation(values, 'edit');

    expect(values.__legacySnapshot?.address).toBe(address);
    expect(mutation.address).toEqual(address);
    expect(mutation.address).not.toBe(address);
  });

  it('preserves bullet lists, ordered lists, and links in serialized editor HTML', () => {
    const values = createDefaultNewsDetailFormValues('Redaktion');
    const formattedHtml =
      '<ul><li>Erster Punkt</li></ul><ol><li>Erster Schritt</li></ol><p><a href="https://example.org">Weitere Informationen</a></p>';

    values.title = 'Formatierte Nachricht';
    values.contentBody = formattedHtml;

    expect(mapNewsDetailFormValuesToMutation(values, 'create').contentBlocks?.[0]?.body).toBe(
      formattedHtml
    );
  });

  it('preserves compatibility publicationDate edits distinct from publishedAt', () => {
    const values = createDefaultNewsDetailFormValues('Redaktion');

    values.contentBlocks = [
      { title: 'Block', intro: 'Einleitung', body: '<p>Body</p>', mediaContents: [] },
    ];
    values.publishedAt = '2026-06-01T12:00:00.000Z';
    values.publicationDate = '2026-05-31T18:30:00.000Z';

    const mutation = mapNewsDetailFormValuesToMutation(values, 'create');

    expect(mutation).toMatchObject({
      title: 'Block',
      publishedAt: '2026-06-01T12:00:00.000Z',
      publicationDate: '2026-05-31T18:30:00.000Z',
      contentBlocks: [
        expect.objectContaining({ title: 'Block', intro: 'Einleitung', body: '<p>Body</p>' }),
      ],
    });
  });

  it('keeps an existing distinct publicationDate when only compatibility publishedAt changes on edit', () => {
    const values = mapNewsItemToDetailFormValues(sampleItem);

    values.publishedAt = '2026-06-01T12:00:00.000Z';

    expect(mapNewsDetailFormValuesToMutation(values, 'edit')).toMatchObject({
      publishedAt: '2026-06-01T12:00:00.000Z',
      publicationDate: '2026-05-24T08:00:00.000Z',
      title: 'Rathaus informiert',
      contentBlocks: [
        expect.objectContaining({
          title: 'Rathaus informiert',
          intro: 'Kurzer Einstieg',
          body: '<p>Ausfuehrlicher Inhalt</p>',
        }),
      ],
    });
  });

  it.each([true, false, undefined] as const)(
    'updates publicationDate independently when touched is %s',
    (touched) => {
      const values = mapNewsItemToDetailFormValues(sampleItem);
      defineCompatibilityRuntimeInput(
        values,
        'publicationDate',
        '2026-07-01T08:15:00.000Z',
        touched
      );

      const mutation = mapNewsDetailFormValuesToMutation(values, 'edit');

      expect(mutation.publicationDate).toBe(
        touched === true ? '2026-07-01T08:15:00.000Z' : '2026-05-24T09:00:00.000Z'
      );
      expect(mutation.publishedAt).toBe('2026-05-24T09:00:00.000Z');
    }
  );

  it('ignores a touched publicationDate with a mismatching runtime type', () => {
    const values = mapNewsItemToDetailFormValues(sampleItem);
    defineCompatibilityRuntimeInput(values, 'publicationDate', 1_780_300_000_000, true);

    const mutation = mapNewsDetailFormValuesToMutation(values, 'edit');

    expect(mutation.publicationDate).toBe('2026-05-24T08:00:00.000Z');
    expect(values.__legacySnapshot?.publicationDate).toBe('2026-05-24T08:00:00.000Z');
  });

  it.each([false, undefined] as const)(
    'ignores a matching publishedAt value when touched is %s',
    (touched) => {
      const values = mapNewsItemToDetailFormValues(sampleItem);
      defineCompatibilityRuntimeInput(values, 'publishedAt', '2026-07-02T09:30', touched);

      const mutation = mapNewsDetailFormValuesToMutation(values, 'edit');

      expect(mutation.publishedAt).toBe('2026-05-24T09:00:00.000Z');
      expect(values.publicationMode).toBe('immediate');
    }
  );

  it('ignores a touched publishedAt value with a mismatching runtime type', () => {
    const values = mapNewsItemToDetailFormValues(sampleItem);
    defineCompatibilityRuntimeInput(values, 'publishedAt', { iso: '2026-07-02T09:30' }, true);

    const mutation = mapNewsDetailFormValuesToMutation(values, 'edit');

    expect(mutation.publishedAt).toBe('2026-05-24T09:00:00.000Z');
    expect(values.__legacySnapshot?.publishedAt).toBe('2026-05-24T09:00:00.000Z');
  });

  it('synchronizes a touched publishedAt only for a draft without a scheduled value', () => {
    const eligibleDraft = mapNewsItemToDetailFormValues(sampleItem);
    eligibleDraft.publicationMode = 'draft';
    eligibleDraft.scheduledPublicationAt = '';
    defineCompatibilityRuntimeInput(eligibleDraft, 'publishedAt', '2026-07-02T09:30', true);

    const occupiedDraft = mapNewsItemToDetailFormValues(sampleItem);
    occupiedDraft.publicationMode = 'draft';
    occupiedDraft.scheduledPublicationAt = '2026-07-03T10:45';
    defineCompatibilityRuntimeInput(occupiedDraft, 'publishedAt', '2026-07-02T09:30', true);

    const scheduled = mapNewsItemToDetailFormValues(sampleItem);
    scheduled.publicationMode = 'scheduled';
    scheduled.scheduledPublicationAt = '2026-07-04T11:00';
    defineCompatibilityRuntimeInput(scheduled, 'publishedAt', '2026-07-02T09:30', true);

    expect(mapNewsDetailFormValuesToMutation(eligibleDraft, 'edit')).toMatchObject({
      publishedAt: '2026-07-02T09:30',
      publicationDate: '2026-05-24T08:00:00.000Z',
    });
    expect(eligibleDraft).toMatchObject({ publicationMode: 'draft', scheduledPublicationAt: '' });

    expect(mapNewsDetailFormValuesToMutation(occupiedDraft, 'edit').publishedAt).toBe(
      '2026-07-02T09:30'
    );
    expect(occupiedDraft).toMatchObject({
      publicationMode: 'draft',
      scheduledPublicationAt: '2026-07-03T10:45',
    });

    expect(mapNewsDetailFormValuesToMutation(scheduled, 'edit').publishedAt).toBe(
      '2026-07-04T11:00'
    );
    expect(scheduled).toMatchObject({
      publicationMode: 'scheduled',
      scheduledPublicationAt: '2026-07-04T11:00',
    });
  });

  it('keeps blank publishedAt handling distinct for draft and scheduled values', () => {
    const draft = mapNewsItemToDetailFormValues(sampleItem);
    draft.publicationMode = 'draft';
    draft.scheduledPublicationAt = '';
    defineCompatibilityRuntimeInput(draft, 'publishedAt', '', true);

    const scheduled = mapNewsItemToDetailFormValues(sampleItem);
    scheduled.publicationMode = 'scheduled';
    scheduled.scheduledPublicationAt = '2026-07-04T11:00';
    defineCompatibilityRuntimeInput(scheduled, 'publishedAt', '', true);

    const draftMutation = mapNewsDetailFormValuesToMutation(draft, 'edit');
    const scheduledMutation = mapNewsDetailFormValuesToMutation(scheduled, 'edit');

    expect(draft).toMatchObject({ publicationMode: 'draft', scheduledPublicationAt: '' });
    expect(Number.isNaN(new Date(draftMutation.publishedAt).getTime())).toBe(false);
    expect(scheduledMutation.publishedAt).toBe('2026-07-04T11:00');
  });

  it('serializes edit payloads from the simplified fields even when compatibility data disagrees', () => {
    const values = mapNewsItemToDetailFormValues(sampleItem);

    values.contentBlocks = [
      {
        title: 'Legacy Abschnitt',
        intro: 'Legacy-Einleitung',
        body: '<p>Legacy Inhalt</p>',
        mediaContents: [],
      },
    ];
    values.publishedAt = '2020-01-01T00:00:00.000Z';
    values.publicationDate = '2020-01-01T00:00:00.000Z';
    values.title = 'Aktualisierte News';
    values.contentIntro = 'Neue Einleitung';
    values.contentBody = '<p>Neuer Inhalt</p>';
    values.publicationMode = 'scheduled';
    values.scheduledPublicationAt = '2026-06-01T12:00:00.000Z';
    values.pushNotificationEnabled = true;

    expect(mapNewsDetailFormValuesToMutation(values, 'edit')).toMatchObject({
      externalId: 'ext-42',
      newsType: 'meldung',
      charactersToBeShown: 180,
      fullVersion: true,
      showPublishDate: false,
      pointOfInterestId: 'poi-1',
      keywords: 'Rathaus, Termin',
      title: 'Aktualisierte News',
      publishedAt: '2026-06-01T12:00:00.000Z',
      publicationDate: '2020-01-01T00:00:00.000Z',
      contentBlocks: [
        expect.objectContaining({
          title: 'Aktualisierte News',
          intro: 'Neue Einleitung',
          body: '<p>Neuer Inhalt</p>',
        }),
      ],
    });
  });

  it.each(['create', 'edit'] as const)(
    'keeps simplified editorial values ahead of contradictory compatibility blocks in %s mode',
    (mode) => {
      const values = mapNewsItemToDetailFormValues(sampleItem);
      const compatibilityBlocks: NewsContentBlockFormValue[] = [
        {
          title: 'Legacy-Titel',
          intro: 'Legacy-Intro',
          body: '<p>Legacy-Body</p>',
          mediaContents: [],
        },
      ];
      values.title = 'Führender Titel';
      values.contentIntro = 'Führendes Intro';
      values.contentBody = '<p>Führender Body</p>';
      defineCompatibilityRuntimeInput(values, 'contentBlocks', compatibilityBlocks, true);

      expect(mapNewsDetailFormValuesToMutation(values, mode).contentBlocks?.[0]).toMatchObject({
        title: 'Führender Titel',
        intro: 'Führendes Intro',
        body: '<p>Führender Body</p>',
      });
    }
  );

  it('keeps push inclusion distinct for create and previously notified edits', () => {
    const values = mapNewsItemToDetailFormValues({
      ...sampleItem,
      pushNotificationsSentAt: '2026-05-24T09:01:00.000Z',
    });
    defineCompatibilityRuntimeInput(values, 'pushNotification', true, true);

    expect(mapNewsDetailFormValuesToMutation(values, 'create').pushNotification).toBe(true);
    expect(mapNewsDetailFormValuesToMutation(values, 'edit')).not.toHaveProperty(
      'pushNotification'
    );
  });

  it.each(['draft', 'scheduled'] as const)(
    'omits Push delivery from the final mapper for %s news',
    (publicationMode) => {
      const values = mapNewsItemToDetailFormValues(sampleItem);
      values.publicationMode = publicationMode;
      values.scheduledPublicationAt =
        publicationMode === 'scheduled' ? '2026-06-01T12:00:00.000Z' : '';
      values.pushNotificationEnabled = true;

      expect(mapNewsDetailFormValuesToMutation(values, 'create')).not.toHaveProperty(
        'pushNotification'
      );
    }
  );

  it('includes Push delivery from the final mapper for immediate publication', () => {
    const values = mapNewsItemToDetailFormValues(sampleItem);
    values.publicationMode = 'immediate';
    values.pushNotificationEnabled = true;

    expect(mapNewsDetailFormValuesToMutation(values, 'create')).toHaveProperty(
      'pushNotification',
      true
    );
  });

  it('validates the compatibility-only schema branches for legacy fields and invalid urls', async () => {
    await expect(
      newsDetailFormSchema.parseAsync({
        ...createDefaultNewsDetailFormValues(),
        title: 'Legacy News',
        author: '',
        categories: [],
        contentIntro: '',
        contentBody: '<p>   </p>',
        contentMedia: [
          {
            captionText: '',
            copyright: '',
            contentType: '',
            height: '',
            width: '',
            sourceUrl: { url: 'http://example.org/image.jpg', description: '' },
          },
        ],
        sourceUrl: { url: 'http://example.org/details', description: '' },
        sourceUrlDescription: '',
        publicationMode: 'draft',
        scheduledPublicationAt: '',
        publishedAt: '2026-02-31T12:00',
        publicationDate: '2026-13-01T12:00',
        charactersToBeShown: '-1',
        contentBlocks: [{ title: '', intro: '', body: '<p> </p>', mediaContents: [] }],
      })
    ).rejects.toThrow();
  });

  it('accepts legacy fallback content blocks and local compatibility timestamps when they are valid', async () => {
    await expect(
      newsDetailFormSchema.parseAsync({
        ...createDefaultNewsDetailFormValues(),
        title: 'Legacy News',
        author: '',
        categories: [],
        contentIntro: '',
        contentBody: '<p>   </p>',
        contentMedia: [],
        sourceUrl: { url: '', description: '' },
        sourceUrlDescription: '',
        publicationMode: 'draft',
        scheduledPublicationAt: '',
        publishedAt: '2026-02-28T12:30',
        publicationDate: '2026-02-28T12:45',
        charactersToBeShown: '0',
        contentBlocks: [
          { title: 'Legacy', intro: 'Fallback', body: '<p>Body</p>', mediaContents: [] },
        ],
      })
    ).resolves.toMatchObject({
      publishedAt: '2026-02-28T12:30',
      publicationDate: '2026-02-28T12:45',
    });
  });

  it('accepts explicit http urls for media while keeping the article source https-only', async () => {
    await expect(
      newsDetailFormSchema.parseAsync({
        ...createDefaultNewsDetailFormValues(),
        title: 'HTTP-Bild',
        publishedAt: '2026-08-21T12:00',
        sourceUrl: { url: 'https://example.org/details', description: '' },
        contentMedia: [
          {
            captionText: '',
            copyright: '',
            contentType: 'image',
            height: '',
            width: '',
            sourceUrl: { url: 'http://example.org/image.jpg', description: '' },
          },
        ],
      })
    ).resolves.toBeTruthy();
  });

  it('normalizes editor content from compatibility content blocks and touched aliases', () => {
    const values = createDefaultNewsDetailFormValues();

    values.contentBlocks = [
      {
        title: 'Legacy Titel',
        intro: 'Legacy-Einleitung',
        body: '<p>Legacy Inhalt</p>',
        mediaContents: [
          {
            captionText: 'Bild',
            copyright: 'CC',
            contentType: 'image/jpeg',
            height: '320',
            width: '640',
            sourceUrl: { url: 'https://example.org/image.jpg', description: 'Bildquelle' },
          },
        ],
      },
    ];
    values.keywords = 'Rathaus';
    values.externalId = 'ext-42';
    values.newsType = 'meldung';
    values.charactersToBeShown = '180';
    values.fullVersion = true;
    values.showPublishDate = false;
    values.pushNotification = true;
    values.publishedAt = '2026-06-01T12:30';
    values.publicationDate = '2026-05-31T18:45:00.000Z';
    values.address = {
      street: 'Marktplatz 1',
      zip: '12345',
      city: 'Musterstadt',
    };
    values.pointOfInterestId = 'poi-1';
    const mutation = mapNewsDetailFormValuesToMutation(values, 'edit');

    expect(mutation).toMatchObject({
      title: 'Legacy Titel',
      keywords: 'Rathaus',
      externalId: 'ext-42',
      newsType: 'meldung',
      charactersToBeShown: 180,
      fullVersion: true,
      showPublishDate: false,
      publishedAt: '2026-06-01T12:30',
      publicationDate: '2026-05-31T18:45:00.000Z',
      address: {
        street: 'Marktplatz 1',
        zip: '12345',
        city: 'Musterstadt',
      },
      pointOfInterestId: 'poi-1',
      contentBlocks: [
        {
          title: 'Legacy Titel',
          intro: 'Legacy-Einleitung',
          body: '<p>Legacy Inhalt</p>',
          mediaContents: [
            {
              captionText: 'Bild',
              copyright: 'CC',
              contentType: 'image/jpeg',
              height: 320,
              width: 640,
              sourceUrl: { url: 'https://example.org/image.jpg', description: 'Bildquelle' },
            },
          ],
        },
      ],
    });
  });

  it('maps publishedAt compatibility edits back into draft and scheduled publication modes', () => {
    const draftValues = createDefaultNewsDetailFormValues();
    draftValues.publishedAt = '';

    mapNewsDetailFormValuesToMutation(draftValues, 'edit');
    expect(draftValues.publicationMode).toBe('draft');
    expect(draftValues.scheduledPublicationAt).toBe('');

    const invalidValues = createDefaultNewsDetailFormValues();
    invalidValues.publishedAt = 'invalid-date';

    mapNewsDetailFormValuesToMutation(invalidValues, 'edit');
    expect(invalidValues.publicationMode).toBe('draft');
    expect(invalidValues.scheduledPublicationAt).toBe('');

    const scheduledValues = createDefaultNewsDetailFormValues();
    scheduledValues.publishedAt = '2026-06-01T12:30';

    mapNewsDetailFormValuesToMutation(scheduledValues, 'edit');
    expect(scheduledValues.publicationMode).toBe('scheduled');
    expect(scheduledValues.scheduledPublicationAt).toBe('2026-06-01T12:30');
  });

  it('omits non-finite media dimensions from serialized mutations', () => {
    const values = createDefaultNewsDetailFormValues('Redaktion');

    values.title = 'Neue News';
    values.contentIntro = 'Einleitung';
    values.contentBody = '<p>Body</p>';
    values.contentMedia = [
      {
        captionText: 'Bild',
        copyright: '',
        contentType: 'image',
        height: 'auto',
        width: '640',
        sourceUrl: { url: 'https://example.org/image.jpg', description: 'Bildquelle' },
      },
    ];

    expect(mapNewsDetailFormValuesToMutation(values, 'create')).toMatchObject({
      contentBlocks: [
        {
          mediaContents: [
            {
              captionText: 'Bild',
              contentType: 'image',
              width: 640,
              sourceUrl: { url: 'https://example.org/image.jpg', description: 'Bildquelle' },
            },
          ],
        },
      ],
    });
    expect(
      mapNewsDetailFormValuesToMutation(values, 'create').contentBlocks?.[0]?.mediaContents?.[0]
    ).not.toHaveProperty('height');
  });

  it('derives dirty tabs and character counts from simplified and compatibility-driven fields', () => {
    expect(
      deriveDirtyNewsDetailTabs({
        categories: true,
        contentMedia: [{ sourceUrl: true }],
        pushNotificationEnabled: true,
      })
    ).toEqual({
      basis: true,
      content: true,
      settings: true,
      history: false,
    });
    expect(deriveDirtyNewsDetailTabs({ wasteLocationKeys: true }).settings).toBe(true);

    expect(
      buildNewsDetailCharacterCounts({
        title: 'Titel',
        contentBlocks: [
          { intro: 'Kurz', body: '<p>Mehr Text</p>' },
          { intro: 'Noch eins', body: '<p>Body 2</p>' },
        ],
      })
    ).toEqual({
      title: 5,
      intros: [4, 9],
      bodies: [9, 6],
    });
  });
});
