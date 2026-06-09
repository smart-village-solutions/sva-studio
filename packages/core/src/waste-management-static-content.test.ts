import { describe, expect, it } from 'vitest';

import type { WasteFractionRecord } from './waste-management-master-data.js';
import { buildWasteTypesStaticContent } from './waste-management-static-content.js';

const createFraction = (overrides: Partial<WasteFractionRecord> = {}): WasteFractionRecord => ({
  id: 'fraction-bio',
  name: 'Biotonne auf Abruf',
  pdfShortLabel: 'BIO',
  color: '#8B4513',
  description: 'Nur auf Abruf',
  translations: { de: 'Biotonne auf Abruf' },
  active: true,
  reminderCount: 'none',
  firstReminderMaxLeadDays: undefined,
  secondReminderMaxLeadDays: undefined,
  reminderChannelPushEnabled: false,
  reminderChannelEmailEnabled: false,
  reminderChannelCalendarEnabled: false,
  createdAt: '2026-06-09T10:00:00.000Z',
  updatedAt: '2026-06-09T10:00:00.000Z',
  ...overrides,
});

describe('buildWasteTypesStaticContent', () => {
  it('builds a deterministic wasteTypes artifact from active fractions', async () => {
    const artifact = await buildWasteTypesStaticContent([
      createFraction(),
      createFraction({
        id: 'fraction-paper',
        name: 'Papiertonne 240 l',
        pdfShortLabel: 'PPK',
        color: '#1E90FF',
        description: undefined,
        containerSize: '240 l',
        translations: { de: 'Papiertonne 240 l', en: 'Paper bin 240 l' },
        reminderCount: 'twice',
        firstReminderMaxLeadDays: 7,
        secondReminderMaxLeadDays: 2,
        reminderChannelPushEnabled: true,
        reminderChannelEmailEnabled: false,
        reminderChannelCalendarEnabled: true,
      }),
      createFraction({
        id: 'fraction-inactive',
        name: 'Inaktiv',
        pdfShortLabel: 'OFF',
        active: false,
      }),
    ]);

    expect(artifact).toMatchObject({
      name: 'wasteTypes',
      dataType: 'JSON',
      version: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      fractionCount: 2,
    });
    expect(JSON.parse(artifact.content)).toEqual({
      BIO: {
        label: 'Biotonne auf Abruf',
        color: '#8B4513',
        selected_color: '#8B4513',
        id: 'fraction-bio',
        short_label: 'BIO',
        active: true,
        description: 'Nur auf Abruf',
        container_size: null,
        translations: { de: 'Biotonne auf Abruf' },
        reminders: {
          reminder_count: 'none',
          first_reminder_max_lead_days: null,
          second_reminder_max_lead_days: null,
          channels: {
            push: false,
            email: false,
            calendar: false,
          },
        },
      },
      PPK: {
        label: 'Papiertonne 240 l',
        color: '#1E90FF',
        selected_color: '#1E90FF',
        id: 'fraction-paper',
        short_label: 'PPK',
        active: true,
        description: null,
        container_size: '240 l',
        translations: { de: 'Papiertonne 240 l', en: 'Paper bin 240 l' },
        reminders: {
          reminder_count: 'twice',
          first_reminder_max_lead_days: 7,
          second_reminder_max_lead_days: 2,
          channels: {
            push: true,
            email: false,
            calendar: true,
          },
        },
      },
    });
  });

  it('rejects fractions without a short label', async () => {
    await expect(buildWasteTypesStaticContent([createFraction({ pdfShortLabel: undefined })])).rejects.toThrow(
      'missing_waste_type_short_label:fraction-bio'
    );
  });

  it('rejects duplicate normalized waste type keys', async () => {
    await expect(
      buildWasteTypesStaticContent([
        createFraction({ id: 'fraction-1', pdfShortLabel: 'BIO' }),
        createFraction({ id: 'fraction-2', pdfShortLabel: 'bio' }),
      ])
    ).rejects.toThrow('duplicate_waste_type_key:BIO');
  });
});
