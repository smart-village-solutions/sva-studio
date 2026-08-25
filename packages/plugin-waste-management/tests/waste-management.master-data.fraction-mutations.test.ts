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
const deleteWasteManagementFractionMock = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { id: 'fraction-deleted' },
    syncStatus: 'queued' as const,
    syncJob: { id: 'job-sync-3', jobTypeId: 'waste-management.sync-waste-types', status: 'queued' },
  }))
);

import {
  createDeleteFractionHandler,
  createDeleteFractionsHandler,
  createFractionMutationHandler,
} from '../src/waste-management.master-data.fraction-region-mutations.helpers.js';

vi.mock('../src/waste-management.api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/waste-management.api.js')>();
  return {
    ...actual,
    createWasteManagementFraction: createWasteManagementFractionMock,
    updateWasteManagementFraction: updateWasteManagementFractionMock,
    deleteWasteManagementFraction: deleteWasteManagementFractionMock,
  };
});

describe('createFractionMutationHandler', () => {
  beforeEach(() => {
    createWasteManagementFractionMock.mockReset();
    createWasteManagementFractionMock.mockImplementation(async () => ({
      data: { id: 'fraction-created' },
      syncStatus: 'queued',
      syncJob: {
        id: 'job-sync-1',
        jobTypeId: 'waste-management.sync-waste-types',
        status: 'queued',
      },
    }));
    updateWasteManagementFractionMock.mockReset();
    updateWasteManagementFractionMock.mockImplementation(async () => ({
      data: { id: 'fraction-updated' },
      syncStatus: 'queued',
      syncJob: {
        id: 'job-sync-2',
        jobTypeId: 'waste-management.sync-waste-types',
        status: 'queued',
      },
    }));
    deleteWasteManagementFractionMock.mockClear();
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
          reminderConfig: {
            reminderCount: 'twice',
            channels: { push: true, email: false, calendar: true },
            push: {
              slots: [
                { id: 'fraction-1:push:first', maxLeadDays: 7, defaultLeadDays: 1 },
                { id: 'fraction-1:push:second', maxLeadDays: 2, defaultLeadDays: 1 },
              ],
            },
            calendar: {
              slots: [
                { id: 'fraction-1:calendar:first', maxLeadDays: 7, defaultLeadDays: 1 },
                { id: 'fraction-1:calendar:second', maxLeadDays: 2, defaultLeadDays: 1 },
              ],
            },
          },
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

    await createFractionMutationHandler(ctx)(event, 'edit');

    expect(updateWasteManagementFractionMock).toHaveBeenCalledWith(
      'fraction-1',
      expect.objectContaining({
        name: 'Restmüll',
        pdfShortLabel: 'RES',
        containerSize: '120L',
        color: '#111111',
        active: true,
        reminderConfig: {
          reminderCount: 'twice',
          channels: { push: true, email: false, calendar: true },
          push: {
            slots: [
              { id: 'fraction-1:push:first', maxLeadDays: 7, defaultLeadDays: 1 },
              { id: 'fraction-1:push:second', maxLeadDays: 2, defaultLeadDays: 1 },
            ],
          },
          calendar: {
            slots: [
              { id: 'fraction-1:calendar:first', maxLeadDays: 7, defaultLeadDays: 1 },
              { id: 'fraction-1:calendar:second', maxLeadDays: 2, defaultLeadDays: 1 },
            ],
          },
        },
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
          reminderConfig: {
            reminderCount: 'none',
            channels: { push: false, email: false, calendar: false },
          },
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

    await createFractionMutationHandler(ctx)(event, 'create');

    expect(createWasteManagementFractionMock).toHaveBeenCalledTimes(1);
    expect(ctx.state.setTrackedSyncWasteTypesJob).toHaveBeenCalledWith(null);
    expect(ctx.state.setMessage).toHaveBeenCalledWith({
      kind: 'warning',
      text: 'masterData.fractions.messages.syncWarning',
      retryAction: 'sync-waste-types',
    });
  });

  it('resolves with a warning when refresh fails after a successful fraction deletion', async () => {
    const ctx = {
      state: {
        setSaving: vi.fn(),
        setMessage: vi.fn(),
        setTrackedSyncWasteTypesJob: vi.fn(),
        setLastOutcome: vi.fn(),
      },
      pt: (key: string) => key,
      loadOverview: vi.fn(async () => Promise.reject(new Error('refresh'))),
      loadCollectionLocationList: vi.fn(),
    } as never;

    await expect(createDeleteFractionHandler(ctx)('fraction-1')).resolves.toBeUndefined();

    expect(deleteWasteManagementFractionMock).toHaveBeenCalledWith('fraction-1');
    expect(ctx.state.setMessage).toHaveBeenLastCalledWith({
      kind: 'warning',
      text: 'masterData.fractions.messages.refreshAfterDeleteError',
    });
    expect(ctx.state.setSaving).toHaveBeenLastCalledWith(false);
  });

  it('does not turn a bulk fraction refresh failure into a deletion failure', async () => {
    const ctx = {
      state: {
        setSaving: vi.fn(),
        setMessage: vi.fn(),
        setTrackedSyncWasteTypesJob: vi.fn(),
        setLastOutcome: vi.fn(),
      },
      pt: (key: string) => key,
      loadOverview: vi.fn(async () => Promise.reject(new Error('refresh'))),
      loadCollectionLocationList: vi.fn(),
    } as never;

    await expect(createDeleteFractionsHandler(ctx)(['fraction-1'])).resolves.toBeUndefined();

    expect(ctx.state.setMessage).toHaveBeenLastCalledWith({
      kind: 'warning',
      text: 'masterData.fractions.messages.refreshAfterDeleteError',
    });
  });
});
