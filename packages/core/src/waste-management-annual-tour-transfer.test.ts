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
import { createWasteAnnualTourConflictIndex } from './waste-management-annual-tour-transfer.conflict-index.js';
import { createWasteAnnualSourceRelationshipIndex } from './waste-management-annual-tour-transfer.relationships.js';
import { mapWasteAnnualRecurringShiftDates } from './waste-management-annual-tour-transfer.shift-cadence.js';
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

  it('indexes 1,000 tours and 100,000 relationships without repeated relationship scans', () => {
    const tours = Array.from({ length: 1_000 }, (_, index) =>
      tour({ id: `tour-${index}`, wasteFractionIds: [`fraction-${index}`] })
    );
    const locationTourLinks = tours.flatMap((item, tourIndex) =>
      Array.from({ length: 100 }, (_, locationIndex) => ({
        id: `link-${tourIndex}-${locationIndex}`,
        tourId: item.id,
        locationId: `location-${tourIndex}-${locationIndex}`,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }))
    );

    const index = createWasteAnnualTourConflictIndex(source(tours, { locationTourLinks }));
    const sourceIndex = createWasteAnnualSourceRelationshipIndex(
      source(tours, { locationTourLinks })
    );

    expect(index.byId.size).toBe(1_000);
    expect(index.bySignature.size).toBe(1_000);
    expect(sourceIndex.locationTourLinks.size).toBe(1_000);
    expect(sourceIndex.locationTourLinks.get('tour-999')).toHaveLength(100);
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

  it('blocks an interval tour without a cadence anchor before classifying target-year overlap', async () => {
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([tour({ firstDate: undefined, endDate: '2027-12-31' })]),
      target: source([]),
    });

    expect(preview.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'invalid_planning_data',
    });
  });

  it('ignores obsolete replacements only while rebuilding a confirmed stale preview', async () => {
    const leapTour = tour({
      recurrence: undefined,
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2024-02-29' }],
    });
    const blocked = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2024,
      currentYear: 2025,
      source: source([leapTour]),
      target: source([]),
    });
    const sourceResourceId = blocked.tours[0]?.replacementResourceIds[0] as string;
    const replacementDates = [{ sourceResourceId, targetDate: '2025-02-27' }];
    const confirmed = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2024,
      currentYear: 2025,
      source: source([leapTour]),
      target: source([]),
      replacementDates,
    });
    const changedSource = source([{ ...leapTour, customDates: [] }]);

    await expect(
      buildWasteAnnualTourTransferPreview({
        instanceId: 'tenant-a',
        sourceYear: 2024,
        currentYear: 2025,
        source: changedSource,
        target: source([]),
        replacementDates,
      })
    ).rejects.toEqual(new WasteAnnualTourTransferError('replacement_date_invalid'));
    const refreshed = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2024,
      currentYear: 2025,
      source: changedSource,
      target: source([]),
      replacementDates,
      allowObsoleteReplacementDates: true,
    });
    expect(refreshed.previewFingerprint).not.toBe(confirmed.previewFingerprint);
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

  it('maps and fingerprints every supported relationship kind', async () => {
    const sourceTour = tour({
      customDates: [
        { date: '2026-03-02', description: 'Zusatztermin' },
        { date: '2026-03-09', description: 'Zweiter Zusatztermin' },
      ],
    });
    const transferSource = source([sourceTour], {
      locationTourLinks: [
        {
          id: 'link-a',
          tourId: sourceTour.id,
          locationId: 'location-a',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'link-b',
          tourId: sourceTour.id,
          locationId: 'location-b',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      locationTourPickupDates: [
        {
          id: 'pickup-a',
          tourId: sourceTour.id,
          locationId: 'location-a',
          pickupDate: '2026-04-06',
          note: 'Abholung',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'pickup-b',
          tourId: sourceTour.id,
          locationId: 'location-b',
          pickupDate: '2026-04-13',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tourAssignments: [
        {
          id: 'assignment-a',
          tourId: sourceTour.id,
          pickupDate: '2026-05-04',
          note: 'Zuordnung',
          locationIds: ['location-a'],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'assignment-b',
          tourId: sourceTour.id,
          pickupDate: '2026-05-11',
          locationIds: ['location-b'],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      tourDateShifts: [
        {
          id: 'shift-a',
          tourId: sourceTour.id,
          originalDate: '2026-05-25',
          actualDate: '2026-05-26',
          hasYear: true,
          reasonType: 'holiday',
          reasonKey: 'holiday-a',
          followUpMode: 'single',
          description: 'Feiertag',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'shift-b',
          tourId: sourceTour.id,
          originalDate: '2026-07-06',
          actualDate: '2026-07-07',
          hasYear: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const initial = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: transferSource,
      target: source([]),
    });
    const mapped = initial.tours[0]?.mappedTour;

    expect(mapped?.targetTour).toMatchObject({
      customDates: [
        { date: '2027-03-01', description: 'Zusatztermin' },
        { date: '2027-03-08', description: 'Zweiter Zusatztermin' },
      ],
      locationCount: 2,
    });
    expect(mapped?.locationTourLinks).toHaveLength(2);
    expect(mapped?.locationTourLinks[0]).toMatchObject({ locationId: 'location-a' });
    expect(mapped?.locationTourPickupDates).toHaveLength(2);
    expect(mapped?.locationTourPickupDates[0]).toMatchObject({
      pickupDate: '2027-04-05',
      note: 'Abholung',
    });
    expect(mapped?.tourAssignments).toHaveLength(2);
    expect(mapped?.tourAssignments[0]).toMatchObject({
      pickupDate: '2027-05-03',
      note: 'Zuordnung',
      locationIds: ['location-a'],
    });
    expect(mapped?.tourDateShifts).toHaveLength(2);
    expect(mapped?.tourDateShifts[0]).toMatchObject({
      originalDate: '2027-06-07',
      actualDate: '2027-06-08',
      reasonType: 'holiday',
      reasonKey: 'holiday-a',
      followUpMode: 'single',
      description: 'Feiertag',
    });

    const stableTarget = source(
      [
        {
          ...(mapped?.targetTour as WasteTourRecord),
          createdAt: '2027-01-01T00:00:00.000Z',
          updatedAt: '2027-01-01T00:00:00.000Z',
        },
      ],
      {
        locationTourLinks: mapped?.locationTourLinks ?? [],
        locationTourPickupDates: mapped?.locationTourPickupDates ?? [],
        tourAssignments: mapped?.tourAssignments ?? [],
        tourDateShifts: mapped?.tourDateShifts ?? [],
      }
    );
    const repeated = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: transferSource,
      target: stableTarget,
    });

    expect(repeated.tours[0]).toMatchObject({ classification: 'transferable', conflicts: [] });
    expect(repeated.tours[0]?.dateExamples).toEqual([
      { sourceDate: '2026-03-02', targetDate: '2027-03-01' },
      { sourceDate: '2026-03-09', targetDate: '2027-03-08' },
      { sourceDate: '2026-04-06', targetDate: '2027-04-05' },
      { sourceDate: '2026-04-13', targetDate: '2027-04-12' },
      { sourceDate: '2026-05-04', targetDate: '2027-05-03' },
    ]);
    expect(repeated.previewFingerprint).toBe(initial.previewFingerprint);
  });

  it('preserves custom recurrence details in the preview', async () => {
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([
        tour({
          recurrence: undefined,
          customRecurrenceId: 'preset-9',
          customRecurrenceName: 'Alle neun Tage',
          customRecurrenceIntervalDays: 9,
        }),
      ]),
      target: source([]),
    });

    expect(preview.tours[0]).toMatchObject({
      customRecurrenceName: 'Alle neun Tage',
      customRecurrenceIntervalDays: 9,
    });
  });

  it('maps recurring shift origins to the same occurrence in the continued cadence', async () => {
    const sourceTour = tour({
      recurrence: undefined,
      customRecurrenceId: 'preset-10',
      customRecurrenceName: 'Alle zehn Tage',
      customRecurrenceIntervalDays: 10,
      firstDate: '2026-01-01',
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          {
            id: 'shift-second-occurrence',
            tourId: sourceTour.id,
            originalDate: '2026-01-11',
            actualDate: '2026-01-12',
            hasYear: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([]),
    });

    expect(preview.tours[0]?.mappedTour?.targetTour.firstDate).toBe('2027-01-06');
    expect(preview.tours[0]?.mappedTour?.tourDateShifts[0]).toMatchObject({
      originalDate: '2027-01-16',
      actualDate: '2027-01-17',
    });
  });

  it('maps built-in recurrence shifts onto continued occurrences', async () => {
    const sourceTour = tour({ firstDate: '2026-01-01' });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          {
            id: 'shift-first-biweekly-occurrence',
            tourId: sourceTour.id,
            originalDate: '2026-01-01',
            actualDate: '2026-01-02',
            hasYear: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([]),
    });

    expect(preview.tours[0]?.mappedTour?.targetTour.firstDate).toBe('2027-01-14');
    expect(preview.tours[0]?.mappedTour?.tourDateShifts[0]).toMatchObject({
      originalDate: '2027-01-14',
      actualDate: '2027-01-15',
    });
    expect(preview.tours[0]?.firstTargetDate).toBe('2027-01-15');
  });

  it('blocks recurring shifts whose origins are not source-tour occurrences', async () => {
    const sourceTour = tour({ recurrence: 'yearly', firstDate: '2026-01-01' });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          {
            id: 'invalid-yearly-shift',
            tourId: sourceTour.id,
            originalDate: '2026-01-02',
            actualDate: '2026-01-03',
            hasYear: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([]),
    });

    expect(preview.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'invalid_planning_data',
      replacementResourceIds: [],
    });
  });

  it('validates explicit recurring shift replacements against the continued cadence', () => {
    const sourceShift = {
      id: 'shift-replacement',
      tourId: tour().id,
      originalDate: '2026-01-01',
      actualDate: '2026-01-02',
      hasYear: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as const;
    const input = {
      source: sourceShift,
      tour: tour({ firstDate: '2026-01-01' }),
      sourceYear: 2026,
      targetYear: 2027,
      targetFirstDate: '2027-01-14',
      targetEndDate: '2027-12-31',
    } as const;

    expect(
      mapWasteAnnualRecurringShiftDates({
        ...input,
        replacements: new Map([
          ['shift-replacement:original', '2027-01-28'],
          ['shift-replacement:actual', '2027-01-29'],
        ]),
      })
    ).toEqual({ originalDate: '2027-01-28', actualDate: '2027-01-29' });

    expect(
      mapWasteAnnualRecurringShiftDates({
        ...input,
        replacements: new Map([['shift-replacement:original', '2027-01-15']]),
      })
    ).toEqual({ originalDate: null, actualDate: null });
  });

  it('accepts only the actual yearly occurrence as an explicit shift origin', () => {
    const sourceShift = {
      id: 'yearly-shift-replacement',
      tourId: tour().id,
      originalDate: '2026-07-15',
      actualDate: '2026-07-16',
      hasYear: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as const;
    const yearlyTour = tour({ recurrence: 'yearly', firstDate: '2026-07-15' });

    expect(
      mapWasteAnnualRecurringShiftDates({
        source: sourceShift,
        tour: yearlyTour,
        sourceYear: 2026,
        targetYear: 2027,
        targetFirstDate: '2027-07-15',
        replacements: new Map([
          ['yearly-shift-replacement:original', '2027-07-15'],
          ['yearly-shift-replacement:actual', '2027-07-16'],
        ]),
      })
    ).toEqual({ originalDate: '2027-07-15', actualDate: '2027-07-16' });

    expect(
      mapWasteAnnualRecurringShiftDates({
        source: { ...sourceShift, originalDate: '2026-07-16' },
        tour: yearlyTour,
        sourceYear: 2026,
        targetYear: 2027,
        targetFirstDate: '2027-07-15',
        replacements: new Map(),
      })
    ).toBeUndefined();
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

  it('counts assignment-location rows toward the relationship limit', async () => {
    const sourceTour = tour();
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourAssignments: [
          {
            id: 'assignment-with-locations',
            tourId: sourceTour.id,
            pickupDate: '2026-05-04',
            locationIds: ['location-a', 'location-b', 'location-c'],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([]),
    });

    expect(preview.summary.relationships).toBe(5);
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

  it('reports leap-day pickup and assignment resources that require replacements', async () => {
    const leapTour = tour({ firstDate: '2024-01-01', endDate: '2024-12-31' });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2024,
      currentYear: 2025,
      source: source([leapTour], {
        locationTourPickupDates: [
          {
            id: 'pickup-leap',
            tourId: leapTour.id,
            locationId: 'location-a',
            pickupDate: '2024-02-29',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        tourAssignments: [
          {
            id: 'assignment-leap',
            tourId: leapTour.id,
            pickupDate: '2024-02-29',
            locationIds: ['location-a'],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([]),
    });

    expect(preview.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'replacement_date_required',
      replacementResourceIds: ['pickup-leap', 'assignment-leap'],
    });
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
    const sourceTour = tour({
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2026-12-31' }],
    });
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
    const sourceTour = tour({
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2027-12-31' }],
    });
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
    expect(resolved.tours[0]?.replacementTargetYears).toEqual({
      'shift-leap-year:actual': 2029,
    });
    expect(resolved.tours[0]?.replacementResourceIds).toEqual(['shift-leap-year:actual']);
    await expect(
      buildWasteAnnualTourTransferPreview({
        instanceId: 'tenant-a',
        sourceYear: 2027,
        currentYear: 2028,
        source: transferSource,
        target: source([]),
        replacementDates: [
          { sourceResourceId: 'shift-leap-year:actual', targetDate: '2028-02-28' },
        ],
      })
    ).rejects.toMatchObject({
      code: 'replacement_date_invalid',
      replacement: { sourceResourceId: 'shift-leap-year:actual', expectedYear: 2029 },
    });
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

  it('does not conflate matching dates across different non-interval recurrence modes', async () => {
    const sourceTour = tour({
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2026-06-15' }],
    });
    const targetTour = tour({
      id: '78787878-7878-4787-8787-787878787878',
      recurrence: 'yearly',
      firstDate: '2027-06-14',
      endDate: '2027-12-31',
      customDates: undefined,
    });

    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour]),
      target: source([targetTour]),
    });

    expect(preview.tours[0]?.firstTargetDate).toBe('2027-06-14');
    expect(preview.tours[0]?.conflicts).toEqual([]);
    expect(preview.summary.selected).toBe(1);
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

  it('matches a shifted date against an earlier yearly target anniversary', async () => {
    const sourceTour = tour({
      recurrence: 'yearly',
      firstDate: '2026-07-15',
      endDate: '2026-12-31',
    });
    const targetTour = tour({
      id: '89898989-8989-4989-8989-898989898989',
      recurrence: 'yearly',
      firstDate: '2025-07-16',
      endDate: undefined,
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          {
            id: 'shift-yearly-anniversary',
            tourId: sourceTour.id,
            originalDate: '2026-07-15',
            actualDate: '2026-07-16',
            hasYear: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([targetTour]),
    });

    expect(preview.tours[0]?.mappedTour?.tourDateShifts[0]).toMatchObject({
      originalDate: '2027-07-15',
      actualDate: '2027-07-16',
    });
    expect(preview.tours[0]?.conflicts).toEqual([
      expect.objectContaining({ kind: 'possible-parallel-planning', targetTourId: targetTour.id }),
    ]);
    expect(preview.summary.selected).toBe(0);
  });

  it('detects parallel planning when a target shift lands on the mapped cadence', async () => {
    const sourceTour = tour({ recurrence: 'weekly', firstDate: '2026-01-06' });
    const targetTour = tour({
      id: '99999999-9999-4999-8999-999999999999',
      recurrence: 'weekly',
      firstDate: '2027-01-13',
      endDate: '2027-12-31',
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour]),
      target: source([targetTour], {
        tourDateShifts: [
          {
            id: 'shift-target',
            tourId: targetTour.id,
            originalDate: '2027-01-13',
            actualDate: '2027-01-12',
            hasYear: true,
            createdAt: '2027-01-01T00:00:00.000Z',
            updatedAt: '2027-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    expect(preview.tours[0]?.conflicts).toEqual([
      expect.objectContaining({ kind: 'possible-parallel-planning', targetTourId: targetTour.id }),
    ]);
    expect(preview.summary.selected).toBe(0);
  });

  it('ignores target shifts whose origins are not operational tour occurrences', async () => {
    const sourceTour = tour({ recurrence: 'weekly', firstDate: '2026-01-05' });
    const targetTour = tour({
      id: '98989898-9898-4989-8989-989898989898',
      recurrence: 'weekly',
      firstDate: '2027-01-05',
      endDate: '2027-12-31',
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour]),
      target: source([targetTour], {
        tourDateShifts: [
          {
            id: 'invalid-target-shift',
            tourId: targetTour.id,
            originalDate: '2027-01-06',
            actualDate: '2027-01-04',
            hasYear: true,
            createdAt: '2027-01-01T00:00:00.000Z',
            updatedAt: '2027-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    expect(preview.tours[0]?.conflicts).toEqual([]);
  });

  it('matches shifted dates against occurrences of another recurring tour', async () => {
    const sourceTour = tour({ recurrence: 'weekly', firstDate: '2026-01-12' });
    const targetTour = tour({
      id: '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a9a',
      recurrence: 'weekly',
      firstDate: '2027-01-05',
      endDate: '2027-12-31',
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          {
            id: 'shift-recurring-occurrence',
            tourId: sourceTour.id,
            originalDate: '2026-01-12',
            actualDate: '2026-01-13',
            hasYear: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([targetTour]),
    });

    expect(preview.tours[0]?.mappedTour?.tourDateShifts[0]?.actualDate).toBe('2027-01-19');
    expect(preview.tours[0]?.conflicts).toEqual([
      expect.objectContaining({ kind: 'possible-parallel-planning', targetTourId: targetTour.id }),
    ]);
    expect(preview.summary.selected).toBe(0);
  });

  it('excludes shifted occurrences from recurring schedule fallback conflicts', async () => {
    const sourceTour = tour({
      recurrence: 'weekly',
      firstDate: '2026-01-12',
      endDate: '2026-01-18',
    });
    const targetTour = tour({
      id: '9b9b9b9b-9b9b-4b9b-8b9b-9b9b9b9b9b9b',
      recurrence: 'weekly',
      firstDate: '2027-01-11',
      endDate: '2027-01-11',
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          {
            id: 'shift-single-recurring-occurrence',
            tourId: sourceTour.id,
            originalDate: '2026-01-12',
            actualDate: '2026-01-13',
            hasYear: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([targetTour]),
    });

    expect(preview.tours[0]?.mappedTour?.tourDateShifts[0]?.actualDate).toBe('2027-01-19');
    expect(preview.tours[0]?.conflicts).toEqual([]);
    expect(preview.summary.selected).toBe(1);
  });

  it('excludes shifted-away occurrences from symmetric shift-to-recurrence checks', async () => {
    const sourceTour = tour({ recurrence: 'weekly', firstDate: '2026-01-11' });
    const targetTour = tour({
      id: '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c9c',
      recurrence: 'weekly',
      firstDate: '2027-01-05',
      endDate: '2027-12-31',
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          {
            id: 'mapped-shift-to-target-origin',
            tourId: sourceTour.id,
            originalDate: '2026-01-11',
            actualDate: '2026-01-06',
            hasYear: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([targetTour], {
        tourDateShifts: [
          {
            id: 'target-shift-away',
            tourId: targetTour.id,
            originalDate: '2027-01-12',
            actualDate: '2027-01-13',
            hasYear: true,
            createdAt: '2027-01-01T00:00:00.000Z',
            updatedAt: '2027-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    expect(preview.tours[0]?.mappedTour?.tourDateShifts[0]?.actualDate).toBe('2027-01-12');
    expect(preview.tours[0]?.conflicts).toEqual([]);
    expect(preview.summary.selected).toBe(1);
  });

  it('preserves the year offset of annual shifts during conflict detection', async () => {
    const sourceTour = tour({
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2026-01-03' }],
    });
    const targetTour = tour({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2027-12-31' }],
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour]),
      target: source([targetTour], {
        tourDateShifts: [
          {
            id: 'annual-cross-year',
            tourId: targetTour.id,
            originalDate: '2024-12-31',
            actualDate: '2025-01-02',
            hasYear: false,
            createdAt: '2027-01-01T00:00:00.000Z',
            updatedAt: '2027-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    expect(preview.tours[0]?.firstTargetDate).toBe('2027-01-02');
    expect(preview.tours[0]?.conflicts).toEqual([]);
  });

  it('includes cross-year shift destinations when selecting conflict candidates', async () => {
    const sourceTour = tour({
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2026-12-31' }],
    });
    const targetTour = tour({
      id: 'abababab-abab-4aba-8bab-abababababab',
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2028-01-01' }],
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          {
            id: 'cross-year-conflict-shift',
            tourId: sourceTour.id,
            originalDate: '2026-12-31',
            actualDate: '2027-01-02',
            hasYear: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([targetTour]),
    });

    expect(preview.tours[0]?.mappedTour?.tourDateShifts[0]?.actualDate).toBe('2028-01-01');
    expect(preview.tours[0]?.conflicts).toEqual([
      expect.objectContaining({ kind: 'possible-parallel-planning', targetTourId: targetTour.id }),
    ]);
    expect(preview.summary.selected).toBe(0);
  });

  it('honors target shifts in a cross-year destination year', async () => {
    const sourceTour = tour({
      recurrence: 'weekly',
      firstDate: '2026-12-19',
      endDate: '2026-12-26',
    });
    const targetTour = tour({
      id: 'adadadad-adad-4ada-8dad-adadadadadad',
      recurrence: 'weekly',
      firstDate: '2028-01-01',
      endDate: '2028-01-01',
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          {
            id: 'mapped-cross-year-shift',
            tourId: sourceTour.id,
            originalDate: '2026-12-19',
            actualDate: '2026-12-26',
            hasYear: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([targetTour], {
        tourDateShifts: [
          {
            id: 'target-cross-year-shift-away',
            tourId: targetTour.id,
            originalDate: '2028-01-01',
            actualDate: '2028-01-02',
            hasYear: true,
            createdAt: '2028-01-01T00:00:00.000Z',
            updatedAt: '2028-01-01T00:00:00.000Z',
          },
        ],
      }),
    });

    expect(preview.tours[0]?.mappedTour?.tourDateShifts[0]?.actualDate).toBe('2028-01-01');
    expect(preview.tours[0]?.conflicts).toEqual([]);
    expect(preview.summary.selected).toBe(1);
  });

  it('removes shifted origins from effective conflict dates', async () => {
    const sourceTour = tour({
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2026-06-15' }],
    });
    const targetTour = tour({
      id: 'acacacac-acac-4aca-8cac-acacacacacac',
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2027-06-14' }],
    });
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          {
            id: 'shift-only-occurrence',
            tourId: sourceTour.id,
            originalDate: '2026-06-15',
            actualDate: '2026-06-16',
            hasYear: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
      target: source([targetTour]),
    });

    expect(preview.tours[0]?.mappedTour?.tourDateShifts[0]).toMatchObject({
      originalDate: '2027-06-14',
      actualDate: '2027-06-15',
    });
    expect(preview.tours[0]?.conflicts).toEqual([]);
    expect(preview.summary.selected).toBe(1);
  });

  it('ignores annual shifts on source tours whose validity ended before the target year', async () => {
    const sourceTour = tour();
    const annualShift = {
      id: 'expired-annual-shift',
      tourId: sourceTour.id,
      originalDate: '2024-12-24',
      actualDate: '2024-12-27',
      hasYear: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as const;
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], { tourDateShifts: [annualShift] }),
      target: source([sourceTour], { tourDateShifts: [annualShift] }),
    });

    expect(preview.tours[0]?.conflicts).toEqual([]);
    expect(preview.summary.selected).toBe(1);
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

  it('detects date-shift collisions by their mapped persisted origin', async () => {
    const sourceTour = tour({
      recurrence: 'on-demand',
      firstDate: undefined,
      endDate: undefined,
      customDates: [{ date: '2026-01-01' }, { date: '2026-01-08' }],
    });
    const transferSource = source([sourceTour], {
      tourDateShifts: [
        {
          id: 'shift-january-1',
          tourId: sourceTour.id,
          originalDate: '2026-01-01',
          actualDate: '2026-03-01',
          hasYear: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'shift-january-8',
          tourId: sourceTour.id,
          originalDate: '2026-01-08',
          actualDate: '2026-03-08',
          hasYear: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: transferSource,
      target: source([]),
    });

    expect(preview.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'target_date_collision',
    });
    expect(preview.tours[0]?.replacementResourceIds).toEqual(
      expect.arrayContaining(['shift-january-1:original', 'shift-january-8:original'])
    );
  });

  it('requires source cleanup for duplicate year-independent shift rules', async () => {
    const sourceTour = tour();
    const duplicateShift = {
      tourId: sourceTour.id,
      originalDate: '2024-12-24',
      actualDate: '2024-12-27',
      hasYear: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as const;
    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: source([sourceTour], {
        tourDateShifts: [
          { ...duplicateShift, id: 'shift-static-a' },
          { ...duplicateShift, id: 'shift-static-b' },
        ],
      }),
      target: source([]),
    });

    expect(preview.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'invalid_planning_data',
      replacementResourceIds: [],
    });
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

  it('blocks a stable target whose relationship content matches under a different identity', async () => {
    const sourceTour = tour();
    const transferSource = source([sourceTour], {
      locationTourPickupDates: [
        {
          id: 'source-pickup',
          tourId: sourceTour.id,
          locationId: 'location-a',
          pickupDate: '2026-06-15',
          note: 'Abholung',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const initial = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: transferSource,
      target: source([]),
    });
    const mapped = initial.tours[0]?.mappedTour;
    if (!mapped) throw new Error('missing mapped tour');
    const [mappedPickup] = mapped.locationTourPickupDates;
    if (!mappedPickup) throw new Error('missing mapped pickup date');

    const preview = await buildWasteAnnualTourTransferPreview({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      currentYear: 2026,
      source: transferSource,
      target: source(
        [
          {
            ...mapped.targetTour,
            createdAt: '2027-01-01T00:00:00.000Z',
            updatedAt: '2027-01-01T00:00:00.000Z',
          },
        ],
        {
          locationTourPickupDates: [
            {
              ...mappedPickup,
              id: 'different-pickup-id',
              createdAt: '2027-01-01T00:00:00.000Z',
              updatedAt: '2027-01-01T00:00:00.000Z',
            },
          ],
        }
      ),
    });

    expect(preview.tours[0]).toMatchObject({
      classification: 'blocked',
      reasonCode: 'target_identity_conflict',
      conflicts: [expect.objectContaining({ kind: 'target-identity-conflict' })],
    });
  });
});
