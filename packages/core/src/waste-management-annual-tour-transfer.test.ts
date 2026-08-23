import { describe, expect, it } from 'vitest';

import type { WasteTourRecord } from './waste-management/master-data-tours.js';
import {
  assertWasteAnnualTourTransferLimits,
  WasteAnnualTourTransferError,
  type WasteAnnualTourTransferSource,
} from './waste-management-annual-tour-transfer.contract.js';
import {
  continueWasteAnnualTourCadence,
  deriveWasteAnnualTourTransferTargetYear,
  mapWasteAnnualConcreteDate,
} from './waste-management-annual-tour-transfer.dates.js';
import {
  buildWasteAnnualTourTransferFingerprint,
  deriveWasteAnnualTourTransferId,
} from './waste-management-annual-tour-transfer.identity.js';
import { buildWasteAnnualTourTransferPreview } from './waste-management-annual-tour-transfer.preview.js';
import { toWasteAnnualTourTransferPublicPreview } from './waste-management-annual-tour-transfer.preview.js';

const tour = (overrides: Partial<WasteTourRecord> = {}): WasteTourRecord => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Bio Nord',
  wasteFractionIds: ['bio'],
  recurrence: 'biweekly',
  firstDate: '2026-01-05',
  endDate: '2026-12-31',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

const source = (
  tours: readonly WasteTourRecord[],
  overrides: Partial<WasteAnnualTourTransferSource> = {}
): WasteAnnualTourTransferSource => ({
  tours,
  locationTourLinks: [],
  locationTourPickupDates: [],
  tourAssignments: [],
  tourDateShifts: [],
  ...overrides,
});

