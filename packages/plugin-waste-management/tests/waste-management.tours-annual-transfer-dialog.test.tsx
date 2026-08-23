import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../src/waste-management.api.js', () => ({
  previewWasteAnnualTourTransfer: api.preview,
  createWasteAnnualTourTransfer: api.create,
}));

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
  Checkbox: (props: React.ComponentProps<'input'>) => <input type="checkbox" {...props} />,
  Dialog: ({ open, children }: { readonly open: boolean; readonly children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
  Input: (props: React.ComponentProps<'input'>) => <input {...props} />,
}));

import { WasteToursAnnualTransferDialog } from '../src/waste-management.tours-annual-transfer-dialog.js';

const preview = {
  sourceYear: 2026,
  targetYear: 2027,
  previewFingerprint: `sha256:${'a'.repeat(64)}`,
  tours: [
    {
      sourceTourId: 'tour-1',
      name: 'Bio Nord',
      classification: 'transferable',
      sourcePeriod: { firstDate: '2026-01-05', endDate: '2026-12-31' },
      targetPeriod: { firstDate: '2027-01-04', endDate: '2027-12-31' },
      firstTargetDate: '2027-01-04',
      recurrence: 'weekly',
      relationshipCounts: {
        wasteFractions: 1,
        locations: 2,
        pickupDates: 0,
        assignments: 0,
        shifts: 0,
        excluded: 0,
      },
      replacementResourceIds: [],
      conflicts: [],
    },
  ],
  summary: {
    transferable: 1,
    alreadyEffective: 0,
    blocked: 0,
    selected: 1,
    relationships: 2,
    excluded: 0,
  },
} as const;

describe('WasteToursAnnualTransferDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.preview.mockResolvedValue(preview);
    api.create.mockResolvedValue({
      sourceYear: 2026,
      targetYear: 2027,
      createdTourIds: ['target-1'],
      existingTourIds: [],
      createdCount: 1,
      existingCount: 0,
      classificationCounts: { transferable: 1, alreadyEffective: 0, blocked: 0 },
      listTarget: { tourValidityPeriod: 'next', status: 'inactive' },
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the fixed following year and creates the confirmed selection as inactive', async () => {
    const onCreated = vi.fn(async () => undefined);
    render(
      <WasteToursAnnualTransferDialog
        open
        onOpenChange={vi.fn()}
        onCreated={onCreated}
        onShowResult={vi.fn()}
      />
    );

    expect(screen.getByText('tours.annualTransfer.targetYear:2027')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'tours.annualTransfer.loadPreview' }));
    await screen.findByText('Bio Nord');
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'tours.annualTransfer.selectTour:Bio Nord',
        }) as HTMLInputElement
      ).checked
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'tours.annualTransfer.review' }));
    fireEvent.click(await screen.findByRole('button', { name: 'tours.annualTransfer.confirm' }));

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.preview).toHaveBeenNthCalledWith(2, {
      sourceYear: 2026,
      selectedTourIds: ['tour-1'],
      replacementDates: [],
    });
    expect(api.create).toHaveBeenCalledWith(
      {
        sourceYear: 2026,
        selectedTourIds: ['tour-1'],
        replacementDates: [],
        acknowledgedConflictTourIds: [],
        previewFingerprint: preview.previewFingerprint,
      },
      expect.any(String)
    );
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect((await screen.findByRole('status')).textContent).toContain(
      'tours.annualTransfer.result:1|2027'
    );
  });

  it('keeps conflicted tours unselected until the user selects and acknowledges them', async () => {
    api.preview.mockResolvedValueOnce({
      ...preview,
      tours: [
        {
          ...preview.tours[0],
          conflicts: [
            {
              kind: 'possible-parallel-planning',
              sourceTourId: 'tour-1',
              targetTourId: 'target-existing',
              matchingFeatures: ['date'],
            },
          ],
        },
      ],
      summary: { ...preview.summary, selected: 0 },
    });
    render(
      <WasteToursAnnualTransferDialog
        open
        onOpenChange={vi.fn()}
        onCreated={vi.fn(async () => undefined)}
        onShowResult={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'tours.annualTransfer.loadPreview' }));
    const tourSelection = await screen.findByRole('checkbox', {
      name: 'tours.annualTransfer.selectTour:Bio Nord',
    });
    expect((tourSelection as HTMLInputElement).checked).toBe(false);
    fireEvent.click(tourSelection);
    const acknowledgement = screen.getByText('tours.annualTransfer.acknowledgeConflict:Bio Nord');
    const reviewButton = screen.getByRole('button', { name: 'tours.annualTransfer.review' });
    expect((reviewButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(acknowledgement);
    expect((reviewButton as HTMLButtonElement).disabled).toBe(false);
  });
});
