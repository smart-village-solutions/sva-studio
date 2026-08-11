export class MainserverUserProvisioningError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly outcomeUnknown: boolean;

  constructor(input: {
    readonly code: string;
    readonly message: string;
    readonly statusCode: number;
    readonly retryable?: boolean;
    readonly outcomeUnknown?: boolean;
  }) {
    super(input.message);
    this.name = 'MainserverUserProvisioningError';
    this.code = input.code;
    this.statusCode = input.statusCode;
    this.retryable = input.retryable ?? false;
    this.outcomeUnknown = input.outcomeUnknown ?? false;
  }
}
