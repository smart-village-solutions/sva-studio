export const accountInvitationProjectionStatuses = [
  'default',
  'in_sync',
  'drifted',
  'unavailable',
] as const;

export type AccountInvitationProjectionStatus =
  (typeof accountInvitationProjectionStatuses)[number];

export type AccountInvitationTemplate = Readonly<{
  revision: number;
  subject: string;
  body: string;
  passwordSetupLinkLabel: string;
  tenantHomepageLinkLabel: string;
}>;

export type AccountInvitationProjection = Readonly<{
  status: AccountInvitationProjectionStatus;
  checkedAt?: string;
  errorCode?: string;
}>;

export type CompiledAccountInvitationTemplate = Readonly<{
  executeActionsSubject: string;
  executeActionsBody: string;
  executeActionsBodyHtml: string;
}>;

export const DEFAULT_ACCOUNT_INVITATION_TEMPLATE: Omit<AccountInvitationTemplate, 'revision'> = {
  subject: 'Willkommen bei {{tenantName}} - Zugang einrichten',
  body: `Guten Tag,

für Sie wurde ein Benutzerkonto bei {{tenantName}} eingerichtet.

Bitte legen Sie über den folgenden Link Ihr persönliches Passwort fest:
{{passwordSetupLink}}

Der Link ist {{linkExpiresIn}} gültig.

Anschließend erreichen Sie das Angebot hier:
{{tenantHomepageLink}}

Falls Sie kein Konto erwartet haben, ignorieren Sie diese E-Mail bitte.

Freundliche Grüße
Ihr Team von {{tenantName}}`,
  passwordSetupLinkLabel: 'Passwort festlegen',
  tenantHomepageLinkLabel: 'Zur Startseite',
};

const ALLOWED_TOKENS = new Set([
  'tenantName',
  'passwordSetupLink',
  'tenantHomepageLink',
  'linkExpiresIn',
]);
const TOKEN_PATTERN = /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g;
const URI_SCHEME_PATTERN = /(?:https?|mailto|javascript)\s*:/i;
const MARKUP_PATTERN = /<[^>]*>/;

export class AccountInvitationTemplateValidationError extends Error {
  readonly code = 'invalid_account_invitation_template';

  constructor(
    readonly field: keyof Omit<AccountInvitationTemplate, 'revision'>,
    message: string
  ) {
    super(message);
    this.name = 'AccountInvitationTemplateValidationError';
  }
}

const assertText = (
  field: keyof Omit<AccountInvitationTemplate, 'revision'>,
  value: string,
  maxLength: number,
  options: { allowTokens: boolean }
): void => {
  if (value.trim().length === 0 || value.length > maxLength) {
    throw new AccountInvitationTemplateValidationError(
      field,
      `Der Wert muss zwischen 1 und ${maxLength} Zeichen enthalten.`
    );
  }
  if (MARKUP_PATTERN.test(value)) {
    throw new AccountInvitationTemplateValidationError(field, 'HTML-Markup ist nicht erlaubt.');
  }
  if (URI_SCHEME_PATTERN.test(value)) {
    throw new AccountInvitationTemplateValidationError(
      field,
      'Freie URLs und URI-Schemata sind nicht erlaubt.'
    );
  }

  const tokens = [...value.matchAll(TOKEN_PATTERN)].map((match) => match[1] ?? '');
  if (!options.allowTokens && tokens.length > 0) {
    throw new AccountInvitationTemplateValidationError(
      field,
      'Platzhalter sind in Linkbeschriftungen nicht erlaubt.'
    );
  }
  if (tokens.some((token) => !ALLOWED_TOKENS.has(token))) {
    throw new AccountInvitationTemplateValidationError(field, 'Unbekannter Platzhalter.');
  }
  const tokenFreeValue = value.replace(TOKEN_PATTERN, '');
  if (tokenFreeValue.includes('{') || tokenFreeValue.includes('}')) {
    throw new AccountInvitationTemplateValidationError(field, 'Ungültiger Platzhalter.');
  }
};

export const validateAccountInvitationTemplate = (
  template: Omit<AccountInvitationTemplate, 'revision'>
): void => {
  assertText('subject', template.subject, 200, { allowTokens: true });
  assertText('body', template.body, 5_000, { allowTokens: true });
  assertText('passwordSetupLinkLabel', template.passwordSetupLinkLabel, 120, {
    allowTokens: false,
  });
  assertText('tenantHomepageLinkLabel', template.tenantHomepageLinkLabel, 120, {
    allowTokens: false,
  });

  if ((template.body.match(/\{\{passwordSetupLink\}\}/g) ?? []).length !== 1) {
    throw new AccountInvitationTemplateValidationError(
      'body',
      'Der Passwortlink muss im Nachrichtentext genau einmal vorkommen.'
    );
  }
  if (/\{\{(?:passwordSetupLink|tenantHomepageLink|linkExpiresIn)\}\}/.test(template.subject)) {
    throw new AccountInvitationTemplateValidationError(
      'subject',
      'Im Betreff ist nur der Platzhalter {{tenantName}} erlaubt.'
    );
  }
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const escapeMessageFormatLiteral = (value: string): string => value.replaceAll("'", "''");

const replaceSemanticTokens = (
  value: string,
  replacements: Readonly<Record<string, string>>
): string => value.replace(TOKEN_PATTERN, (_match, token: string) => replacements[token] ?? '');

export const compileAccountInvitationTemplate = (input: {
  template: Omit<AccountInvitationTemplate, 'revision'>;
  tenantName: string;
  tenantHomepageUrl: string;
}): CompiledAccountInvitationTemplate => {
  validateAccountInvitationTemplate(input.template);
  const tenantName = escapeMessageFormatLiteral(input.tenantName);
  const tenantHomepageUrl = escapeMessageFormatLiteral(input.tenantHomepageUrl);
  const plainReplacements = {
    tenantName,
    passwordSetupLink: '{0}',
    tenantHomepageLink: tenantHomepageUrl,
    linkExpiresIn: '{4}',
  };
  const htmlReplacements = {
    tenantName: escapeHtml(input.tenantName),
    passwordSetupLink: `<a href="{0}">${escapeHtml(input.template.passwordSetupLinkLabel)}</a>`,
    tenantHomepageLink: `<a href="${escapeHtml(input.tenantHomepageUrl)}">${escapeHtml(
      input.template.tenantHomepageLinkLabel
    )}</a>`,
    linkExpiresIn: '{4}',
  };

  const escapedSubject = escapeMessageFormatLiteral(input.template.subject);
  const escapedBody = escapeMessageFormatLiteral(input.template.body);
  const htmlBody = replaceSemanticTokens(escapeHtml(input.template.body), htmlReplacements)
    .replaceAll('\r\n', '\n')
    .replaceAll('\n\n', '</p><p>')
    .replaceAll('\n', '<br>');

  return {
    executeActionsSubject: replaceSemanticTokens(escapedSubject, {
      tenantName,
      passwordSetupLink: '',
      tenantHomepageLink: '',
      linkExpiresIn: '',
    }),
    executeActionsBody: replaceSemanticTokens(escapedBody, plainReplacements),
    executeActionsBodyHtml: `<p>${htmlBody}</p>`,
  };
};
