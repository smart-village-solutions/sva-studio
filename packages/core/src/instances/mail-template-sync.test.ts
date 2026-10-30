import { describe, it, expect } from 'vitest';
import { DEFAULT_ACCOUNT_INVITATION_TEMPLATE } from './account-invitation-template';
import { DEFAULT_EMAIL_VERIFICATION_TEMPLATE } from './email-verification-template';
import { adoptMailTemplate, compileMailTemplate } from './mail-template-sync';
const context = { tenantName: 'Havelland', tenantHomepageUrl: 'https://hvl.example/' };
describe('shared mail template projection', () => {
  it('recompiles municipal name and homepage in invitations', () => {
    const template = { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 1 };
    const before = compileMailTemplate('invitation', template, context);
    const after = compileMailTemplate('invitation', template, {
      tenantName: 'Neuer Name',
      tenantHomepageUrl: 'https://new.example/',
    });
    expect(after.executeActionsBody).toContain('Neuer Name');
    expect(after.executeActionsBody).toContain('https://new.example/');
    expect(after).not.toEqual(before);
    expect(adoptMailTemplate('invitation', before, template, context)).toEqual(template);
  });
  it('only adopts external changes which the text editor can preserve exactly', () => {
    const source = DEFAULT_EMAIL_VERIFICATION_TEMPLATE;
    const raw = compileMailTemplate(
      'verification',
      { ...source, subject: 'Extern geändert' },
      context
    );
    expect(adoptMailTemplate('verification', raw, source, context)?.subject).toBe(
      'Extern geändert'
    );
    expect(
      adoptMailTemplate(
        'verification',
        { ...raw, emailVerificationBodyHtml: '<div>Fremdes Layout</div>' },
        source,
        context
      )
    ).toBeNull();
  });
});
