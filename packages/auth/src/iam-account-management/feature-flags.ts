import type { FeatureFlags } from './types';
import { createApiError } from './api-helpers';
import { logger } from './shared';

export const parseBooleanFlag = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) {
    return defaultValue;
  }
  const lowered = value.trim().toLowerCase();
  return lowered === '1' || lowered === 'true' || lowered === 'yes' || lowered === 'on';
};

export const getFeatureFlags = (): FeatureFlags => {
  const readFlag = (key: string, defaultValue: boolean) => parseBooleanFlag(process.env[key], defaultValue);

  const iamUiEnabled = readFlag('IAM_UI_ENABLED', true);
  const iamAdminEnabled = iamUiEnabled && readFlag('IAM_ADMIN_ENABLED', true);
  const iamBulkEnabled = iamAdminEnabled && readFlag('IAM_BULK_ENABLED', true);

  return { iamUiEnabled, iamAdminEnabled, iamBulkEnabled };
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
    return createApiError(503, 'feature_disabled', 'Feature iam-ui-enabled ist deaktiviert.', requestId);
  }
  if (feature === 'iam_admin' && !flags.iamAdminEnabled) {
    logger.warn('IAM feature guard rejected request', {
      operation: 'ensure_feature',
      feature,
      request_id: requestId,
    });
    return createApiError(503, 'feature_disabled', 'Feature iam-admin-enabled ist deaktiviert.', requestId);
  }
  if (feature === 'iam_bulk' && !flags.iamBulkEnabled) {
    logger.warn('IAM feature guard rejected request', {
      operation: 'ensure_feature',
      feature,
      request_id: requestId,
    });
    return createApiError(503, 'feature_disabled', 'Feature iam-bulk-enabled ist deaktiviert.', requestId);
  }
  return null;
};
