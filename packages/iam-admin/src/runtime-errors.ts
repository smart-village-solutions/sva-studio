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
