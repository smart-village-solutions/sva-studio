import {
  buildClientSchema,
  getVariableValues,
  parse,
  validate,
  visit,
  type IntrospectionQuery,
  type OperationDefinitionNode,
} from 'graphql';
import { describe, expect, it } from 'vitest';

import schemaSnapshot from '../../generated/schema.snapshot.json';
import {
  svaMainserverCreateEventDocument,
  svaMainserverEventDetailDocument,
  svaMainserverEventListDocument,
  svaMainserverEventUpdateSnapshotDocument,
  svaMainserverPoiDetailDocument,
  svaMainserverPoiListDocument,
} from '../../generated/events-poi.js';
import type { SvaMainserverEventInput, SvaMainserverInstanceConfig } from '../../types.js';
import { createEventOperations } from './event-operations.js';
import type { ServiceContext } from './service-context.js';
import { createEventService } from './service-events.js';
import type { GraphqlOperationInput } from './shared.js';

const schema = buildClientSchema(schemaSnapshot.data as unknown as IntrospectionQuery);

const config = { instanceId: 'instance-1' } as SvaMainserverInstanceConfig;
const connection = { instanceId: 'instance-1', keycloakSubject: 'subject-1' };

// Shape of an event written by an external import into the Mainserver, including fields the
// Studio editor does not show. All values are synthetic test data.
const importedEvent = () => ({
  id: 'event-import-1',
  title: 'Flohmarkt im Park',
  description: '<p>Trödel und Kuchen</p>',
  externalId: 'import-4711',
  keywords: 'flohmarkt',
  parentId: null,
  registrationRequired: true,
  maximumAttendees: 120,
  payload: { source: 'ticket-import', sourceEventId: 4711 },
  dates: [
    {
      id: 'date-1',
      dateStart: '2026-09-05',
      dateEnd: '2026-09-05',
      timeStart: '10:00',
      timeEnd: '16:00',
      weekday: 'Samstag',
      timeDescription: null,
      useOnlyTimeDescription: 'false',
    },
  ],
  listDate: '2026-09-05',
  sortDate: '2026-09-05',
  repeat: false,
  repeatDuration: {
    id: 'repeat-1',
    startDate: '2026-09-05',
    endDate: '2026-10-31',
    everyYear: false,
  },
  recurring: false,
  recurringType: null,
  recurringInterval: null,
  recurringWeekdays: [],
  category: { id: 'cat-1', name: 'Markt' },
  categories: [{ id: 'cat-1', name: 'Markt' }],
  addresses: [
    {
      id: 'address-1',
      street: 'Parkweg 1',
      zip: '12345',
      city: 'Musterstadt',
      kind: 'default',
      geoLocation: { latitude: 51.9, longitude: 14.7 },
    },
  ],
  location: {
    id: 'location-1',
    name: 'Stadtpark',
    regionName: 'Musterkreis',
    geoLocation: { latitude: 51.9, longitude: 14.7 },
  },
  contacts: [
    {
      id: 'contact-1',
      firstName: 'Erika',
      lastName: 'Muster',
      email: 'kontakt@example.test',
      webUrls: [],
    },
  ],
  urls: [{ id: 'url-1', url: 'https://tickets.example.test/4711', description: 'Tickets' }],
  mediaContents: [
    {
      id: 'media-1',
      captionText: 'Plakat',
      copyright: 'Veranstalter',
      contentType: 'image',
      height: 800,
      width: 600,
      payload: { sourceImageId: 'img-1' },
      sourceUrl: {
        id: 'media-url-1',
        url: 'https://media.example.test/plakat.jpg',
        description: 'Plakat',
      },
    },
  ],
  organizer: { id: 'organizer-1', name: 'Kulturverein Musterstadt' },
  priceInformations: [
    {
      id: 'price-1',
      name: 'Ermäßigt',
      amount: 4,
      groupPrice: false,
      ageFrom: 6,
      ageTo: 17,
      minAdultCount: null,
      maxAdultCount: null,
      minChildrenCount: 1,
      maxChildrenCount: 3,
      description: 'Kinder und Jugendliche',
      category: 'Kinder',
    },
  ],
  accessibilityInformation: {
    id: 'a11y-1',
    description: 'Stufenlos erreichbar',
    types: 'wheelchair',
    urls: [{ id: 'a11y-url-1', url: 'https://example.test/barrierefreiheit', description: null }],
  },
  tagList: ['markt'],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-02T10:00:00.000Z',
  visible: true,
  dataProvider: { id: 'provider-1', name: 'Import' },
});

