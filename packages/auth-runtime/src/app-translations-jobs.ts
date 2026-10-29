/** Fixed-catalog jobs: provider I/O stays outside the transaction that saves a batch. */
import {
  AppTranslationError,
  catalogAssert,
  catalogDigest,
  catalogTranslationSource as translationSource,
  type CatalogDraft,
  type CatalogEditorData,
  type StudioJobRecord,
} from '@sva/core';
import { createAppTranslationRepository } from '@sva/data-repositories/server';
import type { QueryClient } from './db.js';
import { assertDeepLRequestSize } from './app-translations-deepl.js';
import { enqueueStudioJobWithClient } from './plugin-operations/runner-queue.js';
import {
  configuration,
  jobs,
  jobType,
  readCatalogTranslationJob,
  catalogTranslationStatus,
  type MunicipalScope,
  type TranslationRequest,
} from './app-translations-job-state.js';
export {
  catalogTranslationRequest,
  readCatalogTranslationJob,
  catalogTranslationStatus,
} from './app-translations-job-state.js';
export { runCatalogTranslation } from './app-translations-job-runner.js';

const assertSameTranslationRequest = async (
  request: TranslationRequest,
  draft: CatalogDraft,
  existing: StudioJobRecord
) => {
  const requestedLocales =
    request.locales ?? draft.supportedLocales.filter((locale) => locale !== 'de');
  catalogAssert(
    existing.inputPayload.startRevision === request.expectedRevision &&
      existing.inputPayload.mode === request.mode &&
      existing.inputPayload.key === request.key &&
      JSON.stringify(
        Object.keys(existing.inputPayload.targetCodes as Record<string, string>).sort()
      ) === JSON.stringify([...requestedLocales].sort()) &&
      (await catalogDigest(existing.inputPayload.confirmations ?? {})) ===
        (await catalogDigest(request.confirmations ?? {})),
    'catalog_conflict'
  );
};

const validateTranslationRequest = (
  request: TranslationRequest,
  draft: CatalogDraft,
  config: Awaited<ReturnType<typeof configuration>>
) => {
  catalogAssert(draft.draftRevision === request.expectedRevision, 'catalog_conflict');
  catalogAssert(
    request.mode === 'missing'
      ? !request.key && !request.confirmations
      : request.key &&
          Object.prototype.hasOwnProperty.call(draft.manifest.keys, request.key) &&
          (request.mode !== 'municipal' || draft.valuesByLocale.de?.[request.key]),
    'invalid_catalog'
  );
  const locales = request.locales ?? draft.supportedLocales.filter((locale) => locale !== 'de');
  catalogAssert(
    locales.length &&
      new Set(locales).size === locales.length &&
      locales.every(
        (locale) =>
          locale !== 'de' && draft.supportedLocales.includes(locale) && config.targetCodes[locale]
      ),
    'catalog_forbidden'
  );

  return locales;
};

const assertManualConfirmations = async (
  request: TranslationRequest,
  draft: CatalogDraft,
  data: CatalogEditorData,
  locales: readonly string[]
) => {
  if (request.mode !== 'missing') {
    const source =
      request.mode === 'municipal'
        ? data.values.de?.[request.key!]?.value
        : data.baseCatalogs.de?.values[request.key!];
    catalogAssert(source !== undefined);
    for (const locale of locales) {
      const own = draft.valuesByLocale[locale]?.[request.key!];
      if (own?.origin === 'manual' || request.confirmations?.[locale]) {
        const confirmed = request.confirmations?.[locale];
        catalogAssert(
          confirmed &&
            confirmed.sourceDigest === (await catalogDigest(source)) &&
            confirmed.overrideDigest === (await catalogDigest(own ?? null)),
          'catalog_conflict'
        );
      }
    }
  }
};

const hasTranslationWork = async (
  request: TranslationRequest,
  data: CatalogEditorData,
  locales: readonly string[],
  keys: readonly string[],
  targetCodes: Record<string, string>
) => {
  let hasWork = false;
  try {
    for (const locale of locales)
      for (const key of keys) {
        const source = await translationSource(
          data,
          request.mode,
          locale,
          key,
          targetCodes[locale]!
        );
        if (source !== undefined) {
          hasWork = true;
          assertDeepLRequestSize(targetCodes[locale]!, [source]);
        }
      }
  } catch (error) {
    if (error instanceof Error && error.message === 'deepl_text_too_large')
      throw new AppTranslationError('deepl_text_too_large');
    throw error;
  }
  return hasWork;
};

export const startCatalogTranslation = async (
  client: QueryClient,
  scope: MunicipalScope,
  actor: string,
  request: TranslationRequest
) => {
  const repo = await createAppTranslationRepository(client, scope);
  const config = await configuration(client, scope);
  const draft = await repo.loadDraft(request.contractId, true);
  const existing = await readCatalogTranslationJob(client, scope, request.contractId);
  if (existing && ['queued', 'running', 'retrying'].includes(existing.status)) {
    await assertSameTranslationRequest(request, draft, existing);
    return catalogTranslationStatus(existing);
  }
  const locales = validateTranslationRequest(request, draft, config);
  const data = await repo.readEffective(request.contractId);
  await assertManualConfirmations(request, draft, data, locales);
  const keys = request.key ? [request.key] : Object.keys(draft.manifest.keys).sort();
  const hasWork = await hasTranslationWork(request, data, locales, keys, config.targetCodes);
  if (!hasWork) return null;
  const id = globalThis.crypto.randomUUID();
  const now = new Date().toISOString();
  const job = await jobs(client).createJob({
    id,
    instanceId: scope.instanceId,
    source: 'plugin',
    pluginId: 'app-translations',
    jobTypeId: jobType,
    queueName: `app-translations:${scope.instanceId}`,
    status: 'queued',
    attempts: 0,
    maxAttempts: 3,
    idempotencyKey: id,
    actorAccountId: actor,
    scheduledAt: now,
    inputPayload: {
      organizationId: scope.organizationId,
      contractId: request.contractId,
      draftId: draft.id,
      startRevision: draft.draftRevision,
      manifestId: draft.manifestId,
      baseReleaseId: draft.baseReleaseId,
      credentialRevision: config.settings.credentialRevision,
      interfaceId: config.record.id,
      generation: config.generation,
      targetCodes: Object.fromEntries(
        locales.map((locale) => [locale, config.targetCodes[locale]])
      ),
      mode: request.mode,
      ...(request.key ? { key: request.key } : {}),
      ...(request.key
        ? {
            sourceDigest: await catalogDigest(
              request.mode === 'municipal'
                ? data.values.de?.[request.key]?.value
                : data.baseCatalogs.de?.values[request.key]
            ),
          }
        : {}),
      ...(request.confirmations ? { confirmations: request.confirmations } : {}),
    },
    progress: {
      completedSteps: 0,
      totalSteps: keys.length * locales.length,
      details: { draftRevision: draft.draftRevision, cursor: 0, translated: 0, skipped: 0 },
    },
  });
  await enqueueStudioJobWithClient(client, {
    instanceId: scope.instanceId,
    jobId: id,
    queueName: job.queueName,
    maxAttempts: 3,
  });
  return catalogTranslationStatus(job);
};
