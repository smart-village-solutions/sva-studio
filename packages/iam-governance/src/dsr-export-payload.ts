import { decryptFieldValue, parseFieldEncryptionConfigFromEnv } from '@sva/core/security';

import type { QueryClient } from './query-client.js';
import {
  loadMembershipRows,
  loadGovernanceRows,
  loadLegalRows,
} from './dsr-export-payload-queries.js';

export type DsrExportFormat = 'json' | 'csv' | 'xml';

export type DsrExportAccountSnapshot = {
  id: string;
  keycloak_subject: string;
  email_ciphertext: string | null;
  display_name_ciphertext: string | null;
  is_blocked: boolean;
  soft_deleted_at: string | null;
  delete_after: string | null;
  permanently_deleted_at: string | null;
  processing_restricted_at: string | null;
  processing_restriction_reason: string | null;
  non_essential_processing_opt_out_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DsrExportPayload = {
  meta: {
    generatedAt: string;
    instanceId: string;
    format: DsrExportFormat;
  };
  account: {
    id: string;
    email?: string;
    displayName?: string;
    isBlocked: boolean;
    softDeletedAt?: string | null;
    deleteAfter?: string | null;
    permanentlyDeletedAt?: string | null;
    processingRestrictedAt?: string | null;
    processingRestrictionReason?: string | null;
    nonEssentialProcessingOptOutAt?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  organizations: Array<{ id: string; organizationKey: string; displayName: string }>;
  roles: Array<{ id: string; roleName: string; description: string | null }>;
  groups: Array<{
    groupId: string;
    groupKey: string;
    displayName: string;
    groupType: string;
    origin: string;
    validFrom?: string;
    validTo?: string;
  }>;
  legalHolds: Array<{
    id: string;
    active: boolean;
    holdReason: string;
    holdUntil: string | null;
    createdAt: string;
  }>;
  dsrRequests: Array<{
    id: string;
    requestType: string;
    status: string;
    requestAcceptedAt: string;
    completedAt: string | null;
  }>;
  legalAcceptances: Array<{
    id: string;
    legalTextId: string;
    legalTextVersion: string;
    name: string;
    locale: string;
    acceptedAt: string;
    revokedAt?: string;
    actionType: string;
  }>;
  consents: {
    nonEssentialProcessingAllowed: boolean;
  };
};

const maybeDecryptField = (value: string | null | undefined, aad: string): string | undefined => {
  if (!value || !value.startsWith('enc:v1:')) {
    return undefined;
  }
  const config = parseFieldEncryptionConfigFromEnv(process.env);
  if (!config) {
    return undefined;
  }
  try {
    return decryptFieldValue(value, config.keyring, aad);
  } catch {
    return undefined;
  }
};

const escapeCsv = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
};

const flattenToCsvRows = (value: unknown, path = ''): Array<{ key: string; value: string }> => {
  if (value === null || value === undefined) {
    return [{ key: path, value: '' }];
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [{ key: path, value: String(value) }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenToCsvRows(entry, `${path}[${index}]`));
  }
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) =>
      flattenToCsvRows(nested, path ? `${path}.${key}` : key)
    );
  }
  return [{ key: path, value: String(value) }];
};

const toCsv = (payload: DsrExportPayload): string => {
  const rows = flattenToCsvRows(payload);
  const body = rows.map((row) => `${escapeCsv(row.key)},${escapeCsv(row.value)}`).join('\n');
  return `field,value\n${body}`;
};

const toXmlNode = (name: string, value: unknown): string => {
  if (value === null || value === undefined) {
    return `<${name}/>`;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const escaped = String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
    return `<${name}>${escaped}</${name}>`;
  }
  if (Array.isArray(value)) {
    return `<${name}>${value.map((entry) => toXmlNode('item', entry)).join('')}</${name}>`;
  }
  const objectValue = value as Record<string, unknown>;
  const children = Object.entries(objectValue)
    .map(([key, nested]) => toXmlNode(key, nested))
    .join('');
  return `<${name}>${children}</${name}>`;
};

