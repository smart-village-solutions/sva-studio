import type { ApiErrorCode } from '@sva/core';
import * as otelApi from '@opentelemetry/api';

type DiagnosticAttributes = Record<string, boolean | number | string | undefined>;

type PgLikeError = Error & {
  code?: string;
  column?: string;
  constraint?: string;
  message: string;
  table?: string;
};

export type IamDiagnosticErrorShape = {
  readonly code: ApiErrorCode;
  readonly dependency?: 'database' | 'keycloak' | 'redis';
  readonly details: Readonly<Record<string, unknown>>;
  readonly message: string;
  readonly status: number;
};

const SCHEMA_OBJECT_MIGRATION_HINTS: Record<string, string> = {
  'iam.account_groups': '0014_iam_groups.sql',
  'iam.account_groups.origin': '0018_iam_account_groups_origin_compat.sql',
  'iam.activity_logs': '0001_iam_core.sql',
  'iam.accounts.avatar_url': '0004_iam_account_profile.sql',
  'iam.group_roles': '0014_iam_groups.sql',
  'iam.groups': '0014_iam_groups.sql',
  'iam.accounts.instance_id': '0004_iam_account_profile.sql',
  'iam.accounts.notes': '0004_iam_account_profile.sql',
  'iam.accounts.preferred_language': '0004_iam_account_profile.sql',
  'iam.accounts.timezone': '0004_iam_account_profile.sql',
  'iam.accounts.username_ciphertext': '0011_iam_account_username.sql',
  'idx_accounts_kc_subject_instance': '0004_iam_account_profile.sql',
  'policy:accounts_isolation_policy': '0017_iam_accounts_instance_policy.sql',
  'policy:instance_memberships_isolation_policy': '0001_iam_core.sql',
} as const;

const sanitizeAttributeValue = (value: unknown): boolean | number | string | undefined => {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > 256 ? value.slice(0, 256) : value;
  }

  return undefined;
};

const getActiveSpan = () => {
  try {
    return otelApi.trace?.getActiveSpan?.() ?? null;
  } catch {
    return null;
  }
};

export const annotateActiveSpan = (attributes: DiagnosticAttributes) => {
  const span = getActiveSpan();
  if (!span) {
    return;
  }

  const sanitized = Object.fromEntries(
    Object.entries(attributes)
      .map(([key, value]) => [key, sanitizeAttributeValue(value)])
      .filter((entry): entry is [string, boolean | number | string] => entry[1] !== undefined)
  );

  if (Object.keys(sanitized).length > 0) {
    span.setAttributes(sanitized);
  }
};

export const addActiveSpanEvent = (name: string, attributes: DiagnosticAttributes = {}) => {
  const span = getActiveSpan();
  if (!span) {
    return;
  }

  const sanitized = Object.fromEntries(
    Object.entries(attributes)
      .map(([key, value]) => [key, sanitizeAttributeValue(value)])
      .filter((entry): entry is [string, boolean | number | string] => entry[1] !== undefined)
  );

  span.addEvent(name, sanitized);
};

export const annotateApiErrorSpan = (input: {
  status: number;
  code: ApiErrorCode;
  details?: Readonly<Record<string, unknown>>;
}) => {
  const reasonCode =
    typeof input.details?.reason_code === 'string' ? input.details.reason_code : undefined;

  annotateActiveSpan({
    'iam.error_code': input.code,
    'iam.reason_code': reasonCode,
    'http.response.status_code': input.status,
    'dependency.name':
      typeof input.details?.dependency === 'string' ? input.details.dependency : undefined,
    'db.schema_object':
      typeof input.details?.schema_object === 'string' ? input.details.schema_object : undefined,
  });

  addActiveSpanEvent('iam.api_error', {
    'iam.error_code': input.code,
    'iam.reason_code': reasonCode,
    'http.response.status_code': input.status,
  });
};

export const createActorResolutionDetails = (input: {
  actorResolution: 'missing_actor_account' | 'missing_instance_membership';
  instanceId: string;
}) => ({
  actor_resolution: input.actorResolution,
  instance_id: input.instanceId,
  reason_code: input.actorResolution,
} satisfies Readonly<Record<string, unknown>>);

const buildSchemaObject = (error: PgLikeError) => {
  if (error.table && error.column) {
    return `${error.table}.${error.column}`;
  }

  if (error.table) {
    return error.table;
  }

  const relationMatch = /relation "([^"]+)"/u.exec(error.message);
  if (relationMatch) {
    return relationMatch[1];
  }

  const columnMatch = /column "([^"]+)"/u.exec(error.message);
  if (columnMatch) {
    return columnMatch[1];
  }

  return undefined;
};

