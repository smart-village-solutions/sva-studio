import { deriveIamRuntimeDiagnostics, type ApiErrorCode, type ApiErrorResponse } from '@sva/core';
import { createSdkLogger } from '@sva/server-runtime';

import type { FeatureFlags } from './types.js';
export { getFeatureFlags, parseBooleanFlag } from './feature-flags-core.js';

const logger = createSdkLogger({
  component: 'iam-account-management',
  level: 'info',
});

const createFeatureApiError = (
  code: ApiErrorCode,
  message: string,
  requestId?: string
): Response => {
  const diagnostics = deriveIamRuntimeDiagnostics({ code, status: 503 });

  return Response.json(
    {
      error: {
        code,
        message,
        classification: diagnostics.classification,
        status: diagnostics.status,
        recommendedAction: diagnostics.recommendedAction,
        ...(diagnostics.safeDetails ? { safeDetails: diagnostics.safeDetails } : {}),
      },
      ...(requestId ? { requestId } : {}),
    } satisfies ApiErrorResponse,
    {
      status: 503,
      headers: requestId ? { 'X-Request-Id': requestId } : undefined,
    }
  );
};

export const ensureFeature = (
  flags: FeatureFlags,
  feature: 'iam_ui' | 'iam_admin' | 'iam_bulk',
  requestId?: string
): Response | null => {
  if (feature === 'iam_ui' && !flags.iamUiEnabled) {
    logger.warn('IAM feature guard rejected request', {
      operation: 'ensure_feature',
      feature,
      request_id: requestId,
    });
    return createFeatureApiError('feature_disabled', 'Feature iam-ui-enabled ist deaktiviert.', requestId);
  }
  if (feature === 'iam_admin' && !flags.iamAdminEnabled) {
    logger.warn('IAM feature guard rejected request', {
      operation: 'ensure_feature',
      feature,
      request_id: requestId,
    });
    return createFeatureApiError('feature_disabled', 'Feature iam-admin-enabled ist deaktiviert.', requestId);
  }
  if (feature === 'iam_bulk' && !flags.iamBulkEnabled) {
    logger.warn('IAM feature guard rejected request', {
      operation: 'ensure_feature',
      feature,
      request_id: requestId,
    });
    return createFeatureApiError('feature_disabled', 'Feature iam-bulk-enabled ist deaktiviert.', requestId);
  }
  return null;
};
