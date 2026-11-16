import type {
  SvaMainserverOwnershipTransferInput,
  SvaMainserverOwnershipTransferResult,
} from '../../types.js';
import { toSvaMainserverError } from './shared.js';

/**
 * Mainserver resource writes replace nested associations, even when omitted. A fresh read
 * cannot reconstruct every stored relation (for example past event dates). Re-enable only
 * with an upstream ownership-only mutation that preserves content and relation identities.
 */
export const transferContentOwnership: (
  input: SvaMainserverOwnershipTransferInput
) => Promise<SvaMainserverOwnershipTransferResult> = async () => {
  throw toSvaMainserverError({
    code: 'content_transfer_temporarily_disabled',
    message: 'content_transfer_temporarily_disabled',
    statusCode: 409,
  });
};
