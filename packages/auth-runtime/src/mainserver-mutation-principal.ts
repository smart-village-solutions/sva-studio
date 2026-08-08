import {
  readEffectiveSvaMainserverCredentialsWithStatus,
  type EffectiveSvaMainserverCredentialsResult,
} from './mainserver-effective-credentials.js';

export type MainserverActingPrincipalType = 'organization' | 'user';

export type MutationPrincipalContext = Readonly<{
  version: 1;
  instanceId: string;
  actorAccountId: string;
  keycloakSubject: string;
  activeOrganizationId?: string;
  actingPrincipalType: MainserverActingPrincipalType;
  actingPrincipalId: string;
  credentialSource: MainserverActingPrincipalType;
  credentialFingerprint: string;
}>;

export type ResolveMutationPrincipalContextResult =
  | Readonly<{ ok: true; context: MutationPrincipalContext }>
  | Readonly<{
      ok: false;
      status: Exclude<EffectiveSvaMainserverCredentialsResult['status'], 'ok'>;
    }>;

export const resolveMutationPrincipalContext = async (input: {
  readonly instanceId: string;
  readonly actorAccountId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
  readonly actingPrincipalType?: MainserverActingPrincipalType;
}): Promise<ResolveMutationPrincipalContextResult> => {
  const resolved = await readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: input.instanceId,
    keycloakSubject: input.keycloakSubject,
    activeOrganizationId: input.activeOrganizationId,
    ...(input.actingPrincipalType ? { actingPrincipalType: input.actingPrincipalType } : {}),
  });
  if (resolved.status !== 'ok') {
    return { ok: false, status: resolved.status };
  }

  if (input.actingPrincipalType && resolved.source !== input.actingPrincipalType) {
    return { ok: false, status: 'acting_principal_not_allowed' };
  }

  const actingPrincipalType = input.actingPrincipalType ?? resolved.source;
  const actingPrincipalId =
    actingPrincipalType === 'organization' ? input.activeOrganizationId : input.actorAccountId;
  if (!actingPrincipalId) {
    return { ok: false, status: 'organization_mainserver_credentials_missing' };
  }

  return {
    ok: true,
    context: Object.freeze({
      version: 1,
      instanceId: input.instanceId,
      actorAccountId: input.actorAccountId,
      keycloakSubject: input.keycloakSubject,
      ...(input.activeOrganizationId ? { activeOrganizationId: input.activeOrganizationId } : {}),
      actingPrincipalType,
      actingPrincipalId,
      credentialSource: resolved.source,
      credentialFingerprint: resolved.credentialFingerprint,
    }),
  };
};
