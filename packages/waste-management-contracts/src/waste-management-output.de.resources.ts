const holidays = {
  newYear: 'Neujahr',
  goodFriday: 'Karfreitag',
  easterMonday: 'Ostermontag',
  labourDay: 'Maifeiertag',
  ascension: 'Christi Himmelfahrt',
  whitMonday: 'Pfingstmontag',
  germanUnity: 'Tag der Deutschen Einheit',
  christmasDay: '1. Weihnachtstag',
  secondChristmasDay: '2. Weihnachtstag',
};

type WasteCalendarPdfHoliday = keyof typeof holidays;

const holidayShortLabels: Partial<Record<WasteCalendarPdfHoliday, string>> = {
  ascension: 'Christi Himmelf.',
  germanUnity: 'Tag d. Dt. Einheit',
};

const months: Readonly<Record<number, string>> = {
  1: 'Januar',
  2: 'Februar',
  3: 'März',
  4: 'April',
  5: 'Mai',
  6: 'Juni',
  7: 'Juli',
  8: 'August',
  9: 'September',
  10: 'Oktober',
  11: 'November',
  12: 'Dezember',
};

const weekdays: Readonly<Record<number, string>> = {
  0: 'Mo',
  1: 'Di',
  2: 'Mi',
  3: 'Do',
  4: 'Fr',
  5: 'Sa',
  6: 'So',
};

export const wasteCalendarPdfGerman = {
  pdf: {
    title: 'Abfallkalender {{year}}',
    continuation: 'Fortsetzung zur Kalenderseite: {{firstMonth}} bis {{lastMonth}}',
    legend: { shiftedPickup: 'Ausweichtermin' },
    brandingPlaceholder: 'Kommunales Waste-Management',
    configuredBrandingPlaceholder: 'Branding-Grafik',
    tourHintLabel: 'Tour: {{tourName}}',
    months,
    weekdays,
    holidays,
    holidayShortLabels,
  },
};
