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
          pdfShortLabel: 'BIO',
          translations: {},
          containerSize: '',
          color: '#16A34A',
          description: '',
          active: true,
          reminderConfig: {
            reminderCount: 'none',
            channels: { push: false, email: false, calendar: false },
          },
        }}
        saving={false}
        onChange={onChange}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('masterData.fractions.createView.sections.reminders')).toBeTruthy();
    expect(document.getElementById('waste-fraction-push-slot-1-max-lead-days')).toBeNull();
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
      reminderConfig: {
        reminderCount: 'twice',
        channels: { push: false, email: false, calendar: false },
      },
    });

    rerender(
      <WasteMasterDataFractionCreateContent
        mode="edit"
        form={{
          id: 'fraction-1',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          translations: {},
          containerSize: '',
          color: '#16A34A',
          description: '',
          active: true,
          reminderConfig: {
            reminderCount: 'twice',
            channels: { push: false, email: true, calendar: false },
            email: {
              slots: [
                { id: 'fraction-1:email:first', maxLeadDays: 7, defaultLeadDays: 1 },
                { id: 'fraction-1:email:second', maxLeadDays: 2, defaultLeadDays: 1 },
              ],
            },
          },
        }}
        saving={false}
        onChange={onChange}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(document.getElementById('waste-fraction-push-slot-1-max-lead-days')).toBeNull();
    expect(document.getElementById('waste-fraction-email-slot-1-max-lead-days')).toBeTruthy();

    fireEvent.click(screen.getByRole('switch', { name: 'masterData.fractions.fields.reminderChannelPushEnabled' }));
    expect(onChange).toHaveBeenCalledWith({
      reminderConfig: {
        reminderCount: 'twice',
        channels: { push: true, email: true, calendar: false },
        push: {
          slots: [
            { id: 'fraction-1:push:first', maxLeadDays: 1, defaultLeadDays: 1 },
            { id: 'fraction-1:push:second', maxLeadDays: 1, defaultLeadDays: 1 },
          ],
        },
        email: {
          slots: [
            { id: 'fraction-1:email:first', maxLeadDays: 7, defaultLeadDays: 1 },
            { id: 'fraction-1:email:second', maxLeadDays: 2, defaultLeadDays: 1 },
          ],
        },
      },
    });

    rerender(
      <WasteMasterDataFractionCreateContent
        mode="edit"
        form={{
          id: 'fraction-1',
          name: 'Biotonne',
          pdfShortLabel: 'BIO',
          translations: {},
          containerSize: '',
          color: '#16A34A',
          description: '',
          active: true,
          reminderConfig: {
            reminderCount: 'twice',
            channels: { push: true, email: true, calendar: false },
            push: {
              slots: [
                { id: 'fraction-1:push:first', maxLeadDays: 7, defaultLeadDays: 1 },
                { id: 'fraction-1:push:second', maxLeadDays: 2, defaultLeadDays: 1 },
              ],
            },
            email: {
              slots: [
                { id: 'fraction-1:email:first', maxLeadDays: 7, defaultLeadDays: 1 },
                { id: 'fraction-1:email:second', maxLeadDays: 2, defaultLeadDays: 1 },
              ],
            },
          },
        }}
        saving={false}
        onChange={onChange}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const secondReminderSelect = document.getElementById('waste-fraction-push-slot-2-max-lead-days');
    expect(secondReminderSelect).toBeTruthy();
    if (!(secondReminderSelect instanceof HTMLSelectElement)) {
      throw new Error('missing second reminder select');
    }

    fireEvent.change(secondReminderSelect, {
      target: { value: '14' },
    });
    expect(onChange).toHaveBeenCalledWith({
      reminderConfig: {
        reminderCount: 'twice',
        channels: { push: true, email: true, calendar: false },
        push: {
          slots: [
            { id: 'fraction-1:push:first', maxLeadDays: 7, defaultLeadDays: 1 },
            { id: 'fraction-1:push:second', maxLeadDays: 14, defaultLeadDays: 1 },
          ],
        },
        email: {
          slots: [
            { id: 'fraction-1:email:first', maxLeadDays: 7, defaultLeadDays: 1 },
            { id: 'fraction-1:email:second', maxLeadDays: 2, defaultLeadDays: 1 },
          ],
        },
      },
    });

    const secondReminderDefaultSelect = document.getElementById('waste-fraction-push-slot-2-default-lead-days');
    expect(secondReminderDefaultSelect).toBeTruthy();
    if (!(secondReminderDefaultSelect instanceof HTMLSelectElement)) {
      throw new Error('missing second reminder default select');
    }

    fireEvent.change(secondReminderDefaultSelect, {
      target: { value: '14' },
    });
    expect(onChange).toHaveBeenCalledWith({
      reminderConfig: {
        reminderCount: 'twice',
        channels: { push: true, email: true, calendar: false },
        push: {
          slots: [
            { id: 'fraction-1:push:first', maxLeadDays: 7, defaultLeadDays: 1 },
            { id: 'fraction-1:push:second', maxLeadDays: 2, defaultLeadDays: 2 },
          ],
        },
        email: {
          slots: [
            { id: 'fraction-1:email:first', maxLeadDays: 7, defaultLeadDays: 1 },
            { id: 'fraction-1:email:second', maxLeadDays: 2, defaultLeadDays: 1 },
          ],
        },
      },
    });

    fireEvent.submit(document.getElementById('waste-fraction-create-form') as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
