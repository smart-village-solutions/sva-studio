import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToursValidityDialog } from '../src/waste-management.tours-validity-dialog.js';

vi.mock('@sva/plugin-sdk', async () => {
  const actual = await vi.importActual<typeof import('@sva/plugin-sdk')>('@sva/plugin-sdk');
  return {
    ...actual,
    usePluginTranslation: () => (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join('|')}` : key,
  };
});

vi.mock('@sva/studio-ui-react', () => ({
  Button: (props: React.ComponentProps<'button'>) => <button {...props} />,
  Dialog: ({ open, children }: { readonly open: boolean; readonly children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
  Select: (props: React.ComponentProps<'select'>) => <select {...props} />,
  StudioField: ({
    id,
    label,
    children,
  }: {
    readonly id: string;
    readonly label: string;
    readonly children: React.ReactNode;
  }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  ),
  StudioFieldGroup: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

const createTour = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'tour-1',
    name: 'Restmüll Nord',
    wasteFractionIds: [],
    recurrence: 'weekly',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as never;

describe('WasteToursValidityDialog', () => {
  afterEach(() => cleanup());

  it('submits explicit set and clear operations for every selected tour', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(
      <WasteToursValidityDialog
        open
        tours={[createTour(), createTour({ id: 'tour-2', name: 'Bio Süd' })]}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('tours.bulkValidityDialog.fields.firstMode'), {
      target: { value: 'set' },
    });
    fireEvent.change(screen.getByLabelText('tours.bulkValidityDialog.fields.firstDate'), {
      target: { value: '2027-01-01' },
    });
    fireEvent.change(screen.getByLabelText('tours.bulkValidityDialog.fields.endMode'), {
      target: { value: 'clear' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tours.bulkValidityDialog.apply' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        tourIds: ['tour-1', 'tour-2'],
        firstDate: { mode: 'set', value: '2027-01-01' },
        endDate: { mode: 'clear' },
      })
    );
  });

  it('blocks the action and names tours without an applicable recurrence', () => {
    render(
      <WasteToursValidityDialog
        open
        tours={[createTour({ recurrence: 'on-demand', name: 'Schadstoffmobil' })]}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('alert').textContent).toContain('Schadstoffmobil');
    expect(
      (screen.getByRole('button', {
        name: 'tours.bulkValidityDialog.apply',
      }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('rejects a resulting validity range whose end precedes its start', () => {
    render(
      <WasteToursValidityDialog
        open
        tours={[createTour({ firstDate: '2027-02-01' })]}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('tours.bulkValidityDialog.fields.endMode'), {
      target: { value: 'set' },
    });
    fireEvent.change(screen.getByLabelText('tours.bulkValidityDialog.fields.endDate'), {
      target: { value: '2027-01-31' },
    });

    expect(screen.getByRole('alert').textContent).toBe('tours.bulkValidityDialog.invalidRange');
    expect(
      (screen.getByRole('button', {
        name: 'tours.bulkValidityDialog.apply',
      }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
});
