import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileEmailVerificationTemplate, DEFAULT_EMAIL_VERIFICATION_TEMPLATE } from '@sva/core';
import { IamHttpError } from '../../../lib/iam-api';
import { setActiveLocale } from '../../../i18n';
const api = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  getServer: vi.fn(),
  saveServer: vi.fn(),
}));
vi.mock('../../../lib/iam-api-instance-operations', () => ({
  getInstanceMailTemplate: api.get,
  getServerEmailVerificationTemplate: api.getServer,
  updateServerEmailVerificationTemplate: api.saveServer,
  updateInstanceMailTemplate: api.save,
}));
import { EmailVerificationTemplateCard } from './-email-verification-template-card';
const view = {
  template: DEFAULT_EMAIL_VERIFICATION_TEMPLATE,
  studioTexts: compileEmailVerificationTemplate(DEFAULT_EMAIL_VERIFICATION_TEMPLATE),
  keycloakTexts: compileEmailVerificationTemplate(DEFAULT_EMAIL_VERIFICATION_TEMPLATE),
  stored: { revision: 0, kind: 'verification' },
  source: 'sva_default',
  status: 'synced',
  canAdopt: true,
  realm: 'bb-havelland',
  tenantName: 'Havelland',
  hasCustomHtml: false,
};
beforeEach(() => {
  setActiveLocale('de');
  api.get.mockResolvedValue({ data: view });
  api.save.mockResolvedValue({ data: view });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
const open = async () => {
  render(<EmailVerificationTemplateCard instanceId="bb-havelland" />);
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Bestätigungsvorlage anpassen' }));
  await screen.findByLabelText('Betreff');
};
describe('verification editor', () => {
  it('loads the selected realm and previews without exposing an actual action link', async () => {
    await open();
    expect(api.get).toHaveBeenCalledWith('bb-havelland', 'verification');
    expect(screen.getByText('Ziel-Realm: bb-havelland')).toBeTruthy();
    expect(screen.getByText(/Bitte bestätigen Sie Ihre E-Mail-Adresse für Havelland/)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    await vi.waitFor(() =>
      expect(api.save).toHaveBeenCalledWith('bb-havelland', 'verification', {
        template: view.template,
        operation: 'save',
        expectedRevision: 0,
      })
    );
    expect(await screen.findByText(/gespeichert und zurückgelesen/)).toBeTruthy();
  });
  it('validates locally and preserves the invalid draft', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Nachrichtentext'), {
      target: { value: '<script>unsafe</script>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    expect((await screen.findAllByText(/Bitte prüfen Sie die Vorlage/)).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Nachrichtentext').getAttribute('aria-invalid')).toBe('true');
    expect(api.save).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Nachrichtentext') as HTMLTextAreaElement).value).toContain(
      'unsafe'
    );
  });
  it('shows remote HTML as text without rendering it', async () => {
    api.get.mockResolvedValue({
      data: {
        ...view,
        status: 'drift',
        canAdopt: false,
        keycloakTexts: {
          ...view.keycloakTexts,
          emailVerificationBodyHtml: '<img src=x onerror=alert(1)>',
        },
      },
    });
    await open();
    expect(screen.queryByRole('img')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Keycloak-Stand übernehmen' }).hasAttribute('disabled')
    ).toBe(true);
  });
  it('reports saved source with a failed synchronization honestly', async () => {
    api.save.mockResolvedValue({ data: { ...view, status: 'failed' } });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    expect(
      await screen.findByText(/Im Studio gespeichert, aber nicht synchronisiert/)
    ).toBeTruthy();
  });
  it('keeps the draft and reports unknown remote outcomes', async () => {
    api.save.mockRejectedValue(new Error('timeout'));
    await open();
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Mein Entwurf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    expect(await screen.findByText(/Änderung kann bereits in Keycloak/)).toBeTruthy();
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Mein Entwurf');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigungsvorlage anpassen' }));
    expect(((await screen.findByLabelText('Betreff')) as HTMLInputElement).value).toBe(
      'Mein Entwurf'
    );
    expect(api.get).toHaveBeenCalledTimes(2);
  });
  it('shows concurrently changed texts while retaining the local draft', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Lokaler Entwurf' } });
    const current = {
      ...view,
      template: { ...view.template, subject: 'Extern geändert' },
      studioTexts: { ...view.studioTexts, emailVerificationSubject: 'Extern geändert' },
    };
    api.get.mockResolvedValue({ data: current });
    api.save.mockRejectedValueOnce(
      new IamHttpError({ status: 409, code: 'mail_template_conflict', message: 'conflict' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    expect(await screen.findByText(/Zwischenzeitlich gespeicherte Texte/)).toBeTruthy();
    expect(screen.getAllByText(/Extern geändert/).length).toBeGreaterThan(0);
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Lokaler Entwurf');
  });
  it('requires explicit confirmation and sends both comparison snapshots', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Studio-Stand übertragen' }));
    expect(api.save).not.toHaveBeenCalled();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    fireEvent.click(screen.getByRole('button', { name: 'Studio-Stand übertragen' }));
    await vi.waitFor(() =>
      expect(api.save).toHaveBeenCalledWith('bb-havelland', 'verification', {
        operation: 'transfer',
        expectedRevision: 0,
        expectedStudioTexts: view.studioTexts,
        expectedKeycloakTexts: view.keycloakTexts,
      })
    );
  });
  it('removes the instance override only after confirmation', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Allgemeine Vorlage verwenden' }));
    await vi.waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        'bb-havelland',
        'verification',
        expect.objectContaining({ template: null })
      )
    );
  });
});

