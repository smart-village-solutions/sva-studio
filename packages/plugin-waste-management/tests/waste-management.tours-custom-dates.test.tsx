import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToursCustomDatesField } from '../src/waste-management.tours-custom-dates.js';

vi.mock('@sva/plugin-sdk', () => ({
  usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('@tabler/icons-react', () => ({
  IconCalendarPlus: () => <span aria-hidden="true">calendar</span>,
  IconChevronLeft: () => <span aria-hidden="true">left</span>,
  IconChevronRight: () => <span aria-hidden="true">right</span>,
  IconTrash: () => <span aria-hidden="true">trash</span>,
}));

vi.mock('@sva/studio-ui-react', () => ({
  Badge: ({ children }: { readonly children: React.ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Dialog: ({
    open,
    children,
  }: {
    readonly open: boolean;
    readonly children: React.ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  StudioConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    onConfirm,
    onCancel,
  }: {
    readonly open: boolean;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
  }) =>
    open ? (
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        <button onClick={onCancel}>cancel</button>
        <button onClick={onConfirm}>{confirmLabel}</button>
      </div>
    ) : null,
  StudioField: ({ children }: { readonly children: React.ReactNode }) => <label>{children}</label>,
}));

describe('WasteToursCustomDatesField', () => {
  afterEach(() => {
    cleanup();
  });

  it('manages custom dates through the picker, comment field, and delete confirmation', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <WasteToursCustomDatesField customDates={[]} firstDate="2025-03-01" endDate="" onChange={onChange} />
    );

    expect(screen.getByText('tours.customDates.empty')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'tours.customDates.actions.openPicker' }));
    expect(screen.getByText('2025')).toBeTruthy();
    expect(
      screen.getByText('tours.customDates.meta.selectedCount:{"value":0}')
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '2026' }));
    fireEvent.click(screen.getByRole('button', { name: '2027' }));
    fireEvent.click(screen.getAllByRole('button', { name: '1' })[0]!);
    expect(onChange).toHaveBeenCalledWith([{ date: '2027-01-01' }]);

    rerender(
      <WasteToursCustomDatesField
        customDates={[
          { date: '2027-01-01', description: 'Neujahr' },
          { date: '2027-01-05' },
        ]}
        firstDate="2025-03-01"
        endDate="2028-12-31"
        onChange={onChange}
      />
    );

    expect(
      screen.getByText('tours.customDates.meta.selectedSummary:{"value":2}')
    ).toBeTruthy();
    fireEvent.change(screen.getByDisplayValue('Neujahr'), { target: { value: 'Feiertag' } });
    expect(onChange).toHaveBeenCalledWith([
      { date: '2027-01-01', description: 'Feiertag' },
      { date: '2027-01-05' },
    ]);

    fireEvent.click(screen.getAllByRole('button', { name: 'tours.customDates.actions.removeDate' })[0]!);
    expect(screen.getByText('2027-01-01')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'tours.customDates.dialog.removeConfirm' }));
    expect(onChange).toHaveBeenCalledWith([{ date: '2027-01-05' }]);
  });

  it('respects disabled state and derives the initial year from explicit custom dates', () => {
    const onChange = vi.fn();

    render(
      <WasteToursCustomDatesField
        customDates={[{ date: '2030-06-10' }]}
        firstDate="2028-01-01"
        endDate="2031-12-31"
        disabled
        onChange={onChange}
      />
    );

    expect(screen.getByRole('button', { name: 'tours.customDates.actions.openPicker' }).hasAttribute('disabled')).toBe(
      true
    );
    expect(
      screen.getByText('tours.customDates.meta.selectedSummary:{"value":1}')
    ).toBeTruthy();
    expect(screen.getByDisplayValue('').hasAttribute('disabled')).toBe(true);
  });
});
