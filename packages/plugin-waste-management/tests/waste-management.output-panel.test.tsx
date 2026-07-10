import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WasteOutputPanel } from '../src/waste-management.output-panel.js';
import { WasteEmailReminderConfigurationSection } from '../src/waste-management.output-email-reminder-card.js';
import {
  buildDefaultEmailReminderConfig,
  ensureTransportSelection,
  getMailTransportOptions,
  normalizeEmailReminderConfig,
} from '../src/waste-management.output-email-reminder-config.js';

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
  StudioLoadingState: ({ children }: { readonly children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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
  const actual = await vi.importActual<typeof import('../src/waste-management.api.js')>(
    '../src/waste-management.api.js'
  );
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
    apiMocks.getWasteManagementSettings.mockResolvedValueOnce({
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
      expect(apiMocks.updateWasteManagementSettings).toHaveBeenCalledTimes(1);
    });
    expect(apiMocks.updateWasteManagementSettings.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        pdfBrandingAssetUrl: 'https://cdn.example/logo-next.svg',
        pdfContactBlock: 'Abfallberatung 03395 / 9999',
        emailReminderConfig: expect.objectContaining({
          transportId: 'mail-transport-1',
          publicBaseUrl: 'https://bb-prignitz.abfallkalender.smart-village.app',
        }),
      })
    );

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
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.unsubscribeSuccessHeadline'),
      {
        target: { value: 'Abgemeldet' },
      }
    );
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.unsubscribeSuccessBody'), {
      target: { value: 'Sie wurden abgemeldet.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'output.emailReminder.actions.save' }));

    await waitFor(() => {
      expect(apiMocks.updateWasteManagementSettings).toHaveBeenCalledTimes(1);
    });
    expect(apiMocks.updateWasteManagementSettings.mock.calls[0]?.[0]).toEqual(
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

    expect(await screen.findByText('output.emailReminder.messages.saveSuccess')).toBeTruthy();
  });

  it('renders fallback email reminder defaults without mail transport options and refetches settings after null updates', async () => {
    apiMocks.getWasteManagementSettings
      .mockResolvedValueOnce({
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
        ],
        pdfBrandingAssetUrl: null,
        pdfContactBlock: null,
        calendarWebUrl: 'https://kalender.example',
        databaseUrlConfigured: true,
        serviceRoleKeyConfigured: true,
        visibleStatus: 'ok',
        customRecurrencePresets: [],
      })
      .mockResolvedValueOnce({
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
        ],
        pdfBrandingAssetUrl: '',
        pdfContactBlock: '',
        calendarWebUrl: 'https://kalender.example',
        emailReminderConfig: {
          enabled: false,
          publicSignupEnabled: false,
          transportId: '',
          publicBaseUrl: 'https://kalender.example',
          doiConfirmPath: '/email-reminders/confirm',
          unsubscribePath: '/email-reminders/unsubscribe',
          signupSuccessPath: '/email-reminders/pending',
          activationSuccessPath: '/email-reminders/active',
          unsubscribeSuccessPath: '/email-reminders/unsubscribed',
          invalidTokenPath: '/email-reminders/token-invalid',
          fromName: 'Abfallwirtschaft',
          fromEmail: 'abfall@example.org',
          replyToEmail: 'abfall@example.org',
          serviceLabel: 'Muelli',
          privacyPolicyUrl: 'https://example.org/datenschutz',
          imprintUrl: 'https://example.org/impressum',
          consentLabel:
            'Ich stimme der Verarbeitung meiner Daten zur Einrichtung der E-Mail-Erinnerung zu.',
          consentVersion: 'v1',
          dataControllerLabel: 'Abfallwirtschaft',
          dataProtectionContactEmail: 'datenschutz@example.org',
          doiSubjectTemplate: 'Bitte bestaetigen Sie Ihre E-Mail-Erinnerung fuer {{locationLabel}}',
          doiPreheader: 'Bestaetigen Sie die Einrichtung Ihres Erinnerungsdienstes.',
          doiIntroText:
            'Bitte bestaetigen Sie die Einrichtung Ihrer E-Mail-Erinnerung fuer {{locationLabel}} ueber den folgenden Link.',
          doiButtonLabel: 'E-Mail-Erinnerung aktivieren',
          doiFallbackText:
            'Falls der Button nicht funktioniert, nutzen Sie bitte den direkten Link.',
          doiExpiryNoticeText: 'Der Aktivierungslink ist zeitlich begrenzt gueltig.',
          doiSuccessHeadline: 'E-Mail-Erinnerung aktiviert',
          doiSuccessBody:
            'Der Dienst ist jetzt aktiv und informiert Sie kuenftig ueber anstehende Entsorgungstermine.',
          doiErrorHeadline: 'Aktivierung nicht moeglich',
          doiErrorBody: 'Der Aktivierungslink ist ungueltig oder bereits abgelaufen.',
          reminderSubjectTemplate: 'Abfalltermin fuer {{locationLabel}} am {{pickupDate}}',
          reminderIntroTemplate:
            'Nicht vergessen: {{fractionName}} wird am {{pickupDate}} abgeholt.',
          reminderListIntroTemplate: 'Folgende Abfallart steht als naechstes an:',
          reminderOutroText: 'Sie koennen diese Erinnerung jederzeit wieder abbestellen.',
          unsubscribeLinkLabel: 'E-Mail-Erinnerung abbestellen',
          reminderReasonText:
            'Sie erhalten diese Nachricht, weil Sie fuer {{locationLabel}} eine E-Mail-Erinnerung eingerichtet haben.',
          unsubscribeSuccessHeadline: 'E-Mail-Erinnerung deaktiviert',
          unsubscribeSuccessBody: 'Der Dienst wurde fuer diese Adresse erfolgreich deaktiviert.',
          unsubscribeAlreadyDoneHeadline: 'E-Mail-Erinnerung bereits deaktiviert',
          unsubscribeAlreadyDoneBody:
            'Fuer diese Adresse ist bereits keine aktive Erinnerung mehr hinterlegt.',
          unsubscribeErrorHeadline: 'Abmeldung nicht moeglich',
          unsubscribeErrorBody: 'Der Abmeldelink ist ungueltig oder bereits abgelaufen.',
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
    apiMocks.updateWasteManagementSettings.mockResolvedValueOnce(null);

    render(<WasteOutputPanel />);

    expect(await screen.findByText('output.emailReminder.messages.noMailTransport')).toBeTruthy();
    expect(
      String(
        (screen.getByLabelText('output.emailReminder.fields.publicBaseUrl') as HTMLInputElement)
          .value
      )
    ).toContain('https://');
    fireEvent.click(screen.getByRole('button', { name: 'output.pdf.actions.save' }));

    await waitFor(() => {
      expect(apiMocks.getWasteManagementSettings).toHaveBeenCalledTimes(2);
    });
  });

  it('maps forbidden and generic save failures for pdf and email reminder settings', async () => {
    apiMocks.updateWasteManagementSettings
      .mockRejectedValueOnce(new Error('forbidden'))
      .mockRejectedValueOnce(new Error('boom'));

    render(<WasteOutputPanel />);

    expect(await screen.findByText('output.pdf.title')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'output.pdf.actions.save' }));
    expect(await screen.findByText('output.pdf.messages.saveError')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'output.emailReminder.actions.save' }));
    expect(await screen.findByText('output.emailReminder.messages.saveError')).toBeTruthy();
  });

  it('updates the direct email reminder configuration card across all major field groups', async () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const translate = (key: string, variables?: Record<string, string | number>) =>
      variables ? `${key}:${JSON.stringify(variables)}` : key;

    const Wrapper = () => {
      const [value, setValue] = React.useState({
        enabled: false,
        publicSignupEnabled: false,
        transportId: 'mail-transport-1',
        publicBaseUrl: 'https://example.org',
        doiConfirmPath: '/confirm',
        unsubscribePath: '/unsubscribe',
        signupSuccessPath: '/pending',
        activationSuccessPath: '/active',
        unsubscribeSuccessPath: '/done',
        invalidTokenPath: '/invalid',
        fromName: 'Abfallwirtschaft',
        fromEmail: 'abfall@example.org',
        replyToEmail: 'reply@example.org',
        serviceLabel: 'Muelli',
        privacyPolicyUrl: 'https://example.org/privacy',
        imprintUrl: 'https://example.org/imprint',
        consentVersion: 'v1',
        dataControllerLabel: 'Abfallwirtschaft',
        dataProtectionContactEmail: 'dsb@example.org',
        consentLabel: 'Ich stimme zu.',
        doiSubjectTemplate: 'Bitte bestaetigen',
        doiButtonLabel: 'Aktivieren',
        doiPreheader: 'Preheader',
        doiFallbackText: 'Fallback',
        doiIntroText: 'Intro',
        doiExpiryNoticeText: '48h',
        reminderSubjectTemplate: 'Erinnerung',
        unsubscribeLinkLabel: 'Abmelden',
        reminderIntroTemplate: 'Intro Erinnerung',
        reminderListIntroTemplate: 'Liste',
        reminderOutroText: 'Outro',
        reminderReasonText: 'Grund',
        unsubscribeSuccessHeadline: 'Erfolg',
        unsubscribeAlreadyDoneHeadline: 'Schon erledigt',
        unsubscribeErrorHeadline: 'Fehler',
        unsubscribeSuccessBody: 'Body Erfolg',
        unsubscribeAlreadyDoneBody: 'Body Schon erledigt',
        unsubscribeErrorBody: 'Body Fehler',
        doiTokenTtlHours: 48,
        pendingSubscriptionTtlHours: 72,
        materializationLookaheadDays: 7,
        maxSubscriptionsPerEmailAndLocation: 5,
        signupRateLimitPerIpPerHour: 20,
        signupRateLimitPerEmailPerHour: 10,
        unsubscribeTokenTtlDays: 30,
      } as const);

      return (
        <WasteEmailReminderConfigurationSection
          hasMailTransportOptions
          onChange={setValue}
          onSubmit={onSubmit}
          running={false}
          transportOptions={[
            {
              id: 'mail-transport-1',
              name: 'Zentraler Mailtransport',
              typeKey: 'mail_transport',
              enabled: true,
              visibleStatus: 'ok',
              isSelected: false,
            },
            {
              id: 'mail-transport-2',
              name: 'Fallback Transport',
              typeKey: 'mail_transport',
              enabled: true,
              visibleStatus: 'disabled',
              isSelected: false,
            },
          ]}
          translate={translate}
          value={value}
        />
      );
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByLabelText('output.emailReminder.fields.enabled'));
    fireEvent.click(screen.getByLabelText('output.emailReminder.fields.publicSignupEnabled'));
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.transportId'), {
      target: { value: 'mail-transport-2' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.publicBaseUrl'), {
      target: { value: 'https://public.example.org' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.fromName'), {
      target: { value: 'Landkreis' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.fromEmail'), {
      target: { value: 'noreply@example.org' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.replyToEmail'), {
      target: { value: 'service@example.org' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.serviceLabel'), {
      target: { value: 'Service' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.privacyPolicyUrl'), {
      target: { value: 'https://example.org/ds' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.imprintUrl'), {
      target: { value: 'https://example.org/imprint-new' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.consentVersion'), {
      target: { value: 'v2' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.dataControllerLabel'), {
      target: { value: 'Controller' },
    });
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.dataProtectionContactEmail'),
      { target: { value: 'privacy@example.org' } }
    );
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.consentLabel'), {
      target: { value: 'Neue Einwilligung' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.doiSubjectTemplate'), {
      target: { value: 'DOI Betreff' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.doiButtonLabel'), {
      target: { value: 'Bestaetigen' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.doiPreheader'), {
      target: { value: 'DOI Preheader' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.doiFallbackText'), {
      target: { value: 'DOI Fallback' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.doiIntroText'), {
      target: { value: 'DOI Intro' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.doiExpiryNoticeText'), {
      target: { value: '24h' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.reminderSubjectTemplate'), {
      target: { value: 'Reminder Betreff' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.unsubscribeLinkLabel'), {
      target: { value: 'Jetzt abmelden' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.reminderIntroTemplate'), {
      target: { value: 'Reminder Intro' },
    });
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.reminderListIntroTemplate'),
      { target: { value: 'Reminder Liste' } }
    );
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.reminderOutroText'), {
      target: { value: 'Reminder Outro' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.reminderReasonText'), {
      target: { value: 'Reminder Grund' },
    });
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.unsubscribeSuccessHeadline'),
      { target: { value: 'Success Headline' } }
    );
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.unsubscribeAlreadyDoneHeadline'),
      { target: { value: 'Already Headline' } }
    );
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.unsubscribeErrorHeadline'),
      { target: { value: 'Error Headline' } }
    );
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.unsubscribeSuccessBody'), {
      target: { value: 'Success Body' },
    });
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.unsubscribeAlreadyDoneBody'),
      { target: { value: 'Already Body' } }
    );
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.unsubscribeErrorBody'), {
      target: { value: 'Error Body' },
    });
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.doiTokenTtlHours'), {
      target: { value: '12' },
    });
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.pendingSubscriptionTtlHours'),
      { target: { value: '36' } }
    );
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.materializationLookaheadDays'),
      { target: { value: '5' } }
    );
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.maxSubscriptionsPerEmailAndLocation'),
      { target: { value: '3' } }
    );
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.signupRateLimitPerIpPerHour'),
      { target: { value: '8' } }
    );
    fireEvent.change(
      screen.getByLabelText('output.emailReminder.fields.signupRateLimitPerEmailPerHour'),
      { target: { value: '4' } }
    );
    fireEvent.change(screen.getByLabelText('output.emailReminder.fields.unsubscribeTokenTtlDays'), {
      target: { value: '90' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'output.emailReminder.actions.save' }).closest('form')!
    );

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByText('output.emailReminder.transportStatus.disabled')).toBeTruthy();
  });

  it('shows the missing mail transport warning on the direct email reminder configuration card', () => {
    render(
      <WasteEmailReminderConfigurationSection
        hasMailTransportOptions={false}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        running={false}
        transportOptions={[]}
        translate={(key) => key}
        value={{
          enabled: false,
          publicSignupEnabled: false,
          transportId: '',
          publicBaseUrl: 'https://example.org',
          doiConfirmPath: '/confirm',
          unsubscribePath: '/unsubscribe',
          signupSuccessPath: '/pending',
          activationSuccessPath: '/active',
          unsubscribeSuccessPath: '/done',
          invalidTokenPath: '/invalid',
          fromName: 'Abfallwirtschaft',
          fromEmail: 'abfall@example.org',
          replyToEmail: 'reply@example.org',
          serviceLabel: 'Muelli',
          privacyPolicyUrl: 'https://example.org/privacy',
          imprintUrl: 'https://example.org/imprint',
          consentVersion: 'v1',
          dataControllerLabel: 'Abfallwirtschaft',
          dataProtectionContactEmail: 'dsb@example.org',
          consentLabel: 'Ich stimme zu.',
          doiSubjectTemplate: 'Bitte bestaetigen',
          doiButtonLabel: 'Aktivieren',
          doiPreheader: 'Preheader',
          doiFallbackText: 'Fallback',
          doiIntroText: 'Intro',
          doiExpiryNoticeText: '48h',
          reminderSubjectTemplate: 'Erinnerung',
          unsubscribeLinkLabel: 'Abmelden',
          reminderIntroTemplate: 'Intro Erinnerung',
          reminderListIntroTemplate: 'Liste',
          reminderOutroText: 'Outro',
          reminderReasonText: 'Grund',
          unsubscribeSuccessHeadline: 'Erfolg',
          unsubscribeAlreadyDoneHeadline: 'Schon erledigt',
          unsubscribeErrorHeadline: 'Fehler',
          unsubscribeSuccessBody: 'Body Erfolg',
          unsubscribeAlreadyDoneBody: 'Body Schon erledigt',
          unsubscribeErrorBody: 'Body Fehler',
          doiTokenTtlHours: 48,
          pendingSubscriptionTtlHours: 72,
          materializationLookaheadDays: 7,
          maxSubscriptionsPerEmailAndLocation: 5,
          signupRateLimitPerIpPerHour: 20,
          signupRateLimitPerEmailPerHour: 10,
          unsubscribeTokenTtlDays: 30,
        }}
      />
    );

    expect(screen.getByText('output.emailReminder.messages.noMailTransport')).toBeTruthy();
  });

  it('does not render internal email reminder path fields on the direct configuration card', () => {
    render(
      <WasteEmailReminderConfigurationSection
        hasMailTransportOptions
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        running={false}
        transportOptions={[
          {
            id: 'mail-transport-1',
            name: 'Zentraler Mailtransport',
            typeKey: 'mail_transport',
            enabled: true,
            visibleStatus: 'ok',
            isSelected: true,
          },
        ]}
        translate={(key) => key}
        value={{
          enabled: true,
          publicSignupEnabled: true,
          transportId: 'mail-transport-1',
          publicBaseUrl: 'https://example.org',
          doiConfirmPath: '/email-reminders/confirm',
          unsubscribePath: '/email-reminders/unsubscribe',
          signupSuccessPath: '/email-reminders/pending',
          activationSuccessPath: '/email-reminders/active',
          unsubscribeSuccessPath: '/email-reminders/unsubscribed',
          invalidTokenPath: '/email-reminders/token-invalid',
          fromName: 'Abfallwirtschaft',
          fromEmail: 'abfall@example.org',
          replyToEmail: 'reply@example.org',
          serviceLabel: 'Muelli',
          privacyPolicyUrl: 'https://example.org/privacy',
          imprintUrl: 'https://example.org/imprint',
          consentVersion: 'v1',
          dataControllerLabel: 'Abfallwirtschaft',
          dataProtectionContactEmail: 'dsb@example.org',
          consentLabel: 'Ich stimme zu.',
          doiSubjectTemplate: 'Bitte bestaetigen',
          doiButtonLabel: 'Aktivieren',
          doiPreheader: 'Preheader',
          doiFallbackText: 'Fallback',
          doiIntroText: 'Intro',
          doiExpiryNoticeText: '48h',
          reminderSubjectTemplate: 'Erinnerung',
          unsubscribeLinkLabel: 'Abmelden',
          reminderIntroTemplate: 'Intro Erinnerung',
          reminderListIntroTemplate: 'Liste',
          reminderOutroText: 'Outro',
          reminderReasonText: 'Grund',
          unsubscribeSuccessHeadline: 'Erfolg',
          unsubscribeAlreadyDoneHeadline: 'Schon erledigt',
          unsubscribeErrorHeadline: 'Fehler',
          unsubscribeSuccessBody: 'Body Erfolg',
          unsubscribeAlreadyDoneBody: 'Body Schon erledigt',
          unsubscribeErrorBody: 'Body Fehler',
          doiTokenTtlHours: 48,
          pendingSubscriptionTtlHours: 72,
          materializationLookaheadDays: 7,
          maxSubscriptionsPerEmailAndLocation: 5,
          signupRateLimitPerIpPerHour: 20,
          signupRateLimitPerEmailPerHour: 10,
          unsubscribeTokenTtlDays: 30,
        }}
      />
    );

    expect(screen.queryByLabelText('output.emailReminder.fields.doiConfirmPath')).toBeNull();
    expect(screen.queryByLabelText('output.emailReminder.fields.unsubscribePath')).toBeNull();
    expect(screen.queryByLabelText('output.emailReminder.fields.signupSuccessPath')).toBeNull();
    expect(screen.queryByLabelText('output.emailReminder.fields.activationSuccessPath')).toBeNull();
    expect(
      screen.queryByLabelText('output.emailReminder.fields.unsubscribeSuccessPath')
    ).toBeNull();
    expect(screen.queryByLabelText('output.emailReminder.fields.invalidTokenPath')).toBeNull();
  });

  it('still allows saving a disabled reminder configuration when no mail transport remains', () => {
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const StatefulSection = () => {
      const [value, setValue] = React.useState({
        enabled: true,
        publicSignupEnabled: false,
        transportId: '',
        publicBaseUrl: 'https://example.org',
        doiConfirmPath: '/confirm',
        unsubscribePath: '/unsubscribe',
        signupSuccessPath: '/pending',
        activationSuccessPath: '/active',
        unsubscribeSuccessPath: '/done',
        invalidTokenPath: '/invalid',
        fromName: 'Abfallwirtschaft',
        fromEmail: 'abfall@example.org',
        replyToEmail: 'reply@example.org',
        serviceLabel: 'Muelli',
        privacyPolicyUrl: 'https://example.org/privacy',
        imprintUrl: 'https://example.org/imprint',
        consentVersion: 'v1',
        dataControllerLabel: 'Abfallwirtschaft',
        dataProtectionContactEmail: 'dsb@example.org',
        consentLabel: 'Ich stimme zu.',
        doiSubjectTemplate: 'Bitte bestaetigen',
        doiButtonLabel: 'Aktivieren',
        doiPreheader: 'Preheader',
        doiFallbackText: 'Fallback',
        doiIntroText: 'Intro',
        doiExpiryNoticeText: '48h',
        reminderSubjectTemplate: 'Erinnerung',
        unsubscribeLinkLabel: 'Abmelden',
        reminderIntroTemplate: 'Intro Erinnerung',
        reminderListIntroTemplate: 'Liste',
        reminderOutroText: 'Outro',
        reminderReasonText: 'Grund',
        unsubscribeSuccessHeadline: 'Erfolg',
        unsubscribeAlreadyDoneHeadline: 'Schon erledigt',
        unsubscribeErrorHeadline: 'Fehler',
        unsubscribeSuccessBody: 'Body Erfolg',
        unsubscribeAlreadyDoneBody: 'Body Schon erledigt',
        unsubscribeErrorBody: 'Body Fehler',
        doiTokenTtlHours: 48,
        pendingSubscriptionTtlHours: 72,
        materializationLookaheadDays: 7,
        maxSubscriptionsPerEmailAndLocation: 5,
        signupRateLimitPerIpPerHour: 20,
        signupRateLimitPerEmailPerHour: 10,
        unsubscribeTokenTtlDays: 30,
      });

      return (
        <WasteEmailReminderConfigurationSection
          hasMailTransportOptions={false}
          onChange={setValue}
          onSubmit={onSubmit}
          running={false}
          transportOptions={[]}
          translate={(key) => key}
          value={value}
        />
      );
    };

    render(<StatefulSection />);

    const saveButton = screen.getByRole('button', {
      name: 'output.emailReminder.actions.save',
    }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('output.emailReminder.fields.enabled'));

    expect(saveButton.disabled).toBe(false);
    fireEvent.submit(saveButton.closest('form')!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('email reminder configuration helpers', () => {
  const interfaces = [
    {
      id: 'database-1',
      name: 'Database',
      typeKey: 'supabase',
      enabled: true,
      visibleStatus: 'ok' as const,
      isSelected: true,
    },
    {
      id: 'mail-1',
      name: 'Primary mail',
      typeKey: 'mail_transport',
      enabled: true,
      visibleStatus: 'ok' as const,
      isSelected: false,
    },
  ];

  it('filters transports and builds deterministic defaults', () => {
    const transports = getMailTransportOptions(interfaces);
    const config = buildDefaultEmailReminderConfig({
      calendarWebUrl: 'https://calendar.example',
      transportOptions: transports,
    });

    expect(transports).toEqual([interfaces[1]]);
    expect(config).toMatchObject({
      enabled: false,
      transportId: 'mail-1',
      publicBaseUrl: 'https://calendar.example',
      invalidTokenPath: '/email-reminders/token-invalid',
    });
  });

  it('falls back to the first transport and normalizes fixed paths', () => {
    const transports = getMailTransportOptions(interfaces);
    const config = buildDefaultEmailReminderConfig({ transportOptions: [] });
    const withFallback = ensureTransportSelection(config, transports);
    const normalized = normalizeEmailReminderConfig({
      config: { ...withFallback, invalidTokenPath: '/editable-but-fixed' },
      transportOptions: transports,
    });

    expect(withFallback.transportId).toBe('mail-1');
    expect(normalized).toMatchObject({
      transportId: 'mail-1',
      invalidTokenPath: '/email-reminders/token-invalid',
      doiConfirmPath: '/email-reminders/confirm',
    });
  });

  it('creates normalized defaults when no persisted config exists', () => {
    expect(
      normalizeEmailReminderConfig({
        calendarWebUrl: 'https://calendar.example',
        transportOptions: [],
      })
    ).toMatchObject({
      transportId: '',
      publicBaseUrl: 'https://calendar.example',
      unsubscribePath: '/email-reminders/unsubscribe',
    });
  });
});
