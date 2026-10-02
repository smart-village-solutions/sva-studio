import type { IamContentStatus } from './content-management-foundation.js';

export type IamContentHistoryEntry = {
  readonly id: string;
  readonly contentId: string;
  readonly action: 'created' | 'updated' | 'status_changed';
  readonly actor: string;
  readonly changedFields: readonly string[];
  readonly fromStatus?: IamContentStatus;
  readonly toStatus?: IamContentStatus;
  readonly createdAt: string;
  readonly summary?: string;
  readonly origin: 'studio';
  readonly coverage: 'studio_mutations';
};

export const iamContentOwnerPrincipalTypes = ['account', 'organization'] as const;
export type IamContentOwnerPrincipalType = (typeof iamContentOwnerPrincipalTypes)[number];
export type IamContentOwnerPrincipal = {
  readonly type: IamContentOwnerPrincipalType;
  readonly id: string;
};

export type TransferIamContentOwnershipInput = {
  readonly targetPrincipal: IamContentOwnerPrincipal;
};

export type IamContentOwnershipTransferResult = {
  readonly contentId: string;
  readonly sourcePrincipal?: IamContentOwnerPrincipal;
  readonly targetPrincipal: IamContentOwnerPrincipal;
  readonly authorDisplayName: string;
};

export type IamContentOwnershipTarget = {
  readonly principal: IamContentOwnerPrincipal;
  readonly displayName: string;
  readonly readiness?: 'ready' | 'verification_required';
};

export type IamContentOwnershipTargetList = {
  readonly items: readonly IamContentOwnershipTarget[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};
