import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  catalogDigest,
  resolveCatalogValues,
  type CatalogDraft,
  type CatalogRelease,
  type StudioJobRecord,
} from '@sva/core';
import type { StudioJobExecutionHandlerContext } from './plugin-operations/types.js';
import {
  PluginOperationCancellationError,
  throwIfCancellationRequested,
} from './plugin-operations/job-cancellation.js';
const deps = vi.hoisted(() => ({
  transaction: vi.fn(),
  repository: vi.fn(),
  jobRepository: vi.fn(),
  permissions: vi.fn(),
  translate: vi.fn(),
  enqueue: vi.fn(),
}));
vi.mock('./db.js', () => ({ withIamAppDb: deps.transaction }));
vi.mock('@sva/data-repositories/server', () => ({
  createAppTranslationRepository: deps.repository,
}));
vi.mock('@sva/data-repositories', () => ({ createStudioJobRepository: deps.jobRepository }));
vi.mock('./app-translations-deepl.js', () => ({
  getDeepLSetupStatus: () => ({ ready: true }),
  translateDeepLValues: deps.translate,
  assertDeepLRequestSize: vi.fn(),
}));
vi.mock('./iam-authorization/permission-store.queries.js', () => ({
  loadPermissionsWithClient: deps.permissions,
}));
vi.mock('@sva/iam-core', () => ({
  evaluateAuthorizeDecision: (_request: unknown, permissions: unknown[]) => ({
    allowed: permissions.length > 0,
  }),
}));
vi.mock('./plugin-operations/runner-queue.js', () => ({
  enqueueStudioJobWithClient: deps.enqueue,
}));
import { runCatalogTranslation, startCatalogTranslation } from './app-translations-jobs.js';

let draft: CatalogDraft;
let base: CatalogRelease;
let job: StudioJobRecord;
let generation: string;
let credentials: string;
const query = vi.fn();
const context = (): StudioJobExecutionHandlerContext =>
  ({
    job: structuredClone(job),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    abortSignal: new AbortController().signal,
    throwIfCancellationRequested: vi.fn(),
    isCancellationRequested: vi.fn(),
    progress: {
      setTotal: vi.fn(),
      setPhase: vi.fn(),
      startStep: vi.fn(),
      completeStep: vi.fn(),
      report: vi.fn(),
    },
  }) as unknown as StudioJobExecutionHandlerContext;
