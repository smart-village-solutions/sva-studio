import { z } from 'zod';
import { jobInputSchema, isJobEmploymentTypeAllowed, type JobInput } from '../jobs-contract.js';
import {
  jobDetailDocument,
  jobListDocument,
  jobOperationDocument,
  jobWriteDocument,
  jobWriteFields,
  jobCollisionDocument,
  jobCategoriesGuardDocument,
  jobDeletionVerificationDocument,
} from '../../generated/jobs.js';
import { svaMainserverDestroyRecordDocument } from '../../generated/events-poi.js';
import type { SvaMainserverConnectionInput } from '../../types.js';
import { assertJobWritable, buildJobWrite, jobFingerprint, jobRead } from '../jobs-snapshot.js';
import { raw, records, voucherWriteMatches, type RawRecord } from '../vouchers-snapshot.js';
import type { ServiceContext } from './service-context.js';
import { assertUpstreamScanLimit, withUpdatedPayload } from './shared.js';

type Context = Pick<
  ServiceContext,
  'loadValidatedInstanceConfig' | 'executeGraphqlWithConfig' | 'loadDataProviderIdentity'
>;
export type JobPreparedWrite = Readonly<{
  id?: string;
  fingerprint?: string;
  providerId?: string;
  previousEmploymentType?: string;
  previousMediaIds: readonly string[];
  previousVisible: boolean;
  expected: RawRecord;
}>;
/** A definitive rejection before the mutation; the operation can safely be corrected. */
export class JobPrewriteError extends Error {}
/** Once a mutation starts, uncertain outcomes require read-only reconciliation. */
export class JobWriteError extends Error {
  constructor(
    message: string,
    readonly providerId?: string
  ) {
    super(message);
  }
}
const execute = async <T>(
  context: Context,
  input: SvaMainserverConnectionInput,
  document: string,
  operationName: string,
  variables: Record<string, unknown>,
  allowRetry = true
) =>
  context.executeGraphqlWithConfig<T>(
    { ...input, document, operationName, variables, allowRetry },
    await context.loadValidatedInstanceConfig(input, 'load_instance_config')
  );
