import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizeFractionReminderConfig } from '../src/waste-management.master-data.fraction-reminder-config.js';
import {
  FractionReminderChannels,
  FractionReminderCountField,
} from '../src/waste-management.master-data-fraction-reminder-section.parts.js';
import { FractionReminderChannelSlots } from '../src/waste-management.master-data-fraction-reminder-section.slots.js';
import type { FractionFormState } from '../src/waste-management.master-data.forms.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, variables?: Record<string, string | number>) =>
    variables ? `${key}:${JSON.stringify(variables)}` : key,
  wasteManagementMasterDataContract: {
    fractionReminderLeadDayMin: 1,
    fractionReminderLeadDayMax: 3,
  },
}));

vi.mock('@sva/studio-ui-react', () => ({
  Select: ({
    children,
    ...props
  }: React.ComponentProps<'select'>) => <select {...props}>{children}</select>,
  StudioField: ({
    id,
    label,
    description,
    children,
  }: {
    readonly id: string;
    readonly label: React.ReactNode;
    readonly description?: React.ReactNode;
    readonly children: React.ReactNode;
  }) => (
    <label htmlFor={id}>
      <span>{label}</span>
      {description ? <span>{description}</span> : null}
      {children}
    </label>
  ),
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../src/waste-management.form-switch.js', () => ({
  WasteManagementFormSwitch: ({
    checked,
    ariaLabel,
    disabled,
    onChange,
  }: {
    readonly checked: boolean;
    readonly ariaLabel: string;
    readonly disabled?: boolean;
    readonly onChange: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      {checked ? 'on' : 'off'}
    </button>
  ),
}));

const createForm = (
  reminderConfig: FractionFormState['reminderConfig'] = {
    reminderCount: 'once',
    channels: {
      push: true,
      email: false,
      calendar: false,
    },
    push: {
      slots: [{ id: 'fraction-1:push:first', maxLeadDays: 2, defaultLeadDays: 1 }],
    },
  }
): FractionFormState => ({
  id: 'fraction-1',
  name: 'Bio',
  pdfShortLabel: 'B',
  translations: {},
  containerSize: '',
  color: '#008000',
  description: '',
  active: true,
  reminderConfig,
});

afterEach(() => {
  cleanup();
});

describe('waste fraction reminder logic', () => {
  it('normalizes enabled channels with default slot ids and clamps default lead days', () => {
    const normalized = normalizeFractionReminderConfig('fraction-1', {
      reminderCount: 'twice',
      channels: {
        push: true,
        email: false,
        calendar: true,
      },
      push: {
        slots: [{ id: ' custom-id ', maxLeadDays: 1, defaultLeadDays: 3 }],
      },
      calendar: {
        slots: [],
      },
    });

    expect(normalized).toEqual({
      reminderCount: 'twice',
      channels: {
        push: true,
        email: false,
        calendar: true,
      },
      push: {
        slots: [
          { id: 'custom-id', maxLeadDays: 1, defaultLeadDays: 1 },
          { id: 'fraction-1:push:second', maxLeadDays: 1, defaultLeadDays: 1 },
        ],
      },
      calendar: {
        slots: [
          { id: 'fraction-1:calendar:first', maxLeadDays: 1, defaultLeadDays: 1 },
          { id: 'fraction-1:calendar:second', maxLeadDays: 1, defaultLeadDays: 1 },
        ],
      },
    });
  });

  it('resets reminder count when no channel stays enabled and preserve mode is off', () => {
    expect(
      normalizeFractionReminderConfig('fraction-1', {
        reminderCount: 'once',
        channels: {
          push: false,
          email: false,
          calendar: false,
        },
      })
    ).toEqual({
      reminderCount: 'none',
      channels: {
        push: false,
        email: false,
        calendar: false,
      },
    });
  });

  it('updates reminder count and toggled channels through the reminder section controls', () => {
    const onChange = vi.fn();
    const form = createForm();

    render(
      <>
        <FractionReminderCountField form={form} onChange={onChange} />
        <FractionReminderChannels form={form} onChange={onChange} remindersEnabled />
      </>
    );

    fireEvent.change(document.getElementById('waste-fraction-reminder-count') as HTMLSelectElement, {
      target: { value: 'twice' },
    });
    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        reminderConfig: expect.objectContaining({
          reminderCount: 'twice',
          channels: expect.objectContaining({ push: true }),
        }),
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterData.fractions.fields.reminderChannelEmailEnabled' }));
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        reminderConfig: expect.objectContaining({
          channels: expect.objectContaining({
            push: true,
            email: true,
          }),
          email: {
            slots: [{ id: 'fraction-1:email:first', maxLeadDays: 1, defaultLeadDays: 1 }],
          },
        }),
      })
    );
  });

  it('updates slot lead-day settings for enabled channels', () => {
    const onChange = vi.fn();
    const form = createForm({
      reminderCount: 'twice',
      channels: {
        push: true,
        email: false,
        calendar: false,
      },
      push: {
        slots: [
          { id: 'slot-1', maxLeadDays: 2, defaultLeadDays: 1 },
          { id: 'slot-2', maxLeadDays: 3, defaultLeadDays: 2 },
        ],
      },
    });

    render(<FractionReminderChannelSlots channel="push" form={form} onChange={onChange} />);

    fireEvent.change(document.getElementById('waste-fraction-push-slot-1-max-lead-days') as HTMLSelectElement, {
      target: { value: '3' },
    });
    expect(onChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        reminderConfig: expect.objectContaining({
          push: {
            slots: [
              expect.objectContaining({ id: 'slot-1', maxLeadDays: 3, defaultLeadDays: 1 }),
              expect.objectContaining({ id: 'slot-2', maxLeadDays: 3, defaultLeadDays: 2 }),
            ],
          },
        }),
      })
    );

    fireEvent.change(document.getElementById('waste-fraction-push-slot-2-default-lead-days') as HTMLSelectElement, {
      target: { value: '1' },
    });
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        reminderConfig: expect.objectContaining({
          push: {
            slots: [
              expect.objectContaining({ id: 'slot-1' }),
              expect.objectContaining({ id: 'slot-2', maxLeadDays: 3, defaultLeadDays: 1 }),
            ],
          },
        }),
      })
    );
  });
});