beforeEach(() => {
  vi.clearAllMocks();
  generation = '1';
  credentials = 'credential-1';
  const keys = Object.fromEntries(
    Array.from({ length: 60 }, (_, index) => [
      `key${String(index).padStart(2, '0')}`,
      {
        type: 'string' as const,
        defaultValue: `Quelle ${index}`,
        placeholders: {},
        allowEmpty: false,
      },
    ])
  );
  const id = '11111111-1111-4111-8111-111111111111';
  draft = {
    id,
    scope: { kind: 'municipal', instanceId: 'tenant', organizationId: id },
    manifestId: id,
    manifest: {
      contractId: 'app-texts',
      manifestVersion: '1',
      appCompatibility: { minVersion: '1.0.0' },
      keys,
    },
    draftRevision: '1',
    supportedLocales: ['de', 'fr'],
    baseReleaseId: id,
    valuesByLocale: {},
    machineStandardValuesByLocale: {},
  };
  base = {
    id,
    scope: { kind: 'global' },
    manifestId: id,
    contractId: 'app-texts',
    catalogSetRevision: '1',
    draftRevision: '1',
    baseReleaseId: null,
    supportedLocales: ['de'],
    catalogs: {
      de: {
        values: Object.fromEntries(
          Object.entries(keys).map(([key, entry]) => [key, entry.defaultValue])
        ),
      },
    },
    descriptor: {},
    checksum: '',
    state: 'sealed',
  } as CatalogRelease;
  job = {
    id,
    instanceId: 'tenant',
    source: 'plugin',
    pluginId: 'app-translations',
    jobTypeId: 'app-translations.catalog-translate',
    queueName: 'app-translations:tenant',
    status: 'running',
    attempts: 1,
    maxAttempts: 3,
    workerId: 'worker',
    heartbeatAt: new Date().toISOString(),
    idempotencyKey: id,
    actorAccountId: 'actor',
    scheduledAt: '',
    createdAt: '',
    updatedAt: '',
    progress: { completedSteps: 0, totalSteps: 60, details: { cursor: 0, draftRevision: '1' } },
    inputPayload: {
      organizationId: id,
      contractId: 'app-texts',
      draftId: id,
      startRevision: '1',
      manifestId: id,
      baseReleaseId: id,
      credentialRevision: credentials,
      interfaceId: 'deepl',
      generation,
      targetCodes: { fr: 'fr' },
      mode: 'missing',
    },
  };
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('desired_generation')) return { rows: [{ generation }], rowCount: 1 };
    if (sql.includes('instance_external_interfaces'))
      return {
        rows: [
          {
            id: 'deepl',
            publicConfig: {
              revision: 'r1',
              credentialRevision: credentials,
              verifiedCredentialRevision: credentials,
              plan: 'pro',
              englishVariant: 'en-GB',
              selectedLocales: ['fr'],
              availableLanguages: [{ code: 'fr', name: 'French', tagHandling: false }],
            },
          },
        ],
        rowCount: 1,
      };
    return { rows: [{ id: job.id }], rowCount: 1 };
  });
  deps.transaction.mockImplementation((work) => work({ query }));
  deps.repository.mockImplementation(async () => ({
    loadDraft: async () => structuredClone(draft),
    readEffective: async () => ({
      draft: structuredClone(draft),
      values: resolveCatalogValues(draft, base),
      baseCatalogs: base.catalogs,
    }),
    applyMachineBatch: async (
      _contract: string,
      revision: string,
      entries: {
        locale: string;
        key: string;
        value: string;
        sourceDigest: string;
        targetCode: string;
        sourceKind: 'standard';
      }[]
    ) => {
      expect(revision).toBe(draft.draftRevision);
      for (const entry of entries) {
        draft.machineStandardValuesByLocale![entry.locale] ??= {};
        draft.machineStandardValuesByLocale![entry.locale]![entry.key] = {
          ...entry,
          origin: 'machine',
          confirmedSourceDigest: null,
        };
      }
      draft.draftRevision = String(Number(draft.draftRevision) + 1);
      return structuredClone(draft);
    },
  }));
  deps.jobRepository.mockImplementation(() => ({
    getJobById: async () => structuredClone(job),
    updateJobProgressWithLease: async (input: { progress: StudioJobRecord['progress'] }) => {
      job = { ...job, progress: input.progress };
      return job;
    },
    createJob: async (input: StudioJobRecord) => {
      job = input;
      return job;
    },
  }));
  deps.permissions.mockResolvedValue([{}]);
  deps.translate.mockImplementation(async (_record, _target, values: string[]) =>
    values.map((value) => `Translated ${value}`)
  );
});
describe('catalog translation worker', () => {
  it('deduplicates only the same active request and rejects another action or revision', async () => {
    const scope = draft.scope as Extract<CatalogDraft['scope'], { kind: 'municipal' }>;
    const request = {
      operation: 'translate' as const,
      contractId: 'app-texts',
      expectedRevision: '1',
      mode: 'missing' as const,
    };
    expect((await startCatalogTranslation({ query }, scope, 'actor', request))?.id).toBe(job.id);
    await expect(
      startCatalogTranslation({ query }, scope, 'actor', { ...request, expectedRevision: '2' })
    ).rejects.toThrow('catalog_conflict');
    await expect(
      startCatalogTranslation({ query }, scope, 'actor', {
        ...request,
        mode: 'standard',
        key: 'key00',
      })
    ).rejects.toThrow('catalog_conflict');
    expect(deps.enqueue).not.toHaveBeenCalled();
  });
  it('resumes after the last atomic checkpoint without asking again for committed values', async () => {
    deps.translate
      .mockImplementationOnce(async (_record, _target, values: string[]) =>
        values.map((value) => `Translated ${value}`)
      )
      .mockRejectedValueOnce(new Error('deepl_unavailable'));
    await expect(runCatalogTranslation(context())).rejects.toThrow('deepl_unavailable');
    expect(job.progress?.completedSteps).toBe(50);
    job = { ...job, attempts: 2 };
    await runCatalogTranslation(context());
    expect(deps.translate.mock.calls.map((call) => call[2].length)).toEqual([50, 10, 10]);
    expect(job.progress?.completedSteps).toBe(60);
  });
  it.each([1, 3])(
    'preserves cancellation during the provider request on attempt %s',
    async (attempts) => {
      job = { ...job, attempts };
      const controller = new AbortController();
      const execution = {
        ...context(),
        abortSignal: controller.signal,
        throwIfCancellationRequested: () =>
          throwIfCancellationRequested({
            isCancellationRequested: async () => controller.signal.aborted,
          }),
      };
      deps.translate.mockImplementationOnce(async () => {
        controller.abort();
        // The provider boundary maps a fetch abort to this safe retryable error.
        throw new Error('deepl_unavailable');
      });
      await expect(runCatalogTranslation(execution)).rejects.toBeInstanceOf(
        PluginOperationCancellationError
      );
      expect(deps.translate).toHaveBeenCalledTimes(1);
      expect(draft.machineStandardValuesByLocale).toEqual({});
      expect(job.progress?.completedSteps).toBe(0);
    }
  );
  it.each([
    'revision',
    'base',
    'manifest',
    'languages',
    'claim',
    'credentials',
    'generation',
    'permission',
    'cancel',
  ])('discards a provider response after %s changes', async (change) => {
    deps.translate.mockImplementationOnce(async (_record, _target, values: string[]) => {
      if (change === 'revision') draft.draftRevision = '2';
      if (change === 'base') draft.baseReleaseId = '22222222-2222-4222-8222-222222222222';
      if (change === 'manifest') draft.manifestId = '22222222-2222-4222-8222-222222222222';
      if (change === 'languages') draft.supportedLocales = ['de'];
      if (change === 'claim') job = { ...job, attempts: 2 };
      if (change === 'cancel') job = { ...job, cancelRequestedAt: new Date().toISOString() };
      if (change === 'credentials') credentials = 'rotated';
      if (change === 'generation') generation = '2';
      if (change === 'permission') deps.permissions.mockResolvedValue([]);
      return values;
    });
    await expect(runCatalogTranslation(context())).rejects.toThrow(
      /catalog_conflict|catalog_forbidden/
    );
    expect(draft.machineStandardValuesByLocale).toEqual({});
    expect(job.progress?.completedSteps).toBe(0);
  });
  it('uses the pinned standard and skips a manual correction despite a German municipal override', async () => {
    draft.valuesByLocale = {
      de: {
        key00: {
          value: 'Eigener Text',
          origin: 'manual',
          sourceDigest: '',
          confirmedSourceDigest: '',
        },
      },
      fr: {
        key01: {
          value: 'Correction',
          origin: 'manual',
          sourceDigest: '',
          confirmedSourceDigest: '',
        },
      },
    };
    await runCatalogTranslation(context());
    const requested = deps.translate.mock.calls.flatMap((call) => call[2]);
    expect(requested).toContain('Quelle 0');
    expect(requested).not.toContain('Eigener Text');
    expect(requested).not.toContain('Quelle 1');
    expect(draft.valuesByLocale.fr!.key01!.value).toBe('Correction');
    expect(job.progress?.details).toMatchObject({ translated: 59, skipped: 1, locale: 'fr' });
  });
  it('requires a per-language source and override confirmation before replacing a manual value', async () => {
    const own = {
      value: 'Correction',
      origin: 'manual' as const,
      sourceDigest: '',
      confirmedSourceDigest: '',
    };
    draft.valuesByLocale.fr = { key00: own };
    job = { ...job, status: 'failed' };
    const scope = draft.scope as Extract<CatalogDraft['scope'], { kind: 'municipal' }>;
    const request = {
      operation: 'translate' as const,
      contractId: 'app-texts',
      expectedRevision: '1',
      mode: 'standard' as const,
      key: 'key00',
      locales: ['fr'],
    };
    await expect(startCatalogTranslation({ query }, scope, 'actor', request)).rejects.toThrow(
      'catalog_conflict'
    );
    expect(deps.enqueue).not.toHaveBeenCalled();
    await startCatalogTranslation({ query }, scope, 'actor', {
      ...request,
      confirmations: {
        fr: {
          sourceDigest: await catalogDigest('Quelle 0'),
          overrideDigest: await catalogDigest(own),
        },
      },
    });
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(job.inputPayload)).not.toContain('Correction');
    expect(JSON.stringify(job.inputPayload)).not.toContain('Quelle');
  });
});