describe('waste annual tour transfer', () => {
  it('derives only the direct following year from the current or previous year', () => {
    expect(deriveWasteAnnualTourTransferTargetYear(2026, 2026)).toBe(2027);
    expect(deriveWasteAnnualTourTransferTargetYear(2025, 2026)).toBe(2026);
    expect(() => deriveWasteAnnualTourTransferTargetYear(2024, 2026)).toThrow(
      new WasteAnnualTourTransferError('invalid_source_year')
    );
  });

  it('continues 7, 14, 28 and custom day cadences across a leap-year boundary', () => {
    expect(
      continueWasteAnnualTourCadence({
        sourceFirstDate: '2024-01-01',
        sourceEndDate: '2024-12-31',
        targetYear: 2025,
        intervalDays: 7,
      })
    ).toEqual({ firstDate: '2025-01-06', endDate: '2025-12-31' });
    for (const intervalDays of [14, 28, 9]) {
      const result = continueWasteAnnualTourCadence({
        sourceFirstDate: '2024-01-01',
        sourceEndDate: '2024-12-31',
        targetYear: 2025,
        intervalDays,
      });
      expect(result?.firstDate).toMatch(/^2025-/);
      const sourceDate = new Date('2024-01-01T00:00:00.000Z');
      const targetDate = new Date(`${result?.firstDate}T00:00:00.000Z`);
      expect(((targetDate.getTime() - sourceDate.getTime()) / 86_400_000) % intervalDays).toBe(0);
    }
  });

  it('continues a cadence from the effective source-year slice instead of the original anniversary', async () => {
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2025,
      currentYear: 2025,
      source: source([
        tour({
          recurrence: 'weekly',
          firstDate: '2024-06-03',
          endDate: '2025-05-31',
        }),
      ]),
      target: source([]),
    });

    expect(preview.tours[0]).toMatchObject({
      classification: 'transferable',
      firstTargetDate: '2026-01-05',
      targetPeriod: { firstDate: '2026-01-05', endDate: '2026-05-31' },
    });
  });

  it('maps concrete dates to the nearest equal weekday and never crosses the target year', () => {
    expect(mapWasteAnnualConcreteDate('2026-06-15', 2027)).toBe('2027-06-14');
    expect(mapWasteAnnualConcreteDate('2026-01-01', 2027)).toBe('2027-01-07');
    expect(mapWasteAnnualConcreteDate('2024-02-29', 2025)).toBeNull();
    expect(mapWasteAnnualConcreteDate('2024-02-29', 2025, '2025-02-27')).toBe('2025-02-27');
    expect(mapWasteAnnualConcreteDate('2024-02-29', 2025, '2026-02-27')).toBeNull();
    expect(mapWasteAnnualConcreteDate('2026-06-15', 2027, '2027-06-16')).toBe('2027-06-16');
  });

  it('creates order-independent fingerprints and stable UUID-shaped target identities', async () => {
    await expect(buildWasteAnnualTourTransferFingerprint({ b: 2, a: 1 })).resolves.toBe(
      await buildWasteAnnualTourTransferFingerprint({ a: 1, b: 2 })
    );
    const first = await deriveWasteAnnualTourTransferId('tenant-a', 'tour-a', '2027');
    const second = await deriveWasteAnnualTourTransferId('tenant-a', 'tour-a', '2027');
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('invalidates the preview fingerprint when a copy-relevant source record changes', async () => {
    const initial = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([tour()]),
      target: source([]),
    });
    const updated = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([tour({ updatedAt: '2026-04-02T00:00:00.000Z' })]),
      target: source([]),
    });

    expect(updated.previewFingerprint).not.toBe(initial.previewFingerprint);
  });

  it('keeps the internal copy plan out of the public preview DTO', async () => {
    const internal = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([tour()]),
      target: source([]),
    });

    expect(internal.tours[0]?.mappedTour).toBeDefined();
    expect(toWasteAnnualTourTransferPublicPreview(internal).tours[0]).not.toHaveProperty(
      'mappedTour'
    );
  });

  it('accepts the approved batch limits exactly and rejects either value above them', () => {
    expect(() =>
      assertWasteAnnualTourTransferLimits({ tours: 1_000, relationships: 100_000 })
    ).not.toThrow();
    expect(() =>
      assertWasteAnnualTourTransferLimits({ tours: 1_001, relationships: 100_000 })
    ).toThrow(new WasteAnnualTourTransferError('batch_limit_exceeded'));
    expect(() =>
      assertWasteAnnualTourTransferLimits({ tours: 1_000, relationships: 100_001 })
    ).toThrow(new WasteAnnualTourTransferError('batch_limit_exceeded'));
  });

  it('classifies transferable, already-effective and blocked source tours without hiding any', async () => {
    const transferable = tour();
    const alreadyEffective = tour({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Rest offen',
      endDate: '2027-12-31',
    });
    const blocked = tour({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Schalttag',
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2024-02-29' }],
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([transferable, alreadyEffective, blocked]),
      target: source([]),
    });

    expect(preview.targetYear).toBe(2027);
    expect(preview.tours.map((item) => [item.name, item.classification])).toEqual([
      ['Bio Nord', 'transferable'],
      ['Rest offen', 'already-effective'],
    ]);
    expect(preview.summary).toMatchObject({ transferable: 1, alreadyEffective: 1, blocked: 0 });
  });

  it('requires a leap-day replacement and maps every supported relationship into the source year', async () => {
    const leapTour = tour({
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2024-02-29', description: 'Sondertermin' }],
    });
    const blocked = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2024,
      currentYear: 2025,
      source: source([leapTour]),
      target: source([]),
    });
    expect(blocked.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'replacement_date_required',
    });
    const resourceId = blocked.tours[0]?.replacementResourceIds[0];
    expect(resourceId).toBeTruthy();
    const resolved = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2024,
      currentYear: 2025,
      source: source([leapTour]),
      target: source([]),
      replacementDates: [{ sourceResourceId: resourceId as string, targetDate: '2025-02-27' }],
    });
    expect(resolved.tours[0]?.mappedTour?.targetTour.customDates).toEqual([
      { date: '2025-02-27', description: 'Sondertermin' },
    ]);
  });

  it('applies a dedicated replacement to a leap-day validity end', async () => {
    const annualTour = tour({
      recurrence: 'yearly',
      firstDate: '2024-01-10',
      endDate: '2024-02-29',
    });
    const blocked = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2024,
      currentYear: 2025,
      source: source([annualTour]),
      target: source([]),
    });
    expect(blocked.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'replacement_date_required',
      replacementResourceIds: [`${annualTour.id}:validity:end`],
    });

    const resolved = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2024,
      currentYear: 2025,
      source: source([annualTour]),
      target: source([]),
      replacementDates: [
        {
          sourceResourceId: `${annualTour.id}:validity:end`,
          targetDate: '2025-02-28',
        },
      ],
    });
    expect(resolved.tours[0]).toMatchObject({
      classification: 'transferable',
      targetPeriod: { firstDate: '2025-01-10', endDate: '2025-02-28' },
    });
  });

  it('preserves the anniversary of a multi-year yearly tour', async () => {
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([
        tour({
          recurrence: 'yearly',
          firstDate: '2025-07-15',
          endDate: '2026-12-31',
        }),
      ]),
      target: source([]),
    });

    expect(preview.tours[0]?.targetPeriod).toEqual({
      firstDate: '2027-07-15',
      endDate: '2027-12-31',
    });
  });

  it('blocks a yearly tour whose source-year slice ends before its anniversary', async () => {
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([
        tour({
          recurrence: 'yearly',
          firstDate: '2025-07-15',
          endDate: '2026-03-01',
        }),
      ]),
      target: source([]),
    });

    expect(preview.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'invalid_planning_data',
    });
  });

  it('preserves the relative year offset of a cross-year date shift', async () => {
    const sourceTour = tour();
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          {
            id: 'shift-cross-year',
            tourId: sourceTour.id,
            originalDate: '2026-12-31',
            actualDate: '2027-01-02',
            hasYear: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([]),
    });

    expect(preview.tours[0]?.mappedTour?.tourDateShifts[0]).toMatchObject({
      originalDate: '2027-12-30',
      actualDate: '2028-01-01',
    });
  });

  it('accepts a required cross-year shift replacement in its shifted target year', async () => {
    const sourceTour = tour({ firstDate: '2027-01-01', endDate: '2027-12-31' });
    const transferSource = source([sourceTour], {
      tourDateShifts: [
        {
          id: 'shift-leap-year',
          tourId: sourceTour.id,
          originalDate: '2027-12-31',
          actualDate: '2028-02-29',
          hasYear: true,
          createdAt: '2027-01-01T00:00:00.000Z',
          updatedAt: '2027-01-01T00:00:00.000Z',
        },
      ],
    });
    const blocked = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2027,
      currentYear: 2028,
      source: transferSource,
      target: source([]),
    });

    expect(blocked.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'replacement_date_required',
      replacementResourceIds: ['shift-leap-year:actual'],
      replacementTargetYears: { 'shift-leap-year:actual': 2029 },
    });

    const resolved = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2027,
      currentYear: 2028,
      source: transferSource,
      target: source([]),
      replacementDates: [{ sourceResourceId: 'shift-leap-year:actual', targetDate: '2029-02-28' }],
    });

    expect(resolved.tours[0]?.mappedTour?.tourDateShifts[0]?.actualDate).toBe('2029-02-28');
  });

  it('rejects replacement overrides that are unknown or not required', async () => {
    const onDemandTour = tour({
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2026-06-15' }],
    });
    const baseInput = {
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([onDemandTour]),
      target: source([]),
    } as const;

    await expect(
      buildWasteAnnualTourTransferPreview({
        ...baseInput,
        replacementDates: [
          {
            sourceResourceId: `${onDemandTour.id}:custom-date:0:2026-06-15`,
            targetDate: '2027-06-16',
          },
        ],
      })
    ).rejects.toEqual(new WasteAnnualTourTransferError('replacement_date_invalid'));
    await expect(
      buildWasteAnnualTourTransferPreview({
        ...baseInput,
        replacementDates: [{ sourceResourceId: 'unknown', targetDate: '2027-06-16' }],
      })
    ).rejects.toEqual(new WasteAnnualTourTransferError('replacement_date_invalid'));
  });

  it('detects possible parallel planning from content rather than the tour name', async () => {
    const sourceTour = tour();
    const targetTour = tour({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Anderer Name',
      firstDate: '2027-02-01',
      endDate: '2027-12-31',
    });
    const sourceLink = {
      id: '55555555-5555-4555-8555-555555555555',
      tourId: sourceTour.id,
      locationId: 'location-a',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const targetLink = {
      ...sourceLink,
      id: '66666666-6666-4666-8666-666666666666',
      tourId: targetTour.id,
    };
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], { locationTourLinks: [sourceLink] }),
      target: source([targetTour], { locationTourLinks: [targetLink] }),
    });
    expect(preview.tours[0]?.conflicts).toEqual([
      expect.objectContaining({ kind: 'possible-parallel-planning', targetTourId: targetTour.id }),
    ]);
    expect(preview.summary.selected).toBe(0);
  });

  it('detects a date-only target tour as possible parallel planning', async () => {
    const sourceTour = tour({
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2026-06-15' }],
    });
    const targetTour = tour({
      id: '77777777-7777-4777-8777-777777777777',
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2027-06-14' }],
    });

    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour]),
      target: source([targetTour]),
    });

    expect(preview.tours[0]?.conflicts).toEqual([
      expect.objectContaining({ kind: 'possible-parallel-planning', targetTourId: targetTour.id }),
    ]);
    expect(preview.summary.selected).toBe(0);
  });

  it('detects an earlier yearly target tour with the same target-year anniversary', async () => {
    const sourceTour = tour({
      recurrence: 'yearly',
      firstDate: '2026-07-15',
      endDate: '2026-12-31',
    });
    const targetTour = tour({
      id: '88888888-8888-4888-8888-888888888888',
      recurrence: 'yearly',
      firstDate: '2025-07-15',
      endDate: undefined,
    });

    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour]),
      target: source([targetTour]),
    });

    expect(preview.tours[0]?.conflicts).toEqual([
      expect.objectContaining({ kind: 'possible-parallel-planning', targetTourId: targetTour.id }),
    ]);
    expect(preview.summary.selected).toBe(0);
  });

  it('reports all colliding date resources and resolves the collision with an explicit replacement', async () => {
    const collidingTour = tour({
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2026-06-15' }, { date: '2026-06-15' }],
    });
    const blocked = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([collidingTour]),
      target: source([]),
    });
    expect(blocked.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'target_date_collision',
    });
    expect(blocked.tours[0]?.replacementResourceIds).toHaveLength(2);
    const [firstResourceId] = blocked.tours[0]?.replacementResourceIds ?? [];
    const resolved = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([collidingTour]),
      target: source([]),
      replacementDates: [{ sourceResourceId: firstResourceId as string, targetDate: '2027-06-15' }],
    });
    expect(resolved.tours[0]?.classification).toBe('transferable');
  });

  it('blocks a stable target identity whose persisted content differs from the preview', async () => {
    const sourceTour = tour();
    const initial = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour]),
      target: source([]),
    });
    const mapped = initial.tours[0]?.mappedTour;
    expect(mapped).toBeDefined();
    const conflictingTarget: WasteTourRecord = {
      ...(mapped?.targetTour as WasteTourRecord),
      name: 'Manuell verändertes Ziel',
      createdAt: '2027-01-01T00:00:00.000Z',
      updatedAt: '2027-01-01T00:00:00.000Z',
    };
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour]),
      target: source([conflictingTarget]),
    });
    expect(preview.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'target_identity_conflict',
      conflicts: [expect.objectContaining({ kind: 'target-identity-conflict' })],
    });
  });
});
