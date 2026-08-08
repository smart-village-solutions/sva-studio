import type { MutationPrincipalContext } from '@sva/auth-runtime/server';

import type { SvaMainserverConnectionInput } from '../types.js';

export type MainserverMutationActor = SvaMainserverConnectionInput &
  Readonly<{
    actorAccountId: string;
    operationExternalId: string;
    mutationPrincipalContext: MutationPrincipalContext;
  }>;

export type MainserverMutationFollowUpContext = Readonly<{
  instanceId: string;
  keycloakSubject: string;
  actorAccountId: string;
  actorDisplayName: string;
  activeOrganizationId?: string;
  actingPrincipalType: 'organization' | 'user';
  credentialSource: 'organization' | 'user';
  credentialFingerprint: string;
  operationExternalId: string;
}>;

export type MainserverMutationAuthorization = Readonly<{
  authorizationMode: 'credential_visible_compatibility' | 'exact';
  resolverMode: 'automatic' | 'compatibility' | 'shadow';
  candidateAuthorizationMode?: 'credential_visible_compatibility' | 'exact';
  candidateAllowed?: boolean;
  shadowDifference?: boolean;
  operationExternalId: string;
}>;

export type MainserverLifecycleStatus = 'archived' | 'draft' | 'published';

export type DataProviderBearingItem = Readonly<{
  id: string;
  dataProvider?: Readonly<{ id?: string; name?: string }>;
}>;

export type MainserverCreateBindingOutcome =
  'created' | 'confirmed' | 'conflict' | 'reconciliation_required' | undefined;

export type MainserverCreateBindingResult = Readonly<{
  outcome: MainserverCreateBindingOutcome;
  observedDataProviderId?: string;
}>;