// Fields the Studio editor submits for this event after an unchanged save.
const editorSubmission = (): SvaMainserverEventInput => ({
  title: 'Flohmarkt im Park',
  description: '<p>Trödel und Kuchen</p>',
  externalId: 'import-4711',
  keywords: 'flohmarkt',
  registrationRequired: true,
  maximumAttendees: 120,
  dates: [
    {
      weekday: 'Samstag',
      dateStart: '2026-09-05',
      dateEnd: '2026-09-05',
      timeStart: '10:00',
      timeEnd: '16:00',
    },
  ],
  repeat: false,
  categoryName: 'Markt',
  categories: [{ name: 'Markt' }],
  addresses: [
    {
      street: 'Parkweg 1',
      zip: '12345',
      city: 'Musterstadt',
      kind: 'default',
      geoLocation: { latitude: 51.9, longitude: 14.7 },
    },
  ],
  contacts: [{ firstName: 'Erika', lastName: 'Muster', email: 'kontakt@example.test' }],
  urls: [{ url: 'https://tickets.example.test/4711', description: 'Tickets' }],
  mediaContents: [
    {
      id: 'media-1',
      captionText: 'Plakat',
      copyright: 'Veranstalter',
      contentType: 'image',
      height: 800,
      width: 600,
      sourceUrl: { url: 'https://media.example.test/plakat.jpg', description: 'Plakat' },
    },
  ],
  organizer: { name: 'Kulturverein Musterstadt' },
  priceInformations: [
    {
      name: 'Ermäßigt',
      amount: 4,
      groupPrice: false,
      ageFrom: 6,
      ageTo: 17,
      minChildrenCount: 1,
      maxChildrenCount: 3,
      description: 'Kinder und Jugendliche',
      category: 'Kinder',
    },
  ],
  accessibilityInformation: {
    description: 'Stufenlos erreichbar',
    types: 'wheelchair',
    urls: [{ url: 'https://example.test/barrierefreiheit' }],
  },
  tags: ['markt'],
  recurringWeekdays: [],
});

const createHarness = (stored: Record<string, unknown>) => {
  const writes: Record<string, unknown>[] = [];
  const executor = async <TResult>(input: GraphqlOperationInput): Promise<TResult> => {
    if (input.operationName !== 'SvaMainserverCreateEvent') {
      return { eventRecord: stored } as TResult;
    }
    writes.push(input.variables ?? {});
    return { createEventRecord: stored } as TResult;
  };
  const service = createEventService({
    loadValidatedInstanceConfig: async () => config,
    eventOperations: createEventOperations(executor),
  } as unknown as ServiceContext);
  return { service, writes };
};

const selectsMediaPayload = (document: string) => {
  let found = false;
  visit(parse(document), {
    Field(node) {
      if (node.name.value === 'mediaContents') {
        found ||=
          node.selectionSet?.selections.some(
            (selection) => selection.kind === 'Field' && selection.name.value === 'payload'
          ) ?? false;
      }
    },
  });
  return found;
};

const assertValidMutationVariables = (variables: Record<string, unknown>) => {
  const operation = parse(svaMainserverCreateEventDocument)
    .definitions[0] as OperationDefinitionNode;
  const coerced = getVariableValues(schema, operation.variableDefinitions ?? [], variables);
  expect(coerced.errors?.map((error) => error.message) ?? []).toEqual([]);
};

