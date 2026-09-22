import type { AccountInvitationProjection, CompiledAccountInvitationTemplate } from '@sva/core';
import { loadInstanceById } from '@sva/data-repositories/server';

import { resolveTenantAdminClientSecret } from '../config-tenant-secret.js';
import {
  KeycloakAdminClient,
  getKeycloakTenantAdminClientConfigFromEnv,
} from '../keycloak-admin-client.js';

export const ACCOUNT_INVITATION_LOCALIZATION_KEYS = [
  'executeActionsSubject',
  'executeActionsBody',
  'executeActionsBodyHtml',
] as const;

const createTenantRealmClient = async (instanceId: string, authRealm: string) => {
  const [instance, secret] = await Promise.all([
    loadInstanceById(instanceId),
    resolveTenantAdminClientSecret(instanceId),
  ]);
  const clientId = instance?.tenantAdminClient?.clientId;
  if (!instance || instance.authRealm !== authRealm || !clientId || !secret.secret) {
    throw new Error('tenant_admin_credentials_incomplete');
  }
  return new KeycloakAdminClient(
    getKeycloakTenantAdminClientConfigFromEnv({
      realm: authRealm,
      clientId,
      clientSecret: secret.secret,
    })
  );
};

const matchesExpected = (
  actual: Readonly<Record<string, string>>,
  expected: CompiledAccountInvitationTemplate
): boolean => ACCOUNT_INVITATION_LOCALIZATION_KEYS.every((key) => actual[key] === expected[key]);

export const readAccountInvitationProjection = async (input: {
  readonly instanceId: string;
  readonly authRealm: string;
  readonly expected: CompiledAccountInvitationTemplate;
}): Promise<AccountInvitationProjection> => {
  try {
    const client = await createTenantRealmClient(input.instanceId, input.authRealm);
    const [emailTheme, actual] = await Promise.all([
      client.getRealmEmailTheme(),
      client.getRealmLocalizationTexts('de'),
    ]);
    return {
      status:
        emailTheme === 'sva-kern2' && matchesExpected(actual, input.expected)
          ? 'in_sync'
          : 'drifted',
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unavailable',
      checkedAt: new Date().toISOString(),
      errorCode: error instanceof Error ? error.name : 'unknown_error',
    };
  }
};

export const projectAccountInvitationTemplate = async (input: {
  readonly instanceId: string;
  readonly authRealm: string;
  readonly template: CompiledAccountInvitationTemplate | null;
}): Promise<void> => {
  const client = await createTenantRealmClient(input.instanceId, input.authRealm);
  await client.updateRealmSettings({ emailTheme: 'sva-kern2' });
  if (!input.template) {
    await Promise.all(
      ACCOUNT_INVITATION_LOCALIZATION_KEYS.map((key) =>
        client.deleteRealmLocalizationText('de', key)
      )
    );
    const [emailTheme, actual] = await Promise.all([
      client.getRealmEmailTheme(),
      client.getRealmLocalizationTexts('de'),
    ]);
    if (
      emailTheme !== 'sva-kern2' ||
      ACCOUNT_INVITATION_LOCALIZATION_KEYS.some((key) => key in actual)
    ) {
      throw new Error('account_invitation_template_reset_readback_mismatch');
    }
    return;
  }

  await client.updateRealmLocalizationTexts('de', input.template);
  const [emailTheme, actual] = await Promise.all([
    client.getRealmEmailTheme(),
    client.getRealmLocalizationTexts('de'),
  ]);
  if (emailTheme !== 'sva-kern2' || !matchesExpected(actual, input.template)) {
    throw new Error('account_invitation_template_readback_mismatch');
  }
};
