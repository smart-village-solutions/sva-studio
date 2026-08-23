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
