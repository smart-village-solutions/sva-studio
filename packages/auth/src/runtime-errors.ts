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
  | 'tenant_host_invalid'
  | 'tenant_inactive';

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
    case 'tenant_inactive':
      return `Tenant auth configuration for ${input.host} is inactive`;
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
      (input.reason === 'tenant_inactive'
        ? 'Anmeldung ist für diesen Mandanten derzeit nicht verfügbar, weil die Instanz nicht aktiv ist.'
        : 'Anmeldung ist für diesen Mandanten momentan nicht verfügbar. Bitte später erneut versuchen.');
    if (input.cause !== undefined) {
      this.cause = input.cause;
    }
  }
}

export class SessionUserHydrationError extends Error {
  readonly requestHost?: string;
  readonly reason: 'missing_instance_id';
  readonly statusCode = 401;

  constructor(input: { reason: 'missing_instance_id'; requestHost?: string }) {
    super('Session user is missing required instance context');
    this.name = 'SessionUserHydrationError';
    this.reason = input.reason;
    this.requestHost = input.requestHost;
  }
}

export class TenantScopeConflictError extends Error {
  readonly actualInstanceId: string;
  readonly expectedInstanceId: string;
  readonly reason = 'tenant_scope_conflict';
  readonly statusCode = 401;

  constructor(input: { actualInstanceId: string; expectedInstanceId: string }) {
    super('Tenant login token contains a conflicting instance context');
    this.name = 'TenantScopeConflictError';
    this.actualInstanceId = input.actualInstanceId;
    this.expectedInstanceId = input.expectedInstanceId;
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
