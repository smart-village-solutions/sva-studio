import type { WasteCityRecord, WasteStreetRecord } from '@sva/core';

import { withWasteClient } from './waste-management-operations.shared.js';
import type {
  WasteManagementOperationRuntime,
  WasteOperationProgressReporter,
  WasteOperationRuntimeDeps,
} from './waste-management-operations.types.js';

const germanPostalCodePattern = /^\d{5}$/;
const embeddedPostalCodePattern = /(?:^|\D)(\d{5})(?=\D|$)/g;

const normalizePlace = (value: string): string =>
  value
    .replace(/\(\s*\d{5}\s*\)/g, ' ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('de')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeRegion = (value: string): string =>
  normalizePlace(value).replace(/^(?:landkreis|kreis|gemeinde|stadt|amt|verbandsgemeinde)\s+/, '');

const containsNormalizedPhrase = (value: string | undefined, phrase: string): boolean => {
  const normalizedValue = normalizePlace(value ?? '');
  return normalizedValue === phrase || ` ${normalizedValue} `.includes(` ${phrase} `);
};

const embeddedPostalCode = (cityName: string): string | undefined => {
  const matches = new Set(
    [...cityName.matchAll(embeddedPostalCodePattern)]
      .map((match) => match[1])
      .filter((value): value is string => Boolean(value))
  );
  return matches.size === 1 ? [...matches][0] : undefined;
};

const selectStreetSamples = (
  streets: readonly WasteStreetRecord[]
): readonly WasteStreetRecord[] => {
  if (streets.length <= 3) return streets;
  return [streets[0], streets[Math.floor((streets.length - 1) / 2)], streets.at(-1)].filter(
    (street): street is WasteStreetRecord => Boolean(street)
  );
};

const validPostalCodes = (
  city: WasteCityRecord,
  features: readonly {
    readonly label: string;
    readonly postalCode?: string;
    readonly city?: string;
    readonly district?: string;
    readonly county?: string;
    readonly state?: string;
    readonly countryCode?: string;
  }[],
  regionName?: string
): ReadonlySet<string> => {
  const normalizedCity = normalizePlace(city.name);
  const normalizedRegion = normalizeRegion(regionName ?? '');
  return new Set(
    features
      .filter((feature) => feature.countryCode?.toLocaleLowerCase('de') === 'de')
      .filter(
        (feature) =>
          normalizedCity.length > 0 &&
          (normalizePlace(feature.city ?? '') === normalizedCity ||
            containsNormalizedPhrase(feature.label, normalizedCity))
      )
      .filter(
        (feature) =>
          normalizedRegion.length === 0 ||
          [feature.district, feature.county, feature.state, feature.label].some((value) =>
            containsNormalizedPhrase(normalizeRegion(value ?? ''), normalizedRegion)
          )
      )
      .map((feature) => feature.postalCode?.trim())
      .filter((postalCode): postalCode is string =>
        Boolean(postalCode && germanPostalCodePattern.test(postalCode))
      )
  );
};

const reportProgress = async (
  reporter: WasteOperationProgressReporter | undefined,
  completedSteps: number,
  totalSteps: number,
  input: {
    readonly stepKey: 'load-cities' | 'resolve-postal-codes';
    readonly providerRequestCount: number;
  }
) =>
  reporter?.reportProgress({
    completedSteps,
    totalSteps,
    currentPhase: 'waste-management.enrich-postal-codes',
    currentStepKey: input.stepKey,
    details: {
      processedCities: completedSteps,
      totalCities: totalSteps,
      providerRequestCount: input.providerRequestCount,
    },
    lastUpdatedAt: new Date().toISOString(),
  });

const reportCompleted = async (
  reporter: WasteOperationProgressReporter | undefined,
  completedSteps: number,
  totalSteps: number
) =>
  reporter?.reportProgress({
    completedSteps,
    totalSteps,
    currentPhase: 'waste-management.completed',
    currentStepKey: 'complete-operation',
    details: { processedCities: completedSteps, totalCities: totalSteps },
    lastUpdatedAt: new Date().toISOString(),
  });

const loadCandidates = async (deps: WasteOperationRuntimeDeps, instanceId: string) =>
  withWasteClient(deps, instanceId, async ({ repository }) => {
    const [cities, regions, streets] = await Promise.all([
      repository.listWasteCities(),
      repository.listWasteRegions(),
      repository.listWasteStreets(),
    ]);
    const streetsByCityId = new Map<string, WasteStreetRecord[]>();
    for (const street of streets) {
      const entries = streetsByCityId.get(street.cityId) ?? [];
      entries.push(street);
      streetsByCityId.set(street.cityId, entries);
    }
    return {
      cities,
      regionsById: new Map(regions.map((region) => [region.id, region.name] as const)),
      streetsByCityId,
    };
  });

const persistPostalCodes = async (
  deps: WasteOperationRuntimeDeps,
  instanceId: string,
  updates: readonly { readonly cityId: string; readonly postalCode: string }[],
  counts: { updatedCount: number; failedCount: number; skippedExistingCount: number }
) => {
  if (updates.length === 0) return;
  await withWasteClient(deps, instanceId, async ({ repository }) => {
    for (const update of updates) {
      try {
        const updated = await repository.updateWasteCityPostalCodeIfMissing(
          update.cityId,
          update.postalCode
        );
        if (updated) counts.updatedCount += 1;
        else counts.skippedExistingCount += 1;
      } catch {
        counts.failedCount += 1;
      }
    }
  });
};

type PostalCodeResolution =
  | { readonly status: 'resolved'; readonly postalCode: string }
  | { readonly status: 'ambiguous' | 'budget-exhausted' | 'not-found' };

const resolveCityPostalCode = async (input: {
  readonly city: WasteCityRecord;
  readonly regionName?: string;
  readonly streets: readonly WasteStreetRecord[];
  readonly resolver: NonNullable<
    Awaited<ReturnType<NonNullable<WasteOperationRuntimeDeps['createPostalCodeResolver']>>>
  >;
  readonly paceRequest: () => Promise<boolean>;
}): Promise<PostalCodeResolution> => {
  const samplePostalCodes: string[] = [];
  let ambiguous = false;
  const streetSamples = selectStreetSamples(input.streets);
  const samples = streetSamples.length > 0 ? streetSamples : [undefined];

  for (const street of samples) {
    if (!(await input.paceRequest())) return { status: 'budget-exhausted' };
    const query = [street?.name, input.city.name, input.regionName, 'Deutschland']
      .filter(Boolean)
      .join(', ');
    const candidates = validPostalCodes(
      input.city,
      await input.resolver.resolve(query),
      input.regionName
    );
    ambiguous ||= candidates.size > 1;
    if (candidates.size === 1) samplePostalCodes.push([...candidates][0] as string);
  }

  const consensus = new Set(samplePostalCodes);
  if (ambiguous || consensus.size > 1) return { status: 'ambiguous' };
  const postalCode = [...consensus][0];
  return postalCode ? { status: 'resolved', postalCode } : { status: 'not-found' };
};

export const createEnrichPostalCodesOperation =
  (deps: WasteOperationRuntimeDeps): WasteManagementOperationRuntime['enrichPostalCodes'] =>
  async (instanceId, _input, progressReporter, context) => {
    const startedAt = Date.now();
    const { cities, regionsById, streetsByCityId } = await loadCandidates(deps, instanceId);
    const missingCities = cities.filter((city) => !city.postalCode?.trim());
    const resolver =
      missingCities.length > 0 ? await deps.createPostalCodeResolver?.(instanceId) : undefined;
    if (missingCities.length > 0 && !resolver) throw new Error('postal_code_resolver_unavailable');

    const persistedProviderRequestCount =
      typeof context?.previousProgress?.details?.providerRequestCount === 'number' &&
      Number.isSafeInteger(context.previousProgress.details.providerRequestCount) &&
      context.previousProgress.details.providerRequestCount >= 0
        ? context.previousProgress.details.providerRequestCount
        : 0;
    const counts = {
      cityCount: cities.length,
      missingCount: missingCities.length,
      resolvedCount: 0,
      updatedCount: 0,
      ambiguousCount: 0,
      notFoundCount: 0,
      failedCount: 0,
      skippedExistingCount: 0,
      providerRequestCount: persistedProviderRequestCount,
      requestBudget: resolver?.requestBudget ?? null,
      budgetExhausted: false,
      unprocessedCount: 0,
    };
    await reportProgress(progressReporter, 0, missingCities.length, {
      stepKey: 'load-cities',
      providerRequestCount: persistedProviderRequestCount,
    });

    const intervalMs = Math.ceil(60_000 / Math.max(1, resolver?.rateLimitPerMinute ?? 1));
    const pendingUpdates: { readonly cityId: string; readonly postalCode: string }[] = [];
    const requestBudget = resolver?.requestBudget ?? Number.POSITIVE_INFINITY;
    let providerRequestCount = persistedProviderRequestCount;
    let processedCities = 0;
    const sleep =
      deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const paceRequest = async () => {
      if (providerRequestCount >= requestBudget) return false;
      if (providerRequestCount > 0) {
        await sleep(intervalMs);
      }
      providerRequestCount += 1;
      counts.providerRequestCount = providerRequestCount;
      await reportProgress(progressReporter, processedCities, missingCities.length, {
        stepKey: 'resolve-postal-codes',
        providerRequestCount,
      });
      return true;
    };
    try {
      for (const [index, city] of missingCities.entries()) {
        processedCities = index;
        let postalCode = embeddedPostalCode(city.name);
        if (!postalCode && resolver) {
          const resolution = await resolveCityPostalCode({
            city,
            regionName: city.regionId ? regionsById.get(city.regionId) : undefined,
            streets: streetsByCityId.get(city.id) ?? [],
            resolver,
            paceRequest,
          });
          if (resolution.status === 'resolved') postalCode = resolution.postalCode;
          else if (resolution.status === 'ambiguous') counts.ambiguousCount += 1;
          else if (resolution.status === 'budget-exhausted') {
            counts.budgetExhausted = true;
            counts.unprocessedCount = missingCities.length - index;
            break;
          } else counts.notFoundCount += 1;
        }

        if (postalCode) {
          counts.resolvedCount += 1;
          pendingUpdates.push({ cityId: city.id, postalCode });
        }
        if ((index + 1) % 10 === 0 || index + 1 === missingCities.length) {
          await reportProgress(progressReporter, index + 1, missingCities.length, {
            stepKey: 'resolve-postal-codes',
            providerRequestCount,
          });
          await persistPostalCodes(deps, instanceId, pendingUpdates.splice(0), counts);
        }
      }
    } catch (error) {
      await persistPostalCodes(deps, instanceId, pendingUpdates.splice(0), counts);
      throw error;
    }
    await persistPostalCodes(deps, instanceId, pendingUpdates.splice(0), counts);
    await reportCompleted(
      progressReporter,
      counts.budgetExhausted
        ? missingCities.length - counts.unprocessedCount
        : missingCities.length,
      missingCities.length
    );

    return { durationMs: Date.now() - startedAt, details: counts };
  };
