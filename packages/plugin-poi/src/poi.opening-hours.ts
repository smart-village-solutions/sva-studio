const CANONICAL_WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

type CanonicalWeekday = (typeof CANONICAL_WEEKDAYS)[number];

const WEEKDAY_ALIASES: Readonly<Record<string, CanonicalWeekday>> = {
  MO: 'MO',
  MONDAY: 'MO',
  MONDAYS: 'MO',
  MONTAG: 'MO',
  'MO.': 'MO',
  MONTAGS: 'MO',
  TU: 'TU',
  TUE: 'TU',
  TUESDAY: 'TU',
  DIENSTAG: 'TU',
  DI: 'TU',
  'DI.': 'TU',
  WE: 'WE',
  WED: 'WE',
  WEDNESDAY: 'WE',
  MITTWOCH: 'WE',
  MI: 'WE',
  'MI.': 'WE',
  TH: 'TH',
  THU: 'TH',
  THURSDAY: 'TH',
  DONNERSTAG: 'TH',
  DO: 'TH',
  'DO.': 'TH',
  FR: 'FR',
  FRI: 'FR',
  FRIDAY: 'FR',
  FREITAG: 'FR',
  'FR.': 'FR',
  SA: 'SA',
  SAT: 'SA',
  SATURDAY: 'SA',
  SAMSTAG: 'SA',
  SO: 'SU',
  'SO.': 'SU',
  SONNTAG: 'SU',
  SU: 'SU',
  SUN: 'SU',
  SUNDAY: 'SU',
} as const;

export const POI_OPENING_HOUR_WEEKDAYS = CANONICAL_WEEKDAYS;

export const normalizeOpeningHourWeekday = (value?: string | null): string => {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) {
    return '';
  }
  return WEEKDAY_ALIASES[normalized] ?? normalized;
};
