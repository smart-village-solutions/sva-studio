import { describe, expect, it, vi } from 'vitest';
import {
  buildClientSchema,
  coerceInputValue,
  getOperationAST,
  parse,
  type IntrospectionQuery,
  typeFromAST,
} from 'graphql';
import schemaSnapshot from '../../generated/schema.snapshot.json';
import { constructionSiteWriteFields } from '../../generated/construction-sites.js';
import { constructionSiteRead } from '../construction-sites-snapshot.js';
import { createConstructionSiteService } from './service-construction-sites.js';
import type { WriteShape, RawRecord } from '../vouchers-snapshot.js';

const blank = (shape: WriteShape) =>
  Object.fromEntries(
    Object.entries(shape).map(([key, value]) => [key, typeof value === 'object' ? [] : null])
  );
function setup(defaultCategory?: string) {
  let stored: RawRecord = {
    ...blank(constructionSiteWriteFields),
    id: '42',
    title: 'Alt',
    genericType: 'ConstructionSite',
    visible: false,
    ancestry: null,
    memberId: null,
    pointOfInterest: null,
    genericItems: [],
    genericItemMessages: [],
    pushNotifications: [],
    quota: null,
    discountType: null,
    updatedAt: '2026-11-01T10:00:00Z',
    dataProvider: { id: 'provider-1' },
    payload: {
      opaque: { keep: [1, 2] },
      restrictions: [{ description: 'Langsam', extra: 'keep' }],
    },
    dates: [
      {
        ...blank(constructionSiteWriteFields.dates),
        dateStart: '2026-11-01',
        dateEnd: '2026-11-10',
        weekday: 'Monday',
      },
    ],
    contentBlocks: [
      {
        ...blank(constructionSiteWriteFields.contentBlocks),
        body: '<p>Text</p>',
        title: 'Erhalten',
      },
    ],
    locations: [
      {
        ...blank(constructionSiteWriteFields.locations),
        name: 'Brücke',
        district: 'Mitte',
        geoLocation: { latitude: 52, longitude: 13 },
      },
    ],
    categories: [
      { name: 'Verkehr', active: true },
      { name: 'Alt', active: false },
    ],
  };
  let tamper: 'locations' | 'categories' | undefined;
  const schema = buildClientSchema(schemaSnapshot.data as unknown as IntrospectionQuery);
  const execute = vi.fn(
    async (call: {
      operationName: string;
      document: string;
      variables: RawRecord;
      allowRetry?: boolean;
    }) => {
      if (call.operationName === 'SvaMainserverConstructionSiteWrite') {
        // Validate the actual request variables, not only the intended mapper object.
        for (const variable of getOperationAST(parse(call.document))!.variableDefinitions ?? []) {
          const type = typeFromAST(schema, variable.type);
          if (!type || !('parseValue' in type || 'ofType' in type || 'getFields' in type))
            throw new Error('missing input type');
          coerceInputValue(
            call.variables[variable.variable.name.value],
            type as Parameters<typeof coerceInputValue>[1]
          );
        }
        // Model ResourceService: delete all nested relations before rebuilding them.
        const emptyRelations = Object.fromEntries(
          Object.entries(constructionSiteWriteFields)
            .filter(([, field]) => typeof field === 'object')
            .map(([key]) => [key, []])
        );
        stored = {
          ...stored,
          ...emptyRelations,
          ...call.variables,
          categories: [
            ...(call.variables.categories as RawRecord[]).map((item) => ({
              ...item,
              active: true,
            })),
            ...(defaultCategory ? [{ name: defaultCategory, active: true }] : []),
          ],
        };
        if (tamper) stored[tamper] = [];
        return { createGenericItem: { id: stored.id } };
      }
      const read = {
        ...stored,
        categories: (stored.categories as RawRecord[])
          .filter((category) => category.active)
          .map(({ name }) => ({ name })),
      };
      return call.operationName === 'SvaMainserverConstructionSiteList'
        ? { genericItems: [read] }
        : { genericItem: structuredClone(read) };
    }
  );
  const service = createConstructionSiteService({
    loadValidatedInstanceConfig: vi.fn(),
    executeGraphqlWithConfig: execute as Parameters<
      typeof createConstructionSiteService
    >[0]['executeGraphqlWithConfig'],
  });
  return {
    service,
    execute,
    stored: () => stored,
    tamper: (field: 'locations' | 'categories' = 'locations') => {
      tamper = field;
    },
  };
}
const connection = { instanceId: 'tenant-1', keycloakSubject: 'subject-1' };
describe('ConstructionSite GraphQL roundtrip', () => {
  it('keeps active memberships and unrelated content; accepted inactive membership can disappear', async () => {
    const { service, stored, execute } = setup();
    const current = await service.getConstructionSite({ ...connection, siteId: '42' });
    const prepared = service.prepareConstructionSite(
      { ...current.data.input, title: 'Neu' },
      'operation-1',
      current.item
    );
    const data = await service.writeConstructionSite({ ...connection, prepared });
    expect(data.id).toBe('42');
    expect(data.title).toBe('Neu');
    expect(stored().categories).toEqual([{ name: 'Verkehr', active: true }]);
    expect(stored().payload).toMatchObject({
      opaque: { keep: [1, 2] },
      restrictions: [{ extra: 'keep' }],
    });
    expect(stored().locations).toEqual(current.item.locations);
    expect(stored().contentBlocks).toEqual(current.item.contentBlocks);
    expect(stored().dates).toEqual(current.item.dates);
    const writes = execute.mock.calls.filter(([call]) => call.operationName.endsWith('Write'));
    expect(writes).toHaveLength(1);
    expect(writes[0]![0].allowRetry).toBe(false);
  });
  it('accepts provider defaults while removing a deselected ordinary category', async () => {
    const { service, stored, execute } = setup('Providerstandard');
    const current = await service.getConstructionSite({ ...connection, siteId: '42' });
    const prepared = service.prepareConstructionSite(
      { ...current.data.input, categories: [] },
      'operation-default',
      current.item
    );
    const data = await service.writeConstructionSite({ ...connection, prepared });
    expect(data.input.categories).toEqual([{ name: 'Providerstandard' }]);
    expect(stored().categories).toEqual([{ name: 'Providerstandard', active: true }]);
    expect(
      execute.mock.calls.find(([call]) => call.operationName.endsWith('Write'))?.[0].variables
        .categories
    ).toEqual([]);
  });
  it('detects an external change immediately before write without sending a mutation', async () => {
    const { service, stored, execute } = setup();
    const current = await service.getConstructionSite({ ...connection, siteId: '42' });
    const prepared = service.prepareConstructionSite(
      current.data.input,
      'operation-1',
      current.item
    );
    stored().payload = { externalChange: true };
    await expect(service.writeConstructionSite({ ...connection, prepared })).rejects.toThrow(
      'construction_site_content_conflict'
    );
    expect(execute.mock.calls.some(([call]) => call.operationName.endsWith('Write'))).toBe(false);
  });
  it.each(['locations', 'categories'] as const)(
    'reports the known provider identity when %s are missing after write and never retries',
    async (field) => {
      const { service, tamper, execute } = setup();
      const current = await service.getConstructionSite({ ...connection, siteId: '42' });
      const prepared = service.prepareConstructionSite(
        current.data.input,
        'operation-1',
        current.item
      );
      tamper(field);
      await expect(
        service.writeConstructionSite({ ...connection, prepared })
      ).rejects.toMatchObject({
        message: 'construction_site_readback_mismatch',
        providerId: '42',
      });
      expect(
        execute.mock.calls.filter(([call]) => call.operationName.endsWith('Write'))
      ).toHaveLength(1);
    }
  );
});
