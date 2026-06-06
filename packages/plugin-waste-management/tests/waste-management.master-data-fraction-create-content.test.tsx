import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteMasterDataFractionCreateContent } from '../src/waste-management.master-data-fraction-create-content.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
  wasteManagementMasterDataContract: {
    fractionReminderLeadDayMin: 1,
    fractionReminderLeadDayMax: 14,
  },
}));

vi.mock('@sva/studio-ui-react', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => <button {...props}>{children}</button>,
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioField: ({
    children,
    label,
    description,
  }: {
    readonly children: React.ReactNode;
    readonly label: React.ReactNode;
    readonly description?: React.ReactNode;
  }) => (
    <label>
      <span>{label}</span>
      {children}
      {description}
    </label>
  ),
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  StudioPageHeader: ({
    title,
    description,
    actions,
  }: {
    readonly title: React.ReactNode;
    readonly description: React.ReactNode;
    readonly actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{actions}</div>
    </header>
  ),
  Textarea: (props: React.ComponentProps<'textarea'>) => <textarea {...props} />,
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

describe('WasteMasterDataFractionCreateContent', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the fourth reminder block and wires reminder changes through the controlled form state', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    const { rerender } = render(
      <WasteMasterDataFractionCreateContent
        mode="create"
        form={{
          id: 'fraction-1',
          name: 'Biotonne',
          translations: {},
          containerSize: '',
          color: '#16A34A',
          description: '',
          active: true,
          reminderCount: 'none',
          firstReminderMaxLeadDays: 1,
          secondReminderMaxLeadDays: 1,
          reminderChannelPushEnabled: false,
          reminderChannelEmailEnabled: false,
          reminderChannelCalendarEnabled: false,
        }}
        saving={false}
        onChange={onChange}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('masterData.fractions.createView.sections.reminders')).toBeTruthy();
    expect(screen.queryByLabelText('masterData.fractions.fields.secondReminderMaxLeadDays')).toBeNull();
    expect(
      screen.getByRole('switch', { name: 'masterData.fractions.fields.reminderChannelPushEnabled' }).hasAttribute('disabled')
    ).toBe(true);

    const reminderCountSelect = document.getElementById('waste-fraction-reminder-count');
    expect(reminderCountSelect).toBeTruthy();
    if (!(reminderCountSelect instanceof HTMLSelectElement)) {
      throw new Error('missing reminder count select');
    }

    fireEvent.change(reminderCountSelect, {
      target: { value: 'twice' },
    });

    expect(onChange).toHaveBeenCalledWith({
      reminderCount: 'twice',
      firstReminderMaxLeadDays: 1,
      secondReminderMaxLeadDays: 1,
      reminderChannelPushEnabled: false,
      reminderChannelEmailEnabled: false,
      reminderChannelCalendarEnabled: false,
    });

    rerender(
      <WasteMasterDataFractionCreateContent
        mode="edit"
        form={{
          id: 'fraction-1',
          name: 'Biotonne',
          translations: {},
          containerSize: '',
          color: '#16A34A',
          description: '',
          active: true,
          reminderCount: 'twice',
          firstReminderMaxLeadDays: 7,
          secondReminderMaxLeadDays: 2,
          reminderChannelPushEnabled: false,
          reminderChannelEmailEnabled: true,
          reminderChannelCalendarEnabled: false,
        }}
        saving={false}
        onChange={onChange}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const secondReminderSelect = document.getElementById('waste-fraction-second-reminder-max-lead-days');
    expect(secondReminderSelect).toBeTruthy();
    if (!(secondReminderSelect instanceof HTMLSelectElement)) {
      throw new Error('missing second reminder select');
    }

    fireEvent.change(secondReminderSelect, {
      target: { value: '14' },
    });
    expect(onChange).toHaveBeenCalledWith({ secondReminderMaxLeadDays: 14 });

    fireEvent.click(screen.getByRole('switch', { name: 'masterData.fractions.fields.reminderChannelPushEnabled' }));
    expect(onChange).toHaveBeenCalledWith({ reminderChannelPushEnabled: true });

    fireEvent.submit(document.getElementById('waste-fraction-create-form') as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
