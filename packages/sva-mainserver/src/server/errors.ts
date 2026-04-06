import type { SvaMainserverErrorCode } from '../types.js';

export class SvaMainserverError extends Error {
  readonly code: SvaMainserverErrorCode;
  readonly statusCode: number;

  constructor(input: {
    code: SvaMainserverErrorCode;
    message: string;
    statusCode?: number;
  }) {
    super(input.message);
    this.name = 'SvaMainserverError';
    this.code = input.code;
    this.statusCode = input.statusCode ?? 500;
  }
}