const lookupExpectedMigration = (schemaObject: string | undefined) => {
  if (!schemaObject) {
    return undefined;
  }

  return SCHEMA_OBJECT_MIGRATION_HINTS[schemaObject];
};

const buildConstraintDetails = (error: PgLikeError) =>
  error.constraint
    ? ({
        constraint: error.constraint,
      } satisfies Readonly<Record<string, unknown>>)
    : {};

const buildRequestDetails = (requestId?: string) =>
  requestId
    ? ({
        request_id: requestId,
      } satisfies Readonly<Record<string, unknown>>)
    : {};

const buildDiagnosticError = (input: {
  code: ApiErrorCode;
  dependency?: IamDiagnosticErrorShape['dependency'];
  details: Readonly<Record<string, unknown>>;
  message: string;
  status: number;
}): IamDiagnosticErrorShape => ({
  status: input.status,
  code: input.code,
  message: input.message,
  dependency: input.dependency,
  details: input.details,
});

const buildDatabaseDiagnosticError = (input: {
  code: ApiErrorCode;
  detailsBase?: Readonly<Record<string, unknown>>;
  fallbackMessage: string;
  reasonCode: string;
  requestId?: string;
  status: number;
  extraDetails?: Readonly<Record<string, unknown>>;
}): IamDiagnosticErrorShape =>
  buildDiagnosticError({
    status: input.status,
    code: input.code,
    message: input.fallbackMessage,
    dependency: 'database',
    details: {
      ...buildRequestDetails(input.requestId),
      ...input.detailsBase,
      ...input.extraDetails,
      dependency: 'database',
      reason_code: input.reasonCode,
    },
  });

export const classifyIamDiagnosticError = (
  error: unknown,
  fallbackMessage: string,
  requestId?: string
): IamDiagnosticErrorShape => {
  const pgError = error as PgLikeError;
  const schemaObject = buildSchemaObject(pgError);
  const expectedMigration = lookupExpectedMigration(schemaObject);
  const detailsBase = {
    ...(schemaObject ? { schema_object: schemaObject } : {}),
    ...(expectedMigration ? { expected_migration: expectedMigration } : {}),
  };

  if (pgError?.code === '42P01') {
    return buildDatabaseDiagnosticError({
      status: 503,
      code: 'database_unavailable',
      fallbackMessage,
      requestId,
      detailsBase,
      reasonCode: 'missing_table',
    });
  }

  if (pgError?.code === '42703') {
    return buildDatabaseDiagnosticError({
      status: 500,
      code: 'internal_error',
      fallbackMessage,
      requestId,
      detailsBase,
      reasonCode: 'missing_column',
    });
  }

  if (pgError?.code === '23502') {
    return buildDatabaseDiagnosticError({
      status: 500,
      code: 'internal_error',
      fallbackMessage,
      requestId,
      detailsBase,
      reasonCode: 'not_null_violation',
    });
  }

  if (pgError?.code === '23503') {
    return buildDatabaseDiagnosticError({
      status: 500,
      code: 'internal_error',
      fallbackMessage,
      requestId,
      detailsBase,
      reasonCode: 'foreign_key_violation',
      extraDetails: buildConstraintDetails(pgError),
    });
  }

  if (
    pgError?.code === '42501' &&
    /row-level security|policy|permission denied/iu.test(pgError.message)
  ) {
    return buildDatabaseDiagnosticError({
      status: 500,
      code: 'internal_error',
      fallbackMessage,
      requestId,
      detailsBase,
      reasonCode: 'rls_denied',
    });
  }

  if (pgError?.message?.startsWith('pii_encryption_required')) {
    return buildDiagnosticError({
      status: 503,
      code: 'internal_error',
      message: fallbackMessage,
      details: {
        ...buildRequestDetails(requestId),
        reason_code: 'pii_encryption_missing',
      },
    });
  }

  if (pgError?.message === 'jit_provision_failed') {
    return buildDatabaseDiagnosticError({
      status: 500,
      code: 'internal_error',
      fallbackMessage,
      requestId,
      reasonCode: 'jit_provision_failed',
    });
  }

  if (pgError?.message === 'IAM database not configured') {
    return buildDatabaseDiagnosticError({
      status: 503,
      code: 'database_unavailable',
      fallbackMessage,
      requestId,
      reasonCode: 'database_not_configured',
    });
  }

  return buildDiagnosticError({
    status: 500,
    code: 'internal_error',
    message: fallbackMessage,
    details: {
      ...buildRequestDetails(requestId),
      reason_code: 'unexpected_internal_error',
    },
  });
};
