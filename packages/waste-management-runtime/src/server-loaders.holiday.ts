import {
  buildWasteHolidayApiUrl,
  deriveHolidayRuleConfigurationStatus,
  normalizeWasteHolidayApiResponse,
  wasteHolidaySyncHorizonYears,
} from '@sva/waste-management-contracts';
import type {
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteHolidayStateCode,
  WasteHolidaySyncStatus,
} from '@sva/waste-management-contracts';
import type { WasteLoaderContext, WasteRepository } from './server-loaders.context.js';

const hasManualHolidayConflict = (
  date: string,
  shifts: readonly WasteGlobalDateShiftRecord[]
): boolean => shifts.some((shift) => shift.originalDate === date || shift.actualDate === date);

export class WasteHolidayLoaders {
  constructor(private readonly context: WasteLoaderContext) {}

  private syncYear = async (
    repository: WasteRepository,
    instanceId: string,
    year: number,
    stateCode: WasteHolidayStateCode,
    existing: ReadonlyMap<string, WasteHolidayRuleRecord>,
    shifts: readonly WasteGlobalDateShiftRecord[],
    confirmed: Set<string>,
    successful: Set<number>
  ): Promise<void> => {
    const response = await fetch(buildWasteHolidayApiUrl(year, stateCode));
    if (!response.ok) throw new Error(`holiday_api_http_${response.status}`);
    const entries = normalizeWasteHolidayApiResponse((await response.json()) as unknown);
    successful.add(year);
    for (const entry of entries) {
      const key = `${entry.holidayDate}::${entry.holidayName}`;
      confirmed.add(key);
      const previous = existing.get(key);
      const nextRule: Omit<WasteHolidayRuleRecord, 'createdAt' | 'updatedAt'> = {
        id: previous?.id ?? crypto.randomUUID(),
        holidayDate: entry.holidayDate,
        holidayName: entry.holidayName,
        year,
        stateCode,
        sourceStatus: 'confirmed',
        configurationStatus: deriveHolidayRuleConfigurationStatus(previous ?? {}),
        conflictStatus: hasManualHolidayConflict(entry.holidayDate, shifts)
          ? 'manual-global-rule'
          : 'none',
        scope: previous?.scope,
        strategy: previous?.strategy,
      };
      await this.context.measureWasteRepositoryStep(
        instanceId,
        'sync_waste_holiday_rules',
        'upsert_waste_holiday_rule',
        () => repository.upsertWasteHolidayRule(nextRule)
      );
    }
  };

  private markUnconfirmed = async (
    repository: WasteRepository,
    instanceId: string,
    existing: readonly WasteHolidayRuleRecord[],
    successful: ReadonlySet<number>,
    confirmed: ReadonlySet<string>,
    shifts: readonly WasteGlobalDateShiftRecord[]
  ): Promise<void> => {
    const notConfirmed = existing.filter(
      (rule) =>
        successful.has(rule.year) && !confirmed.has(`${rule.holidayDate}::${rule.holidayName}`)
    );
    for (const rule of notConfirmed) {
      await this.context.measureWasteRepositoryStep(
        instanceId,
        'sync_waste_holiday_rules',
        'upsert_waste_holiday_rule_not_confirmed',
        () =>
          repository.upsertWasteHolidayRule({
            id: rule.id,
            holidayDate: rule.holidayDate,
            holidayName: rule.holidayName,
            year: rule.year,
            stateCode: rule.stateCode,
            sourceStatus: 'not-confirmed',
            configurationStatus: deriveHolidayRuleConfigurationStatus(rule),
            conflictStatus: hasManualHolidayConflict(rule.holidayDate, shifts)
              ? 'manual-global-rule'
              : 'none',
            scope: rule.scope,
            strategy: rule.strategy,
          })
      );
    }
  };

  syncWasteHolidayRules = async (
    instanceId: string,
    stateCode: WasteHolidayStateCode
  ): Promise<WasteHolidaySyncStatus> =>
    this.context.withWasteRepository(instanceId, 'sync_waste_holiday_rules', async (repository) => {
      const currentYear = new Date().getUTCFullYear();
      const years = Array.from(
        { length: wasteHolidaySyncHorizonYears },
        (_, index) => currentYear + index
      );
      const existingRules = await this.context.measureWasteRepositoryStep(
        instanceId,
        'sync_waste_holiday_rules',
        'list_waste_holiday_rules',
        () => repository.listWasteHolidayRules({ stateCode })
      );
      const shifts = await this.context.measureWasteRepositoryStep(
        instanceId,
        'sync_waste_holiday_rules',
        'list_waste_global_date_shifts',
        () => repository.listWasteGlobalDateShifts()
      );
      const existing = new Map<string, WasteHolidayRuleRecord>(
        existingRules.map((rule) => [`${rule.holidayDate}::${rule.holidayName}`, rule] as const)
      );
      const confirmed = new Set<string>();
      const successful = new Set<number>();
      let failedYears = 0;
      for (const year of years) {
        try {
          await this.syncYear(
            repository,
            instanceId,
            year,
            stateCode,
            existing,
            shifts,
            confirmed,
            successful
          );
        } catch {
          failedYears += 1;
        }
      }
      await this.markUnconfirmed(
        repository,
        instanceId,
        existingRules,
        successful,
        confirmed,
        shifts
      );
      if (failedYears === 0) return 'success';
      if (successful.size > 0) return 'partial_success';
      return 'failed';
    });
}
