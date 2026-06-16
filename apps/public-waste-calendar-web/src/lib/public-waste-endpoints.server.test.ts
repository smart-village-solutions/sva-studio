import * as wasteOutput from '@sva/core';
import { describe, expect, it, vi } from 'vitest';

import { PublicWasteReminderSignupError } from '../server/public-waste-email-reminders.server.js';
import {
  handlePublicWasteCalendarRequest,
  handlePublicWasteIcalRequest,
  handlePublicWastePdfRequest,
  handlePublicWasteReminderSignupRequest,
  handlePublicWasteSelectionRequest,
} from './public-waste-endpoints.server.js';

describe('public waste endpoints', () => {
  it('returns the next selection step as json', async () => {
    const response = await handlePublicWasteSelectionRequest({
      repository: {
        listSelectionOptions: vi.fn().mockResolvedValue({
          step: 'city',
          options: [{ id: 'c-1', label: 'Musterstadt' }],
        }),
      },
      request: new Request(
        'https://example.invalid/public-waste/selection?regionId=11111111-1111-4111-8111-111111111111'
      ),
    });

    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      status: 'incomplete',
      step: 'city',
      options: [{ id: 'c-1', label: 'Musterstadt' }],
    });
  });

  it('returns the resolved calendar model as json', async () => {
    const response = await handlePublicWasteCalendarRequest({
      repository: {
        loadCalendarEntries: vi.fn().mockResolvedValue([
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            note: null,
          },
        ]),
        loadSelectionSummary: vi.fn().mockResolvedValue('Musterstadt, Hauptstraße 1'),
        loadReminderSignupOptions: vi.fn().mockResolvedValue([
          {
            id: 'bio',
            label: 'Bioabfall',
            color: '#008800',
            slots: [{ id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 }],
          },
        ]),
      },
      request: new Request(
        'https://example.invalid/public-waste/calendar?regionId=11111111-1111-4111-8111-111111111111&cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&houseNumberId=44444444-4444-4444-8444-444444444444&referenceDate=2026-05-18'
      ),
      reminderConfig: {
        enabled: true,
        publicSignupEnabled: true,
        transportId: 'mail-1',
        publicBaseUrl: 'https://example.invalid',
        doiConfirmPath: '/erinnerungen/bestaetigen',
        unsubscribePath: '/erinnerungen/abmelden',
        fromName: 'Abfallwirtschaft',
        fromEmail: 'abfall@example.invalid',
        privacyPolicyUrl: 'https://example.invalid/datenschutz',
        imprintUrl: 'https://example.invalid/impressum',
        consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
        consentVersion: 'v1',
        doiSubjectTemplate: 'Bitte E-Mail-Adresse bestätigen',
        doiIntroText: 'Bestätigen Sie Ihre Adresse.',
        doiButtonLabel: 'Jetzt bestätigen',
        reminderSubjectTemplate: 'Erinnerung',
        reminderIntroTemplate: 'Nicht vergessen.',
        unsubscribeLinkLabel: 'Abmelden',
        unsubscribeSuccessHeadline: 'Abgemeldet',
        unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
        maxSubscriptionsPerEmailAndLocation: 3,
        signupRateLimitPerIpPerHour: 10,
        signupRateLimitPerEmailPerHour: 3,
        doiTokenTtlHours: 24,
        pendingSubscriptionTtlHours: 48,
        materializationLookaheadDays: 7,
      },
    });

    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({
      nextPickupDate: '2026-05-19',
      selectionSummary: 'Musterstadt, Hauptstraße 1',
      reminderSignup: {
        enabled: true,
        consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
        privacyPolicyUrl: 'https://example.invalid/datenschutz',
        fractions: [
          {
            id: 'bio',
            label: 'Bioabfall',
            slots: [{ id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 }],
          },
        ],
      },
    });
  });

  it('returns a binary pdf for the resolved selection and chosen fractions', async () => {
    const loadBrandingImage = vi.fn().mockResolvedValue({
      width: 2,
      height: 1,
      rgbData: new Uint8Array([255, 255, 255, 0, 0, 0]),
    });
    const response = await handlePublicWastePdfRequest({
      repository: {
        loadCalendarEntries: vi.fn().mockResolvedValue([
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            fractionShortLabel: 'BIO',
            note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
          },
        ]),
        loadSelectionSummary: vi.fn().mockResolvedValue('Musterstadt, Hauptstraße 1'),
      },
      request: new Request(
        'https://example.invalid/public-waste/pdf?cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&houseNumberId=44444444-4444-4444-8444-444444444444&year=2026&fractionId=bio'
      ),
      loadPdfStaticConfig: vi.fn().mockResolvedValue({
        brandingAssetUrl: 'https://cdn.example/logo.svg',
        contactBlock: 'Abfallberatung 03395 / 1234',
      }),
      loadBrandingImage,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('abfallkalender-2026-musterstadt-hauptstra-e-1.pdf');
    const pdfText = Buffer.from(await response.arrayBuffer()).toString('latin1');
    expect(pdfText).toContain('Abfallkalender 2026');
    expect(pdfText).toContain('/Subtype /Image');
    expect(loadBrandingImage).toHaveBeenCalledWith({
      assetUrl: 'https://cdn.example/logo.svg',
      requestUrl:
        'https://example.invalid/public-waste/pdf?cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&houseNumberId=44444444-4444-4444-8444-444444444444&year=2026&fractionId=bio',
    });
    expect(pdfText).not.toContain('Stand ');
    expect(pdfText).not.toContain('Alle wirksamen Fraktionen und Verschiebungen sind enthalten.');
  });

  it('deduplicates fractions per pickup date before rendering the pdf payload', async () => {
    const buildDocumentSpy = vi.spyOn(wasteOutput, 'buildWasteCalendarPdfDocument');

    await handlePublicWastePdfRequest({
      repository: {
        loadCalendarEntries: vi.fn().mockResolvedValue([
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            fractionShortLabel: 'BIO',
            note: null,
          },
          {
            id: 'pickup-2',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            fractionShortLabel: 'BIO',
            note: null,
          },
          {
            id: 'pickup-3',
            date: '2026-05-19',
            fractionId: 'paper',
            fractionLabel: 'Papier',
            fractionShortLabel: 'PAP',
            note: null,
          },
        ]),
        loadSelectionSummary: vi.fn().mockResolvedValue('Musterstadt, Hauptstraße 1'),
      },
      request: new Request(
        'https://example.invalid/public-waste/pdf?cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&year=2026&fractionId=bio&fractionId=paper'
      ),
      loadPdfStaticConfig: vi.fn().mockResolvedValue({}),
    });

    expect(buildDocumentSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: [],
        pickups: [
          {
            date: '2026-05-19',
            fractions: [
              expect.objectContaining({
                id: 'bio',
              }),
              expect.objectContaining({
                id: 'paper',
              }),
            ],
          },
        ],
      })
    );
  });

  it('returns an iCal feed for the resolved calendar request', async () => {
    const response = await handlePublicWasteIcalRequest({
      repository: {
        loadCalendarEntries: vi.fn().mockResolvedValue([
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            fractionDescription: 'Bioabfall aus Küche und Garten.',
            tourDescription: 'Regelabfuhr für die Innenstadt.',
            note: 'Bitte Tonne ab 6 Uhr bereitstellen.',
          },
        ]),
        loadSelectionSummary: vi.fn().mockResolvedValue('Musterstadt, Hauptstraße 1'),
      },
      request: new Request(
        'https://example.invalid/public-waste/calendar.ics?regionId=11111111-1111-4111-8111-111111111111&cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&houseNumberId=44444444-4444-4444-8444-444444444444&calendarName=Musterstadt'
      ),
    });

    expect(response.headers.get('content-type')).toContain('text/calendar');
    const body = await response.text();
    expect(body).toContain('DESCRIPTION:Abholort: Musterstadt\\, Hauptstraße 1');
    expect(body).toContain(
      'DESCRIPTION:Fraktion: Bioabfall aus Küche und Garten.\\nTour: Regelabfuhr für die Innenstadt.\\nHinweis: Bitte Tonne ab 6 Uhr bereitstellen.'
    );
  });

  it('keeps the public default iCal as an all-fractions feed without calendar alarms', async () => {
    const response = await handlePublicWasteIcalRequest({
      repository: {
        loadCalendarEntries: vi.fn().mockResolvedValue([
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            note: null,
          },
          {
            id: 'pickup-2',
            date: '2026-05-20',
            fractionId: 'paper',
            fractionLabel: 'Papier',
            note: null,
          },
        ]),
        loadSelectionSummary: vi.fn().mockResolvedValue('Musterstadt, Hauptstraße 1'),
      },
      request: new Request(
        'https://example.invalid/public-waste/calendar.ics?cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&calendarName=Musterstadt'
      ),
    });

    const body = await response.text();
    expect(body).toContain('SUMMARY:Bioabfall');
    expect(body).toContain('SUMMARY:Papier');
    expect(body).not.toContain('BEGIN:VALARM');
  });

  it('suppresses duplicate event description texts across fraction, tour and note parts', async () => {
    const response = await handlePublicWasteIcalRequest({
      repository: {
        loadCalendarEntries: vi.fn().mockResolvedValue([
          {
            id: 'pickup-1',
            date: '2026-05-19',
            fractionId: 'bio',
            fractionLabel: 'Bioabfall',
            fractionDescription: 'Bereitstellung am Vorabend.',
            tourDescription: 'Bereitstellung am Vorabend.',
            note: 'Bereitstellung am Vorabend.',
          },
        ]),
        loadSelectionSummary: vi.fn().mockResolvedValue('Musterstadt, Hauptstraße 1'),
      },
      request: new Request(
        'https://example.invalid/public-waste/calendar.ics?cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&calendarName=Musterstadt'
      ),
    });

    const body = await response.text();
    expect(body).toContain('DESCRIPTION:Fraktion: Bereitstellung am Vorabend.');
    expect(body).not.toContain('\\nTour: Bereitstellung am Vorabend.');
    expect(body).not.toContain('\\nHinweis: Bereitstellung am Vorabend.');
  });

  it('accepts the catch-all street sentinel for resolved calendar requests', async () => {
    const loadCalendarEntries = vi.fn().mockResolvedValue([]);
    const loadSelectionSummary = vi.fn().mockResolvedValue('Musterstadt, Alle Straßen');

    const response = await handlePublicWasteCalendarRequest({
      repository: {
        loadCalendarEntries,
        loadSelectionSummary,
        loadReminderSignupOptions: vi.fn().mockResolvedValue([]),
      },
      request: new Request(
        'https://example.invalid/public-waste/calendar?cityId=22222222-2222-4222-8222-222222222222&streetId=all&referenceDate=2026-05-18'
      ),
    });

    expect(response.status).toBe(200);
    expect(loadCalendarEntries).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: expect.objectContaining({
          streetId: 'all',
        }),
      })
    );
  });

  it('returns a generic invalid_request payload for malformed selection queries', async () => {
    const response = await handlePublicWasteSelectionRequest({
      repository: {
        listSelectionOptions: vi.fn(),
      },
      request: new Request('https://example.invalid/public-waste/selection?regionId=not-a-uuid'),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_request',
      message: 'Ungültige Anfrage.',
    });
  });

  it('persists a pending reminder signup and returns a pending confirmation response', async () => {
    const submitReminderSignup = vi.fn().mockResolvedValue({
      status: 'pending',
      headline: 'Bestätigungslink versendet',
      message: 'Bitte prüfen Sie Ihr E-Mail-Postfach.',
    });

    const response = await handlePublicWasteReminderSignupRequest({
      repository: {
        loadReminderSignupOptions: vi.fn().mockResolvedValue([
          {
            id: 'bio',
            label: 'Bioabfall',
            slots: [{ id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 }],
          },
        ]),
        loadSelectionSummary: vi.fn().mockResolvedValue('Perleberg, Ackerstr. 12'),
      },
      request: new Request('https://example.invalid/api/public-waste/reminder-signups', {
        method: 'POST',
        body: JSON.stringify({
          selection: {
            cityId: '22222222-2222-4222-8222-222222222222',
            streetId: '33333333-3333-4333-8333-333333333333',
          },
          email: 'person@example.invalid',
          items: [{ fractionId: 'bio', slotId: 'bio:first' }],
          consentAccepted: true,
        }),
        headers: {
          'content-type': 'application/json',
        },
      }),
      reminderConfig: {
        enabled: true,
        publicSignupEnabled: true,
        transportId: 'mail-1',
        publicBaseUrl: 'https://example.invalid',
        doiConfirmPath: '/erinnerungen/bestaetigen',
        unsubscribePath: '/erinnerungen/abmelden',
        fromName: 'Abfallwirtschaft',
        fromEmail: 'abfall@example.invalid',
        privacyPolicyUrl: 'https://example.invalid/datenschutz',
        imprintUrl: 'https://example.invalid/impressum',
        consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
        consentVersion: 'v1',
        doiSubjectTemplate: 'Bitte E-Mail-Adresse bestätigen',
        doiIntroText: 'Bestätigen Sie Ihre Adresse.',
        doiButtonLabel: 'Jetzt bestätigen',
        reminderSubjectTemplate: 'Erinnerung',
        reminderIntroTemplate: 'Nicht vergessen.',
        unsubscribeLinkLabel: 'Abmelden',
        unsubscribeSuccessHeadline: 'Abgemeldet',
        unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
        maxSubscriptionsPerEmailAndLocation: 3,
        signupRateLimitPerIpPerHour: 10,
        signupRateLimitPerEmailPerHour: 3,
        doiTokenTtlHours: 24,
        pendingSubscriptionTtlHours: 48,
        materializationLookaheadDays: 7,
      },
      submitReminderSignup,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'pending',
      headline: 'Bestätigungslink versendet',
      message: 'Bitte prüfen Sie Ihr E-Mail-Postfach.',
    });
    expect(submitReminderSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          email: 'person@example.invalid',
          items: [{ fractionId: 'bio', slotId: 'bio:first' }],
        }),
      })
    );
  });

  it('returns 429 when the reminder signup is rate limited', async () => {
    const submitReminderSignup = vi.fn().mockRejectedValue(
      new PublicWasteReminderSignupError({
        code: 'rate_limited',
        message: 'Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es später erneut.',
        status: 429,
        retryAfterSeconds: 3600,
      })
    );

    const response = await handlePublicWasteReminderSignupRequest({
      repository: {
        loadReminderSignupOptions: vi.fn().mockResolvedValue([
          {
            id: 'bio',
            label: 'Bioabfall',
            slots: [{ id: 'bio:first', maxLeadDays: 2, defaultLeadDays: 1 }],
          },
        ]),
        loadSelectionSummary: vi.fn().mockResolvedValue('Perleberg, Ackerstr. 12'),
      },
      request: new Request('https://example.invalid/api/public-waste/reminder-signups', {
        method: 'POST',
        body: JSON.stringify({
          selection: {
            cityId: '22222222-2222-4222-8222-222222222222',
            streetId: '33333333-3333-4333-8333-333333333333',
          },
          email: 'person@example.invalid',
          items: [{ fractionId: 'bio', slotId: 'bio:first' }],
          consentAccepted: true,
        }),
        headers: {
          'content-type': 'application/json',
        },
      }),
      reminderConfig: {
        enabled: true,
        publicSignupEnabled: true,
        transportId: 'mail-1',
        publicBaseUrl: 'https://example.invalid',
        doiConfirmPath: '/erinnerungen/bestaetigen',
        unsubscribePath: '/erinnerungen/abmelden',
        fromName: 'Abfallwirtschaft',
        fromEmail: 'abfall@example.invalid',
        privacyPolicyUrl: 'https://example.invalid/datenschutz',
        imprintUrl: 'https://example.invalid/impressum',
        consentLabel: 'Ich stimme der Verarbeitung meiner Daten zu.',
        consentVersion: 'v1',
        doiSubjectTemplate: 'Bitte E-Mail-Adresse bestätigen',
        doiIntroText: 'Bestätigen Sie Ihre Adresse.',
        doiButtonLabel: 'Jetzt bestätigen',
        reminderSubjectTemplate: 'Erinnerung',
        reminderIntroTemplate: 'Nicht vergessen.',
        unsubscribeLinkLabel: 'Abmelden',
        unsubscribeSuccessHeadline: 'Abgemeldet',
        unsubscribeSuccessBody: 'Sie erhalten keine weiteren E-Mails.',
        maxSubscriptionsPerEmailAndLocation: 3,
        signupRateLimitPerIpPerHour: 10,
        signupRateLimitPerEmailPerHour: 3,
        doiTokenTtlHours: 24,
        pendingSubscriptionTtlHours: 48,
        materializationLookaheadDays: 7,
      },
      submitReminderSignup,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('3600');
  });
});
