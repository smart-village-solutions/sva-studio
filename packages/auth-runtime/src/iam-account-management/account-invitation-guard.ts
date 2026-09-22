import { compileAccountInvitationTemplate } from '@sva/core';
import type { AccountInvitationTemplate } from '@sva/core';

import { KeycloakAdminRequestError } from '../keycloak-admin-client.js';

const KEYS = ['executeActionsSubject', 'executeActionsBody', 'executeActionsBodyHtml'] as const;

export const assertAccountInvitationProjection = async (input: {
  readonly instanceId: string;
  readonly template?: AccountInvitationTemplate;
  readonly tenantName?: string;
  readonly tenantHomepageUrl?: string;
  readonly readRealmEmailTheme?: () => Promise<string | undefined>;
  readonly readRealmLocalizationTexts?: (
    locale: string
  ) => Promise<Readonly<Record<string, string>>>;
}): Promise<void> => {
  const template = input.template;
  if (!template) return;
  if (
    !input.readRealmEmailTheme ||
    !input.readRealmLocalizationTexts ||
    !input.tenantName ||
    !input.tenantHomepageUrl
  ) {
    throw new KeycloakAdminRequestError({
      message: 'Account invitation template projection is unavailable',
      statusCode: 503,
      code: 'account_invitation_template_unavailable',
      retryable: true,
    });
  }

  const expected = compileAccountInvitationTemplate({
    template,
    tenantName: input.tenantName,
    tenantHomepageUrl: input.tenantHomepageUrl,
  });
  const [emailTheme, actual] = await Promise.all([
    input.readRealmEmailTheme(),
    input.readRealmLocalizationTexts('de'),
  ]);
  if (emailTheme !== 'sva-kern2' || KEYS.some((key) => actual[key] !== expected[key])) {
    throw new KeycloakAdminRequestError({
      message: 'Account invitation template projection differs from the stored revision',
      statusCode: 503,
      code: 'account_invitation_template_drift',
      retryable: true,
    });
  }
};
