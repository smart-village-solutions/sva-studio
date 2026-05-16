import { formatDateTimeInEditorTimeZone } from '@sva/plugin-sdk';
import { t } from '../../../i18n';
import type { IamHttpError } from '../../../lib/iam-api';

export type LegalTextStatus = 'draft' | 'valid' | 'archived';

export const getLegalTextErrorMessage = (error: IamHttpError | null): string => {
  if (!error) {
    return t('admin.legalTexts.messages.error');
  }

  switch (error.code) {
    case 'forbidden':
      return t('admin.legalTexts.errors.forbidden');
    case 'csrf_validation_failed':
      return t('admin.legalTexts.errors.csrfValidationFailed');
    case 'rate_limited':
      return t('admin.legalTexts.errors.rateLimited');
    case 'conflict':
      return t('admin.legalTexts.errors.conflict');
    case 'not_found':
      return t('admin.legalTexts.errors.notFound');
    case 'database_unavailable':
      return t('admin.legalTexts.errors.databaseUnavailable');
    case 'invalid_request':
      return error.message && error.message !== `http_${error.status}`
        ? error.message
        : t('admin.legalTexts.errors.invalidRequest');
    default:
      return t('admin.legalTexts.messages.error');
  }
};

export const formatLegalTextDateTime = (value?: string): string => {
  if (!value) {
    return t('admin.legalTexts.table.publishedUnset');
  }
  return formatDateTimeInEditorTimeZone(value) ?? value;
};
