import { decryptFieldValue, parseFieldEncryptionConfigFromEnv } from '@sva/core/security';

import type { QueryClient } from './query-client.js';

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
    subject: string;
  };
  account: {
    id: string;
    keycloakSubject: string;
    email?: string;
    displayName?: string;
    encryptedEmail?: string | null;
    encryptedDisplayName?: string | null;
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
  legalHolds: Array<{ id: string; active: boolean; holdReason: string; holdUntil: string | null; createdAt: string }>;
  dsrRequests: Array<{
    id: string;
    requestType: string;
    status: string;
    requestAcceptedAt: string;
    completedAt: string | null;
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
    return `"${value.replace(/"/g, '""')}"`;
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
    return Object.entries(value).flatMap(([key, nested]) => flattenToCsvRows(nested, path ? `${path}.${key}` : key));
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
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
  const orgRows = await client.query<{ id: string; organization_key: string; display_name: string }>(
    `
SELECT o.id, o.organization_key, o.display_name
FROM iam.account_organizations ao
JOIN iam.organizations o
  ON o.instance_id = ao.instance_id
 AND o.id = ao.organization_id
WHERE ao.instance_id = $1
  AND ao.account_id = $2::uuid
ORDER BY o.display_name ASC;
`,
    [input.instanceId, input.account.id]
  );

  const roleRows = await client.query<{ id: string; role_name: string; description: string | null }>(
    `
SELECT r.id, r.role_name, r.description
FROM iam.account_roles ar
JOIN iam.roles r
  ON r.instance_id = ar.instance_id
 AND r.id = ar.role_id
WHERE ar.instance_id = $1
  AND ar.account_id = $2::uuid
ORDER BY r.role_name ASC;
`,
    [input.instanceId, input.account.id]
  );

  const holdRows = await client.query<{
    id: string;
    active: boolean;
    hold_reason: string;
    hold_until: string | null;
    created_at: string;
  }>(
    `
SELECT id, active, hold_reason, hold_until, created_at
FROM iam.legal_holds
WHERE instance_id = $1
  AND account_id = $2::uuid
ORDER BY created_at DESC
LIMIT 20;
`,
    [input.instanceId, input.account.id]
  );

  const requestRows = await client.query<{
    id: string;
    request_type: string;
    status: string;
    request_accepted_at: string;
    completed_at: string | null;
  }>(
    `
SELECT id, request_type, status, request_accepted_at, completed_at
FROM iam.data_subject_requests
WHERE instance_id = $1
  AND target_account_id = $2::uuid
ORDER BY request_accepted_at DESC
LIMIT 50;
`,
    [input.instanceId, input.account.id]
  );

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
      subject: input.account.keycloak_subject,
    },
    account: {
      id: input.account.id,
      keycloakSubject: input.account.keycloak_subject,
      email: emailDecrypted,
      displayName: displayNameDecrypted,
      encryptedEmail: input.account.email_ciphertext,
      encryptedDisplayName: input.account.display_name_ciphertext,
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
    consents: {
      nonEssentialProcessingAllowed: !input.account.non_essential_processing_opt_out_at,
    },
  };
};

export const serializeDsrExportPayload = (format: DsrExportFormat, payload: DsrExportPayload): string => {
  if (format === 'csv') {
    return toCsv(payload);
  }
  if (format === 'xml') {
    return toXml(payload);
  }
  return JSON.stringify(payload, null, 2);
};
