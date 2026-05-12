import type { ExternalInterfaceVisibleStatus } from '@sva/core';

import type { SvaMainserverInstanceConfig } from '../types.js';

export const mapVisibleStatusToVerificationStatus = (
  visibleStatus: ExternalInterfaceVisibleStatus | undefined
): SvaMainserverInstanceConfig['lastVerifiedStatus'] => {
  switch (visibleStatus) {
    case 'ok':
      return 'ok';
    case 'error':
    case 'not_configured':
      return 'error';
    case 'disabled':
      return 'disabled';
    default:
      return undefined;
  }
};
