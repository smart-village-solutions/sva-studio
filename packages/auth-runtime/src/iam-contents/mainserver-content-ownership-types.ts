import type { IamContentOwnerPrincipal } from '@sva/core';

export type MainserverOwnershipTargetErrorCode =
  | 'content_transfer_target_invalid'
  | 'content_transfer_target_credentials_missing'
  | 'content_transfer_target_binding_missing'
  | 'content_transfer_target_binding_conflict'
  | 'database_unavailable'
  | 'identity_provider_unavailable';

export type ResolvedMainserverOwnershipTarget = Readonly<{
  principal: IamContentOwnerPrincipal;
  dataProviderId: string;
  dataProviderName?: string;
  bindingId: string;
  bindingVersion: string;
  connection: Readonly<{
    instanceId: string;
    keycloakSubject: string;
    activeOrganizationId?: string;
    actingPrincipalType: 'organization' | 'user';
    credentialFingerprint: string;
  }>;
}>;

export type MainserverOwnershipVerificationCandidate = Readonly<{
  principal: IamContentOwnerPrincipal;
  connection: ResolvedMainserverOwnershipTarget['connection'];
}>;

export type ResolvedMainserverOwnershipSource = Readonly<{
  principal: IamContentOwnerPrincipal;
  dataProviderId: string;
  dataProviderName?: string;
}>;

export type ResolveMainserverOwnershipTargetResult =
  | Readonly<{ ok: true; target: ResolvedMainserverOwnershipTarget }>
  | Readonly<{
      ok: false;
      code: 'content_transfer_target_binding_missing';
      verificationCandidate: MainserverOwnershipVerificationCandidate;
    }>
  | Readonly<{
      ok: false;
      code: Exclude<MainserverOwnershipTargetErrorCode, 'content_transfer_target_binding_missing'>;
    }>;
