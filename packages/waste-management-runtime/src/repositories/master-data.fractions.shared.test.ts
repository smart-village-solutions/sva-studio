import { describe, expect, it } from 'vitest';

import { serializeReminderConfig, toLegacyReminderColumns } from './master-data.fractions.persistence.js';
import { mapWasteFractionRow, type WasteFractionRow } from './master-data.fractions.shared.js';

const baseRow = (overrides: Partial<WasteFractionRow> = {}): WasteFractionRow => ({
  id: 'fraction-1',
  name: 'Bioabfall',
  pdf_short_label: null,
  label_translations: { de: 'Bioabfall' },
  container_size: null,
  color: '#00AA00',
  description: null,
  active: true,
  reminder_config: null,
  reminder_count: null,
  first_reminder_max_lead_days: null,
  second_reminder_max_lead_days: null,
  reminder_channel_push_enabled: null,
  reminder_channel_email_enabled: null,
  reminder_channel_calendar_enabled: null,
  created_at: '2026-05-09T10:00:00.000Z',
  updated_at: '2026-05-09T11:00:00.000Z',
  ...overrides,
});

describe('waste fraction reminder helpers', () => {
  it('serializes only enabled reminder channels with snake_case slot fields', () => {
    expect(
      JSON.parse(
        serializeReminderConfig({
          reminderCount: 'once',
          channels: {
            push: true,
            email: false,
            calendar: true,
          },
          push: {
            slots: [
              {
                id: 'push:first',
                maxLeadDays: 5,
                defaultLeadDays: 1,
              },
            ],
          },
        })
      )
    ).toEqual({
      reminder_count: 'once',
      channels: {
        push: true,
        email: false,
        calendar: true,
      },
      push: {
        slots: [
          {
            id: 'push:first',
            max_lead_days: 5,
            default_lead_days: 1,
          },
        ],
      },
    });
  });

  it('derives legacy reminder columns from the first available configured channel and disables none configs', () => {
    expect(
      toLegacyReminderColumns({
        reminderCount: 'twice',
        channels: {
          push: false,
          email: true,
          calendar: false,
        },
        email: {
          slots: [
            { id: 'email:first', maxLeadDays: 6, defaultLeadDays: 1 },
            { id: 'email:second', maxLeadDays: 2, defaultLeadDays: 1 },
          ],
        },
      })
    ).toEqual({
      reminderCount: 'twice',
      firstReminderMaxLeadDays: 6,
      secondReminderMaxLeadDays: 2,
      reminderChannelPushEnabled: false,
      reminderChannelEmailEnabled: true,
      reminderChannelCalendarEnabled: false,
    });

    expect(
      toLegacyReminderColumns({
        reminderCount: 'none',
        channels: {
          push: true,
          email: true,
          calendar: true,
        },
      })
    ).toEqual({
      reminderCount: 'none',
      firstReminderMaxLeadDays: null,
      secondReminderMaxLeadDays: null,
      reminderChannelPushEnabled: false,
      reminderChannelEmailEnabled: false,
      reminderChannelCalendarEnabled: false,
    });
  });

  it('prefers valid json reminder configs, including camelCase slots and empty enabled channel fallbacks', () => {
    expect(
      mapWasteFractionRow(
        baseRow({
          reminder_config: {
            reminderCount: 'twice',
            channels: {
              push: true,
              email: true,
              calendar: false,
            },
            push: {
              slots: [
                {
                  id: 'push:first',
                  maxLeadDays: 7,
                  defaultLeadDays: 1,
                },
                {
                  id: 'broken-slot',
                  maxLeadDays: 'not-a-number',
                  defaultLeadDays: 1,
                },
              ],
            },
          },
          reminder_count: 'once',
          first_reminder_max_lead_days: 3,
          reminder_channel_push_enabled: true,
        })
      ).reminderConfig
    ).toEqual({
      reminderCount: 'twice',
      channels: {
        push: true,
        email: true,
        calendar: false,
      },
      push: {
        slots: [
          {
            id: 'push:first',
            maxLeadDays: 7,
            defaultLeadDays: 1,
          },
        ],
      },
      email: {
        slots: [],
      },
    });
  });

  it('falls back to legacy reminder configs when json is invalid, stale, or has no enabled channels', () => {
    expect(
      mapWasteFractionRow(
        baseRow({
          reminder_config: {
            reminder_count: 'once',
            channels: {
              push: false,
              email: false,
              calendar: false,
            },
          },
          reminder_count: 'twice',
          first_reminder_max_lead_days: 4,
          second_reminder_max_lead_days: 1,
          reminder_channel_push_enabled: true,
          reminder_channel_email_enabled: false,
          reminder_channel_calendar_enabled: true,
        })
      ).reminderConfig
    ).toEqual({
      reminderCount: 'twice',
      channels: {
        push: true,
        email: false,
        calendar: true,
      },
      push: {
        slots: [
          { id: 'fraction-1:push:first', maxLeadDays: 4, defaultLeadDays: 1 },
          { id: 'fraction-1:push:second', maxLeadDays: 1, defaultLeadDays: 1 },
        ],
      },
      calendar: {
        slots: [
          { id: 'fraction-1:calendar:first', maxLeadDays: 4, defaultLeadDays: 1 },
          { id: 'fraction-1:calendar:second', maxLeadDays: 1, defaultLeadDays: 1 },
        ],
      },
    });

    expect(
      mapWasteFractionRow(
        baseRow({
          reminder_config: {
            reminder_count: 'invalid',
            channels: 'broken',
          },
        })
      ).reminderConfig
    ).toEqual({
      reminderCount: 'none',
      channels: {
        push: false,
        email: false,
        calendar: false,
      },
    });
  });
});
