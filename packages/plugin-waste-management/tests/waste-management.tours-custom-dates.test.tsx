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
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

describe('WasteToursCustomDatesField', () => {
  afterEach(() => {
    cleanup();
  });

  it('manages custom dates through the picker, comment field, and delete confirmation', () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <WasteToursCustomDatesField
        customDates={[]}
        dateLocationAssignments={[]}
        locations={[
          { id: 'location-1', label: 'Musterhausen / Markt' },
          { id: 'location-2', label: 'Musterhausen / Rathaus' },
        ]}
        firstDate="2025-03-01"
        endDate=""
        onChange={onChange}
        onAssignmentsChange={vi.fn()}
      />
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
        dateLocationAssignments={[]}
        locations={[
          { id: 'location-1', label: 'Musterhausen / Markt' },
          { id: 'location-2', label: 'Musterhausen / Rathaus' },
        ]}
        firstDate="2025-03-01"
        endDate="2028-12-31"
        onChange={onChange}
        onAssignmentsChange={vi.fn()}
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

    expect(screen.getAllByText('tours.customDates.assignmentSection.summaryEmpty')).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'tours.customDates.actions.removeDate' })[0]!);
    expect(screen.getByText('2027-01-01')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'tours.customDates.dialog.removeConfirm' }));
    expect(onChange).toHaveBeenCalledWith([{ date: '2027-01-05' }]);
  }, 10_000);

  it('respects disabled state and derives the initial year from explicit custom dates', () => {
    const onChange = vi.fn();

    render(
      <WasteToursCustomDatesField
        customDates={[{ date: '2030-06-10' }]}
        dateLocationAssignments={[]}
        locations={[{ id: 'location-1', label: 'Musterhausen / Markt' }]}
        firstDate="2028-01-01"
        endDate="2031-12-31"
        disabled
        onChange={onChange}
        onAssignmentsChange={vi.fn()}
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

  it('manages location assignments per date and blocks duplicates for the same date', () => {
    const onAssignmentsChange = vi.fn();

    const { rerender } = render(
      <WasteToursCustomDatesField
        customDates={[{ date: '2027-01-01' }]}
        dateLocationAssignments={[]}
        locations={[
          { id: 'location-1', label: 'Musterhausen / Markt' },
          { id: 'location-2', label: 'Musterhausen / Rathaus' },
        ]}
        firstDate="2027-01-01"
        endDate=""
        onChange={vi.fn()}
        onAssignmentsChange={onAssignmentsChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'tours.customDates.actions.editAssignments' }));
    fireEvent.click(screen.getByRole('button', { name: 'tours.customDates.actions.addAssignment' }));
    expect(onAssignmentsChange).toHaveBeenCalledWith([
      {
        id: expect.any(String),
        pickupDate: '2027-01-01',
        locationId: '',
        note: '',
      },
    ]);

    rerender(
      <WasteToursCustomDatesField
        customDates={[{ date: '2027-01-01' }]}
        dateLocationAssignments={[
          {
            id: 'assignment-1',
            pickupDate: '2027-01-01',
            locationId: '',
            note: '',
          },
        ]}
        locations={[
          { id: 'location-1', label: 'Musterhausen / Markt' },
          { id: 'location-2', label: 'Musterhausen / Rathaus' },
        ]}
        firstDate="2027-01-01"
        endDate=""
        onChange={vi.fn()}
        onAssignmentsChange={onAssignmentsChange}
      />
    );

    expect(screen.getByText('tours.customDates.assignmentSection.summaryCount:{"value":1}')).toBeTruthy();
    fireEvent.focus(screen.getByLabelText('tours.customDates.fields.location'));
    fireEvent.change(screen.getByLabelText('tours.customDates.fields.location'), { target: { value: 'Markt' } });
    fireEvent.click(screen.getByRole('option', { name: 'Musterhausen / Markt' }));
    expect(onAssignmentsChange).toHaveBeenCalledWith([
      {
        id: 'assignment-1',
        pickupDate: '2027-01-01',
        locationId: 'location-1',
        note: '',
      },
    ]);

    rerender(
      <WasteToursCustomDatesField
        customDates={[{ date: '2027-01-01' }]}
        dateLocationAssignments={[
          {
            id: 'assignment-1',
            pickupDate: '2027-01-01',
            locationId: 'location-1',
            note: '',
          },
        ]}
        locations={[
          { id: 'location-1', label: 'Musterhausen / Markt' },
          { id: 'location-2', label: 'Musterhausen / Rathaus' },
        ]}
        firstDate="2027-01-01"
        endDate=""
        onChange={vi.fn()}
        onAssignmentsChange={onAssignmentsChange}
      />
    );

    fireEvent.change(screen.getByLabelText('tours.customDates.fields.note'), { target: { value: '14:00 bis 15:00 Uhr' } });
    expect(onAssignmentsChange).toHaveBeenCalledWith([
      {
        id: 'assignment-1',
        pickupDate: '2027-01-01',
        locationId: 'location-1',
        note: '14:00 bis 15:00 Uhr',
      },
    ]);

    rerender(
      <WasteToursCustomDatesField
        customDates={[{ date: '2027-01-01' }]}
        dateLocationAssignments={[
          {
            id: 'assignment-1',
            pickupDate: '2027-01-01',
            locationId: 'location-1',
            note: '14:00 bis 15:00 Uhr',
          },
          {
            id: 'assignment-2',
            pickupDate: '2027-01-01',
            locationId: '',
            note: '',
          },
        ]}
        locations={[
          { id: 'location-1', label: 'Musterhausen / Markt' },
          { id: 'location-2', label: 'Musterhausen / Rathaus' },
        ]}
        firstDate="2027-01-01"
        endDate=""
        onChange={vi.fn()}
        onAssignmentsChange={onAssignmentsChange}
      />
    );

    fireEvent.focus(screen.getAllByLabelText('tours.customDates.fields.location')[0]!);
    fireEvent.change(screen.getAllByLabelText('tours.customDates.fields.location')[0]!, {
      target: { value: 'Markt' },
    });
    fireEvent.click(screen.getByRole('option', { name: 'Musterhausen / Markt' }));
    expect(screen.getByText('tours.customDates.messages.duplicateLocation')).toBeTruthy();
  });
});
