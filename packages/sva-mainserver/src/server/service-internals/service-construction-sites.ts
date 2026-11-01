import {
  constructionSiteInputSchema,
  type ConstructionSiteInput,
} from '../construction-sites-contract.js';
import {
  constructionSiteDetailDocument,
  constructionSiteListDocument,
  constructionSiteWriteDocument,
  constructionSiteOperationDocument,
} from '../../generated/construction-sites.js';
import type { SvaMainserverConnectionInput } from '../../types.js';
import {
  assertConstructionSiteWritable,
  buildConstructionSiteWrite,
  constructionSiteFingerprint,
  constructionSiteRead,
} from '../construction-sites-snapshot.js';
import { raw, records, voucherWriteMatches, type RawRecord } from '../vouchers-snapshot.js';
import type { ServiceContext } from './service-context.js';
import { assertUpstreamScanLimit, withUpdatedPayload } from './shared.js';

type Context = Pick<ServiceContext, 'loadValidatedInstanceConfig' | 'executeGraphqlWithConfig'>;
export type ConstructionSitePreparedWrite = Readonly<{
  id?: string;
  fingerprint?: string;
  providerId?: string;
  previousMediaIds: readonly string[];
  expected: RawRecord;
}>;
export class ConstructionSiteWriteError extends Error {
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
) => {
  const config = await context.loadValidatedInstanceConfig(input, 'load_instance_config');
  return context.executeGraphqlWithConfig<T>(
    { ...input, document, operationName, variables, allowRetry },
    config
  );
};
const getConstructionSite = async (
  context: Context,
  input: SvaMainserverConnectionInput & { siteId: string }
) => {
  const response = await execute<{ genericItem: unknown }>(
    context,
    input,
    constructionSiteDetailDocument,
    'SvaMainserverConstructionSiteDetail',
    { id: input.siteId }
  );
  if (!response.genericItem) throw new Error('construction_site_not_found');
  const item = raw(response.genericItem);
  if (item.genericType !== 'ConstructionSite') throw new Error('construction_site_not_found');
  return { item, data: constructionSiteRead(item) };
};
const listConstructionSiteCandidates = async (
  context: Context,
  input: SvaMainserverConnectionInput
) => {
  const data: ReturnType<typeof constructionSiteRead>[] = [];
  let skip = 0;
  for (;;) {
    assertUpstreamScanLimit(skip);
    const response = await execute<{ genericItems: unknown }>(
      context,
      input,
      constructionSiteListDocument,
      'SvaMainserverConstructionSiteList',
      { skip, limit: 100 }
    );
    const page = records(response.genericItems);
    data.push(...page.map(constructionSiteRead));
    if (page.length < 100) return data;
    skip += page.length;
  }
};
const prepareConstructionSite = (
  input: ConstructionSiteInput,
  operationId: string,
  existing?: RawRecord
): ConstructionSitePreparedWrite => {
  const expected = buildConstructionSiteWrite(constructionSiteInputSchema.parse(input), existing);
  expected.payload = {
    ...withUpdatedPayload(expected.payload, existing?.payload),
    studioConstructionSiteOperation: operationId,
  };
  if (!existing) expected.externalId = `studio-construction-site:${operationId}`;
  const previousMediaIds = existing
    ? constructionSiteRead(existing).input.mediaContents.flatMap((item) =>
        item.hostMediaAssetId ? [item.hostMediaAssetId] : []
      )
    : [];
  return {
    ...(existing
      ? {
          id: String(existing.id),
          fingerprint: constructionSiteFingerprint(existing),
          providerId: String(raw(existing.dataProvider).id),
        }
      : {}),
    previousMediaIds,
    expected,
  };
};
const verifyConstructionSiteWrite = async (
  context: Context,
  input: SvaMainserverConnectionInput & {
    prepared: ConstructionSitePreparedWrite;
    siteId: string;
  }
) => {
  const result = await getConstructionSite(context, { ...input, siteId: input.siteId });
  const { categories, ...expected } = input.prepared.expected;
  const categoryNames = records(result.item.categories).map((category) => category.name);
  if (
    !voucherWriteMatches(result.item, expected) ||
    !records(categories).every((category) => categoryNames.includes(category.name)) ||
    (input.prepared.providerId && input.prepared.providerId !== result.data.dataProvider?.id)
  )
    throw new ConstructionSiteWriteError('construction_site_readback_mismatch', input.siteId);
  return result.data;
};
const recoverConstructionSite = async (
  context: Context,
  input: SvaMainserverConnectionInput & { prepared: ConstructionSitePreparedWrite }
) => {
  let id = input.prepared.id;
  if (!id) {
    const response = await execute<{ genericItems: unknown }>(
      context,
      input,
      constructionSiteOperationDocument,
      'SvaMainserverConstructionSiteOperation',
      { externalId: input.prepared.expected.externalId }
    );
    const matches = records(response.genericItems);
    if (matches.length !== 1 || typeof matches[0]?.id !== 'string')
      throw new ConstructionSiteWriteError('construction_site_outcome_unknown');
    id = matches[0].id;
  }
  return verifyConstructionSiteWrite(context, { ...input, siteId: id });
};
const writeConstructionSite = async (
  context: Context,
  input: SvaMainserverConnectionInput & { prepared: ConstructionSitePreparedWrite }
) => {
  const { prepared } = input;
  if (prepared.id) {
    const current = await getConstructionSite(context, { ...input, siteId: prepared.id });
    assertConstructionSiteWritable(current.item);
    if (constructionSiteFingerprint(current.item) !== prepared.fingerprint)
      throw new ConstructionSiteWriteError('construction_site_content_conflict');
  }
  const response = await execute<{ createGenericItem: { id: string } | null }>(
    context,
    input,
    constructionSiteWriteDocument,
    'SvaMainserverConstructionSiteWrite',
    { ...prepared.expected, ...(prepared.id ? { id: prepared.id } : {}) },
    false
  );
  const id = response.createGenericItem?.id;
  if (!id) throw new ConstructionSiteWriteError('construction_site_outcome_unknown');
  if (prepared.id && prepared.id !== id)
    throw new ConstructionSiteWriteError('construction_site_readback_mismatch', id);
  return verifyConstructionSiteWrite(context, { ...input, siteId: id });
};
export const createConstructionSiteService = (context: Context) => ({
  getConstructionSite: (input: Parameters<typeof getConstructionSite>[1]) =>
    getConstructionSite(context, input),
  listConstructionSiteCandidates: (input: SvaMainserverConnectionInput) =>
    listConstructionSiteCandidates(context, input),
  prepareConstructionSite,
  writeConstructionSite: (input: Parameters<typeof writeConstructionSite>[1]) =>
    writeConstructionSite(context, input),
  verifyConstructionSiteWrite: (input: Parameters<typeof verifyConstructionSiteWrite>[1]) =>
    verifyConstructionSiteWrite(context, input),
  recoverConstructionSite: (input: Parameters<typeof recoverConstructionSite>[1]) =>
    recoverConstructionSite(context, input),
});
