export const iamCoreVersion = '0.0.1';

export const iamCorePackageRoles = [
  'authorization-contracts',
  'permission-engine',
  'pii-invariants',
] as const;

export type IamCorePackageRole = (typeof iamCorePackageRoles)[number];

export { evaluateAuthorizeDecision } from '@sva/core';
export type {
  AllowReasonCode,
  AuthorizeRequest,
  AuthorizeResponse,
  AuthorizeReasonCode,
  DenyReasonCode,
  EffectivePermission,
  IamAction,
  IamPermissionEffect,
  IamResourceRef,
  MatchedPermissionSummary,
} from '@sva/core';
