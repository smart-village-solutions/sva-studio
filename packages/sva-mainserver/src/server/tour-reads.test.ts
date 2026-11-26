import { buildClientSchema, parse, validate, type IntrospectionQuery } from 'graphql';
import { describe, expect, it, vi } from 'vitest';

import snapshot from '../generated/schema.snapshot.json';
import type { ServiceContext } from './service-internals/service-context.js';
import { createTourReads, tourDetailDocument, tourListDocument } from './tour-reads.js';

const actor = {
  instanceId: 'tenant',
  keycloakSubject: 'subject',
  activeOrganizationId: 'org',
  actingPrincipalType: 'organization',
} as const;
const tour = (id: string, provider = 'provider') => ({ id, dataProvider: { id: provider } });

const setup = (response: unknown) => {
  const execute = vi.fn().mockResolvedValue(response);
  const identity = vi.fn().mockResolvedValue({ dataProvider: { id: 'provider' } });
  const reads = createTourReads({
    loadValidatedInstanceConfig: vi.fn().mockResolvedValue({}),
    loadDataProviderIdentityWithConfig: identity,
    executeGraphqlWithConfig: execute as ServiceContext['executeGraphqlWithConfig'],
  });
  return { reads, execute, identity };
};

describe('Mainserver tour reads', () => {
  it('validates both operations against the checked-in Mainserver schema', () => {
    const schema = buildClientSchema(snapshot.data as unknown as IntrospectionQuery);
    expect(validate(schema, parse(tourListDocument))).toEqual([]);
    expect(validate(schema, parse(tourDetailDocument))).toEqual([]);
  });

  it('pages the provider scope in stable ID order and uses a lookahead', async () => {
    const { reads, execute, identity } = setup({ tours: [tour('4'), tour('3'), tour('2')] });
    await expect(reads.list(actor, { page: 2, pageSize: 2 })).resolves.toMatchObject({
      data: [{ id: '4' }, { id: '3' }],
      pagination: { page: 2, pageSize: 2, hasNextPage: true },
    });
    expect(identity).toHaveBeenCalledWith(actor, {});
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        ...actor,
        variables: { provider: 'provider', skip: 2, limit: 3 },
        document: expect.stringContaining('order: id_DESC'),
      }),
      {}
    );
  });

  it('rejects a list response containing a foreign provider', async () => {
    const { reads } = setup({ tours: [tour('4', 'other')] });
    await expect(reads.list(actor, { page: 1, pageSize: 25 })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('returns null for a foreign detail and preserves the stored order of a matching detail', async () => {
    const geometryTourData = [
      { latitude: 2, longitude: 1 },
      { latitude: 3, longitude: 4 },
    ];
    const tourStops = [
      { id: '9', name: 'Start' },
      { id: '8', name: 'Ziel' },
    ];
    const { reads, execute } = setup({
      tour: { ...tour('1', 'other'), geometryTourData, tourStops },
    });
    await expect(reads.detail(actor, '1')).resolves.toBeNull();
    execute.mockResolvedValue({ tour: { ...tour('1'), geometryTourData, tourStops } });
    await expect(reads.detail(actor, '1')).resolves.toMatchObject({ geometryTourData, tourStops });
  });
});
