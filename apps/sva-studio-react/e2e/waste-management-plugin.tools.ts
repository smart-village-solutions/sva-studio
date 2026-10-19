import type { Route } from '@playwright/test';
import type { WasteFacadeState, WasteJobState } from './waste-management-plugin.helpers';

export async function uploadImport(route: Route): Promise<void> {
  const request = route.request();
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        blobRef: 'plugin-operation-input:00000000-0000-4000-8000-000000000001',
        sizeBytes: request.postDataBuffer()?.byteLength ?? 0,
      },
    }),
  });
  return;
}

export async function previewImport(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        profileId: 'waste-management.ortsbezogene-tourtermine',
        delimiter: ';',
        detectedDelimiter: ';',
        fractionNames: ['Hausmüll', 'Papier', 'Gelbe Säcke'],
        existingFractions: ['Restmüll'],
        newFractions: ['Hausmüll', 'Papier', 'Gelbe Säcke'],
        existingTours: [],
        newTours: ['HM.3.3', 'PPK.7.2', 'LVP.9.4'],
        validRowCount: 1,
        invalidRowCount: 0,
        errors: [],
        summary: {
          fractions: { existing: 0, created: 3 },
          regions: { existing: 0, created: 0 },
          cities: { existing: 0, created: 1 },
          streets: { existing: 0, created: 1 },
          houseNumbers: { existing: 0, created: 1 },
          locations: { existing: 0, created: 1 },
          assignments: { existing: 0, created: 3 },
        },
      },
    }),
  });
  return;
}

export async function startImport(route: Route, state: WasteFacadeState): Promise<void> {
  const { requests } = state;
  requests.startedJobTypes.push('waste-management.import-data');
  const job: WasteJobState = {
    id: 'job-import-1',
    jobTypeId: 'waste-management.import-data',
    status: 'pending',
  };
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ data: job }),
  });
  return;
}

export async function startExport(route: Route, state: WasteFacadeState): Promise<void> {
  const { requests } = state;
  const request = route.request();
  requests.exportInputs.push(request.postDataJSON() as Record<string, unknown>);
  requests.startedJobTypes.push('waste-management.export-data');
  const job: WasteJobState = {
    id: 'job-export-1',
    jobTypeId: 'waste-management.export-data',
    status: 'pending',
  };
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ data: job }),
  });
  return;
}

export async function startMigration(route: Route, state: WasteFacadeState): Promise<void> {
  const { requests } = state;
  requests.startedJobTypes.push('waste-management.apply-migrations');
  const job: WasteJobState = {
    id: 'job-migrate-1',
    jobTypeId: 'waste-management.apply-migrations',
    status: 'pending',
  };
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ data: job }),
  });
  return;
}

export async function startSeed(route: Route, state: WasteFacadeState): Promise<void> {
  const { requests } = state;
  requests.startedJobTypes.push('waste-management.seed-data');
  const job: WasteJobState = {
    id: 'job-seed-1',
    jobTypeId: 'waste-management.seed-data',
    status: 'pending',
  };
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ data: job }),
  });
  return;
}

export async function startReset(route: Route, state: WasteFacadeState): Promise<void> {
  const { requests } = state;
  requests.startedJobTypes.push('waste-management.reset-data');
  const job: WasteJobState = {
    id: 'job-reset-1',
    jobTypeId: 'waste-management.reset-data',
    status: 'pending',
  };
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ data: job }),
  });
  return;
}
