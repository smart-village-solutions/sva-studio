import { t } from '../../i18n';
import type { IamHttpError } from '../../lib/iam-api';
import { getStudioPermissionDenialMessage } from '../../lib/studio-permission-denial-message';

export const formatMonitoringJobsListError = (error: IamHttpError | null): string => {
  const permissionMessage = getStudioPermissionDenialMessage(error);
  if (permissionMessage) return permissionMessage;
  if (error?.code === 'forbidden') return t('monitoring.jobs.errors.forbidden');
  if (error?.code === 'database_unavailable') {
    return t('monitoring.jobs.errors.databaseUnavailable');
  }
  return t('monitoring.jobs.messages.loadError');
};

export const formatMonitoringJobDetailError = (error: IamHttpError | null): string => {
  const permissionMessage = getStudioPermissionDenialMessage(error);
  if (permissionMessage) return permissionMessage;
  if (error?.code === 'not_found') return t('monitoring.jobs.errors.notFound');
  if (error?.code === 'forbidden') return t('monitoring.jobs.errors.forbidden');
  if (error?.code === 'database_unavailable') {
    return t('monitoring.jobs.errors.databaseUnavailable');
  }
  return t('monitoring.jobs.messages.detailLoadError');
};
