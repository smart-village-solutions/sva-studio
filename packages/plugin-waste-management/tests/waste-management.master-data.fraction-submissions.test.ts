import { describe, expect, it, vi } from 'vitest';

const createWasteManagementFractionMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateWasteManagementFractionMock = vi.hoisted(() => vi.fn(async () => undefined));

import { createSubmitFractionHandler } from '../src/waste-management.master-data.fraction-region-submissions.helpers.js';

vi.mock('../src/waste-management.api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/waste-management.api.js')>();
  return {
    ...actual,
    createWasteManagementFraction: createWasteManagementFractionMock,
    updateWasteManagementFraction: updateWasteManagementFractionMock,
  };
});

describe('createSubmitFractionHandler', () => {
  it('submits edit views through the update path even if dialogMode still says create', async () => {
    const ctx = {
      state: {
        dialogMode: 'create',
        fractionForm: {
          id: 'fraction-1',
          name: 'Restmüll',
          pdfShortLabel: '',
          translations: {},
          containerSize: '120L',
          color: '#111111',
          description: '',
          active: true,
          reminderCount: 'twice',
          firstReminderMaxLeadDays: 7,
          secondReminderMaxLeadDays: 2,
          reminderChannelPushEnabled: true,
          reminderChannelEmailEnabled: false,
          reminderChannelCalendarEnabled: true,
        },
        setSaving: vi.fn(),
        setMessage: vi.fn(),
        setLastOutcome: vi.fn(),
        setDialogOpen: vi.fn(),
      },
      pt: (key: string) => key,
      loadOverview: vi.fn(async () => undefined),
    } as never;

    const form = document.createElement('form');
    const event = {
      preventDefault: vi.fn(),
      currentTarget: form,
    } as unknown as React.FormEvent<HTMLFormElement>;

    await createSubmitFractionHandler(ctx)(event, 'edit');

    expect(updateWasteManagementFractionMock).toHaveBeenCalledWith(
      'fraction-1',
      expect.objectContaining({
        name: 'Restmüll',
        containerSize: '120L',
        color: '#111111',
        active: true,
        reminderCount: 'twice',
        firstReminderMaxLeadDays: 7,
        secondReminderMaxLeadDays: 2,
        reminderChannelPushEnabled: true,
        reminderChannelEmailEnabled: false,
        reminderChannelCalendarEnabled: true,
      })
    );
    expect(createWasteManagementFractionMock).not.toHaveBeenCalled();
    expect(ctx.loadOverview).toHaveBeenCalledWith(true);
    expect(ctx.state.setLastOutcome).toHaveBeenCalledWith('fraction-update-success');
  });
});