describe('general confirmation editor', () => {
  const general = {
    revision: 3,
    template: { ...DEFAULT_EMAIL_VERIFICATION_TEMPLATE, subject: 'Allgemein' },
    source: 'server',
  };
  const openGeneral = async () => {
    api.getServer.mockResolvedValue({ data: general });
    render(<EmailVerificationTemplateCard mode="server" />);
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigungsvorlage anpassen' }));
    await screen.findByLabelText('Betreff');
  };
  it('saves the general standard through its own endpoint and shows incomplete synchronization', async () => {
    api.saveServer.mockResolvedValue({
      data: { ...general, revision: 4, unsynchronizedInstances: ['bb-havelland'] },
    });
    await openGeneral();
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Neuer Standard' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    await vi.waitFor(() =>
      expect(api.saveServer).toHaveBeenCalledWith({
        expectedRevision: 3,
        template: { ...general.template, subject: 'Neuer Standard' },
      })
    );
    expect(api.save).not.toHaveBeenCalled();
    expect(await screen.findByText(/bb-havelland/)).toBeTruthy();
  });
  it('preserves a general draft on revision conflict and loads the new baseline', async () => {
    await openGeneral();
    fireEvent.change(screen.getByLabelText('Betreff'), { target: { value: 'Mein Entwurf' } });
    api.getServer.mockResolvedValue({
      data: {
        ...general,
        revision: 4,
        template: { ...general.template, subject: 'Parallel gespeichert' },
      },
    });
    api.saveServer.mockRejectedValueOnce(
      new IamHttpError({ status: 409, code: 'mail_template_conflict', message: 'conflict' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    await screen.findByText(/Zwischenzeitlich gespeicherte Texte/);
    expect((screen.getByLabelText('Betreff') as HTMLInputElement).value).toBe('Mein Entwurf');
    expect(screen.getByText(/Parallel gespeichert/)).toBeTruthy();
  });
  it('resets only the general source after confirmation', async () => {
    await openGeneral();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    api.saveServer.mockResolvedValue({
      data: {
        ...general,
        revision: 4,
        source: 'sva_default',
        template: DEFAULT_EMAIL_VERIFICATION_TEMPLATE,
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Neutralen Standard übernehmen' }));
    await vi.waitFor(() =>
      expect(api.saveServer).toHaveBeenCalledWith({ expectedRevision: 3, template: null })
    );
    expect(api.save).not.toHaveBeenCalled();
  });
});
