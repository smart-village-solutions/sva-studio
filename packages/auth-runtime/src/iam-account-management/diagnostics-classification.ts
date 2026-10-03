import type { ApiErrorCode } from '@sva/core';
import { IamSchemaDriftError } from '../runtime-errors.js';

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
  'iam.account_groups.origin': '0019_iam_account_groups_origin_compat.sql',
  'iam.activity_logs': '0001_iam_core.sql',
  'iam.platform_activity_logs': '0028_iam_platform_activity_logs.sql',
  'iam.accounts.avatar_url': '0004_iam_account_profile.sql',
  'iam.group_roles': '0014_iam_groups.sql',
  'iam.groups': '0014_iam_groups.sql',
  'iam.accounts.instance_id': '0004_iam_account_profile.sql',
  'iam.accounts.notes': '0004_iam_account_profile.sql',
  'iam.accounts.preferred_language': '0004_iam_account_profile.sql',
  'iam.accounts.timezone': '0004_iam_account_profile.sql',
  'iam.accounts.username_ciphertext': '0011_iam_account_username.sql',
  'iam.instance_hostnames': '0025_iam_instance_registry_provisioning.sql',
  'iam.instances.auth_client_secret_ciphertext': '0027_iam_instance_keycloak_bootstrap.sql',
  'iam.instances.primary_hostname': '0025_iam_instance_registry_provisioning.sql',
  'iam.instances.tenant_admin_client_id': '0030_iam_tenant_admin_client_contract.sql',
  'iam.instances.tenant_admin_client_secret_ciphertext':
    '0030_iam_tenant_admin_client_contract.sql',
  'iam.instances.tenant_admin_email': '0027_iam_instance_keycloak_bootstrap.sql',
  'iam.instances.tenant_admin_first_name': '0027_iam_instance_keycloak_bootstrap.sql',
  'iam.instances.tenant_admin_last_name': '0027_iam_instance_keycloak_bootstrap.sql',
  'iam.instances.tenant_admin_username': '0027_iam_instance_keycloak_bootstrap.sql',
  idx_accounts_kc_subject_instance: '0004_iam_account_profile.sql',
  'policy:accounts_isolation_policy': '0018_iam_accounts_instance_policy.sql',
  'policy:instance_memberships_isolation_policy': '0001_iam_core.sql',
} as const;

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

const classifyPostgresDiagnosticError = (
  pgError: PgLikeError,
  fallbackMessage: string,
  requestId?: string
): IamDiagnosticErrorShape | undefined => {
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

  return undefined;
};

export const classifyIamDiagnosticError = (
  error: unknown,
  fallbackMessage: string,
  requestId?: string
): IamDiagnosticErrorShape => {
  if (error instanceof IamSchemaDriftError) {
    return buildDatabaseDiagnosticError({
      status: 503,
      code: 'database_unavailable',
      fallbackMessage,
      requestId,
      reasonCode: 'schema_drift',
      detailsBase: {
        expected_migration: error.expectedMigration,
        schema_object: error.schemaObject,
      },
    });
  }

  const pgError = error as PgLikeError;
  const postgresDiagnostic = classifyPostgresDiagnosticError(pgError, fallbackMessage, requestId);
  if (postgresDiagnostic) {
    return postgresDiagnostic;
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
