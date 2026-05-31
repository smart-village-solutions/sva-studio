import type {
  WasteHolidayRuleRecord,
  WasteHolidayStateCode,
} from '@sva/core';

export const wasteHolidaySyncHorizonYears = 10;

type FeiertageApiResponse = Readonly<Record<string, { readonly datum?: unknown; readonly hinweis?: unknown }>>;

export type WasteHolidayApiEntry = {
  readonly holidayDate: string;
  readonly holidayName: string;
};

export const buildWasteHolidayApiUrl = (year: number, stateCode: WasteHolidayStateCode): URL => {
  const url = new URL('https://feiertage-api.de/api/');
  url.searchParams.set('jahr', String(year));
  url.searchParams.set('nur_land', stateCode);
  return url;
};

export const normalizeWasteHolidayApiResponse = (payload: unknown): readonly WasteHolidayApiEntry[] => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('invalid_holiday_api_payload');
  }

  return Object.entries(payload as FeiertageApiResponse)
    .map(([holidayName, value]) => {
      if (typeof holidayName !== 'string' || typeof value?.datum !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.datum)) {
        return null;
      }
      return {
        holidayDate: value.datum,
        holidayName,
      };
    })
    .filter((entry): entry is WasteHolidayApiEntry => entry !== null)
    .sort((left, right) => left.holidayDate.localeCompare(right.holidayDate) || left.holidayName.localeCompare(right.holidayName));
};

export const deriveHolidayRuleConfigurationStatus = (
  rule: Pick<WasteHolidayRuleRecord, 'scope' | 'strategy'>
): WasteHolidayRuleRecord['configurationStatus'] => (rule.scope && rule.strategy ? 'configured' : 'draft');
