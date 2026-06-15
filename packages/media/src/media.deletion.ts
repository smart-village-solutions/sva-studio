import type { MediaAsset, MediaDeletionDecision, MediaReference } from './media.types.entities.js';

const canDeleteMediaAsset = (input: {
  readonly asset: MediaAsset;
  readonly references: readonly MediaReference[];
  readonly legalHold?: boolean;
}): MediaDeletionDecision => {
  if (input.references.length > 0) {
    return {
      allowed: false,
      reason: 'active_references',
    };
  }

  if (input.legalHold) {
    return {
      allowed: false,
      reason: 'legal_hold',
    };
  }

  if (input.asset.uploadStatus !== 'processed' || input.asset.processingStatus !== 'ready') {
    return {
      allowed: false,
      reason: 'upload_incomplete',
    };
  }

  return {
    allowed: true,
    reason: null,
  };
};

export { canDeleteMediaAsset };
