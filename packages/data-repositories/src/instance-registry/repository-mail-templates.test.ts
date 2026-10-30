import { describe, it, expect, vi } from 'vitest';
import { createMailTemplateRepository } from './repository-mail-templates';
describe('shared Studio mail template storage', () => {
  it('uses monotonic CAS revisions even for resetting an inherited source', async () => {
    const execute = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          instance_id: 'demo',
          template_kind: 'invitation',
          revision: 4,
          template: null,
          sync_status: 'pending',
          confirmed_realm: null,
          confirmed_texts: null,
        },
      ],
    });
    const db = createMailTemplateRepository({ execute });
    expect(
      (
        await db.saveInstanceMailTemplate({
          instanceId: 'demo',
          kind: 'invitation',
          expectedRevision: 3,
          template: null,
        })
      ).revision
    ).toBe(4);
    expect(execute.mock.calls[0][0].text).toContain(
      'iam.save_instance_invitation_template($1,$2,$3::jsonb,$4)'
    );
    expect(execute.mock.calls[0][0].values).toEqual(['demo', 3, null, null]);
  });
  it('rejects stale saves without changing the stored source', async () => {
    const execute = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(
      createMailTemplateRepository({ execute }).saveInstanceMailTemplate({
        instanceId: 'demo',
        kind: 'verification',
        expectedRevision: 2,
        template: null,
      })
    ).rejects.toThrow('mail_template_revision_conflict');
  });
  it('stores sync failures separately from the source', async () => {
    const execute = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    await createMailTemplateRepository({ execute }).recordMailTemplateSync({
      instanceId: 'demo',
      kind: 'verification',
      expectedRevision: 2,
      status: 'failed',
    });
    expect(execute.mock.calls[0][0].text).not.toContain('template=');
    expect(execute.mock.calls[0][0].values).toEqual([
      'demo',
      'verification',
      2,
      'failed',
      null,
      null,
    ]);
  });
  it('returns an unreviewed default for a new instance, without writing', async () => {
    const execute = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    expect(
      (
        await createMailTemplateRepository({ execute }).getInstanceMailTemplate(
          'demo',
          'verification'
        )
      ).syncStatus
    ).toBe('unreviewed');
    expect(execute.mock.calls[0][0].text).toMatch(/^SELECT/);
  });
});

describe('general email verification template', () => {
  it('reads only the confirmation row from the existing server template store', async () => {
    const execute = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ revision: 2, template: { subject: 'Bestätigen', body: '{{verificationLink}}' } }],
    });
    const result = await createMailTemplateRepository({
      execute,
    }).getServerEmailVerificationTemplate();
    expect(result.revision).toBe(2);
    expect(execute.mock.calls[0][0].values).toEqual(['email_verification']);
  });
  it('saves and resets the general template with CAS without touching invitations', async () => {
    const execute = vi
      .fn()
      .mockResolvedValue({ rowCount: 1, rows: [{ revision: 3, template: null }] });
    expect(
      (
        await createMailTemplateRepository({ execute }).saveServerEmailVerificationTemplate({
          expectedRevision: 2,
          template: null,
          actorId: 'admin',
        })
      ).revision
    ).toBe(3);
    expect(execute.mock.calls[0][0].values).toEqual(['email_verification', 2, null, 'admin']);
    expect(execute.mock.calls[0][0].text).toContain('AND revision=$2');
  });
  it('rejects a stale general template revision', async () => {
    const execute = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    await expect(
      createMailTemplateRepository({ execute }).saveServerEmailVerificationTemplate({
        expectedRevision: 0,
        template: null,
        actorId: 'admin',
      })
    ).rejects.toThrow('mail_template_revision_conflict');
  });
});
