import { t } from '../i18n';
import {
  formatPermissionDenialMessage,
  readPermissionDenialFromError,
} from './permission-denial-presentation';
import { resolvePermissionTitle } from './permission-labels';

export const getStudioPermissionDenialMessage = (error: unknown): string | undefined => {
  const permissionDenial = readPermissionDenialFromError(error);
  if (!permissionDenial) {
    return undefined;
  }

  return formatPermissionDenialMessage(permissionDenial, {
    resolveTitle: resolvePermissionTitle,
    translate: (key, variables) => t(key, variables),
  });
};
