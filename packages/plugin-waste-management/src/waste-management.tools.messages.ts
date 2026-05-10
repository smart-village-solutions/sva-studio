import { resolveApiErrorCode } from './waste-management.page.support.js';

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
  return pt('tools.messages.jobStartError');
};
