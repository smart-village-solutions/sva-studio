import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compileEmailVerificationTemplate,
  DEFAULT_EMAIL_VERIFICATION_TEMPLATE as template,
  readEmailVerificationTemplate,
  validateEmailVerificationTemplate,
} from './email-verification-template';
describe('email verification template', () => {
  it('keeps the native theme fallback equal to the editor default', () => {
    const source = readFileSync(
      new URL(
        '../../../../deploy/keycloak/themes/sva-kern2/theme/sva-kern2/email/messages/messages_de.properties',
        import.meta.url
      ),
      'utf8'
    );
    const props = Object.fromEntries(
      source
        .trim()
        .split('\n')
        .map((line) => {
          const separator = line.indexOf('=');
          return [line.slice(0, separator), line.slice(separator + 1).replaceAll('\\n', '\n')];
        })
    );
    for (const [key, value] of Object.entries(compileEmailVerificationTemplate(template))) {
      expect(props[key], key).toBe(value);
    }
  });

  it('keeps verification placeholders separate from invitation expiry', () => {
    const texts = compileEmailVerificationTemplate(template);
    expect(texts.emailVerificationBody).toContain('{3}');
    expect(texts.emailVerificationBody).not.toContain('{4}');
    expect(texts.emailVerificationBodyHtml).toContain(
      '<a href="{0}">E-Mail-Adresse bestätigen</a>'
    );
    expect(readEmailVerificationTemplate(texts)).toEqual(template);
  });
  it.each([
    'hello',
    '{{verificationLink}} {{verificationLink}}',
    '<script>{{verificationLink}}</script>',
    'https://evil.example {{verificationLink}}',
    'ftp://evil.example {{verificationLink}}',
    '{{unknown}} {{verificationLink}}',
  ])('rejects unsafe body %s', (body) => {
    expect(() => validateEmailVerificationTemplate({ ...template, body })).toThrow();
  });
  it.each(['{{tenantName}}', 'subject\nBcc: test', '<b>subject</b>'])(
    'rejects unsafe subject %s',
    (subject) => {
      expect(() => validateEmailVerificationTemplate({ ...template, subject })).toThrow();
    }
  );
  it('escapes apostrophes for MessageFormat and HTML', () => {
    const input = { subject: "O'Brien", body: "O'Brien & Stadt\n{{verificationLink}}" };
    const texts = compileEmailVerificationTemplate(input);
    expect(texts.emailVerificationSubject).toBe("O''Brien");
    expect(texts.emailVerificationBodyHtml).toContain('O&#39;Brien &amp; Stadt');
    expect(readEmailVerificationTemplate(texts)).toEqual(input);
  });
});
