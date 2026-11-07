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
import { jobWriteFields } from '../../generated/jobs.js';
import { createJobDefaults } from '../jobs-contract.js';
import { jobRead } from '../jobs-snapshot.js';
import { jobFixture } from '../jobs-test-fixture.js';
import type { RawRecord } from '../vouchers-snapshot.js';
import { createJobService, JobPrewriteError } from './service-jobs.js';
const connection = { instanceId: 'instance-1', keycloakSubject: 'subject-1' };
function setup() {
  let stored: RawRecord | null = jobFixture();
  let collision: RawRecord[] = [];
  let categories: RawRecord[] = [
    { id: '1', name: 'Vollzeit', active: true, tagList: 'generic_item_job' },
    { id: '2', name: 'Stadt', active: true, tagList: '' },
  ];
  let lostResponse = false;
  let tamper = false;
  let deletion = false;
  const schema = buildClientSchema(schemaSnapshot.data as unknown as IntrospectionQuery);
  const execute = vi.fn(
    async (call: {
      operationName: string;
      document: string;
      variables: RawRecord;
      allowRetry?: boolean;
    }) => {
      switch (call.operationName) {
        case 'SvaMainserverJobWrite': {
          expect(call.allowRetry).toBe(false);
          for (const variable of getOperationAST(parse(call.document))!.variableDefinitions ?? [])
            coerceInputValue(
              call.variables[variable.variable.name.value],
              typeFromAST(schema, variable.type) as Parameters<typeof coerceInputValue>[1]
            );
          const emptyRelations = Object.fromEntries(
            Object.entries(jobWriteFields)
              .filter(([, shape]) => typeof shape === 'object')
              .map(([key]) => [key, []])
          );
          // Emulate deletion/recreation, then fill the nullable GraphQL output fields.
          stored = {
            ...(stored ?? jobFixture()),
            ...emptyRelations,
            ...structuredClone(
              Object.fromEntries(
                Object.entries(call.variables).filter(([, value]) => value !== undefined)
              )
            ),
            id: call.variables.id ?? '43',
          };
          stored.mediaContents = (stored.mediaContents as RawRecord[]).map((media) => ({
            height: null,
            width: null,
            ...media,
          }));
          if (tamper) stored.contacts = [];
          if (lostResponse) throw new Error('network_error');
          return { createGenericItem: { id: stored.id } };
        }
        case 'SvaMainserverJobCollision':
          return { categories, genericItems: collision };
        case 'SvaMainserverJobCategoriesGuard':
          return { categories };
        case 'SvaMainserverJobOperation':
          return { genericItems: stored ? [structuredClone(stored)] : [] };
        case 'SvaMainserverDestroyRecord':
          deletion = true;
          stored = null;
          return { destroyRecord: { id: call.variables.id, statusCode: 200 } };
        default:
          return { genericItem: structuredClone(stored) };
      }
    }
  );
  const service = createJobService({
    loadValidatedInstanceConfig: vi.fn(),
    loadDataProviderIdentity: vi.fn(async () => ({ dataProvider: { id: '7' } })),
    executeGraphqlWithConfig: execute as Parameters<
      typeof createJobService
    >[0]['executeGraphqlWithConfig'],
  });
  return {
    service,
    execute,
    stored: () => stored!,
    writes: () =>
      execute.mock.calls.filter(([call]) => call.operationName === 'SvaMainserverJobWrite'),
    collision: (value: RawRecord[]) => {
      collision = value;
    },
    malformedGuard: () => {
      categories = [{ active: true }];
    },
    inactive: () => {
      categories[1]!.active = false;
    },
    lost: () => {
      lostResponse = true;
    },
    tamper: () => {
      tamper = true;
    },
    disappear: () => {
      stored = null;
    },
    deleted: () => deletion,
  };
}
describe('Job provider writes and independent readback', () => {
  it('roundtrips a title edit through replacing nested writes with all unrelated legacy data intact', async () => {
    const test = setup();
    const before = structuredClone(test.stored());
    const prepared = test.service.prepareJob(
      { ...jobRead(before).input, title: 'Neue Stelle' },
      'op-1',
      before
    );
    const result = await test.service.writeJob({ ...connection, prepared });
    expect(result.title).toBe('Neue Stelle');
    expect(result.id).toBe('42');
    for (const key of [
      'contacts',
      'companies',
      'dates',
      'contentBlocks',
      'mediaContents',
      'categories',
      'publicationDate',
      'teaser',
      'description',
    ])
      expect(test.stored()[key], key).toEqual(before[key]);
    expect(test.stored().payload).toMatchObject(before.payload as RawRecord);
    expect(test.writes()).toHaveLength(1);
  });
  it('blocks provider-wide collisions with a different GenericItem type before create', async () => {
    const test = setup();
    test.collision([{ id: '99', genericType: 'ConstructionSite', dataProvider: { id: '7' } }]);
    const prepared = test.service.prepareJob(
      {
        ...createJobDefaults('2026-11-07'),
        title: 'Stelle',
        employmentType: 'Vollzeit',
        externalId: 'occupied',
      },
      'op-1'
    );
    await expect(test.service.writeJob({ ...connection, prepared })).rejects.toThrow(
      'job_external_id_conflict'
    );
    expect(test.writes()).toHaveLength(0);
  });
  it('blocks filtered categories, changed snapshots, wrong types and disappeared update targets without writing', async () => {
    for (const kind of ['inactive', 'changed', 'missing'] as const) {
      const test = setup();
      const prepared = test.service.prepareJob(jobRead(test.stored()).input, 'op-1', test.stored());
      if (kind === 'inactive') test.inactive();
      if (kind === 'changed') test.stored().title = 'Concurrent edit';
      if (kind === 'missing') test.disappear();
      await expect(test.service.writeJob({ ...connection, prepared })).rejects.toBeInstanceOf(
        JobPrewriteError
      );
      expect(test.writes()).toHaveLength(0);
    }
  });
  it('preserves obsolete employment names but rejects a new untagged name', async () => {
    const test = setup();
    const prepared = test.service.prepareJob(
      { ...jobRead(test.stored()).input, employmentType: 'Stadt' },
      'op-1',
      test.stored()
    );
    await expect(test.service.writeJob({ ...connection, prepared })).rejects.toThrow(
      'job_employment_type_invalid'
    );
    expect(test.writes()).toHaveLength(0);
  });
  it('recovers a lost response with a caller-supplied external ID and operation marker without a second mutation', async () => {
    const test = setup();
    test.lost();
    const prepared = test.service.prepareJob(
      {
        ...createJobDefaults('2026-11-07'),
        title: 'Stelle',
        externalId: 'free-id',
        employmentType: 'Vollzeit',
      },
      'op-1'
    );
    await expect(test.service.writeJob({ ...connection, prepared })).rejects.toThrow(
      'network_error'
    );
    const result = await test.service.recoverJob({ ...connection, prepared });
    expect(result.input.externalId).toBe('free-id');
    expect(test.writes()).toHaveLength(1);
    test.stored().payload = { studioJobOperation: 'different' };
    await expect(test.service.recoverJob({ ...connection, prepared })).rejects.toThrow(
      'job_outcome_unknown'
    );
  });
  it('reports a mismatched independent readback with the known ID', async () => {
    const test = setup();
    test.tamper();
    const prepared = test.service.prepareJob(jobRead(test.stored()).input, 'op-1', test.stored());
    await expect(test.service.writeJob({ ...connection, prepared })).rejects.toMatchObject({
      message: 'job_readback_mismatch',
      providerId: '42',
    });
    expect(test.writes()).toHaveLength(1);
  });

  it('blocks degraded guard data before any write', async () => {
    const test = setup();
    test.malformedGuard();
    const prepared = test.service.prepareJob(jobRead(test.stored()).input, 'op', test.stored());
    await expect(test.service.writeJob({ ...connection, prepared })).rejects.toThrow(
      'job_prewrite_failed'
    );
    expect(test.writes()).toHaveLength(0);
  });
  it('updates a legacy record with no external ID without mistaking an unrelated empty ID for a collision', async () => {
    const test = setup();
    test.stored().externalId = null;
    test.collision([{ id: '99', genericType: 'ConstructionSite', dataProvider: { id: '7' } }]);
    const prepared = test.service.prepareJob(
      { ...jobRead(test.stored()).input, title: 'Neu' },
      'op',
      test.stored()
    );
    await expect(test.service.writeJob({ ...connection, prepared })).resolves.toMatchObject({
      title: 'Neu',
    });
    expect(
      test.execute.mock.calls.some(([call]) => call.operationName === 'SvaMainserverJobCollision')
    ).toBe(false);
    expect(test.stored().externalId).toBeNull();
  });
  it('permits confirmed deletion despite unrelated inactive categories', async () => {
    const test = setup();
    test.inactive();
    const data = jobRead(test.stored());
    await expect(
      test.service.deleteJob({
        ...connection,
        jobId: data.id,
        fingerprint: data.contentFingerprint,
      })
    ).resolves.toBe('42');
    expect(test.deleted()).toBe(true);
  });
  it('deletes exactly the freshly read Job and proves absence independently', async () => {
    const test = setup();
    const data = jobRead(test.stored());
    await expect(
      test.service.deleteJob({
        ...connection,
        jobId: data.id,
        fingerprint: data.contentFingerprint,
      })
    ).resolves.toBe('42');
    expect(test.deleted()).toBe(true);
    expect(test.writes()).toHaveLength(0);
  });
});

