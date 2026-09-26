import { withTimeout } from './helpers.js';
import type { KeycloakErrorResponse } from './internal-models.js';
import type { KeycloakAdminFieldError } from './errors.js';

export const buildErrorDetails = async (
  response: Response,
  operation: string,
  readTimeoutMs: number
): Promise<{
  readonly message: string;
  readonly fieldErrors: readonly KeycloakAdminFieldError[];
}> => {
  const fallback = {
    message: `Keycloak ${operation} failed with HTTP ${response.status}`,
    fieldErrors: [],
  };
  try {
    const text = await withTimeout(response.text(), readTimeoutMs, 'read');
    if (!text) {
      return fallback;
    }
    const parsed = JSON.parse(text) as KeycloakErrorResponse;
    const fieldErrors: KeycloakAdminFieldError[] = [
      ...(parsed.field && parsed.errorMessage
        ? [{ field: parsed.field, code: parsed.errorMessage }]
        : []),
      ...(parsed.errors ?? []).flatMap((entry) =>
        typeof entry.errorMessage === 'string' && entry.errorMessage.length > 0
          ? [{ ...(entry.field ? { field: entry.field } : {}), code: entry.errorMessage }]
          : []
      ),
    ];
    if (parsed.error_description) {
      return {
        message: `Keycloak ${operation} failed: ${parsed.error_description}`,
        fieldErrors,
      };
    }
    if (fieldErrors.length > 0) {
      return {
        message: `Keycloak ${operation} failed: ${fieldErrors.map((entry) => entry.code).join(', ')}`,
        fieldErrors,
      };
    }
    if (parsed.errorMessage) {
      if (parsed.params && parsed.params.length > 0) {
        return {
          message: `Keycloak ${operation} failed: ${parsed.errorMessage} (${parsed.params.join(', ')})`,
          fieldErrors: [],
        };
      }
      return {
        message: `Keycloak ${operation} failed: ${parsed.errorMessage}`,
        fieldErrors: [],
      };
    }
    if (parsed.error) {
      return { message: `Keycloak ${operation} failed: ${parsed.error}`, fieldErrors: [] };
    }
    return fallback;
  } catch {
    return fallback;
  }
};
