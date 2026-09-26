export type KeycloakAdminFieldError = {
  readonly field?: string;
  readonly code: string;
};

export class KeycloakAdminUnavailableError extends Error {
  readonly statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = 'KeycloakAdminUnavailableError';
  }
}

export class KeycloakAdminRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly fieldErrors: readonly KeycloakAdminFieldError[];

  constructor(input: {
    message: string;
    statusCode: number;
    code: string;
    retryable: boolean;
    fieldErrors?: readonly KeycloakAdminFieldError[];
  }) {
    super(input.message);
    this.name = 'KeycloakAdminRequestError';
    this.statusCode = input.statusCode;
    this.code = input.code;
    this.retryable = input.retryable;
    this.fieldErrors = input.fieldErrors ?? [];
  }
}
