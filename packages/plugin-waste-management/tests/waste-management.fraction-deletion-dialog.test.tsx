import React, { createRef } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  WasteFractionDeleteInput,
  WasteFractionDeletePreview,
  WasteFractionRecord,
} from '@sva/waste-management-contracts';
import { WasteMasterDataFractionDeleteDialog } from '../src/waste-management.master-data-fraction-delete-dialogs.js';

const api = vi.hoisted(() => ({ previewWasteManagementFractionDeletion: vi.fn() }));
vi.mock('../src/waste-management.api.master-data-addresses.fractions.js', () => api);
vi.mock('@sva/plugin-sdk', () => ({ usePluginTranslation: () => (key: string) => key }));
const fraction: WasteFractionRecord = {
  id: 'source',
  name: 'Bio',
  color: '#000000',
  active: true,
  reminderConfig: {
    reminderCount: 'none',
    channels: { email: false, push: false, calendar: false },
  },
  createdAt: '',
  updatedAt: '',
};
const result = (
  input: WasteFractionDeleteInput,
  extra: Partial<WasteFractionDeletePreview> = {}
): WasteFractionDeletePreview => ({
  input,
  token: 'a'.repeat(64),
  canDetach: true,
  targets: [{ id: 'target', name: 'Rest' }],
  tours: [{ id: 'tour', name: 'Tour', status: 'published', otherFractions: ['Papier'] }],
  counts: {
    links: 1,
    pickupDates: 2,
    assignments: 3,
    shifts: 4,
    reminderItems: 0,
    pendingReminders: 0,
  },
  conflicts: [],
  blockedReason: input.mode === 'replace' && !input.targetFractionId ? 'invalid-target' : null,
  ...extra,
});
const show = (onConfirm = vi.fn(async () => undefined)) => {
  const onCancel = vi.fn();
  render(
    <WasteMasterDataFractionDeleteDialog
      fractionPendingDelete={fraction}
      fallbackFocusRef={createRef<HTMLElement>()}
      onOpenDeleteFraction={onConfirm}
      onCancel={onCancel}
    />
  );
  return { onConfirm, onCancel };
};
const key = (suffix: string) => `masterData.fractions.deleteOptions.${suffix}`;
describe('fraction deletion dialog', () => {
  afterEach(cleanup);
  beforeEach(() => {
    api.previewWasteManagementFractionDeletion.mockReset();
    api.previewWasteManagementFractionDeletion.mockImplementation(async (input) => result(input));
  });
  it('requires explicit selection, hides detach if a tour would become empty, and previews deletion of shared tours', async () => {
    api.previewWasteManagementFractionDeletion.mockImplementation(async (input) =>
      result(input, {
        canDetach: false,
        blockedReason: input.mode === 'detach' ? 'empty-tour' : null,
      })
    );
    const { onConfirm } = show();
    await screen.findByText(key('shared'));
    expect(screen.queryByRole('option', { name: key('detach') })).toBeNull();
    expect(
      (
        screen.getByRole('button', {
          name: 'masterData.fractions.deleteDialog.confirm',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    fireEvent.change(screen.getByRole('combobox', { name: key('mode') }), {
      target: { value: 'delete-tours' },
    });
    await screen.findByText(key('removeDates'));
    const confirm = screen.getByRole('button', { name: key('confirm.delete-tours') });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith(fraction, {
        mode: 'delete-tours',
        confirmationToken: 'a'.repeat(64),
      })
    );
  });
  it('requires target selection and blocks collision results', async () => {
    api.previewWasteManagementFractionDeletion.mockImplementation(async (input) =>
      result(
        input,
        input.targetFractionId
          ? {
              blockedReason: 'date-conflict',
              conflicts: [
                { tourIds: ['tour', 'other'], locationId: 'place', pickupDate: '2030-01-01' },
              ],
            }
          : {}
      )
    );
    const { onConfirm } = show();
    await screen.findByText(key('shared'));
    fireEvent.change(screen.getByRole('combobox', { name: key('mode') }), {
      target: { value: 'replace' },
    });
    await screen.findByRole('option', { name: 'Rest' });
    expect(
      (screen.getByRole('button', { name: key('confirm.replace') }) as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.change(screen.getByRole('combobox', { name: key('target') }), {
      target: { value: 'target' },
    });
    await screen.findByText(key('blocked.date-conflict'));
    expect(
      (screen.getByRole('button', { name: key('confirm.replace') }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('invalidates failed confirmation and requires a refreshed preview', async () => {
    const onConfirm = vi.fn(async () => {
      throw new Error('stale');
    });
    show(onConfirm);
    await screen.findByText(key('shared'));
    fireEvent.change(screen.getByRole('combobox', { name: key('mode') }), {
      target: { value: 'detach' },
    });
    const confirm = screen.getByRole('button', { name: key('confirm.detach') });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(confirm);
    await screen.findByText(key('executeError'));
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: key('refresh') }));
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
  it('forwards the selected replacement and the latest preview token', async () => {
    const { onConfirm } = show();
    await screen.findByText(key('shared'));
    fireEvent.change(screen.getByRole('combobox', { name: key('mode') }), {
      target: { value: 'replace' },
    });
    await screen.findByRole('option', { name: 'Rest' });
    fireEvent.change(screen.getByRole('combobox', { name: key('target') }), {
      target: { value: 'target' },
    });
    const confirm = screen.getByRole('button', { name: key('confirm.replace') });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith(fraction, {
        mode: 'replace',
        targetFractionId: 'target',
        confirmationToken: 'a'.repeat(64),
      })
    );
  });
  it('returns keyboard focus to the trigger after cancellation', async () => {
    const Harness = () => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <WasteMasterDataFractionDeleteDialog
            fractionPendingDelete={open ? fraction : null}
            fallbackFocusRef={createRef<HTMLElement>()}
            onOpenDeleteFraction={vi.fn()}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    };
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('alertdialog');
    const cancel = screen.getByRole('button', { name: 'masterData.fractions.deleteDialog.cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it('allows simple deletion without tour choices when unused', async () => {
    api.previewWasteManagementFractionDeletion.mockImplementation(async (input) =>
      result(input, { tours: [] })
    );
    const { onConfirm } = show();
    const confirm = await screen.findByRole('button', { name: key('confirm.detach') });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole('combobox', { name: key('mode') })).toBeNull();
    fireEvent.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });
});
