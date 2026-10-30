import {
  adoptMailTemplate,
  compileMailTemplate,
  DEFAULT_EMAIL_VERIFICATION_TEMPLATE,
  mailTemplateKeys,
  sameMailTemplateTexts,
  resolveEffectiveAccountInvitationTemplate,
  type MailTemplateKind,
  type MailTemplateSource,
  type MailTemplateView,
} from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data-repositories';
import { resolveIdentityProviderForInstance } from '../iam-account-management/shared-runtime.js';
import { withRegistryRepository } from './repository.js';

const synchronizationStatus = (
  stored: MailTemplateView['stored'],
  keycloakTexts: MailTemplateView['keycloakTexts'],
  equal: boolean,
  confirmed: boolean
): MailTemplateView['status'] => {
  return !keycloakTexts
    ? 'failed'
    : equal && ((stored.syncStatus === 'synced' && confirmed) || stored.syncStatus === 'unreviewed')
      ? 'synced'
      : stored.syncStatus === 'failed'
        ? 'failed'
        : !stored.confirmedTexts
          ? 'unreviewed'
          : !confirmed
            ? 'drift'
            : 'pending';
};

export const inspectMailTemplate = async (
  instanceId: string,
  kind: MailTemplateKind,
  repository: InstanceRegistryRepository
) => {
  const instance = await repository.getInstanceById(instanceId);
  if (!instance) throw new Error('not_found');
  const stored = await repository.getInstanceMailTemplate(instanceId, kind);
  let template: MailTemplateSource;
  let source: MailTemplateView['source'];
  if (stored.template) {
    template = stored.template;
    source = 'instance';
  } else if (kind === 'verification') {
    const server = await withRegistryRepository((repo) =>
      repo.getServerEmailVerificationTemplate()
    );
    template = server.template ?? DEFAULT_EMAIL_VERIFICATION_TEMPLATE;
    source = server.template ? 'server' : 'sva_default';
  } else {
    const server = await withRegistryRepository((repo) =>
      repo.getServerAccountInvitationTemplate()
    );
    ({ template, source } = resolveEffectiveAccountInvitationTemplate({
      serverTemplate: server.template,
    }));
  }
  const context = {
    tenantName: instance.displayName,
    tenantHomepageUrl: `https://${instance.primaryHostname}/`,
  };
  const studioTexts = compileMailTemplate(kind, template, context);
  let keycloakTexts: Readonly<Record<string, string>> | null = null;
  let provider:
    | NonNullable<Awaited<ReturnType<typeof resolveIdentityProviderForInstance>>>['provider']
    | undefined;
  try {
    const resolved = await resolveIdentityProviderForInstance(instanceId);
    if (resolved?.source === 'instance' && resolved.realm === instance.authRealm) {
      provider = resolved.provider;
      const messages = await provider.getEffectiveRealmEmailMessages?.('de');
      if (messages && mailTemplateKeys(kind).every((key) => typeof messages[key] === 'string'))
        keycloakTexts = Object.fromEntries(
          mailTemplateKeys(kind).map((key) => [key, messages[key] as string])
        );
    }
  } catch {
    /* Studio source remains available when Keycloak is unavailable. */
  }
  const equal = sameMailTemplateTexts(kind, studioTexts, keycloakTexts);
  const confirmed =
    stored.confirmedRealm === instance.authRealm &&
    sameMailTemplateTexts(kind, stored.confirmedTexts, keycloakTexts);
  const status = synchronizationStatus(stored, keycloakTexts, equal, confirmed);
  const view: MailTemplateView = {
    stored,
    source,
    template,
    studioTexts,
    keycloakTexts,
    status,
    realm: instance.authRealm,
    ...context,
    canAdopt: !!keycloakTexts && !!adoptMailTemplate(kind, keycloakTexts, template, context),
  };
  return { view, provider };
};
