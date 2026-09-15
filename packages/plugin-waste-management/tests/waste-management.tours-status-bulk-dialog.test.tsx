import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WasteToursStatusBulkDialog } from '../src/waste-management.tours-status-bulk-dialog.js';

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
}));

describe('WasteToursStatusBulkDialog', () => {
  afterEach(() => cleanup());

  it('requires an explicit target status and submits every selected ID', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onUpdated = vi.fn();
    render(
      <WasteToursStatusBulkDialog
        open
        selectedTourIds={['tour-1', 'tour-2']}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onUpdated={onUpdated}
      />
    );

    const submit = screen.getByRole('button', { name: 'tours.bulkStatusDialog.apply' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('tours.bulkStatusDialog.targetLabel'), {
      target: { value: 'archived' },
    });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        tourIds: ['tour-1', 'tour-2'],
        status: 'archived',
      })
    );
    expect(onUpdated).toHaveBeenCalledOnce();
  });

  it('keeps the dialog open and reports a failed update', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const onUpdated = vi.fn();
    render(
      <WasteToursStatusBulkDialog
        open
        selectedTourIds={['tour-1']}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onUpdated={onUpdated}
      />
    );

    fireEvent.change(screen.getByLabelText('tours.bulkStatusDialog.targetLabel'), {
      target: { value: 'published' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'tours.bulkStatusDialog.apply' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'tours.bulkStatusDialog.error'
    );
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('closes without submitting when the operation is cancelled', () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    render(
      <WasteToursStatusBulkDialog
        open
        selectedTourIds={['tour-1']}
        saving={false}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onUpdated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'tours.bulkStatusDialog.cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a selection above the shared bulk limit before submission', () => {
    const onSubmit = vi.fn();
    render(
      <WasteToursStatusBulkDialog
        open
        selectedTourIds={Array.from({ length: 1_001 }, (_, index) => `tour-${index + 1}`)}
        saving={false}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onUpdated={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('tours.bulkStatusDialog.targetLabel'), {
      target: { value: 'draft' },
    });

    expect(screen.getByRole('alert').textContent).toContain('tours.bulkStatusDialog.tooMany:1000');
    expect(
      (screen.getByRole('button', { name: 'tours.bulkStatusDialog.apply' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
