import type { Route } from '@playwright/test';
import type { WasteFacadeState } from './waste-management-plugin.helpers';
import type {
  WasteAnnualTourTransferPreview,
  WasteAnnualTourTransferResult,
} from '@sva/waste-management-contracts';

export async function previewAnnualTransfer(route: Route): Promise<void> {
  const request = route.request();
  const body = request.postDataJSON() as { sourceYear: number };
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        sourceYear: body.sourceYear,
        targetYear: body.sourceYear + 1,
        previewFingerprint: `sha256:${'a'.repeat(64)}`,
        tours: [
          {
            sourceTourId: 'tour-weekly',
            name: 'Restmüll Nord',
            classification: 'transferable',
            sourcePeriod: { firstDate: '2026-01-05', endDate: '2026-12-31' },
            targetPeriod: { firstDate: '2027-01-04', endDate: '2027-12-31' },
            firstTargetDate: '2027-01-04',
            recurrence: 'weekly',
            dateExamples: [{ sourceDate: '2026-01-05', targetDate: '2027-01-04' }],
            relationshipCounts: {
              wasteFractions: 1,
              customDates: 0,
              locations: 0,
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
          relationships: 1,
          excluded: 0,
        },
      } satisfies WasteAnnualTourTransferPreview,
    }),
  });
  return;
}

export async function transferAnnualTours(route: Route, state: WasteFacadeState): Promise<void> {
  const { toursState, requests } = state;
  const request = route.request();
  const body = request.postDataJSON() as Record<string, unknown>;
  requests.annualTourTransfers.push(body);
  toursState.unshift({
    id: 'tour-weekly-2027',
    name: 'Restmüll Nord',
    wasteFractionIds: ['fraction-1'],
    recurrence: 'weekly',
    firstDate: '2027-01-04',
    endDate: '2027-12-31',
    status: 'draft',
    createdAt: '2026-08-23T12:00:00.000Z',
    updatedAt: '2026-08-23T12:00:00.000Z',
  });
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        sourceYear: 2026,
        targetYear: 2027,
        createdTourIds: ['tour-weekly-2027'],
        existingTourIds: [],
        createdCount: 1,
        existingCount: 0,
        classificationCounts: { transferable: 1, alreadyEffective: 0, blocked: 0 },
        listTarget: { tourValidityPeriod: 'next', status: 'draft' },
      } satisfies WasteAnnualTourTransferResult,
    }),
  });
  return;
}
