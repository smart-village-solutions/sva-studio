import type {
  IamDsrCaseListItem,
  IamDsrSelfServiceOverview,
  IamSelfServiceActivityItem,
} from '@sva/core';

import {
  mapExportJobRow,
  mapLegalHoldRow,
  mapRequestRow,
  readPersonName,
} from './dsr-read-models.case-mappers.js';
import type {
  DsrSelfServiceRows,
  ExportJobRow,
  LegalAcceptanceRow,
  LegalHoldRow,
  RequestRow,
} from './dsr-read-models.types.js';

const mapSelfServiceActivityItemFromDsrCase = (
  item: IamDsrCaseListItem
): IamSelfServiceActivityItem => ({
  id: item.id,
  source: 'dsr',
  type: item.type,
  canonicalStatus: item.canonicalStatus,
  rawStatus: item.rawStatus,
  title: item.title,
  summary: item.summary,
  format: item.format,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  completedAt: item.completedAt,
  metadata: item.metadata,
});

const mapLegalAcceptanceRow = (row: LegalAcceptanceRow): IamSelfServiceActivityItem => {
  const actorDisplayName = readPersonName({
    display_name_ciphertext: row.display_name_ciphertext,
    first_name_ciphertext: row.first_name_ciphertext,
    last_name_ciphertext: row.last_name_ciphertext,
    keycloak_subject: row.keycloak_subject,
  });

  return {
    id: row.id,
    source: 'governance',
    type: 'legal_acceptance',
    canonicalStatus: row.revoked_at ? 'failed' : 'completed',
    rawStatus: row.revoked_at ? 'revoked' : 'accepted',
    title: row.legal_text_id,
    summary: actorDisplayName,
    createdAt: row.accepted_at,
    completedAt: row.revoked_at ?? undefined,
    metadata: {
      legalTextVersion: row.legal_text_version,
      locale: row.locale,
      requestId: row.request_id ?? undefined,
      traceId: row.trace_id ?? undefined,
    },
  };
};

const sortActivityItems = (items: readonly IamSelfServiceActivityItem[]) =>
  [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

export const buildDsrSelfServiceOverview = (
  rows: DsrSelfServiceRows,
  input: { instanceId: string; accountId: string }
): IamDsrSelfServiceOverview => {
  const legalHolds = rows.legalHolds.map(mapLegalHoldRow);
  const requests = rows.requests.map(mapRequestRow);
  const exportJobs = rows.exportJobs.map(mapExportJobRow);

  return {
    instanceId: input.instanceId,
    accountId: input.accountId,
    processingRestrictedAt: rows.account.processing_restricted_at ?? undefined,
    processingRestrictionReason: rows.account.processing_restriction_reason ?? undefined,
    nonEssentialProcessingOptOutAt: rows.account.non_essential_processing_opt_out_at ?? undefined,
    nonEssentialProcessingAllowed: !rows.account.non_essential_processing_opt_out_at,
    legalHolds,
    requests,
    exportJobs,
    activityItems: sortActivityItems([
      ...requests.map(mapSelfServiceActivityItemFromDsrCase),
      ...exportJobs.map(mapSelfServiceActivityItemFromDsrCase),
      ...legalHolds.map(mapSelfServiceActivityItemFromDsrCase),
      ...rows.legalAcceptances.map(mapLegalAcceptanceRow),
    ]),
  };
};

export const buildSelfServiceActivityItemFromSourceRows = (rows: {
  readonly request?: RequestRow;
  readonly exportJob?: ExportJobRow;
  readonly legalHold?: LegalHoldRow;
  readonly legalAcceptance?: LegalAcceptanceRow;
}): IamSelfServiceActivityItem | null => {
  if (rows.request) {
    return mapSelfServiceActivityItemFromDsrCase(mapRequestRow(rows.request));
  }
  if (rows.exportJob) {
    return mapSelfServiceActivityItemFromDsrCase(mapExportJobRow(rows.exportJob));
  }
  if (rows.legalHold) {
    return mapSelfServiceActivityItemFromDsrCase(mapLegalHoldRow(rows.legalHold));
  }
  if (rows.legalAcceptance) {
    return mapLegalAcceptanceRow(rows.legalAcceptance);
  }
  return null;
};
