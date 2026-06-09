import { beforeEach, describe, expect, it, vi } from 'vitest';

const createWasteManagementFractionMock = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { id: 'fraction-created' },
    syncStatus: 'queued',
    syncJob: { id: 'job-sync-1', jobTypeId: 'waste-management.sync-waste-types', status: 'queued' },
  }))
);
const updateWasteManagementFractionMock = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { id: 'fraction-updated' },
    syncStatus: 'queued',
    syncJob: { id: 'job-sync-2', jobTypeId: 'waste-management.sync-waste-types', status: 'queued' },
  }))
);

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
  beforeEach(() => {
    createWasteManagementFractionMock.mockReset();
    createWasteManagementFractionMock.mockImplementation(async () => ({
      data: { id: 'fraction-created' },
      syncStatus: 'queued',
      syncJob: { id: 'job-sync-1', jobTypeId: 'waste-management.sync-waste-types', status: 'queued' },
    }));
    updateWasteManagementFractionMock.mockReset();
    updateWasteManagementFractionMock.mockImplementation(async () => ({
      data: { id: 'fraction-updated' },
      syncStatus: 'queued',
      syncJob: { id: 'job-sync-2', jobTypeId: 'waste-management.sync-waste-types', status: 'queued' },
    }));
  });

  it('submits edit views through the update path even if dialogMode still says create', async () => {
    const ctx = {
      state: {
        dialogMode: 'create',
        fractionForm: {
          id: 'fraction-1',
          name: 'Restmüll',
          pdfShortLabel: 'RES',
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
        setTrackedSyncWasteTypesJob: vi.fn(),
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
        pdfShortLabel: 'RES',
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
    expect(ctx.state.setTrackedSyncWasteTypesJob).toHaveBeenCalledWith({
      id: 'job-sync-2',
      jobTypeId: 'waste-management.sync-waste-types',
      status: 'queued',
    });
  });

  it('downgrades sync enqueue failures to a retryable warning after a successful create', async () => {
    createWasteManagementFractionMock.mockResolvedValueOnce({
      data: { id: 'fraction-created' },
      syncStatus: 'failed',
    });
    const ctx = {
      state: {
        dialogMode: 'create',
        fractionForm: {
          id: 'fraction-2',
          name: 'Bio',
          pdfShortLabel: 'BIO',
          translations: {},
          containerSize: '',
          color: '#228833',
          description: '',
          active: true,
          reminderCount: 'none',
          firstReminderMaxLeadDays: undefined,
          secondReminderMaxLeadDays: undefined,
          reminderChannelPushEnabled: false,
          reminderChannelEmailEnabled: false,
          reminderChannelCalendarEnabled: false,
        },
        setSaving: vi.fn(),
        setMessage: vi.fn(),
        setTrackedSyncWasteTypesJob: vi.fn(),
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

    await createSubmitFractionHandler(ctx)(event, 'create');

    expect(createWasteManagementFractionMock).toHaveBeenCalledTimes(1);
    expect(ctx.state.setTrackedSyncWasteTypesJob).toHaveBeenCalledWith(null);
    expect(ctx.state.setMessage).toHaveBeenCalledWith({
      kind: 'warning',
      text: 'masterData.fractions.messages.syncWarning',
      retryAction: 'sync-waste-types',
    });
  });
});
