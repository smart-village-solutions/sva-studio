import { resolveApiErrorCode } from './waste-management.page.support.js';
import { WasteManagementApiError } from './waste-management.api.shared.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export const createWasteToolErrorMessage = ({
  action,
  error,
  pt,
}: {
  readonly action: 'import' | 'migration' | 'seed' | 'reset';
  readonly error: unknown;
  readonly pt: Translate;
}) => {
  const code = resolveApiErrorCode(error);

  if (code === 'forbidden') {
    return pt('tools.messages.forbidden');
  }
  if (action === 'import' && code === 'invalid_request') {
    return pt('tools.messages.importValidationError');
  }
  if (action === 'reset' && code === 'invalid_request') {
    return pt('tools.messages.resetValidationError');
  }
  if (error instanceof WasteManagementApiError && error.message.length > 0 && error.message !== error.code) {
    return pt('tools.messages.jobStartErrorWithReason', { reason: error.message });
  }
  return pt('tools.messages.jobStartError');
};
