import {
  AppTranslationError,
  catalogAssert,
  catalogDigest,
  catalogTranslationSource as translationSource,
  validateCatalogValue,
  type CatalogDraft,
  type CatalogEditorData,
  type CatalogValue,
  type ExternalInterfaceRecord,
  type StudioJobRecord,
} from '@sva/core';
import { createAppTranslationRepository } from '@sva/data-repositories/server';
import { z } from 'zod';
import type { QueryClient } from './db.js';
import { translateDeepLValues } from './app-translations-deepl.js';
import { isPluginOperationCancellationError } from './plugin-operations/job-cancellation.js';
import type { StudioJobExecutionHandlerContext } from './plugin-operations/types.js';
import {
  inputSchema,
  safeError,
  jobs,
  withGuardedTranslationJob,
  type MunicipalScope,
  type CatalogTranslationInput,
} from './app-translations-job-state.js';

const prepareTranslationBatch = async (
  input: CatalogTranslationInput,
  data: CatalogEditorData,
  record: ExternalInterfaceRecord,
  job: StudioJobRecord
) => {
  const keys = input.key ? [input.key] : Object.keys(data.draft.manifest.keys).sort();
  const slots = Object.keys(input.targetCodes).flatMap((locale) =>
    keys.map((key) => ({ locale, key }))
  );
  const startCursor = Number(job.progress?.details?.cursor ?? 0);
  let cursor = startCursor;
  const entries: {
    locale: string;
    key: string;
    source: CatalogValue;
    sourceDigest: string;
    targetCode: string;
    sourceKind: 'standard' | 'municipal';
    overrideDigest?: string;
  }[] = [];
  let units = 0;
  while (cursor < slots.length) {
    const slot = slots[cursor]!;
    if (entries.length && slot.locale !== entries[0]!.locale) break;
    const source = await translationSource(
      data,
      input.mode,
      slot.locale,
      slot.key,
      input.targetCodes[slot.locale]!
    );
    if (input.key)
      catalogAssert(input.sourceDigest === (await catalogDigest(source)), 'catalog_conflict');
    if (source === undefined) {
      cursor++;
      continue;
    }
    const count = typeof source === 'string' ? 1 : source.length;
    if (entries.length && units + count > 50) break;
    cursor++;
    const own = data.draft.valuesByLocale[slot.locale]?.[slot.key];
    const confirmed = input.confirmations?.[slot.locale];
    if (confirmed)
      catalogAssert(
        confirmed.sourceDigest === (await catalogDigest(source)) &&
          confirmed.overrideDigest === (await catalogDigest(own ?? null)),
        'catalog_conflict'
      );
    entries.push({
      ...slot,
      source,
      sourceDigest: await catalogDigest(source),
      targetCode: input.targetCodes[slot.locale]!,
      sourceKind: input.mode === 'municipal' ? 'municipal' : 'standard',
      ...(confirmed ? { overrideDigest: confirmed.overrideDigest } : {}),
    });
    units += count;
  }
  return {
    entries,
    cursor,
    skipped: cursor - startCursor - entries.length,
    locale: slots[Math.max(0, cursor - 1)]?.locale,
    total: slots.length,
    record,
    revision: data.draft.draftRevision,
  };
};

const saveTranslationBatch = async (
  client: QueryClient,
  data: CatalogEditorData,
  job: StudioJobRecord,
  context: StudioJobExecutionHandlerContext,
  input: CatalogTranslationInput,
  scope: MunicipalScope,
  prepared: Awaited<ReturnType<typeof prepareTranslationBatch>>,
  values: CatalogValue[]
) => {
  catalogAssert(data.draft.draftRevision === prepared.revision, 'catalog_conflict');
  let draft: CatalogDraft = data.draft;
  if (prepared.entries.length) {
    const repo = await createAppTranslationRepository(client, scope);
    const entries = prepared.entries.map((entry, index) => ({
      ...entry,
      value: validateCatalogValue(draft.manifest, entry.key, values[index]),
    }));
    draft = await repo.applyMachineBatch(input.contractId, prepared.revision, entries);
  }
  const progress = {
    completedSteps: prepared.cursor,
    totalSteps: prepared.total,
    details: {
      cursor: prepared.cursor,
      draftRevision: draft.draftRevision,
      translated: Number(job.progress?.details?.translated ?? 0) + prepared.entries.length,
      skipped: Number(job.progress?.details?.skipped ?? 0) + prepared.skipped,
      ...(prepared.locale ? { locale: prepared.locale } : {}),
    },
  };
  const saved = await jobs(client).updateJobProgressWithLease({
    instanceId: scope.instanceId,
    jobId: job.id,
    attempts: context.job.attempts,
    workerId: context.job.workerId!,
    lastProgressAt: new Date().toISOString(),
    progress,
  });
  catalogAssert(saved, 'catalog_conflict');
  return progress;
};

export const runCatalogTranslation = async (context: StudioJobExecutionHandlerContext) => {
  try {
    const input = inputSchema.parse(context.job.inputPayload);
    const scope: MunicipalScope = {
      kind: 'municipal',
      instanceId: context.job.instanceId,
      organizationId: input.organizationId,
    };
    while (true) {
      await context.throwIfCancellationRequested();
      const prepared = await withGuardedTranslationJob(
        context,
        input,
        scope,
        async (_client, data, record, job) => prepareTranslationBatch(input, data, record, job)
      );
      const values = prepared.entries.length
        ? await translateDeepLValues(
            prepared.record,
            prepared.entries[0]!.targetCode,
            prepared.entries.map((entry) => entry.source),
            context.abortSignal
          )
        : [];
      await context.throwIfCancellationRequested();
      const progress = await withGuardedTranslationJob(
        context,
        input,
        scope,
        async (client, data, _record, job) =>
          saveTranslationBatch(client, data, job, context, input, scope, prepared, values)
      );
      if (progress.completedSteps === progress.totalSteps)
        return {
          progress,
          resultPayload: { summary: { processedItems: progress.completedSteps } },
        };
    }
  } catch (error) {
    if (isPluginOperationCancellationError(error)) throw error;
    await context.throwIfCancellationRequested();
    if (error instanceof AppTranslationError || error instanceof z.ZodError)
      throw Object.assign(
        new Error(error instanceof AppTranslationError ? error.code : 'invalid_catalog'),
        { cause: { retry: { kind: 'terminal' } } }
      );
    // Never let an SQL/provider exception leak text or credentials into generic job events.
    if (error instanceof Error && safeError(error.message) === error.message) throw error;
    throw Object.assign(new Error('catalog_unavailable'), {
      cause: { code: 'catalog_unavailable' },
    });
  }
};
