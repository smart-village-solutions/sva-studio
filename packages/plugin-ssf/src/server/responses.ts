import { SSF_RUNTIME_LIMITS, type SsfRuntimeErrorCode } from '../constants.js';

const CORRELATION_HEADER = 'X-Correlation-Id';
const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7e]+$/u;

export const readCorrelationId = (request: Request): string => {
  const value = request.headers.get(CORRELATION_HEADER)?.trim();
  return value && value.length <= SSF_RUNTIME_LIMITS.correlationIdCharacters &&
    PRINTABLE_ASCII_PATTERN.test(value) ? value : 'unavailable';
};

export const jsonResponse = (status: number, body: unknown, correlationId: string): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', [CORRELATION_HEADER]: correlationId },
  });

export const unavailableResponse = (
  correlationId: string, contractVersion: '1.0' | '2.0' = '1.0'
): Response => {
  const code: SsfRuntimeErrorCode = 'runtime_configuration_unavailable';
  return jsonResponse(503, {
    contractVersion,
    error: {
      code,
      message: 'Runtime configuration is unavailable.',
      retryable: true,
      correlationId,
    },
  }, correlationId);
};
