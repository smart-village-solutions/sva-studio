export type EmailVerificationTemplate = Readonly<{ subject: string; body: string }>;
export const EMAIL_VERIFICATION_KEYS = [
  'emailVerificationSubject',
  'emailVerificationBody',
  'emailVerificationBodyHtml',
] as const;
export type ServerEmailVerificationTemplateState = Readonly<{
  revision: number;
  template: EmailVerificationTemplate | null;
}>;
export type ServerEmailVerificationTemplateView = Readonly<{
  revision: number;
  template: EmailVerificationTemplate;
  source: 'server' | 'sva_default';
  unsynchronizedInstances?: readonly string[];
}>;
export type EmailVerificationTexts = Readonly<
  Record<(typeof EMAIL_VERIFICATION_KEYS)[number], string>
>;

export const DEFAULT_EMAIL_VERIFICATION_TEMPLATE: EmailVerificationTemplate = {
  subject: 'E-Mail-Adresse bestätigen',
  body: 'Bitte bestätigen Sie Ihre E-Mail-Adresse für {{tenantName}} über den folgenden Link:\n\n{{verificationLink}}\n\nDer Link ist {{linkExpiresIn}} gültig.\n\nFalls Sie diese Bestätigung nicht angefordert haben, ignorieren Sie diese E-Mail bitte.',
};
const TOKENS: Readonly<Record<string, string>> = {
  tenantName: '{2}',
  verificationLink: '{0}',
  linkExpiresIn: '{3}',
};
export class EmailVerificationTemplateError extends Error {
  constructor(readonly field: 'subject' | 'body') {
    super('invalid_email_verification_template');
  }
}
export const validateEmailVerificationTemplate = (template: EmailVerificationTemplate): void => {
  for (const field of ['subject', 'body'] as const) {
    const value = template[field];
    const remaining = value.replace(/\{\{(tenantName|verificationLink|linkExpiresIn)\}\}/g, '');
    if (
      !value.trim() ||
      value.length > (field === 'subject' ? 200 : 5000) ||
      /[<>\p{Cc}]/u.test(value.replace(/[\r\n\t]/g, '')) ||
      /(?:[a-z][a-z0-9+.-]*:\/\/|(?:https?|mailto|javascript|data|tel)\s*:|www\.)/i.test(value) ||
      /[{}]/.test(field === 'subject' ? value : remaining) ||
      (field === 'subject' && /[\r\n]/.test(value))
    )
      throw new EmailVerificationTemplateError(field);
  }
  if ((template.body.match(/\{\{verificationLink\}\}/g) ?? []).length !== 1) {
    throw new EmailVerificationTemplateError('body');
  }
};
const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export const compileEmailVerificationTemplate = (
  template: EmailVerificationTemplate
): EmailVerificationTexts => {
  validateEmailVerificationTemplate(template);
  const replace = (value: string, html: boolean) =>
    value.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
      html && key === 'verificationLink'
        ? '<a href="{0}">E-Mail-Adresse bestätigen</a>'
        : (TOKENS[key] ?? '')
    );
  return {
    emailVerificationSubject: template.subject.replaceAll("'", "''"),
    emailVerificationBody: replace(template.body.replaceAll("'", "''"), false),
    emailVerificationBodyHtml:
      '<p>' +
      replace(escapeHtml(template.body), true)
        .replaceAll('\r\n', '\n')
        .replaceAll('\n\n', '</p><p>')
        .replaceAll('\n', '<br>') +
      '</p>',
  };
};
export const readEmailVerificationTemplate = (
  texts: EmailVerificationTexts
): EmailVerificationTemplate => ({
  subject: texts.emailVerificationSubject.replaceAll("''", "'"),
  body: texts.emailVerificationBody.replaceAll("''", "'").replace(/\{([023])\}/g, (value) => {
    const token = Object.entries(TOKENS).find(([, code]) => code === value)?.[0];
    return token ? '{{' + token + '}}' : value;
  }),
});
