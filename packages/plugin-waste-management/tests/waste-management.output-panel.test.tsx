import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteOutputPanel } from '../src/waste-management.output-panel.js';

const apiMocks = vi.hoisted(() => ({
  getWasteManagementSettings: vi.fn(),
  updateWasteManagementSettings: vi.fn(),
}));

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Textarea: (props: React.ComponentProps<'textarea'>) => <textarea {...props} />,
  StudioErrorState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioLoadingState: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioField: ({
    id,
    label,
    children,
  }: {
    readonly id: string;
    readonly label: string;
    readonly children: React.ReactNode;
  }) => (
    <label htmlFor={id}>
      <span>{label}</span>
      {children}
    </label>
  ),
  Alert: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertTitle: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../src/waste-management.api.js', async () => {
  const actual = await vi.importActual<typeof import('../src/waste-management.api.js')>('../src/waste-management.api.js');
  return {
    ...actual,
    ...apiMocks,
  };
});

describe('WasteOutputPanel', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    apiMocks.getWasteManagementSettings.mockReset();
    apiMocks.updateWasteManagementSettings.mockReset();

    apiMocks.getWasteManagementSettings.mockResolvedValue({
      instanceId: 'de-musterhausen',
      provider: 'supabase',
      projectUrl: 'https://tenant.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      availableInterfaces: [
        {
          id: 'supabase-1',
          name: 'Waste Supabase',
          typeKey: 'supabase',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: true,
        },
        {
          id: 'mail-transport-1',
          name: 'Zentraler Mailtransport',
          typeKey: 'mail_transport',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: false,
        },
      ],
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 1234',
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      customRecurrencePresets: [],
    });
    apiMocks.updateWasteManagementSettings.mockResolvedValue({
      instanceId: 'de-musterhausen',
      provider: 'supabase',
      projectUrl: 'https://tenant.supabase.co',
      schemaName: 'wm',
      enabled: true,
      selectedInterfaceId: 'supabase-1',
      availableInterfaces: [
        {
          id: 'supabase-1',
          name: 'Waste Supabase',
          typeKey: 'supabase',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: true,
        },
        {
          id: 'mail-transport-1',
          name: 'Zentraler Mailtransport',
          typeKey: 'mail_transport',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: false,
        },
      ],
      pdfBrandingAssetUrl: 'https://cdn.example/logo-next.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 9999',
      emailReminderConfig: {
        enabled: true,
        publicSignupEnabled: true,
        transportId: 'mail-transport-1',
        publicBaseUrl: 'https://bb-prignitz.abfallkalender.smart-village.app',
        doiConfirmPath: '/email-reminders/confirm',
        unsubscribePath: '/email-reminders/unsubscribe',
        signupSuccessPath: '/email-reminders/pending',
        activationSuccessPath: '/email-reminders/active',
        unsubscribeSuccessPath: '/email-reminders/unsubscribed',
        invalidTokenPath: '/email-reminders/invalid-token',
        fromName: 'Landkreis Prignitz',
        fromEmail: 'abfall@example.org',
        replyToEmail: 'reply@example.org',
        serviceLabel: 'Mülli',
        privacyPolicyUrl: 'https://example.org/privacy',
        imprintUrl: 'https://example.org/imprint',
        consentLabel: 'Ich stimme zu.',
        consentVersion: '2026-06-14',
        dataControllerLabel: 'Landkreis Prignitz',
        dataProtectionContactEmail: 'datenschutz@example.org',
        doiSubjectTemplate: 'Bitte bestätigen',
        doiPreheader: 'DOI',
        doiIntroText: 'Bitte bestätigen Sie die Einrichtung.',
        doiButtonLabel: 'Jetzt aktivieren',
        doiFallbackText: 'Fallback',
        doiExpiryNoticeText: '48 Stunden gültig',
        doiSuccessHeadline: 'Aktiviert',
        doiSuccessBody: 'Erfolgreich aktiviert',
        doiErrorHeadline: 'Fehler',
        doiErrorBody: 'Link ungültig',
        reminderSubjectTemplate: 'Nicht vergessen',
        reminderIntroTemplate: 'Morgen wird geleert.',
        reminderListIntroTemplate: 'Es betrifft:',
        reminderOutroText: 'Viele Grüße',
        unsubscribeLinkLabel: 'Abmelden',
        reminderReasonText: 'Sie haben den Dienst eingerichtet.',
        unsubscribeSuccessHeadline: 'Abgemeldet',
        unsubscribeSuccessBody: 'Sie wurden abgemeldet.',
        unsubscribeAlreadyDoneHeadline: 'Bereits erledigt',
        unsubscribeAlreadyDoneBody: 'War bereits deaktiviert.',
        unsubscribeErrorHeadline: 'Fehler',
        unsubscribeErrorBody: 'Abmeldung nicht möglich',
        maxSubscriptionsPerEmailAndLocation: 5,
        signupRateLimitPerIpPerHour: 20,
        signupRateLimitPerEmailPerHour: 10,
        doiTokenTtlHours: 48,
        pendingSubscriptionTtlHours: 72,
        materializationLookaheadDays: 7,
        unsubscribeTokenTtlDays: 30,
      },
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'ok',
      customRecurrencePresets: [],
    });
  });

  it('loads and persists static pdf configuration instead of generating a pdf', async () => {
    render(<WasteOutputPanel />);

    expect(await screen.findByText('output.pdf.title')).toBeTruthy();
    await waitFor(() => {
      expect(apiMocks.getWasteManagementSettings).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('output.pdf.fields.collectionLocationId')).toBeNull();

    fireEvent.change(screen.getByLabelText('output.pdf.fields.brandingAssetUrl'), {
      target: { value: 'https://cdn.example/logo-next.svg' },
    });
    fireEvent.change(screen.getByLabelText('output.pdf.fields.contactBlock'), {
      target: { value: 'Abfallberatung 03395 / 9999' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'output.pdf.actions.save' }));

    await waitFor(() => {
      expect(apiMocks.updateWasteManagementSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfBrandingAssetUrl: 'https://cdn.example/logo-next.svg',
          pdfContactBlock: 'Abfallberatung 03395 / 9999',
        })
      );
    });

    expect(await screen.findByText('output.pdf.messages.saveSuccess')).toBeTruthy();
  });

  it('persists the email reminder service card through the waste settings endpoint', async () => {
    render(<WasteOutputPanel />);

    expect(await screen.findByText('output.emailReminder.title')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('output.emailReminder.fields.enabled'));
    fireEvent.click(screen.getByLabelText('output.emailReminder.fields.publicSignupEnabled'));
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.publicBaseUrl'), {
      target: { value: 'https://bb-prignitz.abfallkalender.smart-village.app' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.fromName'), {
      target: { value: 'Landkreis Prignitz' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.fromEmail'), {
      target: { value: 'abfall@example.org' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.privacyPolicyUrl'), {
      target: { value: 'https://example.org/privacy' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.imprintUrl'), {
      target: { value: 'https://example.org/imprint' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.consentVersion'), {
      target: { value: '2026-06-14' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.consentLabel'), {
      target: { value: 'Ich stimme zu.' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.doiSubjectTemplate'), {
      target: { value: 'Bitte bestätigen' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.doiIntroText'), {
      target: { value: 'Bitte bestätigen Sie die Einrichtung.' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.doiButtonLabel'), {
      target: { value: 'Jetzt aktivieren' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.reminderSubjectTemplate'), {
      target: { value: 'Nicht vergessen' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.reminderIntroTemplate'), {
      target: { value: 'Morgen wird geleert.' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.unsubscribeLinkLabel'), {
      target: { value: 'Abmelden' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.unsubscribeSuccessHeadline'), {
      target: { value: 'Abgemeldet' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.unsubscribeSuccessBody'), {
      target: { value: 'Sie wurden abgemeldet.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'output.emailReminder.actions.save' }));

    await waitFor(() => {
      expect(apiMocks.updateWasteManagementSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          emailReminderConfig: expect.objectContaining({
            enabled: true,
            publicSignupEnabled: true,
            transportId: 'mail-transport-1',
            publicBaseUrl: 'https://bb-prignitz.abfallkalender.smart-village.app',
            fromName: 'Landkreis Prignitz',
            fromEmail: 'abfall@example.org',
            consentVersion: '2026-06-14',
            reminderSubjectTemplate: 'Nicht vergessen',
          }),
        })
      );
    });

    expect(await screen.findByText('output.emailReminder.messages.saveSuccess')).toBeTruthy();
  });
});
