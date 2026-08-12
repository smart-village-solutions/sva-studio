import { parsePermissionDenialDetails, type PermissionDenialDetails } from '@sva/core';

type PermissionDenialTranslationKey =
  | 'permissionDenial.missing.single'
  | 'permissionDenial.missing.allOf'
  | 'permissionDenial.missing.anyOf'
  | 'permissionDenial.context.single'
  | 'permissionDenial.context.multiple';

type PermissionDenialTranslator = (
  key: PermissionDenialTranslationKey,
  variables: Readonly<Record<string, string>>
) => string;

const readRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

export const readPermissionDenialFromError = (
  value: unknown
): PermissionDenialDetails | undefined => {
  const record = readRecord(value);
  if (!record) {
    return undefined;
  }
  const nestedError = readRecord(record.error);
  return parsePermissionDenialDetails(
    record.permissionDenial ?? record.details ?? nestedError?.details
  );
};

export const readPermissionDenialFromSearch = (
  search: URLSearchParams
): PermissionDenialDetails | undefined =>
  parsePermissionDenialDetails({
    required_permissions: search.getAll('requiredPermission'),
    requirement_mode: search.get('permissionMode'),
    denial_reason: search.get('permissionReason'),
  });

export const formatPermissionReference = (
  permissionId: string,
  resolveTitle: (permissionId: string) => string | undefined
): string => {
  const title = resolveTitle(permissionId)?.trim();
  return title && title !== permissionId ? `${title} (${permissionId})` : permissionId;
};

export const formatPermissionDenialMessage = (
  details: PermissionDenialDetails,
  input: Readonly<{
    resolveTitle: (permissionId: string) => string | undefined;
    translate: PermissionDenialTranslator;
  }>
): string => {
  const references = details.required_permissions.map((permissionId) =>
    formatPermissionReference(permissionId, input.resolveTitle)
  );
  const variables = { permission: references[0] ?? '', permissions: references.join(', ') };

  if (details.denial_reason !== 'permission_missing') {
    return input.translate(
      references.length === 1
        ? 'permissionDenial.context.single'
        : 'permissionDenial.context.multiple',
      variables
    );
  }
  if (references.length === 1) {
    return input.translate('permissionDenial.missing.single', variables);
  }
  return input.translate(
    details.requirement_mode === 'anyOf'
      ? 'permissionDenial.missing.anyOf'
      : 'permissionDenial.missing.allOf',
    variables
  );
};
