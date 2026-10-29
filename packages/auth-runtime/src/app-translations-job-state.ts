import {
  catalogAssert,
  deepLTargetCode,
  readDeepLSettings,
  type CatalogScope,
  type CatalogDraft,
  type CatalogEditorData,
  type ExternalInterfaceRecord,
  type StudioJobRecord,
} from '@sva/core';
import { createStudioJobRepository } from '@sva/data-repositories';
import { createAppTranslationRepository } from '@sva/data-repositories/server';
import { evaluateAuthorizeDecision } from '@sva/iam-core';
import { z } from 'zod';
import { withIamAppDb, type QueryClient } from './db.js';
import { getDeepLSetupStatus } from './app-translations-deepl.js';
import { loadPermissionsWithClient } from './iam-authorization/permission-store.queries.js';
import type { StudioJobExecutionHandlerContext } from './plugin-operations/types.js';

export const jobType = 'app-translations.catalog-translate';
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
export type TranslationRequest = z.infer<typeof catalogTranslationRequest>;
export type MunicipalScope = Extract<CatalogScope, { kind: 'municipal' }>;
export const jobs = (client: QueryClient) =>
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
export const safeError = (message?: string): string =>
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
export const configuration = async (client: QueryClient, scope: MunicipalScope) => {
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
export const inputSchema = z
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

export type CatalogTranslationInput = z.infer<typeof inputSchema>;

function assertJobLeaseAndDraft(
  job: StudioJobRecord | null,
  context: StudioJobExecutionHandlerContext,
  draft: CatalogDraft,
  input: CatalogTranslationInput
): asserts job is StudioJobRecord {
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
};

const assertJobConfiguration = (
  config: Awaited<ReturnType<typeof configuration>>,
  input: CatalogTranslationInput,
  draft: CatalogDraft
) => {
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
};

export const withGuardedTranslationJob = async <T>(
  context: StudioJobExecutionHandlerContext,
  input: CatalogTranslationInput,
  scope: MunicipalScope,
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
    assertJobLeaseAndDraft(job, context, draft, input);
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
    assertJobConfiguration(config, input, draft);
    return work(client, await repo.readEffective(input.contractId), config.record, job);
  });
