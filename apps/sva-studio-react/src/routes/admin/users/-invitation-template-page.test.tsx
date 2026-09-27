import { DEFAULT_ACCOUNT_INVITATION_TEMPLATE } from '@sva/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveLocale } from '../../../i18n';
import { IamHttpError } from '../../../lib/iam-api';

const api = vi.hoisted(() => ({
  getTenantAccountInvitationTemplate: vi.fn(),
  updateTenantAccountInvitationTemplate: vi.fn(),
}));

vi.mock('../../../lib/iam-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/iam-api')>()),
  getTenantAccountInvitationTemplate: api.getTenantAccountInvitationTemplate,
  updateTenantAccountInvitationTemplate: api.updateTenantAccountInvitationTemplate,
}));

import { InvitationTemplatePage } from './-invitation-template-page';

const defaultView = {
  revision: 0,
  effectiveTemplate: { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 0 },
  source: 'sva_default' as const,
  tenantName: 'Kassel',
  tenantHomepageUrl: 'https://kassel.example/',
};

describe('InvitationTemplatePage', () => {
  beforeEach(() => {
    api.getTenantAccountInvitationTemplate.mockResolvedValue({ data: defaultView });
    api.updateTenantAccountInvitationTemplate.mockResolvedValue({
      data: {
        ...defaultView,
        revision: 1,
        source: 'instance',
        effectiveTemplate: { ...defaultView.effectiveTemplate, revision: 1 },
      },
    });
  });

  afterEach(() => {
    setActiveLocale('de');
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    cleanup();
  });

  it('loads the inherited template and saves only the session tenant override', async () => {
    render(<InvitationTemplatePage />);
    expect(await screen.findByText('Verwendete Vorlage: SVA-Standard')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    await vi.waitFor(() =>
      expect(api.updateTenantAccountInvitationTemplate).toHaveBeenCalledWith({
        expectedRevision: 0,
        template: {
          subject: DEFAULT_ACCOUNT_INVITATION_TEMPLATE.subject,
          body: DEFAULT_ACCOUNT_INVITATION_TEMPLATE.body,
          passwordSetupLinkLabel: DEFAULT_ACCOUNT_INVITATION_TEMPLATE.passwordSetupLinkLabel,
          tenantHomepageLinkLabel: DEFAULT_ACCOUNT_INVITATION_TEMPLATE.tenantHomepageLinkLabel,
        },
      })
    );
    expect((await screen.findByRole('status')).textContent).toContain('gespeichert');
  });

  it('resets the tenant override and reloads after a revision conflict', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    api.getTenantAccountInvitationTemplate.mockResolvedValueOnce({ data: defaultView });
    render(<InvitationTemplatePage />);
    await screen.findByText('Verwendete Vorlage: SVA-Standard');
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Servervorlage verwenden' }));
    await vi.waitFor(() =>
      expect(api.updateTenantAccountInvitationTemplate).toHaveBeenCalledWith({
        expectedRevision: 0,
        template: null,
      })
    );
    expect(window.confirm).toHaveBeenCalled();
  });

  it('refreshes its revision after concurrent changes', async () => {
    api.updateTenantAccountInvitationTemplate.mockRejectedValueOnce(
      new IamHttpError({
        status: 409,
        code: 'account_invitation_template_revision_conflict',
        message: 'conflict',
      })
    );
    api.getTenantAccountInvitationTemplate
      .mockResolvedValueOnce({ data: defaultView })
      .mockResolvedValueOnce({ data: { ...defaultView, revision: 2, source: 'instance' } });
    render(<InvitationTemplatePage />);
    await screen.findByText('Verwendete Vorlage: SVA-Standard');
    fireEvent.click(screen.getByRole('button', { name: 'Account-Einladung anpassen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    await vi.waitFor(() => expect(api.getTenantAccountInvitationTemplate).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole('status')).textContent).toContain('zwischenzeitlich geändert');
  });
});
