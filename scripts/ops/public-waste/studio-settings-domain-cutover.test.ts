import { describe, expect, it, vi } from 'vitest';

import {
  buildWasteSettingsDomainCutoverInput,
  cutoverWasteSettingsDomain,
} from './studio-settings-domain-cutover.ts';

const currentSettings = {
  instanceId: 'bb-prignitz',
  provider: 'postgresql' as const,
  schemaName: 'public',
  enabled: true,
  selectedInterfaceId: 'postgresql-1',
  calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app',
  pdfBrandingAssetUrl: 'https://assets.example/brand.svg',
  pdfContactBlock: 'Kontakt',
  holidayStateCode: 'BB',
  customRecurrencePresets: [
    {
      id: 'every-ten-days',
      name: 'Alle zehn Tage',
      intervalDays: 10,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
  emailReminderConfig: {
    enabled: true,
    publicSignupEnabled: true,
    transportId: 'mail-1',
    publicBaseUrl: 'https://bb-prignitz.abfallkalender.smart-village.app',
    consentVersion: '2026-01',
  },
};

describe('public waste Studio settings domain cutover', () => {
  it('changes only the two public URLs and removes read-only preset timestamps', () => {
    expect(
      buildWasteSettingsDomainCutoverInput(
        currentSettings,
        'bb-prignitz',
        'https://prignitz.abfallkalender.pro'
      )
    ).toEqual({
      provider: 'postgresql',
      schemaName: 'public',
      enabled: true,
      selectedInterfaceId: 'postgresql-1',
      calendarWebUrl: 'https://prignitz.abfallkalender.pro',
      pdfBrandingAssetUrl: 'https://assets.example/brand.svg',
      pdfContactBlock: 'Kontakt',
      holidayStateCode: 'BB',
      customRecurrencePresets: [
        { id: 'every-ten-days', name: 'Alle zehn Tage', intervalDays: 10 },
      ],
      deletedPresetFallbacks: {},
      emailReminderConfig: {
        enabled: true,
        publicSignupEnabled: true,
        transportId: 'mail-1',
        publicBaseUrl: 'https://prignitz.abfallkalender.pro',
        consentVersion: '2026-01',
      },
    });
  });

  it('fails closed for the wrong tenant or a missing reminder config', () => {
    expect(() =>
      buildWasteSettingsDomainCutoverInput(
        currentSettings,
        'other-tenant',
        'https://prignitz.abfallkalender.pro'
      )
    ).toThrow('stimmt nicht ueberein');
    expect(() =>
      buildWasteSettingsDomainCutoverInput(
        { ...currentSettings, emailReminderConfig: undefined },
        'bb-prignitz',
        'https://prignitz.abfallkalender.pro'
      )
    ).toThrow('keine E-Mail-Erinnerungskonfiguration');
  });

  it('reads, updates and verifies both URLs without exposing the session cookie', async () => {
    const target = 'https://prignitz.abfallkalender.pro';
    const updated = {
      ...currentSettings,
      calendarWebUrl: target,
      emailReminderConfig: { ...currentSettings.emailReminderConfig, publicBaseUrl: target },
    };
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ data: currentSettings }))
      .mockResolvedValueOnce(Response.json({ data: updated }))
      .mockResolvedValueOnce(Response.json({ data: updated }));

    await expect(
      cutoverWasteSettingsDomain(
        {
          STUDIO_WASTE_BASE_URL: 'https://studio.smart-village.app/',
          PUBLIC_WASTE_EXPECTED_INSTANCE_ID: 'bb-prignitz',
          PUBLIC_WASTE_TARGET_BASE_URL: `${target}/`,
          STUDIO_WASTE_SESSION_COOKIE_COMMAND: '["secret-tool","read-cookie"]',
        },
        {
          fetch,
          resolveSessionCookie: vi.fn().mockResolvedValue('session=secret'),
        }
      )
    ).resolves.toEqual({
      changed: true,
      instanceId: 'bb-prignitz',
      previousCalendarWebUrl: currentSettings.calendarWebUrl,
      previousReminderPublicBaseUrl: currentSettings.emailReminderConfig.publicBaseUrl,
      targetBaseUrl: target,
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    const update = fetch.mock.calls[1];
    expect(update?.[0]).toBe(
      'https://studio.smart-village.app/api/v1/waste-management/settings'
    );
    expect(update?.[1]).toMatchObject({
      method: 'PUT',
      headers: expect.objectContaining({
        Cookie: 'session=secret',
        Origin: 'https://studio.smart-village.app',
        'X-Requested-With': 'XMLHttpRequest',
      }),
    });
    expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({
      calendarWebUrl: target,
      emailReminderConfig: { publicBaseUrl: target },
    });
  });
});
