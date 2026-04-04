export class SessionStoreUnavailableError extends Error {
  readonly cause?: unknown;
  readonly statusCode = 503;
  readonly operation: string;

  constructor(operation: string, cause?: unknown) {
    super(`Session store unavailable during ${operation}`);
    this.name = 'SessionStoreUnavailableError';
    this.operation = operation;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export type TenantAuthResolutionFailureReason =
  | 'tenant_lookup_failed'
  | 'tenant_not_found'
  | 'tenant_host_invalid';

const buildTenantAuthResolutionMessage = (input: {
  host: string;
  reason: TenantAuthResolutionFailureReason;
}): string => {
  switch (input.reason) {
    case 'tenant_lookup_failed':
      return `Tenant auth configuration could not be loaded for ${input.host}`;
    case 'tenant_not_found':
      return `Tenant auth configuration not found for ${input.host}`;
    case 'tenant_host_invalid':
      return `Tenant host ${input.host} is not valid for tenant auth resolution`;
  }
};

export class TenantAuthResolutionError extends Error {
  readonly cause?: unknown;
  readonly host: string;
  readonly publicMessage: string;
  readonly reason: TenantAuthResolutionFailureReason;
  readonly statusCode = 503;

  constructor(input: {
    host: string;
    publicMessage?: string;
    reason: TenantAuthResolutionFailureReason;
    cause?: unknown;
  }) {
    super(buildTenantAuthResolutionMessage(input));
    this.name = 'TenantAuthResolutionError';
    this.host = input.host;
    this.reason = input.reason;
    this.publicMessage =
      input.publicMessage ??
      'Anmeldung ist für diesen Mandanten momentan nicht verfügbar. Bitte später erneut versuchen.';
    if (input.cause !== undefined) {
      this.cause = input.cause;
    }
  }
}

export class IamSchemaDriftError extends Error {
  readonly cause?: unknown;
  readonly expectedMigration?: string;
  readonly operation: string;
  readonly schemaObject: string;

  constructor(input: {
    message: string;
    operation: string;
    schemaObject: string;
    expectedMigration?: string;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = 'IamSchemaDriftError';
    this.operation = input.operation;
    this.schemaObject = input.schemaObject;
    this.expectedMigration = input.expectedMigration;
    if (input.cause !== undefined) {
      this.cause = input.cause;
    }
  }
}
