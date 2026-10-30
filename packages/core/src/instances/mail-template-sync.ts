import type { AccountInvitationTemplate } from './account-invitation-template.js';
import type {
  EmailVerificationTemplate,
  EmailVerificationTexts,
} from './email-verification-template.js';
export type MailTemplateKind = 'invitation' | 'verification';
export type MailTemplateSource = AccountInvitationTemplate | EmailVerificationTemplate;
export type MailTemplateSyncStatus = 'unreviewed' | 'pending' | 'synced' | 'failed' | 'drift';
export type InstanceMailTemplate = Readonly<{
  instanceId: string;
  kind: MailTemplateKind;
  revision: number;
  template: MailTemplateSource | null;
  syncStatus: MailTemplateSyncStatus;
  confirmedRealm: string | null;
  confirmedTexts: Readonly<Record<string, string>> | null;
}>;
export type MailTemplateView = Readonly<{
  stored: InstanceMailTemplate;
  source: 'instance' | 'server' | 'sva_default';
  template: MailTemplateSource;
  studioTexts: Readonly<Record<string, string>>;
  keycloakTexts: Readonly<Record<string, string>> | null;
  status: MailTemplateSyncStatus;
  realm: string;
  tenantName: string;
  tenantHomepageUrl: string;
  canAdopt: boolean;
}>;

import {
  compileAccountInvitationTemplate,
  validateAccountInvitationTemplate,
} from './account-invitation-template.js';
import {
  compileEmailVerificationTemplate,
  readEmailVerificationTemplate,
} from './email-verification-template.js';
export const mailTemplateKeys = (kind: MailTemplateKind): readonly string[] =>
  kind === 'invitation'
    ? ['executeActionsSubject', 'executeActionsBody', 'executeActionsBodyHtml']
    : ['emailVerificationSubject', 'emailVerificationBody', 'emailVerificationBodyHtml'];
export const sameMailTemplateTexts = (
  kind: MailTemplateKind,
  a: Readonly<Record<string, string>> | null,
  b: Readonly<Record<string, string>> | null
): boolean =>
  a !== null &&
  b !== null &&
  mailTemplateKeys(kind).every((key) => typeof a[key] === 'string' && a[key] === b[key]);
export const compileMailTemplate = (
  kind: MailTemplateKind,
  template: MailTemplateSource,
  context: { tenantName: string; tenantHomepageUrl: string }
): Readonly<Record<string, string>> => {
  if (kind === 'verification') return compileEmailVerificationTemplate(template);
  const invitation = template as AccountInvitationTemplate;
  validateAccountInvitationTemplate(invitation);
  return compileAccountInvitationTemplate({ template: invitation, ...context });
};
export const adoptMailTemplate = (
  kind: MailTemplateKind,
  texts: Readonly<Record<string, string>>,
  template: MailTemplateSource,
  context: { tenantName: string; tenantHomepageUrl: string }
): MailTemplateSource | null => {
  try {
    let candidate: MailTemplateSource;
    if (kind === 'verification')
      candidate = readEmailVerificationTemplate(texts as EmailVerificationTexts);
    else {
      if (
        typeof texts.executeActionsSubject !== 'string' ||
        typeof texts.executeActionsBody !== 'string'
      )
        return null;
      const semantic = (value: string) =>
        value
          .replaceAll("''", "'")
          .replaceAll(context.tenantHomepageUrl, '{{tenantHomepageLink}}')
          .replaceAll(context.tenantName, '{{tenantName}}')
          .replaceAll('{0}', '{{passwordSetupLink}}')
          .replaceAll('{2}', '{{tenantName}}')
          .replaceAll('{4}', '{{linkExpiresIn}}');
      candidate = {
        ...(template as AccountInvitationTemplate),
        subject: semantic(texts.executeActionsSubject),
        body: semantic(texts.executeActionsBody),
      };
    }
    return sameMailTemplateTexts(kind, compileMailTemplate(kind, candidate, context), texts)
      ? candidate
      : null;
  } catch {
    return null;
  }
};