const toXml = (payload: DsrExportPayload): string =>
  `<?xml version="1.0" encoding="UTF-8"?>${toXmlNode('dataExport', payload)}`;

export const collectDsrExportPayload = async (
  client: QueryClient,
  input: { instanceId: string; account: DsrExportAccountSnapshot; format: DsrExportFormat }
): Promise<DsrExportPayload> => {
  const { orgRows, roleRows } = await loadMembershipRows(client, {
    instanceId: input.instanceId,
    accountId: input.account.id,
  });
  const { holdRows, groupRows } = await loadGovernanceRows(client, {
    instanceId: input.instanceId,
    accountId: input.account.id,
  });
  const { requestRows, legalAcceptanceRows } = await loadLegalRows(client, {
    instanceId: input.instanceId,
    accountId: input.account.id,
  });

  const emailDecrypted = maybeDecryptField(
    input.account.email_ciphertext,
    `iam.accounts.email:${input.account.keycloak_subject}`
  );
  const displayNameDecrypted = maybeDecryptField(
    input.account.display_name_ciphertext,
    `iam.accounts.display_name:${input.account.keycloak_subject}`
  );

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      instanceId: input.instanceId,
      format: input.format,
    },
    account: {
      id: input.account.id,
      email: emailDecrypted,
      displayName: displayNameDecrypted,
      isBlocked: input.account.is_blocked,
      softDeletedAt: input.account.soft_deleted_at,
      deleteAfter: input.account.delete_after,
      permanentlyDeletedAt: input.account.permanently_deleted_at,
      processingRestrictedAt: input.account.processing_restricted_at,
      processingRestrictionReason: input.account.processing_restriction_reason,
      nonEssentialProcessingOptOutAt: input.account.non_essential_processing_opt_out_at,
      createdAt: input.account.created_at,
      updatedAt: input.account.updated_at,
    },
    organizations: orgRows.rows.map((row) => ({
      id: row.id,
      organizationKey: row.organization_key,
      displayName: row.display_name,
    })),
    roles: roleRows.rows.map((row) => ({
      id: row.id,
      roleName: row.role_name,
      description: row.description,
    })),
    groups: groupRows.rows.map((row) => ({
      groupId: row.group_id,
      groupKey: row.group_key,
      displayName: row.display_name,
      groupType: row.group_type,
      origin: row.origin,
      ...(row.valid_from ? { validFrom: row.valid_from } : {}),
      ...(row.valid_until ? { validTo: row.valid_until } : {}),
    })),
    legalHolds: holdRows.rows.map((row) => ({
      id: row.id,
      active: row.active,
      holdReason: row.hold_reason,
      holdUntil: row.hold_until,
      createdAt: row.created_at,
    })),
    dsrRequests: requestRows.rows.map((row) => ({
      id: row.id,
      requestType: row.request_type,
      status: row.status,
      requestAcceptedAt: row.request_accepted_at,
      completedAt: row.completed_at,
    })),
    legalAcceptances: legalAcceptanceRows.rows.map((row) => ({
      id: row.id,
      legalTextId: row.legal_text_id,
      legalTextVersion: row.legal_text_version,
      name: row.name,
      locale: row.locale,
      acceptedAt: row.accepted_at,
      ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
      actionType: row.action_type ?? 'accepted',
    })),
    consents: {
      nonEssentialProcessingAllowed: !input.account.non_essential_processing_opt_out_at,
    },
  };
};

export const serializeDsrExportPayload = (
  format: DsrExportFormat,
  payload: DsrExportPayload
): string => {
  if (format === 'csv') {
    return toCsv(payload);
  }
  if (format === 'xml') {
    return toXml(payload);
  }
  return JSON.stringify(payload, null, 2);
};
