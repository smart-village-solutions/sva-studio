import { describe, expect, it } from 'vitest';

import {
  AccountInvitationTemplateValidationError,
  compileAccountInvitationTemplate,
  DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
  validateAccountInvitationTemplate,
} from './account-invitation-template.js';

describe('account invitation template', () => {
  it('compiles the controlled links and Keycloak MessageFormat arguments', () => {
    const compiled = compileAccountInvitationTemplate({
      template: DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
      tenantName: "Stadt O'Brien",
      tenantHomepageUrl: 'https://demo.example/',
    });
    expect(compiled).toEqual(
      expect.objectContaining({
        executeActionsSubject: "Willkommen bei Stadt O''Brien - Zugang einrichten",
        executeActionsBody: expect.stringContaining('https://demo.example/'),
        executeActionsBodyHtml: expect.stringContaining('<a href="{0}">Passwort festlegen</a>'),
      })
    );
    expect(compiled.executeActionsBodyHtml).toContain('Stadt O&#39;Brien');
    expect(compiled.executeActionsBodyHtml).not.toContain('&#39;&#39;');
  });

  it.each([
    ['empty subject', { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, subject: '   ' }],
    ['missing password link', { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, body: 'Hallo' }],
    [
      'multiple password links',
      {
        ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
        body: '{{passwordSetupLink}} {{passwordSetupLink}}',
      },
    ],
    [
      'unknown token',
      { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, body: '{{passwordSetupLink}} {{unknown}}' },
    ],
    ['markup', { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, body: '<b>{{passwordSetupLink}}</b>' }],
    [
      'free URL',
      {
        ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
        body: '{{passwordSetupLink}} https://example.invalid',
      },
    ],
    [
      'raw MessageFormat argument',
      { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, body: '{{passwordSetupLink}} {0}' },
    ],
    [
      'token in link label',
      {
        ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
        passwordSetupLinkLabel: '{{tenantName}}',
      },
    ],
    [
      'password link in subject',
      {
        ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
        subject: '{{passwordSetupLink}}',
      },
    ],
  ])('rejects %s', (_name, template) => {
    expect(() => validateAccountInvitationTemplate(template)).toThrow(
      AccountInvitationTemplateValidationError
    );
  });
});
