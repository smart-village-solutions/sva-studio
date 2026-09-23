import { DEFAULT_ACCOUNT_INVITATION_TEMPLATE } from '@sva/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveLocale } from '../../../i18n';
import { IamHttpError } from '../../../lib/iam-api';

const api = vi.hoisted(() => ({
  getServerAccountInvitationTemplate: vi.fn(),
  updateServerAccountInvitationTemplate: vi.fn(),
}));

vi.mock('../../../lib/iam-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/iam-api')>()),
  getServerAccountInvitationTemplate: api.getServerAccountInvitationTemplate,
  updateServerAccountInvitationTemplate: api.updateServerAccountInvitationTemplate,
}));

import { TemplatesPage } from './-templates-page';

const defaultView = {
  revision: 0,
  effectiveTemplate: { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 0 },
  source: 'sva_default' as const,
};

describe('TemplatesPage', () => {
  beforeEach(() => {
    api.getServerAccountInvitationTemplate.mockResolvedValue({ data: defaultView });
    api.updateServerAccountInvitationTemplate.mockResolvedValue({
      data: {
        ...defaultView,
        revision: 1,
        effectiveTemplate: { ...defaultView.effectiveTemplate, revision: 1 },
        source: 'server',
      },
    });
  });

  afterEach(() => {
    setActiveLocale('de');
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    cleanup();
  });

  it('loads the effective source and saves a revision-bound server template', async () => {
    render(<TemplatesPage />);

    expect(await screen.findByText('Verwendete Vorlage: SVA-Standard')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));

    await vi.waitFor(() =>
      expect(api.updateServerAccountInvitationTemplate).toHaveBeenCalledWith({
        expectedRevision: 0,
        template: expect.objectContaining({
          subject: DEFAULT_ACCOUNT_INVITATION_TEMPLATE.subject,
        }),
      })
    );
    expect((await screen.findByRole('status')).textContent).toContain('gespeichert');
  });

  it('resets the server override through the same revision-bound endpoint', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);
    render(<TemplatesPage />);

    await screen.findByText('Verwendete Vorlage: SVA-Standard');
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    fireEvent.click(screen.getByRole('button', { name: 'SVA-Standard verwenden' }));

    await vi.waitFor(() =>
      expect(api.updateServerAccountInvitationTemplate).toHaveBeenCalledWith({
        expectedRevision: 0,
        template: null,
      })
    );
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Servervorlage entfernen'));
  });

  it('reloads the current template after a revision conflict', async () => {
    api.updateServerAccountInvitationTemplate.mockRejectedValueOnce(
      new IamHttpError({
        status: 409,
        code: 'account_invitation_template_revision_conflict',
        message: 'conflict',
      })
    );
    api.getServerAccountInvitationTemplate
      .mockResolvedValueOnce({ data: defaultView })
      .mockResolvedValueOnce({
        data: {
          ...defaultView,
          revision: 2,
          effectiveTemplate: {
            ...defaultView.effectiveTemplate,
            revision: 2,
            subject: 'Aktueller Stand {{tenantName}}',
          },
          source: 'server',
        },
      });
    render(<TemplatesPage />);

    await screen.findByText('Verwendete Vorlage: SVA-Standard');
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));

    await vi.waitFor(() => expect(api.getServerAccountInvitationTemplate).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole('status')).textContent).toContain('zwischenzeitlich geändert');
  });
});
