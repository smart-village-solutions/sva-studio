import type { IamContentOwnerPrincipal, IamContentOwnershipTarget } from '@sva/core';

export type ContentOwnershipPanelOwner = Readonly<{
  principal?: IamContentOwnerPrincipal;
  principalType?: IamContentOwnerPrincipal['type'];
  displayName: string;
}>;

export type ContentOwnershipPanelLabels = Readonly<{
  title: string;
  currentOwner: string;
  account: string;
  organization: string;
  verificationRequired: string;
  saveKeepsOwner: string;
  transferUnavailable: string;
  transferForbidden: string;
  transferAction: string;
  dialogTitle: string;
  dialogDescription: string;
  targetType: string;
  search: string;
  searchAction: string;
  loading: string;
  loadError: string;
  noTargets: string;
  previousPage: string;
  nextPage: string;
  confirmation: string;
  accessWarning: string;
  authorEffect: string;
  cancel: string;
  confirm: string;
  transferring: string;
  success: string;
  transferError: string;
}>;

export type ContentOwnershipTargetLoader = (input: {
  readonly type: 'account' | 'organization';
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
}) => Promise<Readonly<{ items: readonly IamContentOwnershipTarget[]; total: number }>>;

export type ContentOwnershipPanelProps = Readonly<{
  currentOwner: ContentOwnershipPanelOwner;
  supported: boolean;
  canTransfer: boolean;
  labels: ContentOwnershipPanelLabels;
  loadTargets: ContentOwnershipTargetLoader;
  onTransfer: (target: IamContentOwnershipTarget) => Promise<void>;
  resolveTransferError?: (error: unknown) => string;
  pageSize?: number;
}>;

export const principalTypeLabel = (
  type: IamContentOwnerPrincipal['type'] | undefined,
  labels: ContentOwnershipPanelLabels
) => (type === 'organization' ? labels.organization : labels.account);
