/** Fixed-catalog jobs: provider I/O stays outside the transaction that saves a batch. */
import {
  AppTranslationError,
  catalogAssert,
  catalogDigest,
  catalogTranslationSource as translationSource,
  deepLTargetCode,
  readDeepLSettings,
  validateCatalogValue,
  type CatalogDraft,
  type CatalogEditorData,
  type CatalogScope,
  type ExternalInterfaceRecord,
  type StudioJobRecord,
  type CatalogValue,
} from '@sva/core';
import { createAppTranslationRepository } from '@sva/data-repositories/server';
import { createStudioJobRepository } from '@sva/data-repositories';
import { evaluateAuthorizeDecision } from '@sva/iam-core';
import { z } from 'zod';
import { withIamAppDb, type QueryClient } from './db.js';
import {
  getDeepLSetupStatus,
  translateDeepLValues,
  assertDeepLRequestSize,
} from './app-translations-deepl.js';
import { loadPermissionsWithClient } from './iam-authorization/permission-store.queries.js';
import { isPluginOperationCancellationError } from './plugin-operations/job-cancellation.js';
import { enqueueStudioJobWithClient } from './plugin-operations/runner-queue.js';
import type { StudioJobExecutionHandlerContext } from './plugin-operations/types.js';

const jobType = 'app-translations.catalog-translate';
const confirmation = z
  .object({
    sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
    overrideDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const catalogTranslationRequest = z
  .object({
    operation: z.literal('translate'),
    contractId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    expectedRevision: z.string().regex(/^[1-9][0-9]{0,17}$/),
    mode: z.enum(['missing', 'municipal', 'standard']),
    key: z.string().min(1).max(128).optional(),
    locales: z.array(z.string().min(2).max(32)).min(1).max(500).optional(),
    confirmations: z.record(z.string(), confirmation).optional(),
  })
  .strict();
type TranslationRequest = z.infer<typeof catalogTranslationRequest>;
type MunicipalScope = Extract<CatalogScope, { kind: 'municipal' }>;
const jobs = (client: QueryClient) =>
  createStudioJobRepository({
    execute: async (statement) => client.query(statement.text, statement.values),
  });
export const catalogTranslationStatus = (job: StudioJobRecord | null) =>
  job
    ? {
        id: job.id,
        status: job.status,
        progress: job.progress,
        error: job.errorPayload ? safeError(job.errorPayload.message) : undefined,
      }
    : null;
const safeError = (message?: string): string =>
  [
    'catalog_conflict',
    'catalog_forbidden',
    'catalog_setup_required',
    'invalid_catalog',
    'deepl_auth_failed',
    'deepl_rate_limited',
    'deepl_quota_exceeded',
    'deepl_unavailable',
    'deepl_invalid_response',
    'deepl_text_too_large',
  ].includes(message ?? '')
    ? message!
    : 'catalog_unavailable';

export const readCatalogTranslationJob = async (
  client: QueryClient,
  scope: MunicipalScope,
  contractId: string
) => {
  const row = await client.query<{ id: string }>(
    `SELECT id FROM iam.studio_jobs WHERE instance_id=$1 AND job_type_id=$2 AND input_payload->>'organizationId'=$3 AND input_payload->>'contractId'=$4 ORDER BY created_at DESC LIMIT 1`,
    [scope.instanceId, jobType, scope.organizationId, contractId]
  );
  return row.rows[0] ? jobs(client).getJobById(scope.instanceId, row.rows[0].id) : null;
};
const configuration = async (client: QueryClient, scope: MunicipalScope) => {
  const lifecycle = await client.query<{ generation: string }>(
    `SELECT l.desired_generation::text AS generation FROM iam.instance_modules m JOIN iam.instance_plugin_lifecycle l ON l.instance_id=m.instance_id AND l.plugin_id=m.module_id JOIN iam.instances i ON i.id=m.instance_id JOIN iam.organizations o ON o.instance_id=i.id AND o.id=$2::uuid WHERE m.instance_id=$1 AND m.module_id='app-translations' AND m.effective_active AND l.access_state='active' AND i.status='active' AND o.is_active FOR SHARE OF m,l,i,o`,
    [scope.instanceId, scope.organizationId]
  );
  catalogAssert(lifecycle.rows[0], 'catalog_forbidden');
  const provider = await client.query<ExternalInterfaceRecord>(
    `SELECT id,type_key AS "typeKey",owner_kind AS "ownerKind",enabled,public_config_json AS "publicConfig",secret_config_ciphertext AS "secretConfigCiphertext",last_check_status AS "lastCheckStatus" FROM iam.instance_external_interfaces WHERE instance_id=$1 AND type_key='deepl' AND owner_kind='host' AND is_default FOR SHARE`,
    [scope.instanceId]
  );
  const record = provider.rows[0];
  catalogAssert(record && getDeepLSetupStatus(record).ready, 'catalog_setup_required');
  const settings = readDeepLSettings(record.publicConfig)!;
  const targetCodes = Object.fromEntries(
    settings.selectedLocales.map((locale) => [
      locale,
      deepLTargetCode(locale, settings.englishVariant, settings.availableLanguages),
    ])
  );
  return { record, settings, targetCodes, generation: lifecycle.rows[0].generation };
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
    return catalogTranslationStatus(existing);
  }
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
  const data = await repo.readEffective(request.contractId);
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
  const keys = request.key ? [request.key] : Object.keys(draft.manifest.keys).sort();
  let hasWork = false;
  try {
    for (const locale of locales)
      for (const key of keys) {
        const source = await translationSource(
          data,
          request.mode,
          locale,
          key,
          config.targetCodes[locale]!
        );
        if (source !== undefined) {
          hasWork = true;
          assertDeepLRequestSize(config.targetCodes[locale]!, [source]);
        }
      }
  } catch (error) {
    if (error instanceof Error && error.message === 'deepl_text_too_large')
      throw new AppTranslationError('deepl_text_too_large');
    throw error;
  }
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

const inputSchema = z
  .object({
    organizationId: z.uuid(),
    contractId: z.string(),
    draftId: z.uuid(),
    startRevision: z.string().regex(/^[1-9][0-9]{0,17}$/),
    manifestId: z.uuid(),
    baseReleaseId: z.uuid(),
    credentialRevision: z.string(),
    interfaceId: z.string(),
    generation: z.string(),
    targetCodes: z.record(z.string(), z.string()).refine((value) => Object.keys(value).length > 0),
    mode: z.enum(['missing', 'municipal', 'standard']),
    key: z.string().optional(),
    sourceDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    confirmations: z.record(z.string(), confirmation).optional(),
  })
  .strict();

/** Exported for the existing host-injected plugin job runtime, never for browser use. */
export const runCatalogTranslation = async (context: StudioJobExecutionHandlerContext) => {
  try {
    const input = inputSchema.parse(context.job.inputPayload);
    const scope: MunicipalScope = {
      kind: 'municipal',
      instanceId: context.job.instanceId,
      organizationId: input.organizationId,
    };
    const guarded = async <T>(
      work: (
        client: QueryClient,
        data: CatalogEditorData,
        record: ExternalInterfaceRecord,
        job: StudioJobRecord
      ) => Promise<T>
    ): Promise<T> =>
      withIamAppDb(async (client) => {
        const repo = await createAppTranslationRepository(client, scope);
        // Match session writes: lifecycle/provider before draft and job locks.
        const config = await configuration(client, scope);
        const draft = await repo.loadDraft(input.contractId, true);
        const lockedJob = await client.query(
          `SELECT id FROM iam.studio_jobs WHERE instance_id=$1 AND id=$2::uuid FOR UPDATE`,
          [scope.instanceId, context.job.id]
        );
        catalogAssert(lockedJob.rows[0], 'catalog_conflict');
        const job = await jobs(client).getJobById(scope.instanceId, context.job.id);
        catalogAssert(
          job &&
            job.status === 'running' &&
            !job.cancelRequestedAt &&
            job.attempts === context.job.attempts &&
            job.workerId === context.job.workerId &&
            job.heartbeatAt &&
            Date.now() - Date.parse(job.heartbeatAt) < 120000,
          'catalog_conflict'
        );
        catalogAssert(
          draft.id === input.draftId &&
            draft.manifestId === input.manifestId &&
            draft.baseReleaseId === input.baseReleaseId &&
            draft.draftRevision === job.progress?.details?.draftRevision,
          'catalog_conflict'
        );
        const permissions = await loadPermissionsWithClient(client, {
          instanceId: scope.instanceId,
          keycloakSubject: job.actorAccountId!,
          organizationId: scope.organizationId,
        });
        catalogAssert(
          evaluateAuthorizeDecision(
            {
              instanceId: scope.instanceId,
              action: 'app-translations.catalog.write',
              resource: { type: 'app-translations', organizationId: scope.organizationId },
              context: { organizationId: scope.organizationId },
            },
            permissions
          ).allowed,
          'catalog_forbidden'
        );
        const actor = await client.query(
          `SELECT a.id FROM iam.accounts a JOIN iam.account_organizations ao ON ao.instance_id=a.instance_id AND ao.account_id=a.id WHERE a.instance_id=$1 AND a.keycloak_subject=$2 AND a.status='active' AND NOT a.is_blocked AND a.soft_deleted_at IS NULL AND ao.organization_id=$3::uuid FOR SHARE OF a,ao`,
          [scope.instanceId, job.actorAccountId, scope.organizationId]
        );
        catalogAssert(actor.rows[0], 'catalog_forbidden');
        catalogAssert(
          config.generation === input.generation &&
            config.record.id === input.interfaceId &&
            config.settings.credentialRevision === input.credentialRevision &&
            Object.entries(input.targetCodes).every(
              ([locale, code]) =>
                draft.supportedLocales.includes(locale) && config.targetCodes[locale] === code
            ),
          'catalog_conflict'
        );
        return work(client, await repo.readEffective(input.contractId), config.record, job);
      });
    while (true) {
      await context.throwIfCancellationRequested();
      const prepared = await guarded(async (_client, data, record, job) => {
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
      });
      const values = prepared.entries.length
        ? await translateDeepLValues(
            prepared.record,
            prepared.entries[0]!.targetCode,
            prepared.entries.map((entry) => entry.source),
            context.abortSignal
          )
        : [];
      await context.throwIfCancellationRequested();
      const progress = await guarded(async (client, data, _record, job) => {
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
      });
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