describe('generic service cannot bypass the dedicated Job contract', () => {
  it.each(['create', 'update-to', 'update-from', 'visibility', 'delete'] as const)(
    'rejects %s before any mutation',
    async (kind) => {
      const { createItemService } = await import('./service-items.js');
      const write = vi.fn();
      const read = vi.fn(async () => ({
        id: '42',
        genericType: kind === 'update-to' ? 'INFO' : 'Job',
      }));
      const context = {
        loadValidatedInstanceConfig: vi.fn(),
        loadListCredentialMetadata: vi.fn(),
        genericItemOperations: {
          getGenericItemWithConfig: read,
          writeGenericItemWithConfig: write,
          destroyGenericItemWithConfig: write,
        },
        genericItemVisibilityOperations: { changeGenericItemVisibilityWithConfig: write },
        poiOperations: {},
      };
      const service = createItemService(
        context as unknown as Parameters<typeof createItemService>[0]
      );
      const genericItem = {
        genericType: kind === 'update-from' ? 'INFO' : 'Job',
        title: 'Job',
      } as Parameters<typeof service.createGenericItem>[0]['genericItem'];
      const call =
        kind === 'create'
          ? service.createGenericItem({ ...connection, genericItem })
          : kind === 'visibility'
            ? service.changeGenericItemVisibility({
                ...connection,
                genericItemId: '42',
                visible: true,
              })
            : kind === 'delete'
              ? service.deleteGenericItem({ ...connection, genericItemId: '42' })
              : service.updateGenericItem({ ...connection, genericItemId: '42', genericItem });
      await expect(call).rejects.toMatchObject({ message: 'job_dedicated_editor_required' });
      expect(write).not.toHaveBeenCalled();
    }
  );
});
