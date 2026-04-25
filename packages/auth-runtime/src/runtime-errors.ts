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