describe('event import round trip against the Mainserver contract', () => {
  it.each([
    ['list', svaMainserverEventListDocument],
    ['detail', svaMainserverEventDetailDocument],
    ['create/update', svaMainserverCreateEventDocument],
    ['update snapshot', svaMainserverEventUpdateSnapshotDocument],
  ])('validates the event %s document against the schema snapshot', (_name, document) => {
    expect(validate(schema, parse(document)).map((error) => error.message)).toEqual([]);
  });

  it('selects media payloads only in the server-side read before an update', () => {
    expect(selectsMediaPayload(svaMainserverEventUpdateSnapshotDocument)).toBe(true);
    for (const document of [
      svaMainserverEventListDocument,
      svaMainserverEventDetailDocument,
      svaMainserverCreateEventDocument,
      svaMainserverPoiListDocument,
      svaMainserverPoiDetailDocument,
    ]) {
      expect(selectsMediaPayload(document)).toBe(false);
    }
  });

  it('reads registration requirement, participant limit and source relations into the projection', async () => {
    const { service } = createHarness(importedEvent());

    const detail = await service.getEventDetail({ ...connection, eventId: 'event-import-1' });

    expect(detail.deviations).toEqual([]);
    expect(detail.data).toMatchObject({
      registrationRequired: true,
      maximumAttendees: 120,
      location: { name: 'Stadtpark', regionName: 'Musterkreis' },
      repeatDuration: { startDate: '2026-09-05', endDate: '2026-10-31', everyYear: false },
      priceInformations: [expect.objectContaining({ ageFrom: 6, maxChildrenCount: 3 })],
    });
  });

  it('keeps every field of an imported event on an unchanged editor save', async () => {
    const stored = importedEvent();
    const { service, writes } = createHarness(stored);

    await service.updateEvent({
      ...connection,
      eventId: 'event-import-1',
      event: editorSubmission(),
    });

    const variables = writes[0] ?? {};
    assertValidMutationVariables(variables);
    expect(variables).toMatchObject({
      id: 'event-import-1',
      forceCreate: true,
      externalId: 'import-4711',
      registrationRequired: true,
      maximumAttendees: 120,
      location: {
        name: 'Stadtpark',
        regionName: 'Musterkreis',
        geoLocation: { latitude: 51.9, longitude: 14.7 },
      },
      repeatDuration: { startDate: '2026-09-05', endDate: '2026-10-31', everyYear: false },
      mediaContents: [expect.objectContaining({ payload: { sourceImageId: 'img-1' } })],
      priceInformations: [
        expect.objectContaining({
          ageFrom: 6,
          ageTo: 17,
          minChildrenCount: 1,
          maxChildrenCount: 3,
        }),
      ],
      accessibilityInformation: {
        description: 'Stufenlos erreichbar',
        types: 'wheelchair',
        urls: [{ url: 'https://example.test/barrierefreiheit' }],
      },
      tags: ['markt'],
      payload: expect.objectContaining({ source: 'ticket-import', sourceEventId: 4711 }),
    });
    expect(variables.location).not.toHaveProperty('id');
    expect(variables.repeatDuration).not.toHaveProperty('id');
  });

  it('keeps hidden source data when the editor changes only the title', async () => {
    const { service, writes } = createHarness(importedEvent());

    await service.updateEvent({
      ...connection,
      eventId: 'event-import-1',
      event: { ...editorSubmission(), title: 'Herbstflohmarkt im Park' },
    });

    expect(writes[0]).toMatchObject({
      title: 'Herbstflohmarkt im Park',
      location: expect.objectContaining({ name: 'Stadtpark' }),
      repeatDuration: expect.objectContaining({ endDate: '2026-10-31' }),
      mediaContents: [expect.objectContaining({ payload: { sourceImageId: 'img-1' } })],
    });
  });

  it('writes edited participation values and clears the limit with null', async () => {
    const { service, writes } = createHarness(importedEvent());

    await service.updateEvent({
      ...connection,
      eventId: 'event-import-1',
      event: { ...editorSubmission(), registrationRequired: false, maximumAttendees: null },
    });

    assertValidMutationVariables(writes[0] ?? {});
    expect(writes[0]).toMatchObject({ registrationRequired: false, maximumAttendees: null });
  });

  it('keeps stored participation values when a client omits them', async () => {
    const { service, writes } = createHarness(importedEvent());
    const {
      registrationRequired: _required,
      maximumAttendees: _limit,
      ...submission
    } = editorSubmission();

    await service.updateEvent({ ...connection, eventId: 'event-import-1', event: submission });

    expect(writes[0]).toMatchObject({ registrationRequired: true, maximumAttendees: 120 });
  });

  it('does not attach a stored media payload to a replaced image', async () => {
    const { service, writes } = createHarness(importedEvent());
    const submission = editorSubmission();

    await service.updateEvent({
      ...connection,
      eventId: 'event-import-1',
      event: {
        ...submission,
        mediaContents: [
          { captionText: 'Neu', sourceUrl: { url: 'https://media.example.test/neu.jpg' } },
        ],
      },
    });

    expect(writes[0]?.mediaContents).toEqual([
      { captionText: 'Neu', sourceUrl: { url: 'https://media.example.test/neu.jpg' } },
    ]);
  });

  it('keeps each payload with its own entry when two media entries share a URL', async () => {
    const url = 'https://media.example.test/plakat.jpg';
    const stored = {
      ...importedEvent(),
      mediaContents: [
        {
          id: 'media-1',
          captionText: 'Erstes',
          payload: { sourceImageId: 'img-1' },
          sourceUrl: { url },
        },
        {
          id: 'media-2',
          captionText: 'Zweites',
          payload: { sourceImageId: 'img-2' },
          sourceUrl: { url },
        },
      ],
    };
    const { service, writes } = createHarness(stored);

    await service.updateEvent({
      ...connection,
      eventId: 'event-import-1',
      event: {
        ...editorSubmission(),
        mediaContents: [{ id: 'media-2', captionText: 'Zweites', sourceUrl: { url } }],
      },
    });

    assertValidMutationVariables(writes[0] ?? {});
    expect(writes[0]?.mediaContents).toEqual([
      { captionText: 'Zweites', payload: { sourceImageId: 'img-2' }, sourceUrl: { url } },
    ]);
  });

  it('refuses a title-only update when the media snapshot is degraded and sends no write', async () => {
    const stored = importedEvent();
    const { service, writes } = createHarness({
      ...stored,
      mediaContents: [{ ...stored.mediaContents[0], height: '800' }],
    });
    const { mediaContents: _omitted, ...submission } = editorSubmission();

    await expect(
      service.updateEvent({
        ...connection,
        eventId: 'event-import-1',
        event: { ...submission, title: 'Neuer Titel' },
      })
    ).rejects.toMatchObject({ message: 'event_source_snapshot_incomplete' });
    expect(writes).toEqual([]);
  });

  it('refuses an update that omits any other degraded relation', async () => {
    const { service, writes } = createHarness({
      ...importedEvent(),
      addresses: [{ id: 'address-1', street: 42 }],
    });
    const { addresses: _omitted, ...submission } = editorSubmission();

    await expect(
      service.updateEvent({ ...connection, eventId: 'event-import-1', event: submission })
    ).rejects.toMatchObject({ message: 'event_source_snapshot_incomplete' });
    expect(writes).toEqual([]);
  });

  it('writes a degraded relation that the editor corrected', async () => {
    const stored = importedEvent();
    const { service, writes } = createHarness({
      ...stored,
      mediaContents: [{ ...stored.mediaContents[0], height: '800' }],
    });

    await service.updateEvent({
      ...connection,
      eventId: 'event-import-1',
      event: editorSubmission(),
    });

    // The malformed entry was dropped while reading, so its payload is unknown; the confirmed
    // correction writes exactly what the editor submitted.
    assertValidMutationVariables(writes[0] ?? {});
    expect(writes[0]?.mediaContents).toEqual([
      expect.objectContaining({ captionText: 'Plakat', height: 800 }),
    ]);
    expect(writes[0]?.mediaContents).toEqual([
      expect.not.objectContaining({ payload: expect.anything() }),
    ]);
  });

  it('refuses the update instead of deleting a location that could not be read', async () => {
    const { service, writes } = createHarness({ ...importedEvent(), location: { name: 42 } });

    await expect(
      service.updateEvent({ ...connection, eventId: 'event-import-1', event: editorSubmission() })
    ).rejects.toMatchObject({
      code: 'invalid_response',
      message: 'event_source_snapshot_incomplete',
    });
    expect(writes).toEqual([]);
  });
});
