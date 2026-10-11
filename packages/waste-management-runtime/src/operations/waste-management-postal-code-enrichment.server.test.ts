import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
  listWasteCities: vi.fn(),
  listWasteRegions: vi.fn(),
  listWasteStreets: vi.fn(),
  updateWasteCityPostalCodeIfMissing: vi.fn(),
}));

vi.mock('./waste-management-operations.shared.js', () => ({
  withWasteClient: vi.fn(
    async (
      _deps: unknown,
      _instanceId: string,
      callback: (context: { repository: typeof repository }) => Promise<unknown>
    ) => callback({ repository })
  ),
}));

import { createEnrichPostalCodesOperation } from './waste-management-postal-code-enrichment.server.js';

const timestamp = '2026-08-14T10:00:00.000Z';

describe('waste postal-code enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.listWasteRegions.mockResolvedValue([
      { id: 'region-1', name: 'Prignitz', createdAt: timestamp, updatedAt: timestamp },
    ]);
    repository.listWasteCities.mockResolvedValue([
      {
        id: 'city-existing',
        name: 'Wittenberge',
        postalCode: '19322',
        regionId: 'region-1',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'city-embedded',
        name: 'Rambow (19339)',
        regionId: 'region-1',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'city-consensus',
        name: 'Perleberg',
        regionId: 'region-1',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'city-ambiguous',
        name: 'Mehrfachort',
        regionId: 'region-1',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);
    repository.listWasteStreets.mockResolvedValue([
      ...['Ackerstraße', 'Mittelweg', 'Ziegelstraße'].map((name, index) => ({
        id: `street-consensus-${index}`,
        name,
        cityId: 'city-consensus',
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
      ...['Am Markt', 'Dorfstraße', 'Wiesenweg'].map((name, index) => ({
        id: `street-ambiguous-${index}`,
        name,
        cityId: 'city-ambiguous',
        createdAt: timestamp,
        updatedAt: timestamp,
      })),
    ]);
    repository.updateWasteCityPostalCodeIfMissing.mockResolvedValue(true);
  });

  it('updates only missing cities with embedded or consistent German postal codes', async () => {
    const sleep = vi.fn(async () => undefined);
    const reportProgress = vi.fn(async () => undefined);
    const resolve = vi.fn(async (query: string) => {
      if (query.includes('Perleberg')) {
        return [
          {
            label: '19348 Perleberg, Prignitz',
            postalCode: '19348',
            city: 'Perleberg',
            county: 'Landkreis Prignitz',
            countryCode: 'DE',
          },
        ];
      }
      const postalCode = query.includes('Am Markt') ? '11111' : '22222';
      return [
        {
          label: `${postalCode} Mehrfachort, Prignitz`,
          postalCode,
          city: 'Mehrfachort',
          county: 'Landkreis Prignitz',
          countryCode: 'de',
        },
      ];
    });
    const operation = createEnrichPostalCodesOperation({
      createPostalCodeResolver: vi.fn(async () => ({ rateLimitPerMinute: 60, resolve })),
      sleep,
    });

    await expect(
      operation('instance-1', { operation: 'enrich-postal-codes' }, { reportProgress })
    ).resolves.toEqual({
      durationMs: expect.any(Number),
      details: {
        cityCount: 4,
        missingCount: 3,
        resolvedCount: 2,
        updatedCount: 2,
        ambiguousCount: 1,
        notFoundCount: 0,
        failedCount: 0,
        skippedExistingCount: 0,
        providerRequestCount: 6,
        requestBudget: null,
        budgetExhausted: false,
        unprocessedCount: 0,
      },
    });
    expect(repository.updateWasteCityPostalCodeIfMissing.mock.calls).toEqual([
      ['city-embedded', '19339'],
      ['city-consensus', '19348'],
    ]);
    expect(resolve).toHaveBeenCalledTimes(6);
    expect(sleep).toHaveBeenCalledTimes(5);
    expect(reportProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        completedSteps: 3,
        totalSteps: 3,
        currentPhase: 'waste-management.completed',
        currentStepKey: 'complete-operation',
      })
    );
  });

  it('rejects substring place matches instead of assigning another city postal code', async () => {
    repository.listWasteCities.mockResolvedValue([
      {
        id: 'city-burg',
        name: 'Burg',
        regionId: 'region-1',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);
    repository.listWasteStreets.mockResolvedValue([]);
    const operation = createEnrichPostalCodesOperation({
      createPostalCodeResolver: vi.fn(async () => ({
        rateLimitPerMinute: 60,
        resolve: vi.fn(async () => [
          {
            label: '20095 Hamburg',
            postalCode: '20095',
            city: 'Hamburg',
            countryCode: 'DE',
          },
        ]),
      })),
    });

    await expect(
      operation('instance-1', { operation: 'enrich-postal-codes' })
    ).resolves.toMatchObject({ details: { updatedCount: 0, notFoundCount: 1 } });
    expect(repository.updateWasteCityPostalCodeIfMissing).not.toHaveBeenCalled();
  });

  it('accepts a locality from the label only when the expected region also matches', async () => {
    repository.listWasteCities.mockResolvedValue([
      { id: 'city-kletzke', name: 'Kletzke', regionId: 'region-1' },
      { id: 'city-kletzke-wrong-region', name: 'Kletzke', regionId: 'region-2' },
    ]);
    repository.listWasteRegions.mockResolvedValue([
      { id: 'region-1', name: 'Landkreis Prignitz' },
      { id: 'region-2', name: 'Altmark' },
    ]);
    repository.listWasteStreets.mockResolvedValue([]);
    const resolve = vi.fn(async () => [
      {
        label: 'Kletzke, Plattenburg, Landkreis Prignitz, Brandenburg, Deutschland',
        postalCode: '19339',
        city: 'Plattenburg',
        county: 'Landkreis Prignitz',
        state: 'Brandenburg',
        countryCode: 'DE',
      },
    ]);
    const operation = createEnrichPostalCodesOperation({
      createPostalCodeResolver: vi.fn(async () => ({ rateLimitPerMinute: 60, resolve })),
      sleep: vi.fn(async () => undefined),
    });

    await expect(
      operation('instance-1', { operation: 'enrich-postal-codes' })
    ).resolves.toMatchObject({
      details: { updatedCount: 1, notFoundCount: 1 },
    });
    expect(repository.updateWasteCityPostalCodeIfMissing).toHaveBeenCalledExactlyOnceWith(
      'city-kletzke',
      '19339'
    );
  });

  it('fails the job when the provider request fails so the worker can retry', async () => {
    repository.listWasteCities.mockResolvedValue([
      { id: 'city-1', name: 'Erster Ort', regionId: 'region-1' },
      { id: 'city-2', name: 'Zweiter Ort', regionId: 'region-1' },
    ]);
    repository.listWasteStreets.mockResolvedValue([]);
    const sleep = vi.fn(async () => undefined);
    const resolve = vi.fn().mockRejectedValueOnce(new Error('provider_timeout'));
    const operation = createEnrichPostalCodesOperation({
      createPostalCodeResolver: vi.fn(async () => ({ rateLimitPerMinute: 60, resolve })),
      sleep,
    });

    const reportProgress = vi.fn(async () => undefined);
    await expect(
      operation('instance-1', { operation: 'enrich-postal-codes' }, { reportProgress })
    ).rejects.toThrow('provider_timeout');

    expect(resolve).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
    expect(reportProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStepKey: 'resolve-postal-codes',
        details: expect.objectContaining({ providerRequestCount: 1 }),
      })
    );
  });

  it('persists confirmed results before forwarding a later provider failure', async () => {
    repository.listWasteCities.mockResolvedValue([
      { id: 'city-1', name: 'Erster Ort', regionId: 'region-1' },
      { id: 'city-2', name: 'Zweiter Ort', regionId: 'region-1' },
    ]);
    repository.listWasteStreets.mockResolvedValue([]);
    const resolve = vi
      .fn()
      .mockResolvedValueOnce([
        {
          label: 'Erster Ort, Landkreis Prignitz, Deutschland',
          postalCode: '19348',
          city: 'Erster Ort',
          county: 'Prignitz',
          countryCode: 'DE',
        },
      ])
      .mockRejectedValueOnce(new Error('provider_timeout'));
    const operation = createEnrichPostalCodesOperation({
      createPostalCodeResolver: vi.fn(async () => ({ rateLimitPerMinute: 60, resolve })),
      sleep: vi.fn(async () => undefined),
    });

    await expect(operation('instance-1', { operation: 'enrich-postal-codes' })).rejects.toThrow(
      'provider_timeout'
    );
    expect(repository.updateWasteCityPostalCodeIfMissing).toHaveBeenCalledExactlyOnceWith(
      'city-1',
      '19348'
    );
  });

  it('stops safely and reports a partial result when the provider request budget is exhausted', async () => {
    repository.listWasteCities.mockResolvedValue(
      ['Erster Ort', 'Zweiter Ort', 'Dritter Ort'].map((name, index) => ({
        id: `city-${index + 1}`,
        name,
        regionId: 'region-1',
      }))
    );
    repository.listWasteStreets.mockResolvedValue([]);
    const resolve = vi.fn(async () => []);
    const reportProgress = vi.fn(async () => undefined);
    const operation = createEnrichPostalCodesOperation({
      createPostalCodeResolver: vi.fn(async () => ({
        rateLimitPerMinute: 300,
        requestBudget: 2,
        resolve,
      })),
      sleep: vi.fn(async () => undefined),
    });

    await expect(
      operation('instance-1', { operation: 'enrich-postal-codes' }, { reportProgress })
    ).resolves.toMatchObject({
      details: {
        providerRequestCount: 2,
        requestBudget: 2,
        budgetExhausted: true,
        unprocessedCount: 1,
        notFoundCount: 2,
      },
    });
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(reportProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ completedSteps: 2, totalSteps: 3 })
    );
  });

  it('deducts provider requests persisted by an earlier retry attempt', async () => {
    repository.listWasteCities.mockResolvedValue([
      { id: 'city-1', name: 'Erster Ort', regionId: 'region-1' },
      { id: 'city-2', name: 'Zweiter Ort', regionId: 'region-1' },
    ]);
    repository.listWasteStreets.mockResolvedValue([]);
    const resolve = vi.fn(async () => []);
    const reportProgress = vi.fn(async () => undefined);
    const operation = createEnrichPostalCodesOperation({
      createPostalCodeResolver: vi.fn(async () => ({
        rateLimitPerMinute: 300,
        requestBudget: 3,
        resolve,
      })),
      sleep: vi.fn(async () => undefined),
    });

    await expect(
      operation(
        'instance-1',
        { operation: 'enrich-postal-codes' },
        { reportProgress },
        {
          previousProgress: {
            completedSteps: 1,
            totalSteps: 2,
            details: { providerRequestCount: 2 },
          },
        }
      )
    ).resolves.toMatchObject({
      details: {
        providerRequestCount: 3,
        requestBudget: 3,
        budgetExhausted: true,
        unprocessedCount: 1,
      },
    });
    expect(resolve).toHaveBeenCalledOnce();
    expect(reportProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ providerRequestCount: 3 }),
      })
    );
  });
});
