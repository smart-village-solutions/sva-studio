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
import { showWasteAnnualTransferResult } from '../src/waste-management.tours-annual-transfer.js';

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
      dateExamples: [{ sourceDate: '2026-01-05', targetDate: '2027-01-04' }],
      relationshipCounts: {
        wasteFractions: 1,
        locations: 2,
        pickupDates: 0,
        assignments: 0,
        shifts: 0,
        excluded: 0,
      },
      replacementResourceIds: [],
      replacementTargetYears: {},
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

  it('clears stale list filters when showing the transfer result', () => {
    const onFiltersChange = vi.fn();

    showWasteAnnualTransferResult(onFiltersChange, {
      sourceYear: 2026,
      targetYear: 2027,
      createdTourIds: ['target-1'],
      existingTourIds: [],
      createdCount: 1,
      existingCount: 0,
      classificationCounts: { transferable: 1, alreadyEffective: 0, blocked: 0 },
      listTarget: { tourValidityPeriod: 'next', status: 'inactive' },
    });

    expect(onFiltersChange).toHaveBeenCalledWith(
      '',
      'inactive',
      'next',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
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
    expect(screen.getByText(/tours\.annualTransfer\.summaryDetailed/)).toBeTruthy();
    expect(screen.getByText(/tours\.annualTransfer\.tourCounts/)).toBeTruthy();
    expect(screen.getByText(/tours\.annualTransfer\.period/)).toBeTruthy();
    expect(screen.getByText(/tours\.annualTransfer\.dateExample.*weekdays/)).toBeTruthy();
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
      'tours.annualTransfer.result:1|0|2027'
    );
  });

  it('shows concrete date-only mappings and the custom recurrence label', async () => {
    api.preview.mockResolvedValueOnce({
      ...preview,
      tours: [
        {
          ...preview.tours[0],
          sourcePeriod: {},
          recurrence: undefined,
          customRecurrenceName: 'Alle neun Tage',
          customRecurrenceIntervalDays: 9,
          dateExamples: [{ sourceDate: '2026-06-15', targetDate: '2027-06-14' }],
        },
      ],
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

    expect(await screen.findByText(/tours\.customRecurrenceLabel:Alle neun Tage\|9/)).toBeTruthy();
    expect(screen.getByText(/2026-06-15.*2027-06-14/)).toBeTruthy();
  });

  it('shows and enforces the resource-specific year for cross-year replacements', async () => {
    api.preview.mockResolvedValueOnce({
      ...preview,
      tours: [
        {
          ...preview.tours[0],
          classification: 'blocked',
          reasonCode: 'replacement_date_required',
          replacementResourceIds: ['shift-leap-year:actual'],
          replacementTargetYears: { 'shift-leap-year:actual': 2029 },
        },
      ],
      summary: { ...preview.summary, transferable: 0, blocked: 1, selected: 0 },
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
    const replacementInput = await screen.findByLabelText(
      'tours.annualTransfer.replacementDate:Bio Nord 1|2029'
    );

    expect((replacementInput as HTMLInputElement).min).toBe('2029-01-01');
    expect((replacementInput as HTMLInputElement).max).toBe('2029-12-31');
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
    expect(screen.getByText(/tours\.annualTransfer\.conflictDetails/)).toBeTruthy();
    const acknowledgement = screen.getByText('tours.annualTransfer.acknowledgeConflict:Bio Nord');
    const reviewButton = screen.getByRole('button', { name: 'tours.annualTransfer.review' });
    expect((reviewButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(acknowledgement);
    expect((reviewButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('explains hard target conflicts instead of asking for an unrelated date decision', async () => {
    api.preview.mockResolvedValueOnce({
      ...preview,
      tours: [
        {
          ...preview.tours[0],
          classification: 'blocked',
          reasonCode: 'target_identity_conflict',
          conflicts: [
            {
              kind: 'target-identity-conflict',
              sourceTourId: 'tour-1',
              targetTourId: 'target-existing',
              matchingFeatures: ['stable-target-id'],
            },
          ],
        },
      ],
      summary: { ...preview.summary, transferable: 0, blocked: 1, selected: 0 },
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
    expect(
      await screen.findByText('tours.annualTransfer.blockedReasons.targetIdentityConflict')
    ).toBeTruthy();
  });
});
