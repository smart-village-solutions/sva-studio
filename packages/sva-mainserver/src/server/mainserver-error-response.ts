import { errorJson } from './content-route-helpers.js';
import { SvaMainserverError } from './errors.js';

const MAINSERVER_ERROR_STATUS_BY_CODE = {
  missing_credentials: 400,
  organization_mainserver_credentials_missing: 409,
  invalid_config: 400,
  config_not_found: 400,
  integration_disabled: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  database_unavailable: 503,
  identity_provider_unavailable: 503,
  network_error: 503,
  token_request_failed: 502,
  graphql_error: 502,
  invalid_response: 502,
} satisfies Record<string, number>;

export const toMainserverErrorResponse = (error: unknown, fallbackMessage: string): Response => {
  if (error instanceof SvaMainserverError) {
    const status = error.statusCode ?? MAINSERVER_ERROR_STATUS_BY_CODE[error.code] ?? 502;
    return errorJson(status, error.code, error.message);
  }

  return errorJson(500, 'internal_error', fallbackMessage);
};