const getJob = async (
  context: Context,
  input: SvaMainserverConnectionInput & { jobId: string }
) => {
  const response = await execute<{ genericItem: unknown }>(
    context,
    input,
    jobDetailDocument,
    'SvaMainserverJobDetail',
    { id: input.jobId }
  );
  if (!response.genericItem || raw(response.genericItem).genericType !== 'Job')
    throw new JobPrewriteError('job_not_found');
  const item = raw(response.genericItem);
  return { item, data: jobRead(item) };
};
const listJobCandidates = async (context: Context, input: SvaMainserverConnectionInput) => {
  const data: ReturnType<typeof jobRead>[] = [];
  for (let skip = 0; ; skip += 100) {
    assertUpstreamScanLimit(skip);
    const response = await execute<{ genericItems: unknown }>(
      context,
      input,
      jobListDocument,
      'SvaMainserverJobList',
      { skip, limit: 100 }
    );
    const page = records(response.genericItems);
    data.push(...page.map(jobRead));
    if (page.length < 100) return data;
  }
};
const prepareJob = (
  input: JobInput,
  operationId: string,
  existing?: RawRecord
): JobPreparedWrite => {
  const expected = buildJobWrite(jobInputSchema.parse(input), existing);
  expected.payload = {
    ...withUpdatedPayload(expected.payload, existing?.payload),
    studioJobOperation: operationId,
  };
  if (!existing && !input.externalId.trim()) expected.externalId = `studio-job:${operationId}`;
  return {
    ...(existing
      ? {
          id: String(existing.id),
          fingerprint: jobFingerprint(existing),
          providerId: String(raw(existing.dataProvider).id),
          previousEmploymentType: jobRead(existing).input.employmentType,
        }
      : {}),
    previousVisible: existing?.visible === true,
    previousMediaIds: existing
      ? jobRead(existing).input.mediaContents.flatMap((media) =>
          media.hostMediaAssetId ? [media.hostMediaAssetId] : []
        )
      : [],
    expected,
  };
};
const guardCategories = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string().refine((name) => Boolean(name.trim())),
    active: z.boolean(),
    tagList: z.string().nullable(),
  })
);
const categoriesGuard = async (
  context: Context,
  input: SvaMainserverConnectionInput,
  updating: boolean
) => {
  const response = await execute<{ categories: unknown }>(
    context,
    input,
    jobCategoriesGuardDocument,
    'SvaMainserverJobCategoriesGuard',
    {}
  );
  const categories = guardCategories.parse(response.categories);
  if (updating && categories.some((category) => category.active !== true))
    throw new JobPrewriteError('job_inactive_categories');
  return categories;
};
const verifyJobWrite = async (
  context: Context,
  input: SvaMainserverConnectionInput & { prepared: JobPreparedWrite; jobId: string }
) => {
  const result = await getJob(context, input).catch(() => {
    throw new JobWriteError('job_readback_mismatch', input.jobId);
  });
  const { categories, ...expected } = input.prepared.expected;
  const categoryNames = records(result.item.categories).map((category) => category.name);
  if (
    !voucherWriteMatches(result.item, expected) ||
    !records(categories ?? []).every((category) => categoryNames.includes(category.name)) ||
    input.prepared.providerId !== result.data.dataProvider?.id
  )
    throw new JobWriteError('job_readback_mismatch', input.jobId);
  return result.data;
};
const recoverJob = async (
  context: Context,
  input: SvaMainserverConnectionInput & { prepared: JobPreparedWrite }
) => {
  const providerId =
    input.prepared.providerId ?? (await context.loadDataProviderIdentity(input)).dataProvider.id;
  let id = input.prepared.id;
  if (!id) {
    const matches: RawRecord[] = [];
    for (let skip = 0; ; skip += 100) {
      assertUpstreamScanLimit(skip);
      const response = await execute<{ genericItems: unknown }>(
        context,
        input,
        jobOperationDocument,
        'SvaMainserverJobOperation',
        { externalId: input.prepared.expected.externalId, limit: 100, skip }
      );
      const page = records(response.genericItems);
      matches.push(
        ...page.filter(
          (item) =>
            raw(item.dataProvider).id === providerId &&
            raw(item.payload).studioJobOperation ===
              raw(input.prepared.expected.payload).studioJobOperation
        )
      );
      if (page.length < 100) break;
    }
    if (matches.length !== 1 || typeof matches[0]?.id !== 'string')
      throw new JobWriteError('job_outcome_unknown');
    id = matches[0].id;
  }
  return verifyJobWrite(context, {
    ...input,
    prepared: { ...input.prepared, providerId },
    jobId: id,
  });
};
const writeJob = async (
  context: Context,
  input: SvaMainserverConnectionInput & { prepared: JobPreparedWrite }
) => {
  const { prepared } = input;
  let providerId: string;
  try {
    if (prepared.id) {
      const current = await getJob(context, { ...input, jobId: prepared.id });
      assertJobWritable(current.item);
      if (jobFingerprint(current.item) !== prepared.fingerprint)
        throw new JobPrewriteError('job_content_conflict');
      providerId = current.data.dataProvider!.id;
    } else providerId = (await context.loadDataProviderIdentity(input)).dataProvider.id;
    const externalId =
      typeof prepared.expected.externalId === 'string' && prepared.expected.externalId.trim()
        ? prepared.expected.externalId
        : undefined;
    const guard = externalId
      ? await execute<{ categories: unknown; genericItems: unknown }>(
          context,
          input,
          jobCollisionDocument,
          'SvaMainserverJobCollision',
          { externalId, providerId }
        )
      : { categories: await categoriesGuard(context, input, false), genericItems: [] };
    const categories = guardCategories.parse(guard.categories);
    if (prepared.id && categories.some((category) => category.active !== true))
      throw new JobPrewriteError('job_inactive_categories');
    if (
      records(guard.genericItems).some(
        (item) => item.id !== prepared.id || raw(item.dataProvider).id !== providerId
      )
    )
      throw new JobPrewriteError('job_external_id_conflict');
    if (
      !isJobEmploymentTypeAllowed(
        categories,
        raw(prepared.expected.payload).employmentType,
        prepared.previousEmploymentType
      )
    )
      throw new JobPrewriteError('job_employment_type_invalid');
  } catch (error) {
    if (error instanceof JobPrewriteError) throw error;
    throw new JobPrewriteError(
      error instanceof Error &&
        ['job_incomplete', 'job_dependents_unsupported'].includes(error.message)
        ? error.message
        : 'job_prewrite_failed'
    );
  }
  const variables = Object.fromEntries(
    Object.keys(jobWriteFields).map((key) => [key, prepared.expected[key]])
  );
  const response = await execute<{ createGenericItem: { id: string } | null }>(
    context,
    input,
    jobWriteDocument,
    'SvaMainserverJobWrite',
    {
      ...variables,
      visible: prepared.expected.visible,
      ...(prepared.id ? { id: prepared.id } : {}),
    },
    false
  );
  const id = response.createGenericItem?.id;
  if (!id) throw new JobWriteError('job_outcome_unknown');
  if (prepared.id && prepared.id !== id) throw new JobWriteError('job_readback_mismatch', id);
  return verifyJobWrite(context, { ...input, prepared: { ...prepared, providerId }, jobId: id });
};
const verifyJobDeleted = async (
  context: Context,
  input: SvaMainserverConnectionInput & { jobId: string }
) => {
  const after = await execute<{ categories: unknown; genericItem: unknown }>(
    context,
    input,
    jobDeletionVerificationDocument,
    'SvaMainserverJobDeletionVerification',
    { id: input.jobId }
  );
  guardCategories.parse(after.categories);
  if (after.genericItem !== null) throw new JobWriteError('job_outcome_unknown', input.jobId);
};
const deleteJob = async (
  context: Context,
  input: SvaMainserverConnectionInput & { jobId: string; fingerprint: string }
) => {
  const current = await getJob(context, input);
  assertJobWritable(current.item);
  if (jobFingerprint(current.item) !== input.fingerprint)
    throw new JobPrewriteError('job_content_conflict');
  if (current.item.likeCount !== 0) throw new JobPrewriteError('job_dependents_unsupported');
  await categoriesGuard(context, input, false);
  const result = await execute<{ destroyRecord: { id?: string; statusCode?: number } | null }>(
    context,
    input,
    svaMainserverDestroyRecordDocument,
    'SvaMainserverDestroyRecord',
    { id: input.jobId, recordType: 'GenericItem' },
    false
  );
  if (String(result.destroyRecord?.id) !== input.jobId || result.destroyRecord?.statusCode !== 200)
    throw new JobWriteError('job_outcome_unknown', input.jobId);
  await verifyJobDeleted(context, input);
  return input.jobId;
};
export const createJobService = (context: Context) => ({
  verifyJobDeleted: (input: Parameters<typeof verifyJobDeleted>[1]) =>
    verifyJobDeleted(context, input),
  getJob: (input: Parameters<typeof getJob>[1]) => getJob(context, input),
  listJobCandidates: (input: SvaMainserverConnectionInput) => listJobCandidates(context, input),
  prepareJob,
  writeJob: (input: Parameters<typeof writeJob>[1]) => writeJob(context, input),
  verifyJobWrite: (input: Parameters<typeof verifyJobWrite>[1]) => verifyJobWrite(context, input),
  recoverJob: (input: Parameters<typeof recoverJob>[1]) => recoverJob(context, input),
  deleteJob: (input: Parameters<typeof deleteJob>[1]) => deleteJob(context, input),
});
